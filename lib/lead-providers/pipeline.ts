import { GoogleMapsProvider } from './google-maps-provider';
import { YelpProvider } from './yelp-provider';
import { areLeadsDuplicate, mergeLeadData } from './merge-engine';
import { CompanyLead } from './types';
import { calculateLeadScore } from '../lead-scoring';

export async function runCompanyLeadPipeline(
  supabase: any,
  job: any
): Promise<void> {
  const category = job.category;
  const region = job.region;
  const limitCount = job.limit_count;
  const lat = job.lat;
  const lng = job.lng;
  const radius = job.radius;
  const onlyEmail = job.only_email || false;
  const workspaceId = job.workspace_id;
  const jobId = job.id;

  const gmapsProvider = new GoogleMapsProvider();
  const yelpProvider = new YelpProvider();

  console.log(`\n[Pipeline] Starting real-time company lead pipeline search...`);

  // 1. Fetch existing leads for deduplication at the start
  const { data: existingLeads, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('lead_entity_type', 'company');

  if (fetchError) {
    throw new Error(`Failed to fetch existing leads from database: ${fetchError.message}`);
  }

  const activeSavedLeads = existingLeads ? [...existingLeads] : [];
  let savedCount = 0;
  let internalDuplicates = 0;
  let dbDuplicates = 0;

  // Track provider execution results counts
  let googleCount = 0;
  let yelpCount = 0;

  // Shared function to handle incoming lead in real-time
  const handleIncomingLead = async (incoming: CompanyLead) => {
    // A. Filter onlyEmail if enabled
    if (onlyEmail && (!incoming.email || incoming.email.trim().length === 0)) {
      return;
    }

    // B. Check limitCount condition
    if (savedCount >= limitCount) {
      return;
    }

    // Increment provider counts
    if (incoming.provider === 'google_maps') {
      googleCount++;
    } else if (incoming.provider === 'yelp') {
      yelpCount++;
    }

    // C. Deduplication check in activeSavedLeads
    let duplicateIndex = -1;
    for (let i = 0; i < activeSavedLeads.length; i++) {
      if (areLeadsDuplicate(activeSavedLeads[i], incoming)) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex !== -1) {
      // It's a duplicate of an existing lead
      const existingRecord = activeSavedLeads[duplicateIndex];
      if (existingRecord.created_at) {
        dbDuplicates++;
      } else {
        internalDuplicates++;
      }

      // Merge new data fields
      const mergedPayload = mergeLeadData(existingRecord, incoming);
      activeSavedLeads[duplicateIndex] = mergedPayload;

      // Recalculate score
      const score = calculateLeadScore({
        phone: mergedPayload.phone,
        website: mergedPayload.website,
        address: mergedPayload.address,
        category: mergedPayload.category,
        rating: mergedPayload.rating,
        reviews_count: mergedPayload.reviews_count
      });

      const updatePayload = {
        phone: mergedPayload.phone || null,
        website: mergedPayload.website || null,
        address: mergedPayload.address || null,
        lat: mergedPayload.lat || null,
        lng: mergedPayload.lng || null,
        email: mergedPayload.email || null,
        maps_url: mergedPayload.maps_url || null,
        rating: mergedPayload.rating ?? null,
        reviews_count: mergedPayload.reviews_count ?? null,
        sources: mergedPayload.sources,
        lead_score: score.lead_score,
        lead_grade: score.lead_grade,
        updated_at: new Date().toISOString()
      };

      const { error: updateErr } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', existingRecord.id);

      if (updateErr) {
        console.error(`[Pipeline] Error updating existing lead "${incoming.name}":`, updateErr);
      }
    } else {
      // Create new lead record
      const score = calculateLeadScore({
        phone: incoming.phone,
        website: incoming.website,
        address: incoming.address,
        category: incoming.category,
        rating: incoming.rating,
        reviews_count: incoming.reviews_count
      });

      // Set initial sources
      (incoming as any).sources = [incoming.provider];

      const insertPayload = {
        workspace_id: workspaceId,
        job_id: jobId,
        name: incoming.name,
        phone: incoming.phone || null,
        address: incoming.address || null,
        website: incoming.website || null,
        category: incoming.category || category,
        region: region || `Geo:${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`,
        lat: incoming.latitude || null,
        lng: incoming.longitude || null,
        email: incoming.email || null,
        maps_url: incoming.maps_url || null,
        contact_status: 'pending',
        rating: incoming.rating ?? null,
        reviews_count: incoming.reviews_count ?? null,
        lead_score: score.lead_score,
        lead_grade: score.lead_grade,
        scoring_version: 1,
        lead_entity_type: 'company',
        lead_origin: 'maps',
        status: 'active',
        sources: (incoming as any).sources || [incoming.provider],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertedLead, error: insertErr } = await supabase
        .from('leads')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertErr || !insertedLead) {
        console.error(`[Pipeline] Error inserting new lead "${incoming.name}":`, insertErr);
      } else {
        savedCount++;
        activeSavedLeads.push(insertedLead);

        // Update progress count of the job in the database in real-time
        await supabase
          .from('lead_finder_jobs')
          .update({
            progress_count: savedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }
    }
  };

  // 2. Run providers in parallel, passing the real-time saving handler
  await Promise.all([
    gmapsProvider.search({ category, region, limitCount, lat, lng, radius, onLead: handleIncomingLead }),
    yelpProvider.search({ category, region, limitCount, lat, lng, radius, onLead: handleIncomingLead })
  ]);

  const totalDuplicates = internalDuplicates + dbDuplicates;
  const mergedCount = activeSavedLeads.length - (existingLeads ? existingLeads.length : 0);

  console.log(`GOOGLE_RESULTS: ${googleCount}`);
  console.log(`YELP_RESULTS: ${yelpCount}`);
  console.log(`MERGED: ${mergedCount}`);
  console.log(`DUPLICATES: ${totalDuplicates}`);
  console.log(`SAVED: ${savedCount}\n`);

  // 3. Update job final execution summary in database
  const executionSummary = {
    google_results: googleCount,
    yelp_results: yelpCount,
    merged: mergedCount,
    duplicates: totalDuplicates,
    saved: savedCount
  };

  const { error: jobUpdateErr } = await supabase
    .from('lead_finder_jobs')
    .update({
      progress_count: savedCount,
      execution_summary: executionSummary,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (jobUpdateErr) {
    console.error('[Pipeline] Error updating job execution summary:', jobUpdateErr);
  }
}

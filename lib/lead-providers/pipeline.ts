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

  console.log(`\n[Pipeline] Starting parallel provider search...`);
  
  // 1. Run providers in parallel
  const [gmapsResults, yelpResults] = await Promise.all([
    gmapsProvider.search({ category, region, limitCount, lat, lng, radius }),
    yelpProvider.search({ category, region, limitCount, lat, lng, radius })
  ]);

  const googleCount = gmapsResults.length;
  const yelpCount = yelpResults.length;

  console.log(`GOOGLE_RESULTS: ${googleCount}`);
  console.log(`YELP_RESULTS: ${yelpCount}`);

  // 2. Merge engine: Unify the results and deduplicate internally
  const combinedResults: CompanyLead[] = [...gmapsResults, ...yelpResults];
  const mergedResults: CompanyLead[] = [];
  let internalDuplicates = 0;

  for (const lead of combinedResults) {
    let duplicateFound = false;
    for (let i = 0; i < mergedResults.length; i++) {
      if (areLeadsDuplicate(mergedResults[i], lead)) {
        // Merge incoming into existing merged list element
        mergedResults[i] = mergeLeadData(mergedResults[i], lead);
        duplicateFound = true;
        internalDuplicates++;
        break;
      }
    }
    if (!duplicateFound) {
      // Set initial sources
      (lead as any).sources = [lead.provider];
      mergedResults.push(lead);
    }
  }

  // Filter onlyEmail if enabled
  const filteredMerged = onlyEmail
    ? mergedResults.filter(l => l.email && l.email.trim().length > 0)
    : mergedResults;

  // Limit final list to the requested limitCount
  const finalLeads = filteredMerged.slice(0, limitCount);

  // 3. Deduplication against DB: Fetch existing leads for the workspace
  const { data: existingLeads, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('lead_entity_type', 'company');

  if (fetchError) {
    throw new Error(`Failed to fetch existing leads from database: ${fetchError.message}`);
  }

  const existingLeadsList = existingLeads || [];
  let dbDuplicates = 0;
  let savedCount = 0;

  console.log(`[Pipeline] Merged results size: ${mergedResults.length}. Checking against ${existingLeadsList.length} database records...`);

  // 4. Persistence: Update existing or Insert new
  for (const incoming of finalLeads) {
    let existingRecord = null;
    for (const ex of existingLeadsList) {
      if (areLeadsDuplicate(ex, incoming)) {
        existingRecord = ex;
        break;
      }
    }

    if (existingRecord) {
      dbDuplicates++;
      // Merge new data fields into existing database lead record
      const mergedPayload = mergeLeadData(existingRecord, incoming);

      // Recalculate score on merged payload
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
      } else {
        savedCount++;
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

      const { error: insertErr } = await supabase
        .from('leads')
        .insert(insertPayload);

      if (insertErr) {
        console.error(`[Pipeline] Error inserting new lead "${incoming.name}":`, insertErr);
      } else {
        savedCount++;
      }
    }
  }

  const totalDuplicates = internalDuplicates + dbDuplicates;

  console.log(`MERGED: ${mergedResults.length}`);
  console.log(`DUPLICATES: ${totalDuplicates}`);
  console.log(`SAVED: ${savedCount}\n`);

  // 5. Update job status, progress_count, and execution summary in database
  const executionSummary = {
    google_results: googleCount,
    yelp_results: yelpCount,
    merged: mergedResults.length,
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

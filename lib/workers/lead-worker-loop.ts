/**
 * lib/workers/lead-worker-loop.ts
 *
 * Re-exports the lead scraper loop so it can be bootstrapped by instrumentation.ts
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { captureProfessionalLeads } from '../lead-services';
import { runCompanyLeadPipeline } from '../lead-providers/pipeline';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as any },
  });
}

// ─── Queue Processing ─────────────────────────────────────────────────────────

async function processQueue() {
  const supabase = getSupabase();
  try {
    const { data: jobs, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !jobs?.length) return;

    const job = jobs[0];
    console.log(`[LeadWorker] Starting job ${job.id} — "${job.category}" (${job.lead_entity_type})`);

    await supabase
      .from('lead_finder_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    try {
      let leadsSaved = 0;


      if (job.lead_entity_type === 'professional') {
        // Run professional scraper
        await captureProfessionalLeads(
          job.id,
          job.category, // role
          job.region,   // location
          job.keywords, // keywords
          job.limit_count,
          async (_progress, lead) => {
            // Dedup check
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('workspace_id', job.workspace_id)
              .ilike('name', lead.display_name)
              .eq('lead_entity_type', 'professional')
              .limit(1)
              .maybeSingle();

            if (existing) {
              return true; // Already exists
            }

            // Log Stage 4 before insert
            console.log(`SAVING_RECORD

NAME: ${lead.display_name}
COUNTRY: ${lead.country || 'Unknown'}
URL: ${lead.profile_url}
SOURCE: linkedin`);

            // Insert parent lead record
            const { data: parentLead, error: insertParentErr } = await supabase
              .from('leads')
              .insert({
                workspace_id: job.workspace_id,
                job_id: job.id,
                name: lead.display_name,
                category: lead.industry || job.category,
                region: lead.location || 'Remoto',
                lead_entity_type: 'professional',
                lead_score: lead.professional_score,
                lead_grade: lead.lead_grade,
                lead_origin: 'linkedin',
                status: 'active',
                contact_status: 'completed', // URL contact details are immediately ready
              })
              .select('id')
              .single();

            if (insertParentErr || !parentLead) {
              console.error('[LeadWorker] Error inserting professional parent lead:', insertParentErr);
              return false;
            }

            // Insert child professional record
            const { error: insertChildErr } = await supabase
              .from('professional_leads')
              .insert({
                lead_id: parentLead.id,
                display_name: lead.display_name,
                professional_role: lead.professional_role,
                industry: lead.industry,
                location: lead.location,
                profile_url: lead.profile_url,
                contact_channel: lead.contact_channel,
                professional_score: lead.professional_score,
              });

            if (!insertChildErr) {
              leadsSaved++;
              console.log('SAVE_SUCCESS');
              await supabase
                .from('lead_finder_jobs')
                .update({ progress_count: leadsSaved, updated_at: new Date().toISOString() })
                .eq('id', job.id);
              return true;
            } else {
              console.error('[LeadWorker] Error inserting professional child lead:', insertChildErr);
              return false;
            }
          }
        );
      } else {
        // Run parallel company provider pipeline (Google Maps + Yelp)
        await runCompanyLeadPipeline(supabase, job);

        // Retrieve the final count for logging
        const { data: updatedJob } = await supabase
          .from('lead_finder_jobs')
          .select('progress_count')
          .eq('id', job.id)
          .single();
        if (updatedJob) {
          leadsSaved = updatedJob.progress_count;
        }
      }

      // Check if cancelled before marking complete
      const { data: final } = await supabase
        .from('lead_finder_jobs')
        .select('status')
        .eq('id', job.id)
        .single();

      if (final?.status !== 'cancelled') {
        await supabase
          .from('lead_finder_jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        console.log(`[LeadWorker] Job ${job.id} finished — ${leadsSaved} leads.`);
      }
    } catch (err: any) {
      console.error(`[LeadWorker] Failed job ${job.id}:`, err);
      await supabase
        .from('lead_finder_jobs')
        .update({ status: 'failed', error_message: err.message ?? 'Unknown error', updated_at: new Date().toISOString() })
        .eq('id', job.id);
    }
  } catch (err) {
    console.error('[LeadWorker] Global error in queue processor:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let started = false;

export function startLeadWorker() {
  if (started) return;
  started = true;
  console.log('[LeadWorker] Worker loop started by Next.js server.');
  processQueue();
  setInterval(processQueue, 5000);
}

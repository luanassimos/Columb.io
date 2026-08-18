/**
 * scripts/lead-worker.ts
 *
 * Standalone worker CLI script that boots up and processes Lead Finder jobs.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import ws from 'ws';
import { captureProfessionalLeads } from '../lib/lead-services';
import { runCompanyLeadPipeline } from '../lib/lead-providers/pipeline';
import { processProspectingBatch } from '../lib/prospecting/pipeline';

// Simple .env.local loader for local execution
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const index = trimmed.indexOf('=');
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  } else {
    console.warn('[Worker] .env.local not found in current directory.');
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Worker] Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.');
  process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: { transport: ws as any },
});

console.log('WORKER_LEADS_STARTED');

async function processQueue() {
  try {
    const { data: jobs, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !jobs?.length) return;

    const job = jobs[0];
    console.log(`[Worker] Processing job ${job.id} — "${job.category}" (${job.lead_entity_type})`);

    // 2. Set job status to running
    await supabase
      .from('lead_finder_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    // 3. Execute Scraper
    try {
      let leadsSaved = 0;


      if (job.lead_entity_type === 'professional') {
        await captureProfessionalLeads(
          job.id,
          job.category,
          job.region,
          job.keywords,
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

            if (existing) return true;

            // Log Stage 4 before insert
            console.log(`SAVING_RECORD

NAME: ${lead.display_name}
COUNTRY: ${lead.country || 'Unknown'}
URL: ${lead.profile_url}
SOURCE: linkedin`);

            // Insert parent record
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
                contact_status: 'completed',
              })
              .select('id')
              .single();

            if (insertParentErr || !parentLead) {
              console.error('[Worker] Error inserting professional parent lead:', insertParentErr);
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
              console.error('[Worker] Error inserting professional child lead:', insertChildErr);
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

      // 4. Mark job as completed only if it wasn't cancelled
      const { data: finalJob } = await supabase
        .from('lead_finder_jobs')
        .select('status')
        .eq('id', job.id)
        .single();

      if (finalJob?.status !== 'cancelled') {
        await supabase
          .from('lead_finder_jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        console.log(`[Worker] Job ${job.id} completed! ${leadsSaved} leads captured.`);
        if (job.automation_run_id) {
          const { data: summary } = await supabase.from('lead_finder_jobs').select('execution_summary').eq('id', job.id).single();
          const found = Number(summary?.execution_summary?.google_results || 0) + Number(summary?.execution_summary?.yelp_results || 0);
          await supabase.from('automation_runs').update({ status: 'running', started_at: new Date().toISOString(), leads_found: found || leadsSaved, leads_created: leadsSaved }).eq('id', job.automation_run_id);
        }
        await processProspectingBatch(supabase, job.workspace_id, job.automation_run_id, Math.min(job.limit_count || 10, 20));
      }
    } catch (scrapeError: any) {
      console.error(`[Worker] Scraper failure for job ${job.id}:`, scrapeError);
      await supabase
        .from('lead_finder_jobs')
        .update({
          status: 'failed',
          error_message: scrapeError.message || 'Scraper error.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  } catch (globalError) {
    console.error('[Worker] Global error in queue processor:', globalError);
  }
}

// Loop worker every 5 seconds
setInterval(processQueue, 5000);
// Run immediately on start
processQueue();

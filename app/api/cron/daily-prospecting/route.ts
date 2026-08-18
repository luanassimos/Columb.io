import { createAdminClient } from '@/lib/supabase/admin';
import { processProspectingBatch } from '@/lib/prospecting/pipeline';
import { runCompanyLeadPipeline } from '@/lib/lead-providers/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const { data: settings, error } = await supabase.from('automation_settings').select('*').eq('enabled', true).eq('daily_search_enabled', true).limit(5);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const queued: string[] = []; const skipped: string[] = [];

  for (const config of settings || []) {
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone || 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' }).formatToParts(new Date());
    const get = (type: string) => local.find((part) => part.type === type)?.value || '';
    const weekday = ({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6} as Record<string,number>)[get('weekday')];
    if (!(config.weekdays || []).includes(weekday)) { skipped.push(config.workspace_id); continue; }
    const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
    const idempotencyKey = `daily:${dateKey}`;
    const { data: existing } = await supabase.from('automation_runs').select('id').eq('workspace_id', config.workspace_id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) { skipped.push(config.workspace_id); continue; }

    await processProspectingBatch(supabase, config.workspace_id, null, 5);
    const { data: run, error: runError } = await supabase.from('automation_runs').insert({
      workspace_id: config.workspace_id, scheduled_for: new Date().toISOString(), idempotency_key: idempotencyKey,
      status: 'queued', leads_requested: config.daily_lead_limit,
    }).select('id').single();
    if (runError || !run) { skipped.push(config.workspace_id); continue; }

    const category = config.target_industries?.[0]; const region = config.target_regions?.[0];
    if (!category || !region) {
      await supabase.from('automation_runs').update({ status:'partial', finished_at:new Date().toISOString(), errors:[{message:'Configure ao menos um nicho e uma região.'}] }).eq('id', run.id);
      skipped.push(config.workspace_id); continue;
    }
    const { data: job, error: jobError } = await supabase.from('lead_finder_jobs').insert({
      workspace_id: config.workspace_id, automation_run_id: run.id, category, region,
      limit_count: config.daily_lead_limit, progress_count: 0, status: 'pending', only_email: false, lead_entity_type: 'company',
    }).select('*').single();
    if (jobError || !job) {
      await supabase.from('automation_runs').update({ status:'failed', finished_at:new Date().toISOString(), errors:[{message:jobError?.message || 'Falha ao criar job de busca'}] }).eq('id', run.id);
      skipped.push(config.workspace_id); continue;
    }
    try {
      await supabase.from('lead_finder_jobs').update({ status:'running', updated_at:new Date().toISOString() }).eq('id', job.id);
      await supabase.from('automation_runs').update({ status:'running', started_at:new Date().toISOString() }).eq('id', run.id);
      await runCompanyLeadPipeline(supabase, { ...job, status: 'running' });
      await supabase.from('lead_finder_jobs').update({ status:'completed', updated_at:new Date().toISOString() }).eq('id', job.id);
      const { data: completedJob } = await supabase.from('lead_finder_jobs').select('progress_count,execution_summary').eq('id', job.id).single();
      const found = Number(completedJob?.execution_summary?.google_results || 0) + Number(completedJob?.execution_summary?.yelp_results || 0);
      await supabase.from('automation_runs').update({ leads_found: found, leads_created: completedJob?.progress_count || 0 }).eq('id', run.id);
      await processProspectingBatch(supabase, config.workspace_id, run.id, Math.min(config.daily_lead_limit, 20));
      queued.push(config.workspace_id);
    } catch (pipelineError: any) {
      await supabase.from('lead_finder_jobs').update({ status:'failed', error_message:pipelineError.message, updated_at:new Date().toISOString() }).eq('id', job.id);
      await supabase.from('automation_runs').update({ status:'failed', finished_at:new Date().toISOString(), errors:[{message:pipelineError.message}] }).eq('id', run.id);
      skipped.push(config.workspace_id);
    }
  }
  return Response.json({ ok: true, queued: queued.length, skipped: skipped.length, timestamp: new Date().toISOString() });
}

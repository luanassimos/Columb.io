import 'server-only';
import { createHash } from 'node:crypto';
import { analyzeLead } from '@/lib/ai/lead-analysis';
import { generatePersonalizedEmail } from '@/lib/ai/email-generation';
import { sendEmail } from '@/services/resend';
import { resolveAiCommunicationLanguage } from '@/lib/ai/languages';

function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function safeWebsite(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch { return null; }
}

async function fetchWebsiteEvidence(website?: string | null) {
  const url = safeWebsite(website); if (!url) return null;
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'ColumbBot/1.0' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
    const html = (await response.text()).slice(0, 200_000);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
    return text ? { source_type: 'website', url: response.url, text_excerpt: text } : null;
  } catch { return null; }
}

export async function processProspectingBatch(supabase: any, workspaceId: string, runId?: string | null, limit = 10) {
  const [{ data: workspace }, { data: settings }] = await Promise.all([
    supabase.from('workspaces').select('company_ai_profile').eq('id', workspaceId).single(),
    supabase.from('automation_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
  ]);
  if (!workspace?.company_ai_profile || Object.keys(workspace.company_ai_profile).length === 0) return { enriched: 0, qualified: 0, generated: 0, sent: 0, skipped: 0 };
  const communicationLanguage = resolveAiCommunicationLanguage(settings?.communication_language).code;

  const { data: contacts } = await supabase.from('contacts').select('*').eq('workspace_id', workspaceId).in('operational_status', ['new','enriching']).order('created_at').limit(limit);
  const counters = { enriched: 0, qualified: 0, generated: 0, sent: 0, skipped: 0 };
  for (const contact of contacts || []) {
    try {
      await supabase.from('contacts').update({ operational_status: 'enriching' }).eq('id', contact.id).eq('workspace_id', workspaceId);
      const websiteEvidence = settings?.enrichment_enabled === false ? null : await fetchWebsiteEvidence(contact.website);
      const evidence = websiteEvidence ? [websiteEvidence] : [];
      const inputHash = hash({ company: workspace.company_ai_profile, contact, evidence, communicationLanguage });
      let analysis: any;
      if (contact.ai_input_hash === inputHash && contact.ai_fit_score !== null) {
        analysis = { fit_score: contact.ai_fit_score, fit_label: contact.ai_fit_label, fit_reason: contact.ai_fit_reason, recommended_service: contact.ai_recommended_service, opportunity_summary: contact.ai_opportunity_summary, personalization_points: contact.ai_personalization_points, suggested_approach: contact.ai_suggested_approach };
      } else {
        analysis = await analyzeLead(workspace.company_ai_profile, contact, evidence, communicationLanguage);
        await supabase.from('contacts').update({
          operational_status: 'ready', enrichment_source: websiteEvidence ? 'website' : contact.source,
          last_enriched_at: new Date().toISOString(), ai_fit_score: analysis.fit_score, ai_fit_label: analysis.fit_label,
          ai_fit_reason: analysis.fit_reason, ai_opportunity_summary: analysis.opportunity_summary,
          ai_recommended_service: analysis.recommended_service, ai_personalization_points: analysis.personalization_points,
          ai_suggested_approach: analysis.suggested_approach, ai_input_hash: inputHash, last_ai_analyzed_at: new Date().toISOString(),
        }).eq('id', contact.id).eq('workspace_id', workspaceId);
      }
      counters.enriched++;
      if (analysis.fit_score < (settings?.minimum_fit_score ?? 65)) { counters.skipped++; continue; }
      counters.qualified++;
      if (!contact.email_valid || !contact.email_normalized || contact.unsubscribed || contact.bounced) { counters.skipped++; continue; }

      const { data: suppressed } = await supabase.from('suppression_list').select('id').eq('workspace_id', workspaceId).eq('suppression_type', 'email').eq('normalized_value', contact.email_normalized).limit(1);
      if (suppressed?.length) { counters.skipped++; continue; }
      const idempotencyKey = `first-contact:${contact.id}:${inputHash}`;
      const { data: existing } = await supabase.from('prospecting_emails').select('id,status').eq('workspace_id', workspaceId).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (existing) { counters.skipped++; continue; }

      const draft = await generatePersonalizedEmail(workspace.company_ai_profile, contact, analysis, settings?.signature || '', communicationLanguage);
      const canAutoSend = Boolean(settings?.auto_send_enabled && settings?.email_configuration_tested_at);
      const { data: message, error: messageError } = await supabase.from('prospecting_emails').insert({
        workspace_id: workspaceId, contact_id: contact.id, automation_run_id: runId || null, idempotency_key: idempotencyKey,
        recipient: contact.email_normalized, subject: draft.subject, body: draft.email_body,
        personalization_reason: draft.personalization_reason, status: canAutoSend ? 'queued' : 'ready_for_review',
      }).select('id').single();
      if (messageError || !message) throw new Error(messageError?.message || 'Falha ao salvar abordagem');
      counters.generated++;

      if (canAutoSend) {
        const today = new Date(); today.setUTCHours(0,0,0,0);
        const { count } = await supabase.from('prospecting_emails').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'sent').gte('sent_at', today.toISOString());
        if ((count || 0) < (settings.daily_email_limit ?? 20)) {
          await supabase.from('prospecting_emails').update({ status: 'sending' }).eq('id', message.id);
          const result = await sendEmail({ to: contact.email_normalized, subject: draft.subject, body: draft.email_body, workspaceId, useAdmin: true });
          const delivered = result.success && (result.provider === 'smtp' || result.provider === 'resend');
          await supabase.from('prospecting_emails').update({ status: delivered ? 'sent' : (result.success ? 'ready_for_review' : 'failed'), provider: result.provider || null, provider_message_id: delivered ? result.id : null, error_message: result.error || null, sent_at: delivered ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', message.id);
          if (delivered) {
            counters.sent++;
            await supabase.from('contacts').update({ status: 'contacted', operational_status: 'contacted', last_contact_at: new Date().toISOString() }).eq('id', contact.id);
            await supabase.from('suppression_list').upsert({ workspace_id: workspaceId, contact_id: contact.id, suppression_type: 'email', normalized_value: contact.email_normalized, reason: 'contacted' }, { onConflict: 'workspace_id,suppression_type,normalized_value' });
          }
        }
      }
    } catch (error: any) {
      counters.skipped++;
      console.error(`[Prospecting] contato ${contact.id}:`, error.message);
      if (runId) await supabase.from('automation_run_logs').insert({ run_id: runId, workspace_id: workspaceId, level: 'error', stage: 'lead_processing', message: error.message, details: { contact_id: contact.id } });
    }
  }
  if (runId) await supabase.from('automation_runs').update({ leads_enriched: counters.enriched, leads_qualified: counters.qualified, emails_generated: counters.generated, emails_sent: counters.sent, leads_skipped: counters.skipped, status: 'completed', finished_at: new Date().toISOString() }).eq('id', runId).eq('workspace_id', workspaceId);
  return counters;
}

'use server';

import { revalidatePath } from 'next/cache';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { sendEmail } from '@/services/resend';
import { redirect } from 'next/navigation';
import { resolveAiCommunicationLanguage } from '@/lib/ai/languages';

export async function saveAutomationSettings(formData: FormData) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) redirect('/automation?save=failed');
  const permissionError = assertPermission(context.role, 'manageWorkspace');
  if (permissionError) redirect('/automation?save=forbidden');
  const value = (name: string) => String(formData.get(name) || '').trim();
  const number = (name: string, fallback: number) => Number(value(name)) || fallback;
  const list = (name: string) => value(name).split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  const { error } = await context.supabase.from('automation_settings').upsert({
    workspace_id: context.workspaceId,
    enabled: formData.get('enabled') === 'on',
    daily_search_enabled: formData.get('daily_search_enabled') === 'on',
    enrichment_enabled: formData.get('enrichment_enabled') === 'on',
    auto_send_enabled: formData.get('auto_send_enabled') === 'on',
    daily_lead_limit: Math.min(500, Math.max(1, number('daily_lead_limit', 20))),
    daily_email_limit: Math.min(500, Math.max(0, number('daily_email_limit', 20))),
    minimum_fit_score: Math.min(100, Math.max(0, number('minimum_fit_score', 65))),
    target_industries: list('target_industries'), target_regions: list('target_regions'),
    run_time: value('run_time') || '10:00', timezone: 'America/Sao_Paulo',
    weekdays: formData.get('avoid_weekends') === 'on' ? [1,2,3,4,5] : [0,1,2,3,4,5,6],
    communication_language: resolveAiCommunicationLanguage(value('communication_language')).code,
    signature: value('signature') || null, updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id' });
  if (error) redirect('/automation?save=failed');
  revalidatePath('/automation'); revalidatePath('/dashboard');
  redirect('/automation?save=success');
}

export async function sendAutomationTestEmail() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) redirect('/automation?test=unauthorized');
  const permissionError = assertPermission(context.role, 'manageWorkspace');
  if (permissionError) redirect('/automation?test=forbidden');
  const recipient = context.user.email;
  if (!recipient) redirect('/automation?test=no_email');
  const result = await sendEmail({ to: recipient, subject: 'Teste de envio — Columb', body: 'Sua configuração de e-mail da Columb está funcionando.', workspaceId: context.workspaceId });
  if (!result.success || !['smtp','resend'].includes(result.provider || '')) redirect('/automation?test=failed');
  await context.supabase.from('automation_settings').upsert({ workspace_id: context.workspaceId, email_configuration_tested_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  redirect('/automation?test=success');
}

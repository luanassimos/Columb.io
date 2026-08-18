'use server';

import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { generateCompanyProfile } from '@/lib/ai/company-profile';
import { resolveAiCommunicationLanguage } from '@/lib/ai/languages';

export async function saveCompanyOnboarding(formData: FormData) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) redirect('/login');
  const permissionError = assertPermission(context.role, 'manageWorkspace');
  if (permissionError) redirect('/onboarding?error=Sem+permissão+para+editar+o+workspace');

  const field = (name: string) => String(formData.get(name) || '').trim();
  const list = (name: string) => field(name).split(/[,;\n]/).map((value) => value.trim()).filter(Boolean);
  const communicationLanguage = resolveAiCommunicationLanguage(field('communication_language')).code;
  const raw = {
    company_name: field('company_name'), website: field('website'), industry: field('industry'), city: field('city'),
    company_description: field('company_description'), freeform_context: field('freeform_context'),
    services: list('services'), main_service: field('main_service'), priority_service: field('priority_service'), average_ticket: field('average_ticket') || null,
    value_reason: field('value_reason'), differentiators: list('differentiators'), relevant_cases: list('relevant_cases'), problems_solved: list('problems_solved'),
    ideal_companies: field('ideal_companies'), target_industries: list('target_industries'), company_size: field('company_size'), target_regions: list('target_regions'), exclusions: list('exclusions'),
    signer_name: field('signer_name'), signer_title: field('signer_title'), signer_email: field('signer_email'), signer_phone: field('signer_phone'), communication_style: field('communication_style'), communication_language: communicationLanguage,
  };
  if (!raw.company_name || !raw.company_description || !raw.main_service || !raw.ideal_companies) {
    redirect('/onboarding?error=Preencha+os+campos+essenciais');
  }

  try {
    const aiProfile = await generateCompanyProfile(raw, communicationLanguage);
    const { error } = await context.supabase.from('workspaces').update({
      name: raw.company_name,
      company_profile_raw: raw,
      company_ai_profile: aiProfile,
      company_profile_version: 1,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', context.workspaceId);
    if (error) throw error;

    await context.supabase.from('automation_settings').upsert({
      workspace_id: context.workspaceId,
      target_industries: raw.target_industries,
      target_regions: raw.target_regions,
      sender_name: raw.signer_name || null,
      sender_email: raw.signer_email || null,
      communication_language: communicationLanguage,
    }, { onConflict: 'workspace_id' });
  } catch (error) {
    console.error('[Onboarding] Falha ao gerar perfil:', error);
    redirect('/onboarding?error=Não+foi+possível+gerar+o+perfil+comercial.+Verifique+a+OpenAI+e+tente+novamente.');
  }
  redirect('/automation?welcome=1');
}

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { calculateLeadScore, calculateProfessionalScore } from '@/lib/lead-scoring';

export interface CreateLeadJobInput {
  category: string;
  region?: string;
  limitCount: number;
  lat?: number;
  lng?: number;
  radius?: number; // in meters
  onlyEmail?: boolean;
  leadEntityType?: 'company' | 'professional';
  keywords?: string;
}

export async function createLeadJob(input: CreateLeadJobInput) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };

  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;

  const { supabase, workspaceId } = context;

  // Verify if there is already a running or pending job
  const { data: activeJob, error: checkError } = await supabase
    .from('lead_finder_jobs')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['pending', 'running'])
    .limit(1)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking active jobs:', checkError);
    return { error: 'Erro ao verificar jobs ativos.' };
  }

  if (activeJob) {
    return { error: 'Já existe uma captura em andamento para este workspace.' };
  }

  const { data: job, error } = await supabase
    .from('lead_finder_jobs')
    .insert({
      workspace_id: workspaceId,
      category: input.category.trim(),
      region: input.region ? input.region.trim() : null,
      limit_count: input.limitCount,
      progress_count: 0,
      status: 'pending',
      lat: input.lat !== undefined ? input.lat : null,
      lng: input.lng !== undefined ? input.lng : null,
      radius: input.radius !== undefined ? input.radius : null,
      only_email: input.onlyEmail ?? false,
      lead_entity_type: input.leadEntityType ?? 'company',
      keywords: input.keywords ? input.keywords.trim() : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating lead finder job:', error);
    return { error: error.message };
  }

  revalidatePath('/lead-finder');
  revalidatePath('/lead-finder/companies');
  revalidatePath('/lead-finder/professionals');
  return { success: true, jobId: job.id };
}

export async function getLatestJob() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };

  const { supabase, workspaceId } = context;

  const { data: job, error } = await supabase
    .from('lead_finder_jobs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest job:', error);
    return { error: error.message };
  }

  return { success: true, job };
}

function extractDomain(urlStr: string): string | null {
  try {
    let url = urlStr.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    const parsed = new URL(url);
    // Remove www.
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host || null;
  } catch {
    return null;
  }
}

export async function importLeadsToContacts(leadIds: string[]) {
  if (leadIds.length === 0) return { success: true, count: 0 };

  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };

  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;

  const { supabase, workspaceId } = context;

  // 1. Fetch the leads to import
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .in('id', leadIds)
    .eq('workspace_id', workspaceId);

  if (fetchError) {
    console.error('Error fetching leads to import:', fetchError);
    return { error: 'Erro ao buscar leads selecionados.' };
  }

  if (!leads || leads.length === 0) {
    return { error: 'Nenhum lead encontrado para importação.' };
  }

  // Fetch professional details if any leads are professionals
  const profLeadIds = leads.filter(l => l.lead_entity_type === 'professional').map(l => l.id);
  let profMap = new Map<string, any>();
  if (profLeadIds.length > 0) {
    const { data: profDetails } = await supabase
      .from('professional_leads')
      .select('*')
      .in('lead_id', profLeadIds);
    if (profDetails) {
      profMap = new Map(profDetails.map(p => [p.lead_id, p]));
    }
  }

  // 2. Prepare contacts to insert
  const contactsToInsert = leads.map((lead) => {
    const isProf = lead.lead_entity_type === 'professional';
    const profInfo = profMap.get(lead.id);

    let email = '';
    let tags = ['Lead Finder', lead.category, lead.region];
    let company = lead.name;

    if (isProf && profInfo) {
      tags = ['Professional Finder', profInfo.professional_role || lead.category, profInfo.location || lead.region];
      company = profInfo.professional_role || 'Professional Lead';
      
      if (lead.email) {
        email = lead.email;
      } else if (profInfo.contact_channel && profInfo.contact_channel.includes('@')) {
        email = profInfo.contact_channel;
      } else {
        const slug = lead.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .trim()
          .replace(/^-|-$/g, '');
        email = `${slug || 'professional'}-${lead.id.substring(0, 6)}@linkedin-placeholder.com`;
      }
    } else {
      if (lead.email) {
        email = lead.email;
      } else {
        const domain = lead.website ? extractDomain(lead.website) : null;
        if (domain) {
          email = `contato@${domain}`;
        } else {
          const slug = lead.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .replace(/^-|-$/g, '');
          email = `contato-${slug || 'lead'}-${lead.id.substring(0, 6)}@columb-placeholder.com`;
        }
      }
    }

    return {
      workspace_id: workspaceId,
      name: lead.name,
      company: company,
      email: email,
      phone: lead.phone || null,
      city: lead.region,
      tags: tags,
      status: 'new',
      rating: 0,
      imported_at: new Date().toISOString(),
    };
  });

  // 3. Bulk insert contacts
  const { error: insertError } = await supabase.from('contacts').insert(contactsToInsert);

  if (insertError) {
    console.error('Error inserting contacts from leads:', insertError);
    return { error: insertError.message };
  }

  revalidatePath('/contacts');
  revalidatePath('/lead-finder');
  revalidatePath('/lead-finder/companies');
  revalidatePath('/lead-finder/professionals');

  return { success: true, count: contactsToInsert.length };
}

export async function deleteLeads(leadIds: string[]) {
  if (leadIds.length === 0) return { success: true, count: 0 };

  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };

  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;

  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('leads')
    .delete()
    .in('id', leadIds)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting leads:', error);
    return { error: error.message };
  }

  revalidatePath('/lead-finder');
  revalidatePath('/lead-finder/companies');
  revalidatePath('/lead-finder/professionals');
  return { success: true, count: leadIds.length };
}

export async function recalculateLeadsScore() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };

  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;

  const { supabase, workspaceId } = context;

  // 1. Fetch all leads for this workspace
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, name, phone, website, address, category, region, rating, reviews_count, contact_channels, lead_entity_type')
    .eq('workspace_id', workspaceId);

  if (fetchError) {
    console.error('Error fetching leads to rescore:', fetchError);
    return { error: 'Erro ao buscar leads para recalcular score.' };
  }

  if (!leads || leads.length === 0) {
    return { success: true, count: 0 };
  }

  // Fetch professional details
  const profLeadIds = leads.filter(l => l.lead_entity_type === 'professional').map(l => l.id);
  let profMap = new Map<string, any>();
  if (profLeadIds.length > 0) {
    const { data: profDetails } = await supabase
      .from('professional_leads')
      .select('*')
      .in('lead_id', profLeadIds);
    if (profDetails) {
      profMap = new Map(profDetails.map(p => [p.lead_id, p]));
    }
  }

  // 2. Update each lead
  const chunkSize = 10;
  let updatedCount = 0;

  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (lead) => {
        const isProf = lead.lead_entity_type === 'professional';

        if (isProf) {
          const profInfo = profMap.get(lead.id);
          const scoreInfo = calculateProfessionalScore(profInfo || {
            display_name: lead.name,
            professional_role: lead.category,
            location: lead.region,
          });

          const { error: updateError } = await supabase
            .from('leads')
            .update({
              lead_score: scoreInfo.professional_score,
              lead_grade: scoreInfo.lead_grade,
              scoring_version: 1,
            })
            .eq('id', lead.id);

          if (!updateError) {
            await supabase
              .from('professional_leads')
              .update({ professional_score: scoreInfo.professional_score })
              .eq('lead_id', lead.id);
            updatedCount++;
          }
        } else {
          const scoreInfo = calculateLeadScore(lead);
          
          // Calculate contact intelligence
          const channels = (lead.contact_channels || {}) as any;
          let contactScore = 0;
          let reachabilityScore = 0;

          const hasPhone = !!lead.phone && lead.phone.trim().length > 0;
          const hasWebsite = !!lead.website && lead.website.trim().length > 0;
          const hasForm = !!channels.contact_form;
          const hasInsta = !!channels.instagram;
          const hasFb = !!channels.facebook;
          const hasWa = !!channels.whatsapp;

          if (hasPhone) contactScore += 30;
          if (hasWebsite) contactScore += 20;
          if (hasForm) contactScore += 20;
          if (hasInsta) contactScore += 10;
          if (hasFb) contactScore += 10;
          if (hasWa) contactScore += 10;
          contactScore = Math.min(contactScore, 100);

          if (hasPhone) reachabilityScore += 40;
          if (hasWebsite) reachabilityScore += 15;
          if (hasInsta) reachabilityScore += 15;
          if (hasForm) reachabilityScore += 20;
          if (hasWa) reachabilityScore += 10;
          reachabilityScore = Math.min(reachabilityScore, 100);

          let quality: 'low' | 'medium' | 'high' = 'low';
          if (reachabilityScore >= 80) {
            quality = 'high';
          } else if (reachabilityScore >= 30) {
            quality = 'medium';
          }

          const { error: updateError } = await supabase
            .from('leads')
            .update({
              lead_score: scoreInfo.lead_score,
              lead_grade: scoreInfo.lead_grade,
              scoring_version: 1,
              contact_score: contactScore,
              reachability_score: reachabilityScore,
              contact_quality: quality,
            })
            .eq('id', lead.id);

          if (!updateError) {
            updatedCount++;
          }
        }
      })
    );
  }

  revalidatePath('/lead-finder');
  revalidatePath('/lead-finder/companies');
  revalidatePath('/lead-finder/professionals');
  return { success: true, count: updatedCount };
}

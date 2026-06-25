'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export interface CreateLeadJobInput {
  category: string;
  region?: string;
  limitCount: number;
  lat?: number;
  lng?: number;
  radius?: number; // in meters
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
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating lead finder job:', error);
    return { error: error.message };
  }

  revalidatePath('/lead-finder');
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

  // 2. Prepare contacts to insert
  const contactsToInsert = leads.map((lead) => {
    // Generate email
    let email = '';
    if (lead.email) {
      email = lead.email;
    } else {
      const domain = lead.website ? extractDomain(lead.website) : null;
      if (domain) {
        email = `contato@${domain}`;
      } else {
        // Clean company name for email slug
        const slug = lead.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove accents
          .replace(/[^a-z0-9]/g, '-') // replace non-alphanumeric with hyphen
          .replace(/-+/g, '-') // collapse multiple hyphens
          .trim()
          .replace(/^-|-$/g, ''); // trim hyphens
        email = `contato-${slug || 'lead'}-${lead.id.substring(0, 6)}@columb-placeholder.com`;
      }
    }

    return {
      workspace_id: workspaceId,
      name: lead.name,
      company: lead.name, // The lead name represents the company name
      email: email,
      phone: lead.phone || null,
      city: lead.region,
      tags: ['Lead Finder', lead.category, lead.region],
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

  return { success: true, count: contactsToInsert.length };
}

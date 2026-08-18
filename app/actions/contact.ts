'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { ContactStatus } from '@/types';
import { buildDedupeKeys, normalizeDomain, normalizeEmail, normalizePhone } from '@/lib/prospecting/normalize';
import { ingestProspect } from '@/lib/prospecting/ingest';

export interface CreateContactInput {
  name: string;
  company: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  maps_url?: string;
  linkedin_url?: string;
  tags?: string[];
  status?: ContactStatus;
  rating?: number;
  notes?: string;
  website?: string;
}

export async function createContact(input: CreateContactInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Get active workspace from profile
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  if (pError) {
    console.error('Error fetching profile in createContact:', pError);
    return { error: 'Database error fetching profile' };
  }

  let workspaceId = profile?.workspace_id;

  if (workspaceId && workspaceId !== 'default-workspace-id') {
    const { data: activeMembership, error: activeMembershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (activeMembershipError) {
      console.error('Error verifying active workspace membership:', activeMembershipError);
      return { error: 'Database error verifying workspace access' };
    }

    if (!activeMembership) {
      workspaceId = null;
    }
  }

  if (!workspaceId || workspaceId === 'default-workspace-id') {
    // 1. Try to find if user has any workspace membership
    const { data: membership, error: mError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (mError) {
      console.error('Error fetching workspace membership:', mError);
      return { error: 'Database error fetching workspace membership' };
    }

    if (membership?.workspace_id) {
      workspaceId = membership.workspace_id;
    } else {
      // 2. Create a new default workspace for the user
      const defaultName = `${user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'}'s Workspace`;
      const { data: newWs, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name: defaultName })
        .select('id')
        .single();

      if (wsError || !newWs) {
        console.error('Error creating default workspace:', wsError);
        return { error: 'Could not create default workspace' };
      }

      workspaceId = newWs.id;

      // 3. Register membership
      const { error: memError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspaceId, user_id: user.id, role: 'owner' });

      if (memError) {
        console.error('Error creating workspace membership:', memError);
        return { error: 'Could not create workspace membership' };
      }
    }

    // 4. Upsert profile with the active workspace
    const { error: profError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        workspace_id: workspaceId,
        name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
      });

    if (profError) {
      console.error('Error upserting profile:', profError);
      return { error: 'Could not create user profile' };
    }
  }

  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;
  const { supabase: activeSupabase, workspaceId: activeWorkspaceId } = context;

  const result = await ingestProspect(activeSupabase, activeWorkspaceId, {
    source: 'manual', company: input.company, contactName: input.name, email: input.email,
    phone: input.phone, city: input.city, address: input.address, website: input.website,
    mapsUrl: input.maps_url, linkedinUrl: input.linkedin_url,
  });
  if (result.status === 'duplicate') return { error: 'Esta empresa já existe na sua lista.' };
  if (result.status !== 'created' || !result.contactId) return { error: 'Lead inválida ou suprimida.' };
  await activeSupabase.from('contacts').update({ tags: input.tags || [], rating: input.rating || 0, notes: input.notes?.trim() || null }).eq('id', result.contactId).eq('workspace_id', activeWorkspaceId);

  revalidatePath('/contacts');
  return { success: true, contactId: result.contactId };
}

export interface UpdateContactInput {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  maps_url?: string;
  linkedin_url?: string;
  tags?: string[];
  status?: ContactStatus;
  rating?: number;
  notes?: string;
  website?: string;
}

export async function updateContact(input: UpdateContactInput) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const updatePayload: any = {
    name: input.name.trim(),
    company: input.company.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    maps_url: input.maps_url?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
    tags: input.tags || [],
    status: input.status,
  };

  if (input.rating !== undefined) {
    updatePayload.rating = input.rating;
  }

  if (input.notes !== undefined) {
    updatePayload.notes = input.notes.trim() || null;
  }

  if (input.website !== undefined) {
    updatePayload.website = input.website.trim() || null;
  }

  if (input.maps_url !== undefined) {
    updatePayload.maps_url = input.maps_url.trim() || null;
  }

  const { error } = await supabase
    .from('contacts')
    .update(updatePayload)
    .eq('id', input.id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error updating contact:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

export async function deleteContact(id: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'deleteContacts');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting contact:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

export async function bulkDeleteContacts(ids: string[]) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'deleteContacts');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('contacts')
    .delete()
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error bulk deleting contacts:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

export async function bulkUpdateContactsStatus(ids: string[], status: ContactStatus) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('contacts')
    .update({ status })
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error bulk updating contacts status:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

export async function bulkImportContacts(inputs: CreateContactInput[]) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageContacts');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  if (inputs.length === 0) return { success: true, count: 0 };

  const { data: existingKeys, error: keysError } = await supabase
    .from('contact_dedupe_keys')
    .select('dedupe_key')
    .eq('workspace_id', workspaceId);
  if (keysError) return { error: keysError.message };

  const knownKeys = new Set((existingKeys || []).map((row) => row.dedupe_key));
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const input of inputs.slice(0, 1000)) {
    const company = input.company?.trim();
    const name = input.name?.trim() || company;
    if (!company || !name) {
      invalid++;
      continue;
    }

    const keys = buildDedupeKeys(input);
    if (keys.some((key) => knownKeys.has(key))) {
      duplicates++;
      continue;
    }

    const email = normalizeEmail(input.email);
    const { data: contact, error } = await supabase.from('contacts').insert({
      workspace_id: workspaceId,
      name,
      company,
      email: email || '',
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      maps_url: input.maps_url?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      tags: input.tags || [],
      status: input.status || 'new',
      operational_status: 'enriching',
      source: 'csv',
      email_valid: Boolean(email),
      email_normalized: email,
      phone_normalized: normalizePhone(input.phone),
      domain_normalized: normalizeDomain(input.website),
      rating: input.rating !== undefined ? input.rating : 0,
      website: input.website?.trim() || null,
      imported_at: new Date().toISOString(),
    }).select('id').single();

    if (error || !contact) {
      invalid++;
      continue;
    }

    if (keys.length) {
      const { error: dedupeError } = await supabase.from('contact_dedupe_keys').insert(
        keys.map((dedupe_key) => ({ workspace_id: workspaceId, contact_id: contact.id, dedupe_key }))
      );
      if (dedupeError?.code === '23505') {
        await supabase.from('contacts').delete().eq('id', contact.id).eq('workspace_id', workspaceId);
        duplicates++;
        continue;
      }
    }
    keys.forEach((key) => knownKeys.add(key));
    imported++;
  }

  revalidatePath('/contacts');
  revalidatePath('/leads');
  return {
    success: true,
    count: imported,
    imported,
    duplicates,
    invalid,
    awaitingEnrichment: imported,
  };
}


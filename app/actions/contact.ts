'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ContactStatus } from '@/types';

export interface CreateContactInput {
  name: string;
  company: string;
  email: string;
  phone?: string;
  city?: string;
  linkedin_url?: string;
  tags?: string[];
  status?: ContactStatus;
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
        .insert({ workspace_id: workspaceId, user_id: user.id });

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

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      workspace_id: workspaceId,
      name: input.name.trim(),
      company: input.company.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      tags: input.tags || [],
      status: input.status || 'new',
      imported_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true, contactId: contact.id };
}

export interface UpdateContactInput {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  city?: string;
  linkedin_url?: string;
  tags?: string[];
  status?: ContactStatus;
}

export async function updateContact(input: UpdateContactInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('contacts')
    .update({
      name: input.name.trim(),
      company: input.company.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      tags: input.tags || [],
      status: input.status,
    })
    .eq('id', input.id);

  if (error) {
    console.error('Error updating contact:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

export async function deleteContact(id: string) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting contact:', error);
    return { error: error.message };
  }

  revalidatePath('/contacts');
  return { success: true };
}

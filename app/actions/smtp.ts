'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { SmtpSettings } from '@/types';

export async function getSmtpSettings() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Get active workspace from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return { error: 'Could not determine active workspace' };
  }

  const { data, error } = await supabase
    .from('smtp_settings')
    .select('*')
    .eq('workspace_id', profile.workspace_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching SMTP settings:', error);
    return { error: error.message };
  }

  return { success: true, data };
}

export interface SaveSmtpInput {
  id?: string;
  host: string;
  port: number;
  secure: boolean;
  user_email: string;
  password?: string;
  from_name: string;
}

export async function saveSmtpSettings(input: SaveSmtpInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Get active workspace from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return { error: 'Could not determine active workspace' };
  }

  const updateData: any = {
    workspace_id: profile.workspace_id,
    host: input.host.trim(),
    port: input.port,
    secure: input.secure,
    user_email: input.user_email.trim(),
    from_name: input.from_name.trim(),
  };

  if (input.password && input.password.trim() !== '') {
    updateData.password = input.password;
  }

  let error;
  if (input.id) {
    const { error: err } = await supabase
      .from('smtp_settings')
      .update(updateData)
      .eq('id', input.id);
    error = err;
  } else {
    // For new insert, password must be present
    if (!input.password || input.password.trim() === '') {
      return { error: 'Password is required for new SMTP configurations.' };
    }
    const { error: err } = await supabase
      .from('smtp_settings')
      .insert(updateData);
    error = err;
  }

  if (error) {
    console.error('Error saving SMTP settings:', error);
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function deleteSmtpSettings(id: string) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('smtp_settings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting SMTP settings:', error);
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

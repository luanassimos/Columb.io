'use server';

import { getActiveWorkspaceContext } from '@/lib/workspace';
import { revalidatePath } from 'next/cache';

export async function getSmtpSettings() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  const { data, error } = await supabase
    .from('smtp_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
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
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  const updateData: any = {
    workspace_id: workspaceId,
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
      .eq('id', input.id)
      .eq('workspace_id', workspaceId);
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
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('smtp_settings')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting SMTP settings:', error);
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

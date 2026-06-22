'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function switchWorkspace(workspaceId: string) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Verify the user is actually a member of this workspace
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('Error verifying workspace membership:', memberError);
    return { error: memberError.message };
  }

  if (!member) {
    return { error: 'You do not have access to this workspace' };
  }

  // Update/insert profile active workspace
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      workspace_id: workspaceId,
      name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    });

  if (error) {
    console.error('Error switching workspace:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function createWorkspace(name: string, timezone: string = 'America/Sao_Paulo') {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // 1. Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, timezone })
    .select('id')
    .single();

  if (wsError) {
    console.error('Error creating workspace:', wsError);
    return { error: wsError.message };
  }

  // 2. Register membership so the user can see this workspace
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

  if (memberError) {
    console.error('Error inserting workspace membership:', memberError);
    return { error: memberError.message };
  }

  // 3. Switch the user's active workspace to the new one (using upsert)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      workspace_id: workspace.id,
      name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    });

  if (profileError) {
    console.error('Error updating profile with new workspace:', profileError);
    return { error: profileError.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, workspaceId: workspace.id };
}

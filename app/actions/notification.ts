'use server';

import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function markNotificationRead(notificationId: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageWorkspace');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function markAllNotificationsRead(workspaceId: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageWorkspace');
  if (permissionError) return permissionError;
  const { supabase, workspaceId: activeWorkspaceId } = context;

  if (workspaceId !== activeWorkspaceId) {
    return { error: 'You do not have access to this workspace' };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('workspace_id', workspaceId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function markNotificationRead(notificationId: string) {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function markAllNotificationsRead(workspaceId: string) {
  const supabase = await createServerClient();

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

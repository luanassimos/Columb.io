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

export async function toggleNotificationRead(notificationId: string, read: boolean) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('notifications')
    .update({ read })
    .eq('id', notificationId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error updating notification read status:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteNotification(notificationId: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting notification:', error);
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function simulateLeadReply(input: {
  contactId: string;
  campaignId?: string | null;
  subject: string;
  body: string;
}) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  // 1. Fetch contact details to make sure they exist in workspace
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('name, email, company')
    .eq('id', input.contactId)
    .eq('workspace_id', workspaceId)
    .single();

  if (contactErr || !contact) {
    return { error: 'Lead not found in this workspace' };
  }

  // 2. Create stringified message payload
  const payload = JSON.stringify({
    contact_id: input.contactId,
    contact_email: contact.email,
    contact_company: contact.company,
    subject: input.subject,
    body: input.body,
  });

  // 3. Insert into notifications
  const { error: notifErr } = await supabase
    .from('notifications')
    .insert({
      workspace_id: workspaceId,
      type: 'email_replied',
      title: contact.name,
      message: payload,
      read: false,
    });

  if (notifErr) {
    console.error('Error inserting simulated reply notification:', notifErr);
    return { error: notifErr.message };
  }

  // 4. Update contact status to 'replied'
  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ status: 'replied', last_contact_at: new Date().toISOString() })
    .eq('id', input.contactId)
    .eq('workspace_id', workspaceId);

  if (updateErr) {
    console.error('Error updating contact status:', updateErr);
  }

  // 5. Update corresponding email_job (if exists) status to 'replied'
  const { data: lastJob } = await supabase
    .from('email_jobs')
    .select('id')
    .eq('contact_id', input.contactId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastJob) {
    await supabase
      .from('email_jobs')
      .update({ status: 'replied' })
      .eq('id', lastJob.id);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

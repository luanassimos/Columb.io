import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { Contact, Notification } from '@/types';
import InboxClient from './inbox-client';

export default async function InboxPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return (
      <div className="p-8 text-center text-red-500">
        Não foi possível carregar a caixa de entrada.
      </div>
    );
  }

  const { supabase, workspaceId, role } = context;

  let contacts: Contact[] = [];
  let notifications: Notification[] = [];

  try {
    // 1. Fetch contacts for CRM status updates
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    contacts = contactsData || [];

    // 2. Fetch reply notifications (type = 'email_replied')
    const { data: notificationsData } = await supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('type', 'email_replied')
      .order('created_at', { ascending: false });

    notifications = notificationsData || [];
  } catch (err) {
    console.error('[Inbox Page] Error loading inbox data:', err);
  }

  return (
    <InboxClient
      contacts={contacts}
      notifications={notifications}
      role={role}
    />
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { Contact, Notification, EmailJob } from '@/types';
import InboxClient from './inbox-client';

interface InboxPageProps {
  searchParams: Promise<{ tab?: string; id?: string }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const { tab, id } = await searchParams;
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
  let emailJobs: EmailJob[] = [];

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

    // 3. Fetch sent email jobs (status in 'sent', 'replied')
    const { data: emailJobsData } = await supabase
      .from('email_jobs')
      .select('*, campaigns(*), templates(*), contacts(*)')
      .eq('workspace_id', workspaceId)
      .in('status', ['sent', 'replied'])
      .order('sent_at', { ascending: false, nullsFirst: false });

    emailJobs = emailJobsData || [];
  } catch (err) {
    console.error('[Inbox Page] Error loading inbox data:', err);
  }

  return (
    <InboxClient
      contacts={contacts}
      notifications={notifications}
      emailJobs={emailJobs}
      role={role}
      initialTab={tab as 'received' | 'sent' | undefined}
      initialId={id}
    />
  );
}

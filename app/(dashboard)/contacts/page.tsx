import React from 'react';
import { redirect } from 'next/navigation';
import { Contact } from '@/types';
import ContactsClient from './contacts-client';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export default async function ContactsPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return <ContactsClient contacts={[]} />;
  }

  const { supabase, workspaceId } = context;

  // Fetch contacts for the active workspace
  let contacts: Contact[] = [];
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('imported_at', { ascending: false });

    if (!error) contacts = data || [];
  } catch {}

  return <ContactsClient contacts={contacts} />;
}

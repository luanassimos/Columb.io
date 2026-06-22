import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Contact } from '@/types';
import ContactsClient from './contacts-client';

export default async function ContactsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch active profile
  let profile = null;
  let workspaceId: string | null = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && data) {
      profile = data;
      workspaceId = data.workspace_id;
    }
  } catch {}

  // Fetch contacts for the active workspace
  let contacts: Contact[] = [];
  if (workspaceId) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('imported_at', { ascending: false });

      if (!error) contacts = data || [];
    } catch {}
  }
  return <ContactsClient contacts={contacts} />;
}

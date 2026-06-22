import React from 'react';
import { redirect } from 'next/navigation';
import { Campaign, Template, SmtpSettings } from '@/types';
import CampaignsClient from './campaigns-client';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export default async function CampaignsPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return (
      <CampaignsClient
        campaigns={[]}
        templates={[]}
        availableTags={[]}
        smtpSettingsList={[]}
        role="viewer"
      />
    );
  }

  const { supabase, workspaceId, role } = context;

  // Fetch campaigns and templates for active workspace
  let campaigns: Campaign[] = [];
  let templates: Template[] = [];
  let availableTags: string[] = [];
  let smtpSettingsList: SmtpSettings[] = [];
  
  try {
    // Fetch templates
    const { data: tData } = await supabase
      .from('templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    
    templates = tData || [];

    // Fetch campaigns with templates joined
    const { data: cData, error } = await supabase
      .from('campaigns')
      .select('*, templates(*)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error) campaigns = cData || [];

    // Fetch unique tags from contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('tags')
      .eq('workspace_id', workspaceId);
    
    if (contactsData) {
      const allTags = contactsData.flatMap(c => c.tags || []);
      availableTags = Array.from(new Set(allTags)).sort();
    }

    // Fetch sanitized sender options; SMTP passwords remain admin-only in RLS.
    const { data: smtpData } = await supabase
      .rpc('get_smtp_sender_options', { target_workspace_id: workspaceId });
    smtpSettingsList = ((smtpData || []) as SmtpSettings[]).sort((a, b) =>
      (a.created_at || '').localeCompare(b.created_at || '')
    );
  } catch {}

  return (
    <CampaignsClient
      campaigns={campaigns}
      templates={templates}
      availableTags={availableTags}
      smtpSettingsList={smtpSettingsList}
      role={role}
    />
  );
}

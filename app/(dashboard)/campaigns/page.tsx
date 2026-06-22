import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Campaign, Template, SmtpSettings } from '@/types';
import CampaignsClient from './campaigns-client';

export default async function CampaignsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get active workspace from profile
  let workspaceId: string | null = null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle();
    workspaceId = profile?.workspace_id || null;
  } catch {}

  // Fetch campaigns and templates for active workspace
  let campaigns: Campaign[] = [];
  let templates: Template[] = [];
  let availableTags: string[] = [];
  let smtpSettingsList: SmtpSettings[] = [];
  
  if (workspaceId) {
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

      // Fetch workspace SMTP settings list
      const { data: smtpData } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });
      smtpSettingsList = smtpData || [];
    } catch {}
  }

  return (
    <CampaignsClient
      campaigns={campaigns}
      templates={templates}
      availableTags={availableTags}
      smtpSettingsList={smtpSettingsList}
    />
  );
}

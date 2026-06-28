import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import LeadFinderClient from './lead-finder-client';

export default async function LeadFinderPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return <LeadFinderClient initialLatestJob={null} initialLeads={[]} role="viewer" />;
  }

  const { supabase, workspaceId, role } = context;

  // Fetch latest job
  let latestJob = null;
  try {
    const { data, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) latestJob = data;
  } catch (err) {
    console.error('Error fetching latest job in page:', err);
  }

  // Fetch all leads
  let leads: any[] = [];
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error) leads = data || [];
  } catch (err) {
    console.error('Error fetching leads in page:', err);
  }

  return (
    <LeadFinderClient
      initialLatestJob={latestJob}
      initialLeads={leads}
      role={role}
    />
  );
}

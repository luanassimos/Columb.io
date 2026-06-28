import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import ProfessionalFinderClient from './professional-finder-client';

export default async function LeadFinderProfessionalsPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return <ProfessionalFinderClient initialLatestJob={null} initialLeads={[]} role="viewer" />;
  }

  const { supabase, workspaceId, role } = context;

  // Fetch latest job for professionals
  let latestJob = null;
  try {
    const { data, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('lead_entity_type', 'professional')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) latestJob = data;
  } catch (err) {
    console.error('Error fetching latest job in professionals page:', err);
  }

  // Fetch all professional leads
  let leads: any[] = [];
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*, professional_leads(*)')
      .eq('workspace_id', workspaceId)
      .eq('lead_entity_type', 'professional')
      .order('created_at', { ascending: false });

    if (!error && data) {
      leads = data.map((item: any) => {
        const prof = Array.isArray(item.professional_leads) 
          ? (item.professional_leads[0] || {}) 
          : (item.professional_leads || {});
        return {
          ...item,
          display_name: prof.display_name || item.name,
          professional_role: prof.professional_role || item.category,
          industry: prof.industry || item.category,
          location: prof.location || item.region,
          profile_url: prof.profile_url || '',
          contact_channel: prof.contact_channel || '',
          professional_score: prof.professional_score || item.lead_score || 0,
        };
      });
    }
  } catch (err) {
    console.error('Error fetching professional leads in page:', err);
  }

  return (
    <ProfessionalFinderClient
      initialLatestJob={latestJob}
      initialLeads={leads}
      role={role}
    />
  );
}

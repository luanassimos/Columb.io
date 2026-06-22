import React from 'react';
import { redirect } from 'next/navigation';
import { Template } from '@/types';
import TemplatesClient from './templates-client';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export default async function TemplatesPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
    return <TemplatesClient templates={[]} />;
  }

  const { supabase, workspaceId } = context;

  // Fetch templates for the active workspace
  let templates: Template[] = [];
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error) templates = data || [];
  } catch {}

  return <TemplatesClient templates={templates} />;
}

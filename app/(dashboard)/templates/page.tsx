import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Template } from '@/types';
import TemplatesClient from './templates-client';

export default async function TemplatesPage() {
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

  // Fetch templates for the active workspace
  let templates: Template[] = [];
  if (workspaceId) {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error) templates = data || [];
    } catch {}
  }

  return <TemplatesClient templates={templates} />;
}

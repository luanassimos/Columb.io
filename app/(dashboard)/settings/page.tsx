import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import SettingsClient from './settings-client';

export default async function SettingsPage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let profile = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('workspace_id, name')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      console.log('Error fetching profile in settings:', error.message || error);
    } else {
      profile = data;
    }
  } catch (err) {
    console.log('Exception fetching profile in settings:', err);
  }

  // Fetch workspaces
  let workspaces: any[] = [];
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching workspaces in settings:', error.message || error);
    } else {
      workspaces = data || [];
    }
  } catch (err) {
    console.error('Exception fetching workspaces in settings:', err);
  }

  const activeWorkspace = (profile && workspaces?.find(w => w.id === profile.workspace_id)) || {
    id: profile?.workspace_id || 'default-workspace-id',
    name: 'Default Workspace',
  };

  // Fetch all SMTP Settings for this workspace
  let smtpSettingsList: any[] = [];
  if (activeWorkspace.id !== 'default-workspace-id') {
    try {
      const { data, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        smtpSettingsList = data;
      }
    } catch (err) {
      console.error('Exception fetching SMTP settings:', err);
    }
  }

  const updateWorkspaceSettings = async (formData: FormData) => {
    'use server';
    const name = formData.get('workspaceName') as string;
    const timezone = formData.get('timezone') as string;
    if (!name || !timezone || activeWorkspace.id === 'default-workspace-id') return;

    const serverSupabase = await createServerClient();
    await serverSupabase
      .from('workspaces')
      .update({ name, timezone })
      .eq('id', activeWorkspace.id);

    revalidatePath('/settings');
    revalidatePath('/', 'layout');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Settings</h1>
        <p className="text-sm text-[#475569] mt-1">
          Configure active workspace settings, SMTP email outbound profiles, and manage account security.
        </p>
      </div>

      <SettingsClient
        activeWorkspace={activeWorkspace}
        smtpSettingsList={smtpSettingsList}
        updateWorkspaceSettings={updateWorkspaceSettings}
      />
    </div>
  );
}

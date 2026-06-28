import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { WorkspaceRole } from '@/lib/permissions';
import DashboardLayoutClient from '@/components/dashboard-layout-client';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  // 1. Get auth user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  console.log('SESSION_FOUND');

  // 2. Get active profile
  let profile = null;
  console.log('PROFILE_FETCH_STARTED');
  try {
    const { data: pData, error: pError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (pError) {
      console.log('PROFILE_FETCH_FAILED');
      console.log('Error fetching profile in layout:', pError.message || pError);
    } else if (!pData) {
      console.log('PROFILE_FETCH_FAILED');
    } else {
      profile = pData;
    }
  } catch (err) {
    console.log('PROFILE_FETCH_FAILED');
    console.log('Exception fetching profile in layout:', err);
  }

  // 3. Get all workspaces the user is a member of (via workspace_members join)
  let workspaceMemberships: Array<{ role: WorkspaceRole; workspaces: any }> = [];
  let workspacesList: any[] = [];
  try {
    const { data: wData, error: wError } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id, name, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (wError) {
      console.error('Error fetching workspaces in layout:', wError.message || wError);
    } else {
      // Unwrap the nested join result: [{workspaces: {id, name, created_at}}, ...]
      workspaceMemberships = (wData || []) as Array<{ role: WorkspaceRole; workspaces: any }>;
      workspacesList = workspaceMemberships
        .map((row) => row.workspaces)
        .filter(Boolean);
    }
  } catch (err) {
    console.error('Exception fetching workspaces in layout:', err);
  }

  // Fallback workspace handling
  const activeWorkspace = profile ? workspacesList.find((w) => w.id === profile.workspace_id) : null;
  const activeWorkspaceRole = profile
    ? workspaceMemberships.find((row) => row.workspaces?.id === profile.workspace_id)?.role || 'viewer'
    : 'viewer';
  const displayedWorkspace = activeWorkspace || {
    id: 'default-workspace-id',
    name: 'Default Workspace',
  };

  // 4. Get recent notifications
  let notificationsList: any[] = [];
  if (activeWorkspace?.id) {
    try {
      const { data: notifications, error: nError } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('read', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(15);

      if (nError) {
        console.error('Error fetching notifications in layout:', nError.message || nError);
      } else {
        notificationsList = notifications || [];
      }
    } catch (err) {
      console.error('Exception fetching notifications in layout:', err);
    }
  }

  return (
    <DashboardLayoutClient
      profile={profile}
      userEmail={user.email || ''}
      workspacesList={workspacesList}
      activeWorkspaceRole={activeWorkspaceRole}
      displayedWorkspace={displayedWorkspace}
      notificationsList={notificationsList}
    >
      {children}
    </DashboardLayoutClient>
  );
}

import { createServerClient } from '@/lib/supabase/server';

export async function getActiveWorkspaceContext() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.workspace_id) {
    return { error: 'Could not determine active workspace' };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', profile.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { error: 'You do not have access to the active workspace' };
  }

  return {
    supabase,
    user,
    workspaceId: profile.workspace_id as string,
  };
}

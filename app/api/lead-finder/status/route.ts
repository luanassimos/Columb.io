import { NextResponse } from 'next/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export async function GET() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: 401 });
  }

  const { supabase, workspaceId } = context;

  try {
    const { data: job, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest job in GET API:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    console.error('Exception fetching latest job in GET API:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

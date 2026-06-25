import { NextResponse } from 'next/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export async function POST(request: Request) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: 401 });
  }

  const { supabase, workspaceId } = context;

  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lead_finder_jobs')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)
      // Only allow cancelling pending or running jobs
      .in('status', ['pending', 'running']);

    if (error) {
      console.error('Error cancelling job in API:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Exception cancelling job in API:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

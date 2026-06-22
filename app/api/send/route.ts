import { createAdminClient } from '@/lib/supabase/admin';
import { compileEmail } from '@/services/email-compiler';
import { sendEmail } from '@/services/resend';
import { canSendCampaigns, WorkspaceRole } from '@/lib/permissions';
import { assertLiveEmailAllowed, getEmailSendMode } from '@/lib/email-mode';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const campaignId = searchParams.get('campaign_id') || undefined;
  const auth = await getExecutionContext(request, force, searchParams.get('workspace_id'));

  if ('response' in auth) {
    return auth.response;
  }

  return processQueue({ force, campaignId, context: auth });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const campaignId = searchParams.get('campaign_id') || undefined;
  const auth = await getExecutionContext(request, force, searchParams.get('workspace_id'));

  if ('response' in auth) {
    return auth.response;
  }

  return processQueue({ force, campaignId, context: auth });
}

type ExecutionContext =
  | { type: 'cron'; workspaceId?: string }
  | { type: 'user'; userId: string; workspaceId: string; role: WorkspaceRole };

type AuthResult = ExecutionContext | { response: Response };

function jsonError(message: string, status: number) {
  return Response.json({ error: message, emailSendMode: getEmailSendMode() }, { status });
}

async function getExecutionContext(
  request: Request,
  force: boolean,
  requestedWorkspaceId: string | null
): Promise<AuthResult> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return { response: jsonError('Unauthorized', 401) };
    }

    if (!cronSecret) {
      return { response: jsonError('Cron execution is not configured', 403) };
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return { response: jsonError('Unauthorized', 401) };
    }

    if (force && !requestedWorkspaceId) {
      return {
        response: jsonError('force=true requires a workspace_id when using cron credentials', 400),
      };
    }

    return {
      type: 'cron',
      workspaceId: requestedWorkspaceId || undefined,
    };
  }

  try {
    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { response: jsonError('Unauthorized', 401) };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Send Auth] Error fetching active workspace:', profileError.message);
      return { response: jsonError('Could not determine active workspace', 400) };
    }

    if (!profile?.workspace_id) {
      return { response: jsonError('Active workspace is required for manual execution', 400) };
    }

    if (requestedWorkspaceId && requestedWorkspaceId !== profile.workspace_id) {
      return { response: jsonError('You do not have permission to process this workspace', 403) };
    }

    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', profile.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership?.role) {
      return { response: jsonError('You do not have access to the active workspace', 403) };
    }

    if (!canSendCampaigns(membership.role as WorkspaceRole)) {
      return { response: jsonError('You do not have permission to send campaigns', 403) };
    }

    return {
      type: 'user',
      userId: user.id,
      workspaceId: profile.workspace_id,
      role: membership.role as WorkspaceRole,
    };
  } catch (err) {
    console.error('[Send Auth] Error verifying session:', err);
    return { response: jsonError('Unauthorized', 401) };
  }
}

async function processQueue({
  force = false,
  campaignId,
  context,
}: {
  force?: boolean;
  campaignId?: string;
  context: ExecutionContext;
}) {
  const scopedWorkspaceId = context.workspaceId;
  const emailSendMode = getEmailSendMode();
  const liveGuard = assertLiveEmailAllowed();

  if (liveGuard) {
    return Response.json(
      {
        success: false,
        error: liveGuard.error,
        emailSendMode,
      },
      { status: 400 }
    );
  }

  console.log(
    `[Cron Job] Triggering campaign dispatch processor (force=${force}, scope=${scopedWorkspaceId || 'all-scheduled'}, emailMode=${emailSendMode})...`
  );
  const supabase = createAdminClient();

  // 2. Fetch all running campaigns with workspace timezone
  let campaignQuery = supabase
    .from('campaigns')
    .select('*, workspaces(timezone)')
    .eq('status', 'running');

  if (scopedWorkspaceId) {
    campaignQuery = campaignQuery.eq('workspace_id', scopedWorkspaceId);
  }

  if (campaignId) {
    campaignQuery = campaignQuery.eq('id', campaignId);
  }

  const { data: runningCampaigns, error: cError } = await campaignQuery;

  if (cError) {
    console.error('[Cron Job] Error fetching campaigns:', cError);
    return Response.json({ success: false, error: cError.message, emailSendMode }, { status: 500 });
  }

  if (!runningCampaigns || runningCampaigns.length === 0) {
    console.log('[Cron Job] No campaigns currently running.');
    return Response.json({
      success: true,
      message: 'No running campaigns to process',
      emailSendMode,
      processedCampaigns: 0,
    });
  }

  // 3. Filter campaigns that match the schedule based on their specific workspace timezone
  const activeCampaigns = (runningCampaigns as any[]).filter((campaign) => {
    if (force) {
      console.log(`[Campaign Filter] "${campaign.name}" | Force run active. Bypassing schedule check.`);
      return true;
    }

    if (campaign.dispatch_type === 'immediate') {
      console.log(`[Campaign Filter] "${campaign.name}" | Immediate dispatch active. Bypassing schedule check.`);
      return true;
    }

    const tz = campaign.workspaces?.timezone || 'America/Sao_Paulo';
    
    // Calculate current time/day in the campaign's workspace timezone
    const spParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric'
    }).formatToParts(new Date());

    const getValue = (type: string) => spParts.find(p => p.type === type)?.value || '';
    const currentHour = String(Number(getValue('hour')) % 24).padStart(2, '0');
    const currentMinute = getValue('minute').padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    const weekdayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const dayOfWeek = weekdayMap[getValue('weekday')] ?? new Date().getDay();

    const days = campaign.schedule_days || [];
    const time = campaign.schedule_time || '09:00';
    
    const dayMatches = days.includes(dayOfWeek);
    const timeMatches = currentTime >= time;

    console.log(`[Campaign Filter] "${campaign.name}" | TZ: ${tz} | Current: ${currentTime} | Scheduled: ${time} | Match: ${dayMatches && timeMatches}`);

    return dayMatches && timeMatches;
  });

  console.log(`[Cron Job] Found ${activeCampaigns.length} scheduled campaigns ready to process.`);

  let newJobsQueued = 0;

  // 4. For each active campaign, find target contacts and queue outbound jobs
  for (const campaign of activeCampaigns) {
    try {
      // Fetch all contacts in the campaign's workspace
      const { data: contacts, error: contactsErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', campaign.workspace_id);

      if (contactsErr) {
        console.error(`[Cron Job] Error fetching contacts for workspace ${campaign.workspace_id}:`, contactsErr);
        continue;
      }

      // Filter contacts matching campaign tags
      const targetTags = campaign.target_tags || [];
      const matchingContacts = (contacts || []).filter((contact) => {
        const contactTags = contact.tags || [];
        return targetTags.some((tag: string) => contactTags.includes(tag));
      });

      console.log(`[Campaign: ${campaign.name}] Found ${matchingContacts.length} contacts matching tags: [${targetTags.join(', ')}]`);

      // Queue email jobs for matching contacts that don't have one already
      for (const contact of matchingContacts) {
        if (contact.workspace_id !== campaign.workspace_id) {
          console.error(`[Cron Job] Skipping contact ${contact.id}: workspace mismatch.`);
          continue;
        }

        const { data: existingJob, error: jobCheckErr } = await supabase
          .from('email_jobs')
          .select('id')
          .eq('workspace_id', campaign.workspace_id)
          .eq('campaign_id', campaign.id)
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (jobCheckErr) {
          console.error(`[Cron Job] Error checking existing jobs:`, jobCheckErr);
          continue;
        }

        // If no job exists yet for this campaign + contact, queue a new email
        if (!existingJob) {
          const { error: insertErr } = await supabase
            .from('email_jobs')
            .insert({
              workspace_id: campaign.workspace_id,
              campaign_id: campaign.id,
              contact_id: contact.id,
              template_id: campaign.template_id,
              status: 'queued',
              step_number: 0,
            });

          if (insertErr) {
            console.error(`[Cron Job] Error inserting email job:`, insertErr);
          } else {
            newJobsQueued++;
          }
        }
      }

      // If immediate, mark campaign as completed
      if (campaign.dispatch_type === 'immediate') {
        const { error: completeErr } = await supabase
          .from('campaigns')
          .update({ status: 'completed' })
          .eq('id', campaign.id);
        if (completeErr) {
          console.error(`[Cron Job] Error marking campaign ${campaign.name} as completed:`, completeErr);
        } else {
          console.log(`[Cron Job] Campaign "${campaign.name}" auto-completed.`);
        }
      }
    } catch (campaignErr) {
      console.error(`[Cron Job] Exception processing campaign ${campaign.name}:`, campaignErr);
    }
  }

  // 5. Query and process all queued jobs
  let queuedJobsQuery = supabase
    .from('email_jobs')
    .select('*, campaigns(*), templates(*), contacts(*)')
    .eq('status', 'queued');

  if (scopedWorkspaceId) {
    queuedJobsQuery = queuedJobsQuery.eq('workspace_id', scopedWorkspaceId);
  }

  const { data: queuedJobs, error: queueFetchErr } = await queuedJobsQuery;

  if (queueFetchErr) {
    console.error('[Cron Job] Error fetching queued jobs:', queueFetchErr);
    return Response.json({ success: false, error: queueFetchErr.message, emailSendMode }, { status: 500 });
  }

  console.log(`[Cron Job] Processing ${queuedJobs?.length || 0} queued email jobs...`);

  let sentCount = 0;
  let failedCount = 0;

  for (const job of (queuedJobs || [])) {
    try {
      const jobWorkspaceId = job.workspace_id;
      const campaignWorkspaceId = job.campaigns?.workspace_id;
      const contactWorkspaceId = job.contacts?.workspace_id;
      const templateWorkspaceId = job.templates?.workspace_id;

      if (
        campaignWorkspaceId !== jobWorkspaceId ||
        contactWorkspaceId !== jobWorkspaceId ||
        templateWorkspaceId !== jobWorkspaceId
      ) {
        console.error(`[Cron Job] Refusing to send job ID ${job.id}: workspace mismatch.`);
        await supabase
          .from('email_jobs')
          .update({
            status: 'failed',
            error_message: 'Workspace mismatch prevented dispatch',
          })
          .eq('id', job.id);
        failedCount++;
        continue;
      }

      // A. Update job status to sending to lock it
      await supabase
        .from('email_jobs')
        .update({ status: 'sending' })
        .eq('id', job.id);

      // B. Compile templates
      const compiled = compileEmail(
        job.templates.subject,
        job.templates.body,
        job.contacts
      );

      // C. Call email service (useAdmin: true to query SMTP configs bypassing RLS)
      const result = await sendEmail({
        to: job.contacts.email,
        subject: compiled.subject,
        body: compiled.body,
        smtpSettingId: job.campaigns.smtp_setting_id || undefined,
        workspaceId: job.workspace_id,
        useAdmin: true,
      });

      // D. Update job status based on result
      if (result.success) {
        await supabase
          .from('email_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: result.provider === 'smtp' || result.provider === 'resend'
              ? null
              : `${result.mode} mode: provider delivery skipped`,
          })
          .eq('id', job.id);

        // Update contact status to contacted
        await supabase
          .from('contacts')
          .update({
            status: 'contacted',
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', job.contacts.id);

        sentCount++;
      } else {
        await supabase
          .from('email_jobs')
          .update({
            status: 'failed',
            error_message: result.error || 'SMTP delivery failed',
          })
          .eq('id', job.id);

        failedCount++;
      }
    } catch (jobErr: any) {
      console.error(`[Cron Job] Exception processing job ID ${job.id}:`, jobErr);
      await supabase
        .from('email_jobs')
        .update({
          status: 'failed',
          error_message: jobErr?.message || 'Unexpected exception occurred during dispatch',
        })
        .eq('id', job.id);
      failedCount++;
    }
  }

  return Response.json({
    success: true,
    message: 'Campaign processing run completed successfully.',
    emailSendMode,
    timestamp: new Date().toISOString(),
    activeCampaignsProcessed: activeCampaigns.length,
    newJobsQueued,
    totalJobsProcessed: (queuedJobs || []).length,
    sentCount,
    failedCount,
  });
}

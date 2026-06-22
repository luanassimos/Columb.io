import { createAdminClient } from '@/lib/supabase/admin';
import { compileEmail } from '@/services/email-compiler';
import { sendEmail } from '@/services/resend';

export async function GET(request: Request) {
  if (!(await isValidRequest(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  return processQueue(force);
}

export async function POST(request: Request) {
  if (!(await isValidRequest(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  return processQueue(force);
}

async function isValidRequest(request: Request): Promise<boolean> {
  // 1. Bypass validation in local development when CRON_SECRET is not set
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    return true;
  }
  
  // 2. Check token authorization (for external cron services)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // 3. Check profile session authorization (for manual button clicks in the dashboard)
  try {
    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return true;
    }
  } catch (err) {
    console.error('[Cron Auth] Error verifying session:', err);
  }

  return false;
}

async function processQueue(force: boolean = false) {
  console.log(`[Cron Job] Triggering campaign dispatch processor (force=${force})...`);
  const supabase = createAdminClient();

  // 2. Fetch all running campaigns with workspace timezone
  const { data: runningCampaigns, error: cError } = await supabase
    .from('campaigns')
    .select('*, workspaces(timezone)')
    .eq('status', 'running');

  if (cError) {
    console.error('[Cron Job] Error fetching campaigns:', cError);
    return Response.json({ success: false, error: cError.message }, { status: 500 });
  }

  if (!runningCampaigns || runningCampaigns.length === 0) {
    console.log('[Cron Job] No campaigns currently running.');
    return Response.json({
      success: true,
      message: 'No running campaigns to process',
      processedCampaigns: 0,
    });
  }

  // 3. Filter campaigns that match the schedule based on their specific workspace timezone
  const activeCampaigns = (runningCampaigns as any[]).filter((campaign) => {
    if (force) {
      console.log(`[Campaign Filter] "${campaign.name}" | Force run active. Bypassing schedule check.`);
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
        const { data: existingJob, error: jobCheckErr } = await supabase
          .from('email_jobs')
          .select('id')
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
    } catch (campaignErr) {
      console.error(`[Cron Job] Exception processing campaign ${campaign.name}:`, campaignErr);
    }
  }

  // 5. Query and process all queued jobs
  const { data: queuedJobs, error: queueFetchErr } = await supabase
    .from('email_jobs')
    .select('*, campaigns(*), templates(*), contacts(*)')
    .eq('status', 'queued');

  if (queueFetchErr) {
    console.error('[Cron Job] Error fetching queued jobs:', queueFetchErr);
    return Response.json({ success: false, error: queueFetchErr.message }, { status: 500 });
  }

  console.log(`[Cron Job] Processing ${queuedJobs?.length || 0} queued email jobs...`);

  let sentCount = 0;
  let failedCount = 0;

  for (const job of (queuedJobs || [])) {
    try {
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
            error_message: null,
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
    timestamp: new Date().toISOString(),
    activeCampaignsProcessed: activeCampaigns.length,
    newJobsQueued,
    totalJobsProcessed: (queuedJobs || []).length,
    sentCount,
    failedCount,
  });
}

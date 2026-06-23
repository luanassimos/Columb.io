import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import {
  assertLiveEmailAllowed,
  getEmailSendMode,
  getSafeRecipientOverride,
  shouldSendLiveEmail,
  type EmailSendMode,
} from '@/lib/email-mode';

// Default sender address for Resend sandbox
const DEFAULT_FROM = process.env.NEXT_PUBLIC_FROM_EMAIL || 'Columb Outreach <onboarding@resend.dev>';

let resendClient: Resend | null = null;

function getResendClient() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) return null;

  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }

  return resendClient;
}

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from?: string;
  workspaceId?: string;
  smtpSettingId?: string;
  useAdmin?: boolean; // Parameter to bypass RLS for background jobs
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  mode: EmailSendMode;
  recipient: string;
  provider?: 'mock' | 'dry_run' | 'smtp' | 'resend';
}

export async function sendEmail({
  to,
  subject,
  body,
  from = DEFAULT_FROM,
  workspaceId,
  smtpSettingId,
  useAdmin = false,
}: SendEmailParams): Promise<SendEmailResult> {
  const mode = getEmailSendMode();
  const safeRecipientOverride = getSafeRecipientOverride();
  const effectiveRecipient = safeRecipientOverride || to;

  console.log(`[Email Service] Mode: ${mode}. Preparing email to: ${effectiveRecipient}`);
  console.log(`[Email Service] Subject: "${subject}"`);

  const liveGuard = assertLiveEmailAllowed();
  if (liveGuard) {
    return {
      success: false,
      error: liveGuard.error,
      mode,
      recipient: effectiveRecipient,
    };
  }

  if (!shouldSendLiveEmail()) {
    console.log(`[Email Service] ${mode} mode active. Provider delivery skipped.`);
    return {
      success: true,
      id: `${mode}-email-${Math.random().toString(36).substring(2, 11)}`,
      mode,
      recipient: effectiveRecipient,
      provider: mode === 'mock' ? 'mock' : 'dry_run',
    };
  }

  // 1. Try sending via custom SMTP config
  if (smtpSettingId || workspaceId) {
    try {
      let supabase;
      if (useAdmin) {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        supabase = createAdminClient();
      } else {
        const { createServerClient } = await import('@/lib/supabase/server');
        supabase = await createServerClient();
      }
      
      let smtp = null;
      if (smtpSettingId) {
        if (!workspaceId) {
          return {
            success: false,
            error: 'Workspace scope is required for SMTP delivery',
            mode,
            recipient: effectiveRecipient,
          };
        }

        const { data } = await supabase
          .from('smtp_settings')
          .select('*')
          .eq('id', smtpSettingId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        smtp = data;
      } else if (workspaceId) {
        const { data } = await supabase
          .from('smtp_settings')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        smtp = data;
      }

      if (smtp) {
        console.log(`[Email Service] SMTP configuration found. Sending email via nodemailer: ${smtp.host}`);
        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: {
            user: smtp.user_email,
            pass: smtp.password,
          },
        });

        const info = await transporter.sendMail({
          from: `"${smtp.from_name}" <${smtp.user_email}>`,
          to: effectiveRecipient,
          subject,
          html: /<[a-z][\s\S]*>/i.test(body) ? body : body.replace(/\n/g, '<br/>'),
        });

        console.log('[Email Service] Email sent successfully via SMTP:', info.messageId);
        return {
          success: true,
          id: info.messageId,
          mode,
          recipient: effectiveRecipient,
          provider: 'smtp',
        };
      }
    } catch (err: any) {
      console.error('[Email Service] SMTP delivery error:', err?.message || 'SMTP delivery failed');
      return {
        success: false,
        error: 'SMTP delivery failed',
        mode,
        recipient: effectiveRecipient,
      };
    }
  }

  // 2. Fallback to Resend if API key is provided
  const resend = getResendClient();
  if (!resend) {
    return {
      success: false,
      error: 'No live email provider is configured',
      mode,
      recipient: effectiveRecipient,
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: effectiveRecipient,
      subject,
      html: /<[a-z][\s\S]*>/i.test(body) ? body : body.replace(/\n/g, '<br/>'),
    });

    if (error) {
      console.error('[Email Service] Resend error:', error);
      return {
        success: false,
        error: error.message,
        mode,
        recipient: effectiveRecipient,
      };
    }

    return {
      success: true,
      id: data?.id || undefined,
      mode,
      recipient: effectiveRecipient,
      provider: 'resend',
    };
  } catch (err: any) {
    console.error('[Email Service] Unexpected delivery error:', err?.message || 'Unknown delivery error');
    return {
      success: false,
      error: 'Unknown error occurred while sending email',
      mode,
      recipient: effectiveRecipient,
    };
  }
}

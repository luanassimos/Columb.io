import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const resendApiKey = process.env.RESEND_API_KEY;

// Initialize Resend if API key is provided
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Default sender address for Resend sandbox
const DEFAULT_FROM = process.env.NEXT_PUBLIC_FROM_EMAIL || 'Columb Outreach <onboarding@resend.dev>';

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
  console.log(`[Email Service] Attempting to send email to: ${to}`);
  console.log(`[Email Service] Subject: "${subject}"`);
  console.log(`[Email Service] Body preview: "${body.substring(0, 100)}..."`);

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
          to,
          subject,
          html: body.replace(/\n/g, '<br/>'),
        });

        console.log('[Email Service] Email sent successfully via SMTP:', info.messageId);
        return {
          success: true,
          id: info.messageId,
        };
      }
    } catch (err: any) {
      console.error('[Email Service] SMTP delivery error, failing outbound:', err);
      return {
        success: false,
        error: err?.message || 'SMTP delivery failed',
      };
    }
  }

  // 2. Fallback to Resend if API key is provided
  if (!resend) {
    console.log('[Email Service] MOCK MODE ACTIVE. Email logged successfully.');
    // Return a mock success response with a fake email ID
    return {
      success: true,
      id: `mock-email-${Math.random().toString(36).substring(2, 11)}`,
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: body.replace(/\n/g, '<br/>'), // simple text-to-html line breaks
    });

    if (error) {
      console.error('[Email Service] Resend error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      id: data?.id || undefined,
    };
  } catch (err: any) {
    console.error('[Email Service] Unexpected error:', err);
    return {
      success: false,
      error: err?.message || 'Unknown error occurred while sending email',
    };
  }
}

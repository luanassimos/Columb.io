export type ContactStatus = 'new' | 'contacted' | 'waiting' | 'replied' | 'converted' | 'closed';
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface Profile {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  linkedin_url?: string | null;
  tags: string[];
  status: ContactStatus;
  last_contact_at?: string | null;
  imported_at?: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  workspace_id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export type CampaignStatus = 'draft' | 'queued' | 'running' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  template_id: string;
  status: CampaignStatus;
  schedule_days: number[];
  schedule_time: string;
  target_tags: string[];
  smtp_setting_id?: string | null;
  created_at: string;
  // Included in relations
  template?: Template;
  templates?: Template;
  followup_steps?: FollowupStep[];
}

export interface FollowupStep {
  id: string;
  workspace_id: string;
  campaign_id: string;
  template_id: string;
  delay_days: number;
  step_number: number;
  created_at: string;
  // Included in relations
  template?: Template;
  templates?: Template;
}

export type EmailJobSendMode = 'mock' | 'dry_run' | 'live';
export type EmailJobProvider = 'smtp' | 'resend' | 'mock' | 'dry_run';
export type JobStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'mocked' | 'dry_run' | 'cancelled';

export interface EmailJob {
  id: string;
  workspace_id: string;
  campaign_id: string;
  contact_id: string;
  template_id: string;
  status: JobStatus;
  send_mode?: EmailJobSendMode | null;
  provider?: EmailJobProvider | null;
  provider_message_id?: string | null;
  sent_at?: string | null;
  error_message?: string | null;
  step_number: number;
  created_at: string;
  // Included in relations
  contact?: Contact;
  contacts?: Contact;
  template?: Template;
  templates?: Template;
  campaign?: Campaign;
}

export type NotificationType = 'email_replied' | 'campaign_finished' | 'followup_pending' | 'delivery_failed';

export interface Notification {
  id: string;
  workspace_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface SmtpSettings {
  id: string;
  workspace_id: string;
  host: string;
  port: number;
  secure: boolean;
  user_email: string;
  password?: string;
  from_name: string;
  created_at?: string;
}

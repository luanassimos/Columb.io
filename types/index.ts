export type ContactStatus = 'new' | 'contacted' | 'waiting' | 'replied' | 'converted' | 'closed';
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type LeadEntityType = 'business' | 'person' | 'unknown';
export type AiLeadStatus =
  | 'not_analyzed'
  | 'prechecked'
  | 'analyzing'
  | 'qualified'
  | 'needs_review'
  | 'rejected'
  | 'error';
export type AiOpportunityType =
  | 'missing_website'
  | 'weak_website'
  | 'poor_social_presence'
  | 'coachmetric_fit'
  | 'columb_fit'
  | 'other'
  | 'unknown';
export type AiRecommendedAction =
  | 'reject'
  | 'review'
  | 'draft_email'
  | 'enrich_more'
  | 'create_campaign_candidate';
export type AiLeadGrade = 'A' | 'B' | 'C' | 'D';

export interface AiLanguageDecision {
  country_guess: string;
  language: string;
  reason: string;
  fallback_used: boolean;
}

export interface AiCostControlNotes {
  provider: 'mock' | 'openai' | 'anthropic' | 'gemini' | 'other';
  model?: string;
  prompt_version: string;
  external_ai_called: boolean;
  website_fetch_used: boolean;
  social_fetch_used: boolean;
  evidence_chars_used: number;
  max_evidence_chars: number;
  daily_lead_limit: number;
  notes: string[];
}

export interface AiLeadEvidenceInput {
  source_type: 'manual' | 'website' | 'social' | 'directory' | 'crm' | 'other';
  url?: string | null;
  title?: string | null;
  text_excerpt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AiLeadAnalysisGoal {
  offer_focus?: string;
  target_audience?: string;
  preferred_language?: string;
}

export interface AiLeadAnalysisOutput {
  is_real_prospect: boolean;
  entity_type: LeadEntityType;
  fit_score: number;
  grade: AiLeadGrade;
  confidence: number;
  opportunity_type: AiOpportunityType;
  offer_angle: string;
  country_guess: string;
  language: string;
  language_decision: AiLanguageDecision;
  summary: string;
  facts: string[];
  inferences: string[];
  risks: string[];
  unknowns: string[];
  recommended_action: AiRecommendedAction;
  email_draft?: {
    subject: string;
    body: string;
  } | null;
  follow_up_draft?: {
    body: string;
  } | null;
  evidence_used: AiLeadEvidenceInput[];
  cost_control_notes: AiCostControlNotes;
}

export interface LeadEvidenceSource {
  id: string;
  workspace_id: string;
  lead_id: string;
  source_type: AiLeadEvidenceInput['source_type'];
  url?: string | null;
  title?: string | null;
  text_excerpt?: string | null;
  metadata: Record<string, unknown>;
  fetched_at?: string | null;
  created_at: string;
}

export interface LeadAiAnalysis {
  id: string;
  workspace_id: string;
  lead_id: string;
  status: AiLeadStatus;
  entity_type: LeadEntityType;
  fit_score: number;
  grade: AiLeadGrade;
  confidence: number;
  opportunity_type: AiOpportunityType;
  offer_angle?: string | null;
  country_guess?: string | null;
  language?: string | null;
  summary?: string | null;
  facts: string[];
  inferences: string[];
  risks: string[];
  unknowns: string[];
  recommended_action: AiRecommendedAction;
  evidence_used: AiLeadEvidenceInput[];
  cost_control_notes: AiCostControlNotes;
  model?: string | null;
  provider: string;
  prompt_version: string;
  input_hash: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface LeadAiDraft {
  id: string;
  workspace_id: string;
  lead_id: string;
  analysis_id: string;
  channel: 'email' | 'linkedin' | 'phone' | 'other';
  subject?: string | null;
  body: string;
  follow_up_body?: string | null;
  language: string;
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  created_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

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
  rating: number; // 0 to 5 stars
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
  template_id?: string | null;
  status: CampaignStatus;
  schedule_days: number[];
  schedule_time: string;
  target_tags: string[];
  smtp_setting_id?: string | null;
  dispatch_type: 'scheduled' | 'immediate';
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
  template_id?: string | null;
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
  template_id?: string | null;
  idempotency_key: string;
  sequence_index: number;
  status: JobStatus;
  send_mode?: EmailJobSendMode | null;
  provider?: EmailJobProvider | null;
  provider_message_id?: string | null;
  attempt_count: number;
  max_attempts: number;
  locked_at?: string | null;
  locked_by?: string | null;
  last_error?: string | null;
  processed_at?: string | null;
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
  campaigns?: Campaign;
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

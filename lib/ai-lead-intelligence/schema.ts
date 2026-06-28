import type {
  AiLeadAnalysisOutput,
  AiLeadGrade,
  AiOpportunityType,
  AiRecommendedAction,
  LeadEntityType,
} from '@/types';

export const LEAD_ENTITY_TYPES: LeadEntityType[] = ['business', 'person', 'unknown'];
export const AI_LEAD_GRADES: AiLeadGrade[] = ['A', 'B', 'C', 'D'];
export const AI_OPPORTUNITY_TYPES: AiOpportunityType[] = [
  'missing_website',
  'weak_website',
  'poor_social_presence',
  'coachmetric_fit',
  'columb_fit',
  'other',
  'unknown',
];
export const AI_RECOMMENDED_ACTIONS: AiRecommendedAction[] = [
  'reject',
  'review',
  'draft_email',
  'enrich_more',
  'create_campaign_candidate',
];

export const AI_LEAD_ANALYSIS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_real_prospect',
    'entity_type',
    'fit_score',
    'grade',
    'confidence',
    'opportunity_type',
    'offer_angle',
    'country_guess',
    'language',
    'language_decision',
    'summary',
    'facts',
    'inferences',
    'risks',
    'unknowns',
    'recommended_action',
    'evidence_used',
    'cost_control_notes',
  ],
  properties: {
    is_real_prospect: { type: 'boolean' },
    entity_type: { type: 'string', enum: LEAD_ENTITY_TYPES },
    fit_score: { type: 'integer', minimum: 0, maximum: 100 },
    grade: { type: 'string', enum: AI_LEAD_GRADES },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    opportunity_type: { type: 'string', enum: AI_OPPORTUNITY_TYPES },
    offer_angle: { type: 'string' },
    country_guess: { type: 'string' },
    language: { type: 'string' },
    language_decision: {
      type: 'object',
      additionalProperties: false,
      required: ['country_guess', 'language', 'reason', 'fallback_used'],
      properties: {
        country_guess: { type: 'string' },
        language: { type: 'string' },
        reason: { type: 'string' },
        fallback_used: { type: 'boolean' },
      },
    },
    summary: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' } },
    inferences: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    unknowns: { type: 'array', items: { type: 'string' } },
    recommended_action: { type: 'string', enum: AI_RECOMMENDED_ACTIONS },
    email_draft: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['subject', 'body'],
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
          },
        },
      ],
    },
    follow_up_draft: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['body'],
          properties: {
            body: { type: 'string' },
          },
        },
      ],
    },
    evidence_used: { type: 'array' },
    cost_control_notes: { type: 'object' },
  },
} as const;

export type AiLeadAnalysisSchemaOutput = AiLeadAnalysisOutput;

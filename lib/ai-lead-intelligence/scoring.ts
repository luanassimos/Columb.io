import type {
  AiLeadGrade,
  AiOpportunityType,
  AiRecommendedAction,
  Contact,
  LeadEntityType,
  AiLeadEvidenceInput,
} from '@/types';

export interface CheapLeadScoreInput {
  lead: Pick<Contact, 'name' | 'company' | 'email' | 'phone' | 'city' | 'linkedin_url' | 'rating' | 'tags'>;
  evidence: AiLeadEvidenceInput[];
}

export interface CheapLeadScores {
  entityType: LeadEntityType;
  realEntityScore: number;
  contactabilityScore: number;
  websiteGapScore: number;
  socialPresenceGapScore: number;
  commercialFitScore: number;
  confidenceScore: number;
  riskPenalty: number;
  finalScore: number;
  grade: AiLeadGrade;
  opportunityType: AiOpportunityType;
  recommendedAction: AiRecommendedAction;
  facts: string[];
  inferences: string[];
  risks: string[];
  unknowns: string[];
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function evidenceText(evidence: AiLeadEvidenceInput[]) {
  return evidence
    .map((item) => [item.title, item.text_excerpt, item.url].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();
}

function hasWebsiteEvidence(evidence: AiLeadEvidenceInput[]) {
  return evidence.some((item) => item.source_type === 'website' || Boolean(item.url?.match(/^https?:\/\//i)));
}

function hasSocialEvidence(evidence: AiLeadEvidenceInput[]) {
  return evidence.some((item) => item.source_type === 'social' || Boolean(item.url?.match(/instagram|linkedin|facebook|tiktok/i)));
}

export function gradeFromScore(score: number): AiLeadGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function inferEntityType(input: CheapLeadScoreInput): LeadEntityType {
  const { lead } = input;
  const tags = lead.tags.join(' ').toLowerCase();

  if (hasText(lead.company) || tags.match(/business|company|restaurant|clinic|studio|shop|store|gym/)) {
    return 'business';
  }

  if (hasText(lead.name) && !hasText(lead.company)) {
    return 'person';
  }

  return 'unknown';
}

export function scoreRealEntity(input: CheapLeadScoreInput) {
  const { lead } = input;
  let score = 0;
  if (hasText(lead.name)) score += 25;
  if (hasText(lead.company)) score += 35;
  if (hasText(lead.city)) score += 10;
  if (lead.tags.length > 0) score += 10;
  if (input.evidence.length > 0) score += 20;
  return clamp(score);
}

export function scoreContactability(input: CheapLeadScoreInput) {
  const { lead } = input;
  let score = 0;
  if (hasText(lead.email)) score += 45;
  if (hasText(lead.phone)) score += 35;
  if (hasText(lead.linkedin_url)) score += 15;
  if (input.evidence.some((item) => hasText(item.url))) score += 5;
  return clamp(score);
}

export function scoreWebsiteGap(input: CheapLeadScoreInput) {
  const text = evidenceText(input.evidence);
  if (!hasWebsiteEvidence(input.evidence)) return 80;
  if (text.match(/outdated|slow|broken|under construction|not secure|no ssl|old design/)) return 70;
  if (text.match(/landing page|website|site|home page/)) return 35;
  return 50;
}

export function scoreSocialPresenceGap(input: CheapLeadScoreInput) {
  const text = evidenceText(input.evidence);
  if (!hasSocialEvidence(input.evidence)) return 60;
  if (text.match(/inactive|few posts|no posts|low engagement|outdated/)) return 70;
  return 30;
}

export function scoreCommercialFit(input: CheapLeadScoreInput) {
  const entityType = inferEntityType(input);
  const tags = input.lead.tags.join(' ').toLowerCase();
  let score = entityType === 'business' ? 45 : 20;

  if (tags.match(/restaurant|clinic|salon|studio|gym|shop|store|local|service/)) score += 25;
  if (input.lead.rating >= 4) score += 10;
  if (scoreWebsiteGap(input) >= 60) score += 20;

  return clamp(score);
}

export function scoreConfidence(input: CheapLeadScoreInput) {
  let score = 0;
  if (hasText(input.lead.name)) score += 15;
  if (hasText(input.lead.company)) score += 20;
  if (hasText(input.lead.email) || hasText(input.lead.phone)) score += 20;
  if (input.evidence.length > 0) score += 25;
  if (hasWebsiteEvidence(input.evidence)) score += 10;
  if (hasSocialEvidence(input.evidence)) score += 10;
  return clamp(score) / 100;
}

export function scoreRiskPenalty(input: CheapLeadScoreInput) {
  let penalty = 0;
  if (!hasText(input.lead.email) && !hasText(input.lead.phone)) penalty += 25;
  if (!hasText(input.lead.name)) penalty += 15;
  if (inferEntityType(input) === 'unknown') penalty += 20;
  if (input.evidence.length === 0) penalty += 10;
  return clamp(penalty);
}

export function calculateCheapLeadScores(input: CheapLeadScoreInput): CheapLeadScores {
  const entityType = inferEntityType(input);
  const realEntityScore = scoreRealEntity(input);
  const contactabilityScore = scoreContactability(input);
  const websiteGapScore = scoreWebsiteGap(input);
  const socialPresenceGapScore = scoreSocialPresenceGap(input);
  const commercialFitScore = scoreCommercialFit(input);
  const confidenceScore = scoreConfidence(input);
  const riskPenalty = scoreRiskPenalty(input);

  const rawScore =
    realEntityScore * 0.2 +
    contactabilityScore * 0.2 +
    websiteGapScore * 0.25 +
    socialPresenceGapScore * 0.1 +
    commercialFitScore * 0.25 -
    riskPenalty;
  const finalScore = Math.round(clamp(rawScore));
  const grade = gradeFromScore(finalScore);
  const opportunityType: AiOpportunityType =
    websiteGapScore >= 75 ? 'missing_website' :
    websiteGapScore >= 60 ? 'weak_website' :
    socialPresenceGapScore >= 65 ? 'poor_social_presence' :
    commercialFitScore >= 65 ? 'other' :
    'unknown';
  const recommendedAction: AiRecommendedAction =
    finalScore >= 75 ? 'draft_email' :
    finalScore >= 55 ? 'review' :
    confidenceScore < 0.45 ? 'enrich_more' :
    'reject';

  const facts: string[] = [];
  const inferences: string[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];

  if (hasText(input.lead.name)) facts.push(`Lead name is present: ${input.lead.name}`);
  else unknowns.push('Lead name is missing');

  if (hasText(input.lead.company)) facts.push(`Company is present: ${input.lead.company}`);
  else unknowns.push('Company is missing');

  if (hasText(input.lead.email)) facts.push('Email is present');
  if (hasText(input.lead.phone)) facts.push('Phone is present');
  if (!hasText(input.lead.email) && !hasText(input.lead.phone)) risks.push('No direct email or phone is available');
  if (!hasWebsiteEvidence(input.evidence)) inferences.push('No website evidence was provided');
  if (!hasSocialEvidence(input.evidence)) unknowns.push('Social presence was not verified');
  if (entityType !== 'unknown') inferences.push(`Lead appears to be a ${entityType}`);

  return {
    entityType,
    realEntityScore,
    contactabilityScore,
    websiteGapScore,
    socialPresenceGapScore,
    commercialFitScore,
    confidenceScore,
    riskPenalty,
    finalScore,
    grade,
    opportunityType,
    recommendedAction,
    facts,
    inferences,
    risks,
    unknowns,
  };
}

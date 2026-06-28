import type {
  AiLeadAnalysisGoal,
  AiLeadAnalysisOutput,
  AiLeadEvidenceInput,
  Contact,
} from '@/types';
import { AI_LEAD_INTELLIGENCE_PROMPT_VERSION } from './prompt';
import { calculateCheapLeadScores } from './scoring';

export interface MockLeadAnalysisInput {
  lead: Contact;
  evidence?: AiLeadEvidenceInput[];
  goal?: AiLeadAnalysisGoal;
  costControls?: {
    dailyLeadLimit?: number;
    maxEvidenceChars?: number;
    websiteFetchEnabled?: boolean;
    socialFetchEnabled?: boolean;
  };
}

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  brazil: 'Portuguese',
  brasil: 'Portuguese',
  portugal: 'Portuguese',
  mexico: 'Spanish',
  spain: 'Spanish',
  argentina: 'Spanish',
  colombia: 'Spanish',
  chile: 'Spanish',
  france: 'French',
  germany: 'German',
  italy: 'Italian',
  canada: 'English',
  'united states': 'English',
  usa: 'English',
  uk: 'English',
};

function normalizeEvidence(evidence: AiLeadEvidenceInput[], maxChars: number) {
  let used = 0;
  return evidence.map((item) => {
    const excerpt = item.text_excerpt || '';
    const remaining = Math.max(0, maxChars - used);
    const trimmedExcerpt = excerpt.slice(0, remaining);
    used += trimmedExcerpt.length;

    return {
      ...item,
      text_excerpt: trimmedExcerpt || null,
      metadata: item.metadata || {},
    };
  });
}

function guessCountryAndLanguage(lead: Contact, goal?: AiLeadAnalysisGoal) {
  if (goal?.preferred_language) {
    return {
      country_guess: 'unknown',
      language: goal.preferred_language,
      reason: 'Preferred language was supplied by the caller',
      fallback_used: false,
    };
  }

  const city = lead.city?.toLowerCase() || '';
  const tags = lead.tags.join(' ').toLowerCase();
  const haystack = `${city} ${tags}`;

  for (const [country, language] of Object.entries(COUNTRY_LANGUAGE_MAP)) {
    if (haystack.includes(country)) {
      return {
        country_guess: country,
        language,
        reason: `Matched country evidence from lead fields: ${country}`,
        fallback_used: false,
      };
    }
  }

  if (city.match(/sao paulo|rio de janeiro|curitiba|florianopolis|belo horizonte/)) {
    return {
      country_guess: 'Brazil',
      language: 'Portuguese',
      reason: 'Matched a Brazilian city in lead fields',
      fallback_used: false,
    };
  }

  return {
    country_guess: 'unknown',
    language: 'English',
    reason: 'No reliable country evidence was provided',
    fallback_used: true,
  };
}

function offerAngleFor(opportunityType: AiLeadAnalysisOutput['opportunity_type'], goal?: AiLeadAnalysisGoal) {
  if (goal?.offer_focus) return goal.offer_focus;

  if (opportunityType === 'missing_website') {
    return 'Low-cost landing page for businesses without a website';
  }

  if (opportunityType === 'weak_website') {
    return 'Affordable website refresh for businesses with outdated online presence';
  }

  if (opportunityType === 'poor_social_presence') {
    return 'Simple landing page to make social traffic easier to convert';
  }

  return 'Human-reviewed outbound opportunity';
}

function createDraft(
  lead: Contact,
  language: string,
  opportunityType: AiLeadAnalysisOutput['opportunity_type'],
  shouldDraft: boolean
) {
  if (!shouldDraft) return null;

  const companyName = lead.company || lead.name || 'your business';
  const isPortuguese = language.toLowerCase() === 'portuguese';
  const subject = isPortuguese
    ? `Ideia rapida para ${companyName}`
    : `Quick idea for ${companyName}`;
  const body = isPortuguese
    ? `Oi ${lead.name || 'tudo bem'}.\n\nNotei uma oportunidade de melhorar a presenca online da ${companyName} com uma landing page simples, rapida e acessivel. Se fizer sentido, posso te mostrar uma proposta curta para validar antes de qualquer campanha.\n\nAbs.`
    : `Hi ${lead.name || 'there'}.\n\nI noticed a possible opportunity to improve ${companyName}'s online presence with a simple, fast, low-cost landing page. If useful, I can share a short proposal for human review before any campaign goes out.\n\nBest.`;

  return {
    subject,
    body: `${body}\n\nOpportunity type: ${opportunityType}.`,
  };
}

export function analyzeLeadWithMockProvider(input: MockLeadAnalysisInput): AiLeadAnalysisOutput {
  const maxEvidenceChars = input.costControls?.maxEvidenceChars ?? 6000;
  const evidence = normalizeEvidence(input.evidence || [], maxEvidenceChars);
  const scores = calculateCheapLeadScores({ lead: input.lead, evidence });
  const languageDecision = guessCountryAndLanguage(input.lead, input.goal);
  const offerAngle = offerAngleFor(scores.opportunityType, input.goal);
  const shouldDraft = scores.recommendedAction === 'draft_email';
  const emailDraft = createDraft(input.lead, languageDecision.language, scores.opportunityType, shouldDraft);

  return {
    is_real_prospect: scores.finalScore >= 45 && scores.entityType !== 'unknown',
    entity_type: scores.entityType,
    fit_score: scores.finalScore,
    grade: scores.grade,
    confidence: Number(scores.confidenceScore.toFixed(2)),
    opportunity_type: scores.opportunityType,
    offer_angle: offerAngle,
    country_guess: languageDecision.country_guess,
    language: languageDecision.language,
    language_decision: languageDecision,
    summary: `${input.lead.company || input.lead.name || 'Lead'} scored ${scores.finalScore}/100 using deterministic cheap checks only.`,
    facts: scores.facts,
    inferences: scores.inferences,
    risks: scores.risks,
    unknowns: scores.unknowns,
    recommended_action: scores.recommendedAction,
    email_draft: emailDraft,
    follow_up_draft: null,
    evidence_used: evidence,
    cost_control_notes: {
      provider: 'mock',
      model: 'deterministic-heuristics',
      prompt_version: AI_LEAD_INTELLIGENCE_PROMPT_VERSION,
      external_ai_called: false,
      website_fetch_used: false,
      social_fetch_used: false,
      evidence_chars_used: evidence.reduce((total, item) => total + (item.text_excerpt?.length || 0), 0),
      max_evidence_chars: maxEvidenceChars,
      daily_lead_limit: input.costControls?.dailyLeadLimit ?? 50,
      notes: [
        'Mock provider only; no external AI call was made.',
        'Scores are deterministic and intended for UI/database testing.',
        'Human approval is required before any outreach.',
      ],
    },
  };
}

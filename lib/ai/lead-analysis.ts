import { assertString, generateStructured } from './openai';
import { DEFAULT_AI_COMMUNICATION_LANGUAGE, resolveAiCommunicationLanguage } from './languages';

export interface LeadAnalysis {
  business_summary: string; industry: string; services: string[]; location: string;
  probable_size: string | null; fit_score: number; fit_label: 'baixa' | 'média' | 'alta';
  fit_reason: string; recommended_service: string; opportunity_summary: string;
  personalization_points: string[]; suggested_approach: string;
}

const schema = { type: 'object', additionalProperties: false,
  required: ['business_summary','industry','services','location','probable_size','fit_score','fit_label','fit_reason','recommended_service','opportunity_summary','personalization_points','suggested_approach'],
  properties: {
    business_summary:{type:'string'}, industry:{type:'string'}, services:{type:'array',items:{type:'string'}}, location:{type:'string'}, probable_size:{type:['string','null']},
    fit_score:{type:'integer',minimum:0,maximum:100}, fit_label:{type:'string',enum:['baixa','média','alta']}, fit_reason:{type:'string'}, recommended_service:{type:'string'},
    opportunity_summary:{type:'string'}, personalization_points:{type:'array',items:{type:'string'}}, suggested_approach:{type:'string'},
  }};

export async function analyzeLead(companyProfile: unknown, lead: unknown, evidence: unknown[], language = DEFAULT_AI_COMMUNICATION_LANGUAGE) {
  const outputLanguage = resolveAiCommunicationLanguage(language);
  const result = await generateStructured<LeadAnalysis>('lead_analysis', schema,
    `Evaluate commercial fit using only the supplied facts. Write every natural-language field in ${outputLanguage.promptName}; keep fit_label as one of the schema values. Contact availability does not increase fit by itself. Distinguish facts from inferences. Do not invent company size, people, email, phone, URLs, or needs. Return null when company size has no source.`,
    { output_language: outputLanguage.code, company_profile: companyProfile, lead, evidence });
  assertString(result.fit_reason, 'fit_reason');
  if (!Number.isInteger(result.fit_score) || result.fit_score < 0 || result.fit_score > 100) throw new Error('Score de IA inválido');
  return result;
}

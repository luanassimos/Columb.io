import { assertString, generateStructured } from './openai';
import { DEFAULT_AI_COMMUNICATION_LANGUAGE, resolveAiCommunicationLanguage } from './languages';

export interface CompanyAiProfile {
  company_summary: string;
  main_services: string[];
  secondary_services: string[];
  value_proposition: string;
  differentiators: string[];
  ideal_customer_profile: string;
  target_industries: string[];
  excluded_industries: string[];
  common_customer_problems: string[];
  relevant_cases: string[];
  suggested_pitch: string;
  communication_style: string;
}

const stringArray = { type: 'array', items: { type: 'string' } };
const schema = {
  type: 'object', additionalProperties: false,
  required: ['company_summary','main_services','secondary_services','value_proposition','differentiators','ideal_customer_profile','target_industries','excluded_industries','common_customer_problems','relevant_cases','suggested_pitch','communication_style'],
  properties: {
    company_summary: { type: 'string' }, main_services: stringArray, secondary_services: stringArray,
    value_proposition: { type: 'string' }, differentiators: stringArray,
    ideal_customer_profile: { type: 'string' }, target_industries: stringArray,
    excluded_industries: stringArray, common_customer_problems: stringArray,
    relevant_cases: stringArray, suggested_pitch: { type: 'string' }, communication_style: { type: 'string' },
  },
};

export async function generateCompanyProfile(raw: Record<string, unknown>, language = DEFAULT_AI_COMMUNICATION_LANGUAGE) {
  const outputLanguage = resolveAiCommunicationLanguage(language);
  const profile = await generateStructured<CompanyAiProfile>(
    'company_ai_profile', schema,
    `Create a commercial profile using only the supplied data. Write every natural-language field in ${outputLanguage.promptName}. Do not invent cases, services, numbers, or differentiators. Use empty arrays when information was not supplied.`,
    { output_language: outputLanguage.code, company: raw },
  );
  assertString(profile.company_summary, 'company_summary');
  if (!Array.isArray(profile.main_services) || !Array.isArray(profile.target_industries)) throw new Error('Resposta de IA inválida');
  return profile;
}

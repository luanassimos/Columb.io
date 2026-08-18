import { assertString, generateStructured } from './openai';
import { DEFAULT_AI_COMMUNICATION_LANGUAGE, resolveAiCommunicationLanguage } from './languages';

export interface PersonalizedEmail { subject: string; email_body: string; personalization_reason: string }
const schema = { type:'object', additionalProperties:false, required:['subject','email_body','personalization_reason'], properties:{ subject:{type:'string'}, email_body:{type:'string'}, personalization_reason:{type:'string'} } };

export async function generatePersonalizedEmail(companyProfile: unknown, lead: unknown, analysis: unknown, signature: string, language = DEFAULT_AI_COMMUNICATION_LANGUAGE) {
  const outputLanguage = resolveAiCommunicationLanguage(language);
  const result = await generateStructured<PersonalizedEmail>('personalized_email', schema,
    `Write a natural, professional, low-pressure first B2B email in ${outputLanguage.promptName}, with a simple CTA and about 80–160 words. Personalize only with supplied facts. Do not claim human analysis or invent contacts, people, or problems. Do not use HTML.`,
    { output_language: outputLanguage.code, company_profile: companyProfile, lead, analysis, signature });
  assertString(result.subject, 'subject'); assertString(result.email_body, 'email_body');
  const words = result.email_body.trim().split(/\s+/).length;
  if (words < 40 || words > 220) throw new Error('E-mail de IA fora do tamanho seguro');
  return result;
}

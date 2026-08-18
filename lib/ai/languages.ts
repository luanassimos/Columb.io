export const AI_COMMUNICATION_LANGUAGES = [
  { code: 'pt-BR', label: 'Português (Brasil)', promptName: 'Brazilian Portuguese' },
  { code: 'en-US', label: 'English (United States)', promptName: 'American English' },
  { code: 'es-ES', label: 'Español', promptName: 'Spanish' },
  { code: 'fr-FR', label: 'Français', promptName: 'French' },
  { code: 'de-DE', label: 'Deutsch', promptName: 'German' },
  { code: 'it-IT', label: 'Italiano', promptName: 'Italian' },
] as const;

export type AiCommunicationLanguage = (typeof AI_COMMUNICATION_LANGUAGES)[number]['code'];

export const DEFAULT_AI_COMMUNICATION_LANGUAGE: AiCommunicationLanguage = 'pt-BR';

export function resolveAiCommunicationLanguage(value: unknown) {
  return AI_COMMUNICATION_LANGUAGES.find((language) => language.code === value)
    ?? AI_COMMUNICATION_LANGUAGES[0];
}

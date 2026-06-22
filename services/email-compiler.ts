import { Contact } from '@/types';

/**
 * Replaces template variables {{nome}}, {{empresa}}, and {{cidade}}
 * with actual values from a contact.
 */
export function compileTemplate(text: string, contact: Contact): string {
  if (!text) return '';
  
  return text
    .replace(/\{\{\s*(nome|name)\s*\}\}/gi, contact.name || '')
    .replace(/\{\{\s*(empresa|company)\s*\}\}/gi, contact.company || '')
    .replace(/\{\{\s*(cidade|city)\s*\}\}/gi, contact.city || '');
}

/**
 * Compiles both subject and body templates for a contact.
 */
export function compileEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  contact: Contact
): { subject: string; body: string } {
  return {
    subject: compileTemplate(subjectTemplate, contact),
    body: compileTemplate(bodyTemplate, contact),
  };
}

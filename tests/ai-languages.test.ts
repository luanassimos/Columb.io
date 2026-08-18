import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_COMMUNICATION_LANGUAGES,
  DEFAULT_AI_COMMUNICATION_LANGUAGE,
  resolveAiCommunicationLanguage,
} from '../lib/ai/languages';

test('aceita somente idiomas de comunicação suportados', () => {
  for (const language of AI_COMMUNICATION_LANGUAGES) {
    assert.equal(resolveAiCommunicationLanguage(language.code).code, language.code);
  }
});

test('usa português do Brasil como fallback seguro', () => {
  assert.equal(resolveAiCommunicationLanguage('idioma-injetado').code, DEFAULT_AI_COMMUNICATION_LANGUAGE);
  assert.equal(resolveAiCommunicationLanguage(null).code, DEFAULT_AI_COMMUNICATION_LANGUAGE);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedupeKeys, normalizeDomain, normalizeEmail, normalizePhone, normalizeText } from '../lib/prospecting/normalize';

test('normaliza identidades sem inventar dados', () => {
  assert.equal(normalizeEmail(' Comercial@Exemplo.COM '), 'comercial@exemplo.com');
  assert.equal(normalizeEmail('sem-email'), null);
  assert.equal(normalizePhone('+55 (21) 99999-0000'), '5521999990000');
  assert.equal(normalizeDomain('https://www.Exemplo.com.br/contato'), 'exemplo.com.br');
  assert.equal(normalizeText('Clínica São José'), 'clinica sao jose');
});

test('prioriza chaves fortes e mantém fallback de empresa e local', () => {
  assert.deepEqual(buildDedupeKeys({ company:'Empresa X', website:'empresa.com', email:'oi@empresa.com', phone:'(21) 2222-3333', city:'Rio de Janeiro', googlePlaceId:'abc' }), [
    'domain:empresa.com', 'email:oi@empresa.com', 'phone:2122223333', 'google:abc', 'company_location:empresa x|rio de janeiro',
  ]);
});

test('não cria chave para campos ausentes', () => {
  assert.deepEqual(buildDedupeKeys({ company:'Empresa sem localização' }), []);
});

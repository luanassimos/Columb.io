export function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() || '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, '') || '';
  return digits.length >= 8 ? digits : null;
}

export function normalizeDomain(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(candidate).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildDedupeKeys(input: {
  company?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  googlePlaceId?: string | null;
  yelpId?: string | null;
}) {
  const keys: string[] = [];
  const domain = normalizeDomain(input.website);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (domain) keys.push(`domain:${domain}`);
  if (email) keys.push(`email:${email}`);
  if (phone) keys.push(`phone:${phone}`);
  if (input.googlePlaceId) keys.push(`google:${input.googlePlaceId.trim().toLowerCase()}`);
  if (input.yelpId) keys.push(`yelp:${input.yelpId.trim().toLowerCase()}`);
  const company = normalizeText(input.company);
  const location = normalizeText(input.address || input.city);
  if (company && location) keys.push(`company_location:${company}|${location}`);
  return [...new Set(keys)];
}

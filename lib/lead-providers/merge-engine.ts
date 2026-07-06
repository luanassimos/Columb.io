import { CompanyLead } from './types';

// Levenshtein distance calculation
export function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}

export function calculateSimilarity(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  const dist = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1.0 - dist / maxLength;
}

// Normalize company name (remove accents, punctuation, common business suffixes)
export function normalizeName(name: string): string {
  if (!name) return '';
  let norm = name.toLowerCase();
  norm = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  norm = norm.replace(/[^a-z0-9\s]/g, ''); // strip special characters except space

  const suffixes = [
    '\\bltda\\b', '\\bltd\\b', '\\bllc\\b', '\\binc\\b', '\\bcorp\\b',
    '\\bco\\b', '\\beireli\\b', '\\bme\\b', '\\bsa\\b', '\\blimited\\b',
    '\\bcorporation\\b', '\\bincorporated\\b', '\\bs/a\\b', '\\bs\\.a\\b'
  ];
  for (const suffix of suffixes) {
    norm = norm.replace(new RegExp(suffix, 'g'), '');
  }
  return norm.replace(/\s+/g, ' ').trim();
}

// Normalize address (remove accents, punctuation, common abbreviations, zip codes)
export function normalizeAddress(address: string | null): string {
  if (!address) return '';
  let norm = address.toLowerCase();
  norm = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  norm = norm.replace(/[^a-z0-9\s]/g, '');

  const terms = [
    '\\brua\\b', '\\bav\\b', '\\bavenida\\b', '\\bst\\b', '\\bstreet\\b',
    '\\brd\\b', '\\broad\\b', '\\bave\\b', '\\bdr\\b', '\\bdrive\\b',
    '\\bblvd\\b', '\\bboulevard\\b', '\\bsp\\b', '\\brj\\b', '\\bmg\\b'
  ];
  for (const term of terms) {
    norm = norm.replace(new RegExp(term, 'g'), '');
  }

  // Remove zip/postal codes
  norm = norm.replace(/\b\d{5}-\d{3}\b/g, '');
  norm = norm.replace(/\b\d{8}\b/g, '');
  norm = norm.replace(/\b\d{5}\b/g, '');

  return norm.replace(/\s+/g, ' ').trim();
}

// Check if two leads are duplicates based on name and address similarity
export function areLeadsDuplicate(
  leadA: { name: string; address?: string | null },
  leadB: { name: string; address?: string | null }
): boolean {
  const normNameA = normalizeName(leadA.name);
  const normNameB = normalizeName(leadB.name);

  const nameSim = calculateSimilarity(normNameA, normNameB);
  if (nameSim < 0.85) return false;

  const addrA = leadA.address;
  const addrB = leadB.address;

  if (addrA && addrB) {
    const normAddrA = normalizeAddress(addrA);
    const normAddrB = normalizeAddress(addrB);
    const addrSim = calculateSimilarity(normAddrA, normAddrB);

    return addrSim >= 0.75 || normAddrA.includes(normAddrB) || normAddrB.includes(normAddrA);
  }

  // If one of the addresses is missing, we consider them duplicates if the name is a very close match
  return true;
}

// Merge new incoming lead data into existing lead database record
export function mergeLeadData(existing: any, incoming: CompanyLead): any {
  const merged = { ...existing };

  // Fill in missing phone
  if (incoming.phone && (!existing.phone || existing.phone.trim() === '')) {
    merged.phone = incoming.phone;
  }
  // Fill in missing website
  if (incoming.website && (!existing.website || existing.website.trim() === '')) {
    merged.website = incoming.website;
  }
  // Fill in missing address
  if (incoming.address && (!existing.address || existing.address.trim() === '')) {
    merged.address = incoming.address;
  }
  // Fill in missing coordinates
  if (incoming.latitude && !existing.lat) {
    merged.lat = incoming.latitude;
  }
  if (incoming.longitude && !existing.lng) {
    merged.lng = incoming.longitude;
  }
  // Fill in missing category, email, maps_url
  if (incoming.category && (!existing.category || existing.category.trim() === '')) {
    merged.category = incoming.category;
  }
  if (incoming.email && (!existing.email || existing.email.trim() === '')) {
    merged.email = incoming.email;
  }
  if (incoming.maps_url && (!existing.maps_url || existing.maps_url.trim() === '')) {
    merged.maps_url = incoming.maps_url;
  }
  // Fill in missing rating / reviews count
  if (incoming.rating !== undefined && incoming.rating !== null && existing.rating === null) {
    merged.rating = incoming.rating;
  }
  if (incoming.reviews_count !== undefined && incoming.reviews_count !== null && existing.reviews_count === null) {
    merged.reviews_count = incoming.reviews_count;
  }

  // Merge the sources list
  const sourcesList = Array.isArray(existing.sources) ? existing.sources : [];
  const sourcesSet = new Set<string>(sourcesList);
  if (incoming.provider) {
    sourcesSet.add(incoming.provider);
  }
  merged.sources = Array.from(sourcesSet);

  return merged;
}

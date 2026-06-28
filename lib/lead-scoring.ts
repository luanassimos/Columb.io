export interface ScoredLead {
  lead_score: number;
  lead_grade: 'A' | 'B' | 'C' | 'D';
}

export function calculateLeadScore(lead: {
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
}): ScoredLead {
  let score = 0;

  // 1. Website: +30
  if (lead.website && lead.website.trim().length > 0) {
    score += 30;
  }

  // 2. Phone: +25
  if (lead.phone && lead.phone.trim().length > 0) {
    score += 25;
  }

  // 3. Address: +10
  if (lead.address && lead.address.trim().length > 0) {
    score += 10;
  }

  // 4. Category: +10
  if (lead.category && lead.category.trim().length > 0) {
    score += 10;
  }

  // 5. Reviews: 1-20 (+5), 21-100 (+10), 100+ (+15)
  const revs = lead.reviews_count ?? 0;
  if (revs >= 100) {
    score += 15;
  } else if (revs >= 21) {
    score += 10;
  } else if (revs >= 1) {
    score += 5;
  }

  // 6. Rating: >=4.5 (+10), 4.0-4.49 (+5), <4 (0)
  const rate = lead.rating ?? 0;
  if (rate >= 4.5) {
    score += 10;
  } else if (rate >= 4.0) {
    score += 5;
  }

  // Convert to Grade
  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (score >= 90) {
    grade = 'A';
  } else if (score >= 70) {
    grade = 'B';
  } else if (score >= 50) {
    grade = 'C';
  }

  return { lead_score: score, lead_grade: grade };
}

/**
 * lib/workers/lead-worker-loop.ts
 *
 * Re-exports the lead scraper loop so it can be bootstrapped by instrumentation.ts
 * without carrying the standalone worker's env-loading or process.exit() calls.
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { calculateLeadScore } from '@/lib/lead-scoring';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Scraper (identical logic as scripts/lead-worker.ts, no process.exit) ────

async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  if (!url) return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
  const cleanEmail = (e: string) => {
    const l = e.toLowerCase();
    return !['png','jpg','jpeg','gif','webp','svg','css','js'].some(ext => l.endsWith(`.${ext}`)) &&
           !['sentry','bootstrap','jquery','wix','wordpress','domain','example','test'].some(w => l.includes(w));
  };
  const fetchHtml = async (u: string) => {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6000);
      const r = await fetch(u, { signal: c.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(t);
      return r.ok ? await r.text() : null;
    } catch { return null; }
  };

  let target = url.trim();
  if (target.includes('google.com/url?')) {
    try { const u = new URL(target); target = u.searchParams.get('q') ?? target; } catch {}
  }
  if (!target.startsWith('http')) target = 'https://' + target;

  const html = await fetchHtml(target);
  if (!html) return null;
  const m = html.match(emailRegex)?.filter(cleanEmail);
  if (m?.length) return m[0].toLowerCase();
  return null;
}

async function runScraper(
  jobId: string,
  category: string,
  region: string | null,
  limitCount: number,
  lat: number | null,
  lng: number | null,
  radius: number | null,
  onlyEmail: boolean,
  onProgress: (count: number, lead: any) => Promise<boolean>
) {
  let url = '';
  if (lat !== null && lng !== null) {
    let zoom = 12;
    if (radius) {
      const km = radius / 1000;
      if (km <= 1.5) zoom = 15;
      else if (km <= 3.5) zoom = 14;
      else if (km <= 7) zoom = 13;
      else if (km <= 15) zoom = 12;
      else zoom = 11;
    }
    url = `https://www.google.com/maps/search/${encodeURIComponent(category)}/@${lat},${lng},${zoom}z`;
  } else {
    const q = region ? `${category} ${region}` : category;
    url = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Scroll the feed to load more results
    let lastCount = 0;
    let stableRounds = 0;
    while (stableRounds < 3) {
      const feed = await page.$('div[role="feed"]');
      if (feed) {
        await page.evaluate(el => el.scrollTo(0, el.scrollHeight), feed);
      }
      await page.waitForTimeout(2000);
      const cards = await page.$$('a[href*="/maps/place/"]');
      if (cards.length >= limitCount) break;
      if (cards.length === lastCount) stableRounds++;
      else stableRounds = 0;
      lastCount = cards.length;
    }

    const cards = await page.$$('a[href*="/maps/place/"]');
    let savedCount = 0;

    for (let i = 0; i < Math.min(cards.length, limitCount); i++) {
      try {
        const card = cards[i];
        const href = await card.getAttribute('href');
        const name = await card.getAttribute('aria-label') || await card.innerText().catch(() => '');
        const trimmedName = name.trim();
        if (!trimmedName) continue;

        // Click card to load detail panel
        await card.click();
        await page.waitForTimeout(1500);

        // Phone
        let phone: string | null = null;
        try {
          const phoneEl = await page.$('[data-tooltip="Copy phone number"], [aria-label*="Phone"]');
          if (phoneEl) phone = await phoneEl.getAttribute('data-value') || await phoneEl.innerText();
        } catch {}

        // Website
        let website: string | null = null;
        try {
          const webEl = await page.$('a[data-tooltip="Open website"], a[aria-label*="Website"]');
          if (webEl) {
            website = await webEl.getAttribute('href');
            if (website?.includes('google.com/url?')) {
              try { website = new URL(website).searchParams.get('q') ?? website; } catch {}
            }
          }
        } catch {}

        // Address
        let address: string | null = null;
        try {
          const addrEl = await page.$('[data-tooltip="Copy address"]');
          if (addrEl) address = await addrEl.getAttribute('data-value') || await addrEl.innerText();
        } catch {}

        // Rating & reviews
        let rating: number | null = null;
        let reviewsCount: number | null = null;
        try {
          const ratingEl = await page.$('div.F7nice');
          if (ratingEl) {
            const text = await ratingEl.innerText();
            const ratingMatch = text.match(/(\d+[.,]\d+)/);
            const reviewsMatch = text.match(/\((\d[\d,.]*)\)/);
            if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));
            if (reviewsMatch) reviewsCount = parseInt(reviewsMatch[1].replace(/[,.]/g, ''), 10);
          }
        } catch {}

        // Category
        let parsedCategory: string | null = null;
        try {
          const catEl = await page.$('button[jsaction*="category"]');
          if (catEl) parsedCategory = await catEl.innerText();
        } catch {}

        // Coordinates from URL
        let leadLat: number | null = null;
        let leadLng: number | null = null;
        try {
          const currentUrl = page.url();
          const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (coordMatch) {
            leadLat = parseFloat(coordMatch[1]);
            leadLng = parseFloat(coordMatch[2]);
          }
        } catch {}

        // Email (only if onlyEmail filter active)
        let email: string | null = null;
        if (onlyEmail && website) {
          email = await scrapeEmailFromWebsite(website);
        }

        if (onlyEmail && !email) continue;

        const lead = {
          name: trimmedName,
          phone: phone || null,
          address: address || null,
          website: website || null,
          email,
          category: parsedCategory || category,
          lat: leadLat,
          lng: leadLng,
          maps_url: href || null,
          rating,
          reviews_count: reviewsCount,
        };

        const saved = await onProgress(savedCount + 1, lead);
        if (saved) savedCount++;
        await page.waitForTimeout(50);
      } catch (cardErr) {
        console.error(`[LeadWorker] Erro no card ${i + 1}:`, cardErr);
      }
    }
  } finally {
    await browser.close();
  }
}

// ─── Queue Processing ─────────────────────────────────────────────────────────

async function processQueue() {
  const supabase = getSupabase();
  try {
    const { data: jobs, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error || !jobs?.length) return;

    const job = jobs[0];
    console.log(`[LeadWorker] Iniciando job ${job.id} — "${job.category}"`);

    await supabase
      .from('lead_finder_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    try {
      let leadsSaved = 0;
      const leadRegion = job.region || `Geo:${job.lat},${job.lng}`;

      await runScraper(
        job.id,
        job.category,
        job.region,
        job.limit_count,
        job.lat,
        job.lng,
        job.radius,
        job.only_email ?? false,
        async (_progress, lead) => {
          // Dedup check
          const { data: existing } = await supabase
            .from('leads')
            .select('*')
            .eq('workspace_id', job.workspace_id)
            .ilike('name', lead.name)
            .limit(1)
            .maybeSingle();

          if (existing) {
            let needsUpdate = false;
            const payload: any = {};
            if (lead.phone && !existing.phone) { payload.phone = lead.phone; needsUpdate = true; }
            if (lead.website && !existing.website) { payload.website = lead.website; needsUpdate = true; }
            if (lead.address && !existing.address) { payload.address = lead.address; needsUpdate = true; }
            if (lead.rating !== null && lead.rating !== existing.rating) { payload.rating = lead.rating; needsUpdate = true; }
            if (lead.reviews_count !== null && lead.reviews_count !== existing.reviews_count) { payload.reviews_count = lead.reviews_count; needsUpdate = true; }

            if (needsUpdate) {
              const merged = { ...existing, ...payload };
              const score = calculateLeadScore(merged);
              payload.lead_score = score.lead_score;
              payload.lead_grade = score.lead_grade;
              payload.scoring_version = 1;
              payload.contact_status = 'pending';
              await supabase.from('leads').update(payload).eq('id', existing.id);
              leadsSaved++;
              return true;
            }
            return true;
          }

          // New lead
          const score = calculateLeadScore(lead);
          const { error: insertErr } = await supabase.from('leads').insert({
            workspace_id: job.workspace_id,
            job_id: job.id,
            name: lead.name,
            phone: lead.phone,
            address: lead.address,
            website: lead.website,
            category: lead.category || job.category,
            region: leadRegion,
            lat: lead.lat,
            lng: lead.lng,
            email: lead.email || null,
            maps_url: lead.maps_url || null,
            contact_status: 'pending',
            rating: lead.rating,
            reviews_count: lead.reviews_count,
            lead_score: score.lead_score,
            lead_grade: score.lead_grade,
            scoring_version: 1,
          });

          if (!insertErr) {
            leadsSaved++;
            await supabase
              .from('lead_finder_jobs')
              .update({ progress_count: leadsSaved, updated_at: new Date().toISOString() })
              .eq('id', job.id);
            return true;
          }
          return false;
        }
      );

      // Check if cancelled before marking complete
      const { data: final } = await supabase
        .from('lead_finder_jobs')
        .select('status')
        .eq('id', job.id)
        .single();

      if (final?.status !== 'cancelled') {
        await supabase
          .from('lead_finder_jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        console.log(`[LeadWorker] Job ${job.id} concluído — ${leadsSaved} leads.`);
      }
    } catch (err: any) {
      console.error(`[LeadWorker] Falha no job ${job.id}:`, err);
      await supabase
        .from('lead_finder_jobs')
        .update({ status: 'failed', error_message: err.message ?? 'Erro desconhecido', updated_at: new Date().toISOString() })
        .eq('id', job.id);
    }
  } catch (err) {
    console.error('[LeadWorker] Erro global:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let started = false;

export function startLeadWorker() {
  if (started) return;
  started = true;
  console.log('[LeadWorker] Worker iniciado pelo servidor Next.js.');
  processQueue();
  setInterval(processQueue, 5000);
}

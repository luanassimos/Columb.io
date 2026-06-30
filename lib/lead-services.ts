import { chromium } from 'playwright';
import { calculateLeadScore, calculateProfessionalScore } from './lead-scoring';

// Helper to scrape email from website (used by company scraper)
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

/**
 * Capture Company Leads using Playwright on Google Maps
 */
export async function captureCompanyLeads(
  jobId: string,
  category: string,
  region: string | null,
  limitCount: number,
  lat: number | null,
  lng: number | null,
  radius: number | null,
  onlyEmail: boolean,
  onProgress: (count: number, lead: any) => Promise<boolean>
): Promise<void> {
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

  console.log(`[LeadServices] Starting company scraper on URL: ${url}`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  const apiPlaceIds = new Set<string>();
  page.on('response', async (response) => {
    try {
      const resUrl = response.url();
      if (resUrl.includes('search?') && (resUrl.includes('tbm=map') || resUrl.includes('pb='))) {
        const text = await response.text();
        const matches = text.match(/ChIJ[a-zA-Z0-9_-]{19,30}/g) || [];
        for (const m of matches) {
          apiPlaceIds.add(m);
        }
      }
    } catch (e) {}
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Locate the sidebar panel
    const feedSelector = 'div[role="feed"]';
    await page.waitForSelector(feedSelector, { timeout: 10000 }).catch(() => {});
    const feed = await page.$(feedSelector);

    let lastCount = 0;
    let stableRounds = 0;

    if (feed) {
      console.log('[LeadServices] Results sidebar panel located. Starting incremental scroll...');
      while (stableRounds < 3) {
        // Scroll incremental
        await page.evaluate(el => el.scrollBy(0, 1000), feed);
        await page.waitForTimeout(2000);

        const currentCards = await feed.$$('a[href*="/maps/place/"]');
        console.log(`[LeadServices] Found ${currentCards.length} cards in sidebar feed.`);

        if (currentCards.length >= limitCount) {
          console.log(`[LeadServices] Reached target limit count: ${limitCount}`);
          break;
        }

        if (currentCards.length === lastCount) {
          stableRounds++;
          console.log(`[LeadServices] Stable round ${stableRounds}/3 (No new cards).`);
        } else {
          stableRounds = 0;
          lastCount = currentCards.length;
        }
        await page.waitForTimeout(500);
      }
    } else {
      console.warn('[LeadServices] Could not find results sidebar feed container.');
    }

    // Select cards ONLY from the sidebar feed to avoid graphical map elements
    const cards = feed ? await feed.$$('a[href*="/maps/place/"]') : [];
    const sidebarCardsCount = cards.length;
    console.log(`[LeadServices] Sidebar feed results count: ${sidebarCardsCount}`);

    let savedCount = 0;
    const capturedKeys = new Set<string>();
    const isDebug = process.env.DEBUG_SCRAPER === 'true' || process.env.NODE_ENV === 'development';

    for (let i = 0; i < cards.length; i++) {
      if (savedCount >= limitCount) break;

      const card = cards[i];
      let href = '';
      let name = '';
      let mapsId = '';
      let latVal: number | null = null;
      let lngVal: number | null = null;
      let categoryVal = category;
      let addressVal = '';
      let normalizedKey = '';

      try {
        href = await card.getAttribute('href') || '';
        name = await card.getAttribute('aria-label') || await card.innerText().catch(() => '');
        name = name.trim();

        if (!name || !href) continue;

        // Parse Place ID (MAPS_ID) and POSITION coordinates directly from card URL
        const placeIdMatch = href.match(/!19s([^!&?]+)/);
        const hexIdMatch = href.match(/!1s([^!&?]+)/);
        mapsId = placeIdMatch ? placeIdMatch[1] : (hexIdMatch ? hexIdMatch[1] : '');

        const latMatch = href.match(/!3d(-?\d+\.\d+)/);
        const lngMatch = href.match(/!4d(-?\d+\.\d+)/);
        latVal = latMatch ? parseFloat(latMatch[1]) : null;
        lngVal = lngMatch ? parseFloat(lngMatch[1]) : null;

        // Extract category and address text from parent element
        const parentText = await page.evaluate(el => el.parentElement?.innerText || '', card);
        const lines = parentText.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
          if (line.includes('·') || line.includes('\u00b7')) {
            const parts = line.split(/[·\u00b7]/).map(p => p.trim());
            const isHoursLine = parts.some(p => 
              /open|close|fecha|aberto|horário|hour|fechado|abre/i.test(p) || 
              /\d{1,2}:\d{2}/.test(p)
            );
            if (isHoursLine) continue;

            if (parts.length >= 2) {
              categoryVal = parts[0];
              addressVal = parts[1];
              break;
            } else if (parts.length === 1) {
              categoryVal = parts[0];
            }
          }
        }

        // Deduplication: normalized_name + address
        const normName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
        const normAddress = addressVal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
        normalizedKey = `${normName}_${normAddress}`;

        if (capturedKeys.has(normalizedKey)) {
          console.log(`[LeadServices] Skipping duplicate: "${name}" at "${addressVal}"`);
          
          if (isDebug) {
            await page.evaluate(({ href, color }) => {
              const anchor = document.querySelector(`a[href="${href}"]`);
              const container = (anchor?.closest('div[role="article"]') || anchor?.parentElement) as any;
              if (container) {
                container.style.border = `3px solid ${color}`;
                container.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
              }
            }, { href, color: 'yellow' });
          }
          continue;
        }

        capturedKeys.add(normalizedKey);

        // Click card to load detail panel for full details
        await card.click();
        await page.waitForTimeout(1500);

        let phone: string | null = null;
        try {
          const phoneEl = await page.$('[data-tooltip="Copy phone number"], [aria-label*="Phone"]');
          if (phoneEl) phone = await phoneEl.getAttribute('data-value') || await phoneEl.innerText();
        } catch {}

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

        let fullAddress: string | null = addressVal || null;
        try {
          const addrEl = await page.$('[data-tooltip="Copy address"]');
          if (addrEl) fullAddress = await addrEl.getAttribute('data-value') || await addrEl.innerText();
        } catch {}

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

        let parsedCategory: string | null = null;
        try {
          const catEl = await page.$('button[jsaction*="category"]');
          if (catEl) parsedCategory = await catEl.innerText();
        } catch {}

        let email: string | null = null;
        if (website) {
          email = await scrapeEmailFromWebsite(website);
        }

        if (onlyEmail && !email) {
          if (isDebug) {
            await page.evaluate(({ href, color }) => {
              const anchor = document.querySelector(`a[href="${href}"]`);
              const container = (anchor?.closest('div[role="article"]') || anchor?.parentElement) as any;
              if (container) {
                container.style.border = `3px solid ${color}`;
                container.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
              }
            }, { href, color: 'yellow' });
          }
          continue;
        }

        const lead = {
          name,
          phone: phone ? phone.trim() : null,
          address: fullAddress ? fullAddress.trim() : null,
          website: website || null,
          email,
          category: parsedCategory || categoryVal || category,
          lat: latVal,
          lng: lngVal,
          maps_url: href || null,
          rating,
          reviews_count: reviewsCount,
        };

        const saved = await onProgress(savedCount + 1, lead);
        if (saved) {
          savedCount++;
          
          if (isDebug) {
            await page.evaluate(({ href, color }) => {
              const anchor = document.querySelector(`a[href="${href}"]`);
              const container = (anchor?.closest('div[role="article"]') || anchor?.parentElement) as any;
              if (container) {
                container.style.border = `3px solid ${color}`;
                container.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
              }
            }, { href, color: 'green' });
          }
        } else {
          if (isDebug) {
            await page.evaluate(({ href, color }) => {
              const anchor = document.querySelector(`a[href="${href}"]`);
              const container = (anchor?.closest('div[role="article"]') || anchor?.parentElement) as any;
              if (container) {
                container.style.border = `3px solid ${color}`;
                container.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
              }
            }, { href, color: 'yellow' });
          }
        }
        await page.waitForTimeout(100);
      } catch (cardErr) {
        console.error(`[LeadServices] Error processing company card ${i + 1}:`, cardErr);
        
        if (isDebug && href) {
          await page.evaluate(({ href, color }) => {
            const anchor = document.querySelector(`a[href="${href}"]`);
            const container = (anchor?.closest('div[role="article"]') || anchor?.parentElement) as any;
            if (container) {
              container.style.border = `3px solid ${color}`;
              container.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            }
          }, { href, color: 'red' });
        }
      }
    }

    // Final audit matching Place IDs in final HTML content to catch any last markers
    try {
      const content = await page.content();
      const matches = content.match(/ChIJ[a-zA-Z0-9_-]{19,30}/g) || [];
      for (const m of matches) {
        apiPlaceIds.add(m);
      }
    } catch {}

    const visibleMarkersEstimate = apiPlaceIds.size;
    const missedCount = Math.max(0, sidebarCardsCount - savedCount);

    console.log('\nVISIBLE_MARKERS_ESTIMATE:', visibleMarkersEstimate);
    console.log('SIDEBAR_CARDS:', sidebarCardsCount);
    console.log('EXTRACTED:', savedCount);
    console.log('MISSED:', missedCount);
    console.log('');

  } finally {
    await browser.close();
  }
}

/**
 * Capture Professional Leads using public LinkedIn profiles indexed on Google Search
 */
export async function captureProfessionalLeads(
  jobId: string,
  role: string,
  location: string | null,
  keywords: string | null,
  limitCount: number,
  onProgress: (count: number, lead: any) => Promise<boolean>
): Promise<void> {
  console.log(`SEARCH_STARTED

INPUT_KEYWORDS: ${keywords || role || ''}
INPUT_REGION: ${location || ''}
INPUT_RADIUS: null
ENTITY_TYPE: professional`);

  const precision = keywords || 'city';
  const regionMode = precision === 'state' ? 'State' : precision === 'country' ? 'Country' : 'City';
  const queryLocation = location || '';
  const searchQuery = `site:linkedin.com/in/ "${role}" "${queryLocation}"`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

  let sysTimezone = 'UTC';
  let sysLocale = 'en-US';
  try {
    sysTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {}

  console.log(`FINAL_QUERY: ${searchQuery}
LANGUAGE: ${process.env.LANG || 'pt-BR'}
TIMEZONE: ${sysTimezone}
LOCALE: ${sysLocale}`);

  console.log(`FINAL_SEARCH_QUERY: ${searchQuery}`);
  console.log(`REGION_MODE: ${regionMode}`);

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'pt-BR,pt;q=0.9,en-US;q=0.8',
  });
  const page = await context.newPage();

  let savedCount = 0;
  let parsedLeads: any[] = [];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if Google blocked us
    const content = await page.content();
    const isGoogleBlocked = content.includes('did not match any documents') || content.includes('g-recaptcha') || content.includes('captcha') || content.includes('Unusual traffic');
    
    if (!isGoogleBlocked) {
      // Parse Google results
      const resultElements = await page.$$('div.g');
      const rawResults: { title: string; url: string; elementHtml: string }[] = [];
      for (let idx = 0; idx < Math.min(resultElements.length, 3); idx++) {
        try {
          const titleEl = await resultElements[idx].$('h3');
          const linkEl = await resultElements[idx].$('a');
          if (titleEl && linkEl) {
            const title = await titleEl.innerText();
            const url = await linkEl.getAttribute('href') || '';
            const elementHtml = await page.evaluate(el => el.outerHTML, resultElements[idx]);
            rawResults.push({ title, url, elementHtml });
          }
        } catch {}
      }

      console.log(`RAW_RESULTS_COUNT: ${resultElements.length}

RAW_RESULT_1: ${rawResults[0] ? `${rawResults[0].title} - ${rawResults[0].url}` : ''}
RAW_RESULT_2: ${rawResults[1] ? `${rawResults[1].title} - ${rawResults[1].url}` : ''}
RAW_RESULT_3: ${rawResults[2] ? `${rawResults[2].title} - ${rawResults[2].url}` : ''}`);

      const jobsToProcess = resultElements.map(async (element) => {
        try {
          const titleEl = await element.$('h3');
          const linkEl = await element.$('a');
          if (titleEl && linkEl) {
            const rawTitle = await titleEl.innerText();
            const profileUrl = await linkEl.getAttribute('href') || '';
            const elementHtml = await page.evaluate(el => el.outerHTML, element);

            if (profileUrl.includes('linkedin.com/in/')) {
              const titleParts = rawTitle.split(/[-|]/).map(p => p.trim());
              const displayName = titleParts[0] || 'Profissional';
              if (displayName.toLowerCase().includes('perfil') || displayName.toLowerCase().includes('profiles')) return null;

              const professionalRole = titleParts[1] || role;
              const industry = titleParts[2] || role;

              return {
                display_name: displayName,
                professional_role: professionalRole,
                industry: industry,
                location: location || 'Remoto',
                profile_url: profileUrl,
                contact_channel: profileUrl,
                raw_title: rawTitle,
                element_html: elementHtml,
              };
            }
          }
        } catch {}
        return null;
      });

      const processedResults = await Promise.all(jobsToProcess);
      parsedLeads = processedResults.filter(Boolean) as any[];
    }

    // Fallback 1: Try Bing Search
    if (parsedLeads.length === 0) {
      console.log('[LeadServices] Google search blocked or empty. Trying Bing Search...');
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`;
      await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      const bingResults = await page.$$('li.b_algo');
      const rawResults: { title: string; url: string; elementHtml: string }[] = [];
      for (let idx = 0; idx < Math.min(bingResults.length, 3); idx++) {
        try {
          const linkEl = await bingResults[idx].$('h2 a');
          if (linkEl) {
            const title = await linkEl.innerText();
            const url = await linkEl.getAttribute('href') || '';
            const elementHtml = await page.evaluate(el => el.outerHTML, bingResults[idx]);
            rawResults.push({ title, url, elementHtml });
          }
        } catch {}
      }

      console.log(`RAW_RESULTS_COUNT: ${bingResults.length}

RAW_RESULT_1: ${rawResults[0] ? `${rawResults[0].title} - ${rawResults[0].url}` : ''}
RAW_RESULT_2: ${rawResults[1] ? `${rawResults[1].title} - ${rawResults[1].url}` : ''}
RAW_RESULT_3: ${rawResults[2] ? `${rawResults[2].title} - ${rawResults[2].url}` : ''}`);

      const jobsToProcess = bingResults.map(async (element) => {
        try {
          const linkEl = await element.$('h2 a');
          if (linkEl) {
            const profileUrl = await linkEl.getAttribute('href') || '';
            const rawTitle = await linkEl.innerText();
            const elementHtml = await page.evaluate(el => el.outerHTML, element);

            if (profileUrl.includes('linkedin.com/in/')) {
              const titleParts = rawTitle.split(/[-|]/).map(p => p.trim());
              const displayName = titleParts[0] || 'Profissional';
              if (displayName.toLowerCase().includes('perfil') || displayName.toLowerCase().includes('profiles')) return null;

              const professionalRole = titleParts[1] || role;
              const industry = titleParts[2] || role;

              return {
                display_name: displayName,
                professional_role: professionalRole,
                industry: industry,
                location: location || 'Remoto',
                profile_url: profileUrl,
                contact_channel: profileUrl,
                raw_title: rawTitle,
                element_html: elementHtml,
              };
            }
          }
        } catch {}
        return null;
      });

      const processedResults = await Promise.all(jobsToProcess);
      parsedLeads = processedResults.filter(Boolean) as any[];
    }

    // Fallback 2: Try Gibiru Search
    if (parsedLeads.length === 0) {
      console.log('[LeadServices] Bing search empty. Trying Gibiru Search...');
      const gibiruUrl = `https://gibiru.com/results.html?q=${encodeURIComponent(searchQuery)}`;
      await page.goto(gibiruUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);

      const links = await page.$$('a');
      const uniqueUrls = new Set<string>();
      const rawResults: { title: string; url: string; elementHtml: string }[] = [];

      for (const link of links) {
        try {
          const href = await link.getAttribute('href') || '';
          if (href.includes('linkedin.com/in/') && !uniqueUrls.has(href)) {
            uniqueUrls.add(href);
            const title = await link.innerText();
            const elementHtml = await page.evaluate(el => el.outerHTML, link);
            rawResults.push({ title, url: href, elementHtml });
          }
        } catch {}
      }

      console.log(`RAW_RESULTS_COUNT: ${rawResults.length}

RAW_RESULT_1: ${rawResults[0] ? `${rawResults[0].title} - ${rawResults[0].url}` : ''}
RAW_RESULT_2: ${rawResults[1] ? `${rawResults[1].title} - ${rawResults[1].url}` : ''}
RAW_RESULT_3: ${rawResults[2] ? `${rawResults[2].title} - ${rawResults[2].url}` : ''}`);

      const jobsToProcess = rawResults.map(async (res) => {
        try {
          const profileUrl = res.url;
          const rawTitle = res.title;
          const elementHtml = res.elementHtml;

          const titleParts = rawTitle.split(/[-|]/).map(p => p.trim());
          const displayName = titleParts[0] || 'Profissional';
          if (displayName.toLowerCase().includes('perfil') || displayName.toLowerCase().includes('profiles')) return null;

          const professionalRole = titleParts[1] || role;
          const industry = titleParts[2] || role;

          return {
            display_name: displayName,
            professional_role: professionalRole,
            industry: industry,
            location: location || 'Remoto',
            profile_url: profileUrl,
            contact_channel: profileUrl,
            raw_title: rawTitle,
            element_html: elementHtml,
          };
        } catch {}
        return null;
      });

      const processedResults = await Promise.all(jobsToProcess);
      parsedLeads = processedResults.filter(Boolean) as any[];
    }

    // Process and save leads
    for (const lead of parsedLeads) {
      if (savedCount >= limitCount) break;

      // Etapa 1: Auditar origem
      console.log(`RAW_ELEMENT_HTML: ${lead.element_html || ''}`);
      console.log(`RAW_HREF: ${lead.profile_url}`);
      console.log(`DISPLAY_NAME: ${lead.display_name}`);
      console.log(`PROFILE_URL_GENERATED: ${lead.profile_url}`);

      // Etapa 2 & 3: Filtrar rotas inválidas
      if (!isValidProfileUrl(lead.profile_url)) {
        console.log(`PROFILE_FOUND
NAME: ${lead.display_name}
RAW_HREF: ${lead.profile_url}
FINAL_URL: ${lead.profile_url}`);
        console.log(`DISCARD_RECORD: ${lead.profile_url} (Reason: Invalid route or not absolute URL)`);
        continue;
      }

      // Etapa 4: Resolver redirecionamento
      let finalUrl = lead.profile_url;
      let status = 200;
      let resolvedTitle = lead.raw_title || '';
      const checkPage = await context.newPage();
      try {
        const response = await checkPage.goto(lead.profile_url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        finalUrl = checkPage.url();
        status = response ? response.status() : 200;
        const pageTitle = await checkPage.title();
        if (pageTitle && pageTitle.trim() !== '' && !pageTitle.toLowerCase().includes('log in') && !pageTitle.toLowerCase().includes('sign up') && !pageTitle.toLowerCase().includes('checkpoint')) {
          resolvedTitle = pageTitle;
        }
      } catch (err) {
        status = 999; // Fallback rate limit status
      } finally {
        await checkPage.close();
      }

      console.log(`PROFILE_URL_FINAL: ${finalUrl}`);

      console.log(`PROFILE_FOUND
NAME: ${lead.display_name}
RAW_HREF: ${lead.profile_url}
FINAL_URL: ${finalUrl}`);

      console.log(`URL_RESOLVED
INPUT: ${lead.profile_url}
FINAL: ${finalUrl}
STATUS: ${status}`);

      // Etapa 5: Validar antes de persistir
      const finalUrlLower = finalUrl.toLowerCase();
      const isRedirectToSearch = finalUrlLower.includes('/search') || finalUrlLower.includes('/dir');
      const isRedirectToLogin = finalUrlLower.includes('/login') || finalUrlLower.includes('/checkpoint/') || finalUrlLower.includes('/signup') || finalUrlLower.includes('/uas/');
      const isRedirectToError = finalUrlLower.includes('/error') || finalUrlLower.includes('/unavailable') || status === 404 || (status >= 500 && status !== 999);

      if (status === 404 || isRedirectToSearch || isRedirectToLogin || isRedirectToError) {
        console.log(`DISCARD_RECORD: ${lead.profile_url} (Reason: Redirect or status check failed)`);
        continue;
      }

      // Validar região
      const detectedRegion = extractDetectedRegion(resolvedTitle || lead.raw_title || lead.display_name, finalUrl);
      const expectedRegion = location || 'Remoto';
      const regionCheck = calculateRegionMatch(detectedRegion, expectedRegion);

      console.log(`DETECTED_REGION: ${detectedRegion}
EXPECTED_REGION: ${expectedRegion}
MATCH_SCORE: ${regionCheck.score}`);

      if (!regionCheck.compatible) {
        console.log(`DISCARD_RECORD: ${lead.profile_url} (Reason: Incompatible region detected: ${detectedRegion})`);
        continue;
      }

      // Additional Stage 5 quality check: check if display name is valid/non-empty
      if (!lead.display_name || lead.display_name.trim() === '' || lead.display_name.toLowerCase() === 'profissional') {
        console.log(`DISCARD_RECORD: ${lead.profile_url} (Reason: Empty or placeholder display name)`);
        continue;
      }

      const scoreInfo = calculateProfessionalScore(lead);
      const finalLead = {
        ...lead,
        location: detectedRegion, // Save the actual detected region/location
        country: extractCountry(detectedRegion, finalUrl), // Add country for Stage 4 logs
        professional_score: scoreInfo.professional_score,
        lead_grade: scoreInfo.lead_grade,
        profile_url: finalUrl, // Save resolved URL
        raw_href: lead.profile_url, // Original raw href
        http_status: status, // Final HTTP status resolved
      };

      const saved = await onProgress(savedCount + 1, finalLead);
      if (saved) savedCount++;
    }
  } catch (err) {
    console.error('[LeadServices] Playwright scraping error:', err);
  } finally {
    await browser.close();
  }
}

export function isValidProfileUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const isAbsolute = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const urlLower = urlStr.toLowerCase();
    
    const isInvalidRoute = 
      urlLower.includes('/pub/') || 
      urlLower.includes('/dir/') || 
      urlLower.includes('/search/') ||
      urlLower.includes('/results/') ||
      urlLower.includes('/company/') ||
      urlLower.includes('/feed/');

    const isIndividual = urlLower.includes('/in/');
    return isAbsolute && isIndividual && !isInvalidRoute;
  } catch {
    return false;
  }
}

export function extractDetectedRegion(rawTitle: string, url: string): string {
  let urlCountry = '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www') {
      const cc = parts[0].toLowerCase();
      if (cc === 'br') urlCountry = 'Brazil';
      else if (cc === 'us') urlCountry = 'United States';
      else if (cc === 'uk') urlCountry = 'United Kingdom';
      else if (cc === 'ca') urlCountry = 'Canada';
      else if (cc === 'fr') urlCountry = 'France';
      else if (cc === 'es') urlCountry = 'Spain';
      else if (cc === 'pt') urlCountry = 'Portugal';
    }
  } catch {}

  const titleParts = rawTitle.split(/[-|]/).map(p => p.trim());
  let locationPart = '';
  if (titleParts.length >= 3) {
    const cleanParts = titleParts.filter(p => !p.toLowerCase().includes('linkedin') && p !== titleParts[0]);
    if (cleanParts.length >= 2) {
      locationPart = cleanParts[cleanParts.length - 1];
    } else if (cleanParts.length === 1) {
      locationPart = cleanParts[0];
    }
  }

  let detected = locationPart || 'Remoto';
  if (urlCountry && !detected.toLowerCase().includes(urlCountry.toLowerCase())) {
    detected = `${detected}, ${urlCountry}`;
  }
  return detected;
}

export function calculateRegionMatch(detected: string, expected: string): { score: number; compatible: boolean } {
  const normDetected = detected.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normExpected = expected.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!expected || normExpected.includes('remoto') || normExpected === '') {
    return { score: 100, compatible: true };
  }

  const expectedIsUS = normExpected.includes('usa') || normExpected.includes('united states') || normExpected.includes(' u.s.') || normExpected.endsWith(' us') || normExpected.includes('america') || normExpected.includes('florida') || normExpected.includes('california') || normExpected.includes('miami') || normExpected.includes('san francisco');
  const detectedIsBrazil = normDetected.includes('brasil') || normDetected.includes('brazil') || normDetected.includes('sao paulo') || normDetected.includes('rio de janeiro');

  if (expectedIsUS && detectedIsBrazil) {
    return { score: 0, compatible: false };
  }

  const expectedIsBrazil = normExpected.includes('brasil') || normExpected.includes('brazil');
  const detectedIsUS = normDetected.includes('usa') || normDetected.includes('united states') || normDetected.includes('miami') || normDetected.includes('florida') || normDetected.includes('california') || normDetected.includes('san francisco');

  if (expectedIsBrazil && detectedIsUS) {
    return { score: 0, compatible: false };
  }

  const stopWords = new Set(['and', 'or', 'the', 'in', 'of', 'at', 'de', 'do', 'da', 'e', 'o', 'a', 'area', 'region', 'greater']);
  const getTokens = (str: string) => {
    return str.split(/[\s,./|-]+/)
      .map(t => t.trim())
      .filter(t => t.length > 1 && !stopWords.has(t));
  };

  const stateMap: Record<string, string> = {
    al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
    co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
    hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
    ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
    ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
    mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
    nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina',
    nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
    ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee',
    tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
    wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming'
  };

  const expectedTokens = getTokens(normExpected);
  const detectedTokens = getTokens(normDetected);

  if (expectedTokens.length === 0) {
    return { score: 100, compatible: true };
  }

  const expandTokens = (tokens: string[]) => {
    const expanded = new Set<string>();
    for (const t of tokens) {
      expanded.add(t);
      if (stateMap[t]) {
        expanded.add(stateMap[t]);
      }
    }
    return expanded;
  };

  const expectedSet = expandTokens(expectedTokens);
  const detectedSet = expandTokens(detectedTokens);

  let matchCount = 0;
  for (const t of detectedSet) {
    if (expectedSet.has(t)) {
      matchCount++;
    }
  }

  const score = Math.round((matchCount / expectedTokens.length) * 100);
  let compatible = matchCount > 0 || score >= 30;

  if (!compatible) {
    const expectedLower = normExpected.toLowerCase();
    const detectedLower = normDetected.toLowerCase();
    const knownGeographies = [
      'brazil', 'brasil', 'sao paulo', 'rio de janeiro', 'belo horizonte', 'porto alegre', 'curitiba', 
      'salvador', 'recife', 'fortaleza', 'brasilia', 'london', 'paris', 'madrid', 'lisbon',
      'united kingdom', 'canada', 'france', 'spain', 'portugal', 'italy', 'germany', 'mexico', 'india',
      'miami', 'new york', 'boston', 'chicago', 'los angeles', 'seattle', 'austin', 'houston', 
      'dallas', 'denver', 'atlanta', 'detroit', 'phoenix', 'philadelphia', 'portland', 'san francisco'
    ];
    const allStates = Object.values(stateMap);
    const stateKeys = Object.keys(stateMap);

    let hasOtherGeography = false;
    for (const geo of knownGeographies) {
      if (detectedLower.includes(geo) && !expectedLower.includes(geo)) {
        hasOtherGeography = true;
        break;
      }
    }

    if (!hasOtherGeography) {
      for (const stateName of allStates) {
        if (detectedLower.includes(stateName) && !expectedLower.includes(stateName)) {
          hasOtherGeography = true;
          break;
        }
      }
    }

    if (!hasOtherGeography) {
      const tokens = detectedLower.split(/[\s,./|-]+/);
      for (const stateAbbr of stateKeys) {
        if (tokens.includes(stateAbbr) && !expectedLower.includes(stateAbbr)) {
          hasOtherGeography = true;
          break;
        }
      }
    }

    if (!hasOtherGeography) {
      compatible = true;
    }
  }

  return { score, compatible };
}

export function extractCountry(location: string, url: string): string {
  const loc = location.toLowerCase();
  if (loc.includes('usa') || loc.includes('united states') || loc.includes('miami') || loc.includes('california') || loc.includes('florida') || loc.includes('san francisco')) {
    return 'USA';
  }
  if (loc.includes('brasil') || loc.includes('brazil') || loc.includes('sao paulo') || loc.includes('rio de janeiro')) {
    return 'Brazil';
  }

  try {
    const host = new URL(url).hostname;
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www') {
      const cc = parts[0].toLowerCase();
      if (cc === 'br') return 'Brazil';
      if (cc === 'us') return 'USA';
      if (cc === 'uk') return 'United Kingdom';
      if (cc === 'ca') return 'Canada';
      if (cc === 'fr') return 'France';
      if (cc === 'es') return 'Spain';
      if (cc === 'pt') return 'Portugal';
    }
  } catch {}

  const parts = location.split(',');
  if (parts.length > 0) {
    return parts[parts.length - 1].trim();
  }
  return 'Unknown';
}

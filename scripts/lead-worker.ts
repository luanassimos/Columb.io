import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { calculateLeadScore } from '../lib/lead-scoring';

// 1. Manually load environment variables from .env.local
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log(`[Worker] Carregando variáveis de ambiente de: ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  } else {
    console.warn('[Worker] Arquivo .env.local não encontrado no diretório atual.');
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Worker] Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
  process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws as any,
  },
});

console.log('WORKER_LEADS_STARTED');

async function scrapeEmailFromWebsite(url: string): Promise<string | null> {
  if (!url) return null;
  
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
  
  const cleanEmail = (email: string): boolean => {
    const lower = email.toLowerCase();
    return !(
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.css') ||
      lower.endsWith('.js') ||
      lower.includes('sentry') ||
      lower.includes('bootstrap') ||
      lower.includes('jquery') ||
      lower.includes('wix') ||
      lower.includes('wordpress') ||
      lower.includes('domain') ||
      lower.includes('example') ||
      lower.includes('test')
    );
  };

  const fetchHtml = async (targetUrl: string): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout
      
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });
      clearTimeout(id);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  };

  let targetUrl = url.trim();
  if (targetUrl.includes('google.com/url?')) {
    try {
      const urlObj = new URL(targetUrl);
      const qParam = urlObj.searchParams.get('q');
      if (qParam) targetUrl = qParam;
    } catch {}
  }
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  // 1. Scrape Homepage
  const homepageHtml = await fetchHtml(targetUrl);
  if (!homepageHtml) return null;

  const homeMatches = homepageHtml.match(emailRegex);
  if (homeMatches) {
    const valid = homeMatches.filter(cleanEmail);
    if (valid.length > 0) return valid[0].toLowerCase();
  }

  // 2. Look for Contact/About pages in the HTML links
  try {
    const linkRegex = /href=["']([^"']*(?:contato|contacto|contact|about|sobre|fale|atendimento)[^"']*)["']/gi;
    const contactLinks: string[] = [];
    let match;
    while ((match = linkRegex.exec(homepageHtml)) !== null) {
      let link = match[1];
      if (link.startsWith('/') && !link.startsWith('//')) {
        try {
          const parsedBase = new URL(targetUrl);
          link = `${parsedBase.origin}${link}`;
        } catch {
          continue;
        }
      } else if (!link.startsWith('http')) {
        continue;
      }
      if (!contactLinks.includes(link)) {
        contactLinks.push(link);
      }
      if (contactLinks.length >= 3) break;
    }

    for (const contactUrl of contactLinks) {
      const pageHtml = await fetchHtml(contactUrl);
      if (pageHtml) {
        const pageMatches = pageHtml.match(emailRegex);
        if (pageMatches) {
          const valid = pageMatches.filter(cleanEmail);
          if (valid.length > 0) return valid[0].toLowerCase();
        }
      }
    }
  } catch {
    // Ignore crawling errors
  }

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
      const radiusKm = radius / 1000;
      if (radiusKm <= 1.5) zoom = 15;
      else if (radiusKm <= 3.5) zoom = 14;
      else if (radiusKm <= 7.5) zoom = 13;
      else if (radiusKm <= 15) zoom = 12;
      else zoom = 11;
    }
    console.log(`[Scraper] [Rápido] Iniciando Playwright para "${category}" em Geo: ${lat}, ${lng} (raio: ${radius ? radius / 1000 : '?'}km, zoom: ${zoom}, limite: ${limitCount})...`);
    const searchQuery = encodeURIComponent(category);
    url = `https://www.google.com/maps/search/${searchQuery}/@${lat},${lng},${zoom}z`;
  } else {
    console.log(`[Scraper] [Rápido] Iniciando Playwright para "${category}" em "${region || ''}" (limite: ${limitCount})...`);
    const searchQuery = encodeURIComponent(`${category} ${region || ''}`);
    url = `https://www.google.com/maps/search/${searchQuery}`;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Set viewport size
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('[Scraper] Página do Google Maps carregada. Rolando feed rápido...');

  const feedSelector = 'div[role="feed"]';
  let currentCount = 0;
  let previousCount = -1;
  let scrollAttempts = 0;
  const maxScrollAttempts = 40;

  // Wait for the feed or any place card to load
  try {
    await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
  } catch (e) {
    console.log('[Scraper] Nenhum resultado encontrado ou timeout ao carregar os cards inicialmente.');
    await browser.close();
    return;
  }

  // Scroll to load enough cards (1s delay for high speed)
  // We load limitCount * 3 cards only if onlyEmail is active to have a solid pool, else just limitCount
  const targetCardsToLoad = onlyEmail ? Math.min(limitCount * 3, 150) : limitCount;
  while (currentCount < targetCardsToLoad && scrollAttempts < maxScrollAttempts) {
    const cards = page.locator('a[href*="/maps/place/"]');
    currentCount = await cards.count();
    console.log(`[Scraper] Cards carregados: ${currentCount} / ${targetCardsToLoad} (Tentativa de scroll: ${scrollAttempts})`);

    if (currentCount >= targetCardsToLoad || currentCount === previousCount) {
      break;
    }

    previousCount = currentCount;
    try {
      const feed = page.locator('div[role="feed"]');
      if (await feed.count() > 0) {
        await feed.first().evaluate((el) => {
          el.scrollTo(0, el.scrollHeight);
        });
      } else {
        const cards = page.locator('a[href*="/maps/place/"]');
        const cardsCount = await cards.count();
        if (cardsCount > 0) {
          await cards.last().scrollIntoViewIfNeeded();
        } else {
          await page.keyboard.press('PageDown');
        }
      }
    } catch (scrollErr) {
      console.warn('[Scraper] Erro ao rolar página:', scrollErr);
    }
    await page.waitForTimeout(2000); // 2s wait is much safer for Google Maps network lazy loading
    scrollAttempts++;
  }

  const cardsLocator = page.locator('a[href*="/maps/place/"]');
  const totalAvailable = await cardsLocator.count();
  console.log(`[Scraper] Iniciando extração rápida (sem clique) de até ${totalAvailable} estabelecimentos.`);

  let savedCount = 0;
  for (let i = 0; i < totalAvailable; i++) {
    if (savedCount >= limitCount) {
      console.log(`[Scraper] Limite de ${limitCount} leads com e-mail atingido. Encerrando.`);
      break;
    }
    try {
      // Check if job was cancelled
      const { data: jobStatus } = await supabase
        .from('lead_finder_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (jobStatus?.status === 'cancelled') {
        console.log(`[Scraper] Job ${jobId} cancelado pelo usuário. Parando scraping...`);
        break;
      }

      const card = cardsLocator.nth(i);
      
      // Ensure the card is scrolled into view (fast, non-blocking)
      await card.scrollIntoViewIfNeeded();

      // Extract place coordinates directly from the link's href
      const href = await card.getAttribute('href');
      let leadLat: number | null = null;
      let leadLng: number | null = null;
      if (href) {
        const match = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
          leadLat = parseFloat(match[1]);
          leadLng = parseFloat(match[2]);
        }
      }

      // 1. Extract name
      let name = (await card.getAttribute('aria-label'))?.trim() || '';
      let container = card.locator('xpath=ancestor::div[contains(@class, "Nv2y1d") or contains(@class, "UaQhfb") or contains(@class, "bfka5c")][1]');
      if (await container.count() === 0) {
        container = card.locator('xpath=../..');
      }
      if (await container.count() === 0) {
        container = card;
      }
      
      if (!name) {
        name = (await container.locator('.qbfVoi, .fontHeadlineSmall, .fontBodyMedium').first().innerText().catch(() => '')) || '';
        name = name.trim();
      }
      if (!name) {
        name = `Empresa ${i + 1}`;
      }

      // 2. Extract Website
      let phone: string | null = null;
      let website: string | null = null;
      let address: string | null = null;
      let parsedCategory: string | null = null;
      let rating: number | null = null;
      let reviewsCount: number | null = null;

      // 1. Try to click the card to load detail panel on the right side
      try {
        await card.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await card.click({ force: true });
        // Dynamically wait for detail panel to appear (title heading or address button)
        await page.waitForSelector('h1.DUwDvf, button[data-item-id="address"]', { timeout: 4000 }).catch(() => {});
      } catch (clickErr) {
        console.warn(`[Scraper] Erro ao clicar no card ${i + 1}:`, clickErr);
      }

      // 2. Try to extract phone, website, address, rating and reviews from the right-side detail panel using multiple selectors
      try {
        const phoneButton = page.locator('button[data-item-id^="phone:tel:"], [data-tooltip="Copiar número de telefone"], button[aria-label^="Telefone:"]');
        if (await phoneButton.count() > 0) {
          const rawPhone = await phoneButton.first().getAttribute('data-item-id') || await phoneButton.first().getAttribute('aria-label');
          if (rawPhone) {
            phone = rawPhone.replace('phone:tel:', '').replace('Telefone: ', '').trim();
          } else {
            const textPhone = await phoneButton.first().innerText();
            if (textPhone) phone = textPhone.trim();
          }
        }

        const webLink = page.locator('a[data-item-id="authority"], a[aria-label^="Website:"]');
        if (await webLink.count() > 0) {
          const hrefAttr = await webLink.first().getAttribute('href');
          if (hrefAttr) {
            website = hrefAttr;
          }
        }

        const addressButton = page.locator('button[data-item-id="address"], button[aria-label^="Endereço:"]');
        if (await addressButton.count() > 0) {
          const addressTxt = await addressButton.first().innerText();
          if (addressTxt && addressTxt.trim()) {
            address = addressTxt.trim();
          }
        }

        const ratingContainer = page.locator('div.F7nice');
        if (await ratingContainer.count() > 0) {
          const text = await ratingContainer.first().innerText();
          const match = text.match(/([345][.,]\d)\s*(?:\(([\d.,kK]+)\))?/);
          if (match) {
            rating = parseFloat(match[1].replace(',', '.'));
            if (match[2]) {
              const rawReviews = match[2];
              if (rawReviews.toLowerCase().includes('k')) {
                reviewsCount = Math.round(parseFloat(rawReviews.toLowerCase().replace('k', '').replace(',', '.')) * 1000);
              } else {
                reviewsCount = parseInt(rawReviews.replace(/\D/g, ''), 10);
              }
            }
          }
        }
      } catch (panelErr) {
        console.warn('[Scraper] Erro ao extrair dados do painel de detalhes:', panelErr);
      }

      // 3. Fallback: Parse card container text lines if any detail is still missing
      if (!website || !phone || !address) {
        try {
          if (!website) {
            const webLinkCard = container.locator('a[aria-label*="Website"], a[aria-label*="website"], a[data-value="Website"], a[href^="http"]:not([href*="google.com"])').first();
            if (await webLinkCard.count() > 0) {
              website = await webLinkCard.getAttribute('href');
            }
          }

          const lines: string[] = [];
          
          // Add structured text lines from class W4Efsd first
          const detailLocators = container.locator('.W4Efsd');
          const detailCount = await detailLocators.count();
          for (let j = 0; j < detailCount; j++) {
            const txt = await detailLocators.nth(j).innerText().catch(() => '');
            if (txt.trim()) lines.push(txt.trim());
          }
          
          // Add all text content from container as fallback lines
          const cardText = await container.innerText().catch(() => '');
          cardText.split('\n').forEach(l => {
            const trimmed = l.trim();
            if (trimmed && !lines.includes(trimmed)) {
              lines.push(trimmed);
            }
          });

          const extractPhone = (str: string): string | null => {
            const phoneRegex = /(?:\+?[\d\s-()]{8,18})/g;
            const matches = str.match(phoneRegex);
            if (matches) {
              for (const match of matches) {
                const clean = match.replace(/\D/g, '');
                if (clean.length >= 8 && clean.length <= 15) {
                  if (/^\d{5}-\d{3}$/.test(match.trim())) {
                    continue; // Skip postal codes
                  }
                  return match.trim();
                }
              }
            }
            return null;
          };

          const isRating = (str: string) => {
            return /^[345][.,]\d\s*\(\d+\)$/.test(str) || /^[345][.,]\d$/.test(str) || (str.includes('(') && str.includes(')'));
          };

          const isAddress = (str: string) => {
            const keywords = ['av', 'rua', 'r.', 'alameda', 'al.', 'rodovia', 'rod.', 'estrada', 'estr.', 'travessa', 'trv.', 'praça', 'prc.', 'avenida', 'bloco', 'nº', 'sala', 'andar', 'centro', 'bairro', 'cep', 'rj', 'sp', 'mg', 'rs', 'sc', 'pr', 'ba', 'pe', 'ce', 'df', 'go'];
            const lower = str.toLowerCase();
            const hasKeyword = keywords.some(k => lower.includes(k) || lower.split(/\s+/).includes(k));
            const hasComma = str.includes(',');
            return (hasKeyword || hasComma) && str.length > 8 && !extractPhone(str) && !isRating(str);
          };

          const isCategory = (str: string) => {
            if (str.length > 40) return false;
            if (/\d/.test(str)) return false;
            const lowercase = str.toLowerCase();
            const excludes = ['aberto', 'fechado', 'fecha às', 'abre às', 'fechado temporariamente', 'atendimento', 'online', 'no local', 'website', 'direções', 'salvar', 'ligar', 'compartilhar', 'delivery', 'retirada'];
            if (excludes.some(e => lowercase.includes(e))) return false;
            return true;
          };

          const uniqueLines = lines.filter(line => line !== name);

          for (const line of uniqueLines) {
            const foundPhone = extractPhone(line);
            if (foundPhone && !phone) {
              phone = foundPhone;
            }

            if (line.includes('·')) {
              const parts = line.split('·').map(p => p.trim());
              for (const part of parts) {
                const partPhone = extractPhone(part);
                if (partPhone && !phone) {
                  phone = partPhone;
                } else if (isRating(part)) {
                  const match = part.match(/([345][.,]\d)\s*(?:\(([\d.,kK]+)\))?/);
                  if (match) {
                    rating = parseFloat(match[1].replace(',', '.'));
                    if (match[2]) {
                      const rawRevs = match[2];
                      if (rawRevs.toLowerCase().includes('k')) {
                        reviewsCount = Math.round(parseFloat(rawRevs.toLowerCase().replace('k', '').replace(',', '.')) * 1000);
                      } else {
                        reviewsCount = parseInt(rawRevs.replace(/\D/g, ''), 10);
                      }
                    }
                  }
                } else if (isAddress(part) && !address) {
                  address = part;
                } else if (isCategory(part) && !parsedCategory) {
                  parsedCategory = part;
                }
              }
            } else {
              if (isRating(line)) {
                const match = line.match(/([345][.,]\d)\s*(?:\(([\d.,kK]+)\))?/);
                if (match) {
                  rating = parseFloat(match[1].replace(',', '.'));
                  if (match[2]) {
                    const rawRevs = match[2];
                    if (rawRevs.toLowerCase().includes('k')) {
                      reviewsCount = Math.round(parseFloat(rawRevs.toLowerCase().replace('k', '').replace(',', '.')) * 1000);
                    } else {
                      reviewsCount = parseInt(rawRevs.replace(/\D/g, ''), 10);
                    }
                  }
                }
              } else if (isAddress(line) && !address) {
                address = line;
              } else if (isCategory(line) && !parsedCategory) {
                parsedCategory = line;
              }
            }
          }

          // Fallback for address
          if (!address) {
            for (const line of uniqueLines) {
              const lower = line.toLowerCase();
              const excludes = ['aberto', 'fechado', 'fecha às', 'abre às', 'estrelas', 'avaliações', 'website', 'direções', 'salvar', 'ligar', 'compartilhar', 'delivery', 'retirada', 'online', 'no local'];
              if (
                line.length > 8 &&
                !extractPhone(line) &&
                !isRating(line) &&
                !isCategory(line) &&
                !excludes.some(e => lower.includes(e))
              ) {
                address = line;
                break;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 4. Fallback search for address if not found
      if (!address) {
        address = await container.locator("[data-value], .W4Efsd").first().innerText().catch(() => null);
      }

      // Normalizing website link in case of Google redirect
      if (website && website.includes('google.com/url?')) {
        try {
          const urlObj = new URL(website);
          const qParam = urlObj.searchParams.get('q');
          if (qParam) website = qParam;
        } catch {}
      }

      // Try to scrape email from website ONLY if onlyEmail option is enabled
      let email: string | null = null;
      if (onlyEmail && website) {
        console.log(`[Scraper] [E-mail] Buscando e-mail em: ${website}`);
        email = await scrapeEmailFromWebsite(website);
        if (email) {
          console.log(`[Scraper] [E-mail] Encontrado: ${email}`);
        } else {
          console.log(`[Scraper] [E-mail] Nenhum e-mail encontrado para: ${name}`);
        }
      }

      if (onlyEmail && !email) {
        console.log(`[Scraper] [Ignorado] Negócio "${name}" ignorado por falta de e-mail de contato.`);
        continue;
      }

      const lead = {
        name,
        phone: phone || null,
        address: address || null,
        website: website || null,
        email: email,
        category: parsedCategory || category,
        lat: leadLat,
        lng: leadLng,
        maps_url: href || null,
        rating,
        reviews_count: reviewsCount,
      };

      console.log(`[Scraper] [Rápido] Extraído: "${lead.name}" | Fone: ${lead.phone || 'N/A'} | Web: ${lead.website || 'N/A'} | E-mail: ${lead.email} | Endereço: ${lead.address || 'N/A'} | Rating: ${lead.rating || 'N/A'} | Reviews: ${lead.reviews_count || 'N/A'} | Geo: ${leadLat}, ${leadLng}`);
      
      // Callback to save to DB and update progress
      const saved = await onProgress(savedCount + 1, lead);
      if (saved) {
        savedCount++;
      }
      
      // Small pause to yield loop execution
      await page.waitForTimeout(50);
    } catch (cardError) {
      console.error(`[Scraper] Erro ao extrair card ${i + 1}:`, cardError);
    }
  }

  await browser.close();
  console.log('[Scraper] Captação rápida finalizada.');
}

async function processQueue() {
  try {
    const { data: jobs, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[Worker] Erro ao buscar fila de jobs:', error);
      return;
    }

    const jobsList = jobs || [];

    if (jobsList.length === 0) {
      return; // No pending jobs
    }

    const job = jobsList[0];

    console.log("PROCESSING JOB:", job.id);
    console.log("CATEGORY:", job.category);
    console.log("LAT:", job.lat);
    console.log("LNG:", job.lng);
    console.log("RADIUS:", job.radius);

    // 2. Set job status to running
    const { error: startError } = await supabase
      .from('lead_finder_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    if (startError) {
      console.error(`[Worker] Erro ao iniciar job ${job.id}:`, startError);
      return;
    }

    // 3. Execute Scraper
    try {
      let leadsSaved = 0;
      const leadRegion = job.region || `Geo: ${Number(job.lat).toFixed(4)}, ${Number(job.lng).toFixed(4)} (${(Number(job.radius) / 1000).toFixed(0)}km)`;

      await runScraper(
        job.id,
        job.category,
        job.region,
        job.limit_count,
        job.lat,
        job.lng,
        job.radius,
        job.only_email ?? false,
        async (progress, lead) => {
          // 1. Check if lead with same name and workspace_id already exists in this workspace
          const { data: existingLeads, error: findError } = await supabase
            .from('leads')
            .select('*')
            .eq('workspace_id', job.workspace_id)
            .eq('name', lead.name)
            .limit(1);

          if (findError) {
            console.error(`[Worker] Erro ao pesquisar lead existente "${lead.name}":`, findError);
          }

          const existingLead = existingLeads && existingLeads.length > 0 ? existingLeads[0] : null;

          if (existingLead) {
            // Check if there is any new or different data
            let needsUpdate = false;
            const updatePayload: any = {};

            if (lead.phone && lead.phone !== existingLead.phone) {
              needsUpdate = true;
              updatePayload.phone = lead.phone;
            }
            if (lead.website && lead.website !== existingLead.website) {
              needsUpdate = true;
              updatePayload.website = lead.website;
            }
            if (lead.address && lead.address !== existingLead.address) {
              needsUpdate = true;
              updatePayload.address = lead.address;
            }
            if (lead.email && lead.email !== existingLead.email) {
              needsUpdate = true;
              updatePayload.email = lead.email;
            }
            if (lead.rating !== null && lead.rating !== existingLead.rating) {
              needsUpdate = true;
              updatePayload.rating = lead.rating;
            }
            if (lead.reviews_count !== null && lead.reviews_count !== existingLead.reviews_count) {
              needsUpdate = true;
              updatePayload.reviews_count = lead.reviews_count;
            }

            if (needsUpdate) {
              // Recalculate score with combined data
              const combinedLead = {
                phone: updatePayload.phone !== undefined ? updatePayload.phone : existingLead.phone,
                website: updatePayload.website !== undefined ? updatePayload.website : existingLead.website,
                address: updatePayload.address !== undefined ? updatePayload.address : existingLead.address,
                category: existingLead.category,
                rating: updatePayload.rating !== undefined ? updatePayload.rating : existingLead.rating,
                reviews_count: updatePayload.reviews_count !== undefined ? updatePayload.reviews_count : existingLead.reviews_count,
              };

              const scoreInfo = calculateLeadScore(combinedLead);
              
              updatePayload.lead_score = scoreInfo.lead_score;
              updatePayload.lead_grade = scoreInfo.lead_grade;
              updatePayload.scoring_version = 1;
              updatePayload.contact_status = 'pending'; // Re-trigger contact enrichment for updated fields

              console.log(`[Worker] Atualizando lead existente "${lead.name}" com novos dados.`);
              const { error: updateError } = await supabase
                .from('leads')
                .update(updatePayload)
                .eq('id', existingLead.id);

              if (updateError) {
                console.error(`[Worker] Erro ao atualizar lead "${lead.name}":`, updateError);
                return false;
              }
              leadsSaved++;
              return true;
            } else {
              console.log(`[Worker] Lead "${lead.name}" já existe com dados idênticos/completos. Ignorando.`);
              return true; // Avoid saving duplicates, return true so progress continues
            }
          }

          // 2. Lead does not exist, calculate score and insert new record
          const scoreInfo = calculateLeadScore({
            phone: lead.phone,
            website: lead.website,
            address: lead.address,
            category: lead.category,
            rating: lead.rating,
            reviews_count: lead.reviews_count,
          });

          const { error: leadError } = await supabase.from('leads').insert({
            workspace_id: job.workspace_id,
            job_id: job.id,
            name: lead.name,
            phone: lead.phone,
            address: lead.address,
            website: lead.website,
            category: lead.category || job.category,
            region: leadRegion,
            lat: lead.lat || null,
            lng: lead.lng || null,
            email: lead.email || null,
            maps_url: lead.maps_url || null,
            contact_status: 'pending',
            rating: lead.rating || null,
            reviews_count: lead.reviews_count || null,
            lead_score: scoreInfo.lead_score,
            lead_grade: scoreInfo.lead_grade,
            scoring_version: 1,
          });

          if (leadError) {
            console.error(`[Worker] Erro ao salvar lead "${lead.name}":`, leadError);
            return false;
          } else {
            leadsSaved++;
            
            // Update progress in job
            await supabase
              .from('lead_finder_jobs')
              .update({
                progress_count: leadsSaved,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
              
            return true;
          }
        }
      );

      // 4. Mark job as completed only if it wasn't cancelled
      const { data: finalJob } = await supabase
        .from('lead_finder_jobs')
        .select('status')
        .eq('id', job.id)
        .single();

      if (finalJob?.status !== 'cancelled') {
        await supabase
          .from('lead_finder_jobs')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        console.log(`[Worker] Job ${job.id} finalizado com sucesso! ${leadsSaved} leads capturados.`);
      } else {
        console.log(`[Worker] Job ${job.id} cancelado pelo usuário. Parando execução.`);
      }
    } catch (scrapeError: any) {
      console.error(`[Worker] Falha ao executar scraping para o job ${job.id}:`, scrapeError);
      
      // Mark job as failed
      await supabase
        .from('lead_finder_jobs')
        .update({
          status: 'failed',
          error_message: scrapeError.message || 'Erro desconhecido durante o scraping.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  } catch (globalError) {
    console.error('[Worker] Erro global no ciclo de processamento:', globalError);
  }
}

// Loop worker every 5 seconds
setInterval(processQueue, 5000);
// Run immediately on start
processQueue();

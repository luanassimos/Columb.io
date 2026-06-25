import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

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

async function runScraper(
  jobId: string,
  category: string,
  region: string | null,
  limitCount: number,
  lat: number | null,
  lng: number | null,
  radius: number | null,
  onProgress: (count: number, lead: any) => Promise<void>
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

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
  while (currentCount < limitCount && scrollAttempts < maxScrollAttempts) {
    const cards = page.locator('a[href*="/maps/place/"]');
    currentCount = await cards.count();
    console.log(`[Scraper] Cards carregados: ${currentCount} / ${limitCount} (Tentativa de scroll: ${scrollAttempts})`);

    if (currentCount >= limitCount || currentCount === previousCount) {
      break;
    }

    previousCount = currentCount;
    try {
      const cards = page.locator('a[href*="/maps/place/"]');
      const cardsCount = await cards.count();
      if (cardsCount > 0) {
        await cards.last().scrollIntoViewIfNeeded();
      } else {
        await page.keyboard.press('PageDown');
      }
    } catch (scrollErr) {
      console.warn('[Scraper] Erro ao rolar página:', scrollErr);
    }
    await page.waitForTimeout(1000);
    scrollAttempts++;
  }

  const cardsLocator = page.locator('a[href*="/maps/place/"]');
  const totalAvailable = await cardsLocator.count();
  const countToScrape = Math.min(limitCount, totalAvailable);
  console.log(`[Scraper] Iniciando extração rápida (sem clique) de ${countToScrape} estabelecimentos.`);

  for (let i = 0; i < countToScrape; i++) {
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
      let website: string | null = null;
      try {
        const webLink = container.locator('a[aria-label*="Website"], a[aria-label*="website"], a[data-value="Website"], a[href^="http"]:not([href*="google.com"])').first();
        if (await webLink.count() > 0) {
          website = await webLink.getAttribute('href');
        }
      } catch (e) {
        // ignore
      }

      // 3. Extract address, phone, and category by parsing card inner texts on Node-side
      let phone: string | null = null;
      let address: string | null = null;
      let parsedCategory: string | null = null;

      try {
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

        const isPhone = (str: string) => {
          const clean = str.replace(/[^0-9+]/g, '');
          if (clean.length >= 8 && clean.length <= 15) {
            if (str.includes('(') && !str.includes(')')) return false; // partial rating
            const letters = str.replace(/[^a-zA-Z]/g, '').length;
            if (letters < 3) return true;
          }
          return false;
        };

        const isRating = (str: string) => {
          return /^[345][.,]\d\s*\(\d+\)$/.test(str) || /^[345][.,]\d$/.test(str) || (str.includes('(') && str.includes(')'));
        };

        const isAddress = (str: string) => {
          const keywords = ['av', 'rua', 'r.', 'alameda', 'al.', 'rodovia', 'rod.', 'estrada', 'estr.', 'travessa', 'trv.', 'praça', 'prc.', 'avenida', 'bloco', 'nº', 'sala', 'andar', 'centro', 'bairro', 'cep', 'rj', 'sp', 'mg', 'rs', 'sc', 'pr', 'ba', 'pe', 'ce', 'df', 'go'];
          const lower = str.toLowerCase();
          const hasKeyword = keywords.some(k => lower.includes(k) || lower.split(/\s+/).includes(k));
          const hasComma = str.includes(',');
          return (hasKeyword || hasComma) && str.length > 8 && !isPhone(str) && !isRating(str);
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
          if (line.includes('·')) {
            const parts = line.split('·').map(p => p.trim());
            for (const part of parts) {
              if (isPhone(part)) {
                phone = part;
              } else if (isRating(part)) {
                // ignore
              } else if (isAddress(part)) {
                address = part;
              } else if (isCategory(part)) {
                parsedCategory = part;
              }
            }
          } else {
            if (isPhone(line)) {
              phone = line;
            } else if (isAddress(line)) {
              address = line;
            } else if (isCategory(line)) {
              parsedCategory = line;
            }
          }
        }

        // Fallback for address: select first line that is long enough and not phone, rating, category, or generic button text
        if (!address) {
          for (const line of uniqueLines) {
            const lower = line.toLowerCase();
            const excludes = ['aberto', 'fechado', 'fecha às', 'abre às', 'estrelas', 'avaliações', 'website', 'direções', 'salvar', 'ligar', 'compartilhar', 'delivery', 'retirada', 'online', 'no local'];
            if (
              line.length > 8 &&
              !isPhone(line) &&
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

      // 4. Fallback search for address if not found
      if (!address) {
        address = await container.locator("[data-value], .W4Efsd").first().innerText().catch(() => null);
      }

      const lead = {
        name,
        phone: phone || null,
        address: address || null,
        website: website || null,
        email: null, // Scraped emails are not fetched in this phase
        category: parsedCategory || category,
        lat: leadLat,
        lng: leadLng,
        maps_url: href || null,
      };

      console.log(`[Scraper] [Rápido] Extraído: "${lead.name}" | Fone: ${lead.phone || 'N/A'} | Web: ${lead.website || 'N/A'} | Endereço: ${lead.address || 'N/A'} | Geo: ${leadLat}, ${leadLng}`);
      
      // Callback to save to DB and update progress
      await onProgress(i + 1, lead);
      
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
        async (progress, lead) => {
          // Save the lead in database
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
          });

        if (leadError) {
          console.error(`[Worker] Erro ao salvar lead "${lead.name}":`, leadError);
        } else {
          leadsSaved++;
        }

        // Update progress in job
        await supabase
          .from('lead_finder_jobs')
          .update({
            progress_count: leadsSaved,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      });

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

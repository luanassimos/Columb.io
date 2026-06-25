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

console.log('[Worker] Worker de captação de leads iniciado e aguardando tarefas...');

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
    console.log(`[Scraper] Iniciando Playwright para "${category}" em Geo: ${lat}, ${lng} (raio: ${radius ? radius / 1000 : '?'}km, zoom: ${zoom}, limite: ${limitCount})...`);
    const searchQuery = encodeURIComponent(category);
    url = `https://www.google.com/maps/search/${searchQuery}/@${lat},${lng},${zoom}z`;
  } else {
    console.log(`[Scraper] Iniciando Playwright para "${category}" em "${region || ''}" (limite: ${limitCount})...`);
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

  console.log('[Scraper] Página do Google Maps carregada. Rolando feed...');

  const feedSelector = 'div[role="feed"]';
  let currentCount = 0;
  let previousCount = -1;
  let scrollAttempts = 0;
  const maxScrollAttempts = 40;

  // Wait for the feed or any place card to load
  try {
    await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
  } catch (e) {
    console.log('[Scraper] Nenhum resultado encontrado ou timeout ao carregar os cards inicialmentes.');
    await browser.close();
    return;
  }

  // Scroll to load enough cards
  while (currentCount < limitCount && scrollAttempts < maxScrollAttempts) {
    const cards = page.locator('a[href*="/maps/place/"]');
    currentCount = await cards.count();
    console.log(`[Scraper] Cards carregados: ${currentCount} / ${limitCount} (Tentativa de scroll: ${scrollAttempts})`);

    if (currentCount >= limitCount || currentCount === previousCount) {
      break;
    }

    previousCount = currentCount;
    const feed = page.locator(feedSelector);
    if (await feed.count() > 0) {
      await feed.first().evaluate((node) => node.scrollBy(0, node.scrollHeight));
      await page.waitForTimeout(2000);
    } else {
      // Fallback if role="feed" is not matching
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    }
    scrollAttempts++;
  }

  const cardsLocator = page.locator('a[href*="/maps/place/"]');
  const totalAvailable = await cardsLocator.count();
  const countToScrape = Math.min(limitCount, totalAvailable);
  console.log(`[Scraper] Iniciando extração detalhada de ${countToScrape} estabelecimentos.`);

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

      console.log(`[Scraper] Carregando detalhes do card ${i + 1}/${countToScrape}...`);
      
      const card = cardsLocator.nth(i);
      
      // Scroll card into view and click
      await card.scrollIntoViewIfNeeded();
      await card.click({ force: true });
      
      // Wait for details panel to load/render
      await page.waitForTimeout(2000);

      // Extract Name
      const nameLocator = page.locator('h1');
      let name = '';
      if (await nameLocator.count() > 0) {
        name = (await nameLocator.first().textContent())?.trim() || '';
      }

      if (!name) {
        // Fallback: extract from card aria-label
        const ariaLabel = await card.getAttribute('aria-label');
        name = ariaLabel || `Empresa ${i + 1}`;
      }

      // Extract Website
      const websiteLocator = page.locator('a[data-item-id="authority"]');
      let website = '';
      if (await websiteLocator.count() > 0) {
        website = (await websiteLocator.first().getAttribute('href')) || '';
      }

      // Extract Phone
      const phoneLocator = page.locator('button[data-item-id^="phone:tel:"]');
      let phone = '';
      if (await phoneLocator.count() > 0) {
        const rawPhone = await phoneLocator.first().textContent();
        phone = rawPhone?.replace(/[^0-9+\s()-]/g, '').trim() || '';
      }

      // Extract Address
      const addressLocator = page.locator('button[data-item-id="address"]');
      let address = '';
      if (await addressLocator.count() > 0) {
        address = (await addressLocator.first().textContent())?.trim() || '';
      }

      const lead = {
        name,
        phone: phone || null,
        address: address || null,
        website: website || null,
      };

      console.log(`[Scraper] Extraído: "${name}" | Fone: ${phone || 'N/A'} | Web: ${website || 'N/A'}`);
      
      // Callback to save to DB and update progress
      await onProgress(i + 1, lead);
    } catch (cardError) {
      console.error(`[Scraper] Erro ao extrair card ${i + 1}:`, cardError);
      // Continue to next card
    }
  }

  await browser.close();
  console.log('[Scraper] Captação finalizada com sucesso.');
}

async function processQueue() {
  try {
    // 1. Fetch one pending job
    const { data: job, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Worker] Erro ao buscar fila de jobs:', error);
      return;
    }

    if (!job) {
      return; // No pending jobs
    }

    console.log(`[Worker] Job encontrado! ID: ${job.id} | Categoria: "${job.category}" | Região: "${job.region}"`);

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
            category: job.category,
            region: leadRegion,
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

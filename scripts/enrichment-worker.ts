import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Load environment variables from .env.local
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log(`[Enrichment Worker] Carregando variáveis de ambiente de: ${envPath}`);
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
    console.warn('[Enrichment Worker] Arquivo .env.local não encontrado no diretório atual.');
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Enrichment Worker] Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
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

console.log('WORKER_ENRICHMENT_STARTED');

interface ContactChannels {
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  contact_form?: boolean;
}

// Clean extracted emails from junk
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
function cleanEmail(email: string): boolean {
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
}

// Fetch helper with timeout
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
    
    const response = await fetch(url, {
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
}

// Extract contact channels from HTML content
function extractChannelsFromHtml(html: string, baseUrl: string, channels: ContactChannels): { email: string | null } {
  let foundEmail: string | null = null;

  // 1. Email extraction
  const emailMatches = html.match(emailRegex);
  if (emailMatches) {
    const valid = emailMatches.filter(cleanEmail);
    if (valid.length > 0) {
      foundEmail = valid[0].toLowerCase();
    }
  }

  // 2. Instagram
  if (!channels.instagram) {
    const instaMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_\.\-\/]+)/i);
    if (instaMatch) {
      channels.instagram = `https://instagram.com/${instaMatch[1].split('/')[0]}`;
    }
  }

  // 3. Facebook
  if (!channels.facebook) {
    const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_\.\-\/]+)/i);
    if (fbMatch) {
      channels.facebook = `https://facebook.com/${fbMatch[1].split('/')[0]}`;
    }
  }

  // 4. WhatsApp
  if (!channels.whatsapp) {
    const waMatch = html.match(/(?:https?:\/\/)?wa\.me\/(\d+)/i) || 
                    html.match(/(?:https?:\/\/)?api\.whatsapp\.com\/send\?phone=(\d+)/i) ||
                    html.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i);
    if (waMatch) {
      channels.whatsapp = waMatch[0].startsWith('http') ? waMatch[0] : `https://${waMatch[0]}`;
    }
  }

  // 5. Contact Form indicator
  if (!channels.contact_form) {
    const hasForm = /<form/i.test(html) && (/email/i.test(html) || /mensagem|message/i.test(html));
    if (hasForm) {
      channels.contact_form = true;
    }
  }

  return { email: foundEmail };
}

// Compute scores and contact accessibility quality
function calculateContactIntelligence(lead: any, channels: ContactChannels) {
  let contactScore = 0;
  let reachabilityScore = 0;

  const hasPhone = !!lead.phone && lead.phone.trim().length > 0;
  const hasWebsite = !!lead.website && lead.website.trim().length > 0;
  const hasForm = !!channels.contact_form;
  const hasInsta = !!channels.instagram;
  const hasFb = !!channels.facebook;
  const hasWa = !!channels.whatsapp;

  // Contact Score
  if (hasPhone) contactScore += 30;
  if (hasWebsite) contactScore += 20;
  if (hasForm) contactScore += 20;
  if (hasInsta) contactScore += 10;
  if (hasFb) contactScore += 10;
  if (hasWa) contactScore += 10;
  contactScore = Math.min(contactScore, 100);

  // Reachability Score
  if (hasPhone) reachabilityScore += 40;
  if (hasWebsite) reachabilityScore += 15;
  if (hasInsta) reachabilityScore += 15;
  if (hasForm) reachabilityScore += 20;
  if (hasWa) reachabilityScore += 10;
  reachabilityScore = Math.min(reachabilityScore, 100);

  // Quality Grade
  let quality: 'low' | 'medium' | 'high' = 'low';
  if (reachabilityScore >= 80) {
    quality = 'high';
  } else if (reachabilityScore >= 30) {
    quality = 'medium';
  }

  return {
    contact_score: contactScore,
    reachability_score: reachabilityScore,
    contact_quality: quality,
  };
}

async function processEnrichmentQueue() {
  try {
    // 1. Fetch pending leads to process in batches of 15
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('contact_status', 'pending')
      .limit(15);

    if (error) {
      console.error('[Enrichment Worker] Erro ao buscar fila de leads:', error);
      return;
    }

    if (!leads || leads.length === 0) {
      return; // Nothing to process
    }

    console.log(`[Enrichment Worker] Processando lote de ${leads.length} leads...`);

    // Process up to 3 leads concurrently to respect rate limits
    const batchSize = 3;
    for (let i = 0; i < leads.length; i += batchSize) {
      const chunk = leads.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (lead) => {
          try {
            const channels: ContactChannels = {};
            if (lead.phone) channels.phone = lead.phone;
            if (lead.website) channels.website = lead.website;

            let extractedEmail: string | null = null;
            let targetUrl = lead.website ? lead.website.trim() : null;

            if (targetUrl) {
              if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                targetUrl = 'https://' + targetUrl;
              }

              // 1. Fetch homepage
              const homepageHtml = await fetchHtml(targetUrl);
              if (homepageHtml) {
                const res = extractChannelsFromHtml(homepageHtml, targetUrl, channels);
                if (res.email) {
                  extractedEmail = res.email;
                }

                // Look for inner pages containing contact or form elements
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
                    if (contactLinks.length >= 2) break; // Limit to 2 contact subpages
                  }

                  // Scan the contact pages
                  for (const contactUrl of contactLinks) {
                    const pageHtml = await fetchHtml(contactUrl);
                    if (pageHtml) {
                      const pageRes = extractChannelsFromHtml(pageHtml, contactUrl, channels);
                      if (pageRes.email && !extractedEmail) {
                        extractedEmail = pageRes.email;
                      }
                      // If we find contact page we flag it
                      channels.contact_form = true;
                    }
                  }
                } catch {
                  // Ignore link extraction errors
                }
              }
            }

            // Calculate metrics
            const metrics = calculateContactIntelligence(lead, channels);

            // Construct contact notes summary
            const notesList: string[] = [];
            if (lead.phone) notesList.push('Telefone');
            if (extractedEmail || lead.email) notesList.push('E-mail');
            if (channels.instagram) notesList.push('Instagram');
            if (channels.facebook) notesList.push('Facebook');
            if (channels.whatsapp) notesList.push('WhatsApp');
            if (channels.contact_form) notesList.push('Formulário');

            const notes = notesList.length > 0
              ? `Canais: ${notesList.join(', ')}`
              : 'Nenhum canal de contato público detectado';

            // Update lead columns in database
            const updatePayload: any = {
              contact_status: 'completed',
              contact_score: metrics.contact_score,
              reachability_score: metrics.reachability_score,
              contact_quality: metrics.contact_quality,
              contact_channels: channels,
              contact_notes: notes,
            };

            // If we found a new email, save it
            if (extractedEmail && !lead.email) {
              updatePayload.email = extractedEmail;
            }

            const { error: updateError } = await supabase
              .from('leads')
              .update(updatePayload)
              .eq('id', lead.id);

            if (updateError) {
              console.error(`[Enrichment Worker] Erro ao atualizar lead ${lead.id}:`, updateError);
            } else {
              console.log(`[Enrichment Worker] Lead "${lead.name}" enriquecida: Score ${metrics.reachability_score} | Qualidade: ${metrics.contact_quality}`);
            }
          } catch (leadError) {
            console.error(`[Enrichment Worker] Falha no enriquecimento da lead ${lead.id}:`, leadError);
            // Mark as failed so it doesn't block the queue
            await supabase
              .from('leads')
              .update({ contact_status: 'failed' })
              .eq('id', lead.id);
          }
        })
      );
    }
  } catch (globalError) {
    console.error('[Enrichment Worker] Erro global na execução:', globalError);
  }
}

// Loop worker every 5 seconds
setInterval(processEnrichmentQueue, 5000);
// Run immediately on start
processEnrichmentQueue();

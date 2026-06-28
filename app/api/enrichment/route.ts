import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- Types ---
interface ContactChannels {
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  contact_form?: boolean;
}

// --- Helpers ---
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;

function cleanEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return !(
    lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.svg') ||
    lower.endsWith('.css') || lower.endsWith('.js') ||
    lower.includes('sentry') || lower.includes('bootstrap') || lower.includes('jquery') ||
    lower.includes('wix') || lower.includes('wordpress') || lower.includes('domain') ||
    lower.includes('example') || lower.includes('test')
  );
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(id);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractChannelsFromHtml(html: string, _baseUrl: string, channels: ContactChannels): { email: string | null } {
  let foundEmail: string | null = null;

  // Email
  const emailMatches = html.match(emailRegex);
  if (emailMatches) {
    const valid = emailMatches.filter(cleanEmail);
    if (valid.length > 0) foundEmail = valid[0].toLowerCase();
  }

  // Instagram
  if (!channels.instagram) {
    const m = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.\-\/]+)/i);
    if (m) channels.instagram = `https://instagram.com/${m[1].split('/')[0]}`;
  }

  // Facebook
  if (!channels.facebook) {
    const m = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.\-\/]+)/i);
    if (m) channels.facebook = `https://facebook.com/${m[1].split('/')[0]}`;
  }

  // WhatsApp
  if (!channels.whatsapp) {
    const m =
      html.match(/(?:https?:\/\/)?wa\.me\/(\d+)/i) ||
      html.match(/(?:https?:\/\/)?api\.whatsapp\.com\/send\?phone=(\d+)/i) ||
      html.match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i);
    if (m) channels.whatsapp = m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
  }

  // Contact Form
  if (!channels.contact_form) {
    const hasForm = /<form/i.test(html) && (/email/i.test(html) || /mensagem|message/i.test(html));
    if (hasForm) channels.contact_form = true;
  }

  return { email: foundEmail };
}

function calculateScores(lead: any, channels: ContactChannels) {
  const hasPhone = !!lead.phone?.trim();
  const hasWebsite = !!lead.website?.trim();
  const hasForm = !!channels.contact_form;
  const hasInsta = !!channels.instagram;
  const hasFb = !!channels.facebook;
  const hasWa = !!channels.whatsapp;

  let contactScore = 0;
  if (hasPhone) contactScore += 30;
  if (hasWebsite) contactScore += 20;
  if (hasForm) contactScore += 20;
  if (hasInsta) contactScore += 10;
  if (hasFb) contactScore += 10;
  if (hasWa) contactScore += 10;
  contactScore = Math.min(contactScore, 100);

  let reachabilityScore = 0;
  if (hasPhone) reachabilityScore += 40;
  if (hasWebsite) reachabilityScore += 15;
  if (hasInsta) reachabilityScore += 15;
  if (hasForm) reachabilityScore += 20;
  if (hasWa) reachabilityScore += 10;
  reachabilityScore = Math.min(reachabilityScore, 100);

  let contact_quality: 'low' | 'medium' | 'high' = 'low';
  if (reachabilityScore >= 80) contact_quality = 'high';
  else if (reachabilityScore >= 30) contact_quality = 'medium';

  return { contact_score: contactScore, reachability_score: reachabilityScore, contact_quality };
}

// --- Route Handler ---
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch up to 10 pending leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('contact_status', 'pending')
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Nenhum lead pendente.' });
  }

  let processed = 0;
  let failed = 0;

  // Process in groups of 3 concurrently
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
          let targetUrl = lead.website?.trim() ?? null;

          if (targetUrl) {
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

            const homepageHtml = await fetchHtml(targetUrl);
            if (homepageHtml) {
              const res = extractChannelsFromHtml(homepageHtml, targetUrl, channels);
              if (res.email) extractedEmail = res.email;

              // Scan contact sub-pages
              try {
                const linkRegex = /href=["']([^"']*(?:contato|contacto|contact|about|sobre|fale|atendimento)[^"']*)["']/gi;
                const contactLinks: string[] = [];
                let match;
                while ((match = linkRegex.exec(homepageHtml)) !== null) {
                  let link = match[1];
                  if (link.startsWith('/') && !link.startsWith('//')) {
                    try { link = `${new URL(targetUrl).origin}${link}`; } catch { continue; }
                  } else if (!link.startsWith('http')) continue;
                  if (!contactLinks.includes(link)) contactLinks.push(link);
                  if (contactLinks.length >= 2) break;
                }
                for (const contactUrl of contactLinks) {
                  const pageHtml = await fetchHtml(contactUrl);
                  if (pageHtml) {
                    const r = extractChannelsFromHtml(pageHtml, contactUrl, channels);
                    if (r.email && !extractedEmail) extractedEmail = r.email;
                    channels.contact_form = true;
                  }
                }
              } catch { /* ignore */ }
            }
          }

          const metrics = calculateScores(lead, channels);

          const notesList: string[] = [];
          if (lead.phone) notesList.push('Telefone');
          if (extractedEmail || lead.email) notesList.push('E-mail');
          if (channels.instagram) notesList.push('Instagram');
          if (channels.facebook) notesList.push('Facebook');
          if (channels.whatsapp) notesList.push('WhatsApp');
          if (channels.contact_form) notesList.push('Formulário');

          const updatePayload: any = {
            contact_status: 'completed',
            contact_score: metrics.contact_score,
            reachability_score: metrics.reachability_score,
            contact_quality: metrics.contact_quality,
            contact_channels: channels,
            contact_notes: notesList.length > 0 ? `Canais: ${notesList.join(', ')}` : 'Nenhum canal público detectado',
          };
          if (extractedEmail && !lead.email) updatePayload.email = extractedEmail;

          const { error: updateError } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', lead.id);

          if (updateError) {
            console.error(`[Enrichment API] Erro ao atualizar lead ${lead.id}:`, updateError);
            failed++;
          } else {
            processed++;
          }
        } catch {
          failed++;
          await supabase.from('leads').update({ contact_status: 'failed' }).eq('id', lead.id);
        }
      })
    );
  }

  return NextResponse.json({ processed, failed, total: leads.length });
}

/**
 * lib/workers/enrichment-worker-loop.ts
 *
 * Enrichment logic as a startable loop (no process.exit, no loadEnvLocal).
 * Bootstrapped by instrumentation.ts — runs inside the Next.js server process.
 */
import { createClient } from '@supabase/supabase-js';

interface ContactChannels {
  phone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  contact_form?: boolean;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;

function cleanEmail(e: string) {
  const l = e.toLowerCase();
  return !['png','jpg','jpeg','gif','webp','svg','css','js'].some(ext => l.endsWith(`.${ext}`)) &&
         !['sentry','bootstrap','jquery','wix','wordpress','domain','example','test'].some(w => l.includes(w));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,*/*;q=0.8' },
    });
    clearTimeout(t);
    return r.ok ? r.text() : null;
  } catch { return null; }
}

function extractChannels(html: string, _base: string, ch: ContactChannels): { email: string | null } {
  let email: string | null = null;
  const m = html.match(emailRegex)?.filter(cleanEmail);
  if (m?.length) email = m[0].toLowerCase();

  if (!ch.instagram) {
    const x = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.\-/]+)/i);
    if (x) ch.instagram = `https://instagram.com/${x[1].split('/')[0]}`;
  }
  if (!ch.facebook) {
    const x = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.\-/]+)/i);
    if (x) ch.facebook = `https://facebook.com/${x[1].split('/')[0]}`;
  }
  if (!ch.whatsapp) {
    const x = html.match(/(?:https?:\/\/)?wa\.me\/(\d+)/i) ||
              html.match(/(?:https?:\/\/)?api\.whatsapp\.com\/send\?phone=(\d+)/i);
    if (x) ch.whatsapp = x[0].startsWith('http') ? x[0] : `https://${x[0]}`;
  }
  if (!ch.contact_form) {
    ch.contact_form = /<form/i.test(html) && (/email/i.test(html) || /mensagem|message/i.test(html));
  }
  return { email };
}

function calcScores(lead: any, ch: ContactChannels) {
  const p = !!lead.phone?.trim(), w = !!lead.website?.trim();
  const f = !!ch.contact_form, ig = !!ch.instagram, fb = !!ch.facebook, wa = !!ch.whatsapp;

  const contact_score = Math.min((p?30:0)+(w?20:0)+(f?20:0)+(ig?10:0)+(fb?10:0)+(wa?10:0), 100);
  const reachability_score = Math.min((p?40:0)+(w?15:0)+(ig?15:0)+(f?20:0)+(wa?10:0), 100);
  const contact_quality: 'low'|'medium'|'high' = reachability_score >= 80 ? 'high' : reachability_score >= 30 ? 'medium' : 'low';
  return { contact_score, reachability_score, contact_quality };
}

async function processEnrichmentBatch() {
  const supabase = getSupabase();
  const { data: leads, error } = await supabase
    .from('leads').select('*').eq('contact_status', 'pending').limit(10);

  if (error || !leads?.length) return;

  console.log(`[EnrichmentWorker] Processando ${leads.length} leads...`);
  const batchSize = 3;
  for (let i = 0; i < leads.length; i += batchSize) {
    const chunk = leads.slice(i, i + batchSize);
    await Promise.all(chunk.map(async (lead) => {
      try {
        const ch: ContactChannels = {};
        if (lead.phone) ch.phone = lead.phone;
        if (lead.website) ch.website = lead.website;

        let extractedEmail: string | null = null;
        let target = lead.website?.trim() ?? null;
        if (target) {
          if (!target.startsWith('http')) target = 'https://' + target;
          const html = await fetchHtml(target);
          if (html) {
            const r = extractChannels(html, target, ch);
            if (r.email) extractedEmail = r.email;
            // Contact sub-pages
            try {
              const re = /href=["']([^"']*(?:contato|contact|about|sobre)[^"']*)["']/gi;
              const links: string[] = [];
              let x;
              while ((x = re.exec(html)) !== null) {
                let lnk = x[1];
                if (lnk.startsWith('/') && !lnk.startsWith('//')) {
                  try { lnk = `${new URL(target).origin}${lnk}`; } catch { continue; }
                } else if (!lnk.startsWith('http')) continue;
                if (!links.includes(lnk)) links.push(lnk);
                if (links.length >= 2) break;
              }
              for (const cu of links) {
                const ph = await fetchHtml(cu);
                if (ph) {
                  const rr = extractChannels(ph, cu, ch);
                  if (rr.email && !extractedEmail) extractedEmail = rr.email;
                  ch.contact_form = true;
                }
              }
            } catch {}
          }
        }

        const scores = calcScores(lead, ch);
        const notes = [
          lead.phone && 'Telefone',
          (extractedEmail || lead.email) && 'E-mail',
          ch.instagram && 'Instagram',
          ch.facebook && 'Facebook',
          ch.whatsapp && 'WhatsApp',
          ch.contact_form && 'Formulário',
        ].filter(Boolean).join(', ');

        const payload: any = {
          contact_status: 'completed',
          contact_score: scores.contact_score,
          reachability_score: scores.reachability_score,
          contact_quality: scores.contact_quality,
          contact_channels: ch,
          contact_notes: notes || 'Nenhum canal público detectado',
        };
        if (extractedEmail && !lead.email) payload.email = extractedEmail;

        const { error: ue } = await supabase.from('leads').update(payload).eq('id', lead.id);
        if (ue) console.error(`[EnrichmentWorker] Erro lead ${lead.id}:`, ue);
        else console.log(`[EnrichmentWorker] "${lead.name}" — Reachability ${scores.reachability_score}`);
      } catch {
        await supabase.from('leads').update({ contact_status: 'failed' }).eq('id', lead.id);
      }
    }));
  }
}

let started = false;

export function startEnrichmentWorker() {
  if (started) return;
  started = true;
  console.log('[EnrichmentWorker] Worker iniciado pelo servidor Next.js.');
  processEnrichmentBatch();
  setInterval(processEnrichmentBatch, 8000);
}

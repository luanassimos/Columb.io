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

    // Process up to 3 leads concurrently
    const batchSize = 3;
    for (let i = 0; i < leads.length; i += batchSize) {
      const chunk = leads.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (lead) => {
          try {
            const hasPhone = !!lead.phone && lead.phone.trim().length > 0;
            const hasWebsite = !!lead.website && lead.website.trim().length > 0;
            const hasEmail = !!lead.email && lead.email.trim().length > 0;

            let quality = 0;
            let primaryContact: string | null = null;
            const notesParts: string[] = [];

            // Classify quality based on rules
            if (hasWebsite && (hasPhone || hasEmail)) {
              quality = 3;
              notesParts.push('Website e Canal de Contato');
            } else if (hasWebsite) {
              quality = 2;
              notesParts.push('Website');
            } else if (hasPhone) {
              quality = 1;
              notesParts.push('Telefone');
            } else {
              quality = 0;
              notesParts.push('Sem Contato');
            }

            // Determine primary contact method
            if (hasEmail) {
              primaryContact = lead.email;
            } else if (hasPhone) {
              primaryContact = lead.phone;
            } else if (hasWebsite) {
              primaryContact = lead.website;
            }

            const notes = notesParts.join(' disponível');

            // Update lead enrichment metadata in DB
            const { error: updateError } = await supabase
              .from('leads')
              .update({
                contact_quality: quality,
                primary_contact: primaryContact,
                contact_notes: notes,
                contact_status: 'completed',
              })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`[Enrichment Worker] Erro ao atualizar lead ${lead.id}:`, updateError);
            } else {
              console.log(`[Enrichment Worker] Lead "${lead.name}" enriquecida: Qualidade ${quality} | Contato: ${primaryContact || 'N/A'}`);
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

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import ws from 'ws';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const index = trimmed.indexOf('=');
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as any },
});

async function main() {
  const jobId = '5093a5c9-d38e-4afb-ae3b-5c227d408538';
  
  const { data: job, error: jobError } = await supabase
    .from('lead_finder_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError) {
    console.error('Error fetching job:', jobError);
    process.exit(1);
  }

  console.log('--- JOB STATUS ---');
  console.log(`ID: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`Progress Count: ${job.progress_count}`);
  console.log(`Error Message: ${job.error_message}`);
  console.log(`Created At: ${job.created_at}`);
  console.log(`Updated At: ${job.updated_at}`);

  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, name, region, lead_score, lead_grade, lead_origin, created_at')
    .eq('job_id', jobId);

  if (leadsError) {
    console.error('Error fetching leads:', leadsError);
    process.exit(1);
  }

  console.log('\n--- SAVED LEADS ---');
  console.log(`Total Leads: ${leads?.length || 0}`);
  leads?.forEach((lead, index) => {
    console.log(`[${index + 1}] Name: ${lead.name} | Region: ${lead.region} | Grade: ${lead.lead_grade} | Score: ${lead.lead_score} | Origin: ${lead.lead_origin}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

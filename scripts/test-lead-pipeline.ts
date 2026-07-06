import { runCompanyLeadPipeline } from '../lib/lead-providers/pipeline';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Simple .env.local loader
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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch workspace
  const { data: workspaces } = await supabase.from('workspaces').select('id').limit(1);
  if (!workspaces || workspaces.length === 0) {
    console.error('No workspace found to run test.');
    process.exit(1);
  }
  const workspaceId = workspaces[0].id;

  console.log(`Using Workspace ID: ${workspaceId}`);

  // Create a temporary job
  const { data: job, error: jobErr } = await supabase
    .from('lead_finder_jobs')
    .insert({
      workspace_id: workspaceId,
      category: 'CrossFit Gym',
      region: 'Miami',
      limit_count: 5,
      status: 'pending',
      lat: 25.7617,
      lng: -80.1918,
      radius: 5000
    })
    .select('*')
    .single();

  if (jobErr || !job) {
    console.error('Error creating temporary job:', jobErr);
    process.exit(1);
  }

  console.log(`Created temporary job ${job.id}. Starting pipeline...`);

  try {
    await runCompanyLeadPipeline(supabase, job);
    console.log('Pipeline execution finished successfully.');

    // Fetch the updated job
    const { data: finishedJob } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('id', job.id)
      .single();

    console.log('Execution Summary in database:', finishedJob?.execution_summary);

    // Clean up job
    await supabase.from('lead_finder_jobs').delete().eq('id', job.id);
    console.log('Temporary job cleaned up.');
  } catch (error) {
    console.error('Error running pipeline:', error);
    await supabase.from('lead_finder_jobs').delete().eq('id', job.id);
    process.exit(1);
  }
}

main().catch(console.error);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export function createAdminClient() {
  if (!supabaseUrl) {
    throw new Error('[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL is required.');
  }

  if (!supabaseServiceKey) {
    throw new Error('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is required for admin operations.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

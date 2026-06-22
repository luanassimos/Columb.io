import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function createBrowserClient() {
  return createBrowserClientSSR(supabaseUrl, supabaseAnonKey);
}

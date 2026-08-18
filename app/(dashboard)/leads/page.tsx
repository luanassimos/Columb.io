import ContactsClient from '../contacts/contacts-client';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import type { Contact } from '@/types';

export default async function LeadsPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) redirect('/login');
  const { data, error } = await context.supabase.from('contacts').select('*').eq('workspace_id', context.workspaceId).order('created_at', { ascending: false });
  if (error) console.error('[Leads] Falha ao carregar:', error.message);
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold text-[#002B6A]">Leads</h1><p className="mt-1 text-sm text-[#475569]">Encontre, importe, enriqueça e acompanhe empresas em um só lugar.</p></div><ContactsClient contacts={(data || []) as Contact[]} role={context.role} /></div>;
}

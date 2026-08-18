import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';

function startOfToday() { const date = new Date(); date.setHours(0,0,0,0); return date.toISOString(); }
function startOfWeek() { const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate() - ((date.getDay()+6)%7)); return date.toISOString(); }

export default async function DashboardPage() {
  const context = await getActiveWorkspaceContext(); if ('error' in context) redirect('/login');
  const { data: workspace } = await context.supabase.from('workspaces').select('onboarding_completed_at').eq('id', context.workspaceId).single();
  if (!workspace?.onboarding_completed_at) redirect('/onboarding');
  const today = startOfToday(); const week = startOfWeek();
  const [settingsResult, runResult, recentResult, todayLeads, weekLeads, todaySent, weekSent, todayReplies, weekReplies] = await Promise.all([
    context.supabase.from('automation_settings').select('*').eq('workspace_id', context.workspaceId).maybeSingle(),
    context.supabase.from('automation_runs').select('*').eq('workspace_id', context.workspaceId).order('scheduled_for',{ascending:false}).limit(1).maybeSingle(),
    context.supabase.from('contacts').select('id,company,industry,ai_fit_score,ai_fit_label,operational_status').eq('workspace_id',context.workspaceId).order('ai_fit_score',{ascending:false,nullsFirst:false}).limit(5),
    context.supabase.from('contacts').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).gte('created_at',today),
    context.supabase.from('contacts').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).gte('created_at',week),
    context.supabase.from('prospecting_emails').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).eq('status','sent').gte('sent_at',today),
    context.supabase.from('prospecting_emails').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).eq('status','sent').gte('sent_at',week),
    context.supabase.from('contacts').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).eq('status','replied').gte('last_contact_at',today),
    context.supabase.from('contacts').select('*',{count:'exact',head:true}).eq('workspace_id',context.workspaceId).eq('status','replied').gte('last_contact_at',week),
  ]);
  const settings=settingsResult.data; const latest=runResult.data;
  const qualifiedToday=latest?.leads_qualified||0;
  return <div className="space-y-7">
    <div><h1 className="text-3xl font-bold text-[#002B6A]">Sua prospecção está funcionando?</h1><p className="mt-1 text-sm text-[#475569]">Uma visão simples do que a Columb encontrou e enviou.</p></div>
    <section><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#475569]">Hoje</h2><div className="grid gap-4 md:grid-cols-4"><Metric label="Leads encontradas" value={todayLeads.count}/><Metric label="Leads qualificadas" value={qualifiedToday}/><Metric label="E-mails enviados" value={todaySent.count}/><Metric label="Respostas" value={todayReplies.count}/></div></section>
    <section><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#475569]">Esta semana</h2><div className="grid gap-4 md:grid-cols-3"><Metric label="Leads encontradas" value={weekLeads.count}/><Metric label="E-mails enviados" value={weekSent.count}/><Metric label="Respostas" value={weekReplies.count}/></div></section>
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[#D8E0EA] bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-[#002B6A]">Automação</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${settings?.enabled?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{settings?.enabled?'Ativa':'Pausada'}</span></div><p className="mt-5 text-sm text-[#475569]">Próxima execução</p><p className="mt-1 text-xl font-bold text-[#002B6A]">{settings?.enabled?`Amanhã às ${String(settings.run_time).slice(0,5)}`:'Ative para começar'}</p><Link href="/automation" className="mt-5 inline-block text-sm font-bold text-[#2D6BFF]">Configurar automação →</Link></section><section className="rounded-2xl border border-[#D8E0EA] bg-white p-5"><h2 className="font-bold text-[#002B6A]">Última execução</h2>{latest?<div className="mt-4 space-y-2 text-sm text-[#475569]"><p>✓ {latest.leads_found} empresas encontradas</p><p>✓ {latest.leads_qualified} qualificadas</p><p>✓ {latest.emails_generated} abordagens preparadas</p><p>✓ {latest.emails_sent} e-mails enviados</p></div>:<p className="mt-4 text-sm text-[#475569]">Ainda não há execuções.</p>}</section></div>
    <section className="rounded-2xl border border-[#D8E0EA] bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-[#002B6A]">Melhores leads recentes</h2><Link href="/leads" className="text-sm font-bold text-[#2D6BFF]">Ver todas →</Link></div><div className="mt-3 divide-y divide-[#D8E0EA]">{recentResult.data?.length?recentResult.data.map((lead:any)=><div key={lead.id} className="flex items-center justify-between py-3"><div><p className="font-semibold text-[#002B6A]">{lead.company}</p><p className="text-xs text-[#475569]">{lead.industry||'Segmento não informado'}</p></div><span className="rounded-full bg-[#EAF2FF] px-3 py-1 text-sm font-bold text-[#2D6BFF]">{lead.ai_fit_score??'—'}</span></div>):<p className="py-6 text-sm text-[#475569]">As melhores oportunidades aparecerão aqui.</p>}</div></section>
  </div>;
}
function Metric({label,value}:{label:string;value:number|null}){return <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5"><span className="text-3xl font-extrabold text-[#002B6A]">{value||0}</span><p className="mt-1 text-sm text-[#475569]">{label}</p></div>}

import { saveCompanyOnboarding } from '@/app/actions/onboarding';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { redirect } from 'next/navigation';
import { AI_COMMUNICATION_LANGUAGES, DEFAULT_AI_COMMUNICATION_LANGUAGE } from '@/lib/ai/languages';

const input = 'mt-1 w-full rounded-xl border border-[#D8E0EA] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2D6BFF]';
const label = 'block text-xs font-semibold text-[#475569]';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) redirect('/login');
  const { data: workspace } = await context.supabase.from('workspaces').select('company_profile_raw').eq('id', context.workspaceId).single();
  const raw = (workspace?.company_profile_raw || {}) as Record<string, any>;
  const { error } = await searchParams;
  const value = (key: string) => Array.isArray(raw[key]) ? raw[key].join(', ') : raw[key] || '';

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><span className="text-xs font-bold uppercase tracking-wider text-[#2D6BFF]">Configuração inicial</span><h1 className="mt-1 text-3xl font-bold text-[#002B6A]">Ensine a Columb sobre sua empresa</h1><p className="mt-2 text-sm text-[#475569]">Esses dados viram o contexto comercial usado para avaliar leads e escrever abordagens. Você poderá editar tudo depois.</p></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <form action={saveCompanyOnboarding} className="space-y-5">
      <Section number="1" title="Empresa">
        <Field name="company_name" title="Nome da empresa" defaultValue={value('company_name')} required />
        <Field name="website" title="Site" defaultValue={value('website')} />
        <Field name="industry" title="Segmento" defaultValue={value('industry')} />
        <Field name="city" title="Cidade" defaultValue={value('city')} />
        <Area name="company_description" title="Descrição da empresa" defaultValue={value('company_description')} required />
        <Area name="freeform_context" title="Ou conte livremente sobre a empresa" defaultValue={value('freeform_context')} wide />
      </Section>
      <Section number="2" title="O que vende">
        <Area name="services" title="Serviços oferecidos (separe por vírgula)" defaultValue={value('services')} wide />
        <Field name="main_service" title="Serviço principal" defaultValue={value('main_service')} required />
        <Field name="priority_service" title="Prioridade comercial" defaultValue={value('priority_service')} />
        <Field name="average_ticket" title="Ticket médio (opcional)" defaultValue={value('average_ticket')} />
      </Section>
      <Section number="3" title="Proposta comercial">
        <Area name="value_reason" title="Por que contratar sua empresa?" defaultValue={value('value_reason')} />
        <Area name="differentiators" title="Diferenciais" defaultValue={value('differentiators')} />
        <Area name="relevant_cases" title="Cases ou clientes relevantes" defaultValue={value('relevant_cases')} />
        <Area name="problems_solved" title="Problemas que resolve" defaultValue={value('problems_solved')} />
      </Section>
      <Section number="4" title="Cliente ideal">
        <Area name="ideal_companies" title="Que empresas são bons clientes?" defaultValue={value('ideal_companies')} required />
        <Field name="target_industries" title="Segmentos prioritários" defaultValue={value('target_industries')} />
        <Field name="company_size" title="Tamanho aproximado" defaultValue={value('company_size')} />
        <Field name="target_regions" title="Regiões de interesse" defaultValue={value('target_regions')} />
        <Area name="exclusions" title="Quem não deve ser prospectado" defaultValue={value('exclusions')} wide />
      </Section>
      <Section number="5" title="Comunicação">
        <label className={label}>Idioma da IA<select name="communication_language" defaultValue={value('communication_language') || DEFAULT_AI_COMMUNICATION_LANGUAGE} className={input}>{AI_COMMUNICATION_LANGUAGES.map((language)=><option key={language.code} value={language.code}>{language.label}</option>)}</select></label>
        <Field name="signer_name" title="Nome de quem assina" defaultValue={value('signer_name')} />
        <Field name="signer_title" title="Cargo" defaultValue={value('signer_title')} />
        <Field name="signer_email" title="E-mail" type="email" defaultValue={value('signer_email')} />
        <Field name="signer_phone" title="Telefone" defaultValue={value('signer_phone')} />
        <label className={label}>Tom<select name="communication_style" defaultValue={value('communication_style') || 'profissional'} className={input}><option>formal</option><option>profissional</option><option>amigável</option><option>direto</option><option>consultivo</option></select></label>
      </Section>
      <button className="w-full rounded-xl bg-[#2D6BFF] px-5 py-3 font-semibold text-white hover:bg-[#1b58ec]">Gerar perfil comercial e continuar</button>
    </form>
  </div>;
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF2FF] text-xs font-bold text-[#2D6BFF]">{number}</span><h2 className="font-bold text-[#002B6A]">{title}</h2></div><div className="grid gap-4 md:grid-cols-2">{children}</div></section> }
function Field({ name, title, defaultValue, required, type='text' }: { name:string; title:string; defaultValue:string; required?:boolean; type?:string }) { return <label className={label}>{title}<input className={input} name={name} defaultValue={defaultValue} required={required} type={type} /></label> }
function Area({ name, title, defaultValue, required, wide }: { name:string; title:string; defaultValue:string; required?:boolean; wide?:boolean }) { return <label className={`${label} ${wide ? 'md:col-span-2' : ''}`}>{title}<textarea className={`${input} min-h-24`} name={name} defaultValue={defaultValue} required={required} /></label> }

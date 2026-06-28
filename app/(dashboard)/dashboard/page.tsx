import React from 'react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import {
  Inbox,
  Brain,
  PenTool,
  Send,
  ArrowRight,
  Briefcase,
  Users,
  Target,
  BarChart3,
  TrendingUp,
  Clock,
  Play,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default async function DashboardPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
  }
  const supabase = 'error' in context ? null : context.supabase;
  const workspaceId = 'error' in context ? null : context.workspaceId;

  // 3. Fetch workflow metrics under active workspace (or all if enforcement disabled)
  let totalLeads = 0;
  let totalContacts = 0;
  let totalTemplates = 0;
  let totalCampaigns = 0;
  let understoodLeads = 0;
  let sentEmails = 0;
  let repliedEmails = 0;
  let mockedEmails = 0;
  let dryRunEmails = 0;

  // A1. Captar Leads: Fetch Total Leads
  if (supabase && workspaceId) try {
    let query = supabase.from('leads').select('*', { count: 'exact', head: true });
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching leads count in dashboard:', error.message || error);
    } else {
      totalLeads = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching leads count in dashboard:', err);
  }

  // A2. Personalizar Leads: Fetch Total Contacts
  if (supabase && workspaceId) try {
    let query = supabase.from('contacts').select('*', { count: 'exact', head: true });
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching contacts count in dashboard:', error.message || error);
    } else {
      totalContacts = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching contacts count in dashboard:', err);
  }

  // B. Entender: Fetch Segmented Leads (status !== 'new')
  if (supabase && workspaceId) try {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'new');
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching understood contacts count in dashboard:', error.message || error);
    } else {
      understoodLeads = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching understood contacts count in dashboard:', err);
  }

  // C. Preparar Resposta: Fetch Templates count
  if (supabase && workspaceId) try {
    let query = supabase.from('templates').select('*', { count: 'exact', head: true });
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching templates count in dashboard:', error.message || error);
    } else {
      totalTemplates = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching templates count in dashboard:', err);
  }

  // C2. Criar Campanha: Fetch Campaigns count
  if (supabase && workspaceId) try {
    let query = supabase.from('campaigns').select('*', { count: 'exact', head: true });
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching campaigns count in dashboard:', error.message || error);
    } else {
      totalCampaigns = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching campaigns count in dashboard:', err);
  }

  // D. Enviar ou Escalar: Fetch live sent email jobs only
  if (supabase && workspaceId) try {
    let query = supabase
      .from('email_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .eq('send_mode', 'live');
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching sent emails count in dashboard:', error.message || error);
    } else {
      sentEmails = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching sent emails count in dashboard:', err);
  }

  if (supabase && workspaceId) try {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'replied');
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching replied emails count in dashboard:', error.message || error);
    } else {
      repliedEmails = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching replied emails count in dashboard:', err);
  }

  if (supabase && workspaceId) try {
    let query = supabase
      .from('email_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'mocked');
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching mocked email jobs count in dashboard:', error.message || error);
    } else {
      mockedEmails = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching mocked email jobs count in dashboard:', err);
  }

  if (supabase && workspaceId) try {
    let query = supabase
      .from('email_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dry_run');
    query = query.eq('workspace_id', workspaceId);
    const { count, error } = await query;
    if (error) {
      console.error('Error fetching dry-run email jobs count in dashboard:', error.message || error);
    } else {
      dryRunEmails = count || 0;
    }
  } catch (err) {
    console.error('Exception fetching dry-run email jobs count in dashboard:', err);
  }

  // E. Fetch Latest Lead Finder Job
  let latestJob: any = null;
  if (supabase && workspaceId) try {
    const { data, error } = await supabase
      .from('lead_finder_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) latestJob = data;
  } catch (err) {
    console.error('Error fetching latest lead finder job:', err);
  }

  // F. Fetch Contact Status Counts
  const statusCounts = {
    new: 0,
    contacted: 0,
    waiting: 0,
    replied: 0,
    converted: 0,
    closed: 0,
  };
  if (supabase && workspaceId) try {
    const { data, error } = await supabase
      .from('contacts')
      .select('status')
      .eq('workspace_id', workspaceId);
    if (!error && data) {
      data.forEach((c) => {
        if (c.status in statusCounts) {
          statusCounts[c.status as keyof typeof statusCounts]++;
        }
      });
    }
  } catch (err) {
    console.error('Error fetching contact status counts:', err);
  }

  // G. Fetch Latest Campaigns
  let latestCampaigns: any[] = [];
  if (supabase && workspaceId) try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, templates(name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (!error) latestCampaigns = data || [];
  } catch (err) {
    console.error('Error fetching latest campaigns:', err);
  }

  const steps = [
    {
      step: '01',
      title: 'Captar Leads',
      subtitle: 'Busca de contatos',
      value: totalLeads || 0,
      description: 'Pesquise leads em massa usando o Google Maps e nossa busca automatizada.',
      icon: Inbox,
      color: 'from-[#2D6BFF]/10 to-[#2D6BFF]/5 border-[#2D6BFF]/20 text-[#2D6BFF]',
      href: '/lead-finder',
    },
    {
      step: '02',
      title: 'Personalizar Leads',
      subtitle: 'Qualificação e perfil',
      value: totalContacts || 0,
      description: 'Personalize e qualifique seus leads aplicando tags, status e informações.',
      icon: Brain,
      color: 'from-[#14B8A6]/10 to-[#14B8A6]/5 border-[#14B8A6]/20 text-[#14B8A6]',
      href: '/contacts',
    },
    {
      step: '03',
      title: 'Criar Templates',
      subtitle: 'Modelos de e-mail',
      value: totalTemplates || 0,
      description: 'Escreva e monte templates de e-mail personalizados com variáveis dinâmicas.',
      icon: PenTool,
      color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-600',
      href: '/templates',
    },
    {
      step: '04',
      title: 'Criar Campanha',
      subtitle: 'Outreach & Disparos',
      value: totalCampaigns || 0,
      description: 'Programe sequências de e-mails automáticas ou envie de forma imediata.',
      icon: Send,
      color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-600',
      href: '/campaigns',
    },
  ];

  const cloudPositions = [
    [
      { top: '10%', right: '-15px', bottom: 'auto', left: 'auto', scale: 1.1 },
      { bottom: '15%', left: '-20px', top: 'auto', right: 'auto', scale: 0.8 }
    ],
    [
      { top: '35%', left: '-15px', bottom: 'auto', right: 'auto', scale: 0.9 },
      { bottom: '8%', right: '-10px', top: 'auto', left: 'auto', scale: 1.2 }
    ],
    [
      { top: '5%', left: '25%', bottom: 'auto', right: 'auto', scale: 0.75 },
      { bottom: '30%', right: '-20px', top: 'auto', left: 'auto', scale: 1.05 }
    ],
    [
      { top: '25%', right: '5%', bottom: 'auto', left: 'auto', scale: 1.0 },
      { bottom: '10%', left: '-10px', top: 'auto', right: 'auto', scale: 0.85 }
    ]
  ];

  return (
    <div className="space-y-8 pt-4">
      {/* Cloud Styles */}
      <style>{`
        .cloud-static {
          background: #D0E1FD;
          border-radius: 100px;
          position: absolute;
          width: 80px;
          height: 25px;
          box-shadow: 0 6px 20px 0 rgba(45, 107, 255, 0.08);
          filter: blur(0.3px);
          transition: transform 0.4s ease;
        }
        .cloud-static::after, .cloud-static::before {
          content: '';
          position: absolute;
          background: #D0E1FD;
          z-index: -1;
        }
        .cloud-static::after {
          width: 35px;
          height: 35px;
          top: -15px;
          left: 10px;
          border-radius: 100px;
        }
        .cloud-static::before {
          width: 45px;
          height: 45px;
          top: -25px;
          right: 10px;
          border-radius: 100px;
        }
      `}</style>

      {/* Workflow Stepper Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {steps.map((item, index) => (
          <div key={item.title} className="relative group">
            {/* The Clickable Card Link (with overflow-hidden for the clouds) */}
            <Link
              href={item.href}
              className="relative flex flex-col justify-between p-6 rounded-2xl border bg-card/60 backdrop-blur-sm border-[#D8E0EA] hover:border-[#2D6BFF]/40 hover:shadow-md transition-all duration-300 overflow-hidden h-full cursor-pointer select-none"
            >
              {/* Stationary Decorative CSS Clouds */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25 select-none transition-transform duration-500 group-hover:translate-x-1.5 group-hover:-translate-y-0.5">
                {cloudPositions[index].map((pos, pIdx) => (
                  <div
                    key={pIdx}
                    className="cloud-static"
                    style={{
                      top: pos.top,
                      bottom: pos.bottom,
                      left: pos.left,
                      right: pos.right,
                      transform: `scale(${pos.scale})`,
                    }}
                  />
                ))}
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569] tracking-wider uppercase">
                    Passo {item.step}
                  </span>
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${item.color}`}>
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-[#002B6A] group-hover:text-[#2D6BFF] transition-colors">{item.title}</h3>
                  <p className="text-xs text-[#475569]">{item.subtitle}</p>
                </div>

                <div className="pt-2">
                  <span className="text-4xl font-extrabold text-[#061A40]">
                    {item.value}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-[#D8E0EA]/60 mt-4 relative z-10">
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </Link>

            {/* Connector arrow (positioned outside the Link so it's not cropped by overflow-hidden) */}
            {index < 3 && (
              <div className="hidden lg:flex absolute top-1/2 -right-3.5 transform -translate-y-1/2 z-20 bg-white border border-[#D8E0EA] rounded-full p-1 text-[#475569] pointer-events-none shadow-sm">
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Workspace Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* Left Column: Lead Finder & Funnel */}
        <div className="space-y-6">
          {/* Card 1: Last Lead Scraping Job */}
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[190px] group">
            {/* Tiny Background Cloud decoration for theme matching */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.12] select-none">
              <div className="cloud-static top-4 right-4 scale-[0.6] bg-slate-400"></div>
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#475569]/70 uppercase tracking-wider block">
                    Última Captação de Leads
                  </span>
                  <h3 className="text-base font-extrabold text-[#002B6A] flex items-center gap-1.5">
                    <Target className="h-4.5 w-4.5 text-[#2D6BFF]" />
                    {latestJob ? `Buscar ${latestJob.category}` : 'Nenhuma captura realizada'}
                  </h3>
                </div>
                {latestJob && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      latestJob.status === 'running'
                        ? 'bg-blue-50 text-blue-600 animate-pulse'
                        : latestJob.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600'
                        : latestJob.status === 'failed'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-slate-50 text-[#475569]'
                    }`}
                  >
                    {latestJob.status === 'running'
                      ? 'Processando'
                      : latestJob.status === 'completed'
                      ? 'Concluído'
                      : latestJob.status === 'failed'
                      ? 'Falhou'
                      : latestJob.status === 'cancelled'
                      ? 'Cancelado'
                      : 'Pendente'}
                  </span>
                )}
              </div>

              {latestJob ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-[#475569]">
                    Foco: <span className="font-semibold text-[#061A40]">{latestJob.category}</span> em <span className="font-semibold text-[#061A40]">{latestJob.region || 'Geo Coordenadas'}</span>
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-[#475569]/80">
                      <span>Progresso da Captura</span>
                      <span>{latestJob.progress_count} / {latestJob.limit_count} Leads</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2D6BFF] transition-all duration-500"
                        style={{ width: `${Math.min(100, (latestJob.progress_count / latestJob.limit_count) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#475569]/70 mt-3 leading-relaxed">
                  Inicie uma busca automatizada para extrair contatos de estabelecimentos diretamente do Google Maps.
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-[#D8E0EA]/60 flex justify-between items-center mt-3 relative z-10">
              <span className="text-[10px] font-medium text-[#475569]/60">
                {latestJob ? `Criado em ${new Date(latestJob.created_at).toLocaleDateString('pt-BR')}` : 'Pronto para iniciar'}
              </span>
              <Link
                href="/lead-finder"
                className="text-xs font-bold text-[#2D6BFF] hover:text-[#1b58ec] flex items-center gap-1 group/btn"
              >
                Captar Leads
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: CRM Lead Funnel Breakdown */}
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[#475569]/70 uppercase tracking-wider block">
                Funil de Conversão do CRM
              </span>
              <h3 className="text-base font-extrabold text-[#002B6A] flex items-center gap-1.5">
                <BarChart3 className="h-4.5 w-4.5 text-[#14B8A6]" />
                Status dos Leads
              </h3>
            </div>

            {totalContacts > 0 ? (
              <div className="space-y-3">
                {[
                  { label: 'Novos Leads', key: 'new', color: 'bg-[#2D6BFF]' },
                  { label: 'Contatados', key: 'contacted', color: 'bg-amber-400' },
                  { label: 'Aguardando Resposta', key: 'waiting', color: 'bg-orange-500' },
                  { label: 'Respondidos', key: 'replied', color: 'bg-emerald-500' },
                  { label: 'Convertidos', key: 'converted', color: 'bg-teal-500' },
                ].map((status) => {
                  const count = statusCounts[status.key as keyof typeof statusCounts] || 0;
                  const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                  return (
                    <div key={status.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#475569]">{status.label}</span>
                        <span className="font-extrabold text-[#061A40]">
                          {count} <span className="text-[10px] text-[#475569]/60 font-medium">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div
                          className={`h-full ${status.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-[#475569]/65">
                Adicione ou importe leads no CRM para visualizar as etapas do funil de conversão.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Campaigns & Outreach */}
        <div className="space-y-6">
          {/* Card 3: Campaigns List & Performance */}
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm flex flex-col justify-between h-full min-h-[350px] space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-[#475569]/70 uppercase tracking-wider block">
                    Campanhas Recentes
                  </span>
                  <h3 className="text-base font-extrabold text-[#002B6A] flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-purple-600" />
                    Envios & Sequências
                  </h3>
                </div>
                <Link
                  href="/campaigns"
                  className="text-xs font-bold text-[#2D6BFF] hover:text-[#1b58ec] flex items-center gap-1 group/cbtn"
                >
                  Ver Todas
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cbtn:translate-x-0.5" />
                </Link>
              </div>

              {latestCampaigns.length > 0 ? (
                <div className="divide-y divide-[#D8E0EA]/60">
                  {latestCampaigns.map((cam) => (
                    <div key={cam.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-sm text-[#002B6A] truncate">{cam.name}</p>
                        <p className="text-[10px] text-[#475569]/70 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-[#475569]/50" />
                          Template: <span className="font-medium">{cam.templates?.name || 'Sem template'}</span>
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                          cam.status === 'running'
                            ? 'bg-purple-50 text-purple-600 animate-pulse'
                            : cam.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : cam.status === 'queued'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-slate-50 text-[#475569]'
                        }`}
                      >
                        {cam.status === 'running'
                          ? 'Enviando'
                          : cam.status === 'completed'
                          ? 'Concluído'
                          : cam.status === 'queued'
                          ? 'Agendado'
                          : cam.status === 'draft'
                          ? 'Rascunho'
                          : 'Cancelado'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <div className="h-10 w-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                    <Play className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs text-[#475569]/60 max-w-[240px] mx-auto leading-relaxed">
                    Nenhuma sequência de e-mails configurada. Crie uma campanha para iniciar disparos.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#D8E0EA]/60 flex justify-between items-center text-xs mt-auto">
              <span className="text-[#475569]/60">Total de Campanhas: <strong className="text-[#061A40]">{totalCampaigns}</strong></span>
              {totalCampaigns > 0 && (
                <Link
                  href="/campaigns"
                  className="px-3.5 py-1.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-[10px] font-bold transition-all shadow-sm shadow-[#2D6BFF]/20"
                >
                  Nova Campanha
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  Users
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

      {/* Overview Block */}
      <div className="glass-card rounded-2xl border border-[#D8E0EA] p-8 text-center max-w-xl mx-auto py-16 space-y-4">
        <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#002B6A] flex items-center justify-center mx-auto">
          <Briefcase className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#002B6A]">Fluxo Integrado Columb</h2>
          <p className="text-xs text-[#475569] max-w-sm mx-auto leading-relaxed">
            Seu funil está operando sob políticas isoladas de segurança. Use o menu lateral para gerenciar leads, personalizar modelos e programar campanhas de disparo.
          </p>
        </div>
      </div>
    </div>
  );
}

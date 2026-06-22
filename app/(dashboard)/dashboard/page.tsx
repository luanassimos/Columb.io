import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import {
  Inbox,
  Brain,
  PenTool,
  Send,
  ArrowRight,
  Briefcase
} from 'lucide-react';

export default async function DashboardPage() {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) {
    if (context.error === 'Unauthorized') redirect('/login');
  }
  const supabase = 'error' in context ? null : context.supabase;
  const workspaceId = 'error' in context ? null : context.workspaceId;

  // 3. Fetch workflow metrics under active workspace (or all if enforcement disabled)
  let totalContacts = 0;
  let understoodLeads = 0;
  let totalTemplates = 0;
  let sentEmails = 0;
  let repliedEmails = 0;

  // A. Receber: Fetch Total Contacts
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

  // D. Enviar ou Escalar: Fetch sent and replied email jobs
  if (supabase && workspaceId) try {
    let query = supabase
      .from('email_jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['sent', 'opened', 'replied']);
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
      .from('email_jobs')
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

  const steps = [
    {
      step: '01',
      title: 'Receber',
      subtitle: 'Entrada de leads',
      value: totalContacts || 0,
      description: 'Leads importados e integrados na caixa de entrada do sistema.',
      icon: Inbox,
      color: 'from-[#2D6BFF]/10 to-[#2D6BFF]/5 border-[#2D6BFF]/20 text-[#2D6BFF]',
    },
    {
      step: '02',
      title: 'Entender',
      subtitle: 'Qualificação e perfil',
      value: understoodLeads || 0,
      description: 'Leads analisados, qualificados e com tags automáticas aplicadas.',
      icon: Brain,
      color: 'from-[#14B8A6]/10 to-[#14B8A6]/5 border-[#14B8A6]/20 text-[#14B8A6]',
    },
    {
      step: '03',
      title: 'Preparar Resposta',
      subtitle: 'Composição de emails',
      value: totalTemplates || 0,
      description: 'Modelos de e-mail e sequências automatizadas configuradas.',
      icon: PenTool,
      color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-600',
    },
    {
      step: '04',
      title: 'Enviar ou Escalar',
      subtitle: 'Outreach & Ações',
      value: (sentEmails || 0) + (repliedEmails || 0),
      description: 'Mensagens enviadas ou transferidas para o atendimento comercial.',
      icon: Send,
      color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Heading */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Dashboard</h1>
        <p className="text-sm text-[#475569] mt-1">
          Acompanhe o fluxo operacional de atração, qualificação e conversão de leads.
        </p>
      </div>

      {/* Workflow Stepper Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {steps.map((item, index) => (
          <div
            key={item.title}
            className="relative flex flex-col justify-between p-6 rounded-2xl border bg-card/60 backdrop-blur-sm border-[#D8E0EA] hover:shadow-md transition-all duration-200 group"
          >
            {/* Connector arrow (only for first 3 on desktop) */}
            {index < 3 && (
              <div className="hidden lg:flex absolute top-1/2 -right-3.5 transform -translate-y-1/2 z-10 bg-white border border-[#D8E0EA] rounded-full p-1 text-[#475569]">
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#475569] tracking-wider uppercase">
                  Passo {item.step}
                </span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${item.color}`}>
                  <item.icon className="h-4.5 w-4.5" />
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-[#002B6A]">{item.title}</h3>
                <p className="text-xs text-[#475569]">{item.subtitle}</p>
              </div>

              <div className="pt-2">
                <span className="text-4xl font-extrabold text-[#061A40]">
                  {item.value}
                </span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-[#D8E0EA]/60 mt-4">
              <p className="text-[11px] text-[#475569] leading-relaxed">
                {item.description}
              </p>
            </div>
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

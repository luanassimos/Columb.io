'use client';

import React, { useState } from 'react';
import { Campaign, Template, CampaignStatus, SmtpSettings } from '@/types';
import CampaignModal from '@/components/campaign-modal';
import SendSuccessModal from '@/components/send-success-modal';
import { deleteCampaign, bulkUpdateCampaignStatus, bulkDeleteCampaigns } from '@/app/actions/campaign';
import { useRouter } from 'next/navigation';
import { Plus, Send, Edit2, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Play } from 'lucide-react';
import { canManageCampaigns, WorkspaceRole } from '@/lib/permissions';

type SortKey = 'name' | 'created_at' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft:     'bg-slate-100 text-slate-700',
  queued:    'bg-blue-50 text-[#2D6BFF]',
  running:   'bg-emerald-50 text-emerald-600',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-amber-50 text-amber-600',
};

interface BlastsClientProps {
  campaigns: Campaign[];
  templates: Template[];
  availableTags: string[];
  smtpSettingsList: SmtpSettings[];
  emailJobs: any[];
  role: WorkspaceRole;
}

export default function BlastsClient({
  campaigns,
  templates,
  availableTags,
  smtpSettingsList,
  emailJobs = [],
  role,
}: BlastsClientProps) {
  const router = useRouter();
  const canCreateBlast = role !== 'viewer';
  const canManageBlastStatuses = canManageCampaigns(role);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);

  // Sorting, filtering, searching
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  // Delete modal states
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk Selection and actions states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'blasts' | 'sent_logs'>('blasts');
  const [blastFilter, setBlastFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [logsSearch, setLogsSearch] = useState('');

  // Trigger campaign states
  const [triggerCampaignId, setTriggerCampaignId] = useState<string | null>(null);
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);

  const handleTriggerBlast = async (campaign: Campaign) => {
    if (campaign.status === 'draft' || campaign.status === 'cancelled') {
      const updateResult = await bulkUpdateCampaignStatus([campaign.id], 'running');
      if (updateResult?.error) {
        alert('Erro ao ativar disparo: ' + updateResult.error);
        return;
      }
    }
    setTriggerCampaignId(campaign.id);
    setIsTriggerModalOpen(true);
  };

  const handleSelectRow = (id: string) => {
    if (!canManageBlastStatuses) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (filteredRows: Campaign[]) => {
    if (!canManageBlastStatuses) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const allSelected = filteredRows.length > 0 && filteredRows.every(c => prev.has(c.id));
      if (!allSelected) {
        filteredRows.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  const handleBulkStatusChange = async (status: CampaignStatus) => {
    if (!canManageBlastStatuses) return;
    setIsBulkProcessing(true);
    setBulkError(null);
    setIsActionsOpen(false);

    const idsArray = Array.from(selectedIds);
    const result = await bulkUpdateCampaignStatus(idsArray, status);
    
    setIsBulkProcessing(false);
    if (result?.error) {
      setBulkError(result.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleBulkDelete = async () => {
    if (!canManageBlastStatuses) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} disparos?`)) {
      return;
    }
    
    setIsBulkProcessing(true);
    setBulkError(null);
    setIsActionsOpen(false);

    const idsArray = Array.from(selectedIds);
    const result = await bulkDeleteCampaigns(idsArray);
    
    setIsBulkProcessing(false);
    if (result?.error) {
      setBulkError(result.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const getTemplateName = (c: Campaign) => {
    const found = c.template || c.templates || templates.find(t => t.id === c.template_id);
    return found?.name || '—';
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getStatusPriority = (status: CampaignStatus) => {
    switch (status) {
      case 'running': return 1;
      case 'queued': return 1;
      case 'draft': return 2;
      case 'cancelled': return 2;
      case 'completed': return 3;
      default: return 4;
    }
  };

  const filtered = campaigns
    .filter(c => {
      // Filter by active/paused/completed groups
      if (blastFilter === 'active') {
        if (c.status !== 'running' && c.status !== 'queued') return false;
      } else if (blastFilter === 'paused') {
        if (c.status !== 'cancelled' && c.status !== 'draft') return false;
      } else if (blastFilter === 'completed') {
        if (c.status !== 'completed') return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      const templateName = getTemplateName(c).toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        templateName.includes(q)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'created_at' && sortDir === 'desc') {
        const prioA = getStatusPriority(a.status);
        const prioB = getStatusPriority(b.status);
        if (prioA !== prioB) {
          return prioA - prioB;
        }
      }

      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const filteredLogs = (emailJobs || [])
    .filter(job => {
      if (!logsSearch) return true;
      const q = logsSearch.toLowerCase();
      return (
        (job.contacts?.name || '').toLowerCase().includes(q) ||
        (job.contacts?.email || '').toLowerCase().includes(q) ||
        (job.campaigns?.name || '').toLowerCase().includes(q) ||
        (job.templates?.name || '').toLowerCase().includes(q)
      );
    });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-45" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-[#2D6BFF]" />
      : <ChevronDown className="h-3 w-3 text-[#2D6BFF]" />;
  };

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide hover:text-[#002B6A] transition-colors"
    >
      {label} <SortIcon col={col} />
    </button>
  );

  const canEditBlast = (campaign: Campaign) => {
    if (campaign.status === 'completed') return false;
    return canManageBlastStatuses || (role === 'member' && campaign.status === 'draft');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Email Blasts</h1>
          <p className="text-sm text-[#475569] mt-1">
            Configure e dispare e-mails em massa imediatos para os seus segmentos de leads.
          </p>
        </div>
        {canCreateBlast && (
          <button
            type="button"
            onClick={() => {
              setCampaignToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-[#2D6BFF]/30 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Criar Blast
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#D8E0EA] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('blasts')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'blasts'
              ? 'border-[#2D6BFF] text-[#2D6BFF]'
              : 'border-transparent text-[#475569]/70 hover:text-[#002B6A]'
          }`}
        >
          Disparos Rápidos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sent_logs')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'sent_logs'
              ? 'border-[#2D6BFF] text-[#2D6BFF]'
              : 'border-transparent text-[#475569]/70 hover:text-[#002B6A]'
          }`}
        >
          Histórico de Envios (Sent Logs)
        </button>
      </div>

      {activeTab === 'blasts' ? (
        <>
          {campaigns.length === 0 ? (
            /* Empty State */
            <div className="glass-card rounded-2xl border border-[#D8E0EA] text-center py-32 max-w-xl mx-auto space-y-4">
              <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto">
                <Send className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#002B6A]">Nenhum disparo em massa encontrado</h3>
                <p className="text-xs text-[#475569] max-w-[280px] mx-auto leading-normal">
                  Sua lista de disparos está vazia. Clique em <strong>Criar Blast</strong> para enviar sua primeira mensagem em massa.
                </p>
              </div>
              {canCreateBlast && (
                <button
                  onClick={() => {
                    setCampaignToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Criar Primeiro Blast
                </button>
              )}
            </div>
          ) : (
            /* Table */
            <div className="space-y-4">
              {/* Sub-Filters / Status Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 w-fit">
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'active', label: 'Ativas' },
                  { key: 'paused', label: 'Rascunhos' },
                  { key: 'completed', label: 'Concluídas' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setBlastFilter(f.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      blastFilter === f.key
                        ? 'bg-white text-[#002B6A] shadow-sm font-bold'
                        : 'text-[#475569]/80 hover:text-[#002B6A]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-[#D8E0EA] overflow-hidden shadow-sm">
                {/* Search and Bulk Actions */}
                <div className="px-4 py-3 border-b border-[#D8E0EA] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    {/* Actions Dropdown Button */}
                    {canManageBlastStatuses && (
                      <div className="relative">
                        <button
                          type="button"
                          disabled={selectedIds.size === 0 || isBulkProcessing}
                          onClick={() => setIsActionsOpen(!isActionsOpen)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-white text-xs font-semibold text-[#002B6A] hover:bg-[#F7FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                          {isBulkProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#002B6A]" />
                          ) : (
                            'Ações'
                          )}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {isActionsOpen && selectedIds.size > 0 && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsActionsOpen(false)} />
                            <div className="absolute left-0 mt-1.5 w-44 bg-white border border-[#D8E0EA] rounded-lg shadow-lg py-1.5 z-20">
                              <button
                                type="button"
                                onClick={() => handleBulkStatusChange('running')}
                                className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                              >
                                Ativar (Status Running)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBulkStatusChange('cancelled')}
                                className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                              >
                                Pausar (Status Cancelled)
                              </button>
                              <hr className="border-[#D8E0EA] my-1" />
                              <button
                                type="button"
                                onClick={handleBulkDelete}
                                className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
                              >
                                Excluir Selecionados
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por nome do disparo ou modelo…"
                      className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
                    />
                  </div>
                  
                  {selectedIds.size > 0 && (
                    <span className="text-xs text-[#475569] font-semibold bg-[#EAF2FF] px-2.5 py-1 rounded-full border border-[#2D6BFF]/20">
                      {selectedIds.size} selecionados
                    </span>
                  )}
                </div>

                {bulkError && (
                  <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg">
                    {bulkError}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                      <tr>
                        {canManageBlastStatuses && (
                          <th className="px-4 py-3 text-left w-10">
                            <input
                              type="checkbox"
                              checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
                              onChange={() => handleSelectAll(filtered)}
                              className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                              title="Selecionar todos"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left w-40"><ThBtn col="status" label="Status" /></th>
                        <th className="px-4 py-3 text-left w-1/3"><ThBtn col="name" label="Nome do Disparo" /></th>
                        <th className="px-4 py-3 text-left">Modelo Utilizado</th>
                        <th className="px-4 py-3 text-left w-64">Tags Alvo (Público)</th>
                        <th className="px-4 py-3 text-right w-28 text-xs font-semibold text-[#475569] uppercase tracking-wide">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8E0EA]">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={canManageBlastStatuses ? 6 : 5} className="px-4 py-12 text-center text-sm text-[#475569]">
                            Nenhum disparo em massa encontrado com esse filtro ou busca.
                          </td>
                        </tr>
                      ) : (
                        filtered.map(c => (
                          <tr
                            key={c.id}
                            className={`hover:bg-[#F7FAFF] transition-colors group ${
                              selectedIds.has(c.id) ? 'bg-[#F7FAFF]/80' : ''
                            }`}
                          >
                            {canManageBlastStatuses && (
                              <td className="px-4 py-3 text-left w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(c.id)}
                                  onChange={() => handleSelectRow(c.id)}
                                  className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                                />
                              </td>
                            )}
                            {/* Status */}
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${STATUS_STYLES[c.status]} border-current/10`}>
                                {c.status === 'cancelled' ? 'paused' : c.status}
                              </span>
                            </td>
                            {/* Name */}
                            <td className="px-4 py-3 font-semibold text-[#002B6A] whitespace-nowrap truncate max-w-[240px]">
                              {c.name}
                            </td>
                            {/* Template */}
                            <td className="px-4 py-3 text-[#061A40] truncate max-w-[200px]">
                              {getTemplateName(c)}
                            </td>
                            {/* Tags badges */}
                            <td className="px-4 py-3">
                              {c.target_tags && c.target_tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.target_tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#EAF2FF] text-[#2D6BFF] border border-[#2D6BFF]/10">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#475569]/50 italic text-xs">Todos os contatos</span>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex justify-end items-center gap-2">
                                {canManageBlastStatuses && c.status !== 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerBlast(c)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                    title="Disparar Agora"
                                  >
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                    <span>Disparar</span>
                                  </button>
                                )}
                                {canEditBlast(c) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCampaignToEdit(c);
                                      setIsModalOpen(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded transition-all cursor-pointer"
                                    title="Editar Blast"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
                                {canManageBlastStatuses && (
                                  <button
                                    type="button"
                                    onClick={() => setCampaignToDelete(c)}
                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                    title="Excluir Blast"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#D8E0EA] text-xs text-[#475569]">
                  {filtered.length} de {campaigns.length} disparos
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Sent Logs view */
        <div className="bg-white rounded-2xl border border-[#D8E0EA] overflow-hidden shadow-sm">
          {/* Search bar for logs */}
          <div className="px-4 py-3 border-b border-[#D8E0EA] flex items-center justify-between gap-3">
            <input
              type="text"
              value={logsSearch}
              onChange={e => setLogsSearch(e.target.value)}
              placeholder="Buscar destinatário, e-mail ou campanha..."
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                <tr>
                  <th className="px-4 py-3 text-left w-28">Status</th>
                  <th className="px-4 py-3 text-left">Destinatário</th>
                  <th className="px-4 py-3 text-left">Disparo</th>
                  <th className="px-4 py-3 text-left">Modelo Utilizado</th>
                  <th className="px-4 py-3 text-left w-56">Data de Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E0EA]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#475569]">
                      Nenhum e-mail enviado encontrado no histórico.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(job => (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/inbox?tab=sent&id=${job.id}`)}
                      className="hover:bg-[#F7FAFF] transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${
                          job.status === 'sent' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          job.status === 'replied' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          job.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          job.status === 'sending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-blue-50 text-[#2D6BFF] border border-blue-100'
                        }`}>
                          {job.status === 'replied' ? 'sent' : job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#002B6A]">{job.contacts?.name || '—'}</div>
                        <div className="text-xs text-[#475569]">{job.contacts?.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-[#061A40] font-medium">
                        {job.campaigns?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        {job.templates?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#475569] whitespace-nowrap">
                        <div>{job.sent_at ? new Date(job.sent_at).toLocaleString('pt-BR') : '—'}</div>
                        {job.error_message && (
                          <div className="text-[10px] text-rose-500 font-semibold mt-0.5 max-w-[240px] truncate" title={job.error_message}>
                            {job.error_message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-in Modal */}
      {canCreateBlast && (
        <CampaignModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setCampaignToEdit(null);
          }}
          templates={templates}
          campaignToEdit={campaignToEdit}
          availableTags={availableTags}
          smtpSettingsList={smtpSettingsList}
          canManageStatus={canManageBlastStatuses}
          mode="blast"
        />
      )}

      {/* Delete Confirmation Modal */}
      {campaignToDelete && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#061A40]/30 z-[300] transition-opacity"
            onClick={() => setCampaignToDelete(null)}
          />

          {/* Modal Container */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-2xl z-[301] space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#002B6A]">Excluir Disparo</h3>
              <p className="text-sm text-[#475569] mt-1">
                Tem certeza que deseja excluir o disparo <strong className="text-[#061A40]">{campaignToDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCampaignToDelete(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-[#475569] bg-[#F7FAFF] hover:bg-[#EAF2FF] border border-[#D8E0EA] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  setDeleteError(null);
                  const result = await deleteCampaign(campaignToDelete.id);
                  setIsDeleting(false);
                  if (result?.error) {
                    setDeleteError(result.error);
                  } else {
                    setCampaignToDelete(null);
                    router.refresh();
                  }
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo…</>
                ) : (
                  <>Excluir Disparo</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Immediate trigger modal */}
      {isTriggerModalOpen && triggerCampaignId && (
        <SendSuccessModal
          isOpen={isTriggerModalOpen}
          campaignId={triggerCampaignId}
          onClose={() => {
            setIsTriggerModalOpen(false);
            setTriggerCampaignId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

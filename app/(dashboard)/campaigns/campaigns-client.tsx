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

const WEEKDAYS_SHORT = [
  { key: 0, label: 'D' },
  { key: 1, label: 'S' },
  { key: 2, label: 'T' },
  { key: 3, label: 'Q' },
  { key: 4, label: 'Q' },
  { key: 5, label: 'S' },
  { key: 6, label: 'S' },
];

function RenderSchedule({ days, time, dispatchType }: { days: number[]; time: string; dispatchType?: 'scheduled' | 'immediate' }) {
  if (dispatchType === 'immediate') {
    return (
      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
        Disparo Imediato
      </span>
    );
  }
  if (!days || days.length === 0) return <span className="text-[#475569]/50 italic text-xs">No schedule</span>;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5">
        {WEEKDAYS_SHORT.map((day) => {
          const isActive = days.includes(day.key);
          return (
            <span
              key={day.key}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all ${
                isActive
                  ? 'bg-[#2D6BFF]/10 text-[#2D6BFF] border-[#2D6BFF]/20 font-extrabold shadow-sm'
                  : 'bg-slate-50 text-slate-300 border-slate-100'
              }`}
              title={isActive ? 'Active' : 'Inactive'}
            >
              {day.label}
            </span>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-[#002B6A] bg-[#EAF2FF] px-2 py-0.5 rounded-md border border-[#D8E0EA]">
        {time}
      </span>
    </div>
  );
}

interface CampaignsClientProps {
  campaigns: Campaign[];
  templates: Template[];
  availableTags: string[];
  smtpSettingsList: SmtpSettings[];
  emailJobs: any[];
  role: WorkspaceRole;
}

export default function CampaignsClient({
  campaigns,
  templates,
  availableTags,
  smtpSettingsList,
  emailJobs = [],
  role,
}: CampaignsClientProps) {
  const router = useRouter();
  const canCreateCampaign = role !== 'viewer';
  const canManageCampaignStatuses = canManageCampaigns(role);
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
  const [activeTab, setActiveTab] = useState<'campaigns' | 'sent_logs'>('campaigns');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [logsSearch, setLogsSearch] = useState('');

  // Trigger campaign states
  const [triggerCampaignId, setTriggerCampaignId] = useState<string | null>(null);
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);

  const handleTriggerCampaign = async (campaign: Campaign) => {
    if (campaign.status === 'draft' || campaign.status === 'cancelled') {
      const updateResult = await bulkUpdateCampaignStatus([campaign.id], 'running');
      if (updateResult?.error) {
        alert('Erro ao ativar campanha: ' + updateResult.error);
        return;
      }
    }
    setTriggerCampaignId(campaign.id);
    setIsTriggerModalOpen(true);
  };

  const handleSelectRow = (id: string) => {
    if (!canManageCampaignStatuses) return;
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
    if (!canManageCampaignStatuses) return;
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
    if (!canManageCampaignStatuses) return;
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
    if (!canManageCampaignStatuses) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} campaigns?`)) {
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
    // Check embedded template or lookup in templates array
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
      if (campaignFilter === 'active') {
        if (c.status !== 'running' && c.status !== 'queued') return false;
      } else if (campaignFilter === 'paused') {
        if (c.status !== 'cancelled' && c.status !== 'draft') return false;
      } else if (campaignFilter === 'completed') {
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
      // If using the default sort (created_at desc), prioritize active statuses first
      if (sortKey === 'created_at' && sortDir === 'desc') {
        const prioA = getStatusPriority(a.status);
        const prioB = getStatusPriority(b.status);
        if (prioA !== prioB) {
          return prioA - prioB; // Lower priority number (active) goes on top
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

  const canEditCampaign = (campaign: Campaign) => {
    if (campaign.status === 'completed') return false;
    return canManageCampaignStatuses || (role === 'member' && campaign.status === 'draft');
  };

  return (
    <div className="space-y-6">


      {/* Navigation Tabs */}
      <div className="flex border-b border-[#D8E0EA] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-[#2D6BFF] text-[#2D6BFF]'
              : 'border-transparent text-[#475569]/70 hover:text-[#002B6A]'
          }`}
        >
          Campanhas
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

      {activeTab === 'campaigns' ? (
        <>
          {campaigns.length === 0 ? (
            /* Empty State */
            <div className="glass-card rounded-2xl border border-[#D8E0EA] text-center py-32 max-w-xl mx-auto space-y-4">
              <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto">
                <Send className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#002B6A]">No campaigns found</h3>
                <p className="text-xs text-[#475569] max-w-[280px] mx-auto leading-normal">
                  Your campaign list is empty. Click <strong>Create Campaign</strong> to configure your first outreach list.
                </p>
              </div>
              {canCreateCampaign && (
                <button
                  onClick={() => {
                    setCampaignToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Create First Campaign
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
                  { key: 'paused', label: 'Pausadas/Rascunho' },
                  { key: 'completed', label: 'Concluídas' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setCampaignFilter(f.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      campaignFilter === f.key
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
                    {canManageCampaignStatuses && (
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
                            'Actions'
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
                                Activate (Set Running)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBulkStatusChange('cancelled')}
                                className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                              >
                                Pause (Set Cancelled)
                              </button>
                              <hr className="border-[#D8E0EA] my-1" />
                              <button
                                type="button"
                                onClick={handleBulkDelete}
                                className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
                              >
                                Delete Selected
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
                      placeholder="Search by campaign name or template…"
                      className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                      <span className="text-xs text-[#475569] font-semibold bg-[#EAF2FF] px-2.5 py-1 rounded-full border border-[#2D6BFF]/20">
                        {selectedIds.size} selected
                      </span>
                    )}
                    {canCreateCampaign && (
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignToEdit(null);
                          setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-[#2D6BFF]/30 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Campaign
                      </button>
                    )}
                  </div>
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
                        {canManageCampaignStatuses && (
                          <th className="px-4 py-3 text-left w-10">
                            <input
                              type="checkbox"
                              checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
                              onChange={() => handleSelectAll(filtered)}
                              className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                              title="Select all"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left w-40"><ThBtn col="status" label="Status" /></th>
                        <th className="px-4 py-3 text-left w-1/3"><ThBtn col="name" label="Campaign Name" /></th>
                        <th className="px-4 py-3 text-left">Email Template</th>
                        <th className="px-4 py-3 text-left w-64"><ThBtn col="created_at" label="Schedule" /></th>
                        <th className="px-4 py-3 text-right w-28 text-xs font-semibold text-[#475569] uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D8E0EA]">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={canManageCampaignStatuses ? 6 : 5} className="px-4 py-12 text-center text-sm text-[#475569]">
                            Nenhuma campanha encontrada com esse filtro ou busca.
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
                            {canManageCampaignStatuses && (
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
                            {/* Schedule */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <RenderSchedule days={c.schedule_days} time={c.schedule_time} dispatchType={c.dispatch_type} />
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex justify-end items-center gap-2">
                                {canManageCampaignStatuses && c.status !== 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerCampaign(c)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                    title="Disparar Campanha"
                                  >
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                    <span>Disparar</span>
                                  </button>
                                )}
                                {canEditCampaign(c) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCampaignToEdit(c);
                                      setIsModalOpen(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded transition-all cursor-pointer"
                                    title="Edit Campaign"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
                                {canManageCampaignStatuses && (
                                  <button
                                    type="button"
                                    onClick={() => setCampaignToDelete(c)}
                                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                    title="Delete Campaign"
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
                  {filtered.length} of {campaigns.length} campaigns
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
                  <th className="px-4 py-3 text-left">Campanha</th>
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
      {canCreateCampaign && (
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
          canManageStatus={canManageCampaignStatuses}
          mode="campaign"
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
              <h3 className="text-lg font-bold text-[#002B6A]">Delete Campaign</h3>
              <p className="text-sm text-[#475569] mt-1">
                Are you sure you want to delete campaign <strong className="text-[#061A40]">{campaignToDelete.name}</strong>? This action cannot be undone.
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
                Cancel
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                ) : (
                  <>Delete Campaign</>
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

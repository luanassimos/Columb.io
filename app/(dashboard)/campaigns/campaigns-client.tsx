'use client';

import React, { useState } from 'react';
import { Campaign, Template, CampaignStatus, SmtpSettings } from '@/types';
import CampaignModal from '@/components/campaign-modal';
import { deleteCampaign, bulkUpdateCampaignStatus, bulkDeleteCampaigns } from '@/app/actions/campaign';
import { useRouter } from 'next/navigation';
import { Plus, Send, Edit2, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

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

function RenderSchedule({ days, time }: { days: number[]; time: string }) {
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
}

export default function CampaignsClient({
  campaigns,
  templates,
  availableTags,
  smtpSettingsList,
}: CampaignsClientProps) {
  const router = useRouter();
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

  const handleSelectRow = (id: string) => {
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

  const filtered = campaigns
    .filter(c => {
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
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Campaigns</h1>
          <p className="text-sm text-[#475569] mt-1">
            Build drip outreach sequences, launch cold mail campaigns, and oversee automation lists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCampaignToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-[#2D6BFF]/30"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

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
          <button
            onClick={() => {
              setCampaignToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all"
          >
            <Plus className="h-4 w-4" /> Create First Campaign
          </button>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-2xl border border-[#D8E0EA] overflow-hidden shadow-sm">
          {/* Search and Bulk Actions */}
          <div className="px-4 py-3 border-b border-[#D8E0EA] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              {/* Actions Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || isBulkProcessing}
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-white text-xs font-semibold text-[#002B6A] hover:bg-[#F7FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                        className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors"
                      >
                        Activate (Set Running)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkStatusChange('cancelled')}
                        className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors"
                      >
                        Pause (Set Cancelled)
                      </button>
                      <hr className="border-[#D8E0EA] my-1" />
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </>
                )}
              </div>

              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by campaign name or template…"
                className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
              />
            </div>
            
            {selectedIds.size > 0 && (
              <span className="text-xs text-[#475569] font-semibold bg-[#EAF2FF] px-2.5 py-1 rounded-full border border-[#2D6BFF]/20">
                {selectedIds.size} selected
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
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
                      onChange={() => handleSelectAll(filtered)}
                      className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                      title="Select all"
                    />
                  </th>
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
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#475569]">
                      No campaigns match your search.
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
                      <td className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => handleSelectRow(c.id)}
                          className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                        />
                      </td>
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
                        <RenderSchedule days={c.schedule_days} time={c.schedule_time} />
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCampaignToEdit(c);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded transition-all"
                            title="Edit Campaign"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCampaignToDelete(c)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                            title="Delete Campaign"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
      )}

      {/* Slide-in Modal */}
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
      />

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
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-[#475569] bg-[#F7FAFF] hover:bg-[#EAF2FF] border border-[#D8E0EA] transition-all"
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
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
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
    </div>
  );
}

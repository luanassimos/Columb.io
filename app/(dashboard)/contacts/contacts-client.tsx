'use client';

import React, { useState } from 'react';
import { Contact, ContactStatus } from '@/types';
import AddLeadModal from '@/components/add-lead-modal';
import ImportModal from '@/components/import-modal';
import LeadSearchModal from '@/components/lead-search-modal';
import { Plus, Upload, Users, ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Trash2, Loader2, Star, X, Mail, Phone, MapPin, Building, Globe, Search } from 'lucide-react';
import { deleteContact, updateContact, bulkDeleteContacts, bulkUpdateContactsStatus } from '@/app/actions/contact';
import { useRouter } from 'next/navigation';
import { hasPermission, WorkspaceRole } from '@/lib/permissions';

const STATUS_STYLES: Record<ContactStatus, string> = {
  new:       'bg-[#EAF2FF] text-[#2D6BFF]',
  contacted: 'bg-amber-50 text-amber-600',
  waiting:   'bg-orange-50 text-orange-600',
  replied:   'bg-emerald-50 text-emerald-600',
  converted: 'bg-teal-50 text-[#14B8A6]',
  closed:    'bg-[#F7FAFF] text-[#475569]',
};

type SortKey = 'name' | 'company' | 'email' | 'status' | 'imported_at' | 'rating';
type SortDir = 'asc' | 'desc';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface ContactsClientProps {
  contacts: Contact[];
  role: WorkspaceRole;
}

export default function ContactsClient({ contacts, role }: ContactsClientProps) {
  const router = useRouter();
  const canEditContacts = hasPermission(role, 'manageContacts');
  const canDeleteContacts = hasPermission(role, 'deleteContacts');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  
  // Bulk selection and actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  
  // Delete Confirmation States
  const [leadToDelete, setLeadToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Profile Drawer States
  const [selectedLead, setSelectedLead] = useState<Contact | null>(null);
  const [isUpdatingRating, setIsUpdatingRating] = useState(false);
  const [drawerNotes, setDrawerNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Sync selectedLead when contacts list updates or lead selection changes
  React.useEffect(() => {
    if (selectedLead) {
      const updated = contacts.find(c => c.id === selectedLead.id);
      if (updated) {
        setSelectedLead(updated);
        setDrawerNotes(updated.notes || '');
      } else {
        setSelectedLead(null);
      }
    } else {
      setDrawerNotes('');
    }
  }, [contacts, selectedLead]);

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    if (drawerNotes === (selectedLead.notes || '')) return;

    setIsSavingNotes(true);
    const result = await updateContact({
      id: selectedLead.id,
      name: selectedLead.name,
      company: selectedLead.company,
      email: selectedLead.email,
      phone: selectedLead.phone || undefined,
      city: selectedLead.city || undefined,
      linkedin_url: selectedLead.linkedin_url || undefined,
      tags: selectedLead.tags,
      status: selectedLead.status,
      rating: selectedLead.rating,
      notes: drawerNotes,
      website: selectedLead.website || undefined,
      maps_url: selectedLead.maps_url || undefined,
    });
    setIsSavingNotes(false);
    if (!result.error) {
      router.refresh();
    } else {
      alert('Erro ao salvar observações: ' + result.error);
    }
  };

  const handleSelectRow = (id: string) => {
    if (!canEditContacts) return;
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

  const handleSelectAll = (filteredRows: Contact[]) => {
    if (!canEditContacts) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const allSelected = filteredRows.length > 0 && filteredRows.every(c => prev.has(c.id));
      if (!allSelected) {
        filteredRows.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  const handleBulkStatusChange = async (status: ContactStatus) => {
    if (!canEditContacts) return;
    setIsBulkProcessing(true);
    setBulkError(null);
    setIsActionsOpen(false);

    const idsArray = Array.from(selectedIds);
    const result = await bulkUpdateContactsStatus(idsArray, status);

    setIsBulkProcessing(false);
    if (result?.error) {
      setBulkError(result.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleBulkDelete = async () => {
    if (!canDeleteContacts) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} leads?`)) {
      return;
    }

    setIsBulkProcessing(true);
    setBulkError(null);
    setIsActionsOpen(false);

    const idsArray = Array.from(selectedIds);
    const result = await bulkDeleteContacts(idsArray);

    setIsBulkProcessing(false);
    if (result?.error) {
      setBulkError(result.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!selectedLead) return;
    setIsUpdatingRating(true);
    const res = await updateContact({
      id: selectedLead.id,
      name: selectedLead.name,
      company: selectedLead.company,
      email: selectedLead.email,
      phone: selectedLead.phone || undefined,
      city: selectedLead.city || undefined,
      linkedin_url: selectedLead.linkedin_url || undefined,
      tags: selectedLead.tags,
      status: selectedLead.status,
      rating: newRating,
      website: selectedLead.website || undefined,
      maps_url: selectedLead.maps_url || undefined,
    });
    setIsUpdatingRating(false);
    if (!res.error) {
      setSelectedLead({ ...selectedLead, rating: newRating });
      router.refresh();
    } else {
      alert('Erro ao atualizar classificação: ' + res.error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500 text-white',
      'bg-indigo-500 text-white',
      'bg-purple-500 text-white',
      'bg-teal-500 text-white',
      'bg-emerald-500 text-white',
      'bg-orange-500 text-white',
      'bg-pink-500 text-white',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const [activeTab, setActiveTab] = useState<'company' | 'professional'>('company');
  const [sortKey, setSortKey] = useState<SortKey>('imported_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const companyContactsCount = contacts.filter(c => !c.tags.includes('Professional Finder')).length;
  const professionalContactsCount = contacts.filter(c => c.tags.includes('Professional Finder')).length;

  const tabContacts = contacts.filter(c => {
    const isProfessional = c.tags.includes('Professional Finder');
    return activeTab === 'professional' ? isProfessional : !isProfessional;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = tabContacts
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.city?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'rating') {
        const av = a.rating || 0;
        const bv = b.rating || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const statusCounts = tabContacts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
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
      {/* Header & Actions */}
      <div className="flex justify-between items-center">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#D8E0EA] gap-2.5">
          <button
            onClick={() => {
              setActiveTab('company');
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'company'
                ? 'border-[#2D6BFF] text-[#2D6BFF]'
                : 'border-transparent text-[#475569] hover:text-[#002B6A] hover:border-slate-300'
            }`}
          >
            <Building className="h-4 w-4" />
            Company ({companyContactsCount})
          </button>
          <button
            onClick={() => {
              setActiveTab('professional');
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'professional'
                ? 'border-[#2D6BFF] text-[#2D6BFF]'
                : 'border-transparent text-[#475569] hover:text-[#002B6A] hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Professionals ({professionalContactsCount})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEditContacts && (
            <button type="button" onClick={() => setIsSearchModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-[#2D6BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm">
              <Search className="h-4 w-4" /> Buscar Leads
            </button>
          )}
          {canEditContacts && (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#F7FAFF] hover:bg-[#EAF2FF] border border-[#D8E0EA] text-[#002B6A] rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Upload className="h-4 w-4 text-[#2D6BFF]" />
              Importar CSV
            </button>
          )}
          {canEditContacts && (
            <button
              type="button"
              onClick={() => {
                setContactToEdit(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-[#2D6BFF]/30"
            >
              <Plus className="h-4 w-4" />
              Adicionar manualmente
            </button>
          )}
        </div>
      </div>

      {/* Status Summary Bar */}
      {tabContacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#002B6A] text-white">
            {tabContacts.length} total
          </span>
          {Object.entries(STATUS_STYLES).map(([status, style]) =>
            statusCounts[status] ? (
              <span key={status} className={`px-3 py-1 rounded-full text-xs font-semibold ${style}`}>
                {statusCounts[status]} {status}
              </span>
            ) : null
          )}
        </div>
      )}

      {tabContacts.length === 0 ? (
        /* Empty State */
        <div className="glass-card rounded-2xl border border-[#D8E0EA] text-center py-32 max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto">
            {activeTab === 'professional' ? <Users className="h-6 w-6" /> : <Building className="h-6 w-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#002B6A]">
              {activeTab === 'professional' ? 'Nenhum profissional cadastrado' : 'Nenhuma empresa cadastrada'}
            </h3>
            <p className="text-xs text-[#475569] max-w-[280px] mx-auto leading-normal">
              {activeTab === 'professional'
                ? 'Capture perfis profissionais ou adicione um lead manualmente para começar.'
                : 'Capture empresas ou adicione um lead manualmente para começar.'}
            </p>
          </div>
          {canEditContacts && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all"
            >
              <Plus className="h-4 w-4" /> Add First Lead
            </button>
          )}
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-2xl border border-[#D8E0EA] overflow-hidden shadow-sm">
          {/* Search & Actions */}
          <div className="px-4 py-3 border-b border-[#D8E0EA] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              {canEditContacts && (
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
                          onClick={() => handleBulkStatusChange('new')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Novo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStatusChange('contacted')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Contatado
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStatusChange('waiting')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Aguardando
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStatusChange('replied')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Respondido
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStatusChange('converted')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Convertido
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStatusChange('closed')}
                          className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors cursor-pointer"
                        >
                          Marcar como Fechado
                        </button>
                        {canDeleteContacts && (
                          <>
                            <hr className="border-[#D8E0EA] my-1" />
                            <button
                              type="button"
                              onClick={handleBulkDelete}
                              className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
                            >
                              Excluir Selecionados
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, company, email or city…"
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

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                <tr>
                  {canEditContacts && (
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
                  <th className="px-4 py-3 text-left"><ThBtn col="name" label={activeTab === 'professional' ? 'Professional' : 'Name'} /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="rating" label="Rating" /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="company" label={activeTab === 'professional' ? 'Role / Function' : 'Company'} /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">Segmento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">Score IA</th>
                  <th className="px-4 py-3 text-left"><ThBtn col="email" label="Email" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">Tags</th>
                  <th className="px-4 py-3 text-left"><ThBtn col="status" label="Status" /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="imported_at" label="Imported At" /></th>
                  {(canEditContacts || canDeleteContacts) && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#475569] uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E0EA]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9 + (canEditContacts ? 1 : 0) + (canEditContacts || canDeleteContacts ? 1 : 0)} className="px-4 py-12 text-center text-sm text-[#475569]">
                      No leads match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedLead(c)}
                      className="hover:bg-[#F7FAFF] transition-colors group cursor-pointer"
                    >
                      {canEditContacts && (
                        <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => handleSelectRow(c.id)}
                            className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* Name */}
                      <td className="px-4 py-3 font-semibold text-[#002B6A] whitespace-nowrap">
                        {c.name}
                      </td>
                      {/* Rating */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => {
                                updateContact({
                                  id: c.id,
                                  name: c.name,
                                  company: c.company,
                                  email: c.email,
                                  phone: c.phone || undefined,
                                  city: c.city || undefined,
                                  linkedin_url: c.linkedin_url || undefined,
                                  tags: c.tags,
                                  status: c.status,
                                  rating: star,
                                  website: c.website || undefined,
                                  maps_url: c.maps_url || undefined,
                                }).then(() => {
                                  router.refresh();
                                });
                              }}
                              className="text-amber-400 hover:scale-110 transition-transform focus:outline-none cursor-pointer"
                            >
                              <Star
                                className="h-3.5 w-3.5"
                                fill={star <= (c.rating || 0) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                              />
                            </button>
                          ))}
                        </div>
                      </td>
                      {/* Company */}
                      <td className="px-4 py-3 text-[#061A40] whitespace-nowrap">{c.company}</td>
                      <td className="px-4 py-3 text-xs text-[#475569]">{c.industry || c.tags?.[1] || '—'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(c.ai_fit_score) >= 70 ? 'bg-emerald-50 text-emerald-700' : Number(c.ai_fit_score) >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{c.ai_fit_score ?? '—'}</span></td>
                      {/* Email */}
                      <td className="px-4 py-3">
                        {c.email ? <a
                          href={`mailto:${c.email}`}
                          onClick={e => e.stopPropagation()}
                          className="text-[#2D6BFF] hover:underline text-xs"
                        >
                          {c.email}
                        </a> : <span className="text-xs text-[#475569]">Não encontrado</span>}
                      </td>
                      {/* Tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length > 0
                            ? c.tags.map(t => (
                                <span key={t} className="px-2 py-0.5 bg-[#EAF2FF] text-[#002B6A] text-[10px] font-semibold rounded-full">
                                  {t}
                                </span>
                              ))
                            : <span className="text-[#D8E0EA] text-xs">—</span>
                          }
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_STYLES[c.status]}`}>
                          {c.status}
                        </span>
                      </td>
                      {/* Imported At */}
                      <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">
                        {formatDate(c.imported_at)}
                      </td>
                      {/* Actions */}
                      {(canEditContacts || canDeleteContacts) && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-2">
                            {canEditContacts && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContactToEdit(c);
                                  setIsModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded transition-all"
                                title="Edit Lead"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {canDeleteContacts && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLeadToDelete(c);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                title="Delete Lead"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#D8E0EA] text-xs text-[#475569]">
            {filtered.length} of {tabContacts.length} leads
          </div>
        </div>
      )}

      {canEditContacts && (
        <>
          <AddLeadModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setContactToEdit(null);
            }}
            contactToEdit={contactToEdit}
          />

          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
          />
          <LeadSearchModal open={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
        </>
      )}

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#061A40]/30 z-[300] transition-opacity"
            onClick={() => setLeadToDelete(null)}
          />

          {/* Modal Container */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-2xl z-[301] space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#002B6A]">Delete Lead</h3>
              <p className="text-sm text-[#475569] mt-1">
                Are you sure you want to delete lead <strong className="text-[#061A40]">{leadToDelete.name}</strong> from <strong className="text-[#061A40]">{leadToDelete.company}</strong>? This action cannot be undone.
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
                onClick={() => setLeadToDelete(null)}
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
                  const result = await deleteContact(leadToDelete.id);
                  setIsDeleting(false);
                  if (result?.error) {
                    setDeleteError(result.error);
                  } else {
                    setLeadToDelete(null);
                    router.refresh();
                  }
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                ) : (
                  <>Delete Lead</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Profile Drawer */}
      {selectedLead && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#061A40]/30 z-[150] transition-opacity"
            onClick={() => setSelectedLead(null)}
          />

          {/* Drawer Container */}
          <div className="fixed right-0 top-0 h-full w-[400px] bg-white z-[151] shadow-2xl flex flex-col animate-slide-in-right border-l border-[#D8E0EA]">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#D8E0EA] flex justify-between items-start bg-slate-50/50">
              <h2 className="text-base font-bold text-[#002B6A]">Perfil do Lead</h2>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg text-[#475569] hover:text-[#002B6A] hover:bg-[#EAF2FF] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile Card */}
              <div className="text-center space-y-3 pb-6 border-b border-dashed border-[#D8E0EA]">
                <div className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center text-2xl font-extrabold shadow-sm ${getAvatarColor(selectedLead.name)}`}>
                  {getInitials(selectedLead.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#002B6A]">{selectedLead.name}</h3>
                  <p className="text-sm text-[#475569] flex items-center justify-center gap-1.5 mt-0.5 font-medium">
                    <Building className="h-4 w-4 text-[#475569]/60" />
                    {selectedLead.company}
                  </p>
                </div>

                {/* CRM Status badge */}
                <div className="pt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLES[selectedLead.status]}`}>
                    {selectedLead.status}
                  </span>
                </div>

                {/* Interactive Rating */}
                <div className="pt-2 space-y-1">
                  <span className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    Grau de Importância
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        disabled={isUpdatingRating}
                        onClick={() => handleRatingChange(star)}
                        className="text-amber-400 hover:scale-110 transition-transform focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <Star
                          className="h-6 w-6"
                          fill={star <= (selectedLead.rating || 0) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#002B6A] uppercase tracking-wider border-b border-[#D8E0EA] pb-1.5">
                  Informações de Contato
                </h4>

                <div className="space-y-3 text-sm">
                  {/* Email */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">E-mail</span>
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="text-[#2D6BFF] hover:underline font-semibold truncate block"
                      >
                        {selectedLead.email}
                      </a>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">Telefone</span>
                      <span className="font-semibold text-[#061A40] block">
                        {selectedLead.phone || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">Endereço / Localização</span>
                      {selectedLead.address || selectedLead.city ? (
                        <a
                          href={
                            selectedLead.maps_url ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${selectedLead.name} ${selectedLead.address || selectedLead.city || ''}`
                            )}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#2D6BFF] hover:underline block leading-snug text-xs"
                          title="Clique para abrir no Google Maps / Yelp"
                        >
                          {selectedLead.address || selectedLead.city}
                        </a>
                      ) : (
                        <span className="font-semibold text-[#061A40] block">—</span>
                      )}
                    </div>
                  </div>

                  {/* Website */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
                        <path d="M2 12h20" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">Site / Website</span>
                      {selectedLead.website ? (
                        <a
                          href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2D6BFF] hover:underline font-semibold block truncate"
                        >
                          {selectedLead.website}
                        </a>
                      ) : (
                        <span className="text-[#475569]/60 block">—</span>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn */}
                  {selectedLead.linkedin_url && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                          <rect x="2" y="9" width="4" height="12" />
                          <circle cx="4" cy="4" r="2" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">LinkedIn</span>
                        <a
                          href={selectedLead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2D6BFF] hover:underline font-semibold block truncate text-xs"
                        >
                          Ver perfil no LinkedIn
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Profile Google / Yelp / LinkedIn link */}
                  {(selectedLead.maps_url || selectedLead.linkedin_url) && !selectedLead.linkedin_url && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">
                          {selectedLead.maps_url?.includes('yelp')
                            ? 'Perfil no Yelp'
                            : selectedLead.maps_url?.includes('google')
                            ? 'Perfil no Google Maps'
                            : selectedLead.linkedin_url
                            ? 'Perfil no LinkedIn'
                            : 'Perfil Original'}
                        </span>
                        <a
                          href={selectedLead.maps_url || selectedLead.linkedin_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2D6BFF] hover:underline font-semibold block truncate text-xs"
                        >
                          Ver perfil original ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags & Metadata */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-[#002B6A] uppercase tracking-wider border-b border-[#D8E0EA] pb-1.5">
                  Segmentação & Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.tags.length > 0 ? (
                    selectedLead.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-[#EAF2FF] text-[#002B6A] text-xs font-semibold rounded-full"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[#475569]/60 italic">Nenhuma tag atribuída</span>
                  )}
                </div>

                {selectedLead.ai_fit_score != null && (
                  <div className="space-y-2 rounded-xl border border-[#D8E0EA] bg-[#F7FAFF] p-4">
                    <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-[#002B6A]">Avaliação da Columb</h4><span className="rounded-full bg-[#2D6BFF] px-3 py-1 text-sm font-bold text-white">{selectedLead.ai_fit_score}</span></div>
                    <p className="text-xs font-semibold capitalize text-[#2D6BFF]">{selectedLead.ai_fit_label} compatibilidade</p>
                    <p className="text-xs leading-relaxed text-[#475569]">{selectedLead.ai_fit_reason}</p>
                    {selectedLead.ai_opportunity_summary && <p className="text-xs leading-relaxed text-[#061A40]"><strong>Oportunidade:</strong> {selectedLead.ai_opportunity_summary}</p>}
                  </div>
                )}

                {/* Personal Notes / Observações */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between border-b border-[#D8E0EA] pb-1.5">
                    <h4 className="text-xs font-bold text-[#002B6A] uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-[#002B6A]/75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Anotações Pessoais
                    </h4>
                    {drawerNotes !== (selectedLead.notes || '') && (
                      <button
                        type="button"
                        disabled={isSavingNotes}
                        onClick={handleSaveNotes}
                        className="text-[10px] font-bold text-[#2D6BFF] hover:text-[#1b58ec] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isSavingNotes ? 'Salvando...' : 'Salvar'}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={drawerNotes}
                    onChange={(e) => setDrawerNotes(e.target.value)}
                    onBlur={handleSaveNotes}
                    placeholder="Escreva observações ou ideias sobre esta lead..."
                    rows={4}
                    className="w-full p-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-xs text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all resize-none font-medium"
                  />
                </div>

                <div className="pt-2 text-[10px] text-[#475569]/60 space-y-1">
                  <div className="flex justify-between">
                    <span>Importado em:</span>
                    <span>{formatDate(selectedLead.imported_at)}</span>
                  </div>
                  {selectedLead.last_contact_at && (
                    <div className="flex justify-between">
                      <span>Último contato:</span>
                      <span>{formatDate(selectedLead.last_contact_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            {canEditContacts && (
              <div className="p-6 border-t border-[#D8E0EA] bg-slate-50/50 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setContactToEdit(selectedLead);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 py-2 px-3 border border-[#D8E0EA] hover:border-[#2D6BFF]/30 hover:bg-[#EAF2FF] text-[#002B6A] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar Lead
                </button>
                {canDeleteContacts && (
                  <button
                    type="button"
                    onClick={() => {
                      setLeadToDelete(selectedLead);
                    }}
                    className="py-2 px-3 border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

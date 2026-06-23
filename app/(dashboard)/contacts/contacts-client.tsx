'use client';

import React, { useState } from 'react';
import { Contact, ContactStatus } from '@/types';
import AddLeadModal from '@/components/add-lead-modal';
import { Plus, Upload, Users, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Trash2, Loader2, Star, X, Mail, Phone, MapPin, Building } from 'lucide-react';
import { deleteContact, updateContact } from '@/app/actions/contact';
import { useRouter } from 'next/navigation';
import { hasPermission, WorkspaceRole } from '@/lib/permissions';

// lucide-react@1.18 removed the LinkedIn icon — using an inline SVG instead
const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

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
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  
  // Delete Confirmation States
  const [leadToDelete, setLeadToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Profile Drawer States
  const [selectedLead, setSelectedLead] = useState<Contact | null>(null);
  const [isUpdatingRating, setIsUpdatingRating] = useState(false);

  // Sync selectedLead when contacts list updates
  React.useEffect(() => {
    if (selectedLead) {
      const updated = contacts.find(c => c.id === selectedLead.id);
      if (updated) {
        setSelectedLead(updated);
      } else {
        setSelectedLead(null);
      }
    }
  }, [contacts]);

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

  const [sortKey, setSortKey] = useState<SortKey>('imported_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = contacts
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

  const statusCounts = contacts.reduce((acc, c) => {
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
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Leads</h1>
          <p className="text-sm text-[#475569] mt-1">
            Manage your leads, segment by tags, and import customer databases.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-[#F7FAFF] border border-[#D8E0EA] text-[#475569]/50 rounded-lg text-sm font-semibold cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            CSV Import
          </button>
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
              Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Status Summary Bar */}
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#002B6A] text-white">
            {contacts.length} total
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

      {contacts.length === 0 ? (
        /* Empty State */
        <div className="glass-card rounded-2xl border border-[#D8E0EA] text-center py-32 max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#002B6A]">No leads yet</h3>
            <p className="text-xs text-[#475569] max-w-[280px] mx-auto leading-normal">
              Click <strong>Add Lead</strong> to create your first lead manually.
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
          {/* Search */}
          <div className="px-4 py-3 border-b border-[#D8E0EA]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company, email or city…"
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                <tr>
                  <th className="px-4 py-3 text-left"><ThBtn col="name" label="Name" /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="rating" label="Rating" /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="company" label="Company" /></th>
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
                    <td colSpan={canEditContacts || canDeleteContacts ? 8 : 7} className="px-4 py-12 text-center text-sm text-[#475569]">
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
                      {/* Email */}
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${c.email}`}
                          onClick={e => e.stopPropagation()}
                          className="text-[#2D6BFF] hover:underline text-xs"
                        >
                          {c.email}
                        </a>
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
            {filtered.length} of {contacts.length} leads
          </div>
        </div>
      )}

      {canEditContacts && (
        <AddLeadModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setContactToEdit(null);
          }}
          contactToEdit={contactToEdit}
        />
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

                  {/* City */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[#475569]/70 shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-[#475569]/65 font-bold uppercase">Cidade</span>
                      <span className="font-semibold text-[#061A40] block">
                        {selectedLead.city || '—'}
                      </span>
                    </div>
                  </div>

                  {/* LinkedIn */}
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
                      {selectedLead.linkedin_url ? (
                        <a
                          href={selectedLead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2D6BFF] hover:underline font-semibold block truncate"
                        >
                          Ver perfil
                        </a>
                      ) : (
                        <span className="text-[#475569]/60 block">—</span>
                      )}
                    </div>
                  </div>
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

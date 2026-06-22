'use client';

import React, { useState } from 'react';
import { Contact, ContactStatus } from '@/types';
import AddLeadModal from '@/components/add-lead-modal';
import { Plus, Upload, Users, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Trash2, Loader2 } from 'lucide-react';
import { deleteContact } from '@/app/actions/contact';
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

type SortKey = 'name' | 'company' | 'email' | 'status' | 'imported_at';
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
                  <th className="px-4 py-3 text-left"><ThBtn col="company" label="Company" /></th>
                  <th className="px-4 py-3 text-left"><ThBtn col="email" label="Email" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">City</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wide">LinkedIn</th>
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
                    <td colSpan={canEditContacts || canDeleteContacts ? 10 : 9} className="px-4 py-12 text-center text-sm text-[#475569]">
                      No leads match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => (
                    <tr key={c.id} className="hover:bg-[#F7FAFF] transition-colors group">
                      {/* Name */}
                      <td className="px-4 py-3 font-semibold text-[#002B6A] whitespace-nowrap">
                        {c.name}
                      </td>
                      {/* Company */}
                      <td className="px-4 py-3 text-[#061A40] whitespace-nowrap">{c.company}</td>
                      {/* Email */}
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${c.email}`}
                          className="text-[#2D6BFF] hover:underline text-xs"
                        >
                          {c.email}
                        </a>
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{c.phone || '—'}</td>
                      {/* City */}
                      <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{c.city || '—'}</td>
                      {/* LinkedIn */}
                      <td className="px-4 py-3">
                        {c.linkedin_url ? (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#2D6BFF] hover:text-[#002B6A] transition-colors"
                            title={c.linkedin_url}
                          >
                            <LinkedinIcon className="h-4 w-4" />
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          <span className="text-[#D8E0EA]">—</span>
                        )}
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
                                onClick={() => {
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
                                onClick={() => setLeadToDelete(c)}
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
    </div>
  );
}

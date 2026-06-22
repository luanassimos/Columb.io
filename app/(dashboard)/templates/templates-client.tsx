'use client';

import React, { useState } from 'react';
import { Template } from '@/types';
import TemplateModal from '@/components/template-modal';
import { deleteTemplate } from '@/app/actions/template';
import { useRouter } from 'next/navigation';
import { Plus, Mail, Edit2, Trash2, Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { hasPermission, WorkspaceRole } from '@/lib/permissions';

type SortKey = 'name' | 'subject' | 'created_at';
type SortDir = 'asc' | 'desc';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface TemplatesClientProps {
  templates: Template[];
  role: WorkspaceRole;
}

export default function TemplatesClient({ templates, role }: TemplatesClientProps) {
  const router = useRouter();
  const canEditTemplates = hasPermission(role, 'manageTemplates');
  const canDeleteTemplates = hasPermission(role, 'deleteTemplates');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<Template | null>(null);

  // Sorting, filtering, searching
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  // Delete modal states
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = templates
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A]">Templates</h1>
          <p className="text-sm text-[#475569] mt-1">
            Create reusable email copy templates with dynamic variables.
          </p>
        </div>
        {canEditTemplates && (
          <button
            type="button"
            onClick={() => {
              setTemplateToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all shadow-sm shadow-[#2D6BFF]/30"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        /* Empty State */
        <div className="glass-card rounded-2xl border border-[#D8E0EA] text-center py-32 max-w-xl mx-auto space-y-4">
          <div className="h-12 w-12 rounded-full bg-[#EAF2FF] border border-[#D8E0EA] text-[#2D6BFF] flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#002B6A]">No templates found</h3>
            <p className="text-xs text-[#475569] max-w-[280px] mx-auto leading-normal">
              Your template list is empty. Click <strong>Create Template</strong> to build your first email template.
            </p>
          </div>
          {canEditTemplates && (
            <button
              onClick={() => {
                setTemplateToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-sm font-semibold transition-all"
            >
              <Plus className="h-4 w-4" /> Create First Template
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
              placeholder="Search by template name, subject or body content…"
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                <tr>
                  <th className="px-4 py-3 text-left w-1/4"><ThBtn col="name" label="Template Name" /></th>
                  <th className="px-4 py-3 text-left w-1/3"><ThBtn col="subject" label="Subject" /></th>
                  <th className="px-4 py-3 text-left">Body Preview</th>
                  <th className="px-4 py-3 text-left w-40"><ThBtn col="created_at" label="Created At" /></th>
                  {(canEditTemplates || canDeleteTemplates) && (
                    <th className="px-4 py-3 text-right w-28 text-xs font-semibold text-[#475569] uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E0EA]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canEditTemplates || canDeleteTemplates ? 5 : 4} className="px-4 py-12 text-center text-sm text-[#475569]">
                      No templates match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map(t => (
                    <tr key={t.id} className="hover:bg-[#F7FAFF] transition-colors group">
                      {/* Name */}
                      <td className="px-4 py-3 font-semibold text-[#002B6A] whitespace-nowrap truncate max-w-[200px]">
                        {t.name}
                      </td>
                      {/* Subject */}
                      <td className="px-4 py-3 text-[#061A40] truncate max-w-[240px]" title={t.subject}>
                        {t.subject}
                      </td>
                      {/* Body Preview */}
                      <td className="px-4 py-3 text-[#475569] text-xs truncate max-w-[300px]" title={t.body}>
                        {t.body}
                      </td>
                      {/* Created At */}
                      <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                      {/* Actions */}
                      {(canEditTemplates || canDeleteTemplates) && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-2">
                            {canEditTemplates && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateToEdit(t);
                                  setIsModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded transition-all"
                                title="Edit Template"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {canDeleteTemplates && (
                              <button
                                type="button"
                                onClick={() => setTemplateToDelete(t)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                title="Delete Template"
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
            {filtered.length} of {templates.length} templates
          </div>
        </div>
      )}

      {/* Slide-in Modal */}
      {canEditTemplates && (
        <TemplateModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTemplateToEdit(null);
          }}
          templateToEdit={templateToEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {templateToDelete && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#061A40]/30 z-[300] transition-opacity"
            onClick={() => setTemplateToDelete(null)}
          />

          {/* Modal Container */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-2xl z-[301] space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#002B6A]">Delete Template</h3>
              <p className="text-sm text-[#475569] mt-1">
                Are you sure you want to delete template <strong className="text-[#061A40]">{templateToDelete.name}</strong>? This action cannot be undone.
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
                onClick={() => setTemplateToDelete(null)}
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
                  const result = await deleteTemplate(templateToDelete.id);
                  setIsDeleting(false);
                  if (result?.error) {
                    setDeleteError(result.error);
                  } else {
                    setTemplateToDelete(null);
                    router.refresh();
                  }
                }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                ) : (
                  <>Delete Template</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

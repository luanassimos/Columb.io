'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target,
  Search,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  X,
  Trash2,
  Briefcase,
  Users,
  Award,
  Globe,
  Download,
  Send,
  SlidersHorizontal
} from 'lucide-react';
import { createLeadJob, importLeadsToContacts, deleteLeads, recalculateLeadsScore } from '@/app/actions/lead-finder';
import { WorkspaceRole } from '@/lib/permissions';

interface ProfessionalLead {
  id: string;
  display_name: string;
  professional_role: string;
  industry: string;
  location: string;
  profile_url: string;
  contact_channel: string;
  professional_score: number;
  lead_grade: 'A' | 'B' | 'C' | 'D';
  lead_origin: string;
  created_at: string;
}

interface ProfessionalFinderClientProps {
  initialLatestJob: any;
  initialLeads: ProfessionalLead[];
  role: WorkspaceRole;
}

type SortKey = 'display_name' | 'professional_role' | 'location' | 'professional_score' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function ProfessionalFinderClient({
  initialLatestJob,
  initialLeads,
  role,
}: ProfessionalFinderClientProps) {
  const router = useRouter();
  const [latestJob, setLatestJob] = useState<any>(initialLatestJob);
  const [leads, setLeads] = useState<ProfessionalLead[]>(initialLeads);

  // Sync leads from props
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Sync latestJob from props initially
  useEffect(() => {
    setLatestJob(initialLatestJob);
  }, [initialLatestJob]);

  // Form states
  const [category, setCategory] = useState(''); // Área de atuação / Cargo
  const [region, setRegion] = useState('');     // Cidade ou Região
  const [keywords, setKeywords] = useState(''); // Palavras-chave
  const [limitCount, setLimitCount] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Filters state
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [scoreFilter, setScoreFilter] = useState<number>(0);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isCancelling, setIsCancelling] = useState(false);
  const [showFormOverride, setShowFormOverride] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Polling for pending or running jobs
  useEffect(() => {
    if (!latestJob) return;
    const isJobActive = latestJob.status === 'pending' || latestJob.status === 'running';

    if (!isJobActive) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/lead-finder/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.job) {
            setLatestJob(data.job);
            if (data.job.status !== 'pending' && data.job.status !== 'running') {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              router.refresh();
            }
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [latestJob?.status, latestJob?.id, router]);

  const handleStartCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setImportSuccess(null);
    setImportError(null);

    if (!category.trim()) {
      setFormError('Por favor, preencha a Área de Atuação ou Cargo.');
      return;
    }

    setIsSubmitting(true);
    const result = await createLeadJob({
      category: category.trim(),
      region: region.trim() || undefined,
      keywords: keywords.trim() || undefined,
      limitCount,
      leadEntityType: 'professional',
    });
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else {
      setCategory('');
      setRegion('');
      setKeywords('');
      setShowFormOverride(false);
      try {
        const response = await fetch('/api/lead-finder/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.job) {
            setLatestJob(data.job);
          }
        }
      } catch (err) {
        console.error(err);
      }
      router.refresh();
    }
  };

  const handleCancelCapture = async () => {
    if (!latestJob) return;
    if (!confirm('Deseja realmente cancelar esta captura de profissionais?')) return;

    setIsCancelling(true);
    try {
      const response = await fetch('/api/lead-finder/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: latestJob.id }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLatestJob((prev: any) => ({ ...prev, status: 'cancelled' }));
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          router.refresh();
        } else {
          alert('Erro ao cancelar captura: ' + (data.error || 'Erro desconhecido'));
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro de conexão ao cancelar a captura.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Bulk Row Selection
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

  const handleSelectAll = (filteredRows: ProfessionalLead[]) => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const allSelected = filteredRows.length > 0 && filteredRows.every(c => prev.has(c.id));
      if (!allSelected) {
        filteredRows.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  // Export selected to CSV
  const handleExportCSV = () => {
    const selectedLeads = leads.filter(l => selectedIds.has(l.id));
    if (selectedLeads.length === 0) return;

    const headers = ['Nome', 'Cargo/Role', 'Setor/Área', 'Localização', 'URL Perfil', 'Canal de Contato', 'Score', 'Grade', 'Criado em'];
    const rows = selectedLeads.map(lead => [
      lead.display_name,
      lead.professional_role,
      lead.industry,
      lead.location,
      lead.profile_url,
      lead.contact_channel,
      lead.professional_score.toString(),
      lead.lead_grade,
      new Date(lead.created_at).toLocaleDateString()
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `columb-professionals-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsActionsOpen(false);
  };

  // Import selected to Campaigns/Contacts
  const handleImportToCampaign = async () => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    setIsActionsOpen(false);

    const res = await importLeadsToContacts(idsArray);
    setIsImporting(false);

    if (res.error) {
      setImportError(res.error);
    } else {
      setImportSuccess(`${res.count} profissionais importados para seus Contatos com sucesso!`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleDeleteBulkLeads = async () => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) return;

    if (!confirm(`Deseja realmente excluir os ${idsArray.length} profissionais selecionados permanentemente?`)) return;

    setIsDeleting(true);
    setIsActionsOpen(false);
    const res = await deleteLeads(idsArray);
    setIsDeleting(false);

    if (res.error) {
      alert('Erro ao excluir registros: ' + res.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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

  // Filter & Search Logic
  const filtered = leads
    .filter(l => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          l.display_name.toLowerCase().includes(q) ||
          l.professional_role.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (gradeFilter !== 'all' && l.lead_grade !== gradeFilter) return false;
      if (l.professional_score < scoreFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'professional_score') {
        return sortDir === 'asc' ? a.professional_score - b.professional_score : b.professional_score - a.professional_score;
      }
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filtered.slice(startIndex, endIndex);

  // Stats
  const totalLeadsCount = leads.length;
  const averageScore = totalLeadsCount > 0
    ? Math.round(leads.reduce((sum, current) => sum + (current.professional_score || 0), 0) / totalLeadsCount)
    : 0;
  const topOpportunities = leads.filter(l => l.professional_score >= 70).length;
  const activeChannels = leads.filter(l => !!l.contact_channel).length;

  const isJobActive = latestJob && (latestJob.status === 'pending' || latestJob.status === 'running');
  const isJobFinished = latestJob && (latestJob.status === 'completed' || latestJob.status === 'failed' || latestJob.status === 'cancelled');

  let currentStage: 'form' | 'status' | 'result' = 'form';
  if (isJobActive) {
    currentStage = 'status';
  } else if (isJobFinished && !showFormOverride) {
    currentStage = 'result';
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#002B6A] tracking-tight flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-[#2D6BFF]" />
            Captação de Profissionais
          </h2>
          <p className="text-sm text-[#475569] font-medium mt-1">
            Descubra perfis e oportunidades de trabalho qualificados para campanhas direcionadas.
          </p>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#D8E0EA] shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#2D6BFF] flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider">Perfis Captados</span>
            <span className="text-2xl font-extrabold text-[#002B6A]">{totalLeadsCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#D8E0EA] shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center shrink-0">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider">Score Médio</span>
            <span className="text-2xl font-extrabold text-[#002B6A]">{averageScore}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#D8E0EA] shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider">Melhores Oportunidades</span>
            <span className="text-2xl font-extrabold text-[#002B6A]">{topOpportunities}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#D8E0EA] shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider">Canais Ativos</span>
            <span className="text-2xl font-extrabold text-[#002B6A]">{activeChannels}</span>
          </div>
        </div>
      </div>

      {/* Main Flow Container */}
      <div className="transition-all duration-300">
        {currentStage === 'form' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#002B6A] mb-4 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[#2D6BFF]" />
              Iniciar Captura de Oportunidades
            </h3>

            <form onSubmit={handleStartCapture} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#002B6A]">Área de Atuação ou Cargo</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="ex: Personal Trainer, Nutricionista, Designer"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#002B6A]">Cidade ou Região (Opcional)</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="ex: São Paulo, Rio de Janeiro"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#002B6A]">Palavras-chave Extras (Opcional)</label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="ex: pilates, musculação, crossfit"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label className="text-xs font-semibold text-[#002B6A] shrink-0">Quantidade Máxima</label>
                  <select
                    value={limitCount}
                    onChange={(e) => setLimitCount(Number(e.target.value))}
                    className="px-3 py-2 text-xs rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                  >
                    <option value={10}>10 perfis</option>
                    <option value={20}>20 perfis</option>
                    <option value={50}>50 perfis</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Buscar Profissionais
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{formError}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {currentStage === 'status' && latestJob && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-b from-[#F7FAFF] to-[#EAF2FF] border border-[#D8E0EA] flex items-center justify-center relative overflow-hidden">
              <Loader2 className="h-10 w-10 text-[#2D6BFF] animate-spin" />
            </div>

            <div className="flex-1 w-full space-y-3">
              <h3 className="text-lg font-bold text-[#002B6A]">Buscando Perfis Profissionais</h3>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-[#475569] uppercase tracking-wider">Busca Ativa:</span>
                  <span className="text-sm font-bold text-[#002B6A]">
                    &quot;{latestJob.category}&quot; {latestJob.region ? `em "${latestJob.region}"` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Extraindo ({latestJob.progress_count} / {latestJob.limit_count})
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelCapture}
                    disabled={isCancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStage === 'result' && latestJob && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#002B6A]">Busca de Profissionais Concluída!</h3>
                <p className="text-xs text-[#475569]">
                  Extraídos {latestJob.progress_count} perfis para a função &quot;{latestJob.category}&quot;.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFormOverride(true)}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              Iniciar Nova Captura
            </button>
          </div>
        )}
      </div>

      {/* Leads Table Card */}
      <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm space-y-4">
        {/* Table Filters & Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cargo ou localização..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-[#D8E0EA] focus:outline-none focus:border-[#2D6BFF] bg-slate-50 focus:bg-white transition-all placeholder-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                isFiltersOpen
                  ? 'bg-slate-100 border-slate-300 text-[#002B6A]'
                  : 'bg-white border-[#D8E0EA] text-[#475569] hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros Avançados
            </button>

            {/* Actions Menu */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImportToCampaign}
                  disabled={isImporting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2D6BFF] text-white hover:bg-[#1b58ec] text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Importar para Contatos ({selectedIds.size})
                </button>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D8E0EA] bg-white text-[#475569] hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </button>

                <button
                  onClick={handleDeleteBulkLeads}
                  disabled={isDeleting}
                  className="flex items-center justify-center h-8.5 w-8.5 rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                  title="Excluir Selecionados"
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Extended Filters Drawer */}
        {isFiltersOpen && (
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#002B6A]">Filtrar por Qualidade (Grade)</label>
              <select
                value={gradeFilter}
                onChange={(e: any) => setGradeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D8E0EA] bg-white text-[#061A40]"
              >
                <option value="all">Todas as Grades</option>
                <option value="A">Apenas Grade A</option>
                <option value="B">Grade A e B</option>
                <option value="C">Grade C ou melhor</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#002B6A]">Score Mínimo: {scoreFilter}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={scoreFilter}
                onChange={(e) => setScoreFilter(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2D6BFF]"
              />
            </div>
          </div>
        )}

        {/* Success/Error Alerts */}
        {importSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}
        {importError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto border border-[#D8E0EA] rounded-xl">
          <table className="w-full border-collapse text-sm text-[#061A40]">
            <thead>
              <tr className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
                    onChange={() => handleSelectAll(filtered)}
                    className="h-4 w-4 rounded border-slate-300 text-[#2D6BFF] focus:ring-[#2D6BFF] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left"><ThBtn col="display_name" label="Nome" /></th>
                <th className="px-4 py-3 text-left"><ThBtn col="professional_role" label="Cargo / Função" /></th>
                <th className="px-4 py-3 text-left"><ThBtn col="location" label="Localização" /></th>
                <th className="px-4 py-3 text-center"><ThBtn col="professional_score" label="Score" /></th>
                <th className="px-4 py-3 text-left">Canal / Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-[#F7FAFF]/50 transition-colors ${
                        isSelected ? 'bg-[#EAF2FF]/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(lead.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#2D6BFF] focus:ring-[#2D6BFF] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-[#002B6A]">
                        {lead.display_name}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {lead.professional_role}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium text-xs">
                        {lead.location}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-black ${
                          lead.lead_grade === 'A' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          lead.lead_grade === 'B' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          lead.lead_grade === 'C' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {lead.professional_score}% ({lead.lead_grade})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.profile_url ? (
                          <a
                            href={lead.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#2D6BFF] hover:underline font-semibold"
                          >
                            LinkedIn Perfil
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Sem Link</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#475569]/80 font-medium">
                    Nenhum profissional capturado ou correspondente à busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold text-[#475569]">
              Página {currentPage} de {totalPages} ({filtered.length} resultados)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 text-xs font-bold border border-[#D8E0EA] rounded-lg bg-white text-[#475569] hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 text-xs font-bold border border-[#D8E0EA] rounded-lg bg-white text-[#475569] hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

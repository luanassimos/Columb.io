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
  SlidersHorizontal,
  MapPin
} from 'lucide-react';
import { createLeadJob, importLeadsToContacts, deleteLeads } from '@/app/actions/lead-finder';
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

const SUGGESTED_ROLES_PT = [
  "Desenvolvedor de Software", "Personal Trainer", "Nutricionista", "Designer Gráfico",
  "Gerente de Projetos", "Social Media", "Psicólogo", "Fisioterapeuta", "Fotógrafo",
  "Corretor de Imóveis", "Advogado", "Contador", "Engenheiro Civil", "Arquiteto",
  "Professor de Inglês", "Consultor de Vendas", "Esteticista", "Copywriter", "Gestor de Tráfego"
];

const SUGGESTED_ROLES_EN = [
  "Software Developer", "Personal Trainer", "Nutritionist", "Graphic Designer",
  "Project Manager", "Social Media Manager", "Psychologist", "Physical Therapist", "Photographer",
  "Real Estate Agent", "Lawyer", "Accountant", "Civil Engineer", "Architect",
  "English Teacher", "Sales Consultant", "Esthetician", "Copywriter", "Traffic Manager"
];

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

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const rolesList = language === 'pt' ? SUGGESTED_ROLES_PT : SUGGESTED_ROLES_EN;
  const filteredRoles = rolesList.filter((cat) =>
    cat.toLowerCase().includes(category.toLowerCase())
  );

  // Semantic targeting precision state
  const [precision, setPrecision] = useState<'city' | 'state' | 'country'>('city');

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Detail Modal state
  const [activeLead, setActiveLead] = useState<ProfessionalLead | null>(null);

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

  // Advanced Geotargeted states (only for filling region and showing region on map)
  const [lat, setLat] = useState(-22.9068); // Default Rio de Janeiro
  const [lng, setLng] = useState(-43.1729);

  // Map instances states
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [markerInstance, setMarkerInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isMapClickRef = useRef(false);

  // Close category dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  const isJobActive = latestJob && (latestJob.status === 'pending' || latestJob.status === 'running');
  const isJobFinished = latestJob && (latestJob.status === 'completed' || latestJob.status === 'failed' || latestJob.status === 'cancelled');

  let currentStage: 'form' | 'status' | 'result' = 'form';
  if (isJobActive) {
    currentStage = 'status';
  } else if (isJobFinished && !showFormOverride) {
    currentStage = 'result';
  }

  // Inject Leaflet CSS dynamically on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize and remove map based on currentStage
  useEffect(() => {
    if (currentStage !== 'form') return;
    if (!mapContainerRef.current) return;

    let active = true;
    let map: any = null;
    let marker: any = null;

    // Load Leaflet dynamically to avoid SSR errors
    import('leaflet').then((L) => {
      if (!active) return;

      // Fix default marker icon path issue in Leaflet + NextJS
      const DefaultIcon = L.Icon.Default.prototype as any;
      delete DefaultIcon._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Create map instance
      map = L.map(mapContainerRef.current!).setView([lat, lng], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CartoDB',
      }).addTo(map);

      // Create marker (draggable to set region)
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);

      const reverseGeocode = async (latitude: number, longitude: number) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const address = data.address;
              const city = address.city || address.town || address.village || address.municipality;
              const suburb = address.suburb || address.neighbourhood || address.quarter;
              const state = address.state;
              
              let detectedRegion = '';
              if (suburb && city) {
                detectedRegion = `${suburb}, ${city}`;
              } else if (city) {
                detectedRegion = state ? `${city}, ${state}` : city;
              } else if (address.road) {
                detectedRegion = address.road;
              } else if (data.display_name) {
                detectedRegion = data.display_name.split(',').slice(0, 2).join(',').trim();
              }
              
              if (detectedRegion) {
                isMapClickRef.current = true;
                setRegion(detectedRegion);
              }
            }
          }
        } catch (err) {
          console.error('Erro ao fazer geocodificação reversa:', err);
        }
      };

      // Update state on marker drag
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        setLat(position.lat);
        setLng(position.lng);
        reverseGeocode(position.lat, position.lng);
      });

      // Update state and marker on map click
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);
        marker.setLatLng(e.latlng);
        reverseGeocode(clickLat, clickLng);
      });

      // Save instances
      setMapInstance(map);
      setMarkerInstance(marker);
    });

    return () => {
      active = false;
      if (map) {
        map.remove();
      }
      setMapInstance(null);
      setMarkerInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage]);

  // Synchronize Leaflet map instances with React states defensively
  useEffect(() => {
    if (!mapInstance) return;

    try {
      if (markerInstance) {
        const currentPos = markerInstance.getLatLng();
        if (currentPos.lat !== lat || currentPos.lng !== lng) {
          markerInstance.setLatLng([lat, lng]);
        }
      }
      
      // Smoothly pan map to new coordinates
      const mapCenter = mapInstance.getCenter();
      if (mapCenter.lat !== lat || mapCenter.lng !== lng) {
        mapInstance.panTo([lat, lng]);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar Leaflet:', err);
    }
  }, [lat, lng, mapInstance, markerInstance]);

  // Geocode region text to map coordinates
  useEffect(() => {
    if (isMapClickRef.current) {
      isMapClickRef.current = false;
      return;
    }
    if (!region || region.trim().length < 3) return;

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(region.trim())}&limit=1`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const first = data[0];
            const newLat = parseFloat(first.lat);
            const newLng = parseFloat(first.lon);
            setLat(newLat);
            setLng(newLng);
          }
        }
      } catch (err) {
        console.error('Erro na geocodificação da região:', err);
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [region]);




  const latestJobRef = useRef(latestJob);
  useEffect(() => {
    latestJobRef.current = latestJob;
  }, [latestJob]);

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
            const prevJob = latestJobRef.current;
            const oldProgress = prevJob?.progress_count || 0;
            const newProgress = data.job.progress_count || 0;
            const oldStatus = prevJob?.status;
            const newStatus = data.job.status;

            setLatestJob(data.job);

            // Fetch new leads dynamically during extraction when progress or status updates
            if (newProgress !== oldProgress || newStatus !== oldStatus) {
              router.refresh();
            }

            // If status completed or failed, stop polling
            if (data.job.status !== 'pending' && data.job.status !== 'running') {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
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
      setFormError('Por favor, preencha a Área Profissional.');
      return;
    }

    if (!region.trim()) {
      setFormError('Por favor, preencha a Região.');
      return;
    }

    setIsSubmitting(true);
    const result = await createLeadJob({
      category: category.trim(),
      region: region.trim() || undefined,
      keywords: precision,
      limitCount,
      leadEntityType: 'professional',
    });
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else {
      setCategory('');
      setRegion('');
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

  return (
    <div className="space-y-6">
      {/* Animation Styles */}
      <style>{`
        @keyframes drift {
          0% { left: -150px; }
          100% { left: 100%; }
        }
        .cloud-css {
          position: absolute;
          background: #ffffff;
          border-radius: 9999px;
          opacity: 0.85;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 -4px 8px rgba(0, 0, 0, 0.05);
          filter: blur(1px);
          pointer-events: none;
        }
        .cloud-css::before, .cloud-css::after {
          content: '';
          position: absolute;
          background: #ffffff;
          border-radius: 50%;
        }
        .cloud-css::before {
          width: 50%;
          height: 100%;
          top: -40%;
          left: 15%;
        }
        .cloud-css::after {
          width: 40%;
          height: 80%;
          top: -30%;
          right: 15%;
        }
        .cloud-1 {
          width: 80px;
          height: 30px;
          top: 15%;
          animation: drift 25s linear infinite;
        }
        .cloud-2 {
          width: 100px;
          height: 35px;
          top: 40%;
          animation: drift 35s linear infinite;
          animation-delay: 5s;
          opacity: 0.6;
        }
        .cloud-3 {
          width: 60px;
          height: 25px;
          top: 70%;
          animation: drift 20s linear infinite;
          animation-delay: 10s;
          opacity: 0.8;
        }
      `}</style>

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
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm w-full">
            <h3 className="text-base font-bold text-[#002B6A] mb-6 flex items-center gap-2 border-b border-[#D8E0EA] pb-3">
              <Sparkles className="h-4.5 w-4.5 text-[#2D6BFF]" />
              Iniciar Captura de Perfis Profissionais
            </h3>

            <form onSubmit={handleStartCapture} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Form Fields */}
              <div className="space-y-5">
                {/* Área Profissional */}
                <div className="space-y-1.5 relative" ref={dropdownRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-[#002B6A]">Área Profissional</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('pt');
                          setCategory('');
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-all cursor-pointer border ${
                          language === 'pt'
                            ? 'bg-[#2D6BFF] border-[#2D6BFF] text-white font-bold shadow-sm'
                            : 'bg-white border-[#D8E0EA] text-[#475569] hover:bg-slate-50'
                        }`}
                      >
                        PT-BR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('en');
                          setCategory('');
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-all cursor-pointer border ${
                          language === 'en'
                            ? 'bg-[#2D6BFF] border-[#2D6BFF] text-white font-bold shadow-sm'
                            : 'bg-white border-[#D8E0EA] text-[#475569] hover:bg-slate-50'
                        }`}
                      >
                        EN-US
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    placeholder="ex: Dentist, Software Developer"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all font-medium"
                  />
                  
                  {isCategoryDropdownOpen && filteredRoles.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#D8E0EA] rounded-xl shadow-lg z-50 py-1.5 animate-fade-in scrollbar-thin">
                      {filteredRoles.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] hover:text-[#002B6A] transition-colors font-semibold cursor-pointer"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Região */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#002B6A]">Região</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="ex: Miami, California, USA"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all font-medium"
                  />
                  <p className="text-[10px] text-[#475569]/70">
                    O mapa à direita irá se mover automaticamente ao preencher este campo.
                  </p>
                </div>

                {/* Grid: Precisão e Quantidade Máxima */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Precisão */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#002B6A]">Precisão</label>
                    <select
                      value={precision}
                      onChange={(e) => setPrecision(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-xs rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all font-semibold cursor-pointer"
                    >
                      <option value="city">Cidade</option>
                      <option value="state">Estado</option>
                      <option value="country">País</option>
                    </select>
                  </div>

                  {/* Quantidade Máxima */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#002B6A]">Quantidade Máxima</label>
                    <select
                      value={limitCount}
                      onChange={(e) => setLimitCount(Number(e.target.value))}
                      className="w-full px-3 py-2.5 text-xs rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all font-semibold cursor-pointer"
                    >
                      <option value={5}>5 perfis</option>
                      <option value={10}>10 perfis</option>
                      <option value={20}>20 perfis</option>
                      <option value={50}>50 perfis</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Buscar Oportunidades
                  </button>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Map */}
              <div className="space-y-1.5 flex flex-col justify-start gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-[#002B6A]">Área Geográfica Selecionada</label>
                  <span className="text-[10px] text-[#475569]/80 font-mono bg-slate-100 px-2 py-0.5 rounded">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </div>
                <div className="relative w-full aspect-square md:h-[280px] md:aspect-auto rounded-2xl border border-[#D8E0EA] bg-slate-50 overflow-hidden z-10">
                  <div 
                    ref={mapContainerRef} 
                    className="w-full h-full" 
                  />
                  {/* CSS Clouds Overlay */}
                  <div className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden">
                    <div className="cloud-css cloud-1" />
                    <div className="cloud-css cloud-2" />
                    <div className="cloud-css cloud-3" />
                  </div>
                </div>
              </div>
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
                <th className="px-4 py-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => setActiveLead(lead)}
                      className={`hover:bg-[#F7FAFF]/50 transition-colors group cursor-pointer ${
                        isSelected ? 'bg-[#EAF2FF]/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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

      {/* Lead Details Modal */}
      {activeLead && (
        <div className="fixed inset-0 bg-[#061A40]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div 
            className="fixed inset-0" 
            onClick={() => setActiveLead(null)} 
          />
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#D8E0EA] shadow-2xl overflow-hidden transform scale-100 transition-all duration-300 relative z-10">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#D8E0EA] bg-[#F7FAFF] flex justify-between items-center">
              <span className="text-xs font-extrabold text-[#2D6BFF] uppercase tracking-wider">Perfil Profissional</span>
              <button 
                type="button"
                onClick={() => setActiveLead(null)}
                className="p-1 rounded-md text-[#475569] hover:bg-slate-200 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Title & Badges */}
              <div>
                <h3 className="text-xl font-bold text-[#002B6A]">{activeLead.display_name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2.5 py-0.5 bg-[#EAF2FF] text-[#002B6A] text-[10px] font-semibold rounded-full border border-[#2D6BFF]/10">
                    {activeLead.professional_role}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-full">
                    {activeLead.location}
                  </span>
                </div>
              </div>

              {/* Data Fields */}
              <div className="space-y-4">
                {/* Sector / Industry */}
                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Setor ou Área</span>
                    <span className="block text-sm font-semibold text-[#002B6A]">{activeLead.industry}</span>
                  </div>
                </div>

                {/* Profile URL */}
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">URL do Perfil</span>
                    {activeLead.profile_url ? (
                      <a 
                        href={activeLead.profile_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block text-sm font-semibold text-[#2D6BFF] hover:underline truncate max-w-xs md:max-w-md"
                      >
                        {activeLead.profile_url}
                      </a>
                    ) : (
                      <span className="block text-sm text-[#475569]/60 italic">Não disponível</span>
                    )}
                  </div>
                </div>

                {/* Contact Channel */}
                <div className="flex items-start gap-3">
                  <Send className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Canal / Contato Direto</span>
                    <span className="block text-sm font-semibold text-[#002B6A] break-all">
                      {activeLead.contact_channel || 'Perfil Público'}
                    </span>
                  </div>
                </div>

                {/* Quality Score & Grade */}
                <div className="flex items-start gap-3">
                  <Award className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Nível de Oportunidade</span>
                    <span className="block text-sm font-bold text-[#002B6A]">
                      Score: {activeLead.professional_score}% (Grade {activeLead.lead_grade})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-[#D8E0EA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLead(null)}
                  className="px-4 py-2 bg-white border border-[#D8E0EA] text-[#475569] hover:bg-slate-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Deseja realmente excluir este profissional?')) {
                      setIsDeleting(true);
                      const res = await deleteLeads([activeLead.id]);
                      setIsDeleting(false);
                      if (res.error) {
                        alert(res.error);
                      } else {
                        setActiveLead(null);
                        router.refresh();
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir Registro
                </button>
              </div>
              
              {activeLead.profile_url && (
                <a
                  href={activeLead.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#2D6BFF] text-white hover:bg-[#1b58ec] text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Acessar Perfil
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

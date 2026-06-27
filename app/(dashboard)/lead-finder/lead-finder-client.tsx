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
  Download,
  Send,
  Globe,
  MapPin,
  Phone,
  Terminal,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  X,
  Trash2,
  Info
} from 'lucide-react';
import { createLeadJob, importLeadsToContacts, deleteLeads, recalculateLeadsScore } from '@/app/actions/lead-finder';
import { WorkspaceRole } from '@/lib/permissions';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  category: string;
  region: string;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
  email?: string | null;
  maps_url?: string | null;
  contact_quality?: number;
  contact_status?: 'pending' | 'completed' | 'failed';
  primary_contact?: string | null;
  contact_notes?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  lead_score?: number;
  lead_grade?: 'A' | 'B' | 'C' | 'D';
  scoring_version?: number;
}

interface LeadFinderClientProps {
  initialLatestJob: any;
  initialLeads: Lead[];
  role: WorkspaceRole;
}

type SortKey = 'name' | 'phone' | 'website' | 'address' | 'created_at' | 'lead_score';
type SortDir = 'asc' | 'desc';

const SUGGESTED_CATEGORIES_PT = [
  "Restaurante", "Foodtruck", "Advogado", "Clínica Odontológica", "Dentista", 
  "Imobiliária", "Salão de Beleza", "Academia", "Cafeteria", "Hamburgueria", 
  "Pizzaria", "Hotel", "Petshop", "Oficina Mecânica", "Contabilidade", 
  "Clínica Médica", "Clínica de Estética", "Spa", "Escola", "Coworking", 
  "Agência de Marketing", "Padaria", "Farmácia", "Floricultura"
];

const SUGGESTED_CATEGORIES_EN = [
  "Restaurant", "Food Truck", "Lawyer", "Dentist", "Real Estate", "Beauty Salon", 
  "Gym", "Coffee Shop", "Burger Joint", "Pizzeria", "Hotel", "Pet Shop", 
  "Auto Repair", "Accountant", "Medical Clinic", "Spa", "School", "Coworking", 
  "Marketing Agency", "Bakery", "Pharmacy", "Florist"
];

export default function LeadFinderClient({
  initialLatestJob,
  initialLeads,
  role,
}: LeadFinderClientProps) {
  const router = useRouter();
  const [latestJob, setLatestJob] = useState<any>(initialLatestJob);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  // Sync leads from props
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Form states
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [language, setLanguage] = useState<'pt' | 'en'>('pt');

  const categoriesList = language === 'pt' ? SUGGESTED_CATEGORIES_PT : SUGGESTED_CATEGORIES_EN;
  const filteredCategories = categoriesList.filter((cat) =>
    cat.toLowerCase().includes(category.toLowerCase())
  );
  const [limitCount, setLimitCount] = useState(10);
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [scoreFilter, setScoreFilter] = useState<'all' | 'only_a' | 'only_b_plus' | 'score_70' | 'score_50' | 'pending'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Advanced Geotargeted states
  const [lat, setLat] = useState(-22.9068); // Default Rio de Janeiro
  const [lng, setLng] = useState(-43.1729);
  const [radius, setRadius] = useState(5000); // 5km in meters

  // Map instances states
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [markerInstance, setMarkerInstance] = useState<any>(null);
  const [circleInstance, setCircleInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFormOverride, setShowFormOverride] = useState(false);
  const [showTerminalInfo, setShowTerminalInfo] = useState(false);

  // Pigeon search animation state (2 frames)
  const [pigeonFrame, setPigeonFrame] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setPigeonFrame((f) => (f === 1 ? 2 : 1));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const isJobActive = latestJob && (latestJob.status === 'pending' || latestJob.status === 'running');
  const isJobFinished = latestJob && (latestJob.status === 'completed' || latestJob.status === 'failed' || latestJob.status === 'cancelled');

  let currentStage: 'form' | 'status' | 'result' = 'form';
  if (isJobActive) {
    currentStage = 'status';
  } else if (isJobFinished && !showFormOverride) {
    currentStage = 'result';
  }

  const handleCancelCapture = async () => {
    if (!latestJob) return;
    if (!confirm('Deseja realmente cancelar esta captura de leads?')) return;

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
      } else {
        const errData = await response.json();
        alert('Erro ao cancelar captura: ' + (errData.error || response.statusText));
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro de conexão ao cancelar a captura.');
    } finally {
      setIsCancelling(false);
    }
  };

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
    let circle: any = null;

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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Create marker and circle
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      circle = L.circle([lat, lng], {
        radius: radius,
        color: '#2D6BFF',
        fillColor: '#2D6BFF',
        fillOpacity: 0.15,
        weight: 1.5,
      }).addTo(map);

      // Update state on marker drag
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        setLat(position.lat);
        setLng(position.lng);
      });

      // Update state and marker/circle on map click
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
      });

      // Save instances
      setMapInstance(map);
      setMarkerInstance(marker);
      setCircleInstance(circle);
    });

    return () => {
      active = false;
      if (map) {
        map.remove();
      }
      setMapInstance(null);
      setMarkerInstance(null);
      setCircleInstance(null);
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
      if (circleInstance) {
        const currentPos = circleInstance.getLatLng();
        if (currentPos.lat !== lat || currentPos.lng !== lng) {
          circleInstance.setLatLng([lat, lng]);
        }
        if (circleInstance.getRadius() !== radius) {
          circleInstance.setRadius(radius);
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
  }, [lat, lng, radius, mapInstance, markerInstance, circleInstance]);

  // Geocode region text to map coordinates
  useEffect(() => {
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
            
            if (mapInstance) {
              mapInstance.setView([newLat, newLng], 12);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao geocodificar região:', err);
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [region, mapInstance]);

  // Table filter and sort
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Reset page when filters or list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, scoreFilter, leads]);

  // Sync latestJob from props initially
  useEffect(() => {
    setLatestJob(initialLatestJob);
  }, [initialLatestJob]);

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

    if (pollingRef.current) return; // Already polling

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/lead-finder/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.job) {
            setLatestJob(data.job);
            // If status completed or failed, stop polling and refresh data
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
        console.error('Erro no polling do status do job:', err);
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
      setFormError('Por favor, preencha a Categoria.');
      return;
    }

    if (!region.trim()) {
      setFormError('Por favor, preencha a Cidade ou Região.');
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      setFormError('Por favor, forneça coordenadas geográficas válidas.');
      return;
    }

    setIsSubmitting(true);
    const result = await createLeadJob({
      category: category.trim(),
      region: region.trim() || undefined,
      limitCount,
      lat: !isNaN(lat) ? lat : undefined,
      lng: !isNaN(lng) ? lng : undefined,
      radius: radius || undefined,
      onlyEmail: onlyEmail,
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

  const handleSelectAll = (filteredRows: Lead[]) => {
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

    const headers = ['Nome', 'Telefone', 'Website', 'Endereço', 'Categoria', 'Região', 'Data de Captura'];
    const rows = selectedLeads.map(lead => [
      lead.name,
      lead.phone || '',
      lead.website || '',
      lead.address || '',
      lead.category,
      lead.region,
      new Date(lead.created_at).toLocaleDateString()
    ]);

    // Create CSV string with proper escaping
    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `columb-leads-${Date.now()}.csv`);
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
      setImportSuccess(`${res.count} leads importados para seus Contatos com sucesso!`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const handleDeleteSingleLead = async (leadId: string) => {
    if (!confirm('Deseja realmente excluir este lead permanentemente?')) return;
    
    setIsDeleting(true);
    const res = await deleteLeads([leadId]);
    setIsDeleting(false);
    
    if (res.error) {
      alert('Erro ao excluir lead: ' + res.error);
    } else {
      setActiveLead(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      router.refresh();
    }
  };

  const handleDeleteBulkLeads = async () => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) return;
    
    if (!confirm(`Deseja realmente excluir os ${idsArray.length} leads selecionados permanentemente?`)) return;
    
    setIsDeleting(true);
    setIsActionsOpen(false);
    const res = await deleteLeads(idsArray);
    setIsDeleting(false);
    
    if (res.error) {
      alert('Erro ao excluir leads: ' + res.error);
    } else {
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const [isRescoring, setIsRescoring] = useState(false);

  const handleRecalculateScores = async () => {
    setIsRescoring(true);
    setIsActionsOpen(false);
    const res = await recalculateLeadsScore();
    setIsRescoring(false);
    
    if (res.error) {
      alert('Erro ao recalcular scores: ' + res.error);
    } else {
      alert(`Scores recalculados com sucesso para ${res.count} leads.`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  // Table filtering and sorting
  const filtered = leads
    .filter(l => {
      // 1. Apply search filter
      if (search) {
        const q = search.toLowerCase();
        const matchSearch =
          l.name.toLowerCase().includes(q) ||
          (l.phone?.toLowerCase().includes(q) ?? false) ||
          (l.website?.toLowerCase().includes(q) ?? false) ||
          (l.address?.toLowerCase().includes(q) ?? false) ||
          l.category.toLowerCase().includes(q) ||
          l.region.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // 2. Apply lead score filters
      if (scoreFilter === 'only_a') {
        return l.lead_grade === 'A';
      }
      if (scoreFilter === 'only_b_plus') {
        return l.lead_grade === 'A' || l.lead_grade === 'B';
      }
      if (scoreFilter === 'score_70') {
        return (l.lead_score ?? 0) >= 70;
      }
      if (scoreFilter === 'score_50') {
        return (l.lead_score ?? 0) >= 50;
      }
      if (scoreFilter === 'pending') {
        return l.contact_status === 'pending';
      }

      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'lead_score') {
        const av = a.lead_score || 0;
        const bv = b.lead_score || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

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
  // Calculate dashboard stats
  const totalLeadsCount = leads.length;
  const bestLead = leads.reduce((best, current) => {
    return (current.lead_score || 0) > (best?.lead_score || 0) ? current : best;
  }, null as Lead | null);

  const averageScore = totalLeadsCount > 0
    ? Math.round(leads.reduce((sum, current) => sum + (current.lead_score || 0), 0) / totalLeadsCount)
    : 0;

  const leadsA = leads.filter(l => l.lead_grade === 'A').length;
  const leadsNoContact = leads.filter(l => !l.phone && !l.website && !l.email).length;

  // Pagination calculations
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filtered.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Animation Styles */}
      <style>{`
        @keyframes pigeon-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.02); }
        }
        @keyframes radar-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes scan-line {
          0% { transform: translateY(0px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(96px); opacity: 0; }
        }
        .animate-pigeon-float {
          animation: pigeon-float 2s ease-in-out infinite;
        }
        .animate-radar-pulse {
          animation: radar-pulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }
        .animate-scan-line {
          animation: scan-line 3s ease-in-out infinite;
        }
      `}</style>

      {/* Stages Panel (Form, Status, or Result) */}
      <div className="transition-all duration-300">
        {currentStage === 'form' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm w-full">
            <h3 className="text-base font-bold text-[#002B6A] mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="h-4.5 w-4.5 text-[#2D6BFF]" />
                Iniciar Nova Captura
              </span>
              <button
                type="button"
                onClick={() => setShowTerminalInfo(prev => !prev)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  showTerminalInfo
                    ? 'bg-[#EAF2FF] border-[#2D6BFF] text-[#2D6BFF] shadow-sm'
                    : 'bg-white border-[#D8E0EA] text-[#475569] hover:bg-slate-50'
                }`}
                title="Executar Worker Local"
              >
                <Info className="h-4 w-4" />
              </button>
            </h3>

            <form onSubmit={handleStartCapture} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Form Fields */}
              <div className="space-y-4">
                {/* Category */}
                <div className="space-y-1.5 relative" ref={dropdownRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-[#002B6A]">Categoria / Nicho</label>
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
                        title="Português"
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
                        title="English"
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
                    placeholder="ex: advogado, clínica odontológica, restaurante"
                    disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                  />
                  
                  {/* Autocomplete Dropdown list */}
                  {isCategoryDropdownOpen && filteredCategories.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#D8E0EA] rounded-xl shadow-lg z-50 py-1.5 animate-fade-in scrollbar-thin">
                      {filteredCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] hover:text-[#002B6A] transition-colors font-medium cursor-pointer"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Region Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#002B6A]">Cidade ou Região</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="ex: Rio de Janeiro, Barra da Tijuca"
                    disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                  />
                  <p className="text-[10px] text-[#475569]/70">
                    O mapa à direita irá se mover automaticamente ao preencher este campo.
                  </p>
                </div>

                {/* Limit results & Radius in a grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#002B6A]">Quantidade Máxima</label>
                    <select
                      value={limitCount}
                      onChange={(e) => setLimitCount(Number(e.target.value))}
                      disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                    >
                      <option value={10}>10 resultados</option>
                      <option value={50}>50 resultados</option>
                      <option value={100}>100 resultados</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-[#002B6A]">
                      <span>Raio de Busca</span>
                      <span className="text-[#2D6BFF] font-bold">{(radius / 1000).toFixed(0)} km</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="20000"
                      step="1000"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                      className="w-full h-1 mt-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#2D6BFF] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Checkbox: Apenas com E-mail */}
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="onlyEmail"
                    checked={onlyEmail}
                    onChange={(e) => setOnlyEmail(e.target.checked)}
                    disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                    className="h-4 w-4 rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] cursor-pointer"
                  />
                  <label htmlFor="onlyEmail" className="text-xs font-semibold text-[#002B6A] cursor-pointer select-none">
                    Apenas leads com e-mail de contato encontrado
                  </label>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Buscar Leads
                </button>
              </div>

              {/* Right Column: Map */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-[#002B6A]">Área Geográfica Selecionada</label>
                  <span className="text-[10px] text-[#475569]/80 font-mono bg-slate-100 px-2 py-0.5 rounded">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </div>
                <div 
                  ref={mapContainerRef} 
                  className="w-full aspect-square md:h-[280px] md:aspect-auto rounded-2xl border border-[#D8E0EA] bg-slate-50 overflow-hidden z-10" 
                />
              </div>
            </form>
          </div>
        )}

        {currentStage === 'status' && latestJob && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
            {/* Pigeon searching animation container */}
            <div className="shrink-0 w-24 h-24 rounded-2xl border border-[#D8E0EA] bg-gradient-to-b from-[#F7FAFF] to-[#EAF2FF] flex items-center justify-center relative overflow-hidden shadow-inner">
              {/* Radar waves */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-16 h-16 rounded-full border border-[#2D6BFF]/20 animate-radar-pulse" style={{ animationDelay: '0s' }} />
                <div className="absolute w-16 h-16 rounded-full border border-[#2D6BFF]/20 animate-radar-pulse" style={{ animationDelay: '1s' }} />
              </div>
              
              {/* Scan line effect */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#2D6BFF]/30 to-transparent animate-scan-line pointer-events-none" />
              
              {/* Stacked images for crossfade */}
              <div className="relative w-20 h-20">
                <img
                  src="/search_01.webp"
                  alt="Pombo Procurando"
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                    pigeonFrame === 1 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <img
                  src="/search_02.webp"
                  alt="Pombo Procurando"
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                    pigeonFrame === 2 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2D6BFF]/5 to-transparent pointer-events-none" />
            </div>

            <div className="flex-1 w-full space-y-4">
              <h3 className="text-lg font-bold text-[#002B6A]">Captura de Leads em Andamento</h3>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Busca:</span>
                    <span className="text-sm font-bold text-[#002B6A]">
                      &quot;{latestJob.category}&quot; {latestJob.region ? `em "${latestJob.region}"` : `via Geolocalização`}
                    </span>
                  </div>
                  <div className="text-xs text-[#475569]">
                    Criado em: {new Date(latestJob.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {latestJob.status === 'pending' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Pendente
                    </div>
                  )}

                  {latestJob.status === 'running' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-bold">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                      Executando ({latestJob.progress_count} / {latestJob.limit_count})
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCancelCapture}
                    disabled={isCancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Cancelar Captura
                  </button>
                </div>
              </div>

              {/* Progress bar for running */}
              {latestJob.status === 'running' && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#2D6BFF] h-2 transition-all duration-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (latestJob.progress_count / latestJob.limit_count) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-right text-[10px] text-[#475569] font-medium">
                    {Math.round((latestJob.progress_count / latestJob.limit_count) * 100)}% concluído
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStage === 'result' && latestJob && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              {latestJob.status === 'completed' && (
                <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
              )}
              {latestJob.status === 'failed' && (
                <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
              )}
              {latestJob.status === 'cancelled' && (
                <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center">
                  <X className="h-6 w-6" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-[#002B6A]">
                  {latestJob.status === 'completed' && 'Captura Concluída com Sucesso!'}
                  {latestJob.status === 'failed' && 'Erro durante a Captura'}
                  {latestJob.status === 'cancelled' && 'Captura Cancelada'}
                </h3>
                <p className="text-xs text-[#475569]">
                  Busca: &quot;{latestJob.category}&quot; {latestJob.region ? `em "${latestJob.region}"` : `via Geolocalização`}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block text-[#475569] font-medium">Status</span>
                  <span className="font-bold text-[#002B6A] capitalize">{latestJob.status}</span>
                </div>
                <div>
                  <span className="block text-[#475569] font-medium">Leads Extraídos</span>
                  <span className="font-bold text-[#002B6A]">{latestJob.progress_count}</span>
                </div>
                <div>
                  <span className="block text-[#475569] font-medium">Limite Solicitado</span>
                  <span className="font-bold text-[#002B6A]">{latestJob.limit_count}</span>
                </div>
                <div>
                  <span className="block text-[#475569] font-medium">Duração / Fim</span>
                  <span className="font-bold text-[#002B6A]">{new Date(latestJob.updated_at).toLocaleTimeString('pt-BR')}</span>
                </div>
              </div>
              
              {latestJob.status === 'failed' && latestJob.error_message && (
                <div className="mt-2 text-rose-600 text-xs font-semibold">
                  Erro: {latestJob.error_message}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowFormOverride(true)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                Iniciar Nova Captura
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import / Error Alerts */}
      {importSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {importSuccess}
          </div>
          <button onClick={() => setImportSuccess(null)}>
            <X className="h-4 w-4 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {importError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-sm text-rose-700 font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {importError}
          </div>
          <button onClick={() => setImportError(null)}>
            <X className="h-4 w-4 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Dashboard Stats Grid */}
      {leads.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Melhor Lead */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E0EA] shadow-xs flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-[#475569]/80 uppercase tracking-wider block">Melhor Lead</span>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-sm font-bold text-[#002B6A] truncate flex-1" title={bestLead?.name || 'N/A'}>
                {bestLead?.name || 'N/A'}
              </span>
              {bestLead && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                  {bestLead.lead_grade} — {bestLead.lead_score}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#475569]/70 block truncate">
              {bestLead?.primary_contact || bestLead?.phone || bestLead?.website || 'Sem contato público'}
            </span>
          </div>

          {/* Card 2: Score Médio */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E0EA] shadow-xs flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-[#475569]/80 uppercase tracking-wider block">Score Médio</span>
            <div className="text-lg font-extrabold text-[#002B6A] flex items-center gap-1.5">
              {averageScore}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                averageScore >= 90 ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                averageScore >= 70 ? 'text-blue-700 bg-blue-50 border border-blue-100' :
                averageScore >= 50 ? 'text-amber-700 bg-amber-50 border border-amber-100' :
                'text-rose-700 bg-rose-50 border border-rose-100'
              }`}>
                {averageScore >= 90 ? 'A' : averageScore >= 70 ? 'B' : averageScore >= 50 ? 'C' : 'D'}
              </span>
            </div>
            <span className="text-[10px] text-[#475569]/70 block">Média geral dos {totalLeadsCount} leads</span>
          </div>

          {/* Card 3: Leads A */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E0EA] shadow-xs flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-[#475569]/80 uppercase tracking-wider block">Leads Classe A</span>
            <div className="text-lg font-extrabold text-[#002B6A]">
              {leadsA} <span className="text-xs text-[#475569] font-normal">/ {totalLeadsCount}</span>
            </div>
            <span className="text-[10px] text-[#475569]/70 block">Leads com nota máxima (90+)</span>
          </div>

          {/* Card 4: Leads Sem Contato */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E0EA] shadow-xs flex flex-col justify-between h-24">
            <span className="text-[10px] font-bold text-[#475569]/80 uppercase tracking-wider block">Leads Sem Contato</span>
            <div className="text-lg font-extrabold text-[#002B6A]">
              {leadsNoContact} <span className="text-xs text-[#475569] font-normal">/ {totalLeadsCount}</span>
            </div>
            <span className="text-[10px] text-[#475569]/70 block">Sem telefone, website ou e-mail</span>
          </div>
        </div>
      )}

      {/* Leads List Table */}
      <div className="bg-white rounded-2xl border border-[#D8E0EA] overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="px-4 py-3 border-b border-[#D8E0EA] flex flex-wrap items-center justify-between gap-3 bg-slate-50/30">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            {/* Actions Dropdown */}
            <div className="relative">
              <button
                type="button"
                disabled={selectedIds.size === 0 || isImporting}
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-white text-xs font-semibold text-[#002B6A] hover:bg-[#F7FAFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isImporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#002B6A]" />
                ) : (
                  'Ações'
                )}
                <ChevronDown className="h-3 w-3" />
              </button>

              {isActionsOpen && selectedIds.size > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsActionsOpen(false)} />
                  <div className="absolute left-0 mt-1.5 w-52 bg-white border border-[#D8E0EA] rounded-lg shadow-lg py-1.5 z-20">
                    <button
                      type="button"
                      onClick={handleImportToCampaign}
                      className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5 text-[#2D6BFF]" />
                      Enviar para Campanha
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-500" />
                      Exportar CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteBulkLeads}
                      disabled={isDeleting}
                      className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium flex items-center gap-2 cursor-pointer border-t border-slate-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir Leads
                    </button>
                    <button
                      type="button"
                      onClick={handleRecalculateScores}
                      disabled={isRescoring}
                      className="w-full text-left px-3 py-2 text-xs text-[#061A40] hover:bg-[#EAF2FF] transition-colors font-medium flex items-center gap-2 cursor-pointer border-t border-slate-100 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Recalcular Scores
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Filter Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar na listagem de leads..."
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
            />

            {/* Contact Quality / Status Filter */}
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#D8E0EA] bg-white text-[#061A40] focus:outline-none focus:border-[#2D6BFF] transition-all shrink-0 cursor-pointer font-semibold"
            >
              <option value="all">Filtrar por Score: Todos</option>
              <option value="only_a">🟢 Apenas Classe A (90+)</option>
              <option value="only_b_plus">🔵 Apenas Classe B+ (70+)</option>
              <option value="score_70">Score mínimo: 70</option>
              <option value="score_50">Score mínimo: 50</option>
              <option value="pending">⏳ Enriquecimento Pendente</option>
            </select>
          </div>

          {selectedIds.size > 0 && (
            <span className="text-xs text-[#475569] font-semibold bg-[#EAF2FF] px-2.5 py-1 rounded-full border border-[#2D6BFF]/20">
              {selectedIds.size} selecionados
            </span>
          )}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7FAFF] border-b border-[#D8E0EA]">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))}
                    onChange={() => handleSelectAll(filtered)}
                    className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                    title="Selecionar todos"
                  />
                </th>
                <th className="px-4 py-3"><ThBtn col="name" label="Empresa" /></th>
                <th className="px-4 py-3"><ThBtn col="phone" label="Telefone" /></th>
                <th className="px-4 py-3"><ThBtn col="website" label="Website" /></th>
                <th className="px-4 py-3"><ThBtn col="address" label="Endereço" /></th>
                <th className="px-4 py-3 text-xs font-semibold text-[#475569] uppercase tracking-wide">Busca Relacionada</th>
                <th className="px-4 py-3"><ThBtn col="lead_score" label="Score" /></th>
                <th className="px-4 py-3"><ThBtn col="created_at" label="Capturado em" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E0EA]">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#475569]">
                    Nenhum lead capturado ou correspondente à busca.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setActiveLead(lead)}
                    className="hover:bg-[#F7FAFF]/80 transition-colors group cursor-pointer"
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => handleSelectRow(lead.id)}
                        className="rounded border-[#D8E0EA] text-[#2D6BFF] focus:ring-[#2D6BFF] h-4 w-4 cursor-pointer"
                      />
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 font-semibold text-[#002B6A] whitespace-nowrap">
                      {lead.name}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-[#061A40] whitespace-nowrap">
                      {lead.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[#475569]/55" />
                          {lead.phone}
                        </span>
                      ) : (
                        <span className="text-[#D8E0EA]">—</span>
                      )}
                    </td>

                    {/* Website */}
                    <td className="px-4 py-3">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[#2D6BFF] hover:underline font-semibold text-xs"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Visitar Site
                        </a>
                      ) : (
                        <span className="text-[#D8E0EA]">—</span>
                      )}
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3 text-xs max-w-xs truncate text-[#475569]">
                      {lead.address ? (
                        <span className="flex items-center gap-1.5 title={lead.address}">
                          <MapPin className="h-3.5 w-3.5 text-[#475569]/55 shrink-0" />
                          <span className="truncate">{lead.address}</span>
                        </span>
                      ) : (
                        <span className="text-[#D8E0EA]">—</span>
                      )}
                    </td>

                    {/* Badge niches */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-[#EAF2FF] text-[#002B6A] text-[10px] font-semibold rounded-full">
                          {lead.category}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-full">
                          {lead.region}
                        </span>
                      </div>
                    </td>

                    {/* Score (Quality Grade and Score) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.contact_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          ⏳ Pendente
                        </span>
                      ) : lead.contact_status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-semibold">
                          ❌ Falhou
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 font-bold text-xs">
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            lead.lead_grade === 'A' ? 'bg-emerald-500' :
                            lead.lead_grade === 'B' ? 'bg-blue-500' :
                            lead.lead_grade === 'C' ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`} />
                          <span className={`${
                            lead.lead_grade === 'A' ? 'text-emerald-700' :
                            lead.lead_grade === 'B' ? 'text-blue-700' :
                            lead.lead_grade === 'C' ? 'text-amber-700' :
                            'text-rose-700'
                          }`}>
                            {lead.lead_grade || 'D'} — {lead.lead_score || 0}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Captured at date */}
                    <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination */}
        <div className="px-4 py-3 border-t border-[#D8E0EA] flex items-center justify-between text-xs text-[#475569] bg-slate-50/10">
          <div>
            Mostrando <span className="font-semibold text-[#002B6A]">{filtered.length > 0 ? startIndex + 1 : 0}</span> até{' '}
            <span className="font-semibold text-[#002B6A]">{Math.min(endIndex, filtered.length)}</span> de{' '}
            <span className="font-semibold text-[#002B6A]">{filtered.length}</span> leads{' '}
            {filtered.length !== leads.length && `(filtrados de ${leads.length} no total)`}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-2.5 py-1.5 rounded-lg border border-[#D8E0EA] bg-white text-[#002B6A] font-semibold hover:bg-[#F7FAFF] disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-7 w-7 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'border-[#2D6BFF] bg-[#2D6BFF] text-white shadow-xs'
                          : 'border-[#D8E0EA] bg-white text-[#475569] hover:bg-[#F7FAFF] hover:text-[#002B6A]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-2.5 py-1.5 rounded-lg border border-[#D8E0EA] bg-white text-[#002B6A] font-semibold hover:bg-[#F7FAFF] disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dev Terminal Instruction Modal */}
      {showTerminalInfo && (
        <div className="fixed inset-0 bg-[#061A40]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowTerminalInfo(false)} 
          />
          <div className="bg-[#061A40] text-blue-100 w-full max-w-md rounded-2xl border border-blue-900 shadow-2xl overflow-hidden relative p-6 space-y-4 z-10 animate-fade-in">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-center relative z-10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#2D6BFF]" />
                Executar Worker Local (Scraper)
              </h3>
              <button 
                type="button"
                onClick={() => setShowTerminalInfo(false)}
                className="p-1 rounded-md text-blue-200 hover:bg-blue-950 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <p className="text-xs text-blue-200/80 leading-relaxed relative z-10">
              O scraping utiliza o navegador local para não sobrecarregar as serverless functions.
              Certifique-se de que o worker local está rodando em sua máquina para processar a busca:
            </p>

            <div className="bg-black/45 rounded-lg p-3 border border-blue-950 font-mono text-xs text-emerald-400 select-all flex items-center justify-between relative z-10">
              <span>npm run worker:leads</span>
              <span className="text-[10px] text-slate-500 select-none">Comando Terminal</span>
            </div>

            <div className="pt-2 flex justify-end relative z-10">
              <button
                type="button"
                onClick={() => setShowTerminalInfo(false)}
                className="px-4 py-2 bg-blue-950 text-white hover:bg-blue-900 border border-blue-800 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lead Details Modal */}
      {activeLead && (
        <div className="fixed inset-0 bg-[#061A40]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#D8E0EA] shadow-2xl overflow-hidden transform scale-100 transition-all duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#D8E0EA] bg-[#F7FAFF] flex justify-between items-center">
              <span className="text-xs font-extrabold text-[#2D6BFF] uppercase tracking-wider">Perfil do Lead</span>
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
                <h3 className="text-xl font-bold text-[#002B6A]">{activeLead.name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2.5 py-0.5 bg-[#EAF2FF] text-[#002B6A] text-[10px] font-semibold rounded-full border border-[#2D6BFF]/10">
                    {activeLead.category}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-full">
                    {activeLead.region}
                  </span>
                </div>
              </div>

              {/* Data Fields */}
              <div className="space-y-4">
                {/* Phone */}
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Telefone</span>
                    {activeLead.phone ? (
                      <a 
                        href={`tel:${activeLead.phone}`} 
                        className="block text-sm font-semibold text-[#002B6A] hover:text-[#2D6BFF] hover:underline"
                      >
                        {activeLead.phone}
                      </a>
                    ) : (
                      <span className="block text-sm text-[#475569]/60 italic">Não disponível</span>
                    )}
                  </div>
                </div>

                {/* Website */}
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Website</span>
                    {activeLead.website ? (
                      <a 
                        href={activeLead.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block text-sm font-semibold text-[#2D6BFF] hover:underline truncate max-w-xs md:max-w-md"
                      >
                        {activeLead.website}
                      </a>
                    ) : (
                      <span className="block text-sm text-[#475569]/60 italic">Não disponível</span>
                    )}
                  </div>
                </div>

                {/* Email */}
                {activeLead.email && (
                  <div className="flex items-start gap-3">
                    <Globe className="h-4 w-4 text-[#475569] mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">E-mail</span>
                      <span className="block text-sm font-semibold text-[#002B6A]">{activeLead.email}</span>
                    </div>
                  </div>
                )}

                {/* Address */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-[#475569] mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Endereço</span>
                    {activeLead.address ? (
                      <span className="block text-sm font-medium text-[#061A40] leading-relaxed">
                        {activeLead.address}
                      </span>
                    ) : (
                      <span className="block text-sm text-[#475569]/60 italic">Não disponível</span>
                    )}
                  </div>
                </div>

                {/* Coordinates */}
                {(activeLead.lat !== undefined && activeLead.lat !== null && activeLead.lng !== undefined && activeLead.lng !== null) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-[#475569]/80 uppercase">Latitude</span>
                      <span className="block text-xs font-mono text-[#061A40]">{activeLead.lat}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[#475569]/80 uppercase">Longitude</span>
                      <span className="block text-xs font-mono text-[#061A40]">{activeLead.lng}</span>
                    </div>
                  </div>
                )}
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
                  onClick={() => handleDeleteSingleLead(activeLead.id)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 disabled:opacity-50 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir Lead
                </button>
              </div>
              
              <a
                href={
                  activeLead.maps_url || 
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeLead.name + ' ' + (activeLead.address || ''))}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#2D6BFF] text-white hover:bg-[#1b58ec] text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <Target className="h-3.5 w-3.5" />
                Ver no Google Maps
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Submitting Pigeon Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-[#061A40]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-8 shadow-2xl flex flex-col items-center text-center max-w-sm space-y-4">
            <div className="relative w-28 h-28 overflow-hidden rounded-full border-2 border-[#2D6BFF]/30 bg-gradient-to-b from-[#F7FAFF] to-[#EAF2FF] flex items-center justify-center">
              {/* Radar waves */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-20 h-20 rounded-full border border-[#2D6BFF]/25 animate-radar-pulse" style={{ animationDelay: '0s' }} />
                <div className="absolute w-20 h-20 rounded-full border border-[#2D6BFF]/25 animate-radar-pulse" style={{ animationDelay: '1s' }} />
              </div>

              {/* Scan line effect */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#2D6BFF]/30 to-transparent animate-scan-line pointer-events-none" />

              {/* Stacked images for crossfade */}
              <div className="relative w-24 h-24">
                <img
                  src="/search_01.webp"
                  alt="Pombo Procurando"
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                    pigeonFrame === 1 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <img
                  src="/search_02.webp"
                  alt="Pombo Procurando"
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                    pigeonFrame === 2 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </div>
            <div>
              <h4 className="text-base font-bold text-[#002B6A]">Enviando o Pombo!</h4>
              <p className="text-xs text-[#475569] mt-1">
                Preparando as coordenadas e enviando o pombo para captar leads...
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2D6BFF]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Iniciando busca...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

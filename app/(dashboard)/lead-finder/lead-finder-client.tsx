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
  X
} from 'lucide-react';
import { createLeadJob, importLeadsToContacts } from '@/app/actions/lead-finder';
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
}

interface LeadFinderClientProps {
  initialLatestJob: any;
  initialLeads: Lead[];
  role: WorkspaceRole;
}

type SortKey = 'name' | 'phone' | 'website' | 'address' | 'created_at';
type SortDir = 'asc' | 'desc';

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
  const [limitCount, setLimitCount] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Advanced Geotargeted states
  const [searchMode, setSearchMode] = useState<'region' | 'geo'>('region');
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

  // Initialize and remove map based on searchMode
  useEffect(() => {
    if (searchMode !== 'geo') return;
    if (!mapContainerRef.current) return;

    let map: any = null;
    let marker: any = null;
    let circle: any = null;

    // Load Leaflet dynamically to avoid SSR errors
    import('leaflet').then((L) => {
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
      if (map) {
        map.remove();
      }
      setMapInstance(null);
      setMarkerInstance(null);
      setCircleInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  // Synchronize Leaflet map instances with React states
  useEffect(() => {
    if (!mapInstance) return;

    if (markerInstance) {
      markerInstance.setLatLng([lat, lng]);
    }
    if (circleInstance) {
      circleInstance.setLatLng([lat, lng]);
      circleInstance.setRadius(radius);
    }
    
    // Smoothly pan map to new coordinates
    mapInstance.panTo([lat, lng]);
  }, [lat, lng, radius, mapInstance, markerInstance, circleInstance]);

  // Table filter and sort
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

    if (searchMode === 'region' && !region.trim()) {
      setFormError('Por favor, preencha a Cidade ou Região.');
      return;
    }

    if (searchMode === 'geo' && (isNaN(lat) || isNaN(lng))) {
      setFormError('Por favor, forneça coordenadas geográficas válidas.');
      return;
    }

    setIsSubmitting(true);
    const result = await createLeadJob({
      category: category.trim(),
      region: searchMode === 'region' ? region.trim() : undefined,
      limitCount,
      lat: searchMode === 'geo' ? lat : undefined,
      lng: searchMode === 'geo' ? lng : undefined,
      radius: searchMode === 'geo' ? radius : undefined,
    });
    setIsSubmitting(false);

    if (result.error) {
      setFormError(result.error);
    } else {
      setCategory('');
      setRegion('');
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

  // Table filtering and sorting
  const filtered = leads
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.phone?.toLowerCase().includes(q) ?? false) ||
        (l.website?.toLowerCase().includes(q) ?? false) ||
        (l.address?.toLowerCase().includes(q) ?? false) ||
        l.category.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#002B6A] flex items-center gap-2">
          <Target className="h-8 w-8 text-[#2D6BFF]" />
          Captar Leads
        </h1>
        <p className="text-sm text-[#475569] mt-1">
          Capte contatos empresariais de forma automatizada por categoria de serviço e região geográfica.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#002B6A] mb-4 flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-[#2D6BFF]" />
              Iniciar Nova Captura
            </h3>

            <form onSubmit={handleStartCapture} className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#002B6A]">Categoria / Nicho</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ex: advogado, clínica odontológica, restaurante"
                  disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                />
              </div>

              {/* Mode Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#002B6A]">Modo de Busca</label>
                <div className="flex gap-2 p-1 bg-slate-100/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSearchMode('region')}
                    disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      searchMode === 'region'
                        ? 'bg-white text-[#002B6A] shadow-sm'
                        : 'text-[#475569] hover:text-[#002B6A]'
                    }`}
                  >
                    Região (Texto)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('geo')}
                    disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      searchMode === 'geo'
                        ? 'bg-white text-[#002B6A] shadow-sm'
                        : 'text-[#475569] hover:text-[#002B6A]'
                    }`}
                  >
                    Geolocalização (Mapa)
                  </button>
                </div>
              </div>

              {/* Region (Only visible in region mode) */}
              {searchMode === 'region' && (
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
                </div>
              )}

              {/* Geolocalisation (Only visible in geo mode) */}
              {searchMode === 'geo' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#002B6A]">Selecione a área no mapa</label>
                    <div 
                      ref={mapContainerRef} 
                      className="h-60 w-full rounded-lg border border-[#D8E0EA] bg-slate-50 overflow-hidden z-10" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#475569] uppercase">Latitude</span>
                      <input
                        type="number"
                        step="any"
                        value={lat}
                        onChange={(e) => setLat(Number(e.target.value))}
                        disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-xs text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#475569] uppercase">Longitude</span>
                      <input
                        type="number"
                        step="any"
                        value={lng}
                        onChange={(e) => setLng(Number(e.target.value))}
                        disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-xs text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
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
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#2D6BFF] disabled:opacity-50"
                    />
                    <div className="flex justify-between text-[9px] text-[#475569]/85">
                      <span>1 km</span>
                      <span>20 km</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Limit results */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#002B6A]">Quantidade Máxima</label>
                <select
                  value={limitCount}
                  onChange={(e) => setLimitCount(Number(e.target.value))}
                  disabled={latestJob?.status === 'pending' || latestJob?.status === 'running'}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all disabled:opacity-50"
                >
                  <option value={10}>10 resultados</option>
                  <option value={50}>50 resultados</option>
                  <option value={100}>100 resultados</option>
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  latestJob?.status === 'pending' ||
                  latestJob?.status === 'running'
                }
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Buscar Leads
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Status Panel & Developer Terminal Guide */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Panel Card */}
          {latestJob && (
            <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#002B6A] mb-4">Status do Último Captador</h3>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Busca:</span>
                    <span className="text-sm font-bold text-[#002B6A]">
                      &quot;{latestJob.category}&quot; em &quot;{latestJob.region}&quot;
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

                  {latestJob.status === 'completed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Finalizado ({latestJob.progress_count})
                    </div>
                  )}

                  {latestJob.status === 'failed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Erro
                    </div>
                  )}

                  {latestJob.status === 'cancelled' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-slate-600 text-xs font-bold">
                      <X className="h-3.5 w-3.5" />
                      Cancelado
                    </div>
                  )}

                  {(latestJob.status === 'pending' || latestJob.status === 'running') && (
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
                  )}
                </div>
              </div>

              {latestJob.status === 'failed' && latestJob.error_message && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 font-medium">
                  <strong>Erro:</strong> {latestJob.error_message}
                </div>
              )}

              {/* Progress bar for running */}
              {latestJob.status === 'running' && (
                <div className="mt-4 space-y-1">
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
          )}

          {/* Dev Terminal Instruction Card (Glassmorphic Terminal Style) */}
          <div className="bg-[#061A40] text-blue-100 rounded-2xl p-6 shadow-xl relative overflow-hidden border border-blue-900">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <h3 className="text-sm font-bold text-white mb-2.5 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#2D6BFF]" />
              Executar Worker Local (Scraper)
            </h3>
            
            <p className="text-xs text-blue-200/80 mb-4 leading-relaxed">
              O scraping utiliza o navegador local para não sobrecarregar as serverless functions.
              Certifique-se de que o worker local está rodando em sua máquina para processar a busca:
            </p>

            <div className="bg-black/45 rounded-lg p-3 border border-blue-950 font-mono text-xs text-emerald-400 select-all flex items-center justify-between">
              <span>npm run worker:leads</span>
              <span className="text-[10px] text-[#475569] select-none">Comando Terminal</span>
            </div>
          </div>
        </div>
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
                <th className="px-4 py-3"><ThBtn col="created_at" label="Capturado em" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E0EA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#475569]">
                    Nenhum lead capturado ou correspondente à busca.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => handleSelectRow(lead.id)}
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

        {/* Footer info */}
        <div className="px-4 py-3 border-t border-[#D8E0EA] text-xs text-[#475569] bg-slate-50/10">
          Mostrando {filtered.length} de {leads.length} leads capturados
        </div>
      </div>
    </div>
  );
}

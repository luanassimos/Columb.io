'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeadJob, getLatestJob } from '@/app/actions/lead-finder';
import LeadSearchMap from '@/components/lead-search-map';
import { Loader2, MapPin, Search, X } from 'lucide-react';

export default function LeadSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [region, setRegion] = useState('Rio de Janeiro');
  const [latitude, setLatitude] = useState(-22.9068);
  const [longitude, setLongitude] = useState(-43.1729);
  const [radius, setRadius] = useState(5000);

  const updateCoordinates = useCallback((nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      const result = await getLatestJob();
      if (result.success && result.job?.id === jobId && ['completed', 'failed', 'cancelled'].includes(result.job.status)) {
        clearInterval(timer);
        setPending(false);
        setJobId(null);
        router.refresh();
        if (result.job.status === 'completed') onClose();
        else setError(result.job.error_message || 'A busca não foi concluída.');
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [jobId, onClose, router]);

  if (!open) return null;

  async function submit(formData: FormData) {
    setPending(true);
    setError('');
    const result = await createLeadJob({
      category: String(formData.get('category') || ''),
      region,
      lat: latitude,
      lng: longitude,
      radius,
      limitCount: Number(formData.get('quantity') || 20),
      onlyEmail: formData.get('only_email') === 'on',
      leadEntityType: 'company',
    });
    if (result.error) {
      setError(result.error);
      setPending(false);
    } else {
      setJobId(result.jobId || null);
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-[#D8E0EA] bg-white px-3 py-2.5 text-sm text-[#061A40] outline-none placeholder:text-[#64748b] focus:border-[#2D6BFF] dark:border-[#1e2e4d] dark:bg-[#081225] dark:text-[#e2ecff]';
  const label = 'block text-xs font-semibold text-[#061A40] dark:text-[#e2ecff]';

  return <>
    <div className="fixed inset-0 z-[200] bg-[#061A40]/35 backdrop-blur-[1px]" onClick={pending ? undefined : onClose} />
    <aside className="fixed right-0 top-0 z-[201] h-full w-full max-w-2xl overflow-y-auto border-l border-[#D8E0EA] bg-white p-6 text-[#061A40] shadow-2xl dark:border-[#1e2e4d] dark:bg-[#0e1e38] dark:text-[#e2ecff]" role="dialog" aria-modal="true" aria-labelledby="lead-search-title">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="lead-search-title" className="text-xl font-bold text-[#002B6A] dark:text-[#60a5fa]">Buscar Leads</h2><p className="mt-1 text-xs text-[#475569] dark:text-[#94a3b8]">Maps e Yelp adicionam empresas diretamente à sua lista de leads.</p></div>
        <button type="button" onClick={onClose} disabled={pending} className="rounded-lg p-2 text-[#475569] hover:bg-[#EAF2FF] hover:text-[#002B6A] disabled:opacity-50 dark:text-[#94a3b8] dark:hover:bg-[#172a45]" aria-label="Fechar busca"><X className="h-5 w-5" /></button>
      </div>

      <form action={submit} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Categoria / nicho<input required name="category" className={field} placeholder="Ex.: restaurantes" /></label>
          <label className={label}>Cidade / região<div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#2D6BFF]" /><input required name="region" value={region} onChange={(event) => setRegion(event.target.value)} className={`${field} pl-9`} placeholder="Ex.: Rio de Janeiro" /></div></label>
          <label className={label}>Raio<select name="radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className={field}><option value="2000">2 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="25000">25 km</option></select></label>
          <label className={label}>Quantidade<input name="quantity" type="number" min="1" max="100" defaultValue="20" className={field} /></label>
        </div>

        <LeadSearchMap latitude={latitude} longitude={longitude} radius={radius} region={region} onCoordinatesChange={updateCoordinates} onRegionChange={setRegion} />

        <div className="rounded-xl border border-[#D8E0EA] bg-[#F7FAFF] p-4 dark:border-[#1e2e4d] dark:bg-[#081225]">
          <p className="text-xs font-semibold text-[#061A40] dark:text-[#e2ecff]">Fontes: Google Maps + Yelp</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-[#061A40] dark:text-[#e2ecff]"><input type="checkbox" name="only_email" className="h-4 w-4 accent-[#2D6BFF]" />Apenas empresas com e-mail público encontrado</label>
        </div>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D6BFF] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#1b58ec] disabled:opacity-60">{pending ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando empresas reais…</> : <><Search className="h-4 w-4" />Iniciar busca</>}</button>
      </form>
    </aside>
  </>;
}

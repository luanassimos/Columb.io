'use client';

import { useEffect, useRef } from 'react';

interface LeadSearchMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  region: string;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
  onRegionChange: (region: string) => void;
}

export default function LeadSearchMap({
  latitude,
  longitude,
  radius,
  region,
  onCoordinatesChange,
  onRegionChange,
}: LeadSearchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const mapSelectedRegionRef = useRef(false);
  const initialPointRef = useRef<[number, number]>([latitude, longitude]);
  const initialRadiusRef = useRef(radius);
  const coordinatesCallbackRef = useRef(onCoordinatesChange);
  const regionCallbackRef = useRef(onRegionChange);

  useEffect(() => { coordinatesCallbackRef.current = onCoordinatesChange; }, [onCoordinatesChange]);
  useEffect(() => { regionCallbackRef.current = onRegionChange; }, [onRegionChange]);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let active = true;
    import('leaflet').then((L) => {
      if (!active || !containerRef.current || mapRef.current) return;
      const DefaultIcon = L.Icon.Default.prototype as any;
      delete DefaultIcon._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const [initialLatitude, initialLongitude] = initialPointRef.current;
      const map = L.map(containerRef.current).setView([initialLatitude, initialLongitude], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors · © CARTO',
      }).addTo(map);
      const marker = L.marker([initialLatitude, initialLongitude], { draggable: true }).addTo(map);
      const circle = L.circle([initialLatitude, initialLongitude], {
        radius: initialRadiusRef.current,
        color: '#2D6BFF',
        fillColor: '#2D6BFF',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      const selectPoint = async (lat: number, lng: number) => {
        coordinatesCallbackRef.current(lat, lng);
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (!response.ok) return;
          const data = await response.json();
          const address = data.address || {};
          const city = address.city || address.town || address.village || address.municipality;
          const neighborhood = address.suburb || address.neighbourhood || address.quarter;
          const detected = neighborhood && city ? `${neighborhood}, ${city}` : city || data.display_name?.split(',').slice(0, 2).join(',').trim();
          if (detected) {
            mapSelectedRegionRef.current = true;
            regionCallbackRef.current(detected);
          }
        } catch (error) {
          console.warn('[Lead map] Falha na geocodificação reversa:', error);
        }
      };

      marker.on('dragend', () => {
        const point = marker.getLatLng();
        void selectPoint(point.lat, point.lng);
      });
      map.on('click', (event: any) => void selectPoint(event.latlng.lat, event.latlng.lng));
      setTimeout(() => map.invalidateSize(), 50);
    });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // The map instance owns its listeners for the lifetime of this drawer.

  useEffect(() => {
    const point: [number, number] = [latitude, longitude];
    markerRef.current?.setLatLng(point);
    circleRef.current?.setLatLng(point);
    circleRef.current?.setRadius(radius);
  }, [latitude, longitude, radius]);

  useEffect(() => {
    if (mapSelectedRegionRef.current) {
      mapSelectedRegionRef.current = false;
      return;
    }
    if (region.trim().length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(region.trim())}&limit=1`);
        if (!response.ok) return;
        const [result] = await response.json();
        if (!result) return;
        const nextLatitude = Number(result.lat);
        const nextLongitude = Number(result.lon);
        onCoordinatesChange(nextLatitude, nextLongitude);
        mapRef.current?.setView([nextLatitude, nextLongitude], 12);
      } catch (error) {
        console.warn('[Lead map] Falha ao localizar região:', error);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [region, onCoordinatesChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#061A40] dark:text-[#e2ecff]">Área da busca</span>
        <span className="text-[10px] text-[#475569] dark:text-[#94a3b8]">Clique ou arraste o marcador</span>
      </div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl border border-[#D8E0EA] bg-[#EAF2FF]" aria-label="Mapa para selecionar a região da busca" />
      <div className="flex justify-between text-[10px] text-[#475569] dark:text-[#94a3b8]">
        <span>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
        <span>Raio: {(radius / 1000).toFixed(0)} km</span>
      </div>
    </div>
  );
}

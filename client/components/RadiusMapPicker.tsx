/**
 * RadiusMapPicker
 * Peta Leaflet interaktif untuk admin menentukan titik pusat absen + radius.
 *
 * Fitur:
 * - Klik di peta untuk set/pindahkan marker titik pusat
 * - Circle otomatis menyesuaikan nilai radiusMeters dari props
 * - Tombol "Gunakan lokasi saya" untuk geolocation
 * - Tampilkan koordinat saat ini di bawah peta
 */

import { useEffect, useRef } from "react";
import type { Map as LMap, Marker, Circle } from "leaflet";

interface Props {
  lat: number;
  lng: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}

export default function RadiusMapPicker({ lat, lng, radiusMeters, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const circleRef = useRef<Circle | null>(null);

  // Inisialisasi peta sekali
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Import Leaflet secara dinamis agar tidak blocking SSR
    import("leaflet").then((L) => {
      // Fix icon default Leaflet yang hilang saat di-bundle
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initLat = lat !== 0 ? lat : -6.2;
      const initLng = lng !== 0 ? lng : 106.816;
      const zoom = lat !== 0 ? 15 : 12;

      const map = L.map(containerRef.current!, { zoomControl: true }).setView(
        [initLat, initLng],
        zoom
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Buat marker & circle awal
      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      const circle = L.circle([initLat, initLng], {
        radius: radiusMeters,
        color: "#311f62",
        fillColor: "#311f620d",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapRef.current = map;

      // Klik peta → pindahkan marker & circle
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        circle.setLatLng([clickLat, clickLng]);
        onChange(clickLat, clickLng);
      });

      // Drag marker → update circle & parent
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        onChange(pos.lat, pos.lng);
      });

      // Trigger pembaruan ukuran peta setelah mount (fix rendering blank)
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker & circle saat lat/lng berubah dari luar (misal tombol "lokasi saya")
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    if (lat === 0 && lng === 0) return;
    const pos: [number, number] = [lat, lng];
    markerRef.current.setLatLng(pos);
    circleRef.current.setLatLng(pos);
    mapRef.current.setView(pos, 15, { animate: true });
  }, [lat, lng]);

  // Update radius circle saat radiusMeters berubah
  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(radiusMeters);
  }, [radiusMeters]);

  return (
    <div className="space-y-2">
      {/* Import CSS Leaflet via link tag dinamis */}
      <LeafletStyles />
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
        style={{ height: 340 }}
      />
      {lat !== 0 && lng !== 0 && (
        <p className="text-xs text-zinc-400 text-center">
          📍 {lat.toFixed(6)}, {lng.toFixed(6)} · radius <span className="font-medium text-brand">{radiusMeters}m</span>
          {" · "}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:opacity-80"
          >
            Buka di OSM
          </a>
        </p>
      )}
      {lat === 0 && lng === 0 && (
        <p className="text-xs text-zinc-400 text-center">
          Klik pada peta atau gunakan tombol "Lokasi saya" untuk menentukan titik pusat
        </p>
      )}
    </div>
  );
}

/** Inject Leaflet CSS sekali ke head jika belum ada */
function LeafletStyles() {
  useEffect(() => {
    const id = "leaflet-css";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);
  return null;
}

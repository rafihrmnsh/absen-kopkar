import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "@/services/auth";
import { useToast } from "@/components/Toast";
import { fetchAll } from "@/services/attendance";
import {
  fetchSettings,
  saveSettings,
  type AttendanceSettings,
} from "@/services/attendanceSettings";
import { fetchAllAmnestyRequests, reviewAmnestyRequest } from "@/services/amnesty";
import type { AmnestyRequest, AttendanceStatus } from "@shared/types";
import {
  Download,
  Settings,
  MapPin,
  Clock,
  ToggleLeft,
  ToggleRight,
  Crosshair,
  Save,
  ChevronDown,
  ChevronUp,
  Mail,
  Send,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  FileText,
  ExternalLink,
} from "lucide-react";
import OverrideStatusModal from "@/components/OverrideStatusModal";
import RadiusMapPicker from "@/components/RadiusMapPicker";
import * as XLSX from "xlsx-js-style";
// ─── Haiku toggle ─────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 select-none"
    >
      {checked ? (
        <ToggleRight className="h-6 w-6 text-brand" />
      ) : (
        <ToggleLeft className="h-6 w-6 text-zinc-400" />
      )}
      <span className={`text-sm font-medium ${checked ? "text-brand" : "text-zinc-500"}`}>
        {label}
      </span>
    </button>
  );
}

export default function Admin() {
  const currentUser = getCurrentUser() as any;
  if (!currentUser || currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amnestyRequests, setAmnestyRequests] = useState<AmnestyRequest[]>([]);
  const [amnestyLoading, setAmnestyLoading] = useState(true);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchName, setSearchName] = useState("");

  // Settings state
  const [settings, setSettings] = useState<AttendanceSettings>({
    radiusEnabled: false,
    centerLat: 0,
    centerLng: 0,
    radiusMeters: 200,
    timeEnabled: false,
    checkInDeadline: "09:00",
    checkOutEarliestTime: "16:00",
    reminderEnabled: false,
    reminderTime: "07:30",
    reminderFromEmail: "noreply@absensikopkar.com",
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "amnesty" | "records">("summary");

  if (!getCurrentUser()) {
    return <Navigate to="/login" />;
  }

  // Load records
  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const all = await fetchAll();
      setRecords(all);
    } catch (e: any) {
      toast({ title: "Gagal memuat data", description: e?.message ?? "" });
    } finally {
      setLoading(false);
    }
  }

  // Load amnesty requests
  useEffect(() => {
    loadAmnestyRequests();
  }, []);

  async function loadAmnestyRequests() {
    try {
      const requests = await fetchAllAmnestyRequests();
      setAmnestyRequests(requests);
    } catch (e: any) {
      toast({ title: "Gagal memuat amnesti", description: e?.message ?? "" });
    } finally {
      setAmnestyLoading(false);
    }
  }

  // Load settings
  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSettings();
        setSettings(s);
      } catch {
        // pakai default
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  const checkIns = records.filter((r) => r.type === "check-in").length;
  const checkOuts = records.filter((r) => r.type === "check-out").length;

  function exportExcel() {
    if (records.length === 0) {
      toast({ title: "Tidak ada data untuk diekspor" });
      return;
    }
    
    // 1. Data Mentah
    const rawData = records.map((r) => ({
      Nama: r.name,
      Tipe: r.type,
      Status: r.status || "normal",
      Amnesti: r.isAmnesty ? "Ya" : "Tidak",
      Latitude: r.lat ?? "",
      Longitude: r.lng ?? "",
      Waktu: r.createdAt?.toDate ? new Date(r.createdAt.toDate()).toLocaleString("id-ID") : "",
    }));

    // 2. Rangkuman Per Orang Per Bulan
    const summaryMap = new Map<string, any>();
    records.forEach((r) => {
      if (!r.createdAt?.toDate) return;
      const d = new Date(r.createdAt.toDate());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const monthStr = `${year}-${month}`;
      const dateStr = d.toLocaleDateString("id-ID"); 

      const key = `${r.name}_${monthStr}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          Nama: r.name,
          Bulan: monthStr,
          "Total Check-in": 0,
          "Total Check-out": 0,
          "Terlambat": 0,
          "Pulang Cepat": 0,
          "Amnesti": 0,
          _dates: new Set<string>(),
        });
      }
      const p = summaryMap.get(key);
      if (r.type === "check-in") p["Total Check-in"]++;
      if (r.type === "check-out") p["Total Check-out"]++;
      if (r.status === "terlambat") p["Terlambat"]++;
      if (r.status === "pulang-cepat") p["Pulang Cepat"]++;
      if (r.isAmnesty) p["Amnesti"]++;
      p._dates.add(dateStr);
    });

    const summaryData = Array.from(summaryMap.values())
      .map((s) => ({
        Nama: s.Nama,
        Bulan: s.Bulan,
        "Total Hari Aktif": s._dates.size,
        "Detail Tanggal": Array.from(s._dates).sort().join(", "),
        "Total Check-in": s["Total Check-in"],
        "Total Check-out": s["Total Check-out"],
        "Terlambat": s["Terlambat"],
        "Pulang Cepat": s["Pulang Cepat"],
        "Amnesti": s["Amnesti"],
      }))
      .sort((a, b) => a.Nama.localeCompare(b.Nama) || b.Bulan.localeCompare(a.Bulan));

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsRaw = XLSX.utils.json_to_sheet(rawData);

    // Style Header (Baris Pertama) untuk Summary
    const rangeSummary = XLSX.utils.decode_range(wsSummary["!ref"] || "A1:I1");
    for (let C = rangeSummary.s.c; C <= rangeSummary.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (!wsSummary[address]) continue;
      wsSummary[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Warna brand Indigo (Brand Color)
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    // Style Header (Baris Pertama) untuk Raw Data
    const rangeRaw = XLSX.utils.decode_range(wsRaw["!ref"] || "A1:G1");
    for (let C = rangeRaw.s.c; C <= rangeRaw.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ c: C, r: 0 });
      if (!wsRaw[address]) continue;
      wsRaw[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, 
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    // Auto-size columns for Summary sheet
    wsSummary["!cols"] = [
      { wch: 25 }, // Nama
      { wch: 15 }, // Bulan
      { wch: 18 }, // Total Hari Aktif
      { wch: 60 }, // Detail Tanggal
      { wch: 15 }, // Total Check-in
      { wch: 15 }, // Total Check-out
      { wch: 12 }, // Terlambat
      { wch: 15 }, // Pulang Cepat
      { wch: 12 }, // Amnesti
    ];

    // Auto-size columns for Raw sheet
    wsRaw["!cols"] = [
      { wch: 25 }, // Nama
      { wch: 15 }, // Tipe
      { wch: 12 }, // Status
      { wch: 10 }, // Amnesti
      { wch: 15 }, // Lat
      { wch: 15 }, // Lng
      { wch: 25 }, // Waktu
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsSummary, "Rangkuman");
    XLSX.utils.book_append_sheet(workbook, wsRaw, "Semua Data");
    
    XLSX.writeFile(workbook, `laporan_absensi_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({ title: "Excel berhasil diunduh!" });
  }

  async function handleGetMyLocation() {
    setGettingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      );
      setSettings((prev) => ({
        ...prev,
        centerLat: pos.coords.latitude,
        centerLng: pos.coords.longitude,
      }));
      toast({ title: "Lokasi berhasil diambil", description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
    } catch (e: any) {
      toast({ title: "Gagal mengambil lokasi", description: e?.message ?? "" });
    } finally {
      setGettingLocation(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await saveSettings(settings);
      toast({ title: "Pengaturan disimpan!" });
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e?.message ?? "" });
    } finally {
      setSettingsSaving(false);
    }
  }

  // ─── Summary badges for settings ────────────────────────────────────────────
  const radiusBadge = settings.radiusEnabled
    ? `📍 Radius ${settings.radiusMeters}m aktif`
    : "📍 Radius dinonaktifkan";
  const timeBadge = settings.timeEnabled
    ? `🕐 Check-in s/d ${settings.checkInDeadline}, Check-out mulai ${settings.checkOutEarliestTime}`
    : "🕐 Batas waktu dinonaktifkan";
  const reminderBadge = settings.reminderEnabled
    ? `✉️ Pengingat jam ${settings.reminderTime}`
    : "✉️ Pengingat email nonaktif";

  async function handleSendReminderNow() {
    setSendingReminder(true);
    try {
      const res = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Pengingat terkirim!", description: data.message || `${data.sent ?? 0} email dikirim` });
      } else {
        toast({ title: "Gagal mengirim", description: data.error || "Terjadi kesalahan" });
      }
    } catch (e: any) {
      toast({ title: "Gagal mengirim", description: e?.message ?? "Periksa koneksi" });
    } finally {
      setSendingReminder(false);
    }
  }

  async function handleOverrideStatus(recordId: string, newStatus: AttendanceStatus, adminNote: string) {
    try {
      const res = await fetch("/api/attendance/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, newStatus, adminNote }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengubah status");
      }

      toast({ title: "Status berhasil diubah!" });
      await loadRecords();
    } catch (e: any) {
      throw e;
    }
  }

  async function handleReviewAmnesty(requestId: string, status: "approved" | "rejected", reviewNote: string) {
    try {
      await reviewAmnestyRequest(requestId, status, reviewNote, currentUser.name || "Admin");
      toast({ 
        title: status === "approved" ? "Permohonan disetujui" : "Permohonan ditolak",
        description: "Status amnesti berhasil diperbarui"
      });
      await loadAmnestyRequests();
    } catch (e: any) {
      toast({ title: "Gagal memproses", description: e?.message ?? "" });
    }
  }

  // Calculate attendance summary
  const attendanceSummary = records.reduce((acc, r) => {
    if (!acc[r.name]) {
      acc[r.name] = { hadir: 0, terlambat: 0, pulangCepat: 0, amnesti: 0 };
    }
    const status = r.status || "normal";
    if (r.isAmnesty) {
      acc[r.name].amnesti++;
    } else if (status === "hadir" || status === "normal") {
      acc[r.name].hadir++;
    } else if (status === "terlambat") {
      acc[r.name].terlambat++;
    } else if (status === "pulang-cepat") {
      acc[r.name].pulangCepat++;
    }
    return acc;
  }, {} as Record<string, any>);

  // Filter by search
  const filteredSummary = Object.entries(attendanceSummary).filter(([name]) =>
    name.toLowerCase().includes(searchName.toLowerCase())
  );

  // Get unique names for autocomplete
  const allNames = Object.keys(attendanceSummary);

  const pendingAmnestyCount = amnestyRequests.filter(r => r.status === "pending").length;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">

      {/* ── Panel Pengaturan Absen ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
              <Settings className="h-5 w-5 text-brand" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold">Pengaturan Absen</h2>
              <p className="text-sm text-zinc-500 mt-0.5">Radius lokasi & batas waktu absensi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge ringkasan */}
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${settings.radiusEnabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                {radiusBadge}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${settings.timeEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                {timeBadge}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${settings.reminderEnabled ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                {reminderBadge}
              </span>
            </div>
            {settingsOpen ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </div>
        </button>

        {/* Body (collapsible) */}
        {settingsOpen && (
          <div className="px-6 pb-6 space-y-6 border-t border-zinc-100 dark:border-zinc-800 pt-6">
            {settingsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* ── Seksi Radius ───────────────────────────────────────── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand" />
                      <span className="font-medium text-sm">Validasi Radius Lokasi</span>
                    </div>
                    <Toggle
                      checked={settings.radiusEnabled}
                      onChange={(v) => setSettings((p) => ({ ...p, radiusEnabled: v }))}
                      label={settings.radiusEnabled ? "Aktif" : "Nonaktif"}
                    />
                  </div>

                  <div className={`space-y-4 ${!settings.radiusEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                    {/* Peta interaktif */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-2">
                        Tentukan Titik Pusat di Peta
                      </label>
                      <RadiusMapPicker
                        lat={settings.centerLat}
                        lng={settings.centerLng}
                        radiusMeters={settings.radiusMeters}
                        onChange={(lat, lng) =>
                          setSettings((p) => ({ ...p, centerLat: lat, centerLng: lng }))
                        }
                      />
                    </div>

                    {/* Tombol ambil lokasi */}
                    <button
                      type="button"
                      onClick={handleGetMyLocation}
                      disabled={gettingLocation}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <Crosshair className={`h-3.5 w-3.5 ${gettingLocation ? "animate-spin" : ""}`} />
                      {gettingLocation ? "Mengambil lokasi..." : "Gunakan lokasi saya sekarang"}
                    </button>

                    {/* Input presisi manual (collapsible) */}
                    <details className="group">
                      <summary className="text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer select-none list-none flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                        Input koordinat manual (presisi tinggi)
                      </summary>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Latitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={settings.centerLat}
                            onChange={(e) =>
                              setSettings((p) => ({ ...p, centerLat: parseFloat(e.target.value) || 0 }))
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                            placeholder="Misal: -6.200000"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Longitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={settings.centerLng}
                            onChange={(e) =>
                              setSettings((p) => ({ ...p, centerLng: parseFloat(e.target.value) || 0 }))
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                            placeholder="Misal: 106.816000"
                          />
                        </div>
                      </div>
                    </details>

                    {/* Radius slider */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-500">Radius Maksimum</label>
                        <span className="text-xs font-semibold text-brand">{settings.radiusMeters} meter</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={5000}
                        step={50}
                        value={settings.radiusMeters}
                        onChange={(e) => setSettings((p) => ({ ...p, radiusMeters: parseInt(e.target.value) }))}
                        className="w-full accent-brand"
                      />
                      <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>50 m</span>
                        <span>5.000 m</span>
                      </div>
                    </div>

                    {/* Preview link peta */}
                    {settings.centerLat !== 0 && settings.centerLng !== 0 && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${settings.centerLat}&mlon=${settings.centerLng}#map=16/${settings.centerLat}/${settings.centerLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand underline hover:opacity-80"
                      >
                        <MapPin className="h-3 w-3" /> Lihat titik pusat di peta
                      </a>
                    )}
                  </div>
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* ── Seksi Waktu ────────────────────────────────────────── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand" />
                      <span className="font-medium text-sm">Batas Waktu Absen</span>
                    </div>
                    <Toggle
                      checked={settings.timeEnabled}
                      onChange={(v) => setSettings((p) => ({ ...p, timeEnabled: v }))}
                      label={settings.timeEnabled ? "Aktif" : "Nonaktif"}
                    />
                  </div>

                  <div className={`grid grid-cols-2 gap-4 ${!settings.timeEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        Batas Akhir Check-In
                      </label>
                      <input
                        type="time"
                        value={settings.checkInDeadline}
                        onChange={(e) => setSettings((p) => ({ ...p, checkInDeadline: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Check-in hanya boleh sebelum jam ini</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        Awal Check-Out Diizinkan
                      </label>
                      <input
                        type="time"
                        value={settings.checkOutEarliestTime}
                        onChange={(e) => setSettings((p) => ({ ...p, checkOutEarliestTime: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                      <p className="mt-1 text-xs text-zinc-400">Check-out hanya boleh mulai jam ini</p>
                    </div>
                  </div>
                </div>

                <hr className="border-zinc-100 dark:border-zinc-800" />

                {/* ── Seksi Pengingat Email ──────────────────────────────── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-brand" />
                      <span className="font-medium text-sm">Pengingat Absen via Email</span>
                    </div>
                    <Toggle
                      checked={settings.reminderEnabled}
                      onChange={(v) => setSettings((p) => ({ ...p, reminderEnabled: v }))}
                      label={settings.reminderEnabled ? "Aktif" : "Nonaktif"}
                    />
                  </div>

                  <div className={`space-y-4 ${!settings.reminderEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">
                          Jam Pengingat Dikirim
                        </label>
                        <input
                          type="time"
                          value={settings.reminderTime}
                          onChange={(e) => setSettings((p) => ({ ...p, reminderTime: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                        />
                        <p className="mt-1 text-xs text-zinc-400">Email dikirim setiap hari di jam ini</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">
                          Email Pengirim
                        </label>
                        <input
                          type="email"
                          value={settings.reminderFromEmail}
                          onChange={(e) => setSettings((p) => ({ ...p, reminderFromEmail: e.target.value }))}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                          placeholder="noreply@domain.com"
                        />
                        <p className="mt-1 text-xs text-zinc-400">Pastikan alamat ini valid</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800/50">
                      <p className="text-xs text-zinc-500 mb-2">
                        Email pengingat akan dikirim otomatis ke karyawan yang belum check-in hari ini.
                        Gunakan <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-brand underline">cron-job.org</a> untuk jadwal otomatis.
                      </p>
                      <button
                        type="button"
                        onClick={handleSendReminderNow}
                        disabled={sendingReminder}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        <Send className={`h-3.5 w-3.5 ${sendingReminder ? "animate-pulse" : ""}`} />
                        {sendingReminder ? "Mengirim..." : "Kirim Pengingat Sekarang"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-brand text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {settingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs Navigation ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === "summary"
                ? "text-brand border-b-2 border-brand bg-brand/5"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="h-4 w-4" />
              Ringkasan Kehadiran
            </div>
          </button>
          <button
            onClick={() => setActiveTab("amnesty")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
              activeTab === "amnesty"
                ? "text-brand border-b-2 border-brand bg-brand/5"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              Permohonan Amnesti
              {pendingAmnestyCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendingAmnestyCount}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab("records")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === "records"
                ? "text-brand border-b-2 border-brand bg-brand/5"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Download className="h-4 w-4" />
              Data Absensi
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ── Tab: Ringkasan Kehadiran ──────────────────────────────── */}
          {activeTab === "summary" && (
            <div>
              {/* Search Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Cari Karyawan
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Ketik nama karyawan..."
                    list="employee-names"
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <datalist id="employee-names">
                    {allNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {searchName && (
                    <button
                      onClick={() => setSearchName("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {searchName && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Menampilkan {filteredSummary.length} dari {allNames.length} karyawan
                  </p>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  ))}
                </div>
              ) : filteredSummary.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">
                  {searchName ? `Tidak ada karyawan dengan nama "${searchName}"` : "Belum ada data kehadiran"}
                </p>
              ) : (
                <div className="grid gap-3">
                  {filteredSummary.map(([name, stats]: [string, any]) => (
                    <div key={name} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{name}</h3>
                        <span className="text-xs text-zinc-500">
                          Total: {stats.hadir + stats.terlambat + stats.pulangCepat + stats.amnesti} record
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                          <div className="text-lg font-bold text-emerald-600">{stats.hadir}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">Hadir</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <div className="text-lg font-bold text-orange-600">{stats.terlambat}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">Terlambat</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                          <div className="text-lg font-bold text-purple-600">{stats.pulangCepat}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">Pulang Cepat</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <div className="text-lg font-bold text-amber-600">{stats.amnesti}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">Amnesti</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Permohonan Amnesti ───────────────────────────────── */}
          {activeTab === "amnesty" && (
            <div>
              {amnestyLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-24 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  ))}
                </div>
              ) : amnestyRequests.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">Belum ada permohonan amnesti</p>
              ) : (
                <div className="space-y-3">
                  {amnestyRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`rounded-lg border p-4 ${
                        req.status === "pending"
                          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                          : req.status === "approved"
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
                          : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{req.userName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              req.type === "terlambat"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            }`}>
                              {req.type === "terlambat" ? "Izin Terlambat" : "Izin Pulang Cepat"}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString("id-ID") : "-"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === "pending" ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          ) : req.status === "approved" ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className={`text-xs font-medium capitalize ${
                            req.status === "pending" ? "text-amber-600" :
                            req.status === "approved" ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{req.reason}</p>

                      <a
                        href={req.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand hover:underline mb-3"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Lihat Bukti
                      </a>

                      {req.status === "pending" && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                          <button
                            onClick={() => {
                              const note = prompt("Catatan persetujuan (opsional):");
                              if (note !== null) handleReviewAmnesty(req.id!, "approved", note);
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => {
                              const note = prompt("Alasan penolakan:");
                              if (note) handleReviewAmnesty(req.id!, "rejected", note);
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Tolak
                          </button>
                        </div>
                      )}

                      {req.status !== "pending" && req.reviewNote && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                          <p className="text-xs text-zinc-500">
                            <span className="font-medium">Catatan Admin:</span> {req.reviewNote}
                          </p>
                          {req.reviewedBy && (
                            <p className="text-xs text-zinc-400 mt-1">
                              oleh {req.reviewedBy} • {req.reviewedAt?.toDate ? new Date(req.reviewedAt.toDate()).toLocaleDateString("id-ID") : "-"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Data Absensi ──────────────────────────────────────── */}
          {activeTab === "records" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Data Absensi</h3>
                  <p className="text-sm text-zinc-500 mt-1">Seluruh record kehadiran karyawan</p>
                </div>
                <button
                  onClick={exportExcel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Download className="h-4 w-4" /> Export Excel
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Record", value: records.length, color: "text-brand" },
                  { label: "Check-in", value: checkIns, color: "text-emerald-600" },
                  { label: "Check-out", value: checkOuts, color: "text-orange-500" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-center"
                  >
                    <div className="text-sm text-zinc-500">{s.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${s.color}`}>
                      {loading ? "..." : s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table */}
              {loading ? (
                <p className="text-sm text-zinc-500 animate-pulse">Memuat data...</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-zinc-500">Belum ada data.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Nama</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Tipe</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Lokasi</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Waktu</th>
                        <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id ?? i} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800">
                          <td className="px-4 py-3">
                            <div className="font-medium">{r.name}</div>
                            {r.isAmnesty && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mt-1">
                                Amnesti
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                r.type === "check-in"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              }`}
                            >
                              {r.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                                r.status === "hadir"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : r.status === "terlambat"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : r.status === "pulang-cepat"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}
                            >
                              {r.status || "normal"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {r.isAmnesty ? (
                              <div>
                                <div className="text-xs">Amnesti (no location)</div>
                                {r.amnestyReason && (
                                  <div className="text-xs italic text-zinc-400 mt-0.5">"{r.amnestyReason}"</div>
                                )}
                              </div>
                            ) : (
                              `${r.lat?.toFixed?.(4)}, ${r.lng?.toFixed?.(4)}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {r.createdAt?.toDate
                              ? new Date(r.createdAt.toDate()).toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedRecord({
                                  id: r.id,
                                  name: r.name,
                                  type: r.type,
                                  currentStatus: r.status || "normal",
                                });
                                setOverrideModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Edit className="h-3 w-3" />
                              Override
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Override Status Modal ─────────────────────────────────────────── */}
      <OverrideStatusModal
        isOpen={overrideModalOpen}
        onClose={() => {
          setOverrideModalOpen(false);
          setSelectedRecord(null);
        }}
        onSubmit={handleOverrideStatus}
        record={selectedRecord}
      />
    </div>
  );
}

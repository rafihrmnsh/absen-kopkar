import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { getCurrentUser } from "@/services/auth";
import { useToast } from "@/components/Toast";
import { fetchRecent } from "@/services/attendance";
import { Clock, MapPin, LogIn, LogOut, ChevronLeft, RefreshCw, CalendarDays } from "lucide-react";

function parseDate(createdAt: any): Date | null {
  if (!createdAt) return null;
  // Firestore Timestamp
  if (typeof createdAt?.toDate === "function") return createdAt.toDate();
  // ISO string or number
  const d = new Date(createdAt);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function groupByDate(list: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const item of list) {
    const d = parseDate(item.createdAt);
    const key = d
      ? d.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : "Tanggal tidak diketahui";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export default function History() {
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = getCurrentUser();

  async function loadHistory(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const name = user?.name || user?.email || localStorage.getItem("absensi:nama") || "";
      const list = await fetchRecent(name, 50);
      setHistory(list);
    } catch (e: any) {
      toast({ title: "Gagal memuat riwayat", description: e?.message ?? "" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  if (!user) return <Navigate to="/login" />;

  const grouped = groupByDate(history);
  const dateKeys = Object.keys(grouped);

  // Calculate statistics
  const stats = {
    hadir: history.filter(h => h.status === "hadir").length,
    terlambat: history.filter(h => h.status === "terlambat").length,
    pulangCepat: history.filter(h => h.status === "pulang-cepat").length,
    amnesti: history.filter(h => h.isAmnesty === true).length,
    total: history.length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Kembali
            </Link>
          </div>
          <button
            onClick={() => loadHistory(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Statistics Card */}
        {!loading && history.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm mb-6 overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">Statistik Kehadiran</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.hadir}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">Hadir</div>
                </div>
                <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.terlambat}</div>
                  <div className="text-xs text-orange-700 dark:text-orange-500 mt-1">Terlambat</div>
                </div>
                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.pulangCepat}</div>
                  <div className="text-xs text-purple-700 dark:text-purple-500 mt-1">Pulang Cepat</div>
                </div>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.amnesti}</div>
                  <div className="text-xs text-amber-700 dark:text-amber-500 mt-1">Amnesti</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card utama */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          {/* Title */}
          <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-brand" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Riwayat Absensi</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {user.name || user.email} · 50 aktivitas terakhir
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                  />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CalendarDays className="h-7 w-7 text-zinc-400" />
                </div>
                <p className="text-zinc-500 text-sm">Belum ada data absensi.</p>
                <p className="text-zinc-400 text-xs">Lakukan check-in pertama Anda dari halaman utama.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {dateKeys.map((dateKey) => (
                  <div key={dateKey}>
                    {/* Tanggal header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                        {dateKey}
                      </span>
                      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                      <span className="text-xs text-zinc-400">{grouped[dateKey].length} aktivitas</span>
                    </div>

                    {/* Item list */}
                    <ul className="space-y-2">
                      {grouped[dateKey].map((h, i) => {
                        const date = parseDate(h.createdAt);
                        const isCheckIn = h.type === "check-in";
                        return (
                          <li
                            key={h.id ?? i}
                            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {/* Icon */}
                              <div
                                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isCheckIn
                                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                                    : "bg-orange-100 dark:bg-orange-900/30"
                                }`}
                              >
                                {isCheckIn
                                  ? <LogIn className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  : <LogOut className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                }
                              </div>

                              {/* Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-semibold ${
                                      isCheckIn
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-orange-700 dark:text-orange-400"
                                    }`}
                                  >
                                    {isCheckIn ? "Check-in" : "Check-out"}
                                  </span>
                                  {h.isAmnesty && (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      Amnesti
                                    </span>
                                  )}
                                  {h.status && h.status !== "normal" && !h.isAmnesty && (
                                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                                      h.status === "hadir"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : h.status === "terlambat"
                                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                    }`}>
                                      {h.status}
                                    </span>
                                  )}
                                </div>
                                {h.isAmnesty && h.amnestyReason && (
                                  <div className="text-xs text-zinc-500 italic mt-0.5">"{h.amnestyReason}"</div>
                                )}
                                {(h.lat != null && h.lng != null && !h.isAmnesty) && (
                                  <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-400">
                                    <MapPin className="h-3 w-3" />
                                    <span>{h.lat.toFixed(5)}, {h.lng.toFixed(5)}</span>
                                    {h.accuracy != null && (
                                      <span className="text-zinc-300 dark:text-zinc-600">
                                        · ±{Math.round(h.accuracy)}m
                                      </span>
                                    )}
                                  </div>
                                )}
                                {h.isAmnesty && (
                                  <div className="text-xs text-zinc-400 mt-0.5">
                                    Amnesti (tidak ada lokasi)
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Waktu */}
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {date
                                  ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        {history.length > 0 && (
          <p className="text-center text-xs text-zinc-400 mt-4">
            Menampilkan {history.length} aktivitas terakhir
          </p>
        )}
      </div>
    </div>
  );
}

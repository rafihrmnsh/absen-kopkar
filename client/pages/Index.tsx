import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Modal, ModalHeader, ModalTitle } from "@/components/Modal";
import { LogIn, LogOut, MapPin, ShieldAlert, Clock, ScanFace, FileText } from "lucide-react";
import { fetchRecent, recordAttendance } from "@/services/attendance";
import { fetchSettings, checkRadius, checkTimeWindow, type AttendanceSettings } from "@/services/attendanceSettings";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getCurrentUser } from "@/services/auth";
import { matchFace, hasRegisteredFace } from "@/services/faceRecognition";
import { submitAmnestyRequest, fetchUserAmnestyRequests } from "@/services/amnesty";
import type { AmnestyRequest } from "@shared/types";
import LocationMapPreview from "@/components/LocationMapPreview";
import FaceCapture from "@/components/FaceCapture";
import AmnestyModal from "@/components/AmnestyModal";


const ALLOW_MULTIPLE_ATTENDANCE = true;

function useNow() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Index() {
  const now = useNow();
  const { toast } = useToast();
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<"in" | "out" | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [geoSupported, setGeoSupported] = useState<boolean>(false);
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; accuracy?: number | null } | null>(null);
  const [showMapPreview, setShowMapPreview] = useState<boolean>(false);
  const [pendingType, setPendingType] = useState<"check-in" | "check-out" | null>(null);

  // Face verification state
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceMatchName, setFaceMatchName] = useState<string | null>(null);
  const [pendingGeoData, setPendingGeoData] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null); // null = loading
  const [todayCheckIn, setTodayCheckIn] = useState<Date | null>(null);
  const [todayCheckOut, setTodayCheckOut] = useState<Date | null>(null);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  const [showAmnestyModal, setShowAmnestyModal] = useState(false);
  const [userAmnestyRequests, setUserAmnestyRequests] = useState<AmnestyRequest[]>([]);

  function getPositionLocal(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new Error("Geolocation tidak didukung browser ini."));
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        console.error("Error getting location:", err);
        reject(new Error(err.message))
      }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
    });
  }

  useEffect(() => {
    setGeoSupported("geolocation" in navigator);
  }, []);

  useEffect(() => {
    const authUser = getCurrentUser();
    if (authUser) {
      setName(authUser.name || authUser.email);
      // Check if user has registered face
      hasRegisteredFace(authUser.email).then((result) => {
        setFaceRegistered(result);
      }).catch(() => setFaceRegistered(false));
      // Load user amnesty requests
      fetchUserAmnestyRequests(authUser.email).then(setUserAmnestyRequests).catch(() => {});
    }
  }, []);

  // Load attendance settings sekali saat mount
  useEffect(() => {
    fetchSettings().then(setAttendanceSettings).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const list = await fetchRecent(name, 5);
      setHistory(list);
      // Derive today's check-in / check-out from history
      const today = new Date().toDateString();
      const ci = list.find((r: any) => r.type === "check-in" && new Date(r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt).toDateString() === today);
      const co = list.find((r: any) => r.type === "check-out" && new Date(r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt).toDateString() === today);
      if (ci && !ALLOW_MULTIPLE_ATTENDANCE) setTodayCheckIn(new Date(ci.createdAt?.toDate ? ci.createdAt.toDate() : ci.createdAt));
      if (co && !ALLOW_MULTIPLE_ATTENDANCE) setTodayCheckOut(new Date(co.createdAt?.toDate ? co.createdAt.toDate() : co.createdAt));
    })();
  }, [name]);

  const timeStr = useMemo(() =>
    new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now), [now]);

  const dateStr = useMemo(() =>
    new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now), [now]);

  async function handle(type: "check-in" | "check-out") {
    try {
      setLoading(type === "check-in" ? "in" : "out");
 
      if (attendanceSettings) {
        const timeCheck = checkTimeWindow(type, attendanceSettings);
        if (!timeCheck.ok) {
          toast({ title: `${type === "check-in" ? "Check-in" : "Check-out"} tidak diizinkan`, description: timeCheck.message });
          return;
        }
      }

      const pos = await getPositionLocal();
      const { latitude, longitude, accuracy } = pos.coords;

      if (attendanceSettings) {
        const radiusCheck = checkRadius(latitude, longitude, attendanceSettings);
        if (!radiusCheck.ok) {
          toast({
            title: "Lokasi di luar jangkauan",
            description: `Anda berada ${radiusCheck.distanceM}m dari titik absen. Maksimum radius: ${attendanceSettings.radiusMeters}m.`,
          });
          return;
        }
      }

      const user = getCurrentUser();
      if (user) {
        const hasFace = await hasRegisteredFace(user.email);
        if (hasFace) {
          setPendingType(type);
          setPendingGeoData({ latitude, longitude, accuracy: accuracy ?? null });
          setFaceVerified(false);
          setFaceMatchName(null);
          setShowFaceVerify(true);
          setLoading(null);
          return;
        }
      }

      setMapLocation({ lat: latitude, lng: longitude, accuracy: accuracy ?? null });
      setPendingType(type);
      setShowMapPreview(true);
    } catch (e: any) {
      toast({ title: "Gagal mendapatkan lokasi", description: e?.message ?? "Periksa izin lokasi" });
    } finally {
      setLoading(null);
    }
  }

  const handleFaceDetected = useCallback(async (descriptor: Float32Array) => {
    const user = getCurrentUser();
    const result = await matchFace(descriptor, user?.email ?? undefined);
    if (result) {
      setFaceVerified(true);
      setFaceMatchName(result.name);
      toast({ title: "Wajah terverifikasi!", description: `Cocok dengan: ${result.name}` });
      setTimeout(() => {
        setShowFaceVerify(false);
        if (pendingGeoData) {
          setMapLocation({ lat: pendingGeoData.latitude, lng: pendingGeoData.longitude, accuracy: pendingGeoData.accuracy });
          setShowMapPreview(true);
        }
      }, 1500);
    } else {
      toast({ title: "Wajah tidak cocok!", description: "Verifikasi gagal. Coba lagi." });
    }
  }, [pendingGeoData, toast]);

  async function handleRefresh() {
    try {
      const pos = await getPositionLocal();
      const { latitude, longitude, accuracy } = pos.coords;
      setMapLocation({ lat: latitude, lng: longitude, accuracy: accuracy ?? null });
      toast({ title: "Lokasi diperbarui" });
    } catch (e: any) {
      toast({ title: "Gagal memperbarui lokasi", description: e?.message ?? "Periksa izin lokasi" });
    }
  }

  async function confirmSave() {
    if (!pendingType || !mapLocation) return;

    const tempId = `temp-${Date.now()}`;
    const tempRecord = {
      id: tempId, type: pendingType,
      lat: mapLocation.lat, lng: mapLocation.lng, accuracy: mapLocation.accuracy,
      createdAt: new Date(),
    };

    setHistory((h) => [tempRecord, ...h].slice(0, 5));
    setShowMapPreview(false);
    setPendingType(null);
    setMapLocation(null);
    setPendingGeoData(null);
    setFaceVerified(false);
    setFaceMatchName(null);

    try {
      setLoading(pendingType === "check-in" ? "in" : "out");
      const rec = await recordAttendance(name, pendingType, undefined, { latitude: mapLocation.lat, longitude: mapLocation.lng, accuracy: mapLocation.accuracy ?? null });
      toast({ title: "Berhasil", description: `${pendingType === "check-in" ? "Check-in" : "Check-out"} tersimpan` });
      const updated = { ...rec, createdAt: new Date() };
      setHistory((h) => h.map((item) => item.id === tempId ? updated : item));
      if (pendingType === "check-in" && !ALLOW_MULTIPLE_ATTENDANCE) setTodayCheckIn(updated.createdAt);
      if (pendingType === "check-out" && !ALLOW_MULTIPLE_ATTENDANCE) setTodayCheckOut(updated.createdAt);
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message ?? "Terjadi kesalahan" });
      setHistory((h) => h.filter((item) => item.id !== tempId));
    } finally {
      setLoading(null);
    }
  }

  async function handleAmnestySubmit(type: "terlambat" | "pulang-cepat", reason: string, proofUrl: string) {
    const user = getCurrentUser();
    if (!user) throw new Error("User tidak ditemukan");
    
    await submitAmnestyRequest(user.email, user.name || user.email, type, reason, proofUrl);
    toast({ title: "Permohonan terkirim", description: "Admin akan meninjau permohonan Anda" });
    
    // Reload amnesty requests
    const requests = await fetchUserAmnestyRequests(user.email);
    setUserAmnestyRequests(requests);
  }

  if (!getCurrentUser()) {
    return <Navigate to="/login" />;
  }

  // Admin tidak perlu absensi — redirect ke dashboard admin
  if ((getCurrentUser() as any)?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="container mx-auto px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            Sistem Absensi Koperasi Karyawan Koja
          </h1>
                  </div>

        {!isFirebaseConfigured && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <p className="text-sm">Firebase belum dikonfigurasi. Set variabel lingkungan VITE_FIREBASE_* di Settings.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card: Absensi */}
          <div className="md:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="p-6 pb-2">
              <h2 className="text-lg font-semibold">Absensi Hari Ini</h2>
              <p className="text-sm text-zinc-500 mt-1">Isi nama Anda, lalu lakukan check-in atau check-out.</p>
            </div>
            <div className="p-6 pt-4 space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="text-sm font-medium text-zinc-500 mb-1">Nama Karyawan</div>
                  <div className="text-xl font-semibold">{name}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <Clock className="h-4 w-4 text-brand" />
                    {dateStr}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">{timeStr}</div>
                </div>
              </div>

              {faceRegistered === null ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 animate-pulse">
                  <ScanFace className="h-5 w-5 text-zinc-400 shrink-0" />
                  <span className="text-sm text-zinc-400">Memeriksa data wajah...</span>
                </div>
              ) : faceRegistered ? (
                <div className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 dark:bg-brand/10 p-3">
                  <ScanFace className="h-5 w-5 text-brand shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-brand">Wajah terdaftar.</span>
                    <span className="text-zinc-500 dark:text-zinc-400 ml-1">Face Recognition aktif saat absen.</span>
                    <Link to="/face-register" className="ml-2 underline text-brand hover:opacity-80 text-xs">
                      Perbarui →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-3">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-red-700 dark:text-red-400">Wajah belum terdaftar!</p>
                    <p className="text-red-600 dark:text-red-400 mt-0.5 text-xs">Anda harus mendaftarkan wajah terlebih dahulu sebelum bisa melakukan absensi.</p>
                    <Link
                      to="/face-register"
                      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <ScanFace className="h-3.5 w-3.5" /> Daftarkan Wajah Sekarang
                    </Link>
                  </div>
                </div>
              )}

              <div className={`flex flex-col md:flex-row items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 gap-4 ${!faceRegistered ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2 text-sm self-start">
                  <span className={`h-2 w-2 rounded-full ${geoSupported ? "bg-emerald-500" : "bg-red-500"}`} />
                  {geoSupported ? "Lokasi tersedia" : "Lokasi tidak tersedia"}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* Check-in Button */}
                  {todayCheckIn ? (
                    <div className="inline-flex flex-col items-center justify-center gap-0.5 px-5 py-2.5 text-sm bg-brand/10 dark:bg-brand/20 text-brand rounded-lg w-full cursor-not-allowed">
                      <div className="flex items-center gap-2 font-medium">
                        <LogIn className="h-4 w-4" /> Check-in
                      </div>
                      <span className="text-xs opacity-75">
                        {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(todayCheckIn)}
                      </span>
                      {history.find((h: any) => h.type === "check-in" && new Date(h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt).toDateString() === new Date().toDateString())?.isAmnesty && (
                        <span className="text-xs opacity-75 text-amber-600">via Amnesti</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handle("check-in")}
                      disabled={loading !== null || !geoSupported || !faceRegistered}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm bg-brand text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 w-full"
                    >
                      <LogIn className="h-4 w-4" /> Check-in
                    </button>
                  )}
                  {/* Check-out Button */}
                  {todayCheckOut ? (
                    <div className="inline-flex flex-col items-center justify-center gap-0.5 px-5 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg w-full cursor-not-allowed">
                      <div className="flex items-center gap-2 font-medium">
                        <LogOut className="h-4 w-4" /> Check-out
                      </div>
                      <span className="text-xs opacity-75">
                        {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(todayCheckOut)}
                      </span>
                      {history.find((h: any) => h.type === "check-out" && new Date(h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt).toDateString() === new Date().toDateString())?.isAmnesty && (
                        <span className="text-xs opacity-75 text-amber-600">via Amnesti</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handle("check-out")}
                      disabled={loading !== null || !geoSupported || !faceRegistered}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 w-full"
                    >
                      <LogOut className="h-4 w-4" /> Check-out
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 text-sm text-zinc-500">
              Pastikan izin lokasi diaktifkan pada browser Anda.
            </div>
          </div>

          {/* Card: Permohonan Amnesti */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="p-6 pb-2 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Amnesti</h2>
                <p className="text-sm text-zinc-500 mt-1">Izin terlambat/pulang cepat</p>
              </div>
              <button
                onClick={() => setShowAmnestyModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <FileText className="h-3.5 w-3.5" />
                Ajukan
              </button>
            </div>
            <div className="p-6 pt-4">
              {userAmnestyRequests.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Belum ada permohonan</p>
              ) : (
                <ul className="space-y-2">
                  {userAmnestyRequests.slice(0, 3).map((req) => (
                    <li key={req.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          req.type === "terlambat"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}>
                          {req.type === "terlambat" ? "Terlambat" : "Pulang Cepat"}
                        </span>
                        <span className={`text-xs font-medium capitalize ${
                          req.status === "pending" ? "text-amber-600" :
                          req.status === "approved" ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{req.reason}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleDateString("id-ID") : "-"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1 mt-6">
          {/* Card: Riwayat */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="p-6 pb-2">
              <h2 className="text-lg font-semibold">Riwayat Singkat</h2>
              <p className="text-sm text-zinc-500 mt-1">5 aktivitas terakhir Anda</p>
            </div>
            <div className="p-6 pt-4">
              <ul className="space-y-3">
                {history.length === 0 && (
                  <li className="text-sm text-zinc-500">Belum ada data.</li>
                )}
                {history.map((h, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{h.type === "check-in" ? "Check-in" : "Check-out"}</div>
                        {h.isAmnesty && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Amnesti
                          </span>
                        )}
                      </div>
                      {h.isAmnesty && h.amnestyReason && (
                        <div className="text-xs text-zinc-500 mt-1 italic">"{h.amnestyReason}"</div>
                      )}
                      <div className="text-xs text-zinc-500 mt-1">
                        {h.isAmnesty ? "Lokasi: Amnesti (tidak ada lokasi)" : `${h.lat?.toFixed?.(4)}, ${h.lng?.toFixed?.(4)}`}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(h.createdAt?.toDate ? h.createdAt.toDate() : Date.now()).toLocaleString("id-ID")}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Amnesty Modal */}
      <AmnestyModal
        isOpen={showAmnestyModal}
        onClose={() => setShowAmnestyModal(false)}
        onSubmit={handleAmnestySubmit}
        userName={name}
      />

      {/* Face Verification Modal */}
      <Modal
        open={showFaceVerify}
        onOpenChange={(open) => {
          if (!open) {
            setShowFaceVerify(false);
            setPendingType(null);
            setPendingGeoData(null);
            setFaceVerified(false);
            setFaceMatchName(null);
          }
        }}
        className="max-w-lg"
      >
        <ModalHeader onClose={() => {
          setShowFaceVerify(false);
          setPendingType(null);
          setPendingGeoData(null);
          setFaceVerified(false);
          setFaceMatchName(null);
        }}>
          <ModalTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5" />
            Verifikasi Wajah
          </ModalTitle>
        </ModalHeader>
        <div className="px-6 pb-6">
          {faceVerified ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ScanFace className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-lg font-medium text-emerald-600">Wajah Terverifikasi!</p>
              <p className="text-sm text-zinc-500">Cocok dengan: {faceMatchName}</p>
              <p className="text-xs text-zinc-400 animate-pulse">Melanjutkan ke preview lokasi...</p>
            </div>
          ) : (
            <>
              <FaceCapture
                mode="verify"
                autoCapture
                onFaceDetected={handleFaceDetected}
              />
              <p className="text-center text-xs text-zinc-500 mt-3">
                Arahkan wajah Anda ke kamera untuk verifikasi otomatis.
              </p>
            </>
          )}
        </div>
      </Modal>

      <LocationMapPreview
        open={showMapPreview}
        location={mapLocation}
        onOpenChange={(open) => {
          if (!open) { setPendingType(null); setMapLocation(null); }
          setShowMapPreview(open);
        }}
        onConfirm={confirmSave}
        onRefresh={handleRefresh}
        confirmLoading={loading !== null}
      />
    </div>
  );
}

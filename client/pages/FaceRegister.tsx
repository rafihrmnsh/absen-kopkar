import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { getCurrentUser } from "@/services/auth";
import { saveFaceDescriptor, hasRegisteredFace } from "@/services/faceRecognition";
import FaceCapture from "@/components/FaceCapture";
import { ScanFace, CheckCircle2, ShieldCheck, ArrowLeft } from "lucide-react";

export default function FaceRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = getCurrentUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      toast({ title: "Silakan login terlebih dahulu" });
      navigate("/login");
      return;
    }
    (async () => {
      const has = await hasRegisteredFace(user.email);
      setAlreadyRegistered(has);
    })();
  }, []);

  async function handleFaceDetected(descriptor: Float32Array) {
    if (!user) return;
    setSaving(true);
    try {
      await saveFaceDescriptor(user.email, user.name || user.email, descriptor);
      setSaved(true);
      toast({ title: "Wajah berhasil didaftarkan!", description: "Data wajah tersimpan aman." });
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e?.message ?? "Coba lagi" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-brand" />
            {alreadyRegistered ? "Data Wajah Sudah Terdaftar" : "Daftarkan Wajah"}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {alreadyRegistered
              ? "Wajah Anda sudah terdaftar. Anda bisa mendaftarkan ulang jika diperlukan."
              : "Daftarkan wajah Anda untuk verifikasi saat absensi."}
          </p>
        </div>

        <div className="p-6 pt-4">
          {saved ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                Pendaftaran Berhasil!
              </h3>
              <p className="text-sm text-zinc-500 text-center max-w-xs">
                Data wajah Anda telah tersimpan dan akan digunakan untuk verifikasi saat check-in/check-out.
              </p>
              <button
                onClick={() => navigate("/")}
                className="px-5 py-2.5 text-sm bg-brand text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Kembali ke Beranda
              </button>
            </div>
          ) : showCamera ? (
            <div className="space-y-4">
              {saving && (
                <div className="flex items-center gap-2 justify-center text-sm text-zinc-500 animate-pulse">
                  Menyimpan data wajah...
                </div>
              )}
              <FaceCapture mode="register" onFaceDetected={handleFaceDetected} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-20 w-20 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <ScanFace className="h-10 w-10 text-cyan-500" />
              </div>
              <p className="text-sm text-zinc-500 text-center max-w-xs">
                Kami akan menggunakan kamera Anda untuk menangkap data wajah. Pastikan wajah terlihat jelas dan pencahayaan cukup.
              </p>
              <button
                onClick={() => setShowCamera(true)}
                className="px-5 py-2.5 text-sm bg-brand text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {alreadyRegistered ? "Daftarkan Ulang Wajah" : "Mulai Registrasi"}
              </button>
            </div>
          )}
        </div>

        {/* Privacy info */}
        <div className="mx-6 mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 flex items-start gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Privasi terjamin.</span>{" "}
            Semua proses AI berjalan di browser Anda. Hanya descriptor numerik (bukan foto) yang disimpan.
          </div>
        </div>
      </div>
    </div>
  );
}

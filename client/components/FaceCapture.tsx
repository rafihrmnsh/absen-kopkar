import { useEffect, useRef, useState, useCallback } from "react";
import { loadModels, drawDetections, detectFace } from "@/services/faceRecognition";
import { Loader2, Camera, ScanFace, CheckCircle2, XCircle } from "lucide-react";

type FaceCaptureMode = "register" | "verify";

interface Props {
  mode: FaceCaptureMode;
  onFaceDetected?: (descriptor: Float32Array) => void;
  autoCapture?: boolean;
  className?: string;
}

type Status = "loading" | "ready" | "detecting" | "detected" | "no-face" | "error";

export default function FaceCapture({
  mode,
  onFaceDetected,
  autoCapture = false,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Gagal mengakses kamera");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const detectionLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const faceFound = await drawDetections(video, canvas);
    setStatus(faceFound ? "detected" : "detecting");

    animFrameRef.current = requestAnimationFrame(() => {
      setTimeout(detectionLoop, 200);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        await loadModels();
        if (cancelled) return;
        await startCamera();
        if (cancelled) return;
        setStatus("ready");
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err?.message ?? "Gagal memuat model");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleVideoPlay = useCallback(() => {
    setStatus("detecting");
    detectionLoop();
  }, [detectionLoop]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const descriptor = await detectFace(video);
    if (descriptor) {
      onFaceDetected?.(descriptor);
    } else {
      setStatus("no-face");
      setTimeout(() => setStatus("detecting"), 2000);
    }
  }, [onFaceDetected]);

  useEffect(() => {
    if (!autoCapture || mode !== "verify") return;
    if (status !== "detected") return;

    const timer = setTimeout(async () => {
      await handleCapture();
    }, 800);

    return () => clearTimeout(timer);
  }, [autoCapture, mode, status, handleCapture]);

  const statusConfig: Record<Status, { icon: React.ReactNode; text: string; color: string }> = {
    loading: {
      icon: <Loader2 className="h-5 w-5 animate-spin" />,
      text: "Memuat model AI...",
      color: "text-zinc-500",
    },
    ready: {
      icon: <Camera className="h-5 w-5" />,
      text: "Kamera siap",
      color: "text-blue-500",
    },
    detecting: {
      icon: <ScanFace className="h-5 w-5 animate-pulse" />,
      text: "Mencari wajah...",
      color: "text-yellow-500",
    },
    detected: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      text: "Wajah terdeteksi!",
      color: "text-emerald-500",
    },
    "no-face": {
      icon: <XCircle className="h-5 w-5" />,
      text: "Wajah tidak ditemukan, coba lagi",
      color: "text-red-500",
    },
    error: {
      icon: <XCircle className="h-5 w-5" />,
      text: errorMsg || "Terjadi kesalahan",
      color: "text-red-500",
    },
  };

  const current = statusConfig[status];

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative w-full max-w-md aspect-[4/3] rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onPlay={handleVideoPlay}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full -scale-x-100"
        />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="text-sm">Memuat model AI...</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className={`w-48 h-56 rounded-[50%] border-2 border-dashed transition-colors duration-300 ${
              status === "detected"
                ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                : "border-white/30"
            }`}
          />
        </div>
      </div>

      <div className={`flex items-center gap-2 text-sm font-medium ${current.color}`}>
        {current.icon}
        <span>{current.text}</span>
      </div>

      {mode === "register" && !autoCapture && (
        <button
          onClick={handleCapture}
          disabled={status !== "detected" && status !== "detecting"}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          Ambil Foto Wajah
        </button>
      )}
    </div>
  );
}

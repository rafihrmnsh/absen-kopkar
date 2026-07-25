import { useState } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import type { AmnestyType } from "@shared/types";

interface AmnestyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: AmnestyType, reason: string, proofUrl: string) => Promise<void>;
  userName: string;
}

export default function AmnestyModal({ isOpen, onClose, onSubmit, userName }: AmnestyModalProps) {
  const [type, setType] = useState<AmnestyType>("terlambat");
  const [reason, setReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!reason.trim()) {
      setError("Alasan wajib diisi");
      return;
    }

    if (!proofUrl.trim()) {
      setError("Link bukti wajib diisi");
      return;
    }

    // Validasi URL
    try {
      new URL(proofUrl);
    } catch {
      setError("Link bukti tidak valid");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(type, reason.trim(), proofUrl.trim());
      setReason("");
      setProofUrl("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal mengirim permohonan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold">Permohonan Amnesti</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nama</label>
            <input
              type="text"
              value={userName}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Jenis Amnesti</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AmnestyType)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="terlambat">Izin Terlambat</option>
              <option value="pulang-cepat">Izin Pulang Cepat</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Alasan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan Anda..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <Upload className="h-4 w-4 inline mr-1" />
              Link Bukti (Google Drive, dll)
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Upload bukti ke Google Drive/cloud storage dan paste linknya di sini
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-brand text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Mengirim..." : "Kirim Permohonan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

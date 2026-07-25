import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import type { AttendanceStatus } from "@shared/types";

interface OverrideStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recordId: string, newStatus: AttendanceStatus, adminNote: string) => Promise<void>;
  record: {
    id: string;
    name: string;
    type: string;
    currentStatus?: AttendanceStatus;
  } | null;
}

export default function OverrideStatusModal({ isOpen, onClose, onSubmit, record }: OverrideStatusModalProps) {
  const [newStatus, setNewStatus] = useState<AttendanceStatus>("normal");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setSubmitting(true);
    try {
      await onSubmit(record.id, newStatus, adminNote.trim());
      setAdminNote("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal mengubah status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold">Override Status Kehadiran</h3>
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
            <label className="block text-sm font-medium mb-2">Karyawan</label>
            <input
              type="text"
              value={`${record.name} - ${record.type}`}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status Saat Ini</label>
            <input
              type="text"
              value={record.currentStatus || "normal"}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 capitalize"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status Baru</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as AttendanceStatus)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <option value="normal">Normal</option>
              <option value="hadir">Hadir</option>
              <option value="terlambat">Terlambat</option>
              <option value="pulang-cepat">Pulang Cepat</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Catatan Admin (Opsional)</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Alasan perubahan status..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
            />
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
              {submitting ? "Menyimpan..." : "Ubah Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

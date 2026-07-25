import { useState } from "react";
import { Modal, ModalHeader, ModalTitle, ModalFooter } from "@/components/Modal";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  location: { lat: number; lng: number; accuracy?: number | null } | null;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => Promise<void> | void;
  onRefresh?: () => void;
  confirmLoading?: boolean;
}

export default function LocationMapPreview({
  open,
  location,
  onOpenChange,
  onConfirm,
  onRefresh,
  confirmLoading,
}: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!location) return null;
  const { lat, lng } = location;

  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const marker = `${lat},${lng}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-w-3xl">
      <ModalHeader onClose={() => onOpenChange?.(false)}>
        <ModalTitle>Preview Lokasi</ModalTitle>
      </ModalHeader>

      <div className="px-6">
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          {isRefreshing ? (
            <Loader2 className="h-12 w-12 animate-spin text-zinc-400" />
          ) : (
            <iframe
              key={src}
              title="map-preview"
              src={src}
              style={{ border: 0, width: "100%", height: "100%" }}
              loading="lazy"
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <a
            href={osmLink}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-700 underline"
          >
            Buka di OpenStreetMap
          </a>
        </div>
      </div>

      <ModalFooter>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "Memuat..." : "Refresh"}
        </button>
        <button
          onClick={() => onOpenChange?.(false)}
          className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={async () => {
            if (!onConfirm) return;
            try {
              await onConfirm();
            } catch (e) {
              // swallow — parent shows toast
            }
          }}
          disabled={!!confirmLoading || isRefreshing}
          className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {confirmLoading ? "Menyimpan..." : "Konfirmasi"}
        </button>
      </ModalFooter>
    </Modal>
  );
}

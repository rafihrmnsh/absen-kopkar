import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface AttendanceSettings {
  /** Aktifkan validasi radius lokasi */
  radiusEnabled: boolean;
  /** Latitude titik pusat absen */
  centerLat: number;
  /** Longitude titik pusat absen */
  centerLng: number;
  /** Radius maksimum dalam meter */
  radiusMeters: number;
  /** Aktifkan validasi batas waktu */
  timeEnabled: boolean;
  /** Batas akhir check-in (format "HH:MM", contoh "09:00") */
  checkInDeadline: string;
  /** Waktu paling awal check-out (format "HH:MM", contoh "16:00") */
  checkOutEarliestTime: string;
  /** Aktifkan pengingat absen via email */
  reminderEnabled: boolean;
  /** Jam pengingat dikirim (format "HH:MM") */
  reminderTime: string;
  /** Email pengirim (from address) */
  reminderFromEmail: string;
  /** Kapan terakhir diperbarui */
  updatedAt?: any;
}

const DEFAULT_SETTINGS: AttendanceSettings = {
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
};

const LOCAL_KEY = "attendance:settings";

function saveLocalSettings(s: AttendanceSettings) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function readLocalSettings(): AttendanceSettings {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export async function fetchSettings(): Promise<AttendanceSettings> {
  const db = getDb();
  if (!db) return readLocalSettings();

  try {
    const ref = doc(db, "settings", "attendance");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AttendanceSettings>) };
    }
  } catch {
    // fallback ke local
  }
  return readLocalSettings();
}

export async function saveSettings(s: AttendanceSettings): Promise<void> {
  const db = getDb();

  // Selalu simpan ke localStorage juga sebagai cache
  saveLocalSettings(s);

  if (!db) return;

  const ref = doc(db, "settings", "attendance");
  await setDoc(ref, { ...s, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hitung jarak antara dua koordinat (Haversine formula).
 * Return dalam meter.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // radius bumi dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Cek apakah posisi user berada dalam radius yang ditentukan admin.
 * Jika radiusEnabled = false, selalu return ok = true.
 */
export function checkRadius(
  userLat: number,
  userLng: number,
  settings: AttendanceSettings
): { ok: boolean; distanceM: number } {
  if (!settings.radiusEnabled) return { ok: true, distanceM: 0 };
  const distanceM = haversineDistance(
    userLat,
    userLng,
    settings.centerLat,
    settings.centerLng
  );
  return { ok: distanceM <= settings.radiusMeters, distanceM: Math.round(distanceM) };
}

/**
 * Parse string jam "HH:MM" ke { hours, minutes }.
 */
function parseTime(t: string): { hours: number; minutes: number } {
  const [h, m] = t.split(":").map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Cek apakah waktu sekarang masih dalam window yang diizinkan untuk type absen.
 * Jika timeEnabled = false, selalu return ok = true.
 *
 * - check-in: sebelum atau tepat checkInDeadline
 * - check-out: setelah atau tepat checkOutEarliestTime
 */
export function checkTimeWindow(
  type: "check-in" | "check-out",
  settings: AttendanceSettings,
  now: Date = new Date()
): { ok: boolean; message: string } {
  if (!settings.timeEnabled) return { ok: true, message: "" };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (type === "check-in") {
    const deadline = parseTime(settings.checkInDeadline);
    const deadlineMinutes = deadline.hours * 60 + deadline.minutes;
    if (currentMinutes > deadlineMinutes) {
      return {
        ok: false,
        message: `Batas check-in adalah pukul ${settings.checkInDeadline}. Sekarang sudah pukul ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}.`,
      };
    }
  }

  if (type === "check-out") {
    const earliest = parseTime(settings.checkOutEarliestTime);
    const earliestMinutes = earliest.hours * 60 + earliest.minutes;
    if (currentMinutes < earliestMinutes) {
      return {
        ok: false,
        message: `Check-out baru diizinkan mulai pukul ${settings.checkOutEarliestTime}. Sekarang masih pukul ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}.`,
      };
    }
  }

  return { ok: true, message: "" };
}

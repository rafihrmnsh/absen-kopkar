import { addDoc, collection, serverTimestamp, query, orderBy, limit, where, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export type AttendanceType = "check-in" | "check-out";

export interface AttendanceRecord {
  name: string;
  type: AttendanceType;
  timestamp: Date;
  lat: number;
  lng: number;
  accuracy?: number | null;
  note?: string | null;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation tidak didukung browser ini."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const LOCAL_KEY = "attendance:local";

function saveLocal(payload: any) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(payload);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 500)));
  } catch (e) {
    // ignore
  }
}

function readLocal(name: string | null, max = 10) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (name && name.trim()) {
      return arr.filter((r: any) => r.name === name.trim()).slice(0, max);
    }
    return arr.slice(0, max);
  } catch (e) {
    return [];
  }
}

export async function recordAttendance(name: string, type: AttendanceType, note?: string, coords?: { latitude: number; longitude: number; accuracy?: number | null }) {
  const db = getDb();
  if (!name.trim()) throw new Error("Nama wajib diisi.");

  let latitude: number;
  let longitude: number;
  let accuracy: number | null | undefined;
  if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
    latitude = coords.latitude;
    longitude = coords.longitude;
    accuracy = coords.accuracy ?? null;
  } else {
    const pos = await getPosition();
    latitude = pos.coords.latitude;
    longitude = pos.coords.longitude;
    accuracy = pos.coords.accuracy ?? null;
  }

  const timestamp = new Date();

  const payloadForDb: any = {
    name,
    type,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? null,
    note: note ?? null,
    createdAt: serverTimestamp(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  // If Firestore available, write there. Otherwise, persist locally for dev/testing.
  if (db) {
    await addDoc(collection(db, "attendance"), payloadForDb);
  } else {
    // Convert createdAt to ISO for local storage
    const localPayload = { ...payloadForDb, createdAt: timestamp.toISOString() };
    saveLocal(localPayload);
  }

  const result: AttendanceRecord = {
    name,
    type,
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? null,
    note: note ?? null,
    timestamp,
  };
  return result;
}

export async function fetchRecent(name: string | null, max = 10) {
  const db = getDb();
  if (!db) {
    return readLocal(name, max);
  }

  const base = collection(db, "attendance");
  let snap;
  if (name && name.trim()) {
    // Menggunakan where saja (tanpa orderBy) untuk menghindari kebutuhan composite index.
    // Sorting dilakukan di client-side.
    const q = query(base, where("name", "==", name.trim()), limit(max * 3));
    snap = await getDocs(q);
  } else {
    const q = query(base, orderBy("createdAt", "desc"), limit(max));
    snap = await getDocs(q);
  }

  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  if (name && name.trim()) {
    // Sort descending by createdAt di client
    docs.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt ?? 0).getTime();
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    return docs.slice(0, max);
  }

  return docs;
}

export async function fetchAll(max = 500) {
  const db = getDb();
  if (!db) {
    return readLocal(null, max);
  }
  const base = collection(db, "attendance");
  const q = query(base, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

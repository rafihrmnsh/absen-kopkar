import { addDoc, collection, query, where, getDocs, doc, updateDoc, limit, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { AmnestyRequest, AmnestyType, AmnestyStatus } from "@shared/types";

export async function submitAmnestyRequest(
  userId: string,
  userName: string,
  type: AmnestyType,
  reason: string,
  proofUrl: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database tidak tersedia");

  await addDoc(collection(db, "amnesty"), {
    userId,
    userName,
    type,
    reason,
    proofUrl,
    status: "pending" as AmnestyStatus,
    createdAt: new Date(),
  });
}

export async function fetchUserAmnestyRequests(userId: string): Promise<AmnestyRequest[]> {
  const db = getDb();
  if (!db) return [];

  const q = query(
    collection(db, "amnesty"),
    where("userId", "==", userId),
    limit(50)
  );
  
  const snap = await getDocs(q);
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AmnestyRequest));
  
  // Sort di client-side untuk menghindari composite index
  results.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });
  
  return results;
}

export async function fetchAllAmnestyRequests(): Promise<AmnestyRequest[]> {
  const db = getDb();
  if (!db) return [];

  const q = query(
    collection(db, "amnesty"),
    limit(100)
  );
  
  const snap = await getDocs(q);
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AmnestyRequest));
  
  // Sort di client-side untuk menghindari composite index
  results.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });
  
  return results;
}

export async function reviewAmnestyRequest(
  requestId: string,
  status: "approved" | "rejected",
  reviewNote: string,
  reviewedBy: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database tidak tersedia");

  const docRef = doc(db, "amnesty", requestId);
  
  // Get the amnesty request data first
  const amnestyDoc = await getDoc(docRef);
  if (!amnestyDoc.exists()) throw new Error("Permohonan tidak ditemukan");
  
  const amnestyData = amnestyDoc.data();
  
  // Update amnesty status
  await updateDoc(docRef, {
    status,
    reviewNote,
    reviewedBy,
    reviewedAt: new Date(),
  });

  // If approved, auto create attendance record at normal working hours
  // Izin Terlambat → auto check-in di jam masuk normal
  // Izin Pulang Cepat → auto check-out di jam pulang normal
  if (status === "approved" && amnestyData) {
    const { fetchSettings } = await import("@/services/attendanceSettings");
    const settings = await fetchSettings();
    const today = new Date();

    const isTerlambat = amnestyData.type === "terlambat";
    const amnestyLabel = isTerlambat ? "Izin Terlambat" : "Izin Pulang Cepat";

    // Tentukan jam berdasarkan jenis amnesti
    const timeStr = isTerlambat ? settings.checkInDeadline : settings.checkOutEarliestTime;
    const [h, m] = timeStr.split(":").map(Number);
    const recordTime = new Date(today);
    recordTime.setHours(h, m, 0, 0);

    await addDoc(collection(db, "attendance"), {
      name: amnestyData.userName,
      type: isTerlambat ? "check-in" : "check-out",
      lat: 0,
      lng: 0,
      accuracy: null,
      userAgent: "amnesty-system",
      status: "hadir",
      isAmnesty: true,
      amnestyId: requestId,
      amnestyReason: amnestyData.reason,
      createdAt: recordTime,
      note: `Amnesti ${amnestyLabel} disetujui`,
    });
  }
}

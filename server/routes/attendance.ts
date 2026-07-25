import { RequestHandler } from "express";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin (singleton)
function getDb() {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var tidak ditemukan");
    }
    
    let parsed: object;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT bukan JSON valid");
    }

    // Cek apakah app sudah diinit (singleton)
    if (!getApps().length) {
      initializeApp({ credential: cert(parsed as any) });
    }
    
    return getFirestore();
  } catch (e: any) {
    throw new Error(`Firebase init gagal: ${e?.message ?? e}`);
  }
}

// Override status kehadiran karyawan
export const overrideAttendanceStatus: RequestHandler = async (req, res) => {
  try {
    const { recordId, newStatus, adminNote } = req.body;

    if (!recordId || !newStatus) {
      return res.status(400).json({ error: "recordId dan newStatus wajib diisi" });
    }

    const db = getDb();
    const docRef = db.collection("attendance").doc(recordId);
    
    await docRef.update({
      status: newStatus,
      overriddenBy: "admin",
      overriddenAt: FieldValue.serverTimestamp(),
      adminNote: adminNote || null,
    });

    res.json({ success: true, message: "Status berhasil diubah" });
  } catch (error: any) {
    console.error("Error override status:", error);
    res.status(500).json({ error: error.message || "Gagal mengubah status" });
  }
};

import { RequestHandler } from "express";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

// ─── Helper: tanggal hari ini (WIB UTC+7) ────────────────────────────────────
function getTodayDateString(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export const sendReminder: RequestHandler = async (req, res) => {
  // 1. Init Firebase Admin (modular API v10+)
  let db: ReturnType<typeof getFirestore>;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      return res.status(500).json({ error: "FIREBASE_SERVICE_ACCOUNT env var tidak ditemukan" });
    }
    let parsed: object;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "FIREBASE_SERVICE_ACCOUNT bukan JSON valid. Pastikan paste seluruh isi file JSON tanpa kutip tambahan.",
      });
    }

    // Cek apakah app sudah diinit (singleton)
    if (!getApps().length) {
      initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
    }
    db = getFirestore();
  } catch (e: any) {
    return res.status(500).json({ error: `Firebase init gagal: ${e?.message ?? e}` });
  }

  // 2. Init Nodemailer
  const SMTP_USER = process.env.SMTP_USER || "";
  const SMTP_PASS = process.env.SMTP_PASS || "";
  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: "SMTP_USER atau SMTP_PASS env var tidak ditemukan" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    // 3. Baca settings
    const settingsDoc = await db.doc("settings/attendance").get();
    const settings = settingsDoc.exists ? settingsDoc.data() : null;
    if (!settings) {
      return res.status(200).json({ message: "Settings belum dikonfigurasi di Firestore", sent: 0 });
    }

    // 4. Cek toggle (body.manual = selalu kirim)
    const body = req.body || {};
    if (!settings.reminderEnabled && !body.manual) {
      return res.status(200).json({ message: "Pengingat email dinonaktifkan", sent: 0 });
    }

    // 5. Ambil semua user (kecuali admin)
    const usersSnap = await db.collection("users").get();
    const allUsers = usersSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          email: data.email as string,
          name: (data.name || data.email) as string,
          role: (data.role as string) || "user",
        };
      })
      .filter((u) => u.role !== "admin"); // Admin tidak perlu diingatkan
    if (allUsers.length === 0) {
      return res.status(200).json({ message: "Tidak ada user karyawan terdaftar", sent: 0 });
    }

    // 6. Cek siapa yang sudah check-in hari ini
    const todayStr = getTodayDateString();
    const todayStart = new Date(`${todayStr}T00:00:00+07:00`);
    const todayEnd   = new Date(`${todayStr}T23:59:59+07:00`);

    const attendanceSnap = await db
      .collection("attendance")
      .where("type", "==", "check-in")
      .where("createdAt", ">=", Timestamp.fromDate(todayStart))
      .where("createdAt", "<=", Timestamp.fromDate(todayEnd))
      .get();

    const checkedInNames = new Set(attendanceSnap.docs.map((d) => d.data().name as string));

    // 7. Filter belum check-in
    const notCheckedIn = allUsers.filter(
      (u) => !checkedInNames.has(u.name) && !checkedInNames.has(u.email)
    );
    if (notCheckedIn.length === 0) {
      return res.status(200).json({ message: "Semua karyawan sudah check-in hari ini!", sent: 0 });
    }

    // 8. Kirim email
    const fromEmail = settings.reminderFromEmail || SMTP_USER;
    let sentCount = 0;
    const errors: string[] = [];

    for (const user of notCheckedIn) {
      try {
        await transporter.sendMail({
          to: user.email,
          from: `"Sistem Absensi" <${fromEmail}>`,
          subject: `⏰ Pengingat Absensi - ${todayStr}`,
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
              <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:24px;color:white;text-align:center;margin-bottom:24px;">
                <h1 style="margin:0;font-size:20px;">⏰ Pengingat Absensi</h1>
                <p style="margin:8px 0 0;opacity:.9;font-size:14px;">${todayStr}</p>
              </div>
              <p style="font-size:15px;color:#333;">Halo <strong>${user.name}</strong>,</p>
              <p style="font-size:14px;color:#555;line-height:1.6;">
                Kami belum menerima data <strong>check-in</strong> Anda hari ini. Silakan segera absensi.
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="https://absenkopkar.vercel.app"
                   style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                  Absen Sekarang →
                </a>
              </div>
              <p style="font-size:12px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:16px;margin-top:24px;">
                Email ini dikirim otomatis oleh Sistem Absensi.
              </p>
            </div>
          `,
        });
        sentCount++;
      } catch (e: any) {
        errors.push(`${user.email}: ${e?.message ?? "unknown"}`);
      }
    }

    return res.status(200).json({
      message: `Pengingat terkirim ke ${sentCount} dari ${notCheckedIn.length} karyawan`,
      sent: sentCount,
      total: notCheckedIn.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (e: any) {
    return res.status(500).json({ error: `Runtime error: ${e?.message ?? e}` });
  }
}

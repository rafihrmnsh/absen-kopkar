import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { addDoc, collection, query, where, getDocs, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

type User = { email: string; name: string; role?: "admin" | "user" };

const AUTH_KEY = "auth:user";
const LOCAL_USERS_KEY = "users:local";

const listeners = new Set<(u: User | null) => void>();

function emit(u: User | null) {
  listeners.forEach((l) => l(u));
}

async function sha256Hex(text: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // fallback naive hash (not secure) — only for environments without SubtleCrypto
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function saveLocalUser(email: string, name: string, hash: string) {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ email, name, hash, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(arr));
  } catch (e) {
    // ignore
  }
}

function findLocalUser(email: string) {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.find((u: any) => u.email === email) ?? null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
  emit(user);
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch (e) {
    return null;
  }
}

export function onAuthChange(cb: (u: User | null) => void) {
  listeners.add(cb);
  cb(getCurrentUser());
  return () => listeners.delete(cb);
}

export async function register(email: string, password: string, name: string) {
  if (!email || !password) throw new Error("Email dan password wajib diisi.");
  const db = getDb();
  const hash = await sha256Hex(password);
  // try Firestore
  if (db) {
    const usersCol = collection(db, "users");
    const q = query(usersCol, where("email", "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) throw new Error("Email sudah terdaftar.");
    await addDoc(usersCol, { email, name, hash, role: "user", createdAt: serverTimestamp() });
    const user: User = { email, name, role: "user" };
    setCurrentUser(user);
    return user;
  }
  // fallback local
  const exists = findLocalUser(email);
  if (exists) throw new Error("Email sudah terdaftar (lokal).");
  saveLocalUser(email, name, hash);
  const user = { email, name };
  setCurrentUser(user);
  return user;
}

export async function login(email: string, password: string) {
  if (!email || !password) throw new Error("Email dan password wajib diisi.");
  const db = getDb();
  const hash = await sha256Hex(password);
  if (db) {
    const usersCol = collection(db, "users");
    const q = query(usersCol, where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Pengguna tidak ditemukan.");
    const doc = snap.docs[0].data() as any;
    if (doc.hash !== hash) throw new Error("Password salah.");
    const user: User = { email: doc.email, name: doc.name ?? doc.email, role: (doc.role as "admin" | "user") ?? "user" };
    setCurrentUser(user);
    return user;
  }

  const local = findLocalUser(email);
  if (!local) throw new Error("Pengguna tidak ditemukan (lokal).");
  if (local.hash !== hash) throw new Error("Password salah.");
  const user = { email: local.email, name: local.name ?? local.email };
  setCurrentUser(user);
  return user;
}

export async function loginWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth tidak dikonfigurasi.");
  
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const gUser = result.user;
    if (!gUser.email) throw new Error("Tidak ada email dari akun Google.");

    const db = getDb();
    let role: "admin" | "user" = "user";

    if (db) {
      const usersCol = collection(db, "users");
      const q = query(usersCol, where("email", "==", gUser.email));
      const snap = await getDocs(q);

      if (snap.empty) {
        await addDoc(usersCol, {
          email: gUser.email,
          name: gUser.displayName || gUser.email,
          hash: "GOOGLE_AUTH",
          role: "user",
          createdAt: serverTimestamp(),
        });
      } else {
        role = (snap.docs[0].data() as any).role ?? "user";
      }
    } else {
      const local = findLocalUser(gUser.email);
      if (!local) {
        saveLocalUser(gUser.email, gUser.displayName || gUser.email, "GOOGLE_AUTH");
      }
    }

    const user: User = { email: gUser.email, name: gUser.displayName || gUser.email, role };
    setCurrentUser(user);
    return user;
  } catch (error: any) {
    throw new Error(error.message || "Gagal login dengan Google.");
  }
}

export function logout() {
  setCurrentUser(null);
}

export const authService = { register, login, loginWithGoogle, logout, getCurrentUser, onAuthChange };

import * as faceapi from "face-api.js";
import { getDb } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const MODEL_URL = "/models";
let modelsLoaded = false;

/** Load face-api.js models (only once). */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/** Detect a single face from a video/canvas element and return its 128-dim descriptor. */
export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  return result?.descriptor ?? null;
}

/** Draw detection overlay on canvas. Returns whether a face was detected. */
export async function drawDetections(
  input: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<boolean> {
  const displaySize = {
    width: input.videoWidth,
    height: input.videoHeight,
  };
  faceapi.matchDimensions(canvas, displaySize);

  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true);

  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (result) {
    const resized = faceapi.resizeResults(result, displaySize);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
    return true;
  }
  return false;
}

// ─── Firestore helpers ───────────────────────────────────────────────

export interface StoredFaceDescriptor {
  id: string;
  userId: string;
  name: string;
  descriptor: number[];
}

const LOCAL_FACE_KEY = "faceDescriptors:local";

function saveLocalDescriptor(userId: string, name: string, descriptor: number[]) {
  try {
    const raw = localStorage.getItem(LOCAL_FACE_KEY);
    let arr: any[] = raw ? JSON.parse(raw) : [];
    // Remove existing entries for same userId
    arr = arr.filter((d: any) => d.userId !== userId);
    arr.push({ userId, name, descriptor, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_FACE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function readLocalDescriptors(): StoredFaceDescriptor[] {
  try {
    const raw = localStorage.getItem(LOCAL_FACE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map((d: any, i: number) => ({
      id: `local-${i}`,
      userId: d.userId,
      name: d.name,
      descriptor: d.descriptor,
    }));
  } catch {
    return [];
  }
}

function findLocalDescriptor(userId: string): StoredFaceDescriptor | null {
  const all = readLocalDescriptors();
  return all.find((d) => d.userId === userId) ?? null;
}

/** Save a face descriptor for a user. Overwrites previous entries. */
export async function saveFaceDescriptor(
  userId: string,
  name: string,
  descriptor: Float32Array,
): Promise<void> {
  const descriptorArray = Array.from(descriptor);
  const db = getDb();

  if (db) {
    const col = collection(db, "faceDescriptors");
    const q = query(col, where("userId", "==", userId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, "faceDescriptors", d.id));
    }
    await addDoc(col, {
      userId,
      name,
      descriptor: descriptorArray,
      createdAt: serverTimestamp(),
    });
  } else {
    saveLocalDescriptor(userId, name, descriptorArray);
  }
}

/** Load all stored face descriptors. */
export async function loadAllDescriptors(): Promise<StoredFaceDescriptor[]> {
  const db = getDb();
  if (!db) return readLocalDescriptors();

  const col = collection(db, "faceDescriptors");
  const snap = await getDocs(col);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      userId: data.userId,
      name: data.name,
      descriptor: data.descriptor,
    };
  });
}

/** Check if a user already has a registered face. */
export async function hasRegisteredFace(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return findLocalDescriptor(userId) !== null;

  const col = collection(db, "faceDescriptors");
  const q = query(col, where("userId", "==", userId));
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Match a query descriptor against all stored descriptors.
 *  Returns the best match if distance < threshold, or null. */
export interface MatchResult {
  userId: string;
  name: string;
  distance: number;
}

export async function matchFace(
  queryDescriptor: Float32Array,
  expectedUserId?: string,
  threshold = 0.45,
): Promise<MatchResult | null> {
  let stored = await loadAllDescriptors();
  if (expectedUserId) {
    stored = stored.filter((s) => s.userId === expectedUserId);
  }
  if (stored.length === 0) return null;

  let bestMatch: MatchResult | null = null;
  let bestDistance = Infinity;

  for (const s of stored) {
    const ref = new Float32Array(s.descriptor);
    const distance = faceapi.euclideanDistance(
      Array.from(queryDescriptor),
      Array.from(ref),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { userId: s.userId, name: s.name, distance };
    }
  }

  if (bestMatch && bestMatch.distance < threshold) {
    return bestMatch;
  }
  return null;
}

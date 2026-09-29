/**
 * RegForge — data layer.
 *
 * One API, two backings:
 *   • Firebase   → Firestore collection "questionnaires" (auto when NEXT_PUBLIC_FIREBASE_* is set)
 *   • Local      → browser localStorage (so the app works with zero setup)
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { Answers } from './library';
import { ensureSession, fb, firebaseConfigured } from './firebase';

export const COLLECTION = 'questionnaires';
const LOCAL_KEY = 'regforge.db.v1';
const LOCAL_EVENT = 'regforge:db';

export type StorageMode = 'firebase' | 'local';

export interface Questionnaire {
  token: string;
  projectId: string;
  title: string;
  clientName: string;
  clientEmail: string;
  ownerEmail: string;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  answers: Answers;
}

export function storageMode(): StorageMode {
  return firebaseConfigured ? 'firebase' : 'local';
}

/* ------------------------------------------------------------------ helpers */

export function newToken(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

function clean(answers: Answers): Answers {
  const out: Answers = {};
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function fromDoc(id: string, data: Record<string, unknown>): Questionnaire {
  return {
    token: (data.token as string) ?? id,
    projectId: (data.projectId as string) ?? id,
    title: (data.title as string) ?? 'Untitled project',
    clientName: (data.clientName as string) ?? '',
    clientEmail: (data.clientEmail as string) ?? '',
    ownerEmail: (data.ownerEmail as string) ?? '',
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? data.createdAt ?? Date.now()),
    submittedAt: (data.submittedAt as number | null) ?? null,
    answers: (data.answers as Answers) ?? {},
  };
}

/* ------------------------------------------------------------- local backing */

function readLocal(): Questionnaire[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { questionnaires?: Questionnaire[] };
    return (parsed.questionnaires ?? []).map((q) => ({ ...q, answers: q.answers ?? {} }));
  } catch {
    return [];
  }
}

function writeLocal(items: Questionnaire[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ questionnaires: items }));
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

function upsertLocal(item: Questionnaire): void {
  const items = readLocal();
  const i = items.findIndex((q) => q.token === item.token);
  if (i >= 0) items[i] = item;
  else items.unshift(item);
  writeLocal(items);
}

/* -------------------------------------------------------------------- public */

export interface NewQuestionnaireInput {
  title: string;
  clientName: string;
  clientEmail: string;
}

export async function createQuestionnaire(input: NewQuestionnaireInput): Promise<Questionnaire> {
  const now = Date.now();
  const token = newToken();
  const base: Questionnaire = {
    token,
    projectId: token,
    title: input.title.trim() || `${input.clientName || 'Client'} — website requirements`,
    clientName: input.clientName.trim(),
    clientEmail: input.clientEmail.trim().toLowerCase(),
    ownerEmail: '',
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    answers: {},
  };

  if (!firebaseConfigured) {
    upsertLocal(base);
    return base;
  }

  const f = fb();
  const user = await ensureSession();
  if (!f || !user) throw new Error('Firebase session unavailable — check your Firebase config and anonymous auth.');

  const ref = doc(f.db, COLLECTION, token);
  const owned = { ...base, ownerEmail: user.email ?? '' };
  await setDoc(ref, { ...owned, ownerUid: user.uid });
  return owned;
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  if (!firebaseConfigured) return readLocal();
  const f = fb();
  if (!f) return [];
  await ensureSession();
  const snap = await getDocs(query(collection(f.db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getQuestionnaire(token: string): Promise<Questionnaire | null> {
  if (!token) return null;
  if (!firebaseConfigured) return readLocal().find((q) => q.token === token) ?? null;
  const f = fb();
  if (!f) return null;
  await ensureSession();
  const snap = await getDoc(doc(f.db, COLLECTION, token));
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveAnswers(token: string, answers: Answers): Promise<void> {
  const payload = clean(answers);
  const now = Date.now();
  if (!firebaseConfigured) {
    const items = readLocal();
    const item = items.find((q) => q.token === token);
    if (!item) throw new Error('Questionnaire not found');
    item.answers = payload;
    item.updatedAt = now;
    writeLocal(items);
    return;
  }
  const f = fb();
  const user = await ensureSession();
  if (!f || !user) throw new Error('No Firebase session — answers not saved.');
  await updateDoc(doc(f.db, COLLECTION, token), { answers: payload, updatedAt: now });
}

export async function submitQuestionnaire(token: string, answers: Answers): Promise<void> {
  const payload = clean(answers);
  const now = Date.now();
  if (!firebaseConfigured) {
    const items = readLocal();
    const item = items.find((q) => q.token === token);
    if (!item) throw new Error('Questionnaire not found');
    item.answers = payload;
    item.submittedAt = now;
    item.updatedAt = now;
    writeLocal(items);
    return;
  }
  const f = fb();
  const user = await ensureSession();
  if (!f || !user) throw new Error('No Firebase session — submission not saved.');
  await updateDoc(doc(f.db, COLLECTION, token), {
    answers: payload,
    submittedAt: now,
    updatedAt: now,
  });
}

export async function reopenQuestionnaire(token: string): Promise<void> {
  const now = Date.now();
  if (!firebaseConfigured) {
    const items = readLocal();
    const item = items.find((q) => q.token === token);
    if (item) {
      item.submittedAt = null;
      item.updatedAt = now;
      writeLocal(items);
    }
    return;
  }
  const f = fb();
  const user = await ensureSession();
  if (!f || !user) throw new Error('No Firebase session.');
  await updateDoc(doc(f.db, COLLECTION, token), { submittedAt: null, updatedAt: now });
}

export async function deleteQuestionnaire(token: string): Promise<void> {
  if (!firebaseConfigured) {
    writeLocal(readLocal().filter((q) => q.token !== token));
    return;
  }
  const f = fb();
  const user = await ensureSession();
  if (!f || !user) throw new Error('No Firebase session.');
  await deleteDoc(doc(f.db, COLLECTION, token));
}

/** Live list for the owner dashboard. Returns an unsubscribe function. */
export function watchQuestionnaires(
  cb: (items: Questionnaire[]) => void,
  onError?: (message: string) => void,
): () => void {
  if (!firebaseConfigured) {
    const emit = () => cb(readLocal());
    emit();
    const interval = window.setInterval(emit, 1500);
    window.addEventListener('storage', emit);
    window.addEventListener(LOCAL_EVENT, emit);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', emit);
      window.removeEventListener(LOCAL_EVENT, emit);
    };
  }

  let unsub = () => {};
  let disposed = false;
  (async () => {
    const f = fb();
    if (!f) return;
    await ensureSession();
    if (disposed) return;
    const q = query(collection(f.db, COLLECTION), orderBy('createdAt', 'desc'));
    unsub = onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))),
      (err) => {
        console.warn('[regforge] snapshot failed', err);
        const code = (err as { code?: string })?.code ?? '';
        onError?.(
          code === 'permission-denied'
            ? 'Firestore refused the read — deploy firestore.rules (owner creates, clients fill in) and make sure Anonymous auth is enabled.'
            : `Live sync failed (${code || 'error'}). Check your Firebase config in .env.local.`,
        );
        cb([]);
      },
    );
  })();

  return () => {
    disposed = true;
    unsub();
  };
}

/** Adds a seed/local sample so the dashboard is never a dead end in local mode. */
export async function addDocCompat(): Promise<void> {
  const f = fb();
  if (!f) return;
  await addDoc(collection(f.db, COLLECTION), {});
}

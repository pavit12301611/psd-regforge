/**
 * RegForge — Firestore data layer.
 *
 * Workspace data lives at users/{uid}/questionnaires/{token}. A separate,
 * metadata-only shareTokens/{token} document lets a bearer of a direct link
 * resolve exactly one nested questionnaire without exposing a collection query.
 * The share index contains no answers or client brief.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Answers } from './library';
import {
  currentGoogleUser,
  ensureShareSession,
  fb,
  firebaseConfigured,
  requireGoogleUser,
} from './firebase';

export const USERS_COLLECTION = 'users';
export const QUESTIONNAIRES_COLLECTION = 'questionnaires';
export const SHARE_TOKENS_COLLECTION = 'shareTokens';

export type StorageMode = 'firebase' | 'unconfigured';

export interface Questionnaire {
  token: string;
  projectId: string;
  title: string;
  clientName: string;
  clientEmail: string;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  answers: Answers;
}

export function storageMode(): StorageMode {
  return firebaseConfigured ? 'firebase' : 'unconfigured';
}

/* ------------------------------------------------------------------ helpers */

/** 128 bits of randomness, URL-safe and substantially stronger than old tokens. */
export function newToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireFirebase() {
  const f = fb();
  if (!f) {
    throw new Error('Firebase is not configured. Add the Firebase web app settings first.');
  }
  return f;
}

function clean(answers: Answers): Answers {
  const out: Answers = {};
  for (const [key, value] of Object.entries(answers ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
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
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? data.createdAt ?? Date.now()),
    submittedAt: (data.submittedAt as number | null) ?? null,
    answers: (data.answers as Answers) ?? {},
  };
}

interface ResolvedQuestionnaire {
  ref: ReturnType<typeof doc>;
  ownerUid: string;
}

/**
 * Resolve a share token through its metadata-only index. The index lookup is a
 * single-document get; clients never query shareTokens or questionnaires.
 */
async function resolveSharedQuestionnaire(token: string): Promise<ResolvedQuestionnaire | null> {
  if (!token) return null;
  const f = requireFirebase();
  const user = await ensureShareSession();
  if (!user) return null;

  const index = await getDoc(doc(f.db, SHARE_TOKENS_COLLECTION, token));
  if (!index.exists()) return null;
  const data = index.data() as Record<string, unknown>;
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : '';
  if (!ownerUid || data.token !== token) return null;

  return {
    ref: doc(f.db, USERS_COLLECTION, ownerUid, QUESTIONNAIRES_COLLECTION, token),
    ownerUid,
  };
}

/* -------------------------------------------------------------------- public */

export interface NewQuestionnaireInput {
  title: string;
  clientName: string;
  clientEmail: string;
}

export async function createQuestionnaire(input: NewQuestionnaireInput): Promise<Questionnaire> {
  const f = requireFirebase();
  const user = await requireGoogleUser();
  const now = Date.now();
  const token = newToken();
  const clientName = input.clientName.trim();
  const base: Questionnaire = {
    token,
    projectId: token,
    title: input.title.trim() || `${clientName || 'Client'} — website requirements`,
    clientName,
    clientEmail: input.clientEmail.trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    answers: {},
  };

  const questionnaireRef = doc(
    f.db,
    USERS_COLLECTION,
    user.uid,
    QUESTIONNAIRES_COLLECTION,
    token,
  );
  const shareRef = doc(f.db, SHARE_TOKENS_COLLECTION, token);
  const batch = writeBatch(f.db);

  // Both writes are committed together. The rules require this index to point
  // at a real questionnaire owned by the same Google UID.
  batch.set(questionnaireRef, base);
  batch.set(shareRef, {
    token,
    ownerUid: user.uid,
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();
  return base;
}

/** List only the signed-in user's nested questionnaire collection. */
export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const f = requireFirebase();
  const user = await requireGoogleUser();
  const snap = await getDocs(
    query(
      collection(f.db, USERS_COLLECTION, user.uid, QUESTIONNAIRES_COLLECTION),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((item) => fromDoc(item.id, item.data() as Record<string, unknown>));
}

/** Load one questionnaire through the share-token index. */
export async function getQuestionnaire(token: string): Promise<Questionnaire | null> {
  const resolved = await resolveSharedQuestionnaire(token);
  if (!resolved) return null;
  const snap = await getDoc(resolved.ref);
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data() as Record<string, unknown>);
}

/** Used only for a convenience label in the UI; rules remain authoritative. */
export async function currentUserOwnsQuestionnaire(token: string): Promise<boolean> {
  if (!firebaseConfigured || !token) return false;
  const f = requireFirebase();
  const user = await currentGoogleUser();
  if (!user) return false;
  const snap = await getDoc(doc(f.db, USERS_COLLECTION, user.uid, QUESTIONNAIRES_COLLECTION, token));
  return snap.exists();
}

export async function saveAnswers(token: string, answers: Answers): Promise<void> {
  const resolved = await resolveSharedQuestionnaire(token);
  if (!resolved) throw new Error('Questionnaire not found or its share link has expired.');
  await updateDoc(resolved.ref, { answers: clean(answers), updatedAt: Date.now() });
}

export async function submitQuestionnaire(token: string, answers: Answers): Promise<void> {
  const resolved = await resolveSharedQuestionnaire(token);
  if (!resolved) throw new Error('Questionnaire not found or its share link has expired.');
  await updateDoc(resolved.ref, {
    answers: clean(answers),
    submittedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function reopenQuestionnaire(token: string): Promise<void> {
  const resolved = await resolveSharedQuestionnaire(token);
  if (!resolved) throw new Error('Questionnaire not found or its share link has expired.');
  await updateDoc(resolved.ref, { submittedAt: null, updatedAt: Date.now() });
}

/** Delete a questionnaire and its share index only from its owner's workspace. */
export async function deleteQuestionnaire(token: string): Promise<void> {
  const f = requireFirebase();
  const user = await requireGoogleUser();
  const questionnaireRef = doc(
    f.db,
    USERS_COLLECTION,
    user.uid,
    QUESTIONNAIRES_COLLECTION,
    token,
  );
  const shareRef = doc(f.db, SHARE_TOKENS_COLLECTION, token);
  const share = await getDoc(shareRef);
  const batch = writeBatch(f.db);
  batch.delete(questionnaireRef);
  if (share.exists()) batch.delete(shareRef);
  await batch.commit();
}

/** Live list for the signed-in user's workspace. */
export function watchQuestionnaires(
  cb: (items: Questionnaire[]) => void,
  onError?: (message: string) => void,
): () => void {
  let disposed = false;
  let unsubscribe = () => {};

  void (async () => {
    try {
      const f = requireFirebase();
      const user = await requireGoogleUser();
      if (disposed) return;
      const questionnaires = query(
        collection(f.db, USERS_COLLECTION, user.uid, QUESTIONNAIRES_COLLECTION),
        orderBy('createdAt', 'desc'),
      );
      unsubscribe = onSnapshot(
        questionnaires,
        (snap) => {
          if (!disposed) {
            cb(snap.docs.map((item) => fromDoc(item.id, item.data() as Record<string, unknown>)));
          }
        },
        (err) => {
          if (disposed) return;
          console.warn('[regforge] workspace snapshot failed', err);
          const code = (err as { code?: string })?.code ?? '';
          onError?.(
            code === 'permission-denied'
              ? 'Firestore denied this workspace read. Deploy the included firestore.rules and sign in with Google.'
              : `Live sync failed (${code || 'error'}). Check the Firebase project and its Firestore setup.`,
          );
          cb([]);
        },
      );
    } catch (err) {
      if (!disposed) {
        onError?.(err instanceof Error ? err.message : 'Could not open the workspace.');
        cb([]);
      }
    }
  })();

  return () => {
    disposed = true;
    unsubscribe();
  };
}

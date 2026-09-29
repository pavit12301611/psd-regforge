/**
 * RegForge — Firebase bootstrap and authentication (client SDK).
 * Admin access is granted by the Firestore admins/{uid} allowlist, never by email.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseEnvConfig, isFirebaseEnvConfigured } from './env';

const config = {
  apiKey: firebaseEnvConfig.apiKey ?? '',
  authDomain: firebaseEnvConfig.authDomain ?? '',
  projectId: firebaseEnvConfig.projectId ?? '',
  storageBucket: firebaseEnvConfig.storageBucket ?? '',
  messagingSenderId: firebaseEnvConfig.messagingSenderId ?? '',
  appId: firebaseEnvConfig.appId ?? '',
  ...(firebaseEnvConfig.measurementId ? { measurementId: firebaseEnvConfig.measurementId } : {}),
};

export const firebaseConfig = config;
export const firebaseConfigured = isFirebaseEnvConfigured;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function boot() {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app: app as FirebaseApp, auth: auth as Auth, db: db as Firestore };
}

export function fb() {
  return boot();
}

export function authErrorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? '';
}

export function readableAuthError(err: unknown): string {
  const code = authErrorCode(err);
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
      return 'Email or password is incorrect, or this Firebase account does not exist.';
    case 'auth/email-already-in-use':
      return 'A Firebase account already exists for this email. Sign in with its existing password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network blocked the Firebase request. Check your connection, then retry.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return err instanceof Error ? err.message : 'Firebase authentication failed.';
  }
}

async function adminRecordExists(uid: string): Promise<boolean> {
  const f = fb();
  if (!f) return false;
  const snap = await getDoc(doc(f.db, 'admins', uid));
  return snap.exists() && snap.data().enabled === true;
}

/** Sign in only; accounts are created separately in Firebase Console. */
export async function adminSignIn(email: string, password: string): Promise<User> {
  const f = fb();
  if (!f) throw new Error('Firebase must be configured before an admin can sign in.');

  const credential = await signInWithEmailAndPassword(f.auth, email.trim(), password);
  try {
    if (!(await adminRecordExists(credential.user.uid))) {
      await signOut(f.auth);
      throw new Error('This account is not enabled as an admin. Ask the project administrator to add its UID under Firestore admins.');
    }
  } catch (err) {
    // A denied/missing admin marker must never leave a non-admin signed in on the app.
    if (f.auth.currentUser?.uid === credential.user.uid) await signOut(f.auth);
    throw err;
  }
  return credential.user;
}

/** Check the persisted Firebase account and its server-managed admin marker. */
export async function currentAdminUser(): Promise<User | null> {
  const f = fb();
  if (!f) return null;

  const user = await ensureSession();
  if (!user || user.isAnonymous) return null;
  if (await adminRecordExists(user.uid)) return user;
  if (f.auth.currentUser?.uid === user.uid) await signOut(f.auth);
  return null;
}

/** Guests (clients) read/write through a shared link with an anonymous session. */
export async function ensureClientSession(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  if (f.auth.currentUser) return f.auth.currentUser;
  try {
    const cred = await signInAnonymously(f.auth);
    return cred.user;
  } catch {
    return null;
  }
}

/** Wait until Firebase restores persisted auth, then use/create a guest session. */
export async function ensureSession(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  if (f.auth.currentUser) return f.auth.currentUser;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      stop();
      resolve();
    };
    const stop = onAuthStateChanged(f.auth, finish);
    setTimeout(finish, 1200);
  });
  if (f.auth.currentUser) return f.auth.currentUser;
  return ensureClientSession();
}

export async function fbSignOut(): Promise<void> {
  const f = fb();
  if (!f) return;
  try {
    await signOut(f.auth);
  } catch {
    /* ignore */
  }
}

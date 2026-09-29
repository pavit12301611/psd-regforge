/**
 * RegForge — Firebase bootstrap and authentication.
 *
 * Google-authenticated users get a private workspace. Anonymous Firebase
 * sessions are created only when a person opens a shared questionnaire link;
 * they are never used for dashboard access.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore';
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
let authReady: Promise<void> | null = null;

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
    case 'auth/popup-blocked':
      return 'The Google sign-in window was blocked. Allow pop-ups for this site and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before sign-in finished.';
    case 'auth/unauthorized-domain':
      return 'This website is not listed as an authorized domain in Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is disabled. Enable the Google provider in Firebase Console → Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network blocked the Firebase request. Check your connection, then retry.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured for this project yet.';
    default:
      return err instanceof Error ? err.message : 'Google authentication failed.';
  }
}

/** Wait for Firebase to restore its persisted session without creating one. */
async function restoredUser(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  if (f.auth.currentUser) return f.auth.currentUser;

  if (!authReady) {
    authReady = new Promise<void>((resolve) => {
      let settled = false;
      let stop = () => {};
      const finish = () => {
        if (settled) return;
        settled = true;
        stop();
        resolve();
      };
      stop = onAuthStateChanged(f.auth, finish);
      window.setTimeout(finish, 1500);
    });
  }
  await authReady;
  return f.auth.currentUser;
}

/** The persisted Google account, if one exists. */
export async function currentGoogleUser(): Promise<User | null> {
  const user = await restoredUser();
  if (!user || user.isAnonymous || user.providerData.every((provider) => provider.providerId !== 'google.com')) {
    return null;
  }
  await ensureWorkspace(user);
  return user;
}

/**
 * Create or refresh the signed-in user's workspace marker. This is ordinary
 * user-owned data, not an authorization document or an allowlist.
 */
export async function ensureWorkspace(user: User): Promise<void> {
  const f = fb();
  if (!f || user.isAnonymous) return;
  const now = Date.now();
  const profileRef = doc(f.db, 'users', user.uid);
  const existing = await getDoc(profileRef);
  const existingCreatedAt = existing.exists() ? Number(existing.data().createdAt) : 0;
  await setDoc(
    profileRef,
    {
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      updatedAt: now,
      createdAt: Number.isFinite(existingCreatedAt) && existingCreatedAt > 0 ? existingCreatedAt : now,
    },
    { merge: true },
  );
}

/** Start a Google session and initialize its workspace automatically. */
export async function googleSignIn(): Promise<User> {
  const f = fb();
  if (!f) throw new Error('Firebase is not configured. Add the Firebase web app settings first.');

  // Do not let a previous shared-link anonymous session become the dashboard
  // identity. Google sign-in is a distinct account/session.
  if (f.auth.currentUser?.isAnonymous) await signOut(f.auth);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(f.auth, provider);
  await ensureWorkspace(credential.user);
  return credential.user;
}

/**
 * Shared links use a Firebase anonymous session only after the link is opened.
 * The current Google session, when present, is retained and also gets scoped
 * to the exact token by Firestore rules.
 */
export async function ensureShareSession(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  const existing = await restoredUser();
  if (existing) return existing;
  try {
    const credential = await signInAnonymously(f.auth);
    return credential.user;
  } catch {
    return null;
  }
}

export async function requireGoogleUser(): Promise<User> {
  const user = await currentGoogleUser();
  if (!user) throw new Error('Sign in with Google to use your private workspace.');
  return user;
}

export async function fbSignOut(): Promise<void> {
  const f = fb();
  if (!f) return;
  try {
    await signOut(f.auth);
  } catch {
    /* Sign-out is idempotent from the app user’s perspective. */
  }
}

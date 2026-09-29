# Vercel + Firebase setup

This guide deploys the multi-user RegForge app. There is one Google sign-in flow for workspace users;
there is no email/password form, PIN, privileged UID list, or manual Firestore access document.

## 1. Import the Next.js project

1. Vercel Dashboard → **Add New → Project** → import `psd-regforge`.
2. Keep the detected framework as **Next.js**.
3. Build command: `npm run build`.

## 2. Add the Firebase web config

In **Vercel → Project → Settings → Environment Variables**, add the values for Production, Preview, and
Development as needed.

The simplest option is one variable:

| Key | Value |
| --- | --- |
| `FIREBASE_CONFIG` | The Firebase Console Web app config snippet, JSON, or `.env`-style values |

Example snippet from **Firebase Console → Project settings → Your apps → Web app → Config**:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc"
};
```

Alternatively add these individual variables:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID   # optional
```

The config is resolved during the Next.js build. Save the variables and redeploy after changing them.
The Firebase web config is safe to bundle in a browser; never put a service-account JSON/private key in
these variables.

## 3. Enable Firebase providers

In Firebase Console:

1. **Authentication → Sign-in method → Google → Enable**.
2. **Authentication → Sign-in method → Anonymous → Enable**. This is only for clients opening a shared
   questionnaire link.
3. **Authentication → Settings → Authorized domains**: add the Vercel production domain and any preview
   or custom domain that will host/open the app. Keep `localhost` for local development.
4. **Firestore Database**: create the database in production mode.
5. From the repository root, set the project in `.firebaserc` and publish the rules:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use YOUR_FIREBASE_PROJECT_ID
   firebase deploy --only firestore:rules
   ```

A user’s first successful Google sign-in initializes `users/{uid}` automatically. Do not create a user
profile, access marker, or workspace document manually.

## 4. Verify the deployment

1. Open the Vercel URL. The page should show `Firebase live`.
2. Choose **Continue with Google**. The app should open `/dashboard` and show an empty private workspace.
3. Create a questionnaire at `/new`, copy its `/q/<token>` link, and open it in a private window.
4. Type an answer and refresh; autosave should retain it. Submit and check the workspace dashboard.
5. Sign in with a second Google account and confirm it sees an empty workspace, not the first account’s
   questionnaire.
6. In the private window, try a different token path manually. It should not return another questionnaire.

## 5. Data model and security

```text
users/{google-auth-uid}/questionnaires/{share-token}
shareTokens/{share-token}    # token → owner UID only; exact gets, never listable
```

Firestore rules, not React route guards, enforce the boundary:

- Google users can list and manage only their own nested questionnaire collection.
- A shared-link session can read exactly the questionnaire selected by the matching token index.
- A shared-link session can update only `answers`, `updatedAt`, and `submittedAt`.
- Clients cannot list users, questionnaires, or share indexes, and cannot create/delete data.
- All other collections/paths are denied by default.

## 6. Migrate existing records before retiring the old layout

The previous release used `questionnaires/{token}`. The new rules do not expose that collection. Existing
documents are not deleted, but they must be copied into the UID-scoped layout to become available in the
new dashboard and keep their direct links working.

Back up Firestore, then run the reviewable migration from a trusted machine:

```bash
npm install --no-save firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
export FIREBASE_PROJECT_ID=your-project-id
npm run migrate:legacy -- --dry-run --owner-map=owners.json
npm run migrate:legacy -- --owner-map=owners.json
```

`owners.json` maps an old `ownerUid` or `ownerEmail` to the destination Google Auth UID:

```json
{
  "old-firebase-uid": "new-google-user-uid",
  "old-owner@example.com": "new-google-user-uid"
}
```

The script creates the nested questionnaire and its `shareTokens` index, preserves answers/timestamps/
submission state, reports ambiguous records, and never deletes the old documents. Inspect and back up the
legacy collection before any separately approved cleanup. Full migration notes are in `README.md`.

## Troubleshooting

- **Firebase setup needed**: Vercel variables were not available at build time. Check the names, save, and
  redeploy.
- **Unauthorized domain**: add the exact browser hostname in Firebase Authentication → Authorized domains.
- **Google provider disabled**: enable Google in Authentication → Sign-in method.
- **Client link cannot load/save**: enable Anonymous Authentication, deploy `firestore.rules`, and ensure
  the token was copied exactly.
- **Workspace read denied**: confirm the browser is signed in with Google and the included rules are
  deployed to the same Firebase project as the web config.

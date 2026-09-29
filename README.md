# RegForge

RegForge is a multi-user requirement-questionnaire app for consultants, studios, and their clients.
Each person signs in with Google and receives a private Firebase workspace. A workspace user creates a
questionnaire, sends its direct link, and watches the client’s autosaved answers. A shared link is scoped
to one questionnaire; it is not a way to browse a workspace.

- **12 modules · 50 questions** with stable IDs (`module.question`)
- **Google Authentication** for workspace users, with sign-in and sign-out
- **Firestore ownership** enforced by Firebase Auth UID and Security Rules
- **Direct client links** with anonymous Firebase sessions, autosave, and submit/reopen support
- **No privileged account, email allowlist, PIN, app password, or manually created access document**

## Routes and flow

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Anyone | Continue with Google, or paste/open a shared questionnaire link |
| `/dashboard` | Signed-in Google user | That user’s private questionnaire workspace |
| `/new` | Signed-in Google user | Create a questionnaire and copy its direct link |
| `/q/<token>` | Exact share token | Read and update that one questionnaire’s answers/submission fields |
| `/owner` | Redirect only | Legacy bookmark redirect to `/dashboard`; it is not a separate access area |

Typical flow: **Google sign-in → `/dashboard` → `/new` → copy `/q/<token>` → client answers →
answers autosave → workspace dashboard updates live.**

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill .env.local with the Firebase web-app configuration.
npm run dev       # http://localhost:3000
```

Checks:

```bash
npm run check:library
npm run build
```

Firebase configuration is required for workspace creation and shared-link storage. If it is missing, the
app shows a setup message rather than silently storing multi-user data in browser storage.

## Firebase setup

### 1. Create the Firebase project and web app

1. Create or select a Firebase project.
2. In **Project settings → Your apps**, add a Web app and copy its config.
3. In **Authentication → Sign-in method**, enable:
   - **Google** — this is the only workspace sign-in shown by RegForge.
   - **Anonymous** — used only when a client opens a direct questionnaire link.
4. In **Authentication → Settings → Authorized domains**, add the production Vercel domain and any
   preview/custom domains that will open the app. `localhost` is normally already present for local dev.
5. Create Firestore in production mode.

There is no Firebase Console user bootstrap step and no Firestore access document to create. The first
successful Google sign-in writes `users/{uid}` automatically through the app’s normal authenticated
request.

### 2. Configure the web app

Copy `.env.example` to `.env.local` and provide either one `FIREBASE_CONFIG` value or the individual
variables. The web config is intended for the browser; do not put a service-account private key in any
`NEXT_PUBLIC_*` or `FIREBASE_CONFIG` variable.

Individual variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=... # optional
```

`FIREBASE_CONFIG` may contain the Firebase JavaScript config snippet, JSON, or a `.env`-style block. The
build-time resolver in `lib/resolve-env.mjs` accepts the same formats used by the original deployment.

### 3. Deploy Firestore rules

Set the real project ID in `.firebaserc`, then deploy the checked-in rules:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules
```

Read the rules before deploying. They intentionally deny every unlisted collection and deny all list
operations for share tokens and shared-link viewers.

## Data model and security boundary

```text
users/{uid}
  uid, displayName, email, photoURL, createdAt, updatedAt

users/{uid}/questionnaires/{token}
  token, projectId, title, clientName, clientEmail
  createdAt, updatedAt, submittedAt
  answers: { "basics.name": "…", "pages.sections": ["Hero / intro"], "basics.satisfaction": 4 }

shareTokens/{token}
  token, ownerUid, createdAt, updatedAt
```

`shareTokens/{token}` is a metadata-only lookup index. It contains no answers or brief fields, cannot be
listed, and is readable only as an exact document get by an authenticated Google or anonymous session.
The token is a bearer capability, so send it only to the intended client and treat a leaked link as
access to that one questionnaire.

Firestore rules enforce the following, independently of UI checks:

- A Google user can read/list/create/update/delete only `users/{their-auth-uid}/questionnaires/*`.
- A Google user can initialize and update only `users/{their-auth-uid}`.
- A shared-link viewer can resolve one exact `shareTokens/{token}` document and then read that matching
  nested questionnaire only.
- A shared-link viewer can update only `answers`, `updatedAt`, and `submittedAt`; they cannot change the
  title, client details, token, UID, or any other user’s document.
- Shared-link viewers cannot list `shareTokens`, users, or questionnaires, and cannot create/delete
  questionnaires.
- The app creates a questionnaire and its share index in one batch; rules require the index and nested
  document to agree on the same owner UID and token.
- The legacy top-level `questionnaires/{token}` collection is denied by the default rule after migration.

Anonymous Auth is not a workspace role. It exists only to make a direct client link work without asking a
client to create an account. A browser that already has a Google session keeps that session while using a
shared link, but still receives only the token-scoped permissions above.

## Vercel deployment

1. Import the repository as a Next.js project.
2. In **Vercel → Settings → Environment Variables**, add either:
   - one `FIREBASE_CONFIG` variable containing the web config, or
   - the individual `NEXT_PUBLIC_FIREBASE_*` variables.
3. Add the values to Production, Preview, and Development as appropriate.
4. Add the Vercel production/preview domains to Firebase Authentication’s Authorized domains.
5. Redeploy after changing environment variables; Firebase config is resolved at build time.
6. Confirm the site shows `Firebase live`, sign in with Google, create a questionnaire, and test a direct
   link in a separate browser/private window.

The same steps, including the Firebase Console checklist, are in `VERCEL_SETUP.md`.

## Existing questionnaire migration

The previous version stored Firebase records at `questionnaires/{token}` and may have used an old account UID.
The new app does **not** silently delete those records. The new rules leave that legacy collection denied
until records are copied into the UID-scoped layout. The old no-Firebase browser fallback may also leave
`regforge.db.v1` in a browser’s local storage; it is not deleted, but it has no trustworthy Firebase UID,
so the new app deliberately does not auto-attach it to whichever Google account uses that browser. Export
or review that browser-local data explicitly before retiring the old build.

Migration is an explicit, reviewable Admin SDK operation:

1. Back up/export the Firestore database before changing anything.
2. Make sure each destination UID exists in Firebase Authentication and represents the user’s Google
   identity. If an old email/password UID will not be the Google UID, create a mapping file, for example:

   ```json
   {
     "old-firebase-uid": "new-google-user-uid",
     "old-owner@example.com": "new-google-user-uid"
   }
   ```

   The keys can be a legacy `ownerUid` or `ownerEmail`; values must be the destination Firebase Auth UIDs.
3. Install the migration tool outside the browser bundle and provide a service-account credential:

   ```bash
   npm install --no-save firebase-admin
   export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
   export FIREBASE_PROJECT_ID=your-project-id
   npm run migrate:legacy -- --dry-run --owner-map=owners.json
   npm run migrate:legacy -- --owner-map=owners.json
   ```

   If the legacy `ownerUid` already is the correct Firebase Auth UID, the map can be omitted. Documents
   without a usable UID, missing Auth user, unsafe token, or conflicting destination are reported and
   skipped rather than guessed.
4. Check the copied workspace and each old direct link. The script creates both
   `users/{uid}/questionnaires/{token}` and `shareTokens/{token}` and preserves answers, timestamps,
   submission state, and legacy metadata needed for review.
5. Only after verification, keep the legacy collection as a rollback copy or remove it manually through
   a separately approved backup/retention process. The script itself never deletes legacy documents.
6. Deploy `firestore.rules` and test ownership with two different Google accounts plus a shared-link
   private window.

The migration script is `scripts/migrate-legacy-questionnaires.mjs`; `--dry-run` is recommended first.
It uses Admin SDK credentials only on the operator’s machine/server and never exposes them to Next.js.

## Question library

`lib/library.ts` holds all 12 modules and 50 questions. Stable IDs mean existing answers survive wording
edits. Run `npm run check:library` after changing the bank.

| # | Module | Questions | # | Module | Questions |
| --- | --- | --- | --- | --- | --- |
| 1 | basics — About the project | 6 | 7 | budget — Budget & pricing | 3 |
| 2 | pages — Pages & structure | 4 | 8 | timeline — Timeline | 3 |
| 3 | features — Features & functionality | 4 | 9 | hosting — Domain & hosting | 4 |
| 4 | design — Design & branding | 7 | 10 | goals — Goals & success | 4 |
| 5 | content — Content | 4 | 11 | marketing — Marketing & SEO | 4 |
| 6 | ecommerce — E-commerce | 5 | 12 | extra — Anything else | 2 |

Required by default: `basics.name`, `basics.one_liner`, `pages.pages`, `features.features`,
`budget.budget`, and `goals.must_haves`.

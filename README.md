# RegForge

RegForge is a multi-user requirement-questionnaire app for consultants, studios, and their clients.
Each person signs in with Google and receives a private Firebase workspace. A workspace user creates a
questionnaire, sends its direct link, and watches the client’s autosaved answers. A shared link is scoped
to one questionnaire; it is not a way to browse a workspace.

- **12 modules · 50 questions** with stable IDs (`module.question`)
- **Google Authentication** for workspace users, with sign-in and sign-out
- **Firestore ownership** enforced by Firebase Auth UID and Security Rules
- **Direct client links** with anonymous Firebase sessions, autosave, and submit/reopen support
- **INR budget input** — free-form Indian Rupee amount with `₹` and Indian digit grouping
- **Creator answer view** at `/dashboard/questionnaires/<token>` for submitted and in-progress briefs
- **AI-ready export** — download a `.txt` brief (and optional `.json`) or copy it to the clipboard
- **No privileged account, email allowlist, PIN, app password, or manually created access document**

## Routes and flow

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Anyone | Continue with Google, or paste/open a shared questionnaire link |
| `/dashboard` | Signed-in Google user | That user’s private questionnaire workspace |
| `/dashboard/questionnaires/<token>` | Creator only (same Google UID) | Read every answer, copy/download the AI-ready brief |
| `/new` | Signed-in Google user | Create a questionnaire and copy its direct link |
| `/q/<token>` | Exact share token | Read and update that one questionnaire’s answers/submission fields |
| `/owner` | Redirect only | Legacy bookmark redirect to `/dashboard`; it is not a separate access area |

Typical flow: **Google sign-in → `/dashboard` → `/new` → copy `/q/<token>` → client answers →
answers autosave → workspace dashboard updates live → “View answers” opens the full brief → copy or
download the AI-ready `.txt`.**

The creator answer page reads `users/{currentAuthUid}/questionnaires/{token}` directly. It never resolves
the token through the public share index, so an anonymous shared-link client cannot open it, and a Google
user can only ever open documents inside their own UID path.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill .env.local with the Firebase web-app configuration.
npm run dev       # http://localhost:3000
```

Checks:

```bash
npm run check:library   # 12 modules / 50 questions / stable ids / INR budget question
npm run check:rules     # audited Firestore rule invariants (owner scope, share scope)
npx tsc --noEmit        # type check
npm run build           # production build
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
operations for share tokens and shared-link viewers. `npm run check:rules` audits the checked-in file for
those invariants (owner-only UID scope, token-scoped share access, the
`answers`/`updatedAt`/`submittedAt`-only client update, and the absence of any privileged shortcut), which
is useful in environments where the Firestore emulator cannot be downloaded.

## Data model and security boundary

```text
users/{uid}
  uid, displayName, email, photoURL, createdAt, updatedAt

users/{uid}/questionnaires/{token}
  token, projectId, title, clientName, clientEmail
  createdAt, updatedAt, submittedAt
  answers: {
    "basics.name": "…",
    "pages.sections": ["Hero / intro"],
    "basics.satisfaction": 4,
    "budget.budget": "125000"        // INR, canonical string (₹1,25,000)
  }

shareTokens/{token}
  token, ownerUid, createdAt, updatedAt
```

`shareTokens/{token}` is a metadata-only lookup index. It contains no answers or brief fields, cannot be
listed, and is readable only as an exact document get by an authenticated Google or anonymous session.
The token is a bearer capability, so send it only to the intended client and treat a leaked link as
access to that one questionnaire.

Budget amounts are stored as **canonical strings** (digits with an optional decimal point, no grouping
characters). Strings are used deliberately: a large amount such as ₹9,99,99,99,99,999 exceeds the exact
range of a JavaScript number, and Firestore keeps the string byte-for-byte. Amounts are never parsed with
`parseInt`/`Number()` for storage or display.

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

The creator answer view and the TXT/JSON export required **no rule change**: they read the owner path,
which is already restricted to `isWorkspaceUser(uid)` (Google provider + matching UID). An anonymous
shared-link session can still only reach the single questionnaire named by its token index, and only for
the `answers`, `updatedAt`, and `submittedAt` fields.

Anonymous Auth is not a workspace role. It exists only to make a direct client link work without asking a
client to create an account. A browser that already has a Google session keeps that session while using a
shared link, but still receives only the token-scoped permissions above.

## Budget question (INR)

`budget.budget` keeps its **stable question ID** but is now a free-form currency question
(`type: 'currency'`, `currency: 'INR'`) instead of the old fixed dollar range list:

- Label: *What is your budget for this project?*
- Placeholder: *e.g. ₹50,000*
- Help: *Enter any amount in Indian Rupees (INR). You can include commas — e.g. ₹1,25,000 or ₹10,00,000.*

Behaviour:

- The `₹` symbol is a fixed prefix; digits are grouped live in the Indian system (`₹10,000`,
  `₹1,25,000`, `₹10,00,000`) while the caret keeps its position during typing and editing.
- `inputMode="decimal"` opens the numeric keypad on mobile; commas, spaces, `Rs` / `INR` text and a pasted
  `₹` prefix are all accepted and normalised.
- No maximum, no minimum and no fixed range. Values are stored as cleaned canonical strings
  (`"125000"`, `"125000.50"`), so very large amounts cannot overflow a JavaScript number.
- Empty input clears the answer (and autosaves the removal); an invalid required answer shows an
  accessible error (`aria-invalid`, `role="alert"`, described-by help text).
- Answers saved by the old radio question (for example `$1,000 – $3,000` or `Not sure yet — advise me`) are
  still counted as answered, are displayed **exactly as stored**, and are flagged as an earlier answer in
  the client form and in the answer view. They are only replaced when the client deliberately types a new
  amount, and they can be removed with an explicit “Clear” action.

Everything that shows a budget — client form, dashboard card chip, answer detail, TXT/JSON export — uses
the same formatter in `lib/money.ts`, so INR formatting is consistent everywhere.

## Creator answer view and AI-ready export

`/dashboard/questionnaires/<token>` is the creator-only detail page for one questionnaire:

- Works for **submitted and in-progress** briefs; answers stream live (`onSnapshot`) from
  `users/{auth.uid}/questionnaires/{token}`.
- Header shows title, client name/email, status badge, completion percentage, and created / last updated /
  submitted timestamps plus the budget answer in INR.
- Every module and question is rendered in library order with the human-readable label, the stable
  question ID, and the formatted answer. Checkbox answers render as a list, unanswered questions render as
  “Not answered”, and legacy values are flagged.
- Sticky top bar (back to dashboard, download, copy) plus a sticky, scroll-spy module navigator on desktop
  and horizontally scrollable module tabs on mobile.
- Loading, not-found/empty, permission-denied, and error states each get their own screen with a retry or a
  back-to-dashboard link; toast messages confirm copy/download actions and report failures.

Exports are built entirely in the browser from the document the creator already loaded:

- **Download .txt** — a Blob-based plain-text brief: header block (project, client, status, completion,
  timestamps), then one `## Module` section per module with `Question ID:` / `Question:` / `Answer:` blocks
  for **every** question, including unanswered ones. Arrays are listed line by line. The filename is
  derived from the project title (`The Daily Bloom` → `the-daily-bloom-questionnaire.txt`).
- **Copy AI brief** — the same text to the clipboard, with a hidden-textarea fallback when the Clipboard API
  is unavailable, and a clear error toast (with a download alternative) when both fail.
- **Download .json** — optional structured export of the same data.

No server API, Cloud Function, or service credential is involved, and the exports deliberately exclude the
share token so a brief can be pasted into an AI tool without handing over the client link.

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

## Existing data compatibility

Nothing in this release deletes or rewrites stored answers:

- `budget.budget` keeps its stable ID, so old radio answers stay attached to the same field and render
  safely (see the INR section above). No conversion script or manual migration is required.
- `answers`, timestamps, submission state, and legacy `ownerUid` / `ownerEmail` fields keep their existing
  shape; the new budget values are simply strings in the same `answers` map.
- Question wording changes never orphan an answer: values that no longer match the current option list are
  shown as “saved earlier” instead of being silently dropped.
- The dashboard, the creator answer view, and the exports all tolerate missing optional fields
  (`clientName`, `clientEmail`, `submittedAt`, `answers`) and unknown/extra keys in stored documents.

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

The script is unchanged by this release and is only needed for data that still lives in the pre-multi-user
`questionnaires/{token}` collection. It copies answers verbatim — including old budget range strings — so a
migrated questionnaire behaves exactly like one that was already in the UID-scoped layout.

## Question library

`lib/library.ts` holds all 12 modules and 50 questions. Stable IDs mean existing answers survive wording
edits, which is why the budget field kept `budget.budget` when it changed type. Supported question types are
`text`, `textarea`, `radio`, `checkbox`, `rating`, and `currency` (INR). Run `npm run check:library` after
changing the bank — it verifies the module/question counts, unique stable IDs, and that `budget.budget` is
still a required free-form INR currency question with no fixed dollar ranges.

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

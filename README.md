# RegForge

Private requirement-questionnaire builder for **you and your clients only**.
You create a questionnaire, send the client one link, and their answers build the brief
that turns their idea into a real project. Answers autosave as they type.

- **12 modules · 50 questions** (stable ids `module.question`, `*` = required)
- **Admin access:** Firebase email/password sign-in plus a Firestore UID allowlist
- Only accounts explicitly enabled in `admins/{uid}` can open the dashboard
- Backend: **Firebase Authentication + Firestore** (client links use anonymous auth)

---

## 1. Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Useful checks:

```bash
npm run check:library   # verifies 12 modules / 50 questions / unique ids
npm run build           # production build
```

## 2. How it works

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Admin sign-in or client link entry |
| `/owner` | allowlisted Firebase admin | dashboard: questionnaires, live progress %, copy client link, delete |
| `/new` | allowlisted Firebase admin | create a questionnaire → shareable link |
| `/q/<token>` | client | the questionnaire itself: 12 modules, autosave, submit |

Flow: **`/new` → copy `/q/<token>` → send to client → client answers → you watch progress live in `/owner`.**

Admin access is not tied to a particular email. Create the Firebase Authentication account,
then add its Firebase UID as an enabled admin in Firestore (`admins/{uid}`). Email/password
sign-in alone does not grant dashboard access; accounts without that marker are rejected.

## 3. Firebase setup (Auth + Firestore) — Vercel Ready ✅

The app auto-detects Firebase: add the keys and it switches from local mode to Firebase.
**Code is Vercel-ready — env var names are centralized in `lib/env.ts`. Just put values in Vercel.**

### Local dev:
```bash
cp .env.example .env.local
# fill values in .env.local
```

### Vercel deploy — simplest: ONE variable
Add **one** variable: Key `FIREBASE_CONFIG`, Value = the Firebase web-app config snippet pasted as-is
(`apiKey: "...", authDomain: "...", projectId: "...", ...`). Redeploy. That's it — see `VERCEL_SETUP.md`.
You can also paste a whole `.env` block into Vercel's Key field, or use the individual names below
(with or without `NEXT_PUBLIC_`).

### Vercel deploy — individual variables (optional):
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these exact names (from `.env.example`) — **names already defined, only values needed**:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
   ```
   - Add to all 3: Production, Preview, Development
3. Redeploy

Full Hindi guide: see `VERCEL_SETUP.md`

### Firebase project setup:
1. Create a project → **Add app → Web**, copy the config.
2. Locally `cp .env.example .env.local` and fill in:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=... (optional)
   ```

3. **Authentication → Sign-in method**: enable **Email/Password** and **Anonymous**.
   - Clients get anonymous sessions to open and save their shared questionnaire.
   - Admin accounts are not created by the website. Create the account in Firebase Console → Authentication → Users.
4. **Bootstrap an admin:** copy that user's Firebase **UID** from Authentication → Users, then in Firestore create document `admins/{UID}` with field `enabled` (boolean) set to `true`. Only an administrator with console/Admin SDK access can change this allowlist.
5. **Firestore Database → Rules**, then deploy/publish the included rules:

   ```bash
   npm i -g firebase-tools
   firebase login
   # put your project id in .firebaserc, then:
   firebase deploy --only firestore:rules
   ```

   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is printed in the Firebase console app config.

Data model — one document per questionnaire, doc id = share token:

```
questionnaires/{token}
  title, clientName, clientEmail, ownerEmail
  createdAt, updatedAt, submittedAt   // submittedAt null until the client submits
  answers: { "basics.name": "…", "pages.sections": ["Hero / intro", …], "basics.satisfaction": 4 }
```

### Security rules (`firestore.rules`)

| | read | write |
| --- | --- | --- |
| Admin UIDs in `admins/{uid}` with `enabled: true` | ✅ all questionnaires | ✅ create / update / delete |
| Clients (anonymous session + share token) | ✅ questionnaire document | ✅ update answers/submission fields only |
| Other signed-in accounts | ❌ | ❌ |

Admin marker documents are read-only to their own signed-in user and cannot be edited by app clients. Everything else is denied.

## 4. No Firebase yet? Local mode

With no Firebase keys, questionnaire data can use that browser's `localStorage`, but secure
admin sign-in/dashboard access is disabled. Configure Firebase before creating or sharing live questionnaires.

## 5. Question bank

`lib/library.ts` holds all 12 modules and 50 questions with the exact ids, labels, option
lists, placeholders and help text. Edit that one file to change wording — ids are stable,
so existing answers survive edits.

| # | Module | Questions | # | Module | Questions |
| --- | --- | --- | --- | --- | --- |
| 1 | basics — About the project | 6 | 7 | budget — Budget & pricing | 3 |
| 2 | pages — Pages & structure | 4 | 8 | timeline — Timeline | 3 |
| 3 | features — Features & functionality | 4 | 9 | hosting — Domain & hosting | 4 |
| 4 | design — Design & branding | 7 | 10 | goals — Goals & success | 4 |
| 5 | content — Content | 4 | 11 | marketing — Marketing & SEO | 4 |
| 6 | ecommerce — E-commerce | 5 | 12 | extra — Anything else | 2 |

Required by default (`*`): `basics.name`, `basics.one_liner`, `pages.pages`,
`features.features`, `budget.budget`, `goals.must_haves`.

## 6. Vercel Env Architecture

- `next.config.mjs` + `lib/resolve-env.mjs` resolve all accepted env styles at build time (inlined into the client bundle as `NEXT_PUBLIC_REGFORGE_ENV`)
- Centralized env reader: `lib/env.ts` — trims values, provides defaults, exports `VERCEL_ENV_NAMES`
- `lib/firebase.ts` reads from `lib/env.ts`, not directly from `process.env` (cleaner for Vercel)
- `.env.example` contains exact Vercel variable names — copy-paste to Vercel dashboard, just fill values
- `vercel.json` minimal config for Next.js
- If no Firebase envs, app runs in local mode (badge shows Local mode)

## 7. Notes

- `firestore.rules` grants dashboard access only to enabled UIDs in the `admins` collection. Clients use anonymous auth and a questionnaire share token.
- Add or revoke admins by creating/removing `admins/{uid}` or setting `enabled: false` in the Firebase Console (or trusted Admin SDK); app clients cannot change this list.
- See `VERCEL_SETUP.md` for Hindi step-by-step Vercel deploy guide.

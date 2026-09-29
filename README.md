# RegForge

Private requirement-questionnaire builder for **you and your clients only**.
You create a questionnaire, send the client one link, and their answers build the brief
that turns their idea into a real project. Answers autosave as they type.

- **12 modules · 50 questions** (stable ids `module.question`, `*` = required)
- **Access PIN `5161211`** to open the owner dashboard
- **Owner email `pavitsingh1611@gmail.com`** gets in **without the PIN**
- Both are **hard-coded in `lib/access.ts`** — never stored in a database
- Backend: **Firebase Authentication + Firestore** (falls back to browser storage with zero setup)

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
| `/` | anyone | PIN gate. Owner email skips the PIN. Clients can paste a link here. |
| `/owner` | PIN verified | dashboard: every questionnaire, live progress %, copy client link, delete |
| `/new` | PIN verified | create a questionnaire (project title, client name, client email) → shareable link |
| `/q/<token>` | client | the questionnaire itself: 12 modules, autosave, submit |

Flow: **`/new` → copy `/q/<token>` → send to client → client answers → you watch progress live in `/owner`.**

Access model (hard-coded in `lib/access.ts`):

```ts
export const OWNER_EMAIL = 'pavitsingh1611@gmail.com'; // no PIN needed
export const ACCESS_PIN  = '5161211';                  // opens the dashboard
```

Anyone with the PIN **or** the owner email gets dashboard rights; everyone else needs a
questionnaire link. Nothing about the PIN or the owner email is written to Firestore.

## 3. Firebase setup (Auth + Firestore)

The app auto-detects Firebase: add the keys and it switches from local mode to Firebase.

1. Create a project → **Add app → Web**, copy the config.
2. `cp .env.example .env.local` and fill in:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

3. **Authentication → Sign-in method**: enable **Email/Password** and **Anonymous**.
   - The owner is created automatically on first PIN/owner-email login, using the PIN as
     the account password (no manual user setup, and login never blocks if Firebase is down).
   - Clients get an anonymous session so they can save answers to their own questionnaire.
4. **Firestore Database → Create database**, then deploy the included rules:

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
| `pavitsingh1611@gmail.com` | ✅ all | ✅ create / update / delete |
| clients (anonymous session) | ✅ questionnaire docs | ✅ update answers only |
| everyone else | ❌ | ❌ |

Everything outside `questionnaires` is denied.

## 4. No Firebase yet? Local mode

With no keys the app still works end to end — questionnaires live in that browser's
`localStorage` (storage mode is shown as a badge in the header). Perfect for demoing to a
client on your own machine; add the Firebase keys before you send real links around.

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

## 6. Notes

- `firestore.rules` allows any signed-in session to read a questionnaire doc — needed for
  the client link. Tokens are random 12-char strings, so a link is effectively a private key.
- Change the PIN or owner email only in `lib/access.ts`, then rebuild.

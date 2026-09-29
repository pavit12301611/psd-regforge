# Vercel Deploy — Firebase Env Setup (Hindi Guide)

Bhai ye steps follow kar, 2 min me live ho jayega:

## 1. Vercel pe Project Import kar
- Vercel Dashboard → Add New → Project → GitHub se `psd-regforge` import kar
- Framework: Next.js auto-detect ho jayega
- Build Command: `npm run build` (default)

## 2. Keys daal — SIRF EK variable (naye names banane ki zaroorat nahi)

Vercel → Project → Settings → Environment Variables → **Add New**

| Field | Kya daalna hai |
|---|---|
| **Key** | `FIREBASE_CONFIG` |
| **Value** | Firebase ka config snippet **as-is paste** kar de (neeche dekh) |
| Environments | Production + Preview + Development |

Firebase Console → Project Settings → General → Your apps → Web app → **Config** — jo ye dikhta hai wahi pura paste kar:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.firebasestorage.app",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc",
  measurementId: "G-XXXX"
};
```

Code khud `apiKey`, `projectId`, `appId` etc. nikaal leta hai (build time pe, `next.config.mjs` → `lib/resolve-env.mjs`).
JSON, `KEY=value` lines, ya poora `.env` block paste karoge tab bhi chalega.

### Alternatives (agar chahiye)
- **Vercel ka .env paste**: Key field me poora `.env.example` jaisa block paste kar — Vercel khud alag variables bana deta hai.
- **Alag alag variables**: `NEXT_PUBLIC_FIREBASE_API_KEY` ya bina prefix `FIREBASE_API_KEY` — dono chalte hain.

> ⚠️ Env var badalne ke baad **Redeploy** zaroori hai — values build time pe bundle me jaati hain.

## 3. Deploy
- Save ke baad Vercel auto redeploy karega
- Agar nahi kare to: Deployments → Latest → Redeploy

## 4. Check kar
- Site open kar, top right me `Firebase live` badge dikhna chahiye
- Agar `Local mode` dikhe to matlab env vars load nahi hue — Vercel logs check kar

## Local Development ke liye
```bash
cp .env.example .env.local
# .env.local me values bhar de
npm install
npm run dev
```

## Firebase Console me kya enable karna hai
1. Authentication → Sign-in method:
   - Email/Password → Enable
   - Anonymous → Enable (for questionnaire clients)
2. Authentication → Users → **Add user** to create an admin email/password account.
3. Firestore Database → Create database → Start in production mode.
4. Copy the new admin user's **UID** from Authentication → Users. In Firestore create document `admins/{UID}` with boolean field `enabled: true`. The app cannot grant itself admin access; only Firebase Console/Admin SDK can manage this allowlist.
5. Publish the included Firestore rules:
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

After deployment, sign in on the website with the admin account. Other Firebase accounts are denied unless their UID has an enabled `admins/{uid}` document. Vercel env vars provide Firebase web config only; no owner email or PIN is used.

## Direct Links — Client ko ID enter karne ki zaroorat nahi ✅
- Owner jab questionnaire banata hai (`/new`), ab **full direct URL** dikhega: `https://yoursite.vercel.app/q/TOKEN`
- Ye link **directly open hota hai** — client ko main site pe jaake ID enter karne ki zaroorat nahi
- Client bas link pe click karega, questionnaire instantly khul jayega, bina login ke
- Dashboard (`/owner`) me bhi har questionnaire ke saath full direct link + copy button hai
- Main site (`/`) pe agar koi `?token=xxx` ya full link paste kare to auto-redirect to `/q/xxx`

## Code me kya change kiya hai (Tere liye summary)
- `lib/env.ts` naya banaya — saare env vars yahan se centralized read hote hain, trim ho ke
- `lib/firebase.ts` → ab `lib/env.ts` se config leta hai, Vercel-ready
- `firestore.rules` + `admins/{uid}` → admin allowlist is keyed by Firebase UID, not an email hard-coded in the app
- `.env.example` → Vercel ke exact naam ke saath, bas value khali — tu bas Vercel pe value daal
- `components/Shell.tsx` → badge message updated for Vercel
- `components/NewQuestionnaire.tsx` → ab full direct URL show karta hai, copy full link button
- `components/OwnerDashboard.tsx` → har item ke saath direct link input + Open direct button
- `components/Gate.tsx` → auto-redirect if ?token= in URL, plus info that /q/ links open directly
- `vercel.json` → minimal config for Next.js

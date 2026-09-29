# Vercel Deploy — Firebase Env Setup (Hindi Guide)

Bhai ye steps follow kar, 2 min me live ho jayega:

## 1. Vercel pe Project Import kar
- Vercel Dashboard → Add New → Project → GitHub se `psd-regforge` import kar
- Framework: Next.js auto-detect ho jayega
- Build Command: `npm run build` (default)

## 2. Environment Variables daal (IMPORTANT)
Vercel Dashboard → Tumhara Project → Settings → Environment Variables me jaa ke
**yeh saare naam add kar aur bas value daal de** — naam pehle se `.env.example` me hain:

| Variable Name (Key) | Kahan se milega | Required |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → General → Your apps → Web app → Config → apiKey | YES |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same Config → authDomain | YES |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same Config → projectId | YES |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same Config → storageBucket | YES |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same Config → messagingSenderId | YES |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same Config → appId | YES |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Same Config → measurementId (Analytics) | Optional |
| `NEXT_PUBLIC_OWNER_EMAIL` | Tumhara owner email, default: pavitsingh1611@gmail.com | Optional |
| `NEXT_PUBLIC_ACCESS_PIN` | Dashboard PIN, default: 5161211 | Optional |

**Har variable ko 3 environments me add karna:**
- ✅ Production
- ✅ Preview  
- ✅ Development

**Kaise daalna hai:**
1. Vercel → Settings → Environment Variables → Add New
2. Name: `NEXT_PUBLIC_FIREBASE_API_KEY` (exact same, copy paste)
3. Value: Firebase se copy kiya hua key
4. Environments: All 3 select kar
5. Save

Same process baaki 5-6 keys ke liye repeat kar.

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
   - Anonymous → Enable
2. Firestore Database → Create database → Start in production mode
3. Firestore Rules deploy:
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Bas! Ab Vercel pe env vars set hain, code `lib/env.ts` se auto read kar lega.
Koi hard-coded key nahi hai code me — sirf naam defined hain, value Vercel se aayegi.

## Direct Links — Client ko ID enter karne ki zaroorat nahi ✅
- Owner jab questionnaire banata hai (`/new`), ab **full direct URL** dikhega: `https://yoursite.vercel.app/q/TOKEN`
- Ye link **directly open hota hai** — client ko main site pe jaake ID enter karne ki zaroorat nahi
- Client bas link pe click karega, questionnaire instantly khul jayega, bina login ke
- Dashboard (`/owner`) me bhi har questionnaire ke saath full direct link + copy button hai
- Main site (`/`) pe agar koi `?token=xxx` ya full link paste kare to auto-redirect to `/q/xxx`

## Code me kya change kiya hai (Tere liye summary)
- `lib/env.ts` naya banaya — saare env vars yahan se centralized read hote hain, trim ho ke
- `lib/firebase.ts` → ab `lib/env.ts` se config leta hai, Vercel-ready
- `lib/access.ts` → OWNER_EMAIL aur ACCESS_PIN bhi env se override ho sakte hain (optional)
- `.env.example` → Vercel ke exact naam ke saath, bas value khali — tu bas Vercel pe value daal
- `components/Shell.tsx` → badge message updated for Vercel
- `components/NewQuestionnaire.tsx` → ab full direct URL show karta hai, copy full link button
- `components/OwnerDashboard.tsx` → har item ke saath direct link input + Open direct button
- `components/Gate.tsx` → auto-redirect if ?token= in URL, plus info that /q/ links open directly
- `vercel.json` → minimal config for Next.js

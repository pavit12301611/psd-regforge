/**
 * RegForge — build-time env resolver (plain ESM so next.config.mjs can import it).
 *
 * Goal: on Vercel you should NOT have to create 6-9 named variables by hand.
 * Any ONE of these is enough:
 *
 *   A) One variable  →  name: FIREBASE_CONFIG   value: paste the whole Firebase snippet
 *        (the `const firebaseConfig = { apiKey: "...", ... };` block, JSON, or a .env block)
 *   B) Vercel's "paste a .env" box — paste the whole KEY=value block into the Key field
 *        and Vercel splits it into variables for you.
 *   C) Individual variables, with OR without the NEXT_PUBLIC_ prefix
 *        (FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_API_KEY, apiKey, ...).
 *
 * Whatever is found is baked into the client bundle at build time.
 */

const FIELDS = {
  apiKey: 'apiKey',
  authDomain: 'authDomain',
  projectId: 'projectId',
  storageBucket: 'storageBucket',
  messagingSenderId: 'messagingSenderId',
  appId: 'appId',
  measurementId: 'measurementId',
};

// normalise "NEXT_PUBLIC_FIREBASE_API_KEY" / "firebase.apiKey" / "apiKey" -> "apikey"
function norm(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^nextpublic/, '')
    .replace(/^firebase/, '');
}

const LOOKUP = Object.fromEntries(Object.keys(FIELDS).map((k) => [norm(k), k]));
LOOKUP[norm('OWNER_EMAIL')] = 'ownerEmail';
LOOKUP[norm('ACCESS_PIN')] = 'accessPin';

function clean(v) {
  return String(v ?? '')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .trim();
}

/** Pulls known fields out of JSON, a JS object literal, or KEY=value lines. */
export function parseBlob(text) {
  const out = {};
  if (!text || typeof text !== 'string') return out;

  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      for (const [k, v] of Object.entries(json)) {
        const f = LOOKUP[norm(k)];
        if (f && typeof v === 'string' && clean(v)) out[f] = clean(v);
      }
      if (Object.keys(out).length) return out;
    }
  } catch {
    /* not JSON — fall through to the loose parser */
  }

  // name: "value"   |   name = 'value'   |   NAME=value   (one per line / comma separated)
  const re = /["']?([A-Za-z_][A-Za-z0-9_.]*)["']?\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s,;{}]+))/g;
  let m;
  while ((m = re.exec(text))) {
    const f = LOOKUP[norm(m[1])];
    const val = clean(m[2] ?? m[3] ?? m[4] ?? m[5]);
    if (f && val && !out[f]) out[f] = val;
  }
  return out;
}

/** Collects everything from process.env-like input. Explicit individual vars win over blob values. */
export function resolveEnv(source = process.env) {
  const blobKeys = [
    'FIREBASE_CONFIG',
    'NEXT_PUBLIC_FIREBASE_CONFIG',
    'FIREBASE_KEYS',
    'FIREBASE_ENV',
    'REGFORGE_ENV',
    'REGFORGE_CONFIG',
  ];

  let resolved = {};
  for (const k of blobKeys) Object.assign(resolved, parseBlob(source[k]));

  // Individual vars (prefixed or not). Also picks up a whole .env pasted into one odd-named var.
  for (const [k, v] of Object.entries(source)) {
    if (typeof v !== 'string' || !v.trim() || blobKeys.includes(k)) continue;
    const f = LOOKUP[norm(k)];
    if (f && /^(NEXT_PUBLIC_)?(FIREBASE_|OWNER_EMAIL$|ACCESS_PIN$)/i.test(k)) resolved[f] = clean(v);
    else if (f && /^(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)$/.test(k)) {
      resolved[f] = clean(v);
    }
  }
  return resolved;
}

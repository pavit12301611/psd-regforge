#!/usr/bin/env node
/**
 * Copy the pre-multi-user `questionnaires/{token}` collection into the new
 * users/{uid}/questionnaires/{token} layout and create share-token indexes.
 *
 * This script intentionally never deletes legacy documents. Run it with a
 * trusted Firebase Admin SDK credential after reviewing the dry-run output.
 * See README.md for the complete migration procedure.
 */

import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const overwrite = args.has('--overwrite');
const ownerMapArg = process.argv.find((arg) => arg.startsWith('--owner-map='));
const ownerMapPath = ownerMapArg?.slice('--owner-map='.length);

function usage(message) {
  if (message) console.error(`\nERROR: ${message}`);
  console.error(`\nUsage:
  GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json \\
  node scripts/migrate-legacy-questionnaires.mjs [--dry-run] [--owner-map=owners.json] [--overwrite]

The default mode copies records and leaves the legacy collection untouched.
`);
  process.exit(message ? 1 : 0);
}

if (args.has('--help') || args.has('-h')) usage();

let ownerMap = {};
if (ownerMapPath) {
  if (!existsSync(ownerMapPath)) usage(`Owner map not found: ${ownerMapPath}`);
  try {
    ownerMap = JSON.parse(readFileSync(ownerMapPath, 'utf8'));
  } catch (error) {
    usage(`Could not parse owner map: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let adminApp;
let init;
let applicationDefault;
let getApps;
let getFirestore;
let getAuth;
try {
  ({ initializeApp: init, applicationDefault, getApps } = await import('firebase-admin/app'));
  ({ getFirestore } = await import('firebase-admin/firestore'));
  ({ getAuth } = await import('firebase-admin/auth'));
  adminApp = getApps()[0] ?? init({
    credential: applicationDefault(),
    ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
  });
} catch (error) {
  console.error(
    '\nThis migration needs firebase-admin. Run `npm install --no-save firebase-admin` and provide a service-account credential.',
  );
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const userCache = new Map();

function stringValue(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function millis(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return fallback;
}

function mapOwner(data) {
  const oldUid = stringValue(data.ownerUid);
  const oldEmail = stringValue(data.ownerEmail).trim().toLowerCase();
  return stringValue(ownerMap[oldUid] ?? ownerMap[oldEmail] ?? oldUid);
}

async function authUserExists(uid) {
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    await auth.getUser(uid);
    userCache.set(uid, true);
    return true;
  } catch {
    userCache.set(uid, false);
    return false;
  }
}

const legacy = await db.collection('questionnaires').get();
console.log(`Found ${legacy.size} legacy questionnaire document(s).`);
if (dryRun) console.log('Dry run: no Firestore writes will be made.');
if (!ownerMapPath) {
  console.log('No owner map supplied; documents without a usable ownerUid will be skipped.');
}

let copied = 0;
let skipped = 0;
let conflicts = 0;
let pending = [];

async function flush() {
  if (!pending.length || dryRun) {
    pending = [];
    return;
  }
  const batch = db.batch();
  for (const operation of pending) {
    batch.set(operation.questionnaireRef, operation.questionnaire);
    batch.set(operation.shareRef, operation.share);
  }
  await batch.commit();
  pending = [];
}

for (const legacyDoc of legacy.docs) {
  const data = legacyDoc.data();
  const token = legacyDoc.id;
  const ownerUid = mapOwner(data);

  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    console.warn(`SKIP ${token}: token is not a safe URL token.`);
    skipped += 1;
    continue;
  }
  if (!ownerUid || !/^[A-Za-z0-9:_-]+$/.test(ownerUid)) {
    console.warn(`SKIP ${token}: no usable owner UID. Supply --owner-map=owners.json.`);
    skipped += 1;
    continue;
  }
  if (!(await authUserExists(ownerUid))) {
    console.warn(`SKIP ${token}: Firebase Auth user ${ownerUid} does not exist. Map it to the Google UID first.`);
    skipped += 1;
    continue;
  }

  const questionnaireRef = db.doc(`users/${ownerUid}/questionnaires/${token}`);
  const shareRef = db.doc(`shareTokens/${token}`);
  const [destination, shareIndex] = await Promise.all([questionnaireRef.get(), shareRef.get()]);

  if ((destination.exists || shareIndex.exists) && !overwrite) {
    const indexedOwner = shareIndex.exists ? shareIndex.data()?.ownerUid : '';
    if (indexedOwner && indexedOwner !== ownerUid) {
      console.warn(`CONFLICT ${token}: share index belongs to ${indexedOwner}; left untouched.`);
      conflicts += 1;
    } else {
      console.log(`SKIP ${token}: destination already exists (use --overwrite only after review).`);
      skipped += 1;
    }
    continue;
  }

  const createdAt = millis(data.createdAt, Date.now());
  const updatedAt = millis(data.updatedAt, createdAt);
  const submittedAt = data.submittedAt == null ? null : millis(data.submittedAt, null);
  const answers = data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers)
    ? data.answers
    : {};

  const questionnaire = {
    token,
    projectId: stringValue(data.projectId, token),
    title: stringValue(data.title, 'Untitled project'),
    clientName: stringValue(data.clientName),
    clientEmail: stringValue(data.clientEmail).trim().toLowerCase(),
    createdAt,
    updatedAt,
    submittedAt,
    answers,
    // Kept only to make the migration auditable; new app-created documents do
    // not expose or depend on this legacy field.
    ownerUid,
    ...(stringValue(data.ownerEmail) ? { ownerEmail: stringValue(data.ownerEmail) } : {}),
  };

  pending.push({
    questionnaireRef,
    shareRef,
    questionnaire,
    share: { token, ownerUid, createdAt, updatedAt },
  });
  copied += 1;
  if (pending.length >= 200) await flush();
}

await flush();
console.log(`\nReady/copied: ${copied}; skipped: ${skipped}; conflicts: ${conflicts}.`);
if (!dryRun && copied) {
  console.log('Legacy documents were not deleted. Validate the new dashboard and direct links before any manual cleanup.');
}

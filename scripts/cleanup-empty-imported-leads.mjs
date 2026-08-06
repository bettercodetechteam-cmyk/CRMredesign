/**
 * Backup leads + identify/delete empty-field Excel imports.
 *
 * Criteria for "invisible import" candidates:
 *   - leadName blank AND contact blank (and typically course blank)
 *   - Optional: created/updated within recent hours (default: today IST)
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\sa.json"
 *   npx tsx scripts/cleanup-empty-imported-leads.mjs --dry-run
 *   npx tsx scripts/cleanup-empty-imported-leads.mjs --apply
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTION_PROJECT_ID = 'zica-zima-crm';
const BATCH_SIZE = 400;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY_RUN = !APPLY;

function blank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate();
    } catch {
      return null;
    }
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Start of "today" in Asia/Kolkata (IST), as UTC Date */
function startOfTodayIst() {
  const now = new Date();
  // IST = UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  // Midnight IST as UTC
  return new Date(Date.UTC(y, m, d) - istOffsetMs);
}

function serializeLead(id, data) {
  const out = { id, ...data };
  for (const [k, v] of Object.entries(out)) {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && typeof v.seconds === 'number') {
      out[k] = new Date(v.seconds * 1000).toISOString();
    }
  }
  return out;
}

async function initAdmin() {
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath || !existsSync(credPath)) {
      throw new Error(
        'Set GOOGLE_APPLICATION_CREDENTIALS to the zica-zima-crm service account JSON path'
      );
    }
    const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
    const projectId = serviceAccount.project_id || PRODUCTION_PROJECT_ID;
    if (projectId !== PRODUCTION_PROJECT_ID) {
      throw new Error(`Refusing to run: project_id is ${projectId}, expected ${PRODUCTION_PROJECT_ID}`);
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }
  return admin.firestore();
}

async function fetchAllLeads(db) {
  const snap = await db.collection('leads').get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

function isInvisibleImportCandidate(data, since) {
  const nameBlank = blank(data.leadName) && blank(data.name);
  const contactBlank = blank(data.contact) && blank(data.phone) && blank(data.mobile);
  if (!nameBlank || !contactBlank) return false;

  // Prefer recent imports; if no timestamp, still treat blank name+contact as candidate
  // but flag separately
  const created = toDate(data.createdAt) || toDate(data.updatedAt) || toDate(data.enquiryDate);
  if (!since) return true;
  if (!created) return true; // include; report in "noTimestamp"
  return created.getTime() >= since.getTime();
}

async function main() {
  const db = await initAdmin();
  console.log(`Project: ${PRODUCTION_PROJECT_ID}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no deletes)' : 'APPLY (will delete)'}`);

  const all = await fetchAllLeads(db);
  console.log(`Total leads in Firestore: ${all.length}`);

  const backupDir = join(__dirname, '..', 'backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `leads-backup-${stamp}.json`);
  const backupPayload = {
    exportedAt: new Date().toISOString(),
    projectId: PRODUCTION_PROJECT_ID,
    count: all.length,
    leads: all.map(({ id, data }) => serializeLead(id, data)),
  };
  writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`Backup written: ${backupPath} (${all.length} docs)`);

  const since = startOfTodayIst();
  console.log(`Candidate window: created/updated/enquiryDate >= ${since.toISOString()} (today IST)`);

  const candidatesToday = [];
  const candidatesBlankAnyTime = [];
  const noTimestampAmongBlank = [];

  for (const { id, data } of all) {
    const nameBlank = blank(data.leadName) && blank(data.name);
    const contactBlank = blank(data.contact) && blank(data.phone) && blank(data.mobile);
    if (!nameBlank || !contactBlank) continue;

    const created = toDate(data.createdAt) || toDate(data.updatedAt) || toDate(data.enquiryDate);
    candidatesBlankAnyTime.push({ id, data, created });
    if (!created) noTimestampAmongBlank.push(id);
    if (isInvisibleImportCandidate(data, since)) {
      candidatesToday.push({ id, data, created });
    }
  }

  // Primary set: blank name+contact AND today (or no timestamp counted in today set)
  const primary = candidatesToday;
  const namedLeads = all.filter(({ data }) => !blank(data.leadName) || !blank(data.name));

  console.log('\n--- DRY-RUN SUMMARY ---');
  console.log(`Leads with a visible name:           ${namedLeads.length}`);
  console.log(`Blank name+contact (any time):       ${candidatesBlankAnyTime.length}`);
  console.log(`Blank name+contact (today IST):      ${primary.length}`);
  console.log(`Blank name+contact (no timestamp):   ${noTimestampAmongBlank.length}`);

  const sample = primary.slice(0, 8).map(({ id, data, created }) => ({
    id,
    leadName: data.leadName ?? '',
    contact: data.contact ?? '',
    course: data.course ?? '',
    status: data.status ?? '',
    centreId: data.centreId ?? '',
    srNo: data.srNo ?? '',
    createdAt: created ? created.toISOString() : null,
  }));
  console.log('\nSample candidates (up to 8):');
  console.log(JSON.stringify(sample, null, 2));

  const candidatesPath = join(backupDir, `leads-delete-candidates-${stamp}.json`);
  writeFileSync(
    candidatesPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        criteria: 'blank leadName/name AND blank contact/phone/mobile AND (today IST or missing timestamp)',
        count: primary.length,
        ids: primary.map((c) => c.id),
        sample,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nCandidate list saved: ${candidatesPath}`);

  if (DRY_RUN) {
    console.log('\n*** DRY-RUN complete. No documents deleted. ***');
    console.log('Review the counts above. If OK (~1000), re-run with --apply after confirmation.');
    return;
  }

  // APPLY safety checks
  if (primary.length === 0) {
    console.log('Nothing to delete.');
    return;
  }
  if (primary.length > 2500) {
    throw new Error(
      `Refusing to delete ${primary.length} docs (cap 2500). Narrow criteria or confirm manually.`
    );
  }
  if (primary.length < 50) {
    console.warn(`Warning: only ${primary.length} candidates — expected ~1000. Proceeding as requested.`);
  }

  let deleted = 0;
  for (let i = 0; i < primary.length; i += BATCH_SIZE) {
    const chunk = primary.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { id } of chunk) {
      batch.delete(db.collection('leads').doc(id));
    }
    await batch.commit();
    deleted += chunk.length;
    console.log(`Deleted ${deleted}/${primary.length}...`);
  }

  console.log(`\nDone. Deleted ${deleted} empty-field imported leads.`);
  console.log(`Full backup remains at: ${backupPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

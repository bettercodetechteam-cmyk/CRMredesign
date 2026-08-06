/**
 * One-time sync: align gstRecords + fees (+ students) dates with June 2026 GST sheet.
 * Only updates date-related fields. No deletes. Production: zica-zima-crm.
 *
 * Usage:
 *   npx tsx scripts/sync-gst-fee-dates-from-sheet.mjs --dry-run
 *   npx tsx scripts/sync-gst-fee-dates-from-sheet.mjs --apply
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { formatFirebasePrivateKey } from '../server/firebasePrivateKey.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const PRODUCTION_PROJECT_ID = 'zica-zima-crm';

/** Sheet rows: receipt, expected party name, target date (YYYY-MM-DD). */
const SHEET_ROWS = [
  { receipt: 'BTC078', student: 'Saieesh Santosh Birje', date: '2026-06-05' },
  { receipt: 'BTC079', student: 'Omkar Devkule', date: '2026-06-05' },
  { receipt: 'BTC080', student: 'Vishal Desai', date: '2026-06-09' },
  { receipt: 'BTC081', student: 'Akash Landge', date: '2026-06-11' },
  { receipt: 'BTC082', student: 'Akash Landge', date: '2026-06-11' },
  { receipt: 'BTC083', student: 'Sanjana Lunkad', date: '2026-06-21' },
  { receipt: 'BTC084', student: 'Sanjana Lunkad', date: '2026-06-21' },
  { receipt: 'BTC085', student: 'Narsmma Pujari', date: '2026-06-24' },
  { receipt: 'BTC086', student: 'Shivam Pawar', date: '2026-06-27' },
  { receipt: 'BTC087', student: 'Rohit Pokharkar', date: '2026-06-27' },
  { receipt: 'BTC088', student: 'Rohit Pokharkar', date: '2026-06-27' },
  { receipt: 'BTC089', student: 'Aavez Maniyar', date: '2026-06-27' },
  { receipt: 'BTC090', student: 'Dhanashree Kalane', date: '2026-06-27' },
  { receipt: 'Z260414003', student: 'Shrushti Jadhav', date: '2026-06-03' },
  { receipt: 'Z260520002', student: 'Pranav Maske', date: '2026-06-19' },
  { receipt: 'Z260525002', student: 'Diksha Dawani', date: '2026-06-01' },
  { receipt: 'Z260525003', student: 'Ashraf Nadaf', date: '2026-06-22' },
  { receipt: 'Z260602001', student: 'Kartik Bhavsar', date: '2026-06-13' },
  { receipt: 'Z260602002', student: 'Kartik Bhavsar', date: '2026-06-13' },
  { receipt: 'Z260603001', student: 'Kuhu Jamgaonkar', date: '2026-06-03' },
  { receipt: 'Z260623001', student: 'Sachidanand Gope', date: '2026-06-22' },
];

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const FEE_RECEIPT_FIELDS = [
  'registrationReceiptNumber',
  'receiptNumber',
  'fullPaymentReceiptNumber',
  ...Array.from({ length: 36 }, (_, i) => `installment${String(i + 1).padStart(2, '0')}ReceiptNumber`),
];

function dateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    date: dateStr,
    month: MONTH_NAMES[m - 1],
    year: y,
  };
}

async function initAdmin() {
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && existsSync(credPath)) {
      const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || PRODUCTION_PROJECT_ID,
      });
    } else {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = formatFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      if (!clientEmail || !privateKey) {
        throw new Error(
          'Missing valid credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a zica-zima-crm service account JSON, or fix FIREBASE_PRIVATE_KEY in .env'
        );
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PRODUCTION_PROJECT_ID,
          clientEmail,
          privateKey,
        }),
      });
    }
  }
  return admin.firestore();
}

function normalizeDateValue(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.split('T')[0];
    if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const [dd, mm, yy] = val.split('-');
      return `${yy}-${mm}-${dd}`;
    }
    return val;
  }
  if (val.toDate) {
    const dt = val.toDate();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  if (typeof val.seconds === 'number') {
    const dt = new Date(val.seconds * 1000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return String(val);
}

function namesRoughlyMatch(a, b) {
  const na = String(a || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const nb = String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!na || !nb) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function buildReceiptToFeeMap(db) {
  const snap = await db.collection('fees').get();
  const map = new Map();
  for (const doc of snap.docs) {
    const data = doc.data();
    for (const field of FEE_RECEIPT_FIELDS) {
      const val = data[field];
      if (typeof val === 'string' && val.trim() && val.trim() !== '-') {
        map.set(val.trim(), { id: doc.id, ref: doc.ref, data });
      }
    }
  }
  return map;
}

async function findGstByReceipt(db, receipt) {
  const snap = await db.collection('gstRecords')
    .where('invoiceNumbers', 'array-contains', receipt)
    .limit(5)
    .get();
  return snap.docs;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply || process.argv.includes('--dry-run');

  console.log(`\n📋 GST/Fee date sync — project: ${PRODUCTION_PROJECT_ID}`);
  console.log(dryRun ? '🔍 DRY RUN (no writes)\n' : '✅ APPLY MODE (writing to Firestore)\n');

  const db = await initAdmin();
  const feeByReceipt = await buildReceiptToFeeMap(db);
  console.log(`Loaded ${feeByReceipt.size} receipt→fee mappings from ${(await db.collection('fees').get()).size} fee docs\n`);

  const results = { gstUpdated: 0, gstSkipped: 0, gstMissing: 0, feeUpdated: 0, feeSkipped: 0, feeMissing: 0, studentUpdated: 0, studentSkipped: 0, warnings: [] };

  /** studentId or feeId -> latest date string from sheet */
  const studentTargetDates = new Map();

  for (const row of SHEET_ROWS) {
    const { receipt, student, date } = row;
    const parts = dateParts(date);
    const feeEntry = feeByReceipt.get(receipt);
    const feeStudentName = feeEntry?.data?.studentName || '';

    // Prefer GST matching sheet name, then fee student name; never update unrelated duplicates
    const allGst = await findGstByReceipt(db, receipt);
    let gstDocs = allGst;
    if (allGst.length > 1) {
      const bySheet = allGst.filter((d) => namesRoughlyMatch(d.data().partyName, student));
      const byFee = allGst.filter((d) => namesRoughlyMatch(d.data().partyName, feeStudentName));
      if (bySheet.length === 1) {
        gstDocs = bySheet;
        results.warnings.push(`Multiple GST for ${receipt}: updating only sheet-match "${student}"`);
      } else if (byFee.length === 1) {
        gstDocs = byFee;
        results.warnings.push(`Multiple GST for ${receipt}: updating only fee-match "${feeStudentName}"`);
      } else {
        results.warnings.push(`Multiple GST for ${receipt} (${allGst.length}) — no unique name match; SKIPPED GST update`);
        console.log(`⚠️ GST ${receipt}: ${allGst.length} docs, no unique name match — skipping GST`);
        gstDocs = [];
      }
    }

    if (allGst.length === 0) {
      results.gstMissing++;
      results.warnings.push(`GST not found: ${receipt} (${student})`);
      console.log(`❌ GST missing: ${receipt} — fee date still applied if fee exists`);
    }

    for (const gstDoc of gstDocs) {
      const gst = gstDoc.data();
      const currentDate = normalizeDateValue(gst.date);
      const nameOk = namesRoughlyMatch(gst.partyName, student);
      if (!nameOk) {
        results.warnings.push(
          `Name mismatch GST ${receipt}: sheet="${student}" firestore="${gst.partyName}" — applying sheet DATE on this receipt anyway`
        );
      }

      const patch = {
        date: parts.date,
        month: parts.month,
        year: parts.year,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const needsUpdate =
        currentDate !== parts.date ||
        String(gst.month || '').toUpperCase() !== parts.month ||
        Number(gst.year) !== parts.year;

      if (needsUpdate) {
        console.log(`  GST ${receipt}: ${currentDate || '(empty)'} → ${parts.date} [${gst.partyName}]`);
        if (!dryRun) {
          await gstDoc.ref.update(patch);
        }
        results.gstUpdated++;
      } else {
        console.log(`  GST ${receipt}: already ${parts.date} ✓ [${gst.partyName}]`);
        results.gstSkipped++;
      }

      // Only sync student date from fee owner of this receipt (not GST party when mismatched)
    }

    if (!feeEntry) {
      results.feeMissing++;
      results.warnings.push(`Fee doc not found for receipt: ${receipt}`);
      console.log(`  ⚠️ Fee doc not found for receipt ${receipt}`);
    } else {
      // Fee date driven by sheet date for this receipt (owner = whoever has the receipt field)
      const feeStudentId = feeEntry.data.studentId?.trim();
      if (feeStudentId) {
        const prev = studentTargetDates.get(`sid:${feeStudentId}`);
        if (!prev || date > prev) studentTargetDates.set(`sid:${feeStudentId}`, date);
      }
      const prevFee = studentTargetDates.get(`fee:${feeEntry.id}`);
      if (!prevFee || date > prevFee) studentTargetDates.set(`fee:${feeEntry.id}`, date);
    }
  }

  console.log('\n--- Fees + Students ---\n');

  const updatedFeeIds = new Set();
  const updatedStudentIds = new Set();

  for (const [key, targetDate] of studentTargetDates) {
    if (key.startsWith('fee:')) {
      const feeId = key.slice(4);
      if (updatedFeeIds.has(feeId)) continue;
      const feeRef = db.collection('fees').doc(feeId);
      const feeSnap = await feeRef.get();
      if (!feeSnap.exists) continue;
      const fee = feeSnap.data();
      const current = normalizeDateValue(fee.feesPaidDate || fee.paymentDate || fee.lastPaymentDate);
      if (current !== targetDate) {
        console.log(`  fees/${feeId} (${fee.studentName}): feesPaidDate ${current || '(empty)'} → ${targetDate}`);
        if (!dryRun) {
          await feeRef.update({
            feesPaidDate: targetDate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        results.feeUpdated++;
      } else {
        console.log(`  fees/${feeId} (${fee.studentName}): feesPaidDate already ${targetDate} ✓`);
        results.feeSkipped++;
      }
      updatedFeeIds.add(feeId);
      const sid = fee.studentId?.trim();
      if (sid && !studentTargetDates.has(`sid:${sid}`)) {
        studentTargetDates.set(`sid:${sid}`, targetDate);
      }
    }
  }

  for (const [key, targetDate] of studentTargetDates) {
    if (!key.startsWith('sid:')) continue;
    const studentId = key.slice(4);
    if (updatedStudentIds.has(studentId)) continue;

    const studentRef = db.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      results.warnings.push(`Student doc missing: ${studentId}`);
      continue;
    }
    const student = studentSnap.data();
    const current = normalizeDateValue(student.feesPaidDate || student.paymentDate || student.lastPaymentDate);
    if (current !== targetDate) {
      const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      console.log(`  students/${studentId} (${name}): feesPaidDate ${current || '(empty)'} → ${targetDate}`);
      if (!dryRun) {
        await studentRef.update({
          feesPaidDate: targetDate,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      results.studentUpdated++;
    } else {
      results.studentSkipped++;
    }
    updatedStudentIds.add(studentId);
  }

  console.log('\n========== SUMMARY ==========');
  console.log(JSON.stringify(results, null, 2));
  if (dryRun) {
    console.log('\nRe-run with --apply to write changes.');
  } else {
    console.log('\n✅ Done. Hard-refresh production CRM (Ctrl+Shift+R).');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

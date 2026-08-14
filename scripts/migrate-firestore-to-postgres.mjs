/**
 * One-time migration: Firestore → PostgreSQL
 *
 * Prerequisites:
 *   - DATABASE_URL in .env (root)
 *   - Firebase Admin credentials in .env
 *   - Postgres running: npm run db:up && npm run db:migrate
 *   - Reference data: npm run db:seed:reference
 *
 * Usage:
 *   node scripts/migrate-firestore-to-postgres.mjs
 *   node scripts/migrate-firestore-to-postgres.mjs --dry-run
 */
import 'dotenv/config';
import pg from 'pg';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const { Pool } = pg;
const dryRun = process.argv.includes('--dry-run');

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in environment`);
  return value;
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function splitName(full) {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function mapLeadSource(source) {
  const s = String(source ?? '').toLowerCase();
  if (s.includes('walk')) return 'walk_in';
  if (s.includes('refer')) return 'referral';
  if (s.includes('phone') || s.includes('call')) return 'phone';
  if (s.includes('social') || s.includes('facebook') || s.includes('instagram')) return 'social_media';
  if (s.includes('event') || s.includes('fair')) return 'event';
  if (s.includes('import')) return 'import';
  if (s.includes('web') || s.includes('online') || s.includes('google')) return 'online';
  return 'other';
}

function mapLeadStatus(status) {
  const s = String(status ?? '').toLowerCase();
  if (s.includes('admission') || s.includes('convert')) return 'converted';
  if (s.includes('not interested') || s.includes('lost')) return 'lost';
  if (s.includes('visit')) return 'visited';
  if (s.includes('hot')) return 'interested';
  if (s.includes('cold') || s.includes('contact')) return 'contacted';
  return 'new';
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const firestore = getFirestore();
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const centreResult = await client.query(
      `INSERT INTO centres (code, name, city, state, is_active)
       VALUES ('PUNE', 'Pune Centre', 'Pune', 'Maharashtra', true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const centreId = centreResult.rows[0].id;

    const courseResult = await client.query(
      `INSERT INTO courses (name, code, roll_prefix, duration_months, is_active)
       VALUES ('General Course', 'GEN', 'GEN', 6, true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const defaultCourseId = courseResult.rows[0].id;

    console.log(`Centre: ${centreId}, default course: ${defaultCourseId}`);

    const usersSnap = await firestore.collection('users').get();
    let usersMigrated = 0;
    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data();
      const email = String(data.email ?? '').trim().toLowerCase();
      if (!email) continue;
      const role = String(data.role ?? 'pending');
      const approved = data.approved === true;

      if (!dryRun) {
        await client.query(
          `INSERT INTO users (firebase_uid, email, first_name, last_name, role, centre_id, approved, is_active)
           VALUES ($1, $2, $3, $4, $5::"UserRole", $6, $7, true)
           ON CONFLICT (firebase_uid) DO UPDATE SET
             email = EXCLUDED.email,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             role = EXCLUDED.role,
             centre_id = COALESCE(users.centre_id, EXCLUDED.centre_id),
             approved = CASE WHEN EXCLUDED.approved THEN true ELSE users.approved END,
             updated_at = NOW()`,
          [
            docSnap.id,
            email,
            String(data.firstName ?? 'User').slice(0, 80),
            data.lastName ? String(data.lastName).slice(0, 80) : null,
            role,
            centreId,
            approved,
          ],
        );
      }
      usersMigrated += 1;
    }

    const leadsSnap = await firestore.collection('leads').get();
    let leadsMigrated = 0;
    for (const docSnap of leadsSnap.docs) {
      const data = docSnap.data();
      const phone = normalizePhone(data.contact || data.phone);
      if (!/^[6-9][0-9]{9}$/.test(phone)) continue;

      const { firstName, lastName } = data.firstName
        ? { firstName: String(data.firstName), lastName: data.lastName ? String(data.lastName) : null }
        : splitName(data.leadName || data.name);

      const leadNo = `FS-${docSnap.id.slice(0, 8).toUpperCase()}`;
      const status = mapLeadStatus(data.status);
      const source = mapLeadSource(data.source);

      if (!dryRun) {
        await client.query(
          `INSERT INTO leads (
             lead_no, centre_id, status, source, first_name, last_name, phone, email, notes, created_at, updated_at
           ) VALUES ($1, $2, $3::"LeadStatus", $4::"LeadSource", $5, $6, $7, $8, $9, COALESCE($10, NOW()), COALESCE($11, NOW()))
           ON CONFLICT (lead_no) DO NOTHING`,
          [
            leadNo,
            centreId,
            status,
            source,
            firstName.slice(0, 80),
            lastName?.slice(0, 80) ?? null,
            phone,
            data.emailId || data.email || null,
            data.remark || data.notes || null,
            data.createdAt?.toDate?.() ?? data.createdAt ?? null,
            data.updatedAt?.toDate?.() ?? data.updatedAt ?? null,
          ],
        );
      }
      leadsMigrated += 1;
    }

    const studentsSnap = await firestore.collection('students').get();
    let studentsMigrated = 0;
    for (const docSnap of studentsSnap.docs) {
      const data = docSnap.data();
      const phone = normalizePhone(data.phone || data.contact);
      if (!/^[6-9][0-9]{9}$/.test(phone)) continue;

      const { firstName, lastName } = data.firstName
        ? { firstName: String(data.firstName), lastName: data.lastName ? String(data.lastName) : null }
        : splitName(data.leadName || data.studentName);

      const rollNo = String(data.rollNo || data.srNo || `FS-${docSnap.id.slice(0, 8).toUpperCase()}`).slice(0, 40);
      const admissionDate = data.admissionDate?.toDate?.() ?? data.admissionDate ?? new Date();
      const adm = admissionDate instanceof Date ? admissionDate : new Date(admissionDate);

      if (!dryRun) {
        await client.query(
          `INSERT INTO students (
             roll_no, roll_course_id, roll_year, roll_month, duration_start_month, duration_end_month, roll_seq,
             centre_id, course_id, first_name, last_name, phone, email, parent_phone, admission_date, status, metadata
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13, $14, $15, $16::"StudentStatus", $17::jsonb
           )
           ON CONFLICT (roll_no) DO NOTHING`,
          [
            rollNo,
            defaultCourseId,
            adm.getUTCFullYear() % 100,
            adm.getUTCMonth() + 1,
            adm.getUTCMonth() + 1,
            Math.min(12, adm.getUTCMonth() + 7),
            studentsMigrated + 1,
            centreId,
            defaultCourseId,
            firstName.slice(0, 80),
            lastName?.slice(0, 80) ?? null,
            phone,
            data.email || data.emailId || null,
            normalizePhone(data.parentsContactNumber || data.parentPhone) || null,
            adm.toISOString().slice(0, 10),
            'active',
            JSON.stringify(data),
          ],
        );
      }
      studentsMigrated += 1;
    }

    const feesSnap = await firestore.collection('fees').get();
    let feesMigrated = 0;
    for (const docSnap of feesSnap.docs) {
      const data = docSnap.data();
      const payload = { ...data, firestoreId: docSnap.id };
      if (!dryRun) {
        await client.query(
          `INSERT INTO crm_fee_records (centre_id, student_id, sr_no, contact_number, data, created_at, updated_at)
           VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5::jsonb, COALESCE($6, NOW()), COALESCE($7, NOW()))`,
          [
            centreId,
            typeof data.studentId === 'string' && /^[0-9a-f-]{36}$/i.test(data.studentId)
              ? data.studentId
              : null,
            Number(data.srNo) || null,
            normalizePhone(data.contactNumber || data.phone) || null,
            JSON.stringify(payload),
            data.createdAt?.toDate?.() ?? data.createdAt ?? null,
            data.updatedAt?.toDate?.() ?? data.updatedAt ?? null,
          ],
        );
      }
      feesMigrated += 1;
    }

    const gstSnap = await firestore.collection('gstRecords').get();
    let gstMigrated = 0;
    for (const docSnap of gstSnap.docs) {
      const data = docSnap.data();
      const payload = { ...data, id: docSnap.id };
      if (!dryRun) {
        await client.query(
          `INSERT INTO crm_gst_records (centre_id, student_id, data, created_at, updated_at)
           VALUES ($1, NULLIF($2, '')::uuid, $3::jsonb, COALESCE($4, NOW()), COALESCE($5, NOW()))`,
          [
            centreId,
            data.studentId || null,
            JSON.stringify(payload),
            data.createdAt?.toDate?.() ?? data.createdAt ?? null,
            data.updatedAt?.toDate?.() ?? data.updatedAt ?? null,
          ],
        );
      }
      gstMigrated += 1;
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          usersMigrated,
          leadsMigrated,
          studentsMigrated,
          feesMigrated,
          gstMigrated,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

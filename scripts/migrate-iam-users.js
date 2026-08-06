/**
 * One-time migration script for known CRM users.
 * Run with: node scripts/migrate-iam-users.js
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin credentials.
 */
const admin = require('firebase-admin');

const EMAIL_ROLE_MIGRATION = {
  'cmzicazima@gmail.com': 'director',
  'gauravkarewar724@gmail.com': 'director',
  'director@zica.edu': 'director',
  'ahzicazima@gmail.com': 'academic_head',
  'sfzica@gmail.com': 'faculty',
  'cczicazima@gmail.com': 'accounting',
  'gdzicazima@gmail.com': 'digital_marketing',
  'bdmzica@gmail.com': 'bdm',
};

const DIRECTOR_EMAILS = new Set(Object.keys(EMAIL_ROLE_MIGRATION).filter((e) => EMAIL_ROLE_MIGRATION[e] === 'director'));

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'accounts' || normalized === 'accountant') return 'accounting';
  return normalized;
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  const snapshot = await db.collection('users').get();
  let updated = 0;

  for (const docSnap of snapshot.docs) {
    const user = docSnap.data();
    const email = normalizeEmail(user.email);
    const mappedRole = EMAIL_ROLE_MIGRATION[email];
    const patch = {};
    let shouldUpdate = false;

    if (mappedRole) {
      patch.role = mappedRole;
      patch.approved = true;
      patch.permissionsGranted = [];
      patch.permissionsRevoked = [];
      patch.rejected = false;
      shouldUpdate = true;
    } else {
      const role = normalizeRole(user.role);
      if (role === 'accounts' || role === 'accountant') {
        patch.role = 'accounting';
        shouldUpdate = true;
      } else if (role === 'director' && !DIRECTOR_EMAILS.has(email) && user.approved !== true) {
        patch.role = 'pending';
        patch.approved = false;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await docSnap.ref.update(patch);
      updated += 1;
      console.log(`Updated ${email || docSnap.id} -> ${patch.role ?? user.role}`);
    }
  }

  console.log(`Migration complete. Updated ${updated} user(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

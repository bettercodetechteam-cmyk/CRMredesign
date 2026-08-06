const functions = require('firebase-functions');
const admin = require('firebase-admin');

const DIRECTOR_EMAILS = [
  'cmzicazima@gmail.com',
  'gauravkarewar724@gmail.com',
  'director@zica.edu',
];

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

const ASSIGNABLE_ROLES = new Set([
  'director',
  'academic_head',
  'faculty',
  'accounting',
  'digital_marketing',
  'bdm',
  'centre_head',
  'marketing',
  'admin',
  'employee',
  'designer',
  'pending',
]);

const MODULE_PERMISSIONS = new Set([
  'dashboard',
  'profile',
  'leads',
  'students',
  'fees',
  'batches',
  'expenses',
  'academics',
  'assets',
  'staff',
  'promotional_offers',
  'blogs',
  'user_approvals',
  'access_management',
  'reports',
  'settings',
  'targets',
  'assignments',
  'courses',
]);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'accounts' || normalized === 'accountant') return 'accounting';
  if (normalized === 'senior_faculty') return 'faculty';
  return normalized;
}

function isDirectorEmail(email) {
  return DIRECTOR_EMAILS.includes(normalizeEmail(email));
}

async function getCallerProfile(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  const snap = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
  }
  return { id: snap.id, ...snap.data() };
}

async function assertDirector(context) {
  const caller = await getCallerProfile(context);
  const role = normalizeRole(caller.role);
  if (role !== 'director' && !isDirectorEmail(caller.email)) {
    throw new functions.https.HttpsError('permission-denied', 'Only directors can perform this action.');
  }
  return caller;
}

function validatePermissions(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => MODULE_PERMISSIONS.has(item));
}

async function writeAuditLog(entry) {
  await admin.firestore().collection('accessAuditLog').add({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.approveUser = functions.https.onCall(async (data, context) => {
  const caller = await assertDirector(context);
  const targetUid = data?.targetUid;
  const role = normalizeRole(data?.role);

  if (!targetUid || !ASSIGNABLE_ROLES.has(role) || role === 'pending') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid targetUid and role are required.');
  }

  const targetRef = admin.firestore().collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user not found.');
  }

  await targetRef.update({
    approved: true,
    rejected: false,
    role,
    permissionsGranted: [],
    permissionsRevoked: [],
    approvedBy: caller.id,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await admin.firestore().collection('notifications').add({
    type: 'account_approved',
    message: 'Your account has been approved! You can now sign in to the CRM.',
    userId: targetUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    seen: false,
  });

  await writeAuditLog({
    action: 'approve_user',
    actorUid: caller.id,
    actorEmail: caller.email,
    targetUid,
    role,
  });

  return { success: true };
});

exports.rejectUser = functions.https.onCall(async (data, context) => {
  const caller = await assertDirector(context);
  const targetUid = data?.targetUid;

  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
  }

  const targetRef = admin.firestore().collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user not found.');
  }

  await targetRef.update({
    approved: false,
    rejected: true,
    rejectedBy: caller.id,
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await admin.firestore().collection('notifications').add({
    type: 'account_rejected',
    message: 'Your account request has been rejected. Please contact your administrator.',
    userId: targetUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    seen: false,
  });

  await writeAuditLog({
    action: 'reject_user',
    actorUid: caller.id,
    actorEmail: caller.email,
    targetUid,
  });

  return { success: true };
});

exports.updateUserAccess = functions.https.onCall(async (data, context) => {
  const caller = await assertDirector(context);
  const targetUid = data?.targetUid;

  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
  }

  const targetRef = admin.firestore().collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user not found.');
  }

  const target = targetSnap.data();
  const targetEmail = normalizeEmail(target.email);
  const updateData = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: caller.id,
  };

  if (data.role !== undefined) {
    const nextRole = normalizeRole(data.role);
    if (!ASSIGNABLE_ROLES.has(nextRole)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }
    if (isDirectorEmail(targetEmail) && nextRole !== 'director') {
      throw new functions.https.HttpsError('permission-denied', 'Cannot demote protected director accounts.');
    }
    if (targetUid === caller.id && nextRole !== 'director') {
      throw new functions.https.HttpsError('permission-denied', 'Directors cannot remove their own director role.');
    }
    updateData.role = nextRole;
  }

  if (data.permissionsGranted !== undefined) {
    updateData.permissionsGranted = validatePermissions(data.permissionsGranted);
  }
  if (data.permissionsRevoked !== undefined) {
    updateData.permissionsRevoked = validatePermissions(data.permissionsRevoked);
  }

  await targetRef.update(updateData);

  await writeAuditLog({
    action: 'update_user_access',
    actorUid: caller.id,
    actorEmail: caller.email,
    targetUid,
    changes: {
      role: updateData.role ?? null,
      permissionsGranted: updateData.permissionsGranted ?? null,
      permissionsRevoked: updateData.permissionsRevoked ?? null,
    },
  });

  return { success: true };
});

exports.migrateKnownUsers = functions.https.onCall(async (_data, context) => {
  await assertDirector(context);

  const usersSnap = await admin.firestore().collection('users').get();
  let updated = 0;

  for (const docSnap of usersSnap.docs) {
    const user = docSnap.data();
    const email = normalizeEmail(user.email);
    const mappedRole = EMAIL_ROLE_MIGRATION[email];
    const patch = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    let shouldUpdate = false;

    if (mappedRole) {
      patch.role = mappedRole;
      patch.approved = true;
      patch.permissionsGranted = [];
      patch.permissionsRevoked = [];
      patch.rejected = false;
      shouldUpdate = true;
    } else if (normalizeRole(user.role) === 'accounts' || normalizeRole(user.role) === 'accountant') {
      patch.role = 'accounting';
      shouldUpdate = true;
    } else if (normalizeRole(user.role) === 'director' && !isDirectorEmail(email) && user.approved !== true) {
      patch.role = 'pending';
      patch.approved = false;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await docSnap.ref.update(patch);
      updated += 1;
    }
  }

  await writeAuditLog({
    action: 'migrate_known_users',
    actorUid: context.auth.uid,
    updated,
  });

  return { success: true, updated };
});

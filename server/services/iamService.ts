import { getFirebaseAdmin } from "../firebaseConfig";
import type { IamCaller } from "../middleware/requireDirector";

const DIRECTOR_EMAILS = new Set([
  "cmzicazima@gmail.com",
  "gauravkarewar724@gmail.com",
  "director@zica.edu",
]);

const EMAIL_ROLE_MIGRATION: Record<string, string> = {
  "cmzicazima@gmail.com": "director",
  "gauravkarewar724@gmail.com": "director",
  "director@zica.edu": "director",
  "ahzicazima@gmail.com": "academic_head",
  "sfzica@gmail.com": "faculty",
  "cczicazima@gmail.com": "accounting",
  "gdzicazima@gmail.com": "digital_marketing",
  "bdmzica@gmail.com": "bdm",
};

const ASSIGNABLE_ROLES = new Set([
  "director",
  "academic_head",
  "faculty",
  "accounting",
  "digital_marketing",
  "bdm",
  "centre_head",
  "marketing",
  "admin",
  "employee",
  "designer",
  "pending",
]);

const MODULE_PERMISSIONS = new Set([
  "dashboard",
  "profile",
  "leads",
  "students",
  "fees",
  "batches",
  "expenses",
  "academics",
  "assets",
  "staff",
  "promotional_offers",
  "blogs",
  "user_approvals",
  "access_management",
  "reports",
  "settings",
  "targets",
  "assignments",
  "courses",
]);

function normalizeEmail(email?: string | null): string {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeRole(role?: string | null): string {
  const normalized = String(role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "accounts" || normalized === "accountant") return "accounting";
  if (normalized === "senior_faculty") return "faculty";
  return normalized;
}

function isDirectorEmail(email?: string | null): boolean {
  return DIRECTOR_EMAILS.has(normalizeEmail(email));
}

function validatePermissions(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => typeof item === "string" && MODULE_PERMISSIONS.has(item));
}

async function getAdminDb() {
  const bundle = await getFirebaseAdmin();
  if (!bundle?.adminDb) {
    throw new Error("Firebase Admin is not configured on the server.");
  }
  return bundle.adminDb;
}

async function writeAuditLog(entry: Record<string, unknown>) {
  const db = await getAdminDb();
  const admin = await import("firebase-admin");
  await db.collection("accessAuditLog").add({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export class IamService {
  static async approveUser(caller: IamCaller, targetUid: string, role: string) {
    const normalizedRole = normalizeRole(role);
    if (!targetUid || !ASSIGNABLE_ROLES.has(normalizedRole) || normalizedRole === "pending") {
      throw new Error("Valid targetUid and role are required.");
    }

    const db = await getAdminDb();
    const admin = await import("firebase-admin");
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new Error("Target user not found.");
    }

    await targetRef.update({
      approved: true,
      rejected: false,
      role: normalizedRole,
      permissionsGranted: [],
      permissionsRevoked: [],
      approvedBy: caller.id,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("notifications").add({
      type: "account_approved",
      message: "Your account has been approved! You can now sign in to the CRM.",
      userId: targetUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      seen: false,
    });

    await writeAuditLog({
      action: "approve_user",
      actorUid: caller.id,
      actorEmail: caller.email,
      targetUid,
      role: normalizedRole,
    });

    return { success: true };
  }

  static async rejectUser(caller: IamCaller, targetUid: string) {
    if (!targetUid) throw new Error("targetUid is required.");

    const db = await getAdminDb();
    const admin = await import("firebase-admin");
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new Error("Target user not found.");
    }

    await targetRef.update({
      approved: false,
      rejected: true,
      rejectedBy: caller.id,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("notifications").add({
      type: "account_rejected",
      message: "Your account request has been rejected. Please contact your administrator.",
      userId: targetUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      seen: false,
    });

    await writeAuditLog({
      action: "reject_user",
      actorUid: caller.id,
      actorEmail: caller.email,
      targetUid,
    });

    return { success: true };
  }

  static async updateUserAccess(
    caller: IamCaller,
    payload: {
      targetUid: string;
      role?: string;
      permissionsGranted?: string[];
      permissionsRevoked?: string[];
    }
  ) {
    const { targetUid } = payload;
    if (!targetUid) throw new Error("targetUid is required.");

    const db = await getAdminDb();
    const admin = await import("firebase-admin");
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new Error("Target user not found.");
    }

    const target = targetSnap.data() as Record<string, unknown>;
    const targetEmail = normalizeEmail(target.email as string);
    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: caller.id,
    };

    if (payload.role !== undefined) {
      const nextRole = normalizeRole(payload.role);
      if (!ASSIGNABLE_ROLES.has(nextRole)) {
        throw new Error("Invalid role.");
      }
      if (isDirectorEmail(targetEmail) && nextRole !== "director") {
        throw new Error("Cannot demote protected director accounts.");
      }
      if (targetUid === caller.id && nextRole !== "director") {
        throw new Error("Directors cannot remove their own director role.");
      }
      updateData.role = nextRole;
    }

    if (payload.permissionsGranted !== undefined) {
      updateData.permissionsGranted = validatePermissions(payload.permissionsGranted);
    }
    if (payload.permissionsRevoked !== undefined) {
      updateData.permissionsRevoked = validatePermissions(payload.permissionsRevoked);
    }

    await targetRef.update(updateData);

    await writeAuditLog({
      action: "update_user_access",
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
  }

  static async migrateKnownUsers(caller: IamCaller) {
    const db = await getAdminDb();
    const admin = await import("firebase-admin");
    const usersSnap = await db.collection("users").get();
    let updated = 0;

    for (const docSnap of usersSnap.docs) {
      const user = docSnap.data();
      const email = normalizeEmail(user.email);
      const mappedRole = EMAIL_ROLE_MIGRATION[email];
      const patch: Record<string, unknown> = {
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
      } else if (normalizeRole(user.role) === "accounts" || normalizeRole(user.role) === "accountant") {
        patch.role = "accounting";
        shouldUpdate = true;
      } else if (
        normalizeRole(user.role) === "director" &&
        !isDirectorEmail(email) &&
        user.approved !== true
      ) {
        patch.role = "pending";
        patch.approved = false;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await docSnap.ref.update(patch);
        updated += 1;
      }
    }

    await writeAuditLog({
      action: "migrate_known_users",
      actorUid: caller.id,
      updated,
    });

    return { success: true, updated };
  }
}

import type { Request, Response, NextFunction } from "express";
import { getFirebaseAdmin } from "../firebaseConfig";

const DIRECTOR_EMAILS = new Set([
  "cmzicazima@gmail.com",
  "gauravkarewar724@gmail.com",
  "director@zica.edu",
]);

function normalizeEmail(email?: string | null): string {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeRole(role?: string | null): string {
  const normalized = String(role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "accounts" || normalized === "accountant") return "accounting";
  return normalized;
}

export interface IamCaller {
  id: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

declare global {
  namespace Express {
    interface Request {
      iamCaller?: IamCaller;
    }
  }
}

export async function requireDirector(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const token = authHeader.slice(7);
    const adminBundle = await getFirebaseAdmin();
    if (!adminBundle?.adminApp || !adminBundle.adminDb) {
      return res.status(503).json({
        success: false,
        message: "IAM service unavailable. Configure Firebase Admin credentials on the server.",
      });
    }

    const admin = await import("firebase-admin");
    const decoded = await admin.auth().verifyIdToken(token);
    const userSnap = await adminBundle.adminDb.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({ success: false, message: "User profile not found." });
    }

    const user = userSnap.data() as Record<string, unknown>;
    const role = normalizeRole(user.role as string);
    const email = normalizeEmail(user.email as string);
    const isDirector = role === "director" || DIRECTOR_EMAILS.has(email);

    if (!isDirector) {
      return res.status(403).json({ success: false, message: "Only directors can perform this action." });
    }

    req.iamCaller = {
      id: decoded.uid,
      email: user.email as string | undefined,
      role: user.role as string | undefined,
      firstName: user.firstName as string | undefined,
      lastName: user.lastName as string | undefined,
    };

    next();
  } catch (error) {
    console.error("requireDirector auth error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired authentication token." });
  }
}

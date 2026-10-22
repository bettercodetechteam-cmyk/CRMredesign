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

export interface AuthCaller {
  id: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  centreId?: string;
  approved?: boolean;
  isDirector: boolean;
}

declare global {
  namespace Express {
    interface Request {
      caller?: AuthCaller;
    }
  }
}

const callerCache = new Map<string, { at: number; caller: AuthCaller }>();
const CALLER_CACHE_MS = 60_000;

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return code === 8 || code === "resource-exhausted" || /quota exceeded/i.test(message);
}

export const QUOTA_MESSAGE =
  "The database read limit for today has been reached. Your login is still valid. Wait and try again later.";

export async function authenticateRequest(req: Request, res: Response): Promise<AuthCaller | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Authentication required." });
    return null;
  }

  const token = authHeader.slice(7);
  const adminBundle = await getFirebaseAdmin();
  if (!adminBundle?.adminApp || !adminBundle.adminDb) {
    res.status(503).json({
      success: false,
      message: "Service unavailable. Configure Firebase Admin credentials on the server.",
    });
    return null;
  }

  const admin = await import("firebase-admin");
  const decoded = await admin.auth().verifyIdToken(token);
  const cached = callerCache.get(decoded.uid);
  if (cached && Date.now() - cached.at < CALLER_CACHE_MS) return cached.caller;
  const userSnap = await adminBundle.adminDb.collection("users").doc(decoded.uid).get();

  if (!userSnap.exists) {
    res.status(403).json({ success: false, message: "User profile not found." });
    return null;
  }

  const user = userSnap.data() as Record<string, unknown>;
  const role = normalizeRole(user.role as string);
  const email = normalizeEmail(user.email as string);
  const isDirector = role === "director" || DIRECTOR_EMAILS.has(email);
  const approved = true;

  const caller: AuthCaller = {
    id: decoded.uid,
    email: user.email as string | undefined,
    role: user.role as string | undefined,
    firstName: user.firstName as string | undefined,
    lastName: user.lastName as string | undefined,
    centreId: (user.centreId as string) || "default",
    approved,
    isDirector,
  };
  callerCache.set(decoded.uid, { at: Date.now(), caller });
  return caller;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const caller = await authenticateRequest(req, res);
    if (!caller) return;
    req.caller = caller;
    req.iamCaller = {
      id: caller.id,
      email: caller.email,
      role: caller.role,
      firstName: caller.firstName,
      lastName: caller.lastName,
    };
    next();
  } catch (error) {
    console.error("requireAuth error:", error);
    if (isQuotaError(error)) {
      return res.status(503).json({ success: false, message: QUOTA_MESSAGE });
    }
    return res.status(401).json({ success: false, message: "Invalid or expired authentication token." });
  }
}

export async function requireTaskDirector(req: Request, res: Response, next: NextFunction) {
  try {
    const caller = await authenticateRequest(req, res);
    if (!caller) return;
    if (!caller.isDirector) {
      return res.status(403).json({ success: false, message: "Only directors can perform this action." });
    }
    req.caller = caller;
    req.iamCaller = {
      id: caller.id,
      email: caller.email,
      role: caller.role,
      firstName: caller.firstName,
      lastName: caller.lastName,
    };
    next();
  } catch (error) {
    console.error("requireTaskDirector error:", error);
    if (isQuotaError(error)) {
      return res.status(503).json({ success: false, message: QUOTA_MESSAGE });
    }
    return res.status(401).json({ success: false, message: "Invalid or expired authentication token." });
  }
}

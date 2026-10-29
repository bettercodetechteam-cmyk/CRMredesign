import fs from "fs";
import path from "path";
import express, { type Express, type Request, type Response } from "express";
import { isQuotaError, QUOTA_MESSAGE, requireAuth, type AuthCaller } from "./middleware/requireAuth";
import { getFirebaseAdmin } from "./firebaseConfig";
import { GstFileError, parseGstFeeFile } from "./annualGstParser";
import type { GstMonthUpload } from "../shared/annualGstTypes";

const COLLECTION = "annualGstUploads";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const FILE_ROOT = path.resolve(process.cwd(), "data", "annual-gst");
const STORED_FILE = /^[A-Za-z0-9]{10,40}\.(pdf|xlsx|xls|csv)$/;

function storedFileName(id: string, originalName: string): string | null {
  const extension = originalName.split(".").pop()?.toLowerCase() ?? "";
  const name = `${id}.${extension}`;
  return STORED_FILE.test(name) ? name : null;
}

function canUseGst(caller: AuthCaller): boolean {
  const role = String(caller.role ?? "").toLowerCase();
  return caller.isDirector || (role !== "student" && role !== "parent" && role !== "pending");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function database() {
  const bundle = await getFirebaseAdmin();
  return bundle?.adminDb ?? null;
}

function handle(handler: (req: Request, res: Response, db: FirebaseFirestore.Firestore) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      const db = await database();
      if (!db || !req.caller) {
        res.status(503).json({ success: false, message: "GST service unavailable. Configure Firebase Admin on the server." });
        return;
      }
      if (!canUseGst(req.caller)) {
        res.status(403).json({ success: false, message: "Only staff can use Annual GST." });
        return;
      }
      await handler(req, res, db);
    } catch (error) {
      if (error instanceof GstFileError) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (isQuotaError(error)) {
        res.status(503).json({ success: false, message: QUOTA_MESSAGE });
        return;
      }
      console.error("Annual GST route error:", error);
      res.status(500).json({ success: false, message: "Annual GST request failed." });
    }
  };
}

function fileBody(req: Request, res: Response, next: () => void) {
  express.raw({ type: () => true, limit: "15mb" })(req, res, (error: unknown) => {
    if (!error) return next();
    const tooLarge = typeof error === "object" && error !== null && (error as { type?: string }).type === "entity.too.large";
    res.status(400).json({ success: false, message: tooLarge ? "Choose a file of 15 MB or less." : "Upload an Excel file." });
  });
}

function visibleTo(caller: AuthCaller, data: FirebaseFirestore.DocumentData): boolean {
  return caller.isDirector || data.centreId === caller.centreId;
}

export function registerAnnualGstRoutes(app: Express) {
  app.get("/api/annual-gst", requireAuth, handle(async (req, res, db) => {
    const snap = await db.collection(COLLECTION).get();
    const uploads = snap.docs
      .filter((doc) => visibleTo(req.caller!, doc.data()))
      .map((doc) => ({ ...(doc.data() as Omit<GstMonthUpload, "id">), id: doc.id }))
      .sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
    res.json({ success: true, data: uploads });
  }));

  app.post("/api/annual-gst/upload", requireAuth, fileBody, handle(async (req, res, db) => {
    const file = Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : null;
    const month = typeof req.query.month === "string" ? req.query.month.trim() : "";
    const fileName = typeof req.query.name === "string" ? req.query.name.trim() : "";
    if (!file) throw new GstFileError("Upload an Excel file.");
    if (!MONTH.test(month)) throw new GstFileError("Choose the month this file belongs to.");
    const parsed = await parseGstFeeFile(file, fileName);
    const caller = req.caller!;
    const upload: Omit<GstMonthUpload, "id"> & { centreId: string } = {
      month,
      fileName: fileName || "upload",
      fileType: parsed.fileType,
      rows: parsed.rows,
      totalAmount: round2(parsed.rows.reduce((sum, row) => sum + row.amount, 0)),
      totalTaxable: round2(parsed.rows.reduce((sum, row) => sum + row.taxable, 0)),
      totalGst: round2(parsed.rows.reduce((sum, row) => sum + row.gst, 0)),
      gstFromFile: parsed.gstFromFile,
      warnings: parsed.warnings,
      uploadedBy: caller.id,
      uploadedByName: [caller.firstName, caller.lastName].filter(Boolean).join(" ") || caller.email || "",
      createdAt: new Date().toISOString(),
      centreId: caller.centreId || "default",
    };
    const ref = db.collection(COLLECTION).doc();
    const stored = storedFileName(ref.id, fileName);
    if (!stored) throw new GstFileError("Upload an Excel file (.xlsx, .xls or .csv).");
    await fs.promises.mkdir(FILE_ROOT, { recursive: true });
    await fs.promises.writeFile(path.join(FILE_ROOT, stored), file);
    const saved = { fileUrl: `/api/annual-gst/file/${stored}`, fileSize: file.length };
    try {
      await ref.set({ ...upload, ...saved });
    } catch (error) {
      await fs.promises.rm(path.join(FILE_ROOT, stored), { force: true });
      throw error;
    }
    res.status(201).json({ success: true, data: { ...upload, ...saved, id: ref.id } });
  }));

  app.get("/api/annual-gst/file/:name", requireAuth, handle(async (req, res, db) => {
    const name = req.params.name;
    const full = path.join(FILE_ROOT, name);
    const snap = STORED_FILE.test(name) ? await db.collection(COLLECTION).doc(name.split(".")[0]).get() : null;
    const owned = snap?.exists && visibleTo(req.caller!, snap.data()!) && String(snap.data()?.fileUrl ?? "").endsWith(`/${name}`);
    if (!owned || !fs.existsSync(full)) {
      res.status(404).json({ success: false, message: "File not found." });
      return;
    }
    res.sendFile(full);
  }));

  app.delete("/api/annual-gst/:id", requireAuth, handle(async (req, res, db) => {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || !visibleTo(req.caller!, snap.data()!)) {
      res.status(404).json({ success: false, message: "Upload not found." });
      return;
    }
    await ref.delete();
    const stored = String(snap.data()?.fileUrl ?? "").split("/").pop() ?? "";
    if (STORED_FILE.test(stored)) await fs.promises.rm(path.join(FILE_ROOT, stored), { force: true });
    res.json({ success: true, data: { id: req.params.id } });
  }));
}

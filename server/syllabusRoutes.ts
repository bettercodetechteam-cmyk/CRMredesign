import express, { type Express, type Request, type Response } from "express";
import { isQuotaError, QUOTA_MESSAGE, requireAuth } from "./middleware/requireAuth";
import { getFirebaseAdmin } from "./firebaseConfig";
import { SyllabusError, SyllabusService } from "./services/syllabusService";

async function service(): Promise<SyllabusService | null> {
  const adminBundle = await getFirebaseAdmin();
  if (!adminBundle?.adminDb) return null;
  return new SyllabusService(adminBundle.adminDb);
}

function fail(res: Response, error: unknown) {
  if (error instanceof SyllabusError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Syllabus route error:", error);
  res.status(500).json({ success: false, message: "Syllabus request failed." });
}

function queryText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function wrap(handler: (req: Request, res: Response, svc: SyllabusService) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      const svc = await service();
      if (!svc || !req.caller) {
        res.status(503).json({
          success: false,
          message: "Syllabus service unavailable. Configure Firebase Admin on the server.",
        });
        return;
      }
      await handler(req, res, svc);
    } catch (error) {
      fail(res, error);
    }
  };
}

export function registerSyllabusRoutes(app: Express) {
  app.get("/api/syllabus/access", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.access(req.caller!) });
  }));

  app.get("/api/syllabus/courses", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.courseNames(req.caller!) });
  }));

  app.get("/api/syllabus/meta", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.meta(req.caller!) });
  }));

  app.get("/api/syllabus/directory", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.directory(req.caller!) });
  }));

  app.get("/api/syllabus/batches", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.listBatches(req.caller!) });
  }));

  app.get("/api/syllabus/batches/:batchId", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.getBatchPlan(req.caller!, req.params.batchId) });
  }));

  app.put("/api/syllabus/batches/:batchId/plan", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.saveBatchPlan(req.caller!, req.params.batchId, req.body ?? {}) });
  }));

  app.put("/api/syllabus/batches/:batchId/schedule", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.saveSchedule(req.caller!, req.params.batchId, req.body ?? {}) });
  }));

  app.get("/api/syllabus/teach", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.teach(req.caller!) });
  }));

  app.put("/api/syllabus/lessons", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.saveLesson(req.caller!, req.body ?? {}) });
  }));

  app.get("/api/syllabus/my-class", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.myClass(req.caller!) });
  }));

  app.put("/api/syllabus/feedback", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.saveFeedback(req.caller!, req.body ?? {}) });
  }));

  app.get("/api/syllabus/progress", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.parentHome(req.caller!) });
  }));

  app.get("/api/syllabus/progress/:studentId", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.parentProgress(req.caller!, req.params.studentId) });
  }));

  app.get("/api/syllabus/dashboard", requireAuth, wrap(async (req, res, svc) => {
    res.json({
      success: true,
      data: await svc.dashboard(req.caller!, {
        course: queryText(req.query.course) || undefined,
        batchId: queryText(req.query.batchId) || undefined,
        facultyUid: queryText(req.query.facultyUid) || undefined,
        from: queryText(req.query.from) || undefined,
        to: queryText(req.query.to) || undefined,
      }),
    });
  }));

  app.post("/api/syllabus/parents/link", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.linkParent(req.caller!, req.body ?? {}) });
  }));

  app.post("/api/syllabus/parents/unlink", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.unlinkParent(req.caller!, req.body ?? {}) });
  }));

  app.post("/api/syllabus/students/enroll", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.enrollStudent(req.caller!, req.body ?? {}) });
  }));

  app.post("/api/syllabus/students/link", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.linkStudentLogin(req.caller!, req.body ?? {}) });
  }));

  app.post("/api/syllabus/students/unlink", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.unlinkStudentLogin(req.caller!, req.body ?? {}) });
  }));

  app.put("/api/syllabus/centre-heads/:uid/edit", requireAuth, wrap(async (req, res, svc) => {
    res.json({
      success: true,
      data: await svc.setCentreHeadEdit(req.caller!, req.params.uid, Boolean(req.body?.canEdit)),
    });
  }));

  app.get("/api/syllabus", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.listSyllabi(req.caller!) });
  }));

  app.post("/api/syllabus", requireAuth, wrap(async (req, res, svc) => {
    res.status(201).json({ success: true, data: await svc.createSyllabus(req.caller!, req.body ?? {}) });
  }));

  app.get("/api/syllabus/:id/feedback", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.courseFeedback(req.caller!, req.params.id) });
  }));

  app.get("/api/syllabus/:id", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.getSyllabus(req.caller!, req.params.id) });
  }));

  app.put("/api/syllabus/:id", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.updateSyllabus(req.caller!, req.params.id, req.body ?? {}) });
  }));

  app.delete("/api/syllabus/:id/versions/:version", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.deleteVersion(req.caller!, req.params.id, req.params.version) });
  }));

  app.delete("/api/syllabus/:id", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.deleteDraftSyllabus(req.caller!, req.params.id) });
  }));

  app.post("/api/syllabus/:id/publish", requireAuth, wrap(async (req, res, svc) => {
    res.json({ success: true, data: await svc.publishSyllabus(req.caller!, req.params.id, req.body ?? {}) });
  }));

  app.post("/api/syllabus/:id/import-pdf", requireAuth, fileBody, wrap(async (req, res, svc) => {
    const file = Buffer.isBuffer(req.body) ? req.body : null;
    if (!file) {
      res.status(400).json({ success: false, message: "Upload a PDF, Word, or Excel file." });
      return;
    }
    const fileName = typeof req.query.name === "string" ? req.query.name : "";
    res.json({ success: true, data: await svc.previewPdf(req.caller!, req.params.id, file, fileName) });
  }));
}

function fileBody(req: Request, res: Response, next: () => void) {
  express.raw({ type: () => true, limit: "8mb" })(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const tooLarge = typeof error === "object" && error !== null && "type" in error && (error as { type?: string }).type === "entity.too.large";
    res.status(400).json({
      success: false,
      message: tooLarge ? "Choose a file of 8 MB or less." : "Upload a PDF, Word, or Excel file.",
    });
  });
}

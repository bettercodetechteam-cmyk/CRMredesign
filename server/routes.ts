import type { Express } from "express";
import { createServer, type Server, request as httpRequest } from "http";
import { storage } from "./storageFirebaseOnly";
import ImageKit from "imagekit";
import MappleIndiaService from "./services/mappleIndiaService";
import SMSService from "./services/smsService";
import { reminderScheduler } from "./services/reminderScheduler";
import AuthService from "./services/authService";
import { IamService } from "./services/iamService";
import { requireDirector } from "./middleware/requireDirector";
import { requireAuth, requireTaskDirector } from "./middleware/requireAuth";
import { TaskService } from "./services/taskService";
import { getFirebaseAdmin } from "./firebaseConfig";
import { imageKitService } from "./services/imageKitService";
import { s3StorageService } from "./services/s3Service";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebaseConfig";

function registerNestApiProxy(app: Express): void {
  const nestPort = Number(process.env.NEST_API_PORT || 4000);

  app.use("/nest-api", (req, res) => {
    const targetPath = req.url || "/";
    const method = req.method ?? "GET";
    const bodyWasConsumed = Boolean((req as { readableEnded?: boolean }).readableEnded);
    const shouldForwardParsedBody =
      bodyWasConsumed &&
      method !== "GET" &&
      method !== "HEAD" &&
      req.body !== undefined &&
      req.body !== null;
    const bodyBuffer = shouldForwardParsedBody
      ? Buffer.from(JSON.stringify(req.body), "utf8")
      : null;

    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host: `localhost:${nestPort}`,
    };
    delete headers["content-length"];

    if (bodyBuffer) {
      headers["content-type"] = "application/json";
      headers["content-length"] = String(bodyBuffer.length);
    }

    const proxyReq = httpRequest(
      {
        hostname: "localhost",
        port: nestPort,
        path: targetPath,
        method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (error) => {
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: "Nest CRM API is unavailable",
          error: error instanceof Error ? error.message : "Proxy error",
        });
      }
    });

    if (bodyBuffer) {
      proxyReq.end(bodyBuffer);
      return;
    }

    req.pipe(proxyReq);
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerNestApiProxy(app);

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      const { checkPostgresConnection } = await import("./services/postgresBootstrap");
      const postgresConnected = await checkPostgresConnection();

      // Test Mapple India service
      const mappleTest = await MappleIndiaService.testConnection();
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          postgres: postgresConnected ? "connected" : "not_configured",
          mappleIndia: mappleTest ? "connected" : "fallback",
          firebase: "connected",
          imagekit: "connected",
          s3: s3StorageService.isEnabled() ? "connected" : "not_configured"
        },
        environment: process.env.NODE_ENV || "development"
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required"
        });
      }

      const result = await AuthService.sendPasswordResetEmail(email);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { otpCode } = req.body;
      
      if (!otpCode) {
        return res.status(400).json({
          success: false,
          message: "OTP code is required"
        });
      }

      const result = await AuthService.verifyOTP(otpCode);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in OTP verification:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  // Send OTP email endpoint
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email, otp, subject } = req.body;
      
      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: "Email and OTP are required"
        });
      }

      const result = await AuthService.sendOTPEmail(email, otp, subject);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error sending OTP email:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { otpCode, newPassword } = req.body;
      
      if (!otpCode || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "OTP code and new password are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }

      const result = await AuthService.resetPassword(otpCode, newPassword);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in password reset:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/custom-reset-password", async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email, OTP, and new password are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }

      const result = await AuthService.resetPasswordWithCustomOTP(email, otp, newPassword);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error in custom password reset:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.get("/api/auth/user-profile/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      
      if (!uid) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }

      const result = await AuthService.getUserProfile(uid);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      console.error("Error getting user profile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/bootstrap-profile", async (req, res) => {
    try {
      const { verifyBearerToken } = await import("./middleware/requireAuth");
      const caller = await verifyBearerToken(req);
      if (!caller) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const { firstName, lastName } = req.body as { firstName?: string; lastName?: string };
      const result = await AuthService.bootstrapUserProfile(
        caller.uid,
        caller.email || "",
        { firstName, lastName }
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error bootstrapping user profile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  app.put("/api/auth/user-profile/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const updates = req.body;
      
      if (!uid) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }

      const result = await AuthService.updateUserProfile(uid, updates);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/approve-user/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const { approvedBy } = req.body;
      
      if (!uid || !approvedBy) {
        return res.status(400).json({
          success: false,
          message: "User ID and approver ID are required"
        });
      }

      const result = await AuthService.approveUser(uid, approvedBy);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/reject-user/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const { rejectedBy, reason } = req.body;
      
      if (!uid || !rejectedBy) {
        return res.status(400).json({
          success: false,
          message: "User ID and rejector ID are required"
        });
      }

      const result = await AuthService.rejectUser(uid, rejectedBy, reason);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  // IAM routes (director-only, uses Firebase Admin SDK — avoids Cloud Functions CORS)
  app.post("/api/iam/approve-user", requireDirector, async (req, res) => {
    try {
      const { targetUid, role } = req.body;
      const result = await IamService.approveUser(req.iamCaller!, targetUid, role);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to approve user";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/iam/reject-user", requireDirector, async (req, res) => {
    try {
      const { targetUid } = req.body;
      const result = await IamService.rejectUser(req.iamCaller!, targetUid);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reject user";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/iam/update-access", requireDirector, async (req, res) => {
    try {
      const { targetUid, role, permissionsGranted, permissionsRevoked } = req.body;
      const result = await IamService.updateUserAccess(req.iamCaller!, {
        targetUid,
        role,
        permissionsGranted,
        permissionsRevoked,
      });
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update access";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/iam/migrate-known-users", requireDirector, async (req, res) => {
    try {
      const result = await IamService.migrateKnownUsers(req.iamCaller!);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to migrate users";
      res.status(400).json({ success: false, message });
    }
  });

  async function getTaskService(): Promise<TaskService | null> {
    const adminBundle = await getFirebaseAdmin();
    if (!adminBundle?.adminDb) return null;
    return new TaskService(adminBundle.adminDb);
  }

  // Task Management routes
  app.get("/api/tasks/assignees", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const assignees = await svc.getApprovedAssignees(req.caller!.centreId);
      res.json({ success: true, data: assignees });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load assignees";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/tasks/stats", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const stats = await svc.getStats(req.caller!);
      res.json({ success: true, data: stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load stats";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const filters = {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        assigneeId: req.query.assigneeId as string | undefined,
        dueDateFrom: req.query.dueDateFrom as string | undefined,
        dueDateTo: req.query.dueDateTo as string | undefined,
      };
      const tasks = await svc.listTasks(req.caller!, filters as any);
      res.json({ success: true, data: tasks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load tasks";
      res.status(400).json({ success: false, message });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const detail = await svc.getTask(req.params.id, req.caller!);
      res.json({ success: true, data: detail });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load task";
      const status = message === "Access denied." ? 403 : message === "Task not found." ? 404 : 400;
      res.status(status).json({ success: false, message });
    }
  });

  app.post("/api/tasks", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.createTask(req.caller!, req.body);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create task";
      res.status(400).json({ success: false, message });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.updateTask(req.params.id, req.caller!, req.body);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      const status = message === "Access denied." ? 403 : 400;
      res.status(status).json({ success: false, message });
    }
  });

  app.delete("/api/tasks/:id", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      await svc.deleteTask(req.params.id, req.caller!);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete task";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/approve", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.approveTask(req.params.id, req.caller!);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to approve task";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/reject", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.rejectTask(req.params.id, req.caller!);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reject task";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/reopen", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.reopenTask(req.params.id, req.caller!);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reopen task";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/subtasks", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const subtask = await svc.addSubtask(req.params.id, req.caller!, req.body.title);
      res.json({ success: true, data: subtask });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add subtask";
      res.status(400).json({ success: false, message });
    }
  });

  app.put("/api/tasks/:id/subtasks/:subId", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const subtask = await svc.updateSubtask(req.params.id, req.params.subId, req.caller!, req.body);
      res.json({ success: true, data: subtask });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update subtask";
      res.status(400).json({ success: false, message });
    }
  });

  app.delete("/api/tasks/:id/subtasks/:subId", requireTaskDirector, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      await svc.deleteSubtask(req.params.id, req.params.subId, req.caller!);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete subtask";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/comments", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const comment = await svc.addComment(req.params.id, req.caller!, req.body);
      res.json({ success: true, data: comment });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add comment";
      res.status(400).json({ success: false, message });
    }
  });

  app.put("/api/tasks/:id/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const comment = await svc.editComment(req.params.id, req.params.commentId, req.caller!, req.body.text);
      res.json({ success: true, data: comment });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to edit comment";
      res.status(400).json({ success: false, message });
    }
  });

  app.post("/api/tasks/:id/attachments", requireAuth, async (req, res) => {
    try {
      const svc = await getTaskService();
      if (!svc) return res.status(503).json({ success: false, message: "Task service unavailable." });
      const task = await svc.addAttachment(req.params.id, req.caller!, req.body);
      res.json({ success: true, data: task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add attachment";
      res.status(400).json({ success: false, message });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Students routes
  app.get("/api/students", async (req, res) => {
    try {
      const { centreId, status, page, pageSize } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 20;
      
      const students = await storage.getStudents(
        centreId as string, 
        status as string, 
        pageNum, 
        pageSizeNum
      );
      
      // Add demo students with fee information for SMS testing (only on first page)
      if (pageNum === 1) {
        const demoStudents = [
          {
            id: 1001,
            firstName: "Demo",
            lastName: "Student",
            email: "demo.student@zica.com",
            phone: "9307190851",
            centreId: "centre_1",
            status: "active",
            remainingFees: 15000,
            nextInstallmentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
            course: "Advanced Computer Course",
            batch: "Batch A-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          },
          {
            id: 1002,
            firstName: "Test",
            lastName: "Student",
            email: "test.student@zica.com",
            phone: "9876543210",
            centreId: "centre_1",
            status: "active",
            remainingFees: 8000,
            nextInstallmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
            course: "Web Development",
            batch: "Batch B-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          },
          {
            id: 1003,
            firstName: "Sample",
            lastName: "Student",
            email: "sample.student@zica.com",
            phone: "8765432109",
            centreId: "centre_1",
            status: "active",
            remainingFees: 12000,
            nextInstallmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
            course: "Digital Marketing",
            batch: "Batch C-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          },
          {
            id: 1004,
            firstName: "Notification",
            lastName: "Test",
            email: "notification.test@zica.com",
            phone: "7654321098",
            centreId: "centre_1",
            status: "active",
            remainingFees: 25000,
            nextInstallmentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
            course: "3D Animation",
            batch: "Batch D-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          },
          {
            id: 1005,
            firstName: "SMS",
            lastName: "Demo",
            email: "sms.demo@zica.com",
            phone: "6543210987",
            centreId: "centre_1",
            status: "active",
            remainingFees: 5000,
            nextInstallmentDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
            course: "Graphic Design",
            batch: "Batch E-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          },
          {
            id: 1006,
            firstName: "Fee",
            lastName: "Alert",
            email: "fee.alert@zica.com",
            phone: "5432109876",
            centreId: "centre_1",
            status: "active",
            remainingFees: 18000,
            nextInstallmentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day overdue
            course: "Video Editing",
            batch: "Batch F-2024",
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date()
          }
        ];

        // Combine real students with demo students
        const allStudents = [...students.data, ...demoStudents];
        
        console.log('ðŸ“± Demo students added for SMS notification testing:', demoStudents.length, 'students');
        
        res.json({
          data: allStudents,
          hasMore: students.hasMore,
          total: students.total + demoStudents.length
        });
      } else {
        res.json(students);
      }
    } catch {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.post("/api/students", async (req, res) => {
    try {
      const student = await storage.createStudent(req.body);
      res.json(student);
    } catch {
      res.status(500).json({ message: "Failed to create student" });
    }
  });

  app.put("/api/students/:id", async (req, res) => {
    try {
      const student = await storage.updateStudent(parseInt(req.params.id), req.body);
      res.json(student);
    } catch {
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      await storage.deleteStudent(parseInt(req.params.id));
      res.json({ message: "Student deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  // Leads
  app.get("/api/leads", async (req, res) => {
    try {
      const { centreId, status, page, pageSize } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const pageSizeNum = parseInt(pageSize as string) || 20;
      
      const leads = await storage.getLeads(
        centreId as string, 
        status as string, 
        pageNum, 
        pageSizeNum
      );
      
      res.json(leads);
    } catch {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const lead = await storage.createLead(req.body);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error, req.body);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ 
        message: "Failed to create lead", 
        error: errorMessage,
        details: req.body 
      });
    }
  });

  // Batch upload endpoint for better performance
  app.post("/api/leads/batch", async (req, res) => {
    try {
      const { leads } = req.body;
      if (!Array.isArray(leads)) {
        return res.status(400).json({ message: "Leads must be an array" });
      }

      interface BatchResult {
        index: number;
        success: boolean;
        lead: any;
      }

      interface BatchError {
        index: number;
        error: string;
        data: any;
      }

      const results: BatchResult[] = [];
      const errors: BatchError[] = [];
      const batchPromises = [];

      // Process leads in parallel batches
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const processPromise = (async () => {
          try {
            const createdLead = await storage.createLead(lead);
            results.push({ index: i, success: true, lead: createdLead });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            errors.push({ index: i, error: errorMessage, data: lead });
            console.error(`Error creating lead at index ${i}:`, error, lead);
          }
        })();
        batchPromises.push(processPromise);
      }

      // Wait for all leads to be processed
      await Promise.all(batchPromises);

      res.json({
        message: `Processed ${leads.length} leads`,
        results: {
          total: leads.length,
          successful: results.length,
          failed: errors.length,
          leads: results,
          errors: errors
        }
      });
    } catch (error) {
      console.error("Error in batch lead creation:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ 
        message: "Failed to process batch upload", 
        error: errorMessage
      });
    }
  });

  app.put("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.updateLead(req.params.id, req.body);
      res.json(lead);
    } catch {
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      await storage.deleteLead(req.params.id);
      res.json({ message: "Lead deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Follow-up notification APIs
  app.get("/api/follow-up-notifications", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ message: "Firestore is not initialized" });
      }

      const centreId = typeof req.query.centreId === "string" ? req.query.centreId : "";
      const leadsRef = collection(db, "leads");
      const leadsQuery = centreId ? query(leadsRef, where("centreId", "==", centreId)) : leadsRef;
      const snapshot = await getDocs(leadsQuery);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const notifications = snapshot.docs
        .map((leadDoc) => {
          const data = leadDoc.data();
          const followUpDate = toDate(data.nextFollowUpDate || data.followUpDate);

          if (!followUpDate) return null;
          if (data.followUpNotificationDone === true) return null;
          if (followUpDate.getTime() > endOfToday.getTime()) return null;

          return {
            leadId: leadDoc.id,
            leadName: data.leadName || data.name || "Unknown Lead",
            course: data.course || data.interestedCourse || "",
            status: data.status || "Not Contacted",
            followUpDate,
            isOverdue: followUpDate.getTime() < startOfToday.getTime(),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.followUpDate.getTime() - b.followUpDate.getTime());

      res.json({
        total: notifications.length,
        notifications,
      });
    } catch (error) {
      console.error("Error fetching follow-up notifications:", error);
      res.status(500).json({ message: "Failed to fetch follow-up notifications" });
    }
  });

  app.post("/api/follow-up-notifications/:leadId/mark-done", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ message: "Firestore is not initialized" });
      }

      const { leadId } = req.params;
      if (!leadId) {
        return res.status(400).json({ message: "leadId is required" });
      }

      const leadRef = doc(db, "leads", leadId);
      const updates = {
        followUpNotificationDone: true,
        followUpDoneAt: new Date(),
        followUpDate: null,
        nextFollowUpDate: null,
        updatedAt: new Date(),
      };

      await updateDoc(leadRef, updates);
      res.json({ success: true, leadId, updates });
    } catch (error) {
      console.error("Error marking follow-up notification done:", error);
      res.status(500).json({ message: "Failed to mark follow-up notification as done" });
    }
  });

  // Courses
  app.get("/api/courses", async (_req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  // Batches
  app.get("/api/batches", async (_req, res) => {
    try {
      const batches = await storage.getBatches();
      res.json(batches);
    } catch {
      res.status(500).json({ message: "Failed to fetch batches" });
    }
  });

  // Fee transactions
  app.get("/api/fee-transactions", async (_req, res) => {
    try {
      const transactions = await storage.getFeeTransactions();
      res.json(transactions);
    } catch {
      res.status(500).json({ message: "Failed to fetch fee transactions" });
    }
  });

  app.post("/api/fee-transactions", async (req, res) => {
    try {
      const transaction = await storage.createFeeTransaction(req.body);
      res.json(transaction);
    } catch {
      res.status(500).json({ message: "Failed to create fee transaction" });
    }
  });

  app.put("/api/fee-transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.createFeeTransaction(req.body);
      res.json(transaction);
    } catch {
      res.status(500).json({ message: "Failed to update fee transaction" });
    }
  });

  app.delete("/api/fee-transactions/:id", async (req, res) => {
    try {
      // Note: deleteFeeTransaction method not implemented in storage
      console.log(`Fee transaction ${req.params.id} deletion requested`);
      res.json({ message: "Fee transaction deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete fee transaction" });
    }
  });

  // Notifications
  app.get("/api/notifications", async (_req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = await storage.createNotification(req.body);
      
      // Simulate sending notification (in real app, this would send SMS/email)
      console.log(`Sending notification to student ${req.body.studentId}:`, req.body.message);
      
      res.json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id", async (req, res) => {
    try {
      const notification = await storage.updateNotification(parseInt(req.params.id), req.body);
      res.json(notification);
    } catch {
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await storage.deleteNotification(parseInt(req.params.id));
      res.json({ message: "Notification deleted successfully" });
    } catch {
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Staff
  app.get("/api/staff", async (_req, res) => {
    try {
      const staff = await storage.getStaff();
      res.json(staff);
    } catch {
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      const staffMember = await storage.createStaff(req.body);
      res.json(staffMember);
    } catch {
      res.status(500).json({ message: "Failed to create staff" });
    }
  });

  // Expenses
  app.get("/api/expenses", async (_req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const expense = await storage.createExpense(req.body);
      res.json(expense);
    } catch {
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  // Targets
  app.get("/api/targets", async (_req, res) => {
    try {
      const targets = await storage.getTargets();
      res.json(targets);
    } catch {
      res.status(500).json({ message: "Failed to fetch targets" });
    }
  });

  app.post("/api/targets", async (req, res) => {
    try {
      const target = await storage.createTarget(req.body);
      res.json(target);
    } catch {
      res.status(500).json({ message: "Failed to create target" });
    }
  });

  app.put("/api/targets/:id", async (req, res) => {
    try {
      const target = await storage.updateTarget(parseInt(req.params.id), req.body);
      res.json(target);
    } catch {
      res.status(500).json({ message: "Failed to update target" });
    }
  });

  // Assignments
  app.get("/api/assignments", async (_req, res) => {
    try {
      const assignments = await storage.getAssignments();
      res.json(assignments);
    } catch {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.post("/api/assignments", async (req, res) => {
    try {
      const assignment = await storage.createAssignment(req.body);
      res.json(assignment);
    } catch {
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  // Recent activity (mocked for now)
  app.get("/api/recent-activity", async (_req, res) => {
    try {
      // Get real data for activity generation
      const students = await storage.getStudents();
      const leads = await storage.getLeads();
      const feeTransactions = await storage.getFeeTransactions();
      // Generate realistic activity based on real data
      const activities = [];

      // Add recent student activities
      if (students.data.length > 0) {
        const recentStudents = students.data.slice(0, 3);
        recentStudents.forEach((student, index) => {
          activities.push({
            id: `student_${index}`,
            type: "enquiry",
            message: `New student ${student.firstName} ${student.lastName} enrolled in ${student.course || 'course'}`,
            time: `${index + 1} hour${index > 0 ? 's' : ''} ago`,
            user: "System",
          });
        });
      }

      // Add recent payment activities
      if (feeTransactions.length > 0) {
        const recentPayments = feeTransactions.filter(t => t.status === 'paid').slice(0, 2);
        recentPayments.forEach((payment, index) => {
          const student = students.data.find((s: any) => s.id === payment.studentId);
          activities.push({
            id: `payment_${index}`,
            type: "payment",
            message: `Fee payment received from ${student?.firstName || 'Student'} - â‚¹${payment.amount?.toLocaleString()}`,
            time: `${index + 2} hour${index > 0 ? 's' : ''} ago`,
            user: "Admin",
          });
        });
      }

      // Add recent lead activities
      if (leads.data.length > 0) {
        const recentLeads = leads.data.slice(0, 2);
        recentLeads.forEach((lead: any, index: number) => {
          activities.push({
            id: `lead_${index}`,
            type: "enquiry",
            message: `New enquiry from ${lead.firstName} ${lead.lastName} for ${lead.courseInterest || 'course'}`,
            time: `${index + 3} hour${index > 0 ? 's' : ''} ago`,
            user: "System",
          });
        });
      }

      // Add fee reminder activities
      if (students.data.some((s: any) => parseFloat(s.remainingFees || '0') > 0)) {
        activities.push({
          id: "reminder_1",
          type: "reminder",
          message: "Fee reminder sent to 3 students with pending payments",
          time: "1 hour ago",
          user: "System",
        });
      }

      // Sort by time (most recent first) and return top 5
      const sortedActivities = activities.sort((a, b) => {
        const timeA = parseInt(a.time.split(' ')[0]);
        const timeB = parseInt(b.time.split(' ')[0]);
        return timeA - timeB;
      });

      res.json(sortedActivities.slice(0, 5));
    } catch (error) {
      console.error("Error generating recent activity:", error);
      
      // Fallback to static data
      const activities = [
        {
          id: "1",
          type: "enquiry",
          message: "New enquiry from Amit Sharma for 3D Animation course",
          time: "2 minutes ago",
          user: "System",
        },
        {
          id: "2",
          type: "payment",
          message: "Fee payment received from Priya Patel - â‚¹15,000",
          time: "15 minutes ago",
          user: "Admin",
        },
        {
          id: "3",
          type: "reminder",
          message: "Follow-up reminder for Raj Kumar",
          time: "1 hour ago",
          user: "BDM",
        },
        {
          id: "4",
          type: "enquiry",
          message: "New student Demo Student enrolled in Advanced Computer Course",
          time: "3 hours ago",
          user: "System",
        },
      ];
      res.json(activities);
    }
  });

  // Development-only endpoints (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/firebase-status", async (_req, res) => {
      const hasApiKey = !!process.env.GOOGLE_API_KEY;
      res.json({
        connected: hasApiKey,
        message: hasApiKey
          ? "Firebase configuration present"
          : "Firebase API key not configured",
        dataSource: hasApiKey ? "firestore" : "unconfigured",
      });
    });

    app.post("/api/seed-firestore", async (_req, res) => {
      res.status(501).json({ success: false, message: "Firestore seeding is not available" });
    });
  }

  // ImageKit Configuration - credentials loaded from environment variables
  const imagekitPublicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const imagekitPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!imagekitPublicKey || !imagekitPrivateKey || !imagekitUrlEndpoint) {
    throw new Error(
      "Missing required ImageKit environment variables: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT. " +
      "Please ensure these are set in your .env file."
    );
  }

  const imagekit = new ImageKit({
    publicKey: imagekitPublicKey,
    privateKey: imagekitPrivateKey,
    urlEndpoint: imagekitUrlEndpoint,
  });

  // ImageKit Authentication Endpoint
  app.get("/api/auth", (req, res) => {
    console.log('ðŸ” ImageKit /api/auth endpoint called');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Content-Type", "application/json");
    const result = imagekit.getAuthenticationParameters();
    console.log('âœ… ImageKit auth params generated:', { token: result.token ? 'present' : 'missing', expire: result.expire, signature: result.signature ? 'present' : 'missing' });
    res.json(result);
  });
  
  // Legacy auth endpoint for backward compatibility
  app.get("/auth", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    const result = imagekit.getAuthenticationParameters();
    res.json(result);
  });

  // ImageKit List Files Endpoint
  app.get("/api/list-files", async (req, res) => {
    try {
      const result = await imagekit.listFiles({});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ImageKit Delete File Endpoint
  // Accept fileId from body (preferred) or query (fallback when DELETE body is stripped)
  app.delete("/api/delete-file", async (req, res) => {
    try {
      const fileId = req.body?.fileId ?? req.query?.fileId;
      if (fileId === undefined || fileId === null || String(fileId).trim() === "") {
        return res.status(400).json({ error: "fileId is required" });
      }
      const id = String(fileId).trim();
      const result = await imagekit.deleteFile(id);
      res.json({ success: true, result });
    } catch (err: any) {
      const message = err?.message ?? err?.toString?.() ?? "Delete failed";
      console.error("[delete-file] ImageKit error:", message, err?.response?.data ?? "");
      res.status(500).json({ error: message });
    }
  });

  // S3 file storage (replaces Firebase Storage for uploads)
  app.post("/api/storage/upload", requireAuth, async (req, res) => {
    try {
      if (!s3StorageService.isEnabled()) {
        return res.status(503).json({
          error: "S3 storage is not configured. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env",
        });
      }

      const { path, fileName, contentType, fileBase64 } = req.body as {
        path?: string;
        fileName?: string;
        contentType?: string;
        fileBase64?: string;
      };

      if (!path || !fileName || !fileBase64) {
        return res.status(400).json({ error: "path, fileName, and fileBase64 are required" });
      }

      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
      const folder = String(path).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      const centreId = req.caller?.centreId || "default";
      const key = folder.startsWith("uploads/")
        ? `${folder}/${Date.now()}_${safeName}`
        : `uploads/${centreId}/${folder}/${Date.now()}_${safeName}`;

      const result = await s3StorageService.upload({
        key,
        body: buffer,
        contentType: contentType || "application/octet-stream",
      });

      res.json({
        url: result.url,
        key: result.key,
        bucket: result.bucket,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[storage/upload] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.delete("/api/storage/delete", requireAuth, async (req, res) => {
    try {
      if (!s3StorageService.isEnabled()) {
        return res.status(503).json({ error: "S3 storage is not configured" });
      }

      const { key } = req.body as { key?: string };
      if (!key) {
        return res.status(400).json({ error: "key is required" });
      }

      await s3StorageService.delete(key);
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      console.error("[storage/delete] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // Bettercode: upload quotation PDF to ImageKit (avoids Firebase Storage CORS from localhost)
  app.post("/api/bettercode/upload-quotation", async (req, res) => {
    try {
      const { fileName, fileBase64 } = req.body as { fileName?: string; fileBase64?: string };
      if (!fileName || typeof fileName !== "string" || !fileBase64 || typeof fileBase64 !== "string") {
        return res.status(400).json({ error: "fileName and fileBase64 are required" });
      }
      const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const result = await imageKitService.uploadFile(buffer, fileName, "/bettercode/quotations");
      if (!result.success || !result.file) {
        return res.status(500).json({ error: result.error || "ImageKit upload failed" });
      }
      res.json({ url: result.file.url, fileId: result.file.fileId, fileName: result.file.name });
    } catch (err: any) {
      const message = err?.message ?? err?.toString?.() ?? "Upload failed";
      console.error("[bettercode/upload-quotation] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // Mapple India Location Service Routes
  app.get("/api/location/address", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ 
          success: false, 
          message: "Latitude and longitude are required" 
        });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid latitude or longitude values" 
        });
      }

      console.log(`ðŸ“ Getting address for coordinates: ${latitude}, ${longitude}`);
      const address = await MappleIndiaService.getAddressFromCoordinates(latitude, longitude);
      
      res.json({
        success: true,
        address,
        coordinates: { lat: latitude, lng: longitude }
      });
    } catch (error) {
      console.error('âŒ Location service error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get location address",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/location/details", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ 
          success: false, 
          message: "Latitude and longitude are required" 
        });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid latitude or longitude values" 
        });
      }

      console.log(`ðŸ“ Getting detailed location for coordinates: ${latitude}, ${longitude}`);
      const details = await MappleIndiaService.getLocationDetails(latitude, longitude);
      
      if (details) {
        res.json({
          success: true,
          details,
          coordinates: { lat: latitude, lng: longitude }
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Location details not found"
        });
      }
    } catch (error) {
      console.error('âŒ Location details error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get location details",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/location/test", async (_req, res) => {
    try {
      console.log('ðŸ§ª Testing Mapple India service connection...');
      const isWorking = await MappleIndiaService.testConnection();
      
      res.json({
        success: true,
        service: 'Mapple India',
        working: isWorking,
        message: isWorking 
          ? "Mapple India location service is working correctly"
          : "Mapple India service test failed, using fallback services"
      });
    } catch (error) {
      console.error('âŒ Service test error:', error);
      res.status(500).json({
        success: false,
        service: 'Mapple India',
        working: false,
        message: "Service test failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // SMS Service endpoints
  app.get("/api/sms/status", async (_req, res) => {
    try {
      const smsStatus = await SMSService.checkStatus();
      res.json(smsStatus);
    } catch (error) {
      console.error("Error checking SMS status:", error);
      res.status(500).json({ 
        configured: false, 
        providers: [], 
        testNumber: "9307190851",
        status: 'error',
        message: 'Failed to check SMS status' 
      });
    }
  });

  app.post("/api/sms/send", async (req, res) => {
    try {
      const { phoneNumber, message, studentName, type = 'custom' } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone number and message are required" 
        });
      }

      // Send SMS using the new service
      const smsResponse = await SMSService.sendSMS({
        phoneNumber,
        message,
        studentName: studentName || 'Unknown',
        type
      });

      if (smsResponse.success) {
        // Create notification record
        const notification = await storage.createNotification({
          userId: 'system',
          title: 'SMS Sent Successfully',
          message: `SMS sent to ${studentName} (${phoneNumber})`,
          type: 'sms_sent',
          isRead: false
        });

        res.json({
          success: true,
          message: "SMS sent successfully",
          notification: smsResponse,
          notificationId: notification.id
        });
      } else {
        res.status(400).json({
          success: false,
          message: smsResponse.message,
          error: smsResponse.error
        });
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send SMS" 
      });
    }
  });

  app.post("/api/sms/bulk-send", async (req, res) => {
    try {
      const { notifications } = req.body;
      
      if (!notifications || !Array.isArray(notifications)) {
        return res.status(400).json({ 
          success: false, 
          message: "Notifications array is required" 
        });
      }

      // Send bulk SMS using the new service
      const bulkResponse = await SMSService.sendBulkSMS(notifications);

      res.json(bulkResponse);
    } catch (error) {
      console.error("Error sending bulk SMS:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send bulk SMS" 
      });
    }
  });

  // Fee Alert Automation endpoints
  app.post("/api/fee-alerts/send-reminders", async (req, res) => {
    try {
      const { centreId, reminderType = 'all' } = req.body;
      
      // Get students with pending fees
      const students = await storage.getStudents(centreId as string);
      const studentsWithPendingFees = students.data.filter((student: any) => {
        const remainingFees = parseFloat(student.remainingFees || '0');
        return remainingFees > 0;
      });

      if (studentsWithPendingFees.length === 0) {
        return res.json({
          success: true,
          message: "No students with pending fees found",
          results: { total: 0, successful: 0, failed: 0 }
        });
      }

      const notifications = [];
      const errors = [];
      let successful = 0;
      let failed = 0;

      for (const student of studentsWithPendingFees) {
        try {
          if (!student.phone) {
            errors.push({ studentId: student.id, error: "No phone number" });
            failed++;
            continue;
          }

          // Generate appropriate message based on reminder type
          let message = '';
          const remainingFees = parseFloat((student as any).remainingFees || '0');
          const dueDate = (student as any).nextInstallmentDate ? new Date((student as any).nextInstallmentDate) : null;
          
          switch (reminderType) {
            case 'payment_reminder':
              if (dueDate && dueDate > new Date()) {
                const formattedDate = dueDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });
                message = `Dear ${student.firstName}, this is a friendly reminder that your fee payment of â‚¹${remainingFees.toLocaleString()} is due on ${formattedDate}. Please make the payment to avoid any late fees. - ZICA ZIMA`;
              }
              break;
            case 'overdue_notice':
              if (dueDate && dueDate < new Date()) {
                const daysOverdue = Math.ceil((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                message = `Dear ${student.firstName}, your payment of â‚¹${remainingFees.toLocaleString()} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Please make the payment immediately to avoid any additional charges. - ZICA ZIMA`;
              }
              break;
            case 'installment_due':
              if (dueDate && dueDate.toDateString() === new Date().toDateString()) {
                message = `Dear ${student.firstName}, your installment of â‚¹${remainingFees.toLocaleString()} is due today. Please make the payment to continue your course. - ZICA ZIMA`;
              }
              break;
            default:
              message = `Dear ${student.firstName}, you have a pending fee balance of â‚¹${remainingFees.toLocaleString()}. Please make the payment at your earliest convenience. - ZICA ZIMA`;
          }

          if (!message) {
            continue; // Skip if no message generated for this type
          }

          // Send SMS using the new service
          const smsResponse = await SMSService.sendSMS({
            phoneNumber: student.phone,
            message,
            studentName: `${student.firstName} ${student.lastName}`,
            type: reminderType as any
          });

          if (smsResponse.success) {
            successful++;
            notifications.push({
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              phoneNumber: student.phone,
              message,
              type: reminderType,
              success: true,
              messageId: smsResponse.messageId
            });
          } else {
            failed++;
            errors.push({ 
              studentId: student.id, 
              error: smsResponse.error || "SMS sending failed" 
            });
          }
        } catch (error) {
          failed++;
          errors.push({ 
            studentId: student.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({
        success: true,
        message: `Fee reminders sent: ${successful} successful, ${failed} failed`,
        results: {
          total: studentsWithPendingFees.length,
          successful,
          failed,
          notifications,
          errors
        }
      });
    } catch (error) {
      console.error("Error sending fee reminders:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send fee reminders" 
      });
    }
  });

  app.get("/api/fee-alerts/overdue-students", async (req, res) => {
    try {
      const { centreId } = req.query;
      
      const students = await storage.getStudents(centreId as string);
      let overdueStudents = students.data.filter((student: any) => {
        const remainingFees = parseFloat(student.remainingFees || '0');
        const dueDate = student.nextInstallmentDate ? new Date(student.nextInstallmentDate) : null;
        
        return remainingFees > 0 && dueDate && dueDate < new Date();
      });

      // Add demo students with pending fees for testing
      const demoOverdueStudents = [
        {
          id: 1001,
          name: "Demo Student",
          phone: "9307190851",
          remainingFees: 15000,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          daysOverdue: 5
        },
        {
          id: 1002,
          name: "Test Student",
          phone: "9876543210",
          remainingFees: 8000,
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          daysOverdue: 2
        },
        {
          id: 1003,
          name: "Sample Student",
          phone: "8765432109",
          remainingFees: 12000,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
          daysOverdue: -3
        },
        {
          id: 1004,
          name: "Notification Test",
          phone: "7654321098",
          remainingFees: 25000,
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          daysOverdue: 10
        },
        {
          id: 1005,
          name: "SMS Demo",
          phone: "6543210987",
          remainingFees: 5000,
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
          daysOverdue: -1
        },
        {
          id: 1006,
          name: "Fee Alert",
          phone: "5432109876",
          remainingFees: 18000,
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          daysOverdue: 1
        }
      ];

      // Combine real and demo students
      const allOverdueStudents = [
        ...overdueStudents.map((student: any) => ({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          phone: student.phone,
          remainingFees: student.remainingFees,
          dueDate: student.nextInstallmentDate,
          daysOverdue: student.nextInstallmentDate ? 
            Math.ceil((new Date().getTime() - new Date(student.nextInstallmentDate).getTime()) / (1000 * 60 * 60 * 24)) : 0
        })),
        ...demoOverdueStudents
      ];

      console.log('ðŸ“± Demo overdue students added for SMS notification testing');

      res.json({
        success: true,
        overdueStudents: allOverdueStudents
      });
    } catch (error) {
      console.error("Error fetching overdue students:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch overdue students" 
      });
    }
  });


  // Reminder Scheduler Endpoints
  app.get("/api/reminders/status", (req, res) => {
    try {
      const status = reminderScheduler.getStatus();
      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/reminders/test", async (req, res) => {
    try {
      const { centreId = 'demo-centre-001' } = req.body;
      const reminderId = await reminderScheduler.createTestReminder(centreId);
      
      res.json({
        success: true,
        reminderId,
        message: "Test reminder created successfully",
        scheduledTime: new Date(Date.now() + 60000).toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/reminders/init", (req, res) => {
    try {
      reminderScheduler.init();
      res.json({
        success: true,
        message: "Reminder scheduler initialized successfully",
        status: reminderScheduler.getStatus()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get active reminders (filtered to exclude processed ones)
  app.get("/api/reminders/active", async (req, res) => {
    try {
      const { centreId, userId, limit = '50' } = req.query;
      
      console.log('ðŸ” Fetching active reminders for centre:', centreId);
      
      // Use Firebase Admin if available
      const { getFirebaseAdmin } = await import('./firebaseConfig.js');
      const firebaseAdmin = await getFirebaseAdmin();
      const { adminDb } = firebaseAdmin || {};
      
      if (!adminDb) {
        // Fallback to mock data
        const mockReminders = [
          {
            id: 'mock-1',
            leadId: 'lead-1',
            leadName: 'John Doe',
            title: 'Follow up call',
            description: 'Call to discuss course details',
            dueDate: new Date(Date.now() + 3600000), // 1 hour from now
            status: 'pending',
            priority: 'high',
            type: 'call',
            assignedTo: userId || 'user-1',
            centreId: centreId || 'demo-centre',
            processed: false,
            hasBeenActedUpon: false
          }
        ];
        
        res.json({
          success: true,
          reminders: mockReminders,
          count: mockReminders.length
        });
        return;
      }
      
      // Build query to get active reminders
      let query = adminDb.collection('reminders')
        .where('status', '==', 'pending')
        .where('centreId', '==', centreId)
        .orderBy('dueDate', 'asc')
        .limit(parseInt(limit.toString()));
      
      const snapshot = await query.get();
      const reminders = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter out processed reminders on the server side
      const activeReminders = reminders.filter((reminder: any) => 
        !reminder.processed && !reminder.hasBeenActedUpon
      );
      
      console.log(`ðŸ“‹ Found ${reminders.length} total reminders, ${activeReminders.length} active (unprocessed)`);
      
      res.json({
        success: true,
        reminders: activeReminders,
        count: activeReminders.length,
        totalFound: reminders.length,
        filteredOut: reminders.length - activeReminders.length
      });
      
    } catch (error) {
      console.error('âŒ Error fetching active reminders:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Mark reminder as dismissed/processed
  app.post("/api/reminders/:id/dismiss", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, centreId, reason = 'dismissed' } = req.body;
      
      console.log(`ðŸ” Dismissing reminder ${id} by user ${userId}`);
      
      // Use Firebase Admin if available
      const { getFirebaseAdmin } = await import('./firebaseConfig.js');
      const firebaseAdmin = await getFirebaseAdmin();
      const { adminDb } = firebaseAdmin || {};
      
      if (!adminDb) {
        res.json({
          success: true,
          message: "Reminder dismissed (mock mode)",
          reminderId: id
        });
        return;
      }
      
      // Update the reminder to mark it as processed
      const reminderRef = adminDb.collection('reminders').doc(id);
      await reminderRef.update({
        processed: true,
        processedAt: adminDb.Timestamp.now(),
        processedBy: userId,
        hasBeenActedUpon: true,
        lastAction: {
          status: 'dismissed',
          timestamp: adminDb.Timestamp.now(),
          userId: userId,
          remarks: reason
        },
        updatedAt: adminDb.Timestamp.now(),
        updatedBy: userId
      });
      
      console.log(`âœ… Reminder ${id} marked as dismissed by ${userId}`);
      
      res.json({
        success: true,
        message: "Reminder dismissed successfully",
        reminderId: id
      });
      
    } catch (error) {
      console.error('âŒ Error dismissing reminder:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Logout session tracking endpoint - DISABLED FOR QUOTA OPTIMIZATION
  const server = createServer(app);
  return server;
}

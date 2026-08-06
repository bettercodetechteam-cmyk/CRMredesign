import type { Firestore } from "firebase-admin/firestore";
import type { AuthCaller } from "../middleware/requireAuth";
import {
  type Task,
  type TaskSubtask,
  type TaskComment,
  type TaskActivity,
  type TaskStats,
  type TaskFilters,
  type TaskStatus,
  type TaskPriority,
  type TaskAttachment,
  type TaskActivityAction,
  canTransitionStatus,
  computeOverdueStatus,
  validateTaskDates,
} from "../../shared/taskTypes";

type AdminDb = Firestore;

function toIso(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function callerName(caller: AuthCaller): string {
  const parts = [caller.firstName, caller.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : caller.email ?? "User";
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  const status = computeOverdueStatus(
    (data.status as TaskStatus) || "pending",
    toIso(data.dueDate)
  );
  return {
    id,
    centreId: (data.centreId as string) || "",
    title: (data.title as string) || "",
    description: data.description as string | undefined,
    assignedBy: (data.assignedBy as string) || "",
    assignedByName: data.assignedByName as string | undefined,
    assignedTo: (data.assignedTo as string[]) || [],
    assignedToEmails: data.assignedToEmails as string[] | undefined,
    assignedToNames: data.assignedToNames as string[] | undefined,
    priority: (data.priority as TaskPriority) || "medium",
    status,
    startDate: toIso(data.startDate),
    dueDate: toIso(data.dueDate),
    completionDate: toIso(data.completionDate),
    estimatedHours: data.estimatedHours as number | undefined,
    actualHours: data.actualHours as number | undefined,
    progressPercent: (data.progressPercent as number) ?? 0,
    parentTaskId: (data.parentTaskId as string | null) ?? null,
    attachmentUrls: (data.attachmentUrls as TaskAttachment[]) || [],
    createdAt: toIso(data.createdAt) || new Date().toISOString(),
    updatedAt: toIso(data.updatedAt) || new Date().toISOString(),
  };
}

export class TaskService {
  constructor(private db: AdminDb) {}

  private tasksCol() {
    return this.db.collection("tasks");
  }

  private async logActivity(
    taskId: string,
    caller: AuthCaller,
    action: TaskActivityAction,
    metadata?: Record<string, unknown>
  ) {
    const admin = await import("firebase-admin");
    await this.tasksCol().doc(taskId).collection("activity").add({
      userId: caller.id,
      userName: callerName(caller),
      action,
      metadata: metadata ?? {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  private async notify(
    userId: string,
    centreId: string,
    title: string,
    message: string,
    taskId: string,
    priority: "low" | "medium" | "high" | "urgent" = "medium"
  ) {
    const admin = await import("firebase-admin");
    await this.db.collection("notifications").add({
      userId,
      centreId,
      type: "task",
      title,
      message,
      isRead: false,
      priority,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { taskId },
    });
  }

  private isAssignee(task: Task, uid: string): boolean {
    return task.assignedTo.includes(uid);
  }

  private canRead(task: Task, caller: AuthCaller): boolean {
    return caller.isDirector || this.isAssignee(task, caller.id);
  }

  async getApprovedAssignees(centreId?: string) {
    const snap = await this.db.collection("users").where("approved", "==", true).get();
    return snap.docs
      .map((d) => {
        const data = d.data();
        const role = String(data.role ?? "").toLowerCase();
        if (role === "pending") return null;
        return {
          id: d.id,
          email: data.email as string,
          firstName: data.firstName as string,
          lastName: data.lastName as string,
          role: data.role as string,
          centreId: data.centreId as string,
        };
      })
      .filter(Boolean)
      .filter((u) => !centreId || !u!.centreId || u!.centreId === centreId) as {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      role: string;
      centreId?: string;
    }[];
  }

  private async resolveAssigneeDetails(assigneeIds: string[]) {
    const unique = [...new Set(assigneeIds.filter(Boolean))];
    const emails: string[] = [];
    const names: string[] = [];
    for (const uid of unique) {
      const snap = await this.db.collection("users").doc(uid).get();
      if (!snap.exists) continue;
      const data = snap.data()!;
      if (!data.approved) {
        throw new Error(`User ${uid} is not approved.`);
      }
      if (String(data.role).toLowerCase() === "pending") {
        throw new Error(`User ${uid} has pending role.`);
      }
      emails.push((data.email as string) || "");
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || (data.email as string);
      names.push(name);
    }
    return { assignedTo: unique, assignedToEmails: emails, assignedToNames: names };
  }

  private applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
    let result = [...tasks];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
      );
    }
    if (filters.status && filters.status !== "all") {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.priority && filters.priority !== "all") {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters.assigneeId) {
      result = result.filter((t) => t.assignedTo.includes(filters.assigneeId!));
    }
    if (filters.dueDateFrom) {
      const from = new Date(filters.dueDateFrom);
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= from);
    }
    if (filters.dueDateTo) {
      const to = new Date(filters.dueDateTo);
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) <= to);
    }
    return result;
  }

  async listTasks(caller: AuthCaller, filters: TaskFilters = {}): Promise<Task[]> {
    const centreId = caller.centreId || "default";
    let snap;
    if (caller.isDirector) {
      snap = await this.tasksCol().where("centreId", "==", centreId).get();
    } else {
      snap = await this.tasksCol()
        .where("centreId", "==", centreId)
        .where("assignedTo", "array-contains", caller.id)
        .get();
    }
    const tasks = snap.docs.map((d) => mapTask(d.id, d.data() as Record<string, unknown>));
    return this.applyFilters(tasks, filters).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  computeStats(tasks: Task[]): TaskStats {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      completedPendingApproval: tasks.filter((t) => t.status === "completed_pending_approval").length,
      onHold: tasks.filter((t) => t.status === "on_hold").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
    };
  }

  async getStats(caller: AuthCaller): Promise<TaskStats> {
    const tasks = await this.listTasks(caller);
    return this.computeStats(tasks);
  }

  async getTask(
    taskId: string,
    caller: AuthCaller
  ): Promise<{
    task: Task;
    subtasks: TaskSubtask[];
    comments: TaskComment[];
    activity: TaskActivity[];
  }> {
    const doc = await this.tasksCol().doc(taskId).get();
    if (!doc.exists) throw new Error("Task not found.");
    const task = mapTask(doc.id, doc.data() as Record<string, unknown>);
    if (!this.canRead(task, caller)) throw new Error("Access denied.");

    const [subSnap, commentSnap, activitySnap] = await Promise.all([
      doc.ref.collection("subtasks").orderBy("order").get(),
      doc.ref.collection("comments").orderBy("createdAt").get(),
      doc.ref.collection("activity").orderBy("timestamp", "desc").get(),
    ]);

    return {
      task,
      subtasks: subSnap.docs.map((s) => ({
        id: s.id,
        title: s.data().title as string,
        status: s.data().status as TaskStatus,
        progressPercent: (s.data().progressPercent as number) ?? 0,
        order: (s.data().order as number) ?? 0,
        createdAt: toIso(s.data().createdAt) || "",
        updatedAt: toIso(s.data().updatedAt) || "",
      })),
      comments: commentSnap.docs.map((c) => ({
        id: c.id,
        userId: c.data().userId as string,
        userName: c.data().userName as string,
        text: c.data().text as string,
        parentCommentId: c.data().parentCommentId as string | null,
        attachments: (c.data().attachments as TaskAttachment[]) || [],
        createdAt: toIso(c.data().createdAt) || "",
        updatedAt: toIso(c.data().updatedAt) || "",
        editHistory: c.data().editHistory as TaskComment["editHistory"],
      })),
      activity: activitySnap.docs.map((a) => ({
        id: a.id,
        userId: a.data().userId as string,
        userName: a.data().userName as string,
        action: a.data().action as TaskActivityAction,
        metadata: a.data().metadata as Record<string, unknown>,
        timestamp: toIso(a.data().timestamp) || "",
      })),
    };
  }

  async createTask(
    caller: AuthCaller,
    input: {
      title: string;
      description?: string;
      assignedTo: string[];
      priority?: TaskPriority;
      startDate?: string;
      dueDate?: string;
      estimatedHours?: number;
    }
  ): Promise<Task> {
    if (!caller.isDirector) throw new Error("Only directors can create tasks.");
    if (!input.title?.trim()) throw new Error("Title is required.");
    const dateErr = validateTaskDates(input.startDate, input.dueDate);
    if (dateErr) throw new Error(dateErr);

    const assigneeDetails = await this.resolveAssigneeDetails(input.assignedTo);
    if (!assigneeDetails.assignedTo.length) throw new Error("At least one assignee is required.");

    const admin = await import("firebase-admin");
    const centreId = caller.centreId || "default";
    const payload = {
      centreId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      assignedBy: caller.id,
      assignedByName: callerName(caller),
      ...assigneeDetails,
      priority: input.priority || "medium",
      status: "pending" as TaskStatus,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      completionDate: null,
      estimatedHours: input.estimatedHours ?? 0,
      actualHours: 0,
      progressPercent: 0,
      parentTaskId: null,
      attachmentUrls: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await this.tasksCol().add(payload);
    await this.logActivity(ref.id, caller, "task_created", { title: input.title });
    await this.logActivity(ref.id, caller, "task_assigned", { assignees: assigneeDetails.assignedTo });

    for (const uid of assigneeDetails.assignedTo) {
      await this.notify(
        uid,
        centreId,
        "New task assigned",
        `You have been assigned: ${input.title}`,
        ref.id,
        input.priority === "urgent" ? "urgent" : "medium"
      );
    }

    const created = await ref.get();
    return mapTask(created.id, created.data() as Record<string, unknown>);
  }

  async updateTask(
    taskId: string,
    caller: AuthCaller,
    updates: Partial<{
      title: string;
      description: string;
      assignedTo: string[];
      priority: TaskPriority;
      status: TaskStatus;
      startDate: string;
      dueDate: string;
      estimatedHours: number;
      actualHours: number;
      progressPercent: number;
    }>
  ): Promise<Task> {
    const doc = await this.tasksCol().doc(taskId).get();
    if (!doc.exists) throw new Error("Task not found.");
    const existing = mapTask(doc.id, doc.data() as Record<string, unknown>);

    const admin = await import("firebase-admin");
    const patch: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (caller.isDirector) {
      if (updates.title !== undefined) patch.title = updates.title.trim();
      if (updates.description !== undefined) patch.description = updates.description;
      if (updates.priority !== undefined) patch.priority = updates.priority;
      if (updates.estimatedHours !== undefined) patch.estimatedHours = updates.estimatedHours;
      if (updates.startDate !== undefined) patch.startDate = updates.startDate ? new Date(updates.startDate) : null;
      if (updates.dueDate !== undefined) {
        const dateErr = validateTaskDates(
          updates.startDate ?? existing.startDate,
          updates.dueDate
        );
        if (dateErr) throw new Error(dateErr);
        patch.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
        if (existing.dueDate !== updates.dueDate) {
          await this.logActivity(taskId, caller, "deadline_changed", {
            from: existing.dueDate,
            to: updates.dueDate,
          });
          for (const uid of existing.assignedTo) {
            await this.notify(
              uid,
              existing.centreId,
              "Task deadline changed",
              `Deadline updated for: ${existing.title}`,
              taskId
            );
          }
        }
      }
      if (updates.assignedTo !== undefined) {
        const details = await this.resolveAssigneeDetails(updates.assignedTo);
        Object.assign(patch, details);
        const newAssignees = details.assignedTo.filter((id) => !existing.assignedTo.includes(id));
        if (newAssignees.length) {
          await this.logActivity(taskId, caller, "task_assigned", { assignees: newAssignees });
          for (const uid of newAssignees) {
            await this.notify(
              uid,
              existing.centreId,
              "New task assigned",
              `You have been assigned: ${existing.title}`,
              taskId
            );
          }
        }
      }
      if (updates.status !== undefined) {
        if (!canTransitionStatus(existing.status, updates.status, true)) {
          throw new Error(`Invalid status transition from ${existing.status} to ${updates.status}.`);
        }
        patch.status = updates.status;
        if (updates.status === "completed") {
          patch.completionDate = admin.firestore.FieldValue.serverTimestamp();
          patch.progressPercent = 100;
        }
        await this.logActivity(taskId, caller, "status_changed", {
          from: existing.status,
          to: updates.status,
        });
      }
      if (updates.progressPercent !== undefined) patch.progressPercent = updates.progressPercent;
      if (updates.actualHours !== undefined) patch.actualHours = updates.actualHours;
    } else {
      if (!this.isAssignee(existing, caller.id)) throw new Error("Access denied.");
      const allowedKeys = ["progressPercent", "actualHours", "status"] as const;
      for (const key of allowedKeys) {
        if (updates[key] !== undefined) patch[key] = updates[key];
      }
      if (updates.status !== undefined) {
        if (!canTransitionStatus(existing.status, updates.status, false)) {
          throw new Error(`Invalid status transition from ${existing.status} to ${updates.status}.`);
        }
        await this.logActivity(taskId, caller, "status_changed", {
          from: existing.status,
          to: updates.status,
        });
        if (updates.status === "completed_pending_approval") {
          await this.notify(
            existing.assignedBy,
            existing.centreId,
            "Task pending approval",
            `${callerName(caller)} marked "${existing.title}" as complete`,
            taskId,
            "high"
          );
        }
      }
      if (updates.progressPercent !== undefined) {
        await this.logActivity(taskId, caller, "progress_updated", {
          progress: updates.progressPercent,
        });
        await this.notify(
          existing.assignedBy,
          existing.centreId,
          "Task progress updated",
          `Progress updated on "${existing.title}" to ${updates.progressPercent}%`,
          taskId
        );
      }
    }

    await doc.ref.update(patch);
    const updated = await doc.ref.get();
    let task = mapTask(updated.id, updated.data() as Record<string, unknown>);
    if (task.status === "overdue" || computeOverdueStatus(task.status, task.dueDate) === "overdue") {
      if (task.status !== "overdue" && !["completed", "cancelled", "on_hold"].includes(task.status)) {
        await doc.ref.update({ status: "overdue" });
        task = { ...task, status: "overdue" };
      }
    }
    return task;
  }

  async deleteTask(taskId: string, caller: AuthCaller): Promise<void> {
    if (!caller.isDirector) throw new Error("Only directors can delete tasks.");
    const doc = await this.tasksCol().doc(taskId);
    const subcols = ["subtasks", "comments", "activity"];
    for (const col of subcols) {
      const snap = await doc.collection(col).get();
      const batch = this.db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await doc.delete();
  }

  async approveTask(taskId: string, caller: AuthCaller): Promise<Task> {
    if (!caller.isDirector) throw new Error("Only directors can approve tasks.");
    const task = await this.updateTask(taskId, caller, { status: "completed", progressPercent: 100 });
    await this.logActivity(taskId, caller, "task_approved", {});
    for (const uid of task.assignedTo) {
      await this.notify(
        uid,
        task.centreId,
        "Task approved",
        `Your task "${task.title}" was approved.`,
        taskId,
        "medium"
      );
    }
    return task;
  }

  async rejectTask(taskId: string, caller: AuthCaller): Promise<Task> {
    if (!caller.isDirector) throw new Error("Only directors can reject tasks.");
    const task = await this.updateTask(taskId, caller, { status: "in_progress" });
    for (const uid of task.assignedTo) {
      await this.notify(
        uid,
        task.centreId,
        "Task returned for revision",
        `Director requested changes on: ${task.title}`,
        taskId
      );
    }
    await this.logActivity(taskId, caller, "task_rejected", {});
    return task;
  }

  async reopenTask(taskId: string, caller: AuthCaller): Promise<Task> {
    if (!caller.isDirector) throw new Error("Only directors can reopen tasks.");
    const task = await this.updateTask(taskId, caller, { status: "in_progress", progressPercent: 0 });
    await this.logActivity(taskId, caller, "task_reopened", {});
    for (const uid of task.assignedTo) {
      await this.notify(uid, task.centreId, "Task reopened", task.title, taskId);
    }
    return task;
  }

  private async recalcParentProgress(taskId: string) {
    const subSnap = await this.tasksCol().doc(taskId).collection("subtasks").get();
    if (subSnap.empty) return;
    const avg = Math.round(
      subSnap.docs.reduce((sum, d) => sum + ((d.data().progressPercent as number) ?? 0), 0) /
        subSnap.docs.length
    );
    await this.tasksCol().doc(taskId).update({ progressPercent: avg });
  }

  async addSubtask(taskId: string, caller: AuthCaller, title: string): Promise<TaskSubtask> {
    if (!caller.isDirector) throw new Error("Only directors can add subtasks.");
    const admin = await import("firebase-admin");
    const subSnap = await this.tasksCol().doc(taskId).collection("subtasks").get();
    const ref = await this.tasksCol().doc(taskId).collection("subtasks").add({
      title: title.trim(),
      status: "pending",
      progressPercent: 0,
      order: subSnap.size,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await this.logActivity(taskId, caller, "subtask_added", { title });
    await this.recalcParentProgress(taskId);
    const doc = await ref.get();
    return {
      id: doc.id,
      title: doc.data()!.title as string,
      status: "pending",
      progressPercent: 0,
      order: subSnap.size,
      createdAt: toIso(doc.data()!.createdAt) || "",
      updatedAt: toIso(doc.data()!.updatedAt) || "",
    };
  }

  async updateSubtask(
    taskId: string,
    subId: string,
    caller: AuthCaller,
    updates: Partial<{ title: string; status: TaskStatus; progressPercent: number }>
  ): Promise<TaskSubtask> {
    if (!caller.isDirector) throw new Error("Only directors can update subtasks.");
    const admin = await import("firebase-admin");
    const ref = this.tasksCol().doc(taskId).collection("subtasks").doc(subId);
    const patch: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.status !== undefined) {
      patch.status = updates.status;
      patch.progressPercent = updates.status === "completed" ? 100 : updates.progressPercent ?? 0;
    }
    if (updates.progressPercent !== undefined) patch.progressPercent = updates.progressPercent;
    await ref.update(patch);
    await this.logActivity(taskId, caller, "subtask_updated", { subId, ...updates });
    await this.recalcParentProgress(taskId);
    const doc = await ref.get();
    const data = doc.data()!;
    return {
      id: doc.id,
      title: data.title as string,
      status: data.status as TaskStatus,
      progressPercent: (data.progressPercent as number) ?? 0,
      order: (data.order as number) ?? 0,
      createdAt: toIso(data.createdAt) || "",
      updatedAt: toIso(data.updatedAt) || "",
    };
  }

  async deleteSubtask(taskId: string, subId: string, caller: AuthCaller): Promise<void> {
    if (!caller.isDirector) throw new Error("Only directors can delete subtasks.");
    await this.tasksCol().doc(taskId).collection("subtasks").doc(subId).delete();
    await this.logActivity(taskId, caller, "subtask_deleted", { subId });
    await this.recalcParentProgress(taskId);
  }

  async addComment(
    taskId: string,
    caller: AuthCaller,
    input: { text: string; parentCommentId?: string; attachments?: TaskAttachment[] }
  ): Promise<TaskComment> {
    const { task } = await this.getTask(taskId, caller);
    if (!this.canRead(task, caller)) throw new Error("Access denied.");
    const admin = await import("firebase-admin");
    const ref = await this.tasksCol().doc(taskId).collection("comments").add({
      userId: caller.id,
      userName: callerName(caller),
      text: input.text.trim(),
      parentCommentId: input.parentCommentId || null,
      attachments: input.attachments || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await this.logActivity(taskId, caller, "comment_added", { commentId: ref.id });

    if (caller.isDirector) {
      for (const uid of task.assignedTo) {
        if (uid !== caller.id) {
          await this.notify(
            uid,
            task.centreId,
            "Director commented on task",
            input.text.slice(0, 100),
            taskId
          );
        }
      }
    } else {
      await this.notify(
        task.assignedBy,
        task.centreId,
        "New comment on task",
        `${callerName(caller)}: ${input.text.slice(0, 80)}`,
        taskId
      );
    }

    const doc = await ref.get();
    const data = doc.data()!;
    return {
      id: doc.id,
      userId: data.userId as string,
      userName: data.userName as string,
      text: data.text as string,
      parentCommentId: data.parentCommentId as string | null,
      attachments: (data.attachments as TaskAttachment[]) || [],
      createdAt: toIso(data.createdAt) || "",
      updatedAt: toIso(data.updatedAt) || "",
    };
  }

  async editComment(
    taskId: string,
    commentId: string,
    caller: AuthCaller,
    text: string
  ): Promise<TaskComment> {
    const ref = this.tasksCol().doc(taskId).collection("comments").doc(commentId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Comment not found.");
    if (doc.data()!.userId !== caller.id) throw new Error("Can only edit your own comments.");
    const admin = await import("firebase-admin");
    const history = (doc.data()!.editHistory as TaskComment["editHistory"]) || [];
    history.push({ text: doc.data()!.text as string, editedAt: new Date().toISOString() });
    await ref.update({
      text: text.trim(),
      editHistory: history,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const updated = await ref.get();
    const data = updated.data()!;
    return {
      id: updated.id,
      userId: data.userId as string,
      userName: data.userName as string,
      text: data.text as string,
      parentCommentId: data.parentCommentId as string | null,
      attachments: (data.attachments as TaskAttachment[]) || [],
      createdAt: toIso(data.createdAt) || "",
      updatedAt: toIso(data.updatedAt) || "",
      editHistory: data.editHistory as TaskComment["editHistory"],
    };
  }

  async addAttachment(
    taskId: string,
    caller: AuthCaller,
    attachment: TaskAttachment
  ): Promise<Task> {
    const { task } = await this.getTask(taskId, caller);
    if (!this.canRead(task, caller)) throw new Error("Access denied.");
    const admin = await import("firebase-admin");
    const attachments = [...task.attachmentUrls, attachment];
    await this.tasksCol().doc(taskId).update({
      attachmentUrls: attachments,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await this.logActivity(taskId, caller, "attachment_uploaded", { name: attachment.name });
    const updated = await this.tasksCol().doc(taskId).get();
    return mapTask(updated.id, updated.data() as Record<string, unknown>);
  }
}

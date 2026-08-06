import { auth, db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  type Task,
  type TaskSubtask,
  type TaskComment,
  type TaskActivity,
  type TaskStats,
  type TaskFilters,
  type TaskAttachment,
  type TaskPriority,
  type TaskStatus,
  type TaskActivityAction,
  canTransitionStatus,
  computeOverdueStatus,
  validateTaskDates,
  getStatusLabel,
} from '@shared/taskTypes';
import {
  isDirectorEmail,
  isDirectorRole,
  normalizeEmail,
  normalizeRole,
} from '@shared/permissions';
import { createTaskNotification } from '@/lib/taskNotificationService';

export interface TaskCaller {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  centreId: string;
  isDirector: boolean;
}

function toIso(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function callerName(caller: TaskCaller): string {
  const parts = [caller.firstName, caller.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : caller.email ?? 'User';
}

function taskNotificationMeta(task: Pick<Task, 'title' | 'assignedByName' | 'assignedToNames' | 'dueDate' | 'priority' | 'status'>) {
  return {
    taskTitle: task.title,
    assignedByName: task.assignedByName,
    assignedToNames: task.assignedToNames,
    dueDate: task.dueDate,
    taskPriority: task.priority,
    taskStatus: task.status,
  };
}

function mapTask(id: string, data: Record<string, unknown>): Task {
  const assignedTo = Array.isArray(data.assignedTo)
    ? (data.assignedTo as string[])
    : data.assignedTo
      ? [String(data.assignedTo)]
      : [];
  const status = computeOverdueStatus(
    (data.status as TaskStatus) || 'pending',
    toIso(data.dueDate)
  );
  return {
    id,
    centreId: (data.centreId as string) || '',
    title: (data.title as string) || '',
    description: data.description as string | undefined,
    assignedBy: (data.assignedBy as string) || '',
    assignedByName: data.assignedByName as string | undefined,
    assignedTo,
    assignedToEmails: data.assignedToEmails as string[] | undefined,
    assignedToNames: data.assignedToNames as string[] | undefined,
    priority: (data.priority as TaskPriority) || 'medium',
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

async function getCaller(): Promise<TaskCaller> {
  const user = auth?.currentUser;
  if (!user || !db) {
    throw new Error('You must be signed in to perform this action.');
  }
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) {
    throw new Error('User profile not found.');
  }
  const data = snap.data();
  const role = normalizeRole(data.role);
  const email = normalizeEmail(data.email ?? user.email);
  return {
    id: user.uid,
    email: data.email ?? user.email ?? undefined,
    firstName: data.firstName,
    lastName: data.lastName,
    centreId: (data.centreId as string) || 'default',
    isDirector: isDirectorRole(role) || isDirectorEmail(email),
  };
}

async function logActivity(
  taskId: string,
  caller: TaskCaller,
  action: TaskActivityAction,
  metadata?: Record<string, unknown>
) {
  if (!db) return;
  try {
    await addDoc(collection(db, 'tasks', taskId, 'activity'), {
      userId: caller.id,
      userName: callerName(caller),
      action,
      metadata: metadata ?? {},
      timestamp: serverTimestamp(),
    });
  } catch {
    // Activity log is best-effort when using client fallback
  }
}

async function resolveAssigneeDetails(assigneeIds: string[]) {
  if (!db) throw new Error('Database not available.');
  const unique = [...new Set(assigneeIds.filter(Boolean))];
  const emails: string[] = [];
  const names: string[] = [];
  for (const uid of unique) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) continue;
    const data = snap.data();
    if (!data.approved) throw new Error(`User ${uid} is not approved.`);
    if (String(data.role).toLowerCase() === 'pending') {
      throw new Error(`User ${uid} has pending role.`);
    }
    emails.push((data.email as string) || '');
    const name =
      [data.firstName, data.lastName].filter(Boolean).join(' ') || (data.email as string);
    names.push(name);
  }
  return { assignedTo: unique, assignedToEmails: emails, assignedToNames: names };
}

function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = [...tasks];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    );
  }
  if (filters.status && filters.status !== 'all') {
    result = result.filter((t) => t.status === filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
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

function computeStats(tasks: Task[]): TaskStats {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.status === 'overdue').length,
    completedPendingApproval: tasks.filter((t) => t.status === 'completed_pending_approval').length,
    onHold: tasks.filter((t) => t.status === 'on_hold').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };
}

async function fetchTasksForCaller(caller: TaskCaller): Promise<Task[]> {
  if (!db) throw new Error('Database not available.');
  const centreId = caller.centreId || 'default';

  let snap;
  try {
    if (caller.isDirector) {
      snap = await getDocs(query(collection(db, 'tasks'), where('centreId', '==', centreId)));
    } else {
      snap = await getDocs(
        query(collection(db, 'tasks'), where('assignedTo', 'array-contains', caller.id))
      );
    }
  } catch {
    snap = await getDocs(collection(db, 'tasks'));
  }

  return snap.docs
    .map((d) => mapTask(d.id, d.data() as Record<string, unknown>))
    .filter((t) => !caller.isDirector || t.centreId === centreId)
    .filter((t) => caller.isDirector || t.assignedTo.includes(caller.id));
}

async function getTaskDoc(taskId: string, caller: TaskCaller): Promise<Task> {
  if (!db) throw new Error('Database not available.');
  const snap = await getDoc(doc(db, 'tasks', taskId));
  if (!snap.exists()) throw new Error('Task not found.');
  const task = mapTask(snap.id, snap.data() as Record<string, unknown>);
  if (!caller.isDirector && !task.assignedTo.includes(caller.id)) {
    throw new Error('Access denied.');
  }
  return task;
}

function getRawStatus(data: Record<string, unknown>): TaskStatus {
  return (data.status as TaskStatus) || 'pending';
}

async function recalcParentProgress(taskId: string) {
  if (!db) return;
  const subSnap = await getDocs(collection(db, 'tasks', taskId, 'subtasks'));
  if (subSnap.empty) return;
  const avg = Math.round(
    subSnap.docs.reduce((sum, d) => sum + ((d.data().progressPercent as number) ?? 0), 0) /
      subSnap.docs.length
  );
  await updateDoc(doc(db, 'tasks', taskId), { progressPercent: avg });
}

export const taskClientService = {
  async list(filters: TaskFilters = {}): Promise<Task[]> {
    const caller = await getCaller();
    const tasks = await fetchTasksForCaller(caller);
    return applyFilters(tasks, filters).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getStats(): Promise<TaskStats> {
    const caller = await getCaller();
    const tasks = await fetchTasksForCaller(caller);
    return computeStats(tasks);
  },

  async getDetail(taskId: string) {
    const caller = await getCaller();
    const task = await getTaskDoc(taskId, caller);

    const [subSnap, commentSnap, activitySnap] = await Promise.all([
      getDocs(query(collection(db, 'tasks', taskId, 'subtasks'), orderBy('order'))),
      getDocs(query(collection(db, 'tasks', taskId, 'comments'), orderBy('createdAt'))),
      getDocs(query(collection(db, 'tasks', taskId, 'activity'), orderBy('timestamp', 'desc'))),
    ]);

    return {
      task,
      subtasks: subSnap.docs.map((s) => ({
        id: s.id,
        title: s.data().title as string,
        status: s.data().status as TaskStatus,
        progressPercent: (s.data().progressPercent as number) ?? 0,
        order: (s.data().order as number) ?? 0,
        createdAt: toIso(s.data().createdAt) || '',
        updatedAt: toIso(s.data().updatedAt) || '',
      })),
      comments: commentSnap.docs.map((c) => ({
        id: c.id,
        userId: c.data().userId as string,
        userName: c.data().userName as string,
        text: c.data().text as string,
        parentCommentId: c.data().parentCommentId as string | null,
        attachments: (c.data().attachments as TaskAttachment[]) || [],
        createdAt: toIso(c.data().createdAt) || '',
        updatedAt: toIso(c.data().updatedAt) || '',
        editHistory: c.data().editHistory as TaskComment['editHistory'],
      })),
      activity: activitySnap.docs.map((a) => ({
        id: a.id,
        userId: a.data().userId as string,
        userName: a.data().userName as string,
        action: a.data().action as TaskActivityAction,
        metadata: a.data().metadata as Record<string, unknown>,
        timestamp: toIso(a.data().timestamp) || '',
      })),
    };
  },

  async create(input: {
    title: string;
    description?: string;
    assignedTo: string[];
    priority?: TaskPriority;
    startDate?: string;
    dueDate?: string;
    estimatedHours?: number;
  }): Promise<Task> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can create tasks.');
    if (!db) throw new Error('Database not available.');
    if (!input.title?.trim()) throw new Error('Title is required.');

    const dateErr = validateTaskDates(input.startDate, input.dueDate);
    if (dateErr) throw new Error(dateErr);

    const assigneeDetails = await resolveAssigneeDetails(input.assignedTo);
    if (!assigneeDetails.assignedTo.length) {
      throw new Error('At least one assignee is required.');
    }

    const ref = await addDoc(collection(db, 'tasks'), {
      centreId: caller.centreId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      assignedBy: caller.id,
      assignedByName: callerName(caller),
      ...assigneeDetails,
      priority: input.priority || 'medium',
      status: 'pending',
      startDate: input.startDate ? Timestamp.fromDate(new Date(input.startDate)) : null,
      dueDate: input.dueDate ? Timestamp.fromDate(new Date(input.dueDate)) : null,
      completionDate: null,
      estimatedHours: input.estimatedHours ?? 0,
      actualHours: 0,
      progressPercent: 0,
      parentTaskId: null,
      attachmentUrls: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity(ref.id, caller, 'task_created', { title: input.title });
    await logActivity(ref.id, caller, 'task_assigned', { assignees: assigneeDetails.assignedTo });

    for (const uid of assigneeDetails.assignedTo) {
      await createTaskNotification({
        userId: uid,
        centreId: caller.centreId,
        taskId: ref.id,
        event: 'task_assigned',
        message: `You have been assigned: ${input.title}`,
        priority: input.priority === 'urgent' ? 'urgent' : 'medium',
        taskTitle: input.title,
        assignedByName: callerName(caller),
        assignedToNames: assigneeDetails.assignedToNames,
        dueDate: input.dueDate,
        taskPriority: input.priority || 'medium',
        taskStatus: 'pending',
      });
    }

    const created = await getDoc(ref);
    return mapTask(created.id, created.data() as Record<string, unknown>);
  },

  async update(
    taskId: string,
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
    const caller = await getCaller();
    if (!db) throw new Error('Database not available.');

    const snap = await getDoc(doc(db, 'tasks', taskId));
    if (!snap.exists()) throw new Error('Task not found.');
    const rawData = snap.data() as Record<string, unknown>;
    const rawStatus = getRawStatus(rawData);
    const existing = mapTask(snap.id, rawData);

    if (!caller.isDirector && !existing.assignedTo.includes(caller.id)) {
      throw new Error('Access denied.');
    }

    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const sideEffects: Array<() => Promise<void>> = [];

    if (caller.isDirector) {
      if (updates.title !== undefined) patch.title = updates.title.trim();
      if (updates.description !== undefined) patch.description = updates.description;
      if (updates.priority !== undefined) patch.priority = updates.priority;
      if (updates.estimatedHours !== undefined) patch.estimatedHours = updates.estimatedHours;
      if (updates.startDate !== undefined) {
        patch.startDate = updates.startDate ? Timestamp.fromDate(new Date(updates.startDate)) : null;
      }
      if (updates.dueDate !== undefined) {
        const dateErr = validateTaskDates(updates.startDate ?? existing.startDate, updates.dueDate);
        if (dateErr) throw new Error(dateErr);
        patch.dueDate = updates.dueDate ? Timestamp.fromDate(new Date(updates.dueDate)) : null;
        if (existing.dueDate !== updates.dueDate) {
          sideEffects.push(async () => {
            await logActivity(taskId, caller, 'deadline_changed', {
              from: existing.dueDate,
              to: updates.dueDate,
            });
            for (const uid of existing.assignedTo) {
              await createTaskNotification({
                userId: uid,
                centreId: existing.centreId,
                taskId,
                event: 'deadline_changed',
                message: `Deadline updated for: ${existing.title}`,
                ...taskNotificationMeta(existing),
              });
            }
          });
        }
      }
      if (updates.assignedTo !== undefined) {
        Object.assign(patch, await resolveAssigneeDetails(updates.assignedTo));
      }
      if (updates.status !== undefined) {
        if (!canTransitionStatus(rawStatus, updates.status, true)) {
          throw new Error(`Invalid status transition from ${getStatusLabel(rawStatus)} to ${getStatusLabel(updates.status)}.`);
        }
        patch.status = updates.status;
        if (updates.status === 'completed') {
          patch.completionDate = serverTimestamp();
          patch.progressPercent = 100;
        }
        sideEffects.push(async () => {
          await logActivity(taskId, caller, 'status_changed', {
            from: rawStatus,
            to: updates.status,
          });
        });
      }
      if (updates.progressPercent !== undefined) patch.progressPercent = updates.progressPercent;
      if (updates.actualHours !== undefined) patch.actualHours = updates.actualHours;
    } else {
      if (updates.progressPercent !== undefined) patch.progressPercent = updates.progressPercent;
      if (updates.actualHours !== undefined) patch.actualHours = updates.actualHours;
      if (updates.status !== undefined) {
        if (!canTransitionStatus(rawStatus, updates.status, false)) {
          throw new Error(`Invalid status transition from ${getStatusLabel(rawStatus)} to ${getStatusLabel(updates.status)}.`);
        }
        patch.status = updates.status;
        sideEffects.push(async () => {
          await logActivity(taskId, caller, 'status_changed', {
            from: rawStatus,
            to: updates.status,
          });
          if (updates.status === 'completed_pending_approval') {
            await createTaskNotification({
              userId: existing.assignedBy,
              centreId: existing.centreId,
              taskId,
              event: 'task_complete_pending',
              message: `${callerName(caller)} marked "${existing.title}" as complete`,
              priority: 'high',
              ...taskNotificationMeta({ ...existing, status: 'completed_pending_approval' }),
            });
          }
        });
      }
      if (
        updates.progressPercent !== undefined &&
        updates.status !== 'completed_pending_approval'
      ) {
        sideEffects.push(async () => {
          await logActivity(taskId, caller, 'progress_updated', { progress: updates.progressPercent });
          await createTaskNotification({
            userId: existing.assignedBy,
            centreId: existing.centreId,
            taskId,
            event: 'progress_updated',
            message: `Progress updated on "${existing.title}" to ${updates.progressPercent}%`,
            ...taskNotificationMeta(existing),
          });
        });
      }
    }

    await updateDoc(doc(db, 'tasks', taskId), patch);

    for (const effect of sideEffects) {
      try {
        await effect();
      } catch {
        // Notifications and activity are best-effort after the task is saved.
      }
    }

    return getTaskDoc(taskId, caller);
  },

  async delete(taskId: string): Promise<void> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can delete tasks.');
    if (!db) throw new Error('Database not available.');

    for (const sub of ['subtasks', 'comments', 'activity']) {
      const snap = await getDocs(collection(db, 'tasks', taskId, sub));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'tasks', taskId));
  },

  async approve(taskId: string): Promise<Task> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can approve tasks.');
    const task = await this.update(taskId, { status: 'completed', progressPercent: 100 });
    await logActivity(taskId, caller, 'task_approved', {});
    for (const uid of task.assignedTo) {
      await createTaskNotification({
        userId: uid,
        centreId: task.centreId,
        taskId,
        event: 'task_approved',
        message: `Your task "${task.title}" was approved.`,
        ...taskNotificationMeta({ ...task, status: 'completed' }),
      });
    }
    return task;
  },

  async reject(taskId: string): Promise<Task> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can reject tasks.');
    const task = await this.update(taskId, { status: 'in_progress' });
    await logActivity(taskId, caller, 'task_rejected', {});
    for (const uid of task.assignedTo) {
      await createTaskNotification({
        userId: uid,
        centreId: task.centreId,
        taskId,
        event: 'task_rejected',
        message: `Director requested changes on: ${task.title}`,
        ...taskNotificationMeta({ ...task, status: 'in_progress' }),
      });
    }
    return task;
  },

  async reopen(taskId: string): Promise<Task> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can reopen tasks.');
    const task = await this.update(taskId, { status: 'in_progress', progressPercent: 0 });
    await logActivity(taskId, caller, 'task_reopened', {});
    return task;
  },

  async addSubtask(taskId: string, title: string): Promise<TaskSubtask> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can add subtasks.');
    if (!db) throw new Error('Database not available.');

    const subSnap = await getDocs(collection(db, 'tasks', taskId, 'subtasks'));
    const ref = await addDoc(collection(db, 'tasks', taskId, 'subtasks'), {
      title: title.trim(),
      status: 'pending',
      progressPercent: 0,
      order: subSnap.size,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(taskId, caller, 'subtask_added', { title });
    await recalcParentProgress(taskId);
    const docSnap = await getDoc(ref);
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      title: data.title as string,
      status: 'pending',
      progressPercent: 0,
      order: subSnap.size,
      createdAt: toIso(data.createdAt) || '',
      updatedAt: toIso(data.updatedAt) || '',
    };
  },

  async updateSubtask(
    taskId: string,
    subId: string,
    updates: Partial<{ title: string; status: TaskStatus; progressPercent: number }>
  ): Promise<TaskSubtask> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can update subtasks.');
    if (!db) throw new Error('Database not available.');

    const ref = doc(db, 'tasks', taskId, 'subtasks', subId);
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.status !== undefined) {
      patch.status = updates.status;
      patch.progressPercent = updates.status === 'completed' ? 100 : updates.progressPercent ?? 0;
    }
    if (updates.progressPercent !== undefined) patch.progressPercent = updates.progressPercent;
    await updateDoc(ref, patch);
    await logActivity(taskId, caller, 'subtask_updated', { subId, ...updates });
    await recalcParentProgress(taskId);
    const docSnap = await getDoc(ref);
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      title: data.title as string,
      status: data.status as TaskStatus,
      progressPercent: (data.progressPercent as number) ?? 0,
      order: (data.order as number) ?? 0,
      createdAt: toIso(data.createdAt) || '',
      updatedAt: toIso(data.updatedAt) || '',
    };
  },

  async deleteSubtask(taskId: string, subId: string): Promise<void> {
    const caller = await getCaller();
    if (!caller.isDirector) throw new Error('Only directors can delete subtasks.');
    if (!db) throw new Error('Database not available.');
    await deleteDoc(doc(db, 'tasks', taskId, 'subtasks', subId));
    await logActivity(taskId, caller, 'subtask_deleted', { subId });
    await recalcParentProgress(taskId);
  },

  async addComment(
    taskId: string,
    input: { text: string; parentCommentId?: string; attachments?: TaskAttachment[] }
  ): Promise<TaskComment> {
    const caller = await getCaller();
    if (!db) throw new Error('Database not available.');
    const task = await getTaskDoc(taskId, caller);

    const ref = await addDoc(collection(db, 'tasks', taskId, 'comments'), {
      userId: caller.id,
      userName: callerName(caller),
      text: input.text.trim(),
      parentCommentId: input.parentCommentId || null,
      attachments: input.attachments || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(taskId, caller, 'comment_added', { commentId: ref.id });

    if (caller.isDirector) {
      for (const uid of task.assignedTo) {
        if (uid !== caller.id) {
          await createTaskNotification({
            userId: uid,
            centreId: task.centreId,
            taskId,
            event: 'director_comment',
            message: input.text.slice(0, 100),
            ...taskNotificationMeta(task),
          });
        }
      }
    } else {
      await createTaskNotification({
        userId: task.assignedBy,
        centreId: task.centreId,
        taskId,
        event: 'employee_comment',
        message: `${callerName(caller)}: ${input.text.slice(0, 80)}`,
        ...taskNotificationMeta(task),
      });
    }

    const docSnap = await getDoc(ref);
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      userId: data.userId as string,
      userName: data.userName as string,
      text: data.text as string,
      parentCommentId: data.parentCommentId as string | null,
      attachments: (data.attachments as TaskAttachment[]) || [],
      createdAt: toIso(data.createdAt) || '',
      updatedAt: toIso(data.updatedAt) || '',
    };
  },

  async editComment(taskId: string, commentId: string, text: string): Promise<TaskComment> {
    const caller = await getCaller();
    if (!db) throw new Error('Database not available.');
    const ref = doc(db, 'tasks', taskId, 'comments', commentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Comment not found.');
    if (snap.data().userId !== caller.id) throw new Error('Can only edit your own comments.');

    const history = (snap.data().editHistory as TaskComment['editHistory']) || [];
    history.push({ text: snap.data().text as string, editedAt: new Date().toISOString() });
    await updateDoc(ref, {
      text: text.trim(),
      editHistory: history,
      updatedAt: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    const data = updated.data()!;
    return {
      id: updated.id,
      userId: data.userId as string,
      userName: data.userName as string,
      text: data.text as string,
      parentCommentId: data.parentCommentId as string | null,
      attachments: (data.attachments as TaskAttachment[]) || [],
      createdAt: toIso(data.createdAt) || '',
      updatedAt: toIso(data.updatedAt) || '',
      editHistory: data.editHistory as TaskComment['editHistory'],
    };
  },

  async addAttachment(taskId: string, attachment: TaskAttachment): Promise<Task> {
    const caller = await getCaller();
    if (!db) throw new Error('Database not available.');
    const task = await getTaskDoc(taskId, caller);
    const attachments = [...task.attachmentUrls, attachment];
    await updateDoc(doc(db, 'tasks', taskId), {
      attachmentUrls: attachments,
      updatedAt: serverTimestamp(),
    });
    await logActivity(taskId, caller, 'attachment_uploaded', { name: attachment.name });
    return getTaskDoc(taskId, caller);
  },

  subscribeToTasks(
    params: { userId: string; isDirector: boolean; centreId: string },
    onUpdate: (tasks: Task[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!db) return () => {};

    const centreId = params.centreId || 'default';
    const baseQuery = params.isDirector
      ? query(collection(db, 'tasks'), where('centreId', '==', centreId))
      : query(collection(db, 'tasks'), where('assignedTo', 'array-contains', params.userId));

    return onSnapshot(
      baseQuery,
      (snap) => {
        const tasks = snap.docs
          .map((d) => mapTask(d.id, d.data() as Record<string, unknown>))
          .filter((t) => params.isDirector || t.assignedTo.includes(params.userId))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        onUpdate(tasks);
      },
      (err) => onError?.(err)
    );
  },

  subscribeToTask(
    taskId: string,
    onUpdate: (task: Task | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!db) return () => {};

    return onSnapshot(
      doc(db, 'tasks', taskId),
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        onUpdate(mapTask(snap.id, snap.data() as Record<string, unknown>));
      },
      (err) => onError?.(err)
    );
  },
};

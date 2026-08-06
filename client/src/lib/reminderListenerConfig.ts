/** Shared Firestore listener options — one onSnapshot per centre via firebaseListenerManager. */
export const REMINDERS_LISTENER_LIMIT = 200;

export function getReminderListenerOptions(centreId: string) {
  return {
    centreId: centreId.trim(),
    limit: REMINDERS_LISTENER_LIMIT,
  };
}

export const ACTIVE_REMINDER_STATUSES = new Set(['pending', 'snoozed']);

export function isActiveReminderStatus(status: string | undefined): boolean {
  return !!status && ACTIVE_REMINDER_STATUSES.has(status);
}

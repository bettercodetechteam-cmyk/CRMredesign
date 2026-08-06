/**
 * Single source of truth for organisation leads.
 * All roles (Director, Centre Head, etc.) use the same scope and filter rules.
 */

import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { firebaseListenerManager } from './firebaseListenerManager';
import { isNestLeadsEnabled } from './nestApi';
import { mapNestLeadToUi } from './nestLeadMapper';
import { nestLeadsApi } from '@/services/nest/leadsApi';

/** Shared leads listener — no server-side centreId filter; filter in this store. */
export const STANDARD_LEADS_LISTENER_OPTIONS = {};

const LEADS_FETCH_BATCH = 500;
/** Real-time listener only watches enquiries from the last 24 hours (low read cost). */
const RECENT_ENQUIRY_LISTENER_LIMIT = 50;
export const WEBSITE_ENQUIRY_DASHBOARD_HOURS = 24;
const WEBSITE_ENQUIRY_DASHBOARD_MS = WEBSITE_ENQUIRY_DASHBOARD_HOURS * 60 * 60 * 1000;

/** Legacy centreId values from older imports / missing profile data (single-org). */
const LEGACY_CENTRE_IDS = new Set(['default-centre', 'demo-centre-001', 'unknown']);

export type LeadRecord = Record<string, unknown> & { id: string };

export interface CentreDataInitOptions {
  centreId: string;
  role?: string;
}

type StoreListener = () => void;

function toFirestoreDate(value: unknown): unknown {
  return (value as { toDate?: () => Date })?.toDate?.() ?? value;
}

function normalizeLead(item: Record<string, unknown> & { id: string }): LeadRecord {
  const createdAt = toFirestoreDate(item.createdAt);
  const updatedAt = toFirestoreDate(item.updatedAt);
  const followUpDate = toFirestoreDate(item.followUpDate);
  const nextFollowUpDate = toFirestoreDate(item.nextFollowUpDate);
  const visitDate = toFirestoreDate(item.visitDate);
  const admissionDate = toFirestoreDate(item.admissionDate);
  const enquiryDate = toFirestoreDate(item.enquiryDate);

  return {
    ...item,
    createdAt,
    updatedAt,
    followUpDate,
    nextFollowUpDate,
    visitDate,
    admissionDate,
    enquiryDate,
  } as LeadRecord;
}

/** Map website `enquiries` collection documents into lead table rows. */
function normalizeEnquiryToLead(item: Record<string, unknown> & { id: string }): LeadRecord {
  const submittedAt = toFirestoreDate(item.submittedAt);
  const enquiryDate = submittedAt ?? new Date();

  return {
    id: `enquiry_${item.id}`,
    leadName: String(item.name ?? ''),
    contact: String(item.phone ?? ''),
    emailId: String(item.email ?? ''),
    course: String(item.course ?? ''),
    source: 'Website Inquiry',
    status: String(item.status ?? 'new'),
    enquiryDate,
    createdAt: enquiryDate,
    updatedAt: enquiryDate,
    remark: String(item.message ?? ''),
    courseDuration: '',
    education: '',
    cityArea: '',
    counselorName: '',
    _sourceCollection: 'enquiries',
    _enquiryId: item.id,
  } as LeadRecord;
}

function toSortMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : 0;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function isWebsiteEnquiryLead(lead: LeadRecord): boolean {
  return lead._sourceCollection === 'enquiries' || String(lead.id).startsWith('enquiry_');
}

export function getWebsiteEnquiryReceivedAt(lead: LeadRecord): Date | null {
  const value = lead.enquiryDate ?? lead.createdAt;
  const millis = toSortMillis(value);
  return millis > 0 ? new Date(millis) : null;
}

/** Website enquiries shown on Dashboard only within the last 24 hours. */
export function isRecentWebsiteEnquiry(
  lead: LeadRecord,
  hours: number = WEBSITE_ENQUIRY_DASHBOARD_HOURS
): boolean {
  if (!isWebsiteEnquiryLead(lead)) return false;
  const receivedAt = getWebsiteEnquiryReceivedAt(lead);
  if (!receivedAt) return false;
  return Date.now() - receivedAt.getTime() < hours * 60 * 60 * 1000;
}

function recentEnquiryCutoffDate(): Date {
  return new Date(Date.now() - WEBSITE_ENQUIRY_DASHBOARD_MS);
}

function enquiryDocKey(lead: LeadRecord): string {
  return String(lead._enquiryId ?? String(lead.id).replace(/^enquiry_/, ''));
}

/** Newest first; falls back to enquiryDate/updatedAt when createdAt is missing. */
export function sortLeadsByRecency(leads: LeadRecord[]): LeadRecord[] {
  return [...leads].sort((a, b) => {
    const score = (lead: LeadRecord) =>
      Math.max(
        toSortMillis(lead.createdAt),
        toSortMillis(lead.enquiryDate),
        toSortMillis(lead.updatedAt)
      );
    return score(b) - score(a);
  });
}

/**
 * Single-org rule: include leads tagged for this centre, untagged leads, and legacy centreId values.
 * Excludes leads explicitly tagged for a different centre.
 */
export function belongsToOrganisationCentre(lead: LeadRecord, centreId: string): boolean {
  const raw = lead.centreId;
  if (raw === undefined || raw === null) return true;
  const cid = String(raw).trim();
  if (!cid) return true;
  if (cid === centreId) return true;
  if (LEGACY_CENTRE_IDS.has(cid)) return true;
  return false;
}

export function filterLeadsForCentre(leads: LeadRecord[], centreId: string): LeadRecord[] {
  return leads.filter((lead) => belongsToOrganisationCentre(lead, centreId));
}

async function fetchCollectionDocuments(collectionName: string): Promise<LeadRecord[]> {
  if (!db) return [];

  const coll = collection(db, collectionName);
  const merged: LeadRecord[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    const q = lastDoc
      ? query(coll, orderBy(documentId()), startAfter(lastDoc), limit(LEADS_FETCH_BATCH))
      : query(coll, orderBy(documentId()), limit(LEADS_FETCH_BATCH));

    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    snapshot.docs.forEach((docSnap) => {
      const raw = { id: docSnap.id, ...docSnap.data() } as Record<string, unknown> & { id: string };
      merged.push(
        collectionName === 'enquiries' ? normalizeEnquiryToLead(raw) : normalizeLead(raw)
      );
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < LEADS_FETCH_BATCH) break;
  }

  return merged;
}

async function fetchAllLeadDocuments(): Promise<LeadRecord[]> {
  return fetchCollectionDocuments('leads');
}

async function fetchAllEnquiryDocuments(): Promise<LeadRecord[]> {
  return fetchCollectionDocuments('enquiries');
}

function mergeLeadsForCentre(
  leadDocs: LeadRecord[],
  enquiryDocs: LeadRecord[],
  centreId: string,
  role?: string | null
): LeadRecord[] {
  const combined = [...leadDocs, ...enquiryDocs];
  if (role === 'director' || role === 'centre_head') {
    return sortLeadsByRecency(combined);
  }
  return sortLeadsByRecency(filterLeadsForCentre(combined, centreId));
}

class CentreDataStore {
  private leads: LeadRecord[] = [];
  private leadDocs: LeadRecord[] = [];
  private enquiryDocs: LeadRecord[] = [];
  private centreId: string | null = null;
  private role: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeRecentEnquiries: Unsubscribe | null = null;
  private storeListeners = new Set<StoreListener>();
  private loading = false;
  private isLive = false;
  private lastUpdate: Date | null = null;
  private hasSnapshot = false;
  private nestMode = false;
  private nestPollTimer: ReturnType<typeof setInterval> | null = null;

  getState() {
    return {
      leads: this.leads,
      loading: this.loading,
      isLive: this.isLive,
      lastUpdate: this.lastUpdate,
      hasSnapshot: this.hasSnapshot,
      centreId: this.centreId,
      role: this.role,
      nestMode: this.nestMode,
    };
  }

  subscribe(listener: StoreListener): () => void {
    this.storeListeners.add(listener);
    return () => {
      this.storeListeners.delete(listener);
    };
  }

  private notify() {
    this.storeListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('CentreDataStore listener error:', error);
      }
    });
  }

  private recomputeLeads() {
    if (!this.centreId && this.role !== 'director' && this.role !== 'centre_head') return;

    this.leads = mergeLeadsForCentre(
      this.leadDocs,
      this.enquiryDocs,
      this.centreId ?? 'global',
      this.role
    );
    this.loading = false;
    this.isLive = true;
    this.hasSnapshot = true;
    this.lastUpdate = new Date();
    this.notify();
  }

  private applyLeadsSnapshot(data: Array<Record<string, unknown> & { id: string }>) {
    this.leadDocs = data.map(normalizeLead);
    this.recomputeLeads();
  }

  /** Merge real-time updates for recent enquiries without dropping older cached rows. */
  private mergeRecentEnquiries(recent: LeadRecord[]) {
    const recentIds = new Set(recent.map(enquiryDocKey));
    const older = this.enquiryDocs.filter((entry) => !recentIds.has(enquiryDocKey(entry)));
    this.enquiryDocs = [...older, ...recent];
    this.recomputeLeads();
  }

  private subscribeRecentEnquiries() {
    if (!db) return;

    const q = query(
      collection(db, 'enquiries'),
      where('submittedAt', '>=', Timestamp.fromDate(recentEnquiryCutoffDate())),
      orderBy('submittedAt', 'desc'),
      limit(RECENT_ENQUIRY_LISTENER_LIMIT)
    );

    this.unsubscribeRecentEnquiries = onSnapshot(
      q,
      (snapshot) => {
        const recent = snapshot.docs.map((docSnap) =>
          normalizeEnquiryToLead({ id: docSnap.id, ...docSnap.data() } as Record<string, unknown> & {
            id: string;
          })
        );
        this.mergeRecentEnquiries(recent);
      },
      (error) => {
        console.error('CentreDataStore recent enquiries listener error:', error);
      }
    );
  }

  init(options: CentreDataInitOptions | string) {
    const trimmed =
      typeof options === 'string' ? options.trim() : options.centreId?.trim() || '';
    const role = typeof options === 'object' ? options.role : null;

    if (!trimmed && role !== 'director' && role !== 'centre_head') return;

    if (this.centreId === trimmed && this.role === role && this.unsubscribe) {
      return;
    }

    this.cleanup();
    this.centreId = trimmed || 'global';
    this.role = role || null;
    this.loading = true;
    this.hasSnapshot = false;
    this.isLive = false;
    this.nestMode = isNestLeadsEnabled();
    this.notify();

    if (this.nestMode) {
      void this.refreshFromNest();
      this.nestPollTimer = setInterval(() => {
        void this.refreshFromNest({ silent: true });
      }, 60_000);
      return;
    }

    this.unsubscribe = firebaseListenerManager.subscribe(
      'leads',
      (data) => {
        this.applyLeadsSnapshot(data as Array<Record<string, unknown> & { id: string }>);
      },
      { ...STANDARD_LEADS_LISTENER_OPTIONS }
    );

    this.subscribeRecentEnquiries();

    void this.refresh();
  }

  private async refreshFromNest(options?: { silent?: boolean }): Promise<void> {
    if (!options?.silent) {
      this.loading = true;
      this.notify();
    }

    try {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const collected: LeadRecord[] = [];

      while (page <= totalPages && page <= 20) {
        const result = await nestLeadsApi.list({
          page,
          limit: pageSize,
        });
        collected.push(
          ...result.items.map((item) =>
            mapNestLeadToUi(item as Parameters<typeof mapNestLeadToUi>[0]),
          ),
        );
        totalPages = result.meta.totalPages || 1;
        page += 1;
      }

      this.leadDocs = collected;
      this.enquiryDocs = [];
      this.leads = collected;
      this.loading = false;
      this.isLive = true;
      this.hasSnapshot = true;
      this.lastUpdate = new Date();
      this.notify();
    } catch (error) {
      console.error('CentreDataStore Nest refresh failed:', error);
      this.loading = false;
      this.notify();
      throw error;
    }
  }

  async refresh(): Promise<void> {
    if (this.nestMode || isNestLeadsEnabled()) {
      this.nestMode = true;
      await this.refreshFromNest();
      return;
    }

    if (!db || !this.centreId) return;

    try {
      const [leadDocs, enquiryDocs] = await Promise.all([
        fetchAllLeadDocuments(),
        fetchAllEnquiryDocuments(),
      ]);
      this.leadDocs = leadDocs;
      this.enquiryDocs = enquiryDocs;
      this.recomputeLeads();
    } catch (error) {
      console.error('CentreDataStore refresh failed:', error);
    }
  }

  patchLead(leadId: string, updates: Partial<LeadRecord>) {
    const id = String(leadId);
    const index = this.leads.findIndex((lead) => String(lead.id) === id);
    if (index === -1) return;

    this.leads = this.leads.map((lead) =>
      String(lead.id) === id ? { ...lead, ...updates } : lead
    );
    this.lastUpdate = new Date();
    this.notify();
  }

  applyLeadsUpdater(updater: LeadRecord[] | ((prev: LeadRecord[]) => LeadRecord[])) {
    this.leads = typeof updater === 'function' ? updater(this.leads) : updater;
    this.lastUpdate = new Date();
    this.notify();
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.unsubscribeRecentEnquiries) {
      this.unsubscribeRecentEnquiries();
      this.unsubscribeRecentEnquiries = null;
    }
    if (this.nestPollTimer) {
      clearInterval(this.nestPollTimer);
      this.nestPollTimer = null;
    }
    this.centreId = null;
    this.role = null;
    this.leads = [];
    this.leadDocs = [];
    this.enquiryDocs = [];
    this.loading = false;
    this.isLive = false;
    this.hasSnapshot = false;
    this.nestMode = false;
    this.lastUpdate = null;
    this.notify();
  }
}

export const centreDataStore = new CentreDataStore();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    centreDataStore.cleanup();
  });
}

import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type StaffStatus = 'active' | 'inactive' | 'on_leave';

export interface StaffDirectoryMember {
  id: string;
  centreId: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  designation: string;
  department?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  joiningDate?: Date;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  gender?: string;
  status: StaffStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StaffDirectoryInput = Omit<
  StaffDirectoryMember,
  'id' | 'createdAt' | 'updatedAt'
>;

const COLLECTION = 'staffDirectory';

function mapDoc(docSnap: { id: string; data: () => Record<string, unknown> }): StaffDirectoryMember {
  const data = docSnap.data();
  const toDate = (val: unknown) =>
    (val as { toDate?: () => Date })?.toDate?.() ?? undefined;
  return {
    id: docSnap.id,
    centreId: (data.centreId as string) || '',
    firstName: (data.firstName as string) || '',
    lastName: (data.lastName as string) || '',
    employeeId: data.employeeId as string | undefined,
    designation: (data.designation as string) || '',
    department: data.department as string | undefined,
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    address: data.address as string | undefined,
    dateOfBirth: toDate(data.dateOfBirth),
    joiningDate: toDate(data.joiningDate),
    emergencyContactName: data.emergencyContactName as string | undefined,
    emergencyContactPhone: data.emergencyContactPhone as string | undefined,
    gender: data.gender as string | undefined,
    status: (data.status as StaffStatus) || 'active',
    notes: data.notes as string | undefined,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

function toFirestorePayload(input: Partial<StaffDirectoryInput>) {
  const payload: Record<string, unknown> = { ...input };
  if (input.dateOfBirth) {
    payload.dateOfBirth = Timestamp.fromDate(
      input.dateOfBirth instanceof Date ? input.dateOfBirth : new Date(input.dateOfBirth)
    );
  }
  if (input.joiningDate) {
    payload.joiningDate = Timestamp.fromDate(
      input.joiningDate instanceof Date ? input.joiningDate : new Date(input.joiningDate)
    );
  }
  return payload;
}

export function getFullName(member: Pick<StaffDirectoryMember, 'firstName' | 'lastName'>) {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function formatDate(date?: Date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getYearsSince(date?: Date) {
  if (!date) return 0;
  const today = new Date();
  let years = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

export function daysUntilNextOccurrence(date?: Date): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isThisMonth(date?: Date) {
  if (!date) return false;
  const today = new Date();
  return date.getMonth() === today.getMonth();
}

class StaffDirectoryService {
  static async getByCentre(centreId: string): Promise<StaffDirectoryMember[]> {
    if (!db || !centreId.trim()) return [];
    try {
      const q = query(
        collection(db, COLLECTION),
        where('centreId', '==', centreId.trim()),
        orderBy('firstName', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(mapDoc);
    } catch {
      const fallback = query(
        collection(db, COLLECTION),
        where('centreId', '==', centreId.trim())
      );
      const snapshot = await getDocs(fallback);
      const members = snapshot.docs.map(mapDoc);
      members.sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
      return members;
    }
  }

  static async create(data: StaffDirectoryInput): Promise<string> {
    if (!db) throw new Error('Database not available');
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...toFirestorePayload(data),
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  static async update(id: string, data: Partial<StaffDirectoryInput>): Promise<void> {
    if (!db) throw new Error('Database not available');
    await updateDoc(doc(db, COLLECTION, id), {
      ...toFirestorePayload(data),
      updatedAt: Timestamp.now(),
    });
  }

  static async remove(id: string): Promise<void> {
    if (!db) throw new Error('Database not available');
    await deleteDoc(doc(db, COLLECTION, id));
  }
}

export default StaffDirectoryService;

import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface StaffMember {
  id: string;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  address?: string;
  joiningDate?: Date;
  status: 'active' | 'inactive' | 'suspended';
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
  approved: boolean;
  centreId?: string;
  lastLoginTime?: Date;
  lastLogoutTime?: Date;
  isOnline?: boolean;
}

function mapStaffDoc(docSnap: { id: string; data: () => Record<string, unknown> }): StaffMember {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    joiningDate: (data.joiningDate as { toDate?: () => Date })?.toDate?.(),
    lastLoginTime: (data.lastLoginTime as { toDate?: () => Date })?.toDate?.(),
    lastLogoutTime: (data.lastLogoutTime as { toDate?: () => Date })?.toDate?.(),
  } as StaffMember;
}

function dedupeStaffByEmail(docs: Array<{ id: string; data: () => Record<string, unknown> }>): StaffMember[] {
  const byEmail = new Map<string, StaffMember>();
  docs.forEach((docSnap) => {
    const member = mapStaffDoc(docSnap);
    const key = member.email?.toLowerCase?.() || member.email;
    const existing = byEmail.get(key);
    if (!existing || member.updatedAt > existing.updatedAt) {
      byEmail.set(key, member);
    }
  });
  const staffMembers = [...byEmail.values()];
  staffMembers.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  return staffMembers;
}

class StaffSyncService {
  /** Load staff for one centre only — call when Staff page is open. */
  static async getStaffByCentre(centreId: string): Promise<StaffMember[]> {
    if (!db || !centreId.trim()) return [];
    try {
      const staffQuery = query(
        collection(db, 'staff'),
        where('centreId', '==', centreId.trim()),
        orderBy('createdAt', 'desc')
      );
      const staffSnapshot = await getDocs(staffQuery);
      return dedupeStaffByEmail(staffSnapshot.docs);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching staff by centre:', error);
      }
      return [];
    }
  }

  static async updateStaffOnlineStatus(
    email: string,
    isOnline: boolean,
    lastLoginTime?: Date,
    lastLogoutTime?: Date
  ): Promise<void> {
    if (!db) return;
    try {
      const staffQuery = query(collection(db, 'staff'), where('email', '==', email));
      const staffSnapshot = await getDocs(staffQuery);

      if (staffSnapshot.docs.length > 0) {
        const staffDoc = staffSnapshot.docs[0];
        const updates: Record<string, unknown> = {
          isOnline,
          updatedAt: Timestamp.fromDate(new Date()),
        };
        if (lastLoginTime) updates.lastLoginTime = Timestamp.fromDate(lastLoginTime);
        if (lastLogoutTime) updates.lastLogoutTime = Timestamp.fromDate(lastLogoutTime);
        await updateDoc(doc(db, 'staff', staffDoc.id), updates);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`Error updating online status for ${email}:`, error);
      }
    }
  }

  static async getStaffByEmail(email: string): Promise<StaffMember | null> {
    if (!db) return null;
    try {
      const staffQuery = query(collection(db, 'staff'), where('email', '==', email));
      const staffSnapshot = await getDocs(staffQuery);
      if (staffSnapshot.docs.length > 0) {
        return mapStaffDoc(staffSnapshot.docs[0]);
      }
      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`Error fetching staff by email ${email}:`, error);
      }
      return null;
    }
  }
}

export default StaffSyncService;

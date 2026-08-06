import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class FirebaseService {
  // Get students
  static async getStudents(centreId?: string): Promise<any[]> {
    try {
      let q = collection(db, 'students');
      
      if (centreId) {
        q = query(q, where('centreId', '==', centreId));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  }

  // Create student
  static async createStudent(studentData: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...studentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newDoc = await getDoc(docRef);
      return { id: docRef.id, ...newDoc.data() };
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }

  // Update student
  static async updateStudent(id: string, studentData: any): Promise<void> {
    try {
      const docRef = doc(db, 'students', id);
      await updateDoc(docRef, {
        ...studentData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  }

  // Delete student
  static async deleteStudent(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'students', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }

  // Get leads
  static async getLeads(centreId?: string): Promise<any[]> {
    try {
      let q = collection(db, 'leads');
      
      if (centreId) {
        q = query(q, where('centreId', '==', centreId));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  }

  // Create lead
  static async createLead(leadData: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        ...leadData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newDoc = await getDoc(docRef);
      return { id: docRef.id, ...newDoc.data() };
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  // Get dashboard stats
  static async getDashboardStats(centreId?: string): Promise<any> {
    try {
      // Get basic stats
      const students = await this.getStudents(centreId);
      const leads = await this.getLeads(centreId);
      return {
        totalStudents: students.length,
        totalLeads: leads.length
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
}

export default FirebaseService; 

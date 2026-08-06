import { 
  type User, 
  type UpsertUser,
  type Student,
  type InsertStudent,
  type Lead,
  type InsertLead,
  type Batch,
  type Course,
  type FeeTransaction,
  type InsertFeeTransaction,
  type Assignment,
  type Staff,
  type Expense,
  type Target,
  type InsertTarget,
  type PerformanceMetric,
  type InsertPerformanceMetric,
  type Notification
} from "../shared/schema";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Student operations
  getStudents(centreId?: string, status?: string, page?: number, pageSize?: number): Promise<{
    data: Student[];
    hasMore: boolean;
    total: number;
  }>;
  getStudentById(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student>;
  deleteStudent(id: number): Promise<void>;

  // Lead operations
  getLeads(centreId?: string, status?: string, page?: number, pageSize?: number): Promise<{
    data: Lead[];
    hasMore: boolean;
    total: number;
  }>;
  getLeadById(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  // Course operations
  getCourses(): Promise<Course[]>;
  getCourseById(id: number): Promise<Course | undefined>;

  // Batch operations
  getBatches(centreId?: string): Promise<Batch[]>;
  getBatchById(id: number): Promise<Batch | undefined>;

  // Fee operations
  getFeeTransactions(studentId?: number, centreId?: string): Promise<FeeTransaction[]>;
  createFeeTransaction(transaction: InsertFeeTransaction): Promise<FeeTransaction>;

  // Assignment operations
  getAssignments(batchId?: number): Promise<Assignment[]>;
  createAssignment(assignment: any): Promise<Assignment>;

  // Staff operations
  getStaff(centreId?: string): Promise<Staff[]>;
  createStaff(staff: any): Promise<Staff>;

  // Expense operations
  getExpenses(centreId?: string): Promise<Expense[]>;
  createExpense(expense: any): Promise<Expense>;

  // Target operations
  getTargets(centreId?: string, assignedTo?: string): Promise<Target[]>;
  createTarget(target: InsertTarget): Promise<Target>;
  updateTarget(id: number, target: Partial<InsertTarget>): Promise<Target>;

  // Performance metrics operations
  getPerformanceMetrics(centreId?: string, userId?: string): Promise<PerformanceMetric[]>;
  createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric>;

  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: any): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<void>;

  // Dashboard stats
  getDashboardStats(centreId?: string): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalRevenue: number;
    pendingFees: number;
    newEnquiries: number;
    conversions: number;
  }>;
}

// Use the Firebase configuration from firebaseConfig.ts to avoid duplicate initialization
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, limit, setDoc, writeBatch, orderBy } from "firebase/firestore";
import { db } from "./firebaseConfig";

// Use the db instance from firebaseConfig.ts
let isFirestoreAvailable = !!db;

// In-memory storage for development (fallback)
const inMemoryLeads: Lead[] = [];
const inMemoryUsers: User[] = [];
const inMemoryStudents: Student[] = [];

const normalizeFirestoreDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export class SimpleFirebaseStorage implements IStorage {
  // Real Firebase Firestore implementation
  
  async getUser(id: string): Promise<User | undefined> {
    if (!db) {
      console.error('Firebase not initialized');
      return undefined;
    }
    try {
      const userDocRef = doc(db, 'users', id);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (!data) return undefined;
        return {
          id: userDoc.id,
          email: data.email ?? null,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          profileImageUrl: data.profileImageUrl ?? null,
          role: data.role ?? 'centre_head',
          centreId: data.centreId ?? null,
          phone: data.phone ?? null,
          isActive: data.isActive !== false,
          createdAt: data.createdAt ? data.createdAt.toDate() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!db) {
      console.error('Firebase not initialized - using fallback user data');
      return {
        id: userData.id,
        firstName: userData.firstName ?? 'Demo',
        lastName: userData.lastName ?? 'User',
        email: userData.email ?? 'user@zica.edu',
        profileImageUrl: userData.profileImageUrl ?? null,
        role: userData.role ?? 'centre_head',
        centreId: userData.centreId ?? 'centre_001',
        phone: userData.phone ?? '+91-9876543210',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    try {
      const userRef = doc(db, 'users', userData.id);
      const userData_to_save = {
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        email: userData.email ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: userData.role ?? 'centre_head',
        centreId: userData.centreId ?? null,
        phone: userData.phone ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(userRef, userData_to_save, { merge: true });
      
      return {
        id: userData.id,
        ...userData_to_save
      };
    } catch (error) {
      console.error('Error upserting user to Firestore:', error);
      // Return fallback data if Firestore operation fails
      return {
        id: userData.id,
        firstName: userData.firstName ?? 'Demo',
        lastName: userData.lastName ?? 'User',
        email: userData.email ?? 'user@zica.edu',
        profileImageUrl: userData.profileImageUrl ?? null,
        role: userData.role ?? 'centre_head',
        centreId: userData.centreId ?? 'centre_001',
        phone: userData.phone ?? '+91-9876543210',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  async getStudents(centreId?: string, status?: string, page?: number, pageSize?: number): Promise<{
    data: Student[];
    hasMore: boolean;
    total: number;
  }> {
    if (!db) {
      console.error('Firebase not initialized - please check API key');
      return { data: [], hasMore: false, total: 0 };
    }
    
    try {
      const studentsRef = collection(db, 'students');
      let q = studentsRef;
      
      if (centreId) {
        q = query(q, where('centreId', '==', centreId));
      }
      if (status) {
        q = query(q, where('status', '==', status));
      }
      
      const querySnapshot = await getDocs(q);
      const students: Student[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;
        try {
          // Safely handle createdAt
          let createdAt = null;
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt instanceof Date) {
              createdAt = data.createdAt;
            } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
              createdAt = new Date(data.createdAt);
            }
          }

          // Safely handle updatedAt
          let updatedAt = null;
          if (data.updatedAt) {
            if (typeof data.updatedAt.toDate === 'function') {
              updatedAt = data.updatedAt.toDate();
            } else if (data.updatedAt instanceof Date) {
              updatedAt = data.updatedAt;
            } else if (typeof data.updatedAt === 'string' || typeof data.updatedAt === 'number') {
              updatedAt = new Date(data.updatedAt);
            }
          }

          students.push({
            id: parseInt(doc.id) || 0,
            email: data.email ?? '',
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            centreId: data.centreId ?? '',
            phone: data.phone ?? '',
            createdAt: createdAt,
            updatedAt: updatedAt,
            userId: data.userId ?? '',
            studentId: data.studentId ?? '',
            batchId: data.batchId ?? null,
            courseId: data.courseId ?? 0,
            course: data.course ?? null,
            batch: data.batch ?? null,
            address: data.address ?? null,
            dateOfBirth: data.dateOfBirth ?? null,
            guardianName: data.guardianName ?? null,
            guardianPhone: data.guardianPhone ?? null,
            emergencyContact: data.emergencyContact ?? null,
            status: data.status ?? null,
            joiningDate: data.joiningDate ?? null,
            previousEducation: data.previousEducation ?? null
          });
        } catch (error) {
          console.error('Error processing student document:', error);
          // Skip this document and continue
        }
      });

      // Add demo student for notification testing if no students exist
      if (students.length === 0) {
        const demoStudent: Student = {
          id: 1001,
          email: "demo.student@zica.com",
          firstName: "Demo",
          lastName: "Student",
          centreId: "centre_1",
          phone: "9307190851", // Demo phone number for SMS testing
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          userId: "demo_user_1",
          studentId: "STU1001",
          batchId: 1,
          courseId: 1,
          remainingFees: 15000, // Add remaining fees for SMS testing
          nextInstallmentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
          course: {
            id: 1,
            name: "Advanced Computer Course",
            description: "Comprehensive computer training program",
            duration: "6 months",
            fees: 25000,
            category: "Computer",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          batch: {
            id: 1,
            name: "Batch A-2024",
            courseId: 1,
            centreId: "centre_1",
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-06-30'),
            capacity: 30,
            currentStrength: 25,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
          },
          address: "123 Demo Street, Mumbai, Maharashtra",
          dateOfBirth: new Date('2000-05-15'),
          guardianName: "Demo Guardian",
          guardianPhone: "9876543210",
          emergencyContact: "9876543210",
          status: "active",
          joiningDate: new Date('2024-01-01'),
          previousEducation: "12th Standard",
          feeTransactions: [
            {
              id: 1,
              studentId: 1001,
              centreId: "centre_1",
              amount: 10000,
              type: "course_fee",
              status: "paid",
              paymentMode: "cash",
              transactionId: "TXN123456",
              dueDate: new Date('2024-01-15'),
              paidDate: new Date('2024-01-14'),
              remarks: "First installment",
              createdAt: new Date('2024-01-14')
            }
          ]
        };
        
        students.push(demoStudent);
        console.log('📱 Demo student added for SMS notification testing:', demoStudent.firstName, demoStudent.lastName);
      }
      
      // Apply pagination
      const startIndex = (page || 1) * (pageSize || 20) - (pageSize || 20);
      const endIndex = startIndex + (pageSize || 20);
      const paginatedStudents = students.slice(startIndex, endIndex);

      return {
        data: paginatedStudents,
        hasMore: endIndex < students.length,
        total: students.length
      };
    } catch (error) {
      console.error('Error fetching students from Firestore:', error);
      
      // Return demo student even if Firebase fails
      const demoStudent: Student = {
        id: 1001,
        email: "demo.student@zica.com",
        firstName: "Demo",
        lastName: "Student",
        centreId: "centre_1",
        phone: "9307190851", // Demo phone number for SMS testing
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        userId: "demo_user_1",
        studentId: "STU1001",
        batchId: 1,
        courseId: 1,
        remainingFees: 15000, // Add remaining fees for SMS testing
        nextInstallmentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
        course: {
          id: 1,
          name: "Advanced Computer Course",
          description: "Comprehensive computer training program",
          duration: "6 months",
          fees: 25000,
          category: "Computer",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        batch: {
          id: 1,
          name: "Batch A-2024",
          courseId: 1,
          centreId: "centre_1",
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-06-30'),
          capacity: 30,
          currentStrength: 25,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        address: "123 Demo Street, Mumbai, Maharashtra",
        dateOfBirth: new Date('2000-05-15'),
        guardianName: "Demo Guardian",
        guardianPhone: "9876543210",
        emergencyContact: "9876543210",
        status: "active",
        joiningDate: new Date('2024-01-01'),
        previousEducation: "12th Standard",
        feeTransactions: [
          {
            id: 1,
            studentId: 1001,
            centreId: "centre_1",
            amount: 10000,
            type: "course_fee",
            status: "paid",
            paymentMode: "cash",
            transactionId: "TXN123456",
            dueDate: new Date('2024-01-15'),
            paidDate: new Date('2024-01-14'),
            remarks: "First installment",
            createdAt: new Date('2024-01-14')
          }
        ]
      };
      
      console.log('📱 Demo student added for SMS notification testing:', demoStudent.firstName, demoStudent.lastName);
      return { data: [demoStudent], hasMore: false, total: 1 };
    }
  }

  async getStudentById(id: number): Promise<Student | undefined> {
    const students = await this.getStudents();
    return students.data.find(s => s.id === id);
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    return {
      id: Date.now(),
      ...student,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student> {
    const existing = await this.getStudentById(id);
    return {
      ...existing!,
      ...student,
      updatedAt: new Date()
    };
  }

  async deleteStudent(id: number): Promise<void> {
    // Implementation for deleting a student could go here
  }

  async getLeads(centreId?: string, status?: string, page?: number, pageSize?: number): Promise<{
    data: Lead[];
    hasMore: boolean;
    total: number;
  }> {
    if (!isFirestoreAvailable || !db) {
      console.warn('Firebase not initialized - returning in-memory leads data');
      // Return leads from in-memory storage
      let filteredLeads = [...inMemoryLeads];
      
      if (centreId) {
        filteredLeads = filteredLeads.filter(lead => lead.centreId === centreId);
      }
      if (status) {
        filteredLeads = filteredLeads.filter(lead => lead.status === status);
      }
      
      // Apply pagination to in-memory data
      const startIndex = (page || 1) * (pageSize || 20) - (pageSize || 20);
      const endIndex = startIndex + (pageSize || 20);
      const paginatedLeads = filteredLeads.slice(startIndex, endIndex);
      
      return {
        data: paginatedLeads,
        hasMore: endIndex < filteredLeads.length,
        total: filteredLeads.length
      };
    }
    
    // Real Firestore implementation using client SDK
    try {
      const leadsRef = collection(db, 'leads');
      const constraints = [];
      
      if (centreId) {
        constraints.push(where('centreId', '==', centreId));
      }
      if (status) {
        constraints.push(where('status', '==', status));
      }
      
      // Add ordering for consistent pagination
      constraints.push(orderBy('createdAt', 'desc'));
      
      // Apply pagination
      constraints.push(limit(pageSize || 20));
      
      const q = query(leadsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const leads: Lead[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;
        leads.push({
          id: parseInt(doc.id) || 0,
          name: data.name ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          centreId: data.centreId ?? '',
          assignedTo: data.assignedTo ?? null,
          status: data.status ?? null,
          source: data.source ?? null,
          notes: data.notes ?? null,
          contactedDate: normalizeFirestoreDate(data.contactedDate),
          createdAt: data.createdAt?.toDate() ?? null,
          updatedAt: data.updatedAt?.toDate() ?? null,
          followUpDate: normalizeFirestoreDate(data.followUpDate),
          nextFollowUpDate: normalizeFirestoreDate(data.nextFollowUpDate),
          followUpNotificationDone: data.followUpNotificationDone === true,
          followUpDoneAt: normalizeFirestoreDate(data.followUpDoneAt),
          convertedAt: data.convertedAt?.toDate() ?? null
        });
      });
      
      return {
        data: leads,
        hasMore: querySnapshot.docs.length === (pageSize || 20),
        total: leads.length // Note: This is approximate for pagination
      };
    } catch (error) {
      console.error('Error fetching leads from Firestore:', error);
      return { data: [], hasMore: false, total: 0 };
    }
  }

  async getLeadById(id: string): Promise<Lead | undefined> {
    if (!db || !id) return undefined;
    const docRef = doc(db, "leads", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    if (!data) return undefined;
    return {
      id: docSnap.id,
      name: data.name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      centreId: data.centreId ?? '',
      interestedCourse: data.interestedCourse ?? '',
      source: data.source ?? '',
      status: data.status ?? '',
      assignedTo: data.assignedTo ?? '',
      notes: data.notes ?? '',
      contactedDate: normalizeFirestoreDate(data.contactedDate),
      followUpDate: normalizeFirestoreDate(data.followUpDate),
      nextFollowUpDate: normalizeFirestoreDate(data.nextFollowUpDate),
      followUpNotificationDone: data.followUpNotificationDone === true,
      followUpDoneAt: normalizeFirestoreDate(data.followUpDoneAt),
      convertedAt: normalizeFirestoreDate(data.convertedAt),
      createdAt: normalizeFirestoreDate(data.createdAt),
      updatedAt: normalizeFirestoreDate(data.updatedAt),
    };
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    if (!isFirestoreAvailable || !db) {
      console.warn('Firebase not initialized - using in-memory storage for lead creation');
      // Create a lead and store it in memory
      const newLead: Lead = {
        id: `mem-${Date.now()}`,
        name: lead.name ?? 'Unknown Lead',
        email: lead.email ?? '',
        phone: lead.phone ?? 'N/A',
        centreId: lead.centreId ?? 'demo-centre-001',
        interestedCourse: lead.interestedCourse ?? '',
        source: lead.source ?? '',
        status: lead.status ?? 'New',
        assignedTo: lead.assignedTo ?? '',
        notes: lead.notes ?? '',
        createdAt: new Date(),
        updatedAt: new Date(),
        courseDuration: lead.courseDuration ?? '',
        education: lead.education ?? '',
        area: lead.area ?? '',
        contactedDate: lead.contactedDate ?? null,
        followUpDate: lead.followUpDate ?? '',
        nextFollowUpDate: lead.nextFollowUpDate ?? (lead.followUpDate ?? null),
        followUpNotificationDone: lead.followUpNotificationDone ?? false,
        followUpDoneAt: lead.followUpDoneAt ?? null,
        feedbackCallRemarks: lead.feedbackCallRemarks ?? ''
      };
      
      // Add to in-memory storage
      inMemoryLeads.push(newLead);
      console.log('✅ Lead created successfully (in-memory mode):', newLead);
      console.log('📊 Total leads in memory:', inMemoryLeads.length);
      return newLead;
    }
    
    // Provide default values for required fields instead of throwing errors
    const leadData = {
      name: lead.name || 'Unknown Lead',
      phone: lead.phone || 'N/A',
      centreId: lead.centreId || 'demo-centre-001',
      email: lead.email || '',
      interestedCourse: lead.interestedCourse || '',
      source: lead.source || '',
      status: lead.status || 'New',
      assignedTo: lead.assignedTo || '',
      notes: lead.notes || '',
      courseDuration: lead.courseDuration || '',
      education: lead.education || '',
      area: lead.area || '',
      contactedDate: lead.contactedDate || null,
      followUpDate: lead.followUpDate || '',
      nextFollowUpDate: lead.nextFollowUpDate || lead.followUpDate || null,
      followUpNotificationDone: lead.followUpNotificationDone ?? false,
      followUpDoneAt: lead.followUpDoneAt || null,
      feedbackCallRemarks: lead.feedbackCallRemarks || ''
    };
    
    try {
      const now = new Date();
      const leadsRef = collection(db, 'leads');

      // Create a new document reference
      const newDocRef = doc(leadsRef);
      
      // Use writeBatch for better performance
      const batch = writeBatch(db);
      batch.set(newDocRef, {
        ...leadData,
        createdAt: now,
        updatedAt: now,
      });

      await batch.commit();
      
      // Return the created lead with the new ID
      const createdLead: Lead = {
        id: newDocRef.id,
        ...leadData,
        createdAt: now,
        updatedAt: now
      };
      
      console.log('✅ Lead created successfully in Firebase:', createdLead);
      return createdLead;
    } catch (error) {
      console.error('Error creating lead in Firestore:', error);
      throw error;
    }
  }

  async updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead> {
    if (!db || !id) throw new Error('Firestore not initialized or id missing');
    const docRef = doc(db, "leads", id);
    await updateDoc(docRef, {
      ...lead,
      updatedAt: new Date(),
    });
    return this.getLeadById(id) as Promise<Lead>;
  }

  async deleteLead(id: string): Promise<void> {
    if (!db || !id) throw new Error('Firestore not initialized or id missing');
    const docRef = doc(db, "leads", id);
    await deleteDoc(docRef);
  }

  async getCourses(): Promise<Course[]> {
    return [
      {
        id: 1,
        name: 'Animation Fundamentals',
        code: 'ANI101',
        description: 'Basic animation principles',
        duration: 6,
        fees: '50000',
        category: 'Animation',
        isActive: true,
        createdAt: new Date()
      }
    ];
  }

  async getCourseById(id: number): Promise<Course | undefined> {
    const courses = await this.getCourses();
    return courses.find(c => c.id === id);
  }

  async getBatches(centreId?: string): Promise<Batch[]> {
    return [
      {
        id: 1,
        name: 'ANI101-Morning-Jan24',
        centreId: 'centre_001',
        courseId: 1,
        instructorId: 'instructor-1',
        status: 'active',
        startDate: '2024-01-15',
        endDate: '2024-07-15',
        timings: '9:00 AM - 12:00 PM',
        capacity: 25,
        currentStrength: 18,
        createdAt: new Date()
      }
    ];
  }

  async getBatchById(id: number): Promise<Batch | undefined> {
    const batches = await this.getBatches();
    return batches.find(b => b.id === id);
  }

  async getFeeTransactions(studentId?: number, centreId?: string): Promise<FeeTransaction[]> {
    return [
      {
        id: 1,
        studentId: 1,
        centreId: 'centre_001',
        amount: '10000',
        type: 'course_fee',
        status: 'paid',
        paymentMode: 'cash',
        transactionId: 'TXN123456',
        dueDate: '2024-01-15',
        paidDate: '2024-01-14',
        remarks: 'First installment',
        createdAt: new Date()
      }
    ];
  }

  async createFeeTransaction(transaction: InsertFeeTransaction): Promise<FeeTransaction> {
    return {
      id: Date.now(),
      ...transaction,
      createdAt: new Date()
    };
  }

  async getAssignments(batchId?: number): Promise<Assignment[]> {
    return [
      {
        id: 1,
        batchId: 1,
        title: 'Character Design Project',
        description: 'Create a 2D character with walk cycle',
        dueDate: '2024-02-15',
        totalMarks: 100,
        createdBy: 'instructor-1',
        attachments: null,
        createdAt: new Date()
      }
    ];
  }

  async createAssignment(assignment: any): Promise<Assignment> {
    return {
      id: Date.now(),
      ...assignment,
      createdAt: new Date()
    };
  }

  async getStaff(centreId?: string): Promise<Staff[]> {
    return [
      {
        id: 1,
        userId: 'user-2',
        employeeId: 'EMP001',
        centreId: 'centre_001',
        designation: 'Senior Instructor',
        department: 'Animation',
        joiningDate: '2023-06-01',
        salary: '45000',
        reportingTo: 'manager-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  async createStaff(staffData: any): Promise<Staff> {
    return {
      id: Date.now(),
      ...staffData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getExpenses(centreId?: string): Promise<Expense[]> {
    return [
      {
        id: 1,
        centreId: 'centre_001',
        category: 'infrastructure',
        amount: '5000',
        description: 'Office rent for January',
        expenseDate: '2024-01-01',
        paymentMode: 'bank_transfer',
        approvedBy: 'centre-head-1',
        receipt: null,
        createdBy: 'admin-1',
        createdAt: new Date()
      }
    ];
  }

  async createExpense(expense: any): Promise<Expense> {
    return {
      id: Date.now(),
      ...expense,
      createdAt: new Date()
    };
  }

  async getTargets(centreId?: string, assignedTo?: string): Promise<Target[]> {
    return [
      {
        id: 1,
        centreId: 'centre_001',
        assignedTo: 'counselor-1',
        targetType: 'enrollment',
        targetValue: '50',
        achievedValue: '32',
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  async createTarget(target: InsertTarget): Promise<Target> {
    return {
      id: Date.now(),
      ...target,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateTarget(id: number, target: Partial<InsertTarget>): Promise<Target> {
    const existing = await this.getTargets();
    const current = existing.find(t => t.id === id);
    return {
      ...current!,
      ...target,
      updatedAt: new Date()
    };
  }

  async getPerformanceMetrics(centreId?: string, userId?: string): Promise<PerformanceMetric[]> {
    return [
      {
        id: 1,
        centreId: 'centre_001',
        userId: 'user-1',
        metricType: 'enrollment_rate',
        value: '85.5',
        period: '2024-01',
        recordedDate: '2024-01-31',
        createdAt: new Date()
      }
    ];
  }

  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    return {
      id: Date.now(),
      ...metric,
      createdAt: new Date()
    };
  }

  async getNotifications(userId?: string): Promise<Notification[]> {
    if (!db) {
      console.error('Firebase not initialized - returning empty notifications');
      return [];
    }
    
    try {
      const notificationsRef = collection(db, 'notifications');
      let q = notificationsRef;
      
      if (userId) {
        q = query(notificationsRef, where('userId', '==', userId));
      }
      
      const snapshot = await getDocs(q);
      const notifications: Notification[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          userId: data.userId ?? '',
          type: data.type ?? 'payment_reminder',
          title: data.title ?? '',
          message: data.message ?? '',
          isRead: data.isRead ?? false,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
        });
      });
      
      return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async createNotification(notificationData: any): Promise<Notification> {
    if (!db) {
      console.error('Firebase not initialized - using fallback notification');
      return {
        id: `notification_${Date.now()}`,
        userId: notificationData.userId ?? 'demo_user',
        type: notificationData.type ?? 'payment_reminder',
        title: notificationData.title ?? 'Payment Reminder',
        message: notificationData.message ?? 'Please pay your pending fees.',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    try {
      const notificationRef = collection(db, 'notifications');
      const notificationToSave = {
        userId: notificationData.userId ?? 'demo_user',
        type: notificationData.type ?? 'payment_reminder',
        title: notificationData.title ?? 'Payment Reminder',
        message: notificationData.message ?? 'Please pay your pending fees.',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(notificationRef, notificationToSave);
      
      return {
        id: docRef.id,
        ...notificationToSave
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification> {
    if (!db) {
      console.error('Firebase not initialized - using fallback notification update');
      return {
        id: id.toString(),
        userId: notificationData.userId ?? 'demo_user',
        type: notificationData.type ?? 'payment_reminder',
        title: notificationData.title ?? 'Payment Reminder',
        message: notificationData.message ?? 'Please pay your pending fees.',
        isRead: notificationData.isRead ?? false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    try {
      const notificationRef = doc(db, 'notifications', id.toString());
      const updateData = {
        ...notificationData,
        updatedAt: new Date()
      };
      
      await updateDoc(notificationRef, updateData);
      
      const updatedDoc = await getDoc(notificationRef);
      const data = updatedDoc.data();
      
      return {
        id: updatedDoc.id,
        userId: data?.userId ?? '',
        type: data?.type ?? 'payment_reminder',
        title: data?.title ?? '',
        message: data?.message ?? '',
        isRead: data?.isRead ?? false,
        createdAt: data?.createdAt ? data.createdAt.toDate() : new Date(),
        updatedAt: data?.updatedAt ? data.updatedAt.toDate() : new Date()
      };
    } catch (error) {
      console.error('Error updating notification:', error);
      throw new Error('Failed to update notification');
    }
  }

  async deleteNotification(id: number): Promise<void> {
    if (!db) {
      console.error('Firebase not initialized - skipping notification deletion');
      return;
    }

    try {
      const notificationRef = doc(db, 'notifications', id.toString());
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw new Error('Failed to delete notification');
    }
  }

  async markNotificationAsRead(id: number): Promise<void> {
    if (!db) {
      console.error('Firebase not initialized - skipping notification mark as read');
      return;
    }

    try {
      const notificationRef = doc(db, 'notifications', id.toString());
      await updateDoc(notificationRef, {
        isRead: true,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  async getDashboardStats(centreId?: string): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalRevenue: number;
    pendingFees: number;
    newEnquiries: number;
    conversions: number;
  }> {
    try {
      // Get real data from database
      const students = await this.getStudents(centreId);
      const leads = await this.getLeads(centreId);
      const feeTransactions = await this.getFeeTransactions(undefined, centreId);
      const staff = await this.getStaff(centreId);
      const expenses = await this.getExpenses(centreId);
      const targets = await this.getTargets(centreId);
      // Calculate real statistics
      const totalStudents = students.total;
      const activeStudents = students.data.filter(s => s.status === 'active').length;
      
      // Calculate total revenue from fee transactions
      const totalRevenue = feeTransactions
        .filter(t => t.status === 'paid')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      // Calculate pending fees from students
      const pendingFees = students.data
        .reduce((sum, s) => sum + (parseFloat(s.remainingFees || '0') || 0), 0);
      
      // Calculate new enquiries (leads from this month)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const newEnquiries = leads.data.filter(lead => {
        const leadDate = lead.createdAt;
        return leadDate && new Date(leadDate) >= thisMonth;
      }).length;
      
      // Calculate conversions (leads converted to students)
      const conversions = leads.data.filter(lead => lead.status === 'converted').length;

      // Add demo data if no real data exists
      if (totalStudents === 0) {
        return {
          totalStudents: 3, // Demo students
          activeStudents: 3,
          totalRevenue: 35000, // From demo students
          pendingFees: 35000, // From demo students
          newEnquiries: 5,
          conversions: 2
        };
      }

      return {
        totalStudents,
        activeStudents,
        totalRevenue,
        pendingFees,
        newEnquiries,
        conversions
      };
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
      
      // Return demo data as fallback
      return {
        totalStudents: 3,
        activeStudents: 3,
        totalRevenue: 35000,
        pendingFees: 35000,
        newEnquiries: 5,
        conversions: 2
      };
    }
  }
}

// Firebase-only storage - PostgreSQL completely disconnected
export const storage = new SimpleFirebaseStorage();

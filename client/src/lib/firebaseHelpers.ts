import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, enableNetwork, disableNetwork, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { firebaseCache } from './firebaseCache';

// Connection management
let isConnected = true;
let connectionRetries = 0;
const MAX_RETRIES = 3;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // Only check connection every 30 seconds

const checkConnection = async () => {
  if (!db) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Database not initialized in checkConnection');
    }
    return false;
  }

  // Use cached connection status if checked recently
  const now = Date.now();
  if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL && isConnected) {
    return true;
  }
  
  try {
    // Optimized: Use a lightweight check instead of a full query
    // Just check if db is available, don't make actual query
    if (db && db.app) {
      isConnected = true;
      connectionRetries = 0;
      lastConnectionCheck = now;
      return true;
    }
    isConnected = false;
    return false;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Firestore connection check failed:', error.message);
    }
    isConnected = false;
    lastConnectionCheck = now;
    return false;
  }
};

const retryOperation = async (operation: () => Promise<any>, maxRetries = MAX_RETRIES) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check connection before each retry
      if (!isConnected) {
        await checkConnection();
      }
      
      return await operation();
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error.message);
      }
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

// Firestore helpers for CRM data
export const firebaseHelpers = {
  // Connection management
  async checkConnection() {
    return await checkConnection();
  },

  async enableNetwork() {
    if (db) {
      try {
        await enableNetwork(db);
        isConnected = true;
        if (process.env.NODE_ENV === 'development') {
        console.log('✅ Firestore network enabled');
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Failed to enable Firestore network:', error);
        }
      }
    }
  },

  async disableNetwork() {
    if (db) {
      try {
        await disableNetwork(db);
        isConnected = false;
        if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Firestore network disabled');
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Failed to disable Firestore network:', error);
        }
      }
    }
  },

  // Student management
  async saveStudent(studentData: any) {
    if (!db) return null;
    try {
      const result = await retryOperation(async () => {
        // Convert Date objects to Timestamps
        const processedData = { ...studentData };
        Object.keys(processedData).forEach(key => {
          if (processedData[key] instanceof Date) {
            processedData[key] = Timestamp.fromDate(processedData[key]);
          }
        });
        
        const docRef = await addDoc(collection(db, 'students'), {
          ...processedData,
          createdAt: studentData.createdAt instanceof Date ? Timestamp.fromDate(studentData.createdAt) : Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        return docRef.id;
      });
      
      // Invalidate cache after save
      firebaseCache.invalidatePattern('students');
      
      return result;
    } catch (error) {
      console.error('❌ Error saving student:', error);
      return null;
    }
  },
  
  // Certificate management
  async saveCertificate(certData: any) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = await addDoc(collection(db, 'certificates'), {
          ...certData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        return docRef.id;
      });
    } catch (error) {
      console.error('❌ Error saving certificate:', error);
      return null;
    }
  },

  async getCertificates(centreId?: string) {
    if (!db) return [];
    try {
      return await retryOperation(async () => {
        let q;
        if (centreId) {
          q = query(collection(db, 'certificates'), where('centreId', '==', centreId));
        } else {
          q = query(collection(db, 'certificates'));
        }
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });
    } catch (error) {
      console.error('❌ Error fetching certificates:', error);
      return [];
    }
  },

  async updateCertificate(id: string, certData: any) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = doc(db, 'certificates', id);
        await setDoc(docRef, { ...certData, updatedAt: Timestamp.now() }, { merge: true });
        return id;
      });
    } catch (error) {
      console.error('❌ Error updating certificate:', error);
      return null;
    }
  },

  async deleteCertificate(id: string) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = doc(db, 'certificates', id);
        await deleteDoc(docRef);
        return id;
      });
    } catch (error) {
      console.error('❌ Error deleting certificate:', error);
      return null;
    }
  },

  async getStudents(centreId?: string) {
    if (!db) {
      console.error('❌ Database not initialized');
      return [];
    }

    // Use cache with TTL
    const cacheKey = `students_${centreId || 'all'}`;
    
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await retryOperation(async () => {
            let docsToProcess: any[] = [];
            
            // If centreId is provided, use server-side filter
            if (centreId) {
              const q = query(collection(db, 'students'), where('centreId', '==', centreId));
              const querySnapshot = await getDocs(q);
              docsToProcess = querySnapshot.docs;
            } else {
              // No centreId provided, fetch all students
              const q = query(collection(db, 'students'));
              const querySnapshot = await getDocs(q);
              docsToProcess = querySnapshot.docs;
            }
            
            const students = docsToProcess.map(doc => {
              const data = doc.data();
              if (!data.centreId && centreId) {
                data.centreId = centreId;
              }
              // Normalize to consistent keys so edit form gets email, parentsContactNumber, etc.
              return {
                ...data,
                id: doc.id,
                centreId: data.centreId || '',
                srNo: data.srNo ?? doc.id,
                firstName: data.firstName || data.leadName || data.studentName || '',
                lastName: data.lastName || '',
                email: data.email || data.emailId || '',
                phone: data.phone || data.contact || '',
                parentsContactNumber: data.parentsContactNumber || data.parentContact || data.parentsPhone || data.parentPhone || '',
                admissionMonth: data.admissionMonth || '',
                admissionDate: data.admissionDate || data.enquiryDate || data.createdAt,
                zicaZima: data.zicaZima || data.category || data.type || '',
                zicaSubCategory: data.zicaSubCategory || '',
                feesStructure: data.feesStructure || '',
                course: data.course || data.courseInterest || data.program || '',
                courseDuration: data.courseDuration || data.duration || '',
                courseStartDate: data.courseStartDate || data.startDate || data.admissionDate,
                actualFees: data.actualFees ?? data.fees ?? data.totalFees ?? 0,
                discountedFees: data.discountedFees ?? data.discount ?? 0,
                feesPaid: data.feesPaid ?? data.paidAmount ?? data.amountPaid ?? 0,
                feesPaidDate: data.feesPaidDate || data.paymentDate || data.lastPaymentDate,
                feesBalance: data.feesBalance ?? data.balance ?? data.remainingBalance ?? 0,
                paymentMode: data.paymentMode || data.paymentMethod || data.paymentType || '',
                chequeNumber: data.chequeNumber || '',
                noOfInstallments: data.noOfInstallments ?? data.installments ?? 0,
                installmentsPaid: data.installmentsPaid ?? data.paidInstallments ?? 0,
                remainingInstallments: data.remainingInstallments ?? '',
                dueDate: data.dueDate || data.nextPayment || data.paymentDue,
                remarks: data.remarks || data.notes || data.comments || data.feedback || '',
                status: data.status || 'active',
                source: data.source || data.leadSource || '',
                createdAt: data.createdAt || new Date(),
                updatedAt: data.updatedAt || new Date(),
              };
            });

            return students;
          });
        } catch (error) {
          console.error('❌ Error fetching students:', error);
          // Return cached data if available on error
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 2 * 60 * 1000, useLocalStorage: true } // 2 minute cache
    );
  },

  /** Fetch a single student by id from Firestore (no cache) - use for edit form to get latest email, parentsContactNumber, etc. */
  async getStudentById(id: string): Promise<Record<string, unknown> | null> {
    if (!db || !id) return null;
    try {
      const docRef = doc(db, 'students', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        ...data,
        id: snap.id,
        email: data?.email || data?.emailId || '',
        parentsContactNumber: data?.parentsContactNumber || data?.parentContact || data?.parentsPhone || data?.parentPhone || '',
        firstName: data?.firstName || data?.leadName || data?.studentName || '',
        lastName: data?.lastName || '',
        phone: data?.phone || data?.contact || '',
        source: data?.source || data?.leadSource || '',
      };
    } catch (error) {
      console.error('❌ Error fetching student by id:', error);
      return null;
    }
  },

  async getAllStudents() {
    if (!db) {
      console.error('❌ Database not initialized');
      return [];
    }

    // Use cache
    const cacheKey = 'students_all';
    
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await retryOperation(async () => {
            const q = query(collection(db, 'students'));
            const querySnapshot = await getDocs(q);
            
            const students = querySnapshot.docs.map(doc => {
              const data = doc.data();
              // Ensure all required fields have default values
              const enhancedData = {
                id: doc.id,
                centreId: data.centreId || '',
                srNo: data.srNo || doc.id,
                firstName: data.firstName || data.leadName || data.studentName || '',
                lastName: data.lastName || '',
                email: data.email || data.emailId || '',
                phone: data.phone || data.contact || '',
                admissionMonth: data.admissionMonth || '',
                admissionDate: data.admissionDate || data.enquiryDate || data.createdAt,
                zicaZima: data.zicaZima || data.category || data.type || '',
                feesStructure: data.feesStructure || '',
                course: data.course || data.courseInterest || data.program || '',
                courseDuration: data.courseDuration || data.duration || '',
                courseStartDate: data.courseStartDate || data.startDate || data.admissionDate,
                actualFees: data.actualFees || data.fees || data.totalFees || '0',
                discountedFees: data.discountedFees || data.discount || '0',
                feesPaid: data.feesPaid || data.paidAmount || data.amountPaid || '0',
                feesPaidDate: data.feesPaidDate || data.paymentDate || data.lastPaymentDate,
                feesBalance: data.feesBalance || data.balance || data.remainingBalance || '0',
                paymentMode: data.paymentMode || data.paymentMethod || data.paymentType || '',
                noOfInstallments: data.noOfInstallments || data.installments || '0',
                installmentsPaid: data.installmentsPaid || data.paidInstallments || '0',
                dueDate: data.dueDate || data.nextPayment || data.paymentDue,
                remarks: data.remarks || data.notes || data.comments || data.feedback || '',
                status: data.status || 'active',
                createdAt: data.createdAt || new Date(),
                updatedAt: data.updatedAt || new Date(),
                ...data // Keep any additional fields
              };
              return enhancedData;
            });
            
            return students;
          });
        } catch (error) {
          console.error('❌ Error fetching all students:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 2 * 60 * 1000, useLocalStorage: true } // 2 minute cache
    );
  },

  async updateStudent(id: string, studentData: any) {
    if (!db) return null;
    try {
      const result = await retryOperation(async () => {
        // Convert Date objects to Timestamps
        const processedData = { ...studentData };
        Object.keys(processedData).forEach(key => {
          if (processedData[key] instanceof Date) {
            processedData[key] = Timestamp.fromDate(processedData[key]);
          }
        });
        
        const docRef = doc(db, 'students', id);
        await setDoc(docRef, { ...processedData, updatedAt: Timestamp.now() }, { merge: true });
        return id;
      });
      
      // Invalidate cache after update
      firebaseCache.invalidatePattern('students');
      
      return result;
    } catch (error) {
      console.error('❌ Error updating student:', error);
      return null;
    }
  },

  async deleteStudent(id: string) {
    if (!db) return null;
    try {
      const result = await retryOperation(async () => {
        // Delete associated fee records first
        const feesQuery = query(collection(db, 'fees'), where('studentId', '==', id));
        const feesSnapshot = await getDocs(feesQuery);
        
        const deletePromises = feesSnapshot.docs.map(feeDoc => deleteDoc(feeDoc.ref));
        await Promise.all(deletePromises);

        // Delete associated GST records
        const gstQuery = query(collection(db, 'gstRecords'), where('studentId', '==', id));
        const gstSnapshot = await getDocs(gstQuery);
        const gstDeletePromises = gstSnapshot.docs.map(g => deleteDoc(g.ref));
        await Promise.all(gstDeletePromises);
        
        // Then delete the student
        const docRef = doc(db, 'students', id);
        await deleteDoc(docRef);
        return id;
      });
      
      // Invalidate cache after delete
      firebaseCache.invalidatePattern('students');
      firebaseCache.invalidatePattern('fees');
      firebaseCache.invalidatePattern('gstRecords');
      
      return result;
    } catch (error) {
      console.error('Error deleting student:', error);
      return null;
    }
  },

  // Lead management
  async saveLead(leadData: any) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = await addDoc(collection(db, 'leads'), {
          ...leadData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return docRef.id;
      });
    } catch (error) {
      console.error('Error saving lead:', error);
      return null;
    }
  },

  // File upload helper
  async uploadFile(file: File, path: string) {
    if (!storage) return null;
    try {
      return await retryOperation(async () => {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  },

  // Analytics data storage
  async logCRMActivity(activityData: any) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = await addDoc(collection(db, 'crm_activities'), {
          ...activityData,
          timestamp: new Date()
        });
        return docRef.id;
      });
    } catch (error) {
      console.error('Error logging CRM activity:', error);
      return null;
    }
  },

  // Fees management
  async getAllFees() {
    if (!db) return [];
    
    const cacheKey = 'fees_all';
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          return await retryOperation(async () => {
            const q = query(collection(db, 'fees'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          });
        } catch (error) {
          console.error('Error fetching fees:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 3 * 60 * 1000, useLocalStorage: true } // 3 minute cache
    );
  },
  async saveFee(feeData: any) {
    if (!db) return null;
    try {
      const result = await retryOperation(async () => {
        const docRef = await addDoc(collection(db, 'fees'), {
          ...feeData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return docRef.id;
      });
      firebaseCache.invalidatePattern('fees');
      return result;
    } catch (error) {
      console.error('Error saving fee:', error);
      return null;
    }
  },
  async updateFee(id: string, feeData: any) {
    if (!db) return null;
    try {
      const result = await retryOperation(async () => {
        const docRef = doc(db, 'fees', id);
        await setDoc(docRef, { ...feeData, updatedAt: new Date() }, { merge: true });
        return id;
      });
      firebaseCache.invalidatePattern('fees');
      return result;
    } catch (error) {
      console.error('Error updating fee:', error);
      return null;
    }
  },
  async deleteFee(id: string) {
    if (!db) return null;
    try {
      return await retryOperation(async () => {
        const docRef = doc(db, 'fees', id);
        await setDoc(docRef, {}, { merge: false });
        return id;
      });
    } catch (error) {
      console.error('Error deleting fee:', error);
      return null;
    }
  },

  // Folder-based Fees management
  async getAllFeesFolders() {
    if (!db) return [];
    
    const cacheKey = 'feesFolders_all';
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const q = query(collection(db, 'feesFolders'));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.error('Error fetching fees folders:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 3 * 60 * 1000, useLocalStorage: true }
    );
  },
  async createFeesFolder(folderName: string) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'feesFolders'), { name: folderName, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating fees folder:', error);
      return null;
    }
  },
  async addFeesRowsToFolder(folderId: string, rows: any[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'feesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const added = [];
      for (const row of rows) {
        const rowRef = await addDoc(rowsCol, { ...row, createdAt: new Date(), updatedAt: new Date() });
        added.push({ ...row, id: rowRef.id });
      }
      return added;
    } catch (error) {
      console.error('Error adding fees rows to folder:', error);
      return [];
    }
  },
  async getFeesRows(folderId: string) {
    if (!db) return [];
    try {
      console.log('Fetching fees rows for folder:', folderId);
      const folderRef = doc(db, 'feesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const querySnapshot = await getDocs(rowsCol);
      const rows = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Fetched fees rows:', rows);
      return rows;
    } catch (error) {
      console.error('Error fetching fees rows:', error);
      return [];
    }
  },
  async updateFeesRowInFolder(folderId: string, rowId: string, rowData: any) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'feesFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, { ...rowData, updatedAt: new Date() }, { merge: true });
      return rowId;
    } catch (error) {
      console.error('Error updating fees row:', error);
      return null;
    }
  },
  async deleteFeesRowInFolder(folderId: string, rowId: string) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'feesFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, {}, { merge: false });
      return rowId;
    } catch (error) {
      console.error('Error deleting fees row:', error);
      return null;
    }
  },
  async deleteFeesFolder(folderId: string) {
    if (!db) return null;
    try {
      // Delete all rows in the folder
      const folderRef = doc(db, 'feesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const rowsSnapshot = await getDocs(rowsCol);
      for (const rowDoc of rowsSnapshot.docs) {
        await deleteDoc(rowDoc.ref);
      }
      // Delete the folder document itself
      await deleteDoc(folderRef);
      return folderId;
    } catch (error) {
      console.error('Error deleting fees folder:', error);
      return null;
    }
  },

  // Curriculum management
  async getAllCurriculum() {
    if (!db) return [];
    try {
      const q = query(collection(db, 'curriculum'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching curriculum:', error);
      return [];
    }
  },
  async saveCurriculum(curriculumData: any) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'curriculum'), {
        ...curriculumData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving curriculum:', error);
      return null;
    }
  },
  async updateCurriculum(id: string, curriculumData: any) {
    if (!db) return null;
    try {
      const docRef = doc(db, 'curriculum', id);
      await setDoc(docRef, { ...curriculumData, updatedAt: new Date() }, { merge: true });
      return id;
    } catch (error) {
      console.error('Error updating curriculum:', error);
      return null;
    }
  },
  async deleteCurriculum(id: string) {
    if (!db) return null;
    try {
      const docRef = doc(db, 'curriculum', id);
      await setDoc(docRef, {}, { merge: false });
      return id;
    } catch (error) {
      console.error('Error deleting curriculum:', error);
      return null;
    }
  },

  // Folder-based Curriculum management
  async getAllCurriculumFolders() {
    if (!db) return [];
    
    const cacheKey = 'curriculumFolders_all';
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const q = query(collection(db, 'curriculumFolders'));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.error('Error fetching curriculum folders:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 3 * 60 * 1000, useLocalStorage: true }
    );
  },
  async createCurriculumFolder(folderName: string) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'curriculumFolders'), { name: folderName, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating curriculum folder:', error);
      return null;
    }
  },
  async addCurriculumRowsToFolder(folderId: string, rows: any[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'curriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const added = [];
      for (const row of rows) {
        const rowRef = await addDoc(rowsCol, { ...row, createdAt: new Date(), updatedAt: new Date() });
        added.push({ ...row, id: rowRef.id });
      }
      return added;
    } catch (error) {
      console.error('Error adding curriculum rows to folder:', error);
      return [];
    }
  },
  async getCurriculumRows(folderId: string) {
    if (!db) return [];
    try {
      const folderRef = doc(db, 'curriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const querySnapshot = await getDocs(rowsCol);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching curriculum rows:', error);
      return [];
    }
  },
  async updateCurriculumRowInFolder(folderId: string, rowId: string, rowData: any) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'curriculumFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, { ...rowData, updatedAt: new Date() }, { merge: true });
      return rowId;
    } catch (error) {
      console.error('Error updating curriculum row:', error);
      return null;
    }
  },
  async deleteCurriculumRowInFolder(folderId: string, rowId: string) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'curriculumFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, {}, { merge: false });
      return rowId;
    } catch (error) {
      console.error('Error deleting curriculum row:', error);
      return null;
    }
  },
  async deleteCurriculumFolder(folderId: string) {
    if (!db) return null;
    try {
      // Delete all rows in the folder
      const folderRef = doc(db, 'curriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const rowsSnapshot = await getDocs(rowsCol);
      for (const rowDoc of rowsSnapshot.docs) {
        await deleteDoc(rowDoc.ref);
      }
      // Delete the folder document itself
      await deleteDoc(folderRef);
      return folderId;
    } catch (error) {
      console.error('Error deleting curriculum folder:', error);
      return null;
    }
  },
  async setFeesFolderHeaders(folderId: string, headers: string[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'feesFolders', folderId);
      await setDoc(folderRef, { headers, updatedAt: new Date() }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error setting fees folder headers:', error);
      return false;
    }
  },
  async setCurriculumFolderHeaders(folderId: string, headers: string[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'curriculumFolders', folderId);
      await setDoc(folderRef, { headers, updatedAt: new Date() }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error setting curriculum folder headers:', error);
      return false;
    }
  },
  // ZIMA Fees management
  async getAllZimaFeesFolders() {
    if (!db) return [];
    
    const cacheKey = 'zimaFeesFolders_all';
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const q = query(collection(db, 'zimaFeesFolders'));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.error('Error fetching ZIMA fees folders:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 3 * 60 * 1000, useLocalStorage: true }
    );
  },
  async createZimaFeesFolder(folderName: string) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'zimaFeesFolders'), { name: folderName, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating ZIMA fees folder:', error);
      return null;
    }
  },
  async addZimaFeesRowsToFolder(folderId: string, rows: any[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'zimaFeesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const added = [];
      for (const row of rows) {
        const rowRef = await addDoc(rowsCol, { ...row, createdAt: new Date(), updatedAt: new Date() });
        added.push({ ...row, id: rowRef.id });
      }
      return added;
    } catch (error) {
      console.error('Error adding ZIMA fees rows to folder:', error);
      return [];
    }
  },
  async getZimaFeesRows(folderId: string) {
    if (!db) return [];
    try {
      console.log('Fetching ZIMA fees rows for folder:', folderId);
      const folderRef = doc(db, 'zimaFeesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const querySnapshot = await getDocs(rowsCol);
      const rows = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Fetched ZIMA fees rows:', rows);
      return rows;
    } catch (error) {
      console.error('Error fetching ZIMA fees rows:', error);
      return [];
    }
  },
  async deleteZimaFeesFolder(folderId: string) {
    if (!db) return null;
    try {
      // Delete all rows in the folder
      const folderRef = doc(db, 'zimaFeesFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const rowsSnapshot = await getDocs(rowsCol);
      for (const rowDoc of rowsSnapshot.docs) {
        await deleteDoc(rowDoc.ref);
      }
      // Delete the folder document itself
      await deleteDoc(folderRef);
      return folderId;
    } catch (error) {
      console.error('Error deleting ZIMA fees folder:', error);
      return null;
    }
  },
  async createZimaFeesFolderWithHeaders(folderName: string, headers: any[][]) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'zimaFeesFolders'), { name: folderName, headers, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating ZIMA fees folder with headers:', error);
      return null;
    }
  },
  async createZimaFeesFolderWithHeadersAndColCount(folderName: string, headers: any[][], colCount: number) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'zimaFeesFolders'), { name: folderName, headers, colCount, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating ZIMA fees folder with headers and colCount:', error);
      return null;
    }
  },
  async createZimaFeesFolderFull(folderName: string, headers: any[], colCount: number, body: any[]) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'zimaFeesFolders'), { name: folderName, headers, colCount, body, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating ZIMA fees folder with full sheet data:', error);
      return null;
    }
  },

  // ZIMA Curriculum management
  async getAllZimaCurriculumFolders() {
    if (!db) return [];
    
    const cacheKey = 'zimaCurriculumFolders_all';
    return await firebaseCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const q = query(collection(db, 'zimaCurriculumFolders'));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.error('Error fetching ZIMA curriculum folders:', error);
          const cached = firebaseCache.get(cacheKey);
          return cached || [];
        }
      },
      { ttl: 3 * 60 * 1000, useLocalStorage: true }
    );
  },
  async createZimaCurriculumFolder(folderName: string) {
    if (!db) return null;
    try {
      const docRef = await addDoc(collection(db, 'zimaCurriculumFolders'), { name: folderName, createdAt: new Date() });
      return docRef.id;
    } catch (error) {
      console.error('Error creating ZIMA curriculum folder:', error);
      return null;
    }
  },
  async addZimaCurriculumRowsToFolder(folderId: string, rows: any[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'zimaCurriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const added = [];
      for (const row of rows) {
        const rowRef = await addDoc(rowsCol, { ...row, createdAt: new Date(), updatedAt: new Date() });
        added.push({ ...row, id: rowRef.id });
      }
      return added;
    } catch (error) {
      console.error('Error adding ZIMA curriculum rows to folder:', error);
      return [];
    }
  },
  async getZimaCurriculumRows(folderId: string) {
    if (!db) return [];
    try {
      const folderRef = doc(db, 'zimaCurriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const querySnapshot = await getDocs(rowsCol);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching ZIMA curriculum rows:', error);
      return [];
    }
  },
  async updateZimaCurriculumRowInFolder(folderId: string, rowId: string, rowData: any) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'zimaCurriculumFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, { ...rowData, updatedAt: new Date() }, { merge: true });
      return rowId;
    } catch (error) {
      console.error('Error updating ZIMA curriculum row:', error);
      return null;
    }
  },
  async deleteZimaCurriculumRowInFolder(folderId: string, rowId: string) {
    if (!db) return null;
    try {
      const rowRef = doc(db, 'zimaCurriculumFolders', folderId, 'rows', rowId);
      await setDoc(rowRef, {}, { merge: false });
      return rowId;
    } catch (error) {
      console.error('Error deleting ZIMA curriculum row:', error);
      return null;
    }
  },
  async deleteZimaCurriculumFolder(folderId: string) {
    if (!db) return null;
    try {
      // Delete all rows in the folder
      const folderRef = doc(db, 'zimaCurriculumFolders', folderId);
      const rowsCol = collection(folderRef, 'rows');
      const rowsSnapshot = await getDocs(rowsCol);
      for (const rowDoc of rowsSnapshot.docs) {
        await deleteDoc(rowDoc.ref);
      }
      // Delete the folder document itself
      await deleteDoc(folderRef);
      return folderId;
    } catch (error) {
      console.error('Error deleting ZIMA curriculum folder:', error);
      return null;
    }
  },
  async setZimaCurriculumFolderHeaders(folderId: string, headers: string[]) {
    if (!db) return null;
    try {
      const folderRef = doc(db, 'zimaCurriculumFolders', folderId);
      await setDoc(folderRef, { headers, updatedAt: new Date() }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error setting ZIMA curriculum folder headers:', error);
      return false;
    }
  },
  // User management and sync
  async syncFirebaseAuthUsers() {
    if (!db || !auth) {
      console.error('❌ Firebase services not initialized');
      return false;
    }
    
    try {
      console.log('🔄 Starting Firebase Auth to Firestore sync...');
      
      // Get all users from Firestore
      const firestoreUsersQuery = query(collection(db, 'users'));
      const firestoreSnapshot = await getDocs(firestoreUsersQuery);
      const firestoreUsers = new Map();
      
      firestoreSnapshot.docs.forEach(doc => {
        const data = doc.data();
        firestoreUsers.set(data.email, { id: doc.id, ...data });
      });
      
      console.log(`📊 Found ${firestoreUsers.size} users in Firestore`);
      
      // For each Firestore user, ensure they have proper profile data
      let updatedCount = 0;
      const updatePromises: Promise<void>[] = [];
      
      firestoreUsers.forEach((userData, email) => {
        const user = userData as any;
        
        // Check if user has all required fields
        const requiredFields = ['uid', 'email', 'firstName', 'lastName', 'role', 'centreId', 'approved'];
        const missingFields = requiredFields.filter(field => !user[field]);
        
        if (missingFields.length > 0) {
          console.log(`⚠️ User ${email} missing fields:`, missingFields);
          
          // Update user with missing fields
          const updateData: any = {};
          
          if (!user.uid) updateData.uid = user.id || `user_${Date.now()}`;
          if (!user.firstName) updateData.firstName = 'User';
          if (!user.lastName) updateData.lastName = 'Name';
          if (!user.role) updateData.role = 'centre_head';
          if (!user.centreId) updateData.centreId = 'demo-centre-001';
          if (user.approved === undefined) updateData.approved = true;
          if (!user.createdAt) updateData.createdAt = new Date();
          if (!user.updatedAt) updateData.updatedAt = new Date();
          
          if (Object.keys(updateData).length > 0) {
            updatePromises.push(
              setDoc(doc(db, 'users', user.id), updateData, { merge: true }).then(() => {
                console.log(`✅ Updated user ${email} with missing fields`);
                updatedCount++;
              })
            );
          }
        }
      });
      
      await Promise.all(updatePromises);
      
      console.log(`✅ Sync completed. Updated ${updatedCount} users.`);
      return true;
    } catch (error) {
      console.error('❌ Error syncing Firebase Auth users:', error);
      return false;
    }
  },

  async createDefaultUsers() {
    if (!db) {
      console.error('❌ Database not initialized');
      return false;
    }
    
    try {
      console.log('🔄 Creating default users...');
      
      const defaultUsers = [
        {
          email: 'gauravkarewar724@gmail.com',
          password: 'password123',
          firstName: 'Gaurav',
          lastName: 'Karewar',
          role: 'director',
          centreId: 'centre-001',
          approved: true,
          phone: '+91-9876543211'
        },
        {
          email: 'demo@zica.edu',
          password: 'demo123',
          firstName: 'Demo',
          lastName: 'User',
          role: 'centre_head',
          centreId: 'demo-centre-001',
          approved: true,
          phone: '+91-1234567890'
        },
        {
          email: 'director@zica.edu',
          password: 'director123',
          firstName: 'Demo',
          lastName: 'Director',
          role: 'director',
          centreId: 'demo-centre-001',
          approved: true,
          phone: '+91-1234567890'
        }
      ];
      
      for (const userData of defaultUsers) {
        // Check if user already exists
        const userQuery = query(collection(db, 'users'), where('email', '==', userData.email));
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
          const uid = `${userData.role}_${Date.now()}`;
          await setDoc(doc(db, 'users', uid), {
            uid,
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Created default user: ${userData.email}`);
        } else {
          console.log(`ℹ️ User already exists: ${userData.email}`);
        }
      }
      
      console.log('✅ Default users creation completed');
      return true;
    } catch (error) {
      console.error('❌ Error creating default users:', error);
      return false;
    }
  },

  async createSampleStudents() {
    if (!db) {
      console.error('❌ Database not initialized');
      return false;
    }
    
    try {
      console.log('🔄 Creating sample students...');
      
      const sampleStudents = [
        {
          firstName: 'Rahul',
          lastName: 'Sharma',
          email: 'rahul.sharma@example.com',
          phone: '+91-9876543210',
          centreId: 'centre-001',
          course: 'Animation & VFX',
          courseDuration: '12 months',
          actualFees: 75000,
          discountedFees: 65000,
          feesPaid: 25000,
          feesBalance: 40000,
          status: 'active',
          admissionDate: new Date('2024-01-15'),
          courseStartDate: new Date('2024-02-01'),
          paymentMode: 'Installment',
          noOfInstallments: 4,
          installmentsPaid: 1,
          dueDate: new Date('2024-05-01'),
          remarks: 'Good student, regular attendance'
        },
        {
          firstName: 'Priya',
          lastName: 'Patel',
          email: 'priya.patel@example.com',
          phone: '+91-9876543211',
          centreId: 'centre-001',
          course: 'Digital Marketing',
          courseDuration: '6 months',
          actualFees: 45000,
          discountedFees: 40000,
          feesPaid: 40000,
          feesBalance: 0,
          status: 'active',
          admissionDate: new Date('2024-03-01'),
          courseStartDate: new Date('2024-03-15'),
          paymentMode: 'Full Payment',
          noOfInstallments: 1,
          installmentsPaid: 1,
          dueDate: new Date('2024-03-01'),
          remarks: 'Completed course successfully'
        },
        {
          firstName: 'Amit',
          lastName: 'Kumar',
          email: 'amit.kumar@example.com',
          phone: '+91-9876543212',
          centreId: 'demo-centre-001',
          course: 'Web Development',
          courseDuration: '8 months',
          actualFees: 60000,
          discountedFees: 55000,
          feesPaid: 20000,
          feesBalance: 35000,
          status: 'active',
          admissionDate: new Date('2024-02-01'),
          courseStartDate: new Date('2024-02-15'),
          paymentMode: 'Installment',
          noOfInstallments: 3,
          installmentsPaid: 1,
          dueDate: new Date('2024-06-01'),
          remarks: 'Needs follow-up for pending fees'
        },
        {
          firstName: 'Neha',
          lastName: 'Singh',
          email: 'neha.singh@example.com',
          phone: '+91-9876543213',
          centreId: 'demo-centre-001',
          course: 'Graphic Design',
          courseDuration: '10 months',
          actualFees: 55000,
          discountedFees: 50000,
          feesPaid: 50000,
          feesBalance: 0,
          status: 'graduated',
          admissionDate: new Date('2023-06-01'),
          courseStartDate: new Date('2023-06-15'),
          paymentMode: 'Full Payment',
          noOfInstallments: 1,
          installmentsPaid: 1,
          dueDate: new Date('2023-06-01'),
          remarks: 'Course completed, excellent performance'
        }
      ];
      
      let createdCount = 0;
      for (const studentData of sampleStudents) {
        // Check if student already exists
        const studentQuery = query(collection(db, 'students'), where('email', '==', studentData.email));
        const studentSnapshot = await getDocs(studentQuery);
        
        if (studentSnapshot.empty) {
          await addDoc(collection(db, 'students'), {
            ...studentData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ Created sample student: ${studentData.firstName} ${studentData.lastName}`);
          createdCount++;
        } else {
          console.log(`ℹ️ Student already exists: ${studentData.firstName} ${studentData.lastName}`);
        }
      }
      
      console.log(`✅ Sample students creation completed. Created ${createdCount} new students.`);
      return true;
    } catch (error) {
      console.error('❌ Error creating sample students:', error);
      return false;
    }
  },

  async setupSystem() {
    if (!db) {
      console.error('❌ Database not initialized');
      return false;
    }
    
    try {
      console.log('🚀 Starting system setup...');
      
      // Step 1: Sync existing users
      console.log('📋 Step 1: Syncing existing users...');
      await this.syncFirebaseAuthUsers();
      
      // Step 2: Create default users if they don't exist
      console.log('👥 Step 2: Creating default users...');
      await this.createDefaultUsers();
      
      // Step 3: Create sample students
      console.log('🎓 Step 3: Creating sample students...');
      await this.createSampleStudents();
      
      console.log('✅ System setup completed successfully!');
      console.log('📝 Login credentials:');
      console.log('   - gauravkarewar724@gmail.com / password123 (Director)');
      console.log('   - demo@zica.edu / demo123 (Centre Head)');
      console.log('   - director@zica.edu / director123 (Director)');
      
      return true;
    } catch (error) {
      console.error('❌ Error during system setup:', error);
      return false;
    }
  },

  async getBatchEntries(centreId: string) {
    if (!db || !centreId) return {};
    try {
      const docRef = doc(db, "batchEntriesData", centreId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return data.entries || {};
      }
      return {};
    } catch (error) {
      console.error("Error fetching batch entries:", error);
      return {};
    }
  }
};

/**
 * Safely creates a Firebase query with null checks
 * @param collectionRef - The collection reference
 * @param conditions - Array of where conditions with field, operator, and value
 * @returns Query or null if any condition value is undefined/null
 */
export const createSafeQuery = (collectionRef: any, conditions: Array<{field: string, operator: any, value: any}>) => {
  // Check if any condition value is undefined or null
  const hasInvalidValue = conditions.some(condition => 
    condition.value === undefined || condition.value === null
  );
  
  if (hasInvalidValue) {
    console.warn('⚠️ Query condition has undefined/null value:', conditions);
    return null;
  }
  
  // Build query with all conditions using Firestore query() function
  let queryRef = collectionRef;
  conditions.forEach(condition => {
    queryRef = query(queryRef, where(condition.field, condition.operator, condition.value));
  });
  
  return queryRef;
};

/**
 * Safely executes a Firebase query with error handling
 * @param queryFn - Function that returns the query
 * @param fallback - Fallback value if query fails
 * @returns Query result or fallback value
 */
export const executeSafeQuery = async <T>(
  queryFn: () => Promise<T>, 
  fallback: T,
  errorMessage: string = 'Query execution failed'
): Promise<T> => {
  try {
    return await queryFn();
  } catch (error) {
    console.error(`❌ ${errorMessage}:`, error);
    return fallback;
  }
};

export { db, auth, storage };

// Make firebaseHelpers available globally for testing
if (typeof window !== 'undefined') {
  (window as any).firebaseHelpers = firebaseHelpers;
  console.log('✅ firebaseHelpers made available globally for testing');
}
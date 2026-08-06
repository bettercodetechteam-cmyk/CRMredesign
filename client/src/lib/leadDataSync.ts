import { db } from '@/lib/firebase';
import { collection, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { centreDataStore } from './centreDataStore';
import { firebaseCache } from './firebaseCache';

export interface LeadDataSync {
  // Real-time data subscription
  subscribeToLeads: (callback: (leads: any[]) => void) => () => void;
  
  // CRUD operations
  createLead: (leadData: any) => Promise<string>;
  updateLead: (id: string, leadData: any) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  
  // Status management
  updateLeadStatus: (id: string, status: string, additionalData?: any) => Promise<void>;
  
  // Bulk operations
  bulkUpdateStatus: (ids: string[], status: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  
  // Data validation
  validateLeadData: (data: any) => { isValid: boolean; errors: string[] };
  
  // Event system
  emitDataUpdate: () => void;
  subscribeToDataUpdates: (callback: () => void) => () => void;
}

class LeadDataSyncImpl implements LeadDataSync {
  private dataUpdateCallbacks: (() => void)[] = [];

  // Real-time data subscription (shared CentreDataStore — one Firestore listener per centre)
  subscribeToLeads(callback: (leads: any[]) => void) {
    const notify = () => {
      callback(centreDataStore.getState().leads);
      this.emitDataUpdate();
    };
    notify();
    return centreDataStore.subscribe(notify);
  }

  // Create new lead
  async createLead(leadData: any): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'leads'), {
        ...leadData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Invalidate cache
      firebaseCache.invalidatePattern('leads');
      this.emitDataUpdate();
      return docRef.id;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  // Update existing lead
  async updateLead(id: string, leadData: any): Promise<void> {
    try {
      const leadRef = doc(db, 'leads', id);
      await updateDoc(leadRef, {
        ...leadData,
        updatedAt: new Date(),
      });
      
      // Invalidate cache
      firebaseCache.invalidatePattern('leads');
      this.emitDataUpdate();
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  }

  // Delete lead
  async deleteLead(id: string): Promise<void> {
    try {
      const leadRef = doc(db, 'leads', id);
      await deleteDoc(leadRef);
      
      // Invalidate cache
      firebaseCache.invalidatePattern('leads');
      this.emitDataUpdate();
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }

  // Update lead status with additional data
  async updateLeadStatus(id: string, status: string, additionalData: any = {}): Promise<void> {
    try {
      const leadRef = doc(db, 'leads', id);
      const updateData: any = {
        status,
        updatedAt: new Date(),
        ...additionalData,
      };

      // Add visit date if scheduling visit
      if (status === "Visit Scheduled" && additionalData.visitDate) {
        updateData.visitDate = new Date(additionalData.visitDate);
      }

      // Add follow-up date
      if (additionalData.followUpDate) {
        updateData.followUpDate = new Date(additionalData.followUpDate);
      }

      // Add remarks
      if (additionalData.remarks) {
        updateData.statusRemarks = additionalData.remarks;
      }

      // Update admission date if converting to admission
      if (status === "Admission Done") {
        updateData.admissionDate = new Date();
      }

      await updateDoc(leadRef, updateData);
      
      this.emitDataUpdate();
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  // Bulk status update
  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    try {
      const updatePromises = ids.map((id) => {
        const leadRef = doc(db, 'leads', id);
        return updateDoc(leadRef, {
          status,
          updatedAt: new Date(),
        });
      });

      await Promise.all(updatePromises);
      
      this.emitDataUpdate();
    } catch (error) {
      console.error('Error bulk updating leads:', error);
      throw error;
    }
  }

  // Bulk delete
  async bulkDelete(ids: string[]): Promise<void> {
    try {
      const deletePromises = ids.map((id) => {
        const leadRef = doc(db, 'leads', id);
        return deleteDoc(leadRef);
      });

      await Promise.all(deletePromises);
      
      this.emitDataUpdate();
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
      throw error;
    }
  }

  // Validate lead data
  validateLeadData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!data.name || data.name.trim() === '') {
      errors.push('Name is required');
    }

    if (!data.phone || data.phone.trim() === '') {
      errors.push('Phone number is required');
    }

    if (!data.interestedCourse || data.interestedCourse.trim() === '') {
      errors.push('Interested course is required');
    }

    if (!data.source || data.source.trim() === '') {
      errors.push('Source is required');
    }

    // Phone number validation
    if (data.phone && !/^[0-9+\-\s()]+$/.test(data.phone)) {
      errors.push('Invalid phone number format');
    }

    // Email validation (optional)
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Emit data update event
  emitDataUpdate(): void {
    this.dataUpdateCallbacks.forEach(callback => callback());
    
    // Also emit custom event for components that listen to it
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('leadDataUpdated'));
    }
  }

  // Subscribe to data updates
  subscribeToDataUpdates(callback: () => void): () => void {
    this.dataUpdateCallbacks.push(callback);
    
    return () => {
      const index = this.dataUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataUpdateCallbacks.splice(index, 1);
      }
    };
  }
}

// Export singleton instance
export const leadDataSync = new LeadDataSyncImpl();

// Export types
export type { LeadDataSync }; 
// Bulk Data Cleaning Service for existing leads
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { cleanLeadData, batchCleanLeads, validateCleanedData, type LeadData, type CleaningResult } from './leadDataCleaningService';

export interface BulkCleaningResult {
  totalProcessed: number;
  totalUpdated: number;
  totalErrors: number;
  changes: {
    sources: Record<string, number>;
    courses: Record<string, number>;
    statuses: Record<string, number>;
  };
  errors: string[];
  warnings: string[];
}

// Clean all leads for a specific centre
export async function cleanAllLeadsForCentre(centreId: string): Promise<BulkCleaningResult> {
  const result: BulkCleaningResult = {
    totalProcessed: 0,
    totalUpdated: 0,
    totalErrors: 0,
    changes: {
      sources: {},
      courses: {},
      statuses: {}
    },
    errors: [],
    warnings: []
  };

  try {
    if (process.env.NODE_ENV === 'development') {
    console.log(`🧹 Starting bulk cleaning for centre: ${centreId}`);
    }
    
    // Fetch all leads for the centre
    const leadsRef = collection(db, 'leads');
    const q = query(leadsRef, where('centreId', '==', centreId));
    const querySnapshot = await getDocs(q);
    
    const leads: LeadData[] = [];
    querySnapshot.forEach((doc) => {
      leads.push({ id: doc.id, ...doc.data() } as LeadData);
    });
    
    result.totalProcessed = leads.length;
    if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Found ${leads.length} leads to process`);
    }
    
    if (leads.length === 0) {
      result.warnings.push('No leads found for this centre');
      return result;
    }
    
    // Clean all leads
    const cleaningResults = batchCleanLeads(leads);
    
    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const cleaningResult = cleaningResults[i];
      
      try {
        // Check if any changes were made
        const hasChanges = Object.keys(cleaningResult.changes).length > 0;
        
        if (hasChanges) {
          // Update the lead in Firebase
          const leadRef = doc(db, 'leads', lead.id!);
          await updateDoc(leadRef, {
            ...cleaningResult.cleanedData,
            updatedAt: new Date(),
            updatedBy: 'bulk_cleaning_service'
          });
          
          result.totalUpdated++;
          
          // Track changes
          if (cleaningResult.changes.source) {
            const change = cleaningResult.changes.source;
            const key = `${change.from} → ${change.to}`;
            result.changes.sources[key] = (result.changes.sources[key] || 0) + 1;
          }
          
          if (cleaningResult.changes.course) {
            const change = cleaningResult.changes.course;
            const key = `${change.from} → ${change.to}`;
            result.changes.courses[key] = (result.changes.courses[key] || 0) + 1;
          }
          
          if (cleaningResult.changes.status) {
            const change = cleaningResult.changes.status;
            const key = `${change.from} → ${change.to}`;
            result.changes.statuses[key] = (result.changes.statuses[key] || 0) + 1;
          }
        }
        
        // Collect warnings and errors
        result.warnings.push(...cleaningResult.warnings);
        result.errors.push(...cleaningResult.errors);
        
      } catch (error) {
        result.totalErrors++;
        result.errors.push(`Error updating lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (process.env.NODE_ENV === 'development') {
        console.error(`Error updating lead ${lead.id}:`, error);
        }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
    console.log(`✅ Bulk cleaning completed: ${result.totalUpdated} updated, ${result.totalErrors} errors`);
    }
    
  } catch (error) {
    result.errors.push(`Bulk cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (process.env.NODE_ENV === 'development') {
    console.error('Bulk cleaning error:', error);
    }
  }
  
  return result;
}

// Clean leads with specific criteria
export async function cleanLeadsWithCriteria(
  centreId: string, 
  criteria: {
    source?: string;
    course?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<BulkCleaningResult> {
  const result: BulkCleaningResult = {
    totalProcessed: 0,
    totalUpdated: 0,
    totalErrors: 0,
    changes: {
      sources: {},
      courses: {},
      statuses: {}
    },
    errors: [],
    warnings: []
  };

  try {
    if (process.env.NODE_ENV === 'development') {
    console.log(`🧹 Starting targeted cleaning for centre: ${centreId}`, criteria);
    }
    
    // Fetch leads with criteria
    const leadsRef = collection(db, 'leads');
    let q = query(leadsRef, where('centreId', '==', centreId));
    
    // Add additional filters if provided
    if (criteria.source) {
      q = query(q, where('source', '==', criteria.source));
    }
    if (criteria.course) {
      q = query(q, where('course', '==', criteria.course));
    }
    if (criteria.status) {
      q = query(q, where('status', '==', criteria.status));
    }
    
    const querySnapshot = await getDocs(q);
    
    const leads: LeadData[] = [];
    querySnapshot.forEach((doc) => {
      const leadData = { id: doc.id, ...doc.data() } as LeadData;
      
      // Additional date filtering if needed
      if (criteria.dateFrom || criteria.dateTo) {
        const enquiryDate = leadData.enquiryDate;
        if (enquiryDate) {
          const date = enquiryDate instanceof Date ? enquiryDate : new Date(enquiryDate);
          
          if (criteria.dateFrom && date < criteria.dateFrom) {
            return; // Skip this lead
          }
          if (criteria.dateTo && date > criteria.dateTo) {
            return; // Skip this lead
          }
        }
      }
      
      leads.push(leadData);
    });
    
    result.totalProcessed = leads.length;
    if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Found ${leads.length} leads matching criteria`);
    }
    
    if (leads.length === 0) {
      result.warnings.push('No leads found matching the criteria');
      return result;
    }
    
    // Clean all leads
    const cleaningResults = batchCleanLeads(leads);
    
    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const cleaningResult = cleaningResults[i];
      
      try {
        // Check if any changes were made
        const hasChanges = Object.keys(cleaningResult.changes).length > 0;
        
        if (hasChanges) {
          // Update the lead in Firebase
          const leadRef = doc(db, 'leads', lead.id!);
          await updateDoc(leadRef, {
            ...cleaningResult.cleanedData,
            updatedAt: new Date(),
            updatedBy: 'bulk_cleaning_service'
          });
          
          result.totalUpdated++;
          
          // Track changes
          if (cleaningResult.changes.source) {
            const change = cleaningResult.changes.source;
            const key = `${change.from} → ${change.to}`;
            result.changes.sources[key] = (result.changes.sources[key] || 0) + 1;
          }
          
          if (cleaningResult.changes.course) {
            const change = cleaningResult.changes.course;
            const key = `${change.from} → ${change.to}`;
            result.changes.courses[key] = (result.changes.courses[key] || 0) + 1;
          }
          
          if (cleaningResult.changes.status) {
            const change = cleaningResult.changes.status;
            const key = `${change.from} → ${change.to}`;
            result.changes.statuses[key] = (result.changes.statuses[key] || 0) + 1;
          }
        }
        
        // Collect warnings and errors
        result.warnings.push(...cleaningResult.warnings);
        result.errors.push(...cleaningResult.errors);
        
      } catch (error) {
        result.totalErrors++;
        result.errors.push(`Error updating lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (process.env.NODE_ENV === 'development') {
        console.error(`Error updating lead ${lead.id}:`, error);
        }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
    console.log(`✅ Targeted cleaning completed: ${result.totalUpdated} updated, ${result.totalErrors} errors`);
    }
    
  } catch (error) {
    result.errors.push(`Targeted cleaning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (process.env.NODE_ENV === 'development') {
    console.error('Targeted cleaning error:', error);
    }
  }
  
  return result;
}

// Validate all leads for a centre
export async function validateAllLeadsForCentre(centreId: string): Promise<{
  totalLeads: number;
  validLeads: number;
  invalidLeads: number;
  validationErrors: Record<string, string[]>;
}> {
  const result = {
    totalLeads: 0,
    validLeads: 0,
    invalidLeads: 0,
    validationErrors: {} as Record<string, string[]>
  };

  try {
    console.log(`🔍 Starting validation for centre: ${centreId}`);
    
    // Fetch all leads for the centre
    const leadsRef = collection(db, 'leads');
    const q = query(leadsRef, where('centreId', '==', centreId));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
      const leadData = { id: doc.id, ...doc.data() } as LeadData;
      result.totalLeads++;
      
      // Validate the lead
      const validation = validateCleanedData(leadData);
      
      if (validation.isValid) {
        result.validLeads++;
      } else {
        result.invalidLeads++;
        result.validationErrors[doc.id] = validation.errors;
      }
    });
    
    console.log(`✅ Validation completed: ${result.validLeads} valid, ${result.invalidLeads} invalid`);
    
  } catch (error) {
    console.error('Validation error:', error);
  }
  
  return result;
}

// Get cleaning statistics for a centre
export async function getCleaningStatistics(centreId: string): Promise<{
  totalLeads: number;
  sourceDistribution: Record<string, number>;
  courseDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  nonStandardSources: string[];
  nonStandardCourses: string[];
  nonStandardStatuses: string[];
}> {
  const result = {
    totalLeads: 0,
    sourceDistribution: {} as Record<string, number>,
    courseDistribution: {} as Record<string, number>,
    statusDistribution: {} as Record<string, number>,
    nonStandardSources: [] as string[],
    nonStandardCourses: [] as string[],
    nonStandardStatuses: [] as string[]
  };

  try {
    console.log(`📊 Getting cleaning statistics for centre: ${centreId}`);
    
    // Fetch all leads for the centre
    const leadsRef = collection(db, 'leads');
    const q = query(leadsRef, where('centreId', '==', centreId));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
      const leadData = { id: doc.id, ...doc.data() } as LeadData;
      result.totalLeads++;
      
      // Count sources
      if (leadData.source) {
        result.sourceDistribution[leadData.source] = (result.sourceDistribution[leadData.source] || 0) + 1;
      }
      
      // Count courses
      if (leadData.course) {
        result.courseDistribution[leadData.course] = (result.courseDistribution[leadData.course] || 0) + 1;
      }
      
      // Count statuses
      if (leadData.status) {
        result.statusDistribution[leadData.status] = (result.statusDistribution[leadData.status] || 0) + 1;
      }
    });
    
    // Import standardized lists for comparison
    const { LEAD_SOURCES, COURSES, MODULAR_PROGRAMS, LEAD_STATUSES } = await import('./leadDataCleaningService');
    
    // Find non-standard values
    result.nonStandardSources = Object.keys(result.sourceDistribution).filter(
      source => !LEAD_SOURCES.includes(source as any)
    );
    
    result.nonStandardCourses = Object.keys(result.courseDistribution).filter(
      course => !COURSES.includes(course as any) && !MODULAR_PROGRAMS.includes(course as any) && course !== "Not Sure"
    );
    
    result.nonStandardStatuses = Object.keys(result.statusDistribution).filter(
      status => !LEAD_STATUSES.includes(status as any)
    );
    
    console.log(`✅ Statistics generated: ${result.totalLeads} leads analyzed`);
    
  } catch (error) {
    console.error('Statistics generation error:', error);
  }
  
  return result;
}

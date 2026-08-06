import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface AuditEvent {
  id: string;
  eventType: 'login' | 'logout' | 'auto_logout' | 'session_update' | 'staff_sync' | 'data_integrity_check' | 'error';
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

class AuditTrailService {
  private static readonly COLLECTION_NAME = 'auditTrail';

  // Log an audit event
  static async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEvent: Omit<AuditEvent, 'id'> = {
        ...event,
        timestamp: new Date()
      };

      // Prepare data for Firestore, removing any undefined fields
      const firestoreData: any = {
        ...auditEvent,
        timestamp: Timestamp.fromDate(auditEvent.timestamp)
      };

      // Remove undefined fields (Firestore doesn't allow undefined)
      Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key] === undefined) {
          delete firestoreData[key];
        }
      });

      await addDoc(collection(db, this.COLLECTION_NAME), firestoreData);

      if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Audit event logged: ${event.eventType} - ${event.description}`);
      }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to log audit event:', error);
      }
      }
    }
  }

  // Log login event
  static async logLogin(userId: string, userEmail: string, userRole: string, sessionId: string, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      eventType: 'login',
      userId,
      userEmail,
      userRole,
      sessionId,
      description: `User ${userEmail} logged in`,
      details: {
        ...details,
        loginTime: new Date().toISOString()
      },
      severity: 'low',
      resolved: true
    });
  }

  // Log logout event
  static async logLogout(userId: string, userEmail: string, userRole: string, sessionId: string, isAutoLogout: boolean = false, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      eventType: isAutoLogout ? 'auto_logout' : 'logout',
      userId,
      userEmail,
      userRole,
      sessionId,
      description: `User ${userEmail} ${isAutoLogout ? 'auto-logged out' : 'logged out'}`,
      details: {
        ...details,
        logoutTime: new Date().toISOString(),
        isAutoLogout
      },
      severity: isAutoLogout ? 'medium' : 'low',
      resolved: true
    });
  }

  // Log session update event
  static async logSessionUpdate(sessionId: string, userId: string, userEmail: string, updateType: string, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      eventType: 'session_update',
      userId,
      userEmail,
      sessionId,
      description: `Session ${sessionId} updated: ${updateType}`,
      details: {
        ...details,
        updateType,
        updateTime: new Date().toISOString()
      },
      severity: 'low',
      resolved: true
    });
  }

  // Log staff sync event
  static async logStaffSync(result: { totalStaff: number; syncedStaff: number; newStaff: number; updatedStaff: number; errors: string[] }): Promise<void> {
    await this.logEvent({
      eventType: 'staff_sync',
      description: `Staff sync completed: ${result.syncedStaff}/${result.totalStaff} synced`,
      details: {
        ...result,
        syncTime: new Date().toISOString()
      },
      severity: result.errors.length > 0 ? 'medium' : 'low',
      resolved: result.errors.length === 0
    });
  }

  // Log data integrity check
  static async logDataIntegrityCheck(checkType: string, issues: string[], details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      eventType: 'data_integrity_check',
      description: `Data integrity check: ${checkType}`,
      details: {
        ...details,
        checkType,
        issues,
        checkTime: new Date().toISOString()
      },
      severity: issues.length > 0 ? 'high' : 'low',
      resolved: issues.length === 0
    });
  }

  // Log error event
  static async logError(error: Error, context: string, userId?: string, userEmail?: string, details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      eventType: 'error',
      userId,
      userEmail,
      description: `Error in ${context}: ${error.message}`,
      details: {
        ...details,
        errorMessage: error.message,
        errorStack: error.stack,
        context,
        errorTime: new Date().toISOString()
      },
      severity: 'high',
      resolved: false
    });
  }

  // Get audit events
  static async getAuditEvents(filters: {
    eventType?: string;
    userId?: string;
    userEmail?: string;
    severity?: string;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<AuditEvent[]> {
    try {
      let q = query(collection(db, this.COLLECTION_NAME), orderBy('timestamp', 'desc'));
      
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const querySnapshot = await getDocs(q);
      const events: AuditEvent[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        } as AuditEvent);
      });

      // Apply filters in memory
      let filteredEvents = events;

      if (filters.eventType) {
        filteredEvents = filteredEvents.filter(e => e.eventType === filters.eventType);
      }
      if (filters.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
      }
      if (filters.userEmail) {
        filteredEvents = filteredEvents.filter(e => e.userEmail === filters.userEmail);
      }
      if (filters.severity) {
        filteredEvents = filteredEvents.filter(e => e.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.resolved === filters.resolved);
      }
      if (filters.startDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endDate!);
      }

      return filteredEvents;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error fetching audit events:', error);
      }
      return [];
    }
  }

  // Get audit statistics
  static async getAuditStatistics(days: number = 7): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    unresolvedEvents: number;
    recentErrors: number;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.getAuditEvents({
        startDate,
        endDate
      });

      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      let unresolvedEvents = 0;
      let recentErrors = 0;

      events.forEach(event => {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        
        if (!event.resolved) {
          unresolvedEvents++;
        }
        
        if (event.eventType === 'error') {
          recentErrors++;
        }
      });

      return {
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        unresolvedEvents,
        recentErrors
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error getting audit statistics:', error);
      }
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        unresolvedEvents: 0,
        recentErrors: 0
      };
    }
  }

  // Perform data integrity checks
  static async performDataIntegrityChecks(): Promise<{
    checks: Array<{ name: string; passed: boolean; issues: string[] }>;
    overallHealth: 'healthy' | 'warning' | 'critical';
  }> {
    const checks: Array<{ name: string; passed: boolean; issues: string[] }> = [];
    let criticalIssues = 0;

    try {
      // Check 1: Staff sync consistency
      if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Checking staff sync consistency...');
      }
      const syncIssues = await this.checkStaffSyncConsistency();
      checks.push({
        name: 'Staff Sync Consistency',
        passed: syncIssues.length === 0,
        issues: syncIssues
      });
      if (syncIssues.length > 0) criticalIssues++;

      // Determine overall health
      let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalIssues > 0) {
        overallHealth = 'critical';
      } else if (checks.some(c => !c.passed)) {
        overallHealth = 'warning';
      }

      // Log the integrity check
      await this.logDataIntegrityCheck('comprehensive', 
        checks.flatMap(c => c.issues), 
        { checks: checks.length, criticalIssues, overallHealth }
      );

      return { checks, overallHealth };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error performing data integrity checks:', error);
      }
      await this.logError(error as Error, 'data_integrity_checks');
      return {
        checks: [{ name: 'System Error', passed: false, issues: ['Failed to perform integrity checks'] }],
        overallHealth: 'critical'
      };
    }
  }

  // Check staff sync consistency
  private static async checkStaffSyncConsistency(): Promise<string[]> {
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const staffQuery = query(collection(db, 'staff'));
      const staffSnapshot = await getDocs(staffQuery);
      
      const userEmails = new Set(usersSnapshot.docs.map(doc => doc.data().email));
      const staffEmails = new Set(staffSnapshot.docs.map(doc => doc.data().email));
      
      const syncIssues: string[] = [];
      
      // Check for users not in staff collection
      userEmails.forEach(email => {
        if (!staffEmails.has(email)) {
          syncIssues.push(`User ${email} exists in users but not in staff collection`);
        }
      });
      
      // Check for staff not in users collection
      staffEmails.forEach(email => {
        if (!userEmails.has(email)) {
          syncIssues.push(`Staff ${email} exists in staff but not in users collection`);
        }
      });
      
      return syncIssues;
    } catch (error) {
      console.error('❌ Error checking staff sync consistency:', error);
      return ['Failed to check staff sync consistency'];
    }
  }
}

export default AuditTrailService;

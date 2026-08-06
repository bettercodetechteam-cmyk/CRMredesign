/**
 * Firebase Quota Monitor
 * Monitors and manages Firebase quota usage to prevent quota exceeded errors
 */

interface QuotaUsage {
  reads: number;
  writes: number;
  deletes: number;
  storage: number;
  bandwidth: number;
  lastReset: Date;
}

interface QuotaLimits {
  reads: number;
  writes: number;
  deletes: number;
  storage: number; // in MB
  bandwidth: number; // in MB
}

interface QuotaAlert {
  type: 'warning' | 'critical' | 'exceeded';
  service: string;
  usage: number;
  limit: number;
  message: string;
  timestamp: Date;
}

class QuotaMonitor {
  private static instance: QuotaMonitor;
  private usage: QuotaUsage;
  private limits: QuotaLimits;
  private alerts: QuotaAlert[] = [];
  private callbacks: ((alert: QuotaAlert) => void)[] = [];

  // Conservative limits to prevent quota exceeded errors
  private readonly DEFAULT_LIMITS: QuotaLimits = {
    reads: 40000, // 40k reads per day (Firebase free tier is 50k)
    writes: 20000, // 20k writes per day (Firebase free tier is 20k)
    deletes: 1000, // 1k deletes per day
    storage: 1000, // 1GB storage
    bandwidth: 10000, // 10GB bandwidth
  };

  private constructor() {
    this.limits = { ...this.DEFAULT_LIMITS };
    this.usage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      storage: 0,
      bandwidth: 0,
      lastReset: new Date()
    };
    
    this.loadUsageFromStorage();
    this.startDailyReset();
  }

  public static getInstance(): QuotaMonitor {
    if (!QuotaMonitor.instance) {
      QuotaMonitor.instance = new QuotaMonitor();
    }
    return QuotaMonitor.instance;
  }

  /**
   * Track a Firebase operation
   */
  public trackOperation(operation: 'read' | 'write' | 'delete', count: number = 1): void {
    this.usage[operation + 's'] += count;
    this.checkQuota(operation + 's');
    this.saveUsageToStorage();
  }

  /**
   * Track storage usage
   */
  public trackStorage(bytes: number): void {
    this.usage.storage += bytes / (1024 * 1024); // Convert to MB
    this.checkQuota('storage');
    this.saveUsageToStorage();
  }

  /**
   * Track bandwidth usage
   */
  public trackBandwidth(bytes: number): void {
    this.usage.bandwidth += bytes / (1024 * 1024); // Convert to MB
    this.checkQuota('bandwidth');
    this.saveUsageToStorage();
  }

  /**
   * Check if operation is allowed
   */
  public canPerformOperation(operation: 'read' | 'write' | 'delete', count: number = 1): boolean {
    const currentUsage = this.usage[operation + 's'];
    const limit = this.limits[operation + 's'];
    
    return (currentUsage + count) <= limit;
  }

  /**
   * Get current usage percentage
   */
  public getUsagePercentage(service: keyof QuotaUsage): number {
    if (service === 'lastReset') return 0;
    const limit = this.limits[service];
    return (this.usage[service] / limit) * 100;
  }

  /**
   * Get current usage stats
   */
  public getUsageStats(): { usage: QuotaUsage; limits: QuotaLimits; percentages: Record<string, number> } {
    const percentages: Record<string, number> = {};
    Object.keys(this.usage).forEach(key => {
      if (key !== 'lastReset') {
        percentages[key] = this.getUsagePercentage(key as keyof QuotaUsage);
      }
    });

    return {
      usage: { ...this.usage },
      limits: { ...this.limits },
      percentages
    };
  }

  /**
   * Set custom limits
   */
  public setLimits(limits: Partial<QuotaLimits>): void {
    this.limits = { ...this.limits, ...limits };
    this.saveUsageToStorage();
  }

  /**
   * Subscribe to quota alerts
   */
  public onAlert(callback: (alert: QuotaAlert) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get recent alerts
   */
  public getAlerts(): QuotaAlert[] {
    return [...this.alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Reset usage (for testing or manual reset)
   */
  public resetUsage(): void {
    this.usage = {
      reads: 0,
      writes: 0,
      deletes: 0,
      storage: 0,
      bandwidth: 0,
      lastReset: new Date()
    };
    this.saveUsageToStorage();
  }

  private checkQuota(service: keyof QuotaUsage): void {
    if (service === 'lastReset') return;

    const usage = this.usage[service];
    const limit = this.limits[service];
    const percentage = (usage / limit) * 100;

    let alertType: 'warning' | 'critical' | 'exceeded' | null = null;
    let message = '';

    if (percentage >= 100) {
      alertType = 'exceeded';
      message = `Firebase ${service} quota exceeded! Current usage: ${usage}/${limit}`;
    } else if (percentage >= 90) {
      alertType = 'critical';
      message = `Firebase ${service} quota critical! Usage: ${usage}/${limit} (${percentage.toFixed(1)}%)`;
    } else if (percentage >= 75) {
      alertType = 'warning';
      message = `Firebase ${service} quota warning! Usage: ${usage}/${limit} (${percentage.toFixed(1)}%)`;
    }

    if (alertType) {
      const alert: QuotaAlert = {
        type: alertType,
        service,
        usage,
        limit,
        message,
        timestamp: new Date()
      };

      this.alerts.push(alert);
      this.callbacks.forEach(callback => callback(alert));

      // Log to console
      if (process.env.NODE_ENV === 'development') {
      console.warn(`🚨 Firebase Quota ${alertType.toUpperCase()}: ${message}`);
      }
    }
  }

  private loadUsageFromStorage(): void {
    try {
      const stored = localStorage.getItem('firebase_quota_usage');
      if (stored) {
        const data = JSON.parse(stored);
        const lastReset = new Date(data.lastReset);
        const now = new Date();
        
        // Reset if it's a new day
        if (lastReset.toDateString() !== now.toDateString()) {
          this.resetUsage();
        } else {
          this.usage = { ...this.usage, ...data };
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to load quota usage from storage:', error);
      }
    }
  }

  private saveUsageToStorage(): void {
    try {
      localStorage.setItem('firebase_quota_usage', JSON.stringify(this.usage));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to save quota usage to storage:', error);
      }
    }
  }

  private startDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetUsage();
      this.startDailyReset(); // Schedule next reset
    }, msUntilMidnight);
  }
}

// Export singleton instance
export const quotaMonitor = QuotaMonitor.getInstance();

// Export types
export type { QuotaUsage, QuotaLimits, QuotaAlert };

// Utility functions
export const trackFirebaseOperation = (operation: 'read' | 'write' | 'delete', count: number = 1) => {
  quotaMonitor.trackOperation(operation, count);
};

export const canPerformFirebaseOperation = (operation: 'read' | 'write' | 'delete', count: number = 1): boolean => {
  return quotaMonitor.canPerformOperation(operation, count);
};

export const getQuotaUsage = () => {
  return quotaMonitor.getUsageStats();
};

export const subscribeToQuotaAlerts = (callback: (alert: QuotaAlert) => void) => {
  return quotaMonitor.onAlert(callback);
};

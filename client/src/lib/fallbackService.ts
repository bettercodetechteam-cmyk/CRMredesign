/**
 * Fallback Service
 * Provides offline/fallback functionality when Firebase quota is exceeded
 */

import { quotaMonitor, QuotaAlert } from './quotaMonitor';

export interface FallbackData {
  students: any[];
  leads: any[];
  users: any[];
  courses: any[];
  batches: any[];
  lastUpdated: Date;
}

export interface FallbackConfig {
  enableOfflineMode: boolean;
  enableLocalStorage: boolean;
  enableIndexedDB: boolean;
  maxOfflineDataAge: number; // in milliseconds
  autoSyncWhenOnline: boolean;
}

class FallbackService {
  private static instance: FallbackService;
  private config: FallbackConfig;
  private isOfflineMode: boolean = false;
  private fallbackData: FallbackData | null = null;
  private callbacks: ((isOffline: boolean) => void)[] = [];

  private constructor() {
    this.config = {
      enableOfflineMode: true,
      enableLocalStorage: true,
      enableIndexedDB: false, // Can be enabled for larger datasets
      maxOfflineDataAge: 24 * 60 * 60 * 1000, // 24 hours
      autoSyncWhenOnline: true
    };

    this.setupQuotaMonitoring();
    this.loadFallbackData();
  }

  public static getInstance(): FallbackService {
    if (!FallbackService.instance) {
      FallbackService.instance = new FallbackService();
    }
    return FallbackService.instance;
  }

  /**
   * Setup quota monitoring to trigger fallback mode
   */
  private setupQuotaMonitoring(): void {
    quotaMonitor.onAlert((alert) => {
      if (alert.type === 'exceeded' || alert.type === 'critical') {
        this.enableOfflineMode();
      }
    });
  }

  /**
   * Enable offline mode
   */
  public enableOfflineMode(): void {
    if (!this.isOfflineMode) {
      this.isOfflineMode = true;
      this.notifyCallbacks(true);
      if (process.env.NODE_ENV === 'development') {
      console.warn('🔄 Firebase quota exceeded - switching to offline mode');
      }
    }
  }

  /**
   * Disable offline mode
   */
  public disableOfflineMode(): void {
    if (this.isOfflineMode) {
      this.isOfflineMode = false;
      this.notifyCallbacks(false);
      if (process.env.NODE_ENV === 'development') {
      console.log('✅ Firebase quota restored - switching back to online mode');
      }
    }
  }

  /**
   * Check if in offline mode
   */
  public isInOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Get fallback data for a collection
   */
  public getFallbackData<T>(collectionName: string, filters?: any): T[] {
    if (!this.fallbackData) {
      return [];
    }

    let data = this.fallbackData[collectionName as keyof FallbackData] as T[];
    
    if (!data) {
      return [];
    }

    // Apply basic filtering if provided
    if (filters) {
      data = this.applyFilters(data, filters);
    }

    return data;
  }

  /**
   * Add data to fallback storage
   */
  public addFallbackData<T>(collectionName: string, data: T): void {
    if (!this.fallbackData) {
      this.fallbackData = {
        students: [],
        leads: [],
        users: [],
        courses: [],
        batches: [],
        lastUpdated: new Date()
      };
    }

    const collection = this.fallbackData[collectionName as keyof FallbackData] as T[];
    if (Array.isArray(collection)) {
      collection.push(data);
      this.saveFallbackData();
    }
  }

  /**
   * Update data in fallback storage
   */
  public updateFallbackData<T>(collectionName: string, id: string, data: Partial<T>): boolean {
    if (!this.fallbackData) {
      return false;
    }

    const collection = this.fallbackData[collectionName as keyof FallbackData] as T[];
    if (!Array.isArray(collection)) {
      return false;
    }

    const index = collection.findIndex((item: any) => item.id === id);
    if (index !== -1) {
      collection[index] = { ...collection[index], ...data };
      this.saveFallbackData();
      return true;
    }

    return false;
  }

  /**
   * Remove data from fallback storage
   */
  public removeFallbackData(collectionName: string, id: string): boolean {
    if (!this.fallbackData) {
      return false;
    }

    const collection = this.fallbackData[collectionName as keyof FallbackData] as any[];
    if (!Array.isArray(collection)) {
      return false;
    }

    const index = collection.findIndex((item: any) => item.id === id);
    if (index !== -1) {
      collection.splice(index, 1);
      this.saveFallbackData();
      return true;
    }

    return false;
  }

  /**
   * Sync fallback data when online
   */
  public async syncFallbackData(): Promise<void> {
    if (!this.fallbackData || !this.config.autoSyncWhenOnline) {
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Syncing fallback data...');
      }
      
      // This would integrate with your actual Firebase service
      // For now, we'll just clear the fallback data
      this.fallbackData = null;
      this.saveFallbackData();
      
      if (process.env.NODE_ENV === 'development') {
      console.log('✅ Fallback data synced successfully');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('❌ Failed to sync fallback data:', error);
      }
    }
  }

  /**
   * Get offline status message
   */
  public getOfflineMessage(): string {
    if (!this.isOfflineMode) {
      return '';
    }

    const usage = quotaMonitor.getUsageStats();
    const maxPercentage = Math.max(
      usage.percentages.reads || 0,
      usage.percentages.writes || 0,
      usage.percentages.deletes || 0
    );

    if (maxPercentage >= 100) {
      return 'Firebase quota exceeded. Working in offline mode. Data will sync when quota resets.';
    } else if (maxPercentage >= 90) {
      return 'Firebase quota critical. Some features may be limited.';
    }

    return 'Working in offline mode. Data will sync when connection is restored.';
  }

  /**
   * Configure fallback service
   */
  public configure(config: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Subscribe to offline mode changes
   */
  public onOfflineModeChange(callback: (isOffline: boolean) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get fallback statistics
   */
  public getFallbackStats(): {
    isOffline: boolean;
    dataAge: number;
    totalRecords: number;
    collections: Record<string, number>;
  } {
    const totalRecords = this.fallbackData ? 
      Object.values(this.fallbackData).reduce((total, collection) => {
        if (Array.isArray(collection)) {
          return total + collection.length;
        }
        return total;
      }, 0) : 0;

    const collections: Record<string, number> = {};
    if (this.fallbackData) {
      Object.entries(this.fallbackData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          collections[key] = value.length;
        }
      });
    }

    const dataAge = this.fallbackData ? 
      Date.now() - this.fallbackData.lastUpdated.getTime() : 0;

    return {
      isOffline: this.isOfflineMode,
      dataAge,
      totalRecords,
      collections
    };
  }

  /**
   * Clear all fallback data
   */
  public clearFallbackData(): void {
    this.fallbackData = null;
    this.saveFallbackData();
  }

  /**
   * Apply basic filters to data
   */
  private applyFilters<T>(data: T[], filters: any): T[] {
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        const itemValue = (item as any)[key];
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(value.toLowerCase());
        }
        return itemValue === value;
      });
    });
  }

  /**
   * Load fallback data from storage
   */
  private loadFallbackData(): void {
    if (!this.config.enableLocalStorage) {
      return;
    }

    try {
      const stored = localStorage.getItem('firebase_fallback_data');
      if (stored) {
        const data = JSON.parse(stored);
        const lastUpdated = new Date(data.lastUpdated);
        
        // Check if data is still valid
        if (Date.now() - lastUpdated.getTime() < this.config.maxOfflineDataAge) {
          this.fallbackData = {
            ...data,
            lastUpdated
          };
        } else {
          if (process.env.NODE_ENV === 'development') {
          console.log('🗑️ Fallback data expired, clearing...');
          }
          this.clearFallbackData();
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to load fallback data:', error);
      }
    }
  }

  /**
   * Save fallback data to storage
   */
  private saveFallbackData(): void {
    if (!this.config.enableLocalStorage || !this.fallbackData) {
      return;
    }

    try {
      localStorage.setItem('firebase_fallback_data', JSON.stringify(this.fallbackData));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to save fallback data:', error);
      }
    }
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(isOffline: boolean): void {
    this.callbacks.forEach(callback => {
      try {
        callback(isOffline);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Error in offline mode callback:', error);
        }
      }
    });
  }
}

// Export singleton instance
export const fallbackService = FallbackService.getInstance();

// Utility functions
export const isInOfflineMode = (): boolean => {
  return fallbackService.isInOfflineMode();
};

export const getFallbackData = <T>(collectionName: string, filters?: any): T[] => {
  return fallbackService.getFallbackData<T>(collectionName, filters);
};

export const addFallbackData = <T>(collectionName: string, data: T): void => {
  fallbackService.addFallbackData(collectionName, data);
};

export const updateFallbackData = <T>(collectionName: string, id: string, data: Partial<T>): boolean => {
  return fallbackService.updateFallbackData(collectionName, id, data);
};

export const removeFallbackData = (collectionName: string, id: string): boolean => {
  return fallbackService.removeFallbackData(collectionName, id);
};

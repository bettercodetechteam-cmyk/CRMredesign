/**
 * Firebase Quota Manager
 * Handles quota errors and implements graceful degradation
 */

interface QuotaError {
  code: string;
  message: string;
}

class FirebaseQuotaManager {
  private quotaExceeded = false;
  private lastQuotaCheck = 0;
  private readonly QUOTA_CHECK_INTERVAL = 60000; // 1 minute

  /**
   * Check if error is a quota error
   */
  isQuotaError(error: any): boolean {
    if (!error) return false;
    
    const code = error.code || error.message || '';
    const message = String(error.message || '').toLowerCase();
    
    // Common Firebase quota error indicators
    return (
      code === 'resource-exhausted' ||
      code === 'quota-exceeded' ||
      message.includes('quota') ||
      message.includes('resource exhausted') ||
      message.includes('too many requests') ||
      message.includes('rate limit')
    );
  }

  /**
   * Handle quota error
   */
  handleQuotaError(error: any): void {
    if (this.isQuotaError(error)) {
      this.quotaExceeded = true;
      this.lastQuotaCheck = Date.now();
      
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Firebase quota exceeded. Implementing graceful degradation.');
      }
    }
  }

  /**
   * Check if quota is exceeded
   */
  isQuotaExceeded(): boolean {
    // Reset quota flag after check interval
    const now = Date.now();
    if (now - this.lastQuotaCheck > this.QUOTA_CHECK_INTERVAL) {
      this.quotaExceeded = false;
    }
    
    return this.quotaExceeded;
  }

  /**
   * Should allow operation (with throttling when quota is exceeded)
   */
  shouldAllowOperation(): boolean {
    if (!this.isQuotaExceeded()) {
      return true;
    }
    
    // Allow only 1 operation per 10 seconds when quota is exceeded
    const now = Date.now();
    return (now - this.lastQuotaCheck) > 10000;
  }

  /**
   * Get retry delay based on quota status
   */
  getRetryDelay(attempt: number): number {
    if (this.isQuotaExceeded()) {
      // Longer delays when quota is exceeded
      return Math.min(30000, Math.pow(2, attempt) * 5000);
    }
    return Math.pow(2, attempt) * 1000;
  }

  /**
   * Reset quota status
   */
  reset(): void {
    this.quotaExceeded = false;
    this.lastQuotaCheck = 0;
  }
}

// Export singleton instance
export const firebaseQuotaManager = new FirebaseQuotaManager();











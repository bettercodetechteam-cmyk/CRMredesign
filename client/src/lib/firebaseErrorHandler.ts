/**
 * Firebase Error Handler
 * Comprehensive error handling for Firebase operations with quota management
 */

import { quotaMonitor, QuotaAlert } from './quotaMonitor';

export class FirebaseError extends Error {
  public code: string;
  public details?: unknown;
  public isQuotaError?: boolean;
  public isRetryable?: boolean;
  public retryAfter?: number;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'FirebaseError';
    this.code = code;
    this.details = details;
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface ErrorHandlingConfig {
  enableQuotaMonitoring: boolean;
  enableRetry: boolean;
  enableFallback: boolean;
  retryConfig: RetryConfig;
  fallbackData?: any;
}

class FirebaseErrorHandler {
  private static instance: FirebaseErrorHandler;
  private errorCallbacks: ((error: FirebaseError) => void)[] = [];
  private quotaAlertCallbacks: ((alert: QuotaAlert) => void)[] = [];

  private constructor() {
    this.setupQuotaMonitoring();
  }

  public static getInstance(): FirebaseErrorHandler {
    if (!FirebaseErrorHandler.instance) {
      FirebaseErrorHandler.instance = new FirebaseErrorHandler();
    }
    return FirebaseErrorHandler.instance;
  }

  /**
   * Handle Firebase errors with comprehensive error handling
   */
  public async handleError<T>(
    operation: () => Promise<T>,
    config: Partial<ErrorHandlingConfig> = {}
  ): Promise<T> {
    const defaultConfig: ErrorHandlingConfig = {
      enableQuotaMonitoring: true,
      enableRetry: true,
      enableFallback: false,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      }
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      return await this.executeWithRetry(operation, finalConfig);
    } catch (error) {
      const firebaseError = this.normalizeError(error);
      
      if (finalConfig.enableFallback && finalConfig.fallbackData) {
        if (process.env.NODE_ENV === 'development') {
        console.warn('🔄 Using fallback data due to error:', firebaseError.message);
        }
        return finalConfig.fallbackData;
      }

      this.notifyErrorCallbacks(firebaseError);
      throw firebaseError;
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: ErrorHandlingConfig
  ): Promise<T> {
    let lastError: FirebaseError;
    
    for (let attempt = 0; attempt <= config.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeError(error);
        
        // Don't retry quota exceeded errors
        if (lastError.isQuotaError) {
          throw lastError;
        }

        // Don't retry if not retryable
        if (!lastError.isRetryable) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === config.retryConfig.maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.retryConfig.baseDelay * Math.pow(config.retryConfig.backoffMultiplier, attempt),
          config.retryConfig.maxDelay
        );

        if (process.env.NODE_ENV === 'development') {
        console.warn(`🔄 Retrying operation in ${delay}ms (attempt ${attempt + 1}/${config.retryConfig.maxRetries + 1})`);
        }
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Normalize Firebase errors
   */
  private normalizeError(error: any): FirebaseError {
    const message = error?.message || 'Unknown Firebase error';
    const code = error?.code || 'unknown';
    const details = error?.details || error;

    const firebaseError = new FirebaseError(message, code, details);

    // Check for quota exceeded errors
    if (this.isQuotaError(error)) {
      firebaseError.isQuotaError = true;
      firebaseError.isRetryable = false;
      firebaseError.message = 'Firebase quota exceeded. Please try again later.';
    }

    // Check for retryable errors
    if (this.isRetryableError(error)) {
      firebaseError.isRetryable = true;
    }

    // Check for rate limiting
    if (this.isRateLimitError(error)) {
      firebaseError.isRetryable = true;
      firebaseError.retryAfter = this.extractRetryAfter(error);
    }

    return firebaseError;
  }

  /**
   * Check if error is quota related
   */
  private isQuotaError(error: any): boolean {
    const quotaErrorCodes = [
      'quota-exceeded',
      'resource-exhausted',
      'too-many-requests',
      'billing/quota-exceeded',
      'storage/quota-exceeded',
      'firestore/quota-exceeded'
    ];

    const errorCode = error.code || '';
    const errorMessage = (error.message || '').toLowerCase();

    return quotaErrorCodes.some(code => 
      errorCode.includes(code) || errorMessage.includes('quota') || errorMessage.includes('exceeded')
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'internal',
      'aborted',
      'cancelled',
      'network-error',
      'timeout'
    ];

    const errorCode = error.code || '';
    return retryableCodes.some(code => errorCode.includes(code));
  }

  /**
   * Check if error is rate limiting
   */
  private isRateLimitError(error: any): boolean {
    const rateLimitCodes = [
      'too-many-requests',
      'rate-limit-exceeded',
      'quota-exceeded'
    ];

    const errorCode = error.code || '';
    const errorMessage = (error.message || '').toLowerCase();

    return rateLimitCodes.some(code => 
      errorCode.includes(code) || errorMessage.includes('rate limit') || errorMessage.includes('too many')
    );
  }

  /**
   * Extract retry after time from error
   */
  private extractRetryAfter(error: any): number {
    // Default retry after 60 seconds for rate limiting
    return 60000;
  }

  /**
   * Setup quota monitoring
   */
  private setupQuotaMonitoring(): void {
    quotaMonitor.onAlert((alert) => {
      this.notifyQuotaAlertCallbacks(alert);
      
      // Show user notification for critical alerts
      if (alert.type === 'critical' || alert.type === 'exceeded') {
        this.showQuotaAlert(alert);
      }
    });
  }

  /**
   * Show quota alert to user
   */
  private showQuotaAlert(alert: QuotaAlert): void {
    // Create a non-intrusive notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">${alert.message}</p>
          <p class="text-xs mt-1">Usage will reset daily at midnight</p>
        </div>
        <div class="ml-auto pl-3">
          <button onclick="this.parentElement.parentElement.remove()" class="text-yellow-400 hover:text-yellow-600">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Subscribe to error callbacks
   */
  public onError(callback: (error: FirebaseError) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to quota alert callbacks
   */
  public onQuotaAlert(callback: (alert: QuotaAlert) => void): () => void {
    this.quotaAlertCallbacks.push(callback);
    return () => {
      const index = this.quotaAlertCallbacks.indexOf(callback);
      if (index > -1) {
        this.quotaAlertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify error callbacks
   */
  private notifyErrorCallbacks(error: FirebaseError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Error in error callback:', callbackError);
        }
      }
    });
  }

  /**
   * Notify quota alert callbacks
   */
  private notifyQuotaAlertCallbacks(alert: QuotaAlert): void {
    this.quotaAlertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (callbackError) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Error in quota alert callback:', callbackError);
        }
      }
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): { totalErrors: number; quotaErrors: number; retryableErrors: number } {
    // This would be implemented with actual error tracking
    return {
      totalErrors: 0,
      quotaErrors: 0,
      retryableErrors: 0
    };
  }
}

// Export singleton instance
export const firebaseErrorHandler = FirebaseErrorHandler.getInstance();

// Utility functions
export const handleFirebaseError = <T>(
  operation: () => Promise<T>,
  config?: Partial<ErrorHandlingConfig>
): Promise<T> => {
  return firebaseErrorHandler.handleError(operation, config);
};

export const isQuotaError = (error: any): boolean => {
  return firebaseErrorHandler['isQuotaError'](error);
};

export const isRetryableError = (error: any): boolean => {
  return firebaseErrorHandler['isRetryableError'](error);
};

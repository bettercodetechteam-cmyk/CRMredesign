/**
 * Debounce and Throttle Utilities
 * Used to limit frequency of Firebase operations
 */

/**
 * Debounce function - delays execution until after wait time has passed
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= wait) {
      lastCall = now;
      func(...args);
    } else {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, wait - timeSinceLastCall);
    }
  };
}

/**
 * Create a debounced version of a function that's safe for async operations
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let latestArgs: Parameters<T> | null = null;
  let latestResolve: ((value: ReturnType<T>) => void) | null = null;
  let latestReject: ((error: any) => void) | null = null;

  return function executedFunction(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      latestArgs = args;
      latestResolve = resolve;
      latestReject = reject;

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
        if (latestArgs && latestResolve && latestReject) {
          try {
            const result = await func(...latestArgs);
            latestResolve(result);
          } catch (error) {
            latestReject(error);
          }
          latestArgs = null;
          latestResolve = null;
          latestReject = null;
        }
      }, wait);
    });
  };
}











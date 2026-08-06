/**
 * Cross-Origin-Opener-Policy (COOP) utilities for Firebase authentication
 * Handles popup blocking and provides fallback authentication methods
 */

export interface COOPStatus {
  canUsePopup: boolean;
  reason: string;
  recommendedMethod: 'popup' | 'redirect';
}

/**
 * Detects if popup authentication is likely to work
 */
export const detectCOOPStatus = (): COOPStatus => {
  try {
    // Test basic popup functionality
    const testPopup = window.open('', '_blank', 'width=1,height=1');
    if (!testPopup) {
      return {
        canUsePopup: false,
        reason: 'Popup blocked by browser',
        recommendedMethod: 'redirect'
      };
    }
    
    // Test if we can access the popup window
    try {
      testPopup.close();
    } catch (error) {
      return {
        canUsePopup: false,
        reason: 'Cannot access popup window (COOP restriction)',
        recommendedMethod: 'redirect'
      };
    }
    
    // Check for specific COOP-related errors in console
    const originalConsoleWarn = console.warn;
    let coopWarning = false;
    
    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes('Cross-Origin-Opener-Policy') || 
          message.includes('COOP') ||
          message.includes('window.closed') ||
          message.includes('window.close')) {
        coopWarning = true;
      }
      if (process.env.NODE_ENV === 'development') {
      originalConsoleWarn.apply(console, args);
      }
    };
    
    // Restore original console.warn
    setTimeout(() => {
      console.warn = originalConsoleWarn;
    }, 100);
    
    if (coopWarning) {
      return {
        canUsePopup: false,
        reason: 'COOP policy detected',
        recommendedMethod: 'redirect'
      };
    }
    
    return {
      canUsePopup: true,
      reason: 'Popup should work normally',
      recommendedMethod: 'popup'
    };
    
  } catch (error) {
    return {
      canUsePopup: false,
      reason: `Error testing popup: ${error}`,
      recommendedMethod: 'redirect'
    };
  }
};

/**
 * Determines the best authentication method based on COOP status
 */
export const getRecommendedAuthMethod = (): 'popup' | 'redirect' => {
  const status = detectCOOPStatus();
  return status.recommendedMethod;
};

/**
 * Logs COOP status for debugging
 */
export const logCOOPStatus = (): void => {
  const status = detectCOOPStatus();
  if (process.env.NODE_ENV === 'development') {
  console.log('🔍 COOP Status:', status);
  }
  
  if (!status.canUsePopup) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Popup authentication may not work due to:', status.reason);
    console.info('💡 Recommended method:', status.recommendedMethod);
    }
  }
};

/**
 * Creates a user-friendly message about authentication method
 */
export const getAuthMethodMessage = (): string => {
  const status = detectCOOPStatus();
  
  if (status.canUsePopup) {
    return 'Popup authentication is available and recommended.';
  } else {
    return `Popup authentication is not available (${status.reason}). Redirect authentication will be used instead.`;
  }
};

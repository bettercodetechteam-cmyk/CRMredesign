import { logEvent, Analytics } from "firebase/analytics";
import { analytics } from "./firebase";

// Custom analytics tracking functions for ZICA CRM
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (analytics) {
    try {
      logEvent(analytics, eventName, parameters);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Failed to track event:', eventName, error);
      }
    }
  }
  // Always log to console in development for debugging
  if (import.meta.env.DEV && process.env.NODE_ENV === 'development') {
    console.log('📊 Analytics Event:', eventName, parameters);
  }
};

// Track page views
export const trackPageView = (pageName: string, additionalProps?: Record<string, any>) => {
  trackEvent('page_view', {
    page_title: pageName,
    ...additionalProps
  });
};

// Track user actions in CRM
export const trackUserAction = (action: string, category: string, label?: string) => {
  trackEvent('user_action', {
    action,
    category,
    label
  });
};

// Track student management actions
export const trackStudentAction = (action: 'create' | 'edit' | 'delete' | 'view', studentId?: string) => {
  trackEvent('student_management', {
    action,
    student_id: studentId
  });
};

// Track lead management actions  
export const trackLeadAction = (action: 'create' | 'edit' | 'delete' | 'convert', leadId?: string) => {
  trackEvent('lead_management', {
    action,
    lead_id: leadId
  });
};

// Track fee payments
export const trackFeePayment = (studentId: string, amount: number, paymentMethod: string) => {
  trackEvent('fee_payment', {
    student_id: studentId,
    amount,
    payment_method: paymentMethod
  });
};

// Track login/logout
export const trackAuth = (action: 'login' | 'logout', userRole?: string) => {
  trackEvent('auth_action', {
    action,
    user_role: userRole
  });
};
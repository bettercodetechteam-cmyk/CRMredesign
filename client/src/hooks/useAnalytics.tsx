import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { trackPageView } from '../lib/analytics';

export const useAnalytics = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Track page views when location changes
    const pageName = getPageName(location);
    trackPageView(pageName, { path: location });
  }, [location]);
};

const getPageName = (path: string): string => {
  const routeMap: Record<string, string> = {
    '/': 'Dashboard',
    '/students': 'Student Management',
    '/leads': 'Lead Management',
    '/batches': 'Batch Management',
    '/courses': 'Course Management',
    '/fees': 'Fee Management',
    '/assignments': 'Assignment Management',
    '/staff': 'Staff Management',
    '/user-approvals': 'User Approvals',
    '/expenses': 'Expense Management',
    '/targets': 'Target Management',
    '/reports': 'Reports',
    '/settings': 'Settings',
    '/auth': 'Authentication'
  };

  return routeMap[path] || 'Unknown Page';
};
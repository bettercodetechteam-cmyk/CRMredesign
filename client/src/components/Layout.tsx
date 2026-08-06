import { Suspense, useState, useCallback, useEffect, memo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { TaskRealtimeSync } from "@/components/tasks/TaskRealtimeSync";
import { useAuth } from "@/hooks/useAuth";
import Loading from "@/components/ui/loading";

const RouteLoadingFallback = memo(function RouteLoadingFallback() {
  return (
    <div className="relative min-h-[50vh] flex items-center justify-center">
      <Loading size="lg" text="Loading page..." color="primary" overlay />
    </div>
  );
});

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed (icon-only) by default on all screen sizes
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const location = useLocation();
  const { userProfile } = useAuth();

  const handleSidebarToggle = useCallback((open: boolean) => {
    setSidebarOpen(open);
  }, []);

  // Responsive: stay collapsed on desktop; only mobile overlay opens via header menu
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Enhanced route change behavior
  useEffect(() => {
    const width = window.innerWidth;
    
    // Close sidebar on mobile and tablet when route changes
    if (width < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Hide sidebar when dialog is open - Global detection for all dialogs
  useEffect(() => {
    const checkDialogState = () => {
      // Check for dialog-open class on body
      const hasDialogClass = document.body.classList.contains('dialog-open');
      
      // Check for any open Radix UI dialogs/alert-dialogs in the DOM
      const hasRadixDialog = document.querySelector('[data-radix-dialog-content][data-state="open"], [data-radix-alert-dialog-content][data-state="open"]');
      
      // Check for ResponsiveModal or other custom modals
      const hasCustomModal = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-radix-dialog-content]):not([data-radix-alert-dialog-content])');
      
      const hasDialogOpen = hasDialogClass || !!hasRadixDialog || !!hasCustomModal;
      
      setIsDialogOpen(hasDialogOpen);
      
      // Force hide sidebar when any dialog is open
      if (hasDialogOpen) {
        setSidebarOpen(false);
      }
    };

    // Check immediately
    checkDialogState();

    // Watch for class changes on body
    const bodyObserver = new MutationObserver(checkDialogState);
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Watch for dialog elements being added/removed or state changes
    const dialogObserver = new MutationObserver(checkDialogState);
    dialogObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'aria-modal', 'role']
    });

    return () => {
      bodyObserver.disconnect();
      dialogObserver.disconnect();
    };
  }, []);

  // Get build info from meta tags (if available)
  useEffect(() => {
    const buildTime = document.querySelector('meta[name="build-time"]')?.getAttribute('content');
    const buildHash = document.querySelector('meta[name="build-hash"]')?.getAttribute('content');
    if (buildTime || buildHash) {
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-50 to-indigo-50">
      <TaskRealtimeSync />
      {/* Sidebar - Shifts out when dialog is open (handled by CSS) */}
      <Sidebar open={sidebarOpen} onOpenChange={handleSidebarToggle} />
      


      {/* Main Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        sidebarOpen
          ? 'lg:pl-64 xl:pl-64' 
          : 'lg:pl-20 xl:pl-20'
      } ${isDialogOpen ? 'blur-background' : ''}`}>
        {/* Header */}
        <Header sidebarOpen={sidebarOpen} onSidebarOpenChange={handleSidebarToggle} />

        {/* Page Content — pt clears fixed header; inner wrapper owns uniform page gutters */}
        <main className={`min-h-screen pt-14 pb-4 sm:pb-6 overflow-x-hidden ${isDialogOpen ? 'blur-background' : ''}`}>
          <div className={`${sidebarOpen ? 'max-w-7xl' : 'max-w-full'} mx-auto px-3 sm:px-4 lg:px-6 pt-2 sm:pt-3 transition-all duration-300`}>
            <div className="w-full max-w-full overflow-x-hidden">
              <Suspense fallback={<RouteLoadingFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
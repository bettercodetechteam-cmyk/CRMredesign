import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import Loading from "@/components/ui/loading";

interface NavigationLoadingContextValue {
  isNavigating: boolean;
  startNavigation: () => void;
  setPageLoading: (loading: boolean) => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

const FALLBACK_MS = 1200;
const MIN_VISIBLE_MS = 280;

function isInternalAppPath(href: string, currentPath: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  try {
    const url = new URL(href, window.location.origin);
    const next = url.pathname + url.search;
    return next !== currentPath;
  } catch {
    return false;
  }
}

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const [pendingRoute, setPendingRoute] = useState(false);
  const [pageLoading, setPageLoadingState] = useState(false);
  const pageLoadingRef = useRef(false);
  const startedAtRef = useRef(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minVisibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (minVisibleTimerRef.current) {
      clearTimeout(minVisibleTimerRef.current);
      minVisibleTimerRef.current = null;
    }
  }, []);

  const tryFinishNavigation = useCallback(() => {
    if (!pendingRoute) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    minVisibleTimerRef.current = setTimeout(() => {
      if (!pageLoadingRef.current) {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        setPendingRoute(false);
      }
    }, remaining);
  }, [pendingRoute]);

  const startNavigation = useCallback(() => {
    clearTimers();
    startedAtRef.current = Date.now();
    setPendingRoute(true);

    fallbackTimerRef.current = setTimeout(() => {
      if (!pageLoadingRef.current) {
        setPendingRoute(false);
      }
    }, FALLBACK_MS);
  }, [clearTimers]);

  const setPageLoading = useCallback(
    (loading: boolean) => {
      pageLoadingRef.current = loading;
      setPageLoadingState(loading);
      if (!loading && pendingRoute) {
        tryFinishNavigation();
      }
    },
    [pendingRoute, tryFinishNavigation]
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || !isInternalAppPath(href, currentPath)) return;

      startNavigation();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [currentPath, startNavigation]);

  useEffect(() => {
    if (!pendingRoute) return;

    clearTimers();
    fallbackTimerRef.current = setTimeout(() => {
      setPendingRoute(false);
    }, FALLBACK_MS);

    return clearTimers;
  }, [location.pathname, location.search, pendingRoute, clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const isNavigating = pendingRoute || pageLoading;

  const value: NavigationLoadingContextValue = {
    isNavigating,
    startNavigation,
    setPageLoading,
  };

  return (
    <NavigationLoadingContext.Provider value={value}>
      {children}
      {isNavigating && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-white/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loading size="xl" text="Loading page..." color="primary" />
        </div>
      )}
    </NavigationLoadingContext.Provider>
  );
}

/** Call from pages that have their own data loading (Dashboard, Leads, etc.). */
export function usePageLoadingSignal(isLoading: boolean) {
  const context = useContext(NavigationLoadingContext);
  useEffect(() => {
    if (!context) return;
    context.setPageLoading(isLoading);
    return () => context.setPageLoading(false);
  }, [isLoading, context]);
}

export function useNavigationLoading() {
  const context = useContext(NavigationLoadingContext);
  if (!context) {
    throw new Error("useNavigationLoading must be used within NavigationLoadingProvider");
  }
  return context;
}

import { useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import { useNavigationLoading } from "@/contexts/NavigationLoadingContext";

/**
 * navigate() that shows the global route loader immediately.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  const { startNavigation } = useNavigationLoading();

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      startNavigation();
      navigate(to, options);
    },
    [navigate, startNavigation]
  );
}

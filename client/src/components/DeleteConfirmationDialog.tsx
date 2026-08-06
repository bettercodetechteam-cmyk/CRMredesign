import React, { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  isLoading?: boolean;
  loadingText?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "delete" | "success";
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  isLoading = false,
  loadingText = "Deleting...",
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "delete"
}: DeleteConfirmationDialogProps) {
  const isSuccess = variant === "success";
  const contentRef = useRef<HTMLDivElement>(null);

  // Ensure dialog content is NEVER blurred - apply styles directly
  useEffect(() => {
    if (open) {
      const applyNoBlur = () => {
        // Try ref first
        if (contentRef.current) {
          const element = contentRef.current;
          element.style.setProperty('filter', 'none', 'important');
          element.style.setProperty('-webkit-filter', 'none', 'important');
          element.style.setProperty('backdrop-filter', 'none', 'important');
          element.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          element.style.setProperty('pointer-events', 'auto', 'important');
          element.style.setProperty('z-index', '99999', 'important');
          
          // Apply to all children - ensure buttons are clickable
          const allChildren = element.querySelectorAll('*');
          allChildren.forEach((child) => {
            const childEl = child as HTMLElement;
            childEl.style.setProperty('filter', 'none', 'important');
            childEl.style.setProperty('-webkit-filter', 'none', 'important');
            childEl.style.setProperty('backdrop-filter', 'none', 'important');
            childEl.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
            childEl.style.setProperty('pointer-events', 'auto', 'important');
          });
        }
        
        // Also try querySelector as fallback
        const dialogContent = document.querySelector('[data-radix-alert-dialog-content]');
        if (dialogContent) {
          const element = dialogContent as HTMLElement;
          element.style.setProperty('filter', 'none', 'important');
          element.style.setProperty('-webkit-filter', 'none', 'important');
          element.style.setProperty('backdrop-filter', 'none', 'important');
          element.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          element.style.setProperty('pointer-events', 'auto', 'important');
          element.style.setProperty('z-index', '99999', 'important');
          
          // Apply to all children - ensure buttons are clickable
          const allChildren = dialogContent.querySelectorAll('*');
          allChildren.forEach((child) => {
            const childEl = child as HTMLElement;
            childEl.style.setProperty('filter', 'none', 'important');
            childEl.style.setProperty('-webkit-filter', 'none', 'important');
            childEl.style.setProperty('backdrop-filter', 'none', 'important');
            childEl.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
            childEl.style.setProperty('pointer-events', 'auto', 'important');
          });
        }
      };

      // Apply immediately
      applyNoBlur();
      
      // Apply after short delays to catch any late renders
      const timers = [
        setTimeout(applyNoBlur, 0),
        setTimeout(applyNoBlur, 10),
        setTimeout(applyNoBlur, 50),
        setTimeout(applyNoBlur, 100),
        setTimeout(applyNoBlur, 200),
      ];

      // Watch for DOM changes
      const observer = new MutationObserver(() => {
        applyNoBlur();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state', 'style', 'class']
      });

      return () => {
        timers.forEach(timer => clearTimeout(timer));
        observer.disconnect();
      };
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        ref={contentRef}
        className="sm:max-w-md"
        style={{ 
          zIndex: 99999,
          filter: 'none',
          WebkitFilter: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          position: 'fixed',
          pointerEvents: 'auto',
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isSuccess 
                  ? "bg-green-100" 
                  : "bg-red-100"
              }`}>
                {isSuccess ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
            <div>
              <AlertDialogTitle className={`text-left ${
                isSuccess ? "text-green-900" : "text-gray-900"
              }`}>
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className={`text-left mt-1 ${
                isSuccess ? "text-green-700" : "text-gray-600"
              }`}>
                {description}
                {itemName && (
                  <span className="font-semibold"> {itemName}</span>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isSuccess && (
            <AlertDialogCancel 
              className="border-slate-200 hover:bg-slate-50"
              style={{ pointerEvents: 'auto', cursor: 'pointer', zIndex: 100000, position: 'relative' }}
            >
              {cancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={`${
              isSuccess 
                ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
            }`}
            style={{ pointerEvents: 'auto', cursor: isLoading ? 'not-allowed' : 'pointer', zIndex: 100000, position: 'relative' }}
          >
            {isLoading ? loadingText : (isSuccess ? "OK" : confirmText)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


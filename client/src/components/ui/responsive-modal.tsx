import { useEffect, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";

interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
}

const ResponsiveModal: FC<ResponsiveModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = "md",
  showCloseButton = true,
}) => {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md sm:max-w-lg",
    lg: "max-w-lg sm:max-w-2xl",
    xl: "max-w-xl sm:max-w-4xl",
    full: "max-w-full mx-4 sm:mx-8",
  };

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
      // Add dialog-open class for global blur and sidebar hiding
      document.body.classList.add('dialog-open');
    } else {
      document.body.style.overflow = "unset";
      // Check if any other dialogs are still open before removing class
      const hasOtherDialogs = document.querySelector('[data-radix-dialog-content][data-state="open"], [data-radix-alert-dialog-content][data-state="open"], [role="dialog"][aria-modal="true"]');
      if (!hasOtherDialogs) {
        document.body.classList.remove('dialog-open');
      }
    }

    return () => {
      document.body.style.overflow = "unset";
      // Cleanup on unmount
      const hasOtherDialogs = document.querySelector('[data-radix-dialog-content][data-state="open"], [data-radix-alert-dialog-content][data-state="open"], [role="dialog"][aria-modal="true"]');
      if (!hasOtherDialogs) {
        document.body.classList.remove('dialog-open');
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        className={cn(
          "relative w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-[90vh] overflow-hidden",
          sizeClasses[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            {title && (
              <h2
                id="modal-title"
                className="text-lg sm:text-xl font-semibold text-gray-900 truncate pr-4"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full touch-target"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
};

export { ResponsiveModal };

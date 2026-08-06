import { type FC } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface MobileNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
}

export const MobileNavigation: FC<MobileNavigationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showPageNumbers = true,
  maxVisiblePages = 3,
}) => {
  const getVisiblePages = () => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisiblePages / 2);
    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {/* Previous Button */}
      <Button
        size="sm"
        variant="outline"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="touch-target flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden xs:inline">Previous</span>
        <span className="xs:hidden">Prev</span>
      </Button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="flex items-center gap-1">
          {/* First page */}
          {visiblePages[0] > 1 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(1)}
                className="w-8 h-8 p-0 hidden xs:flex"
              >
                1
              </Button>
              {visiblePages[0] > 2 && (
                <MoreHorizontal className="w-4 h-4 text-gray-400 hidden xs:block" />
              )}
            </>
          )}

          {/* Visible page numbers */}
          {visiblePages.map((page) => (
            <Button
              key={page}
              size="sm"
              variant={page === currentPage ? "default" : "outline"}
              onClick={() => onPageChange(page)}
              className="w-8 h-8 p-0 touch-target"
            >
              {page}
            </Button>
          ))}

          {/* Last page */}
          {visiblePages[visiblePages.length - 1] < totalPages && (
            <>
              {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                <MoreHorizontal className="w-4 h-4 text-gray-400 hidden xs:block" />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange(totalPages)}
                className="w-8 h-8 p-0 hidden xs:flex"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Page info for mobile */}
      <div className="text-xs text-gray-600 xs:hidden">
        {currentPage} / {totalPages}
      </div>

      {/* Next Button */}
      <Button
        size="sm"
        variant="outline"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="touch-target flex items-center gap-1"
      >
        <span className="hidden xs:inline">Next</span>
        <span className="xs:hidden">Next</span>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default MobileNavigation;
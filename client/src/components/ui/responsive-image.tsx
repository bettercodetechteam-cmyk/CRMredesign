import { forwardRef, useCallback, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useLazyImage } from "@/hooks/usePerformance";

interface ResponsiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
  onLoad?: () => void;
  onError?: () => void;
}

const ResponsiveImage = forwardRef<HTMLImageElement, ResponsiveImageProps>(
  ({ 
    src, 
    alt, 
    placeholder, 
    className, 
    sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
    loading = "lazy",
    onLoad,
    onError,
    ...props 
  }, ref) => {
    const { imageSrc, isLoaded, isError, imgRef, handleLoad, handleError } = useLazyImage(
      src, 
      placeholder
    );

    const handleImageLoad = useCallback(() => {
      handleLoad();
      onLoad?.();
    }, [handleLoad, onLoad]);

    const handleImageError = useCallback(() => {
      handleError();
      onError?.();
    }, [handleError, onError]);

    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          ref={(node) => {
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
            imgRef.current = node;
          }}
          src={imageSrc}
          alt={alt}
          loading={loading}
          sizes={sizes}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            isError && "opacity-50"
          )}
          {...props}
        />
        
        {/* Loading placeholder */}
        {!isLoaded && !isError && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        
        {/* Error state */}
        {isError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs">Failed to load</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ResponsiveImage.displayName = "ResponsiveImage";

export { ResponsiveImage };

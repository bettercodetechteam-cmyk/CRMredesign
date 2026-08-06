import { useEffect, useRef, useState, type FC, type CSSProperties } from 'react';

interface LoadingProps {
  fullScreen?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'white';
  showText?: boolean;
  overlay?: boolean;
}

const Loading: FC<LoadingProps> = ({ 
  fullScreen = false, 
  size = 'md', 
  text = 'Loading...',
  className = '',
  color = 'primary',
  showText = true,
  overlay = false
}) => {
  const sizeClass = `loader-${size}`;
  const colorClass = `loader-${color}`;
  const loaderRef = useRef<HTMLDivElement>(null);
  const [computedColor, setComputedColor] = useState<string>('');

  // Get the computed color value from CSS
  useEffect(() => {
    if (loaderRef.current) {
      const colorMap: Record<string, string> = {
        primary: '--primary',
        secondary: '--secondary',
        success: '--crm-success',
        warning: '--crm-warning',
        error: '--crm-error',
        white: 'hsl(0, 0%, 100%)'
      };

      const cssVar = colorMap[color];
      if (cssVar && cssVar.startsWith('--')) {
        let computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
        
        // For error, try --destructive as fallback
        if (!computed && color === 'error') {
          computed = getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim();
        }
        
        if (computed) {
          setComputedColor(computed);
        } else {
          // Fallback values
          const fallbacks: Record<string, string> = {
            primary: 'hsl(207, 90%, 54%)',
            secondary: 'hsl(60, 4.8%, 50%)',
            success: 'hsl(158, 64%, 52%)',
            warning: 'hsl(32, 95%, 44%)',
            error: 'hsl(0, 84%, 60%)'
          };
          setComputedColor(fallbacks[color] || fallbacks.primary);
        }
      } else {
        setComputedColor(cssVar);
      }
    }
  }, [color]);

  const loaderStyle = computedColor ? {
    '--loader-color': computedColor
  } as CSSProperties : {};

  const content = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div 
        ref={loaderRef}
        className={`loader ${sizeClass} ${colorClass} ${className}`}
        style={loaderStyle}
      ></div>
      {showText && text && (
        <p className={`text-sm font-medium ${color === 'white' ? 'text-white' : 'text-gray-700'}`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 z-50">
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50/90 to-indigo-100/90 backdrop-blur-sm z-10">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg">
      {content}
    </div>
  );
};

// Inline loading component for buttons and small areas
export const InlineLoading: FC<{ size?: 'sm' | 'md'; color?: LoadingProps['color'] }> = ({ 
  size = 'sm', 
  color = 'primary' 
}) => (
  <Loading 
    size={size} 
    color={color} 
    showText={false} 
    className="inline"
  />
);

export default Loading;

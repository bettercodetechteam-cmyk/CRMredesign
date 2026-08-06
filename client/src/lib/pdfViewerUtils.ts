/**
 * Optimized PDF Viewer Utilities
 * Provides fast PDF opening with multiple fallback methods
 */

export interface PDFViewerOptions {
  preferNative?: boolean; // Prefer browser's native PDF viewer
  preferGoogle?: boolean; // Prefer Google Docs viewer
  preferOffice?: boolean; // Prefer Office Online viewer
}

/**
 * Opens a PDF file using the fastest available method
 * @param url - The PDF URL
 * @param fileName - The PDF filename
 * @param options - Viewer preferences
 */
export function openPDFFast(url: string, fileName: string, options: PDFViewerOptions = {}) {
  const { preferNative = true, preferGoogle = false, preferOffice = false } = options;
  
  // Method 1: Try native browser PDF viewer (fastest)
  if (preferNative) {
    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (newWindow) {
        // Check if the window opened successfully
        setTimeout(() => {
          if (newWindow.closed) {
            // If native viewer failed, try Google Docs viewer
            openPDFInGoogleDocs(url);
          }
        }, 1000);
        return;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.log('Native PDF viewer failed, trying Google Docs viewer');
      }
    }
  }
  
  // Method 2: Google Docs viewer (reliable fallback)
  if (preferGoogle) {
    openPDFInGoogleDocs(url);
    return;
  }
  
  // Method 3: Office Online viewer
  if (preferOffice) {
    openPDFInOfficeOnline(url);
    return;
  }
  
  // Default: Try native first, then Google Docs
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    openPDFInGoogleDocs(url);
  }
}

/**
 * Opens PDF in Google Docs viewer
 * @param url - The PDF URL
 */
export function openPDFInGoogleDocs(url: string) {
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Opens PDF in Office Online viewer
 * @param url - The PDF URL
 */
export function openPDFInOfficeOnline(url: string) {
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  window.open(officeUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Smart PDF opener that detects the best method based on file size and user preferences
 * @param url - The PDF URL
 * @param fileName - The PDF filename
 * @param fileSize - File size in bytes (optional)
 */
export function openPDFSmart(url: string, fileName: string, fileSize?: number) {
  // For small PDFs (< 5MB), prefer native viewer for speed
  if (fileSize && fileSize < 5 * 1024 * 1024) {
    openPDFFast(url, fileName, { preferNative: true });
  } else {
    // For larger PDFs, prefer Google Docs viewer for better compatibility
    openPDFFast(url, fileName, { preferGoogle: true });
  }
}

/**
 * Opens PDF with loading indicator and error handling
 * @param url - The PDF URL
 * @param fileName - The PDF filename
 */
export function openPDFWithFeedback(url: string, fileName: string) {
  // Show loading indicator
  const loadingToast = {
    title: "Opening PDF...",
    description: `Loading ${fileName}`,
    duration: 2000,
  };
  
  try {
    // Try to open the PDF
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    if (newWindow) {
      // Success - show success message
      setTimeout(() => {
        if (!newWindow.closed) {
          if (process.env.NODE_ENV === 'development') {
          console.log('PDF opened successfully');
          }
        } else {
          // Window closed quickly, might be an error
          openPDFInGoogleDocs(url);
        }
      }, 500);
    } else {
      // Failed to open window, try Google Docs
      openPDFInGoogleDocs(url);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error opening PDF:', error);
    }
    // Fallback to Google Docs viewer
    openPDFInGoogleDocs(url);
  }
} 
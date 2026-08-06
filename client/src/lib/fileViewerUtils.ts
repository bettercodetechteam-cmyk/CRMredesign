/**
 * File Viewer Utilities
 * Handles opening files in new tabs with proper fallbacks and viewing options
 */

export interface FileViewOptions {
  url: string;
  fileName: string;
  fileType: string;
}

/**
 * Opens a file in a new tab with proper viewing options
 * For files that can't be viewed directly in browser, provides alternative viewing methods
 */
export const openFileInNewTab = (options: FileViewOptions) => {
  const { url, fileName, fileType } = options;
  const extension = fileType.toLowerCase();

  try {
    // Images - can be viewed directly
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // PDFs - can be viewed directly
    if (extension === 'pdf') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Videos - can be viewed directly
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Text files - can be viewed directly
    if (['txt', 'rtf'].includes(extension)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Excel/Spreadsheet files - use Google Sheets or Office Online
    if (['xlsx', 'xls', 'csv'].includes(extension)) {
      // Try Google Sheets first
      const googleSheetsUrl = `https://docs.google.com/spreadsheets/d/create?usp=upload_embed&url=${encodeURIComponent(url)}`;
      const newWindow = window.open(googleSheetsUrl, '_blank', 'noopener,noreferrer');
      
      // If Google Sheets doesn't work, try Google Docs viewer
      if (!newWindow) {
        const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
        window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Word documents - use Office Online or Google Docs viewer
    if (['doc', 'docx'].includes(extension)) {
      // Try Office Online first
      const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
      const newWindow = window.open(officeUrl, '_blank', 'noopener,noreferrer');
      
      // If Office Online doesn't work, try Google Docs viewer
      if (!newWindow) {
        const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
        window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // PowerPoint presentations - use Office Online or Google Docs viewer
    if (['ppt', 'pptx'].includes(extension)) {
      // Try Office Online first
      const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
      const newWindow = window.open(officeUrl, '_blank', 'noopener,noreferrer');
      
      // If Office Online doesn't work, try Google Docs viewer
      if (!newWindow) {
        const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
        window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Compressed files - download only
    if (['zip', 'rar', '7z'].includes(extension)) {
      downloadFile(url, fileName);
      return;
    }

    // For all other file types, try Google Docs viewer as a fallback
    const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error opening file in new tab:', error);
    }
    // Fallback to direct download if all else fails
    downloadFile(url, fileName);
  }
};

/**
 * Opens a file in Google Docs viewer (converts to PDF-like view)
 */
export const openInGoogleDocsViewer = (url: string) => {
  try {
    const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error opening in Google Docs viewer:', error);
    }
    // Fallback to direct URL
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Opens a file in Office Online
 */
export const openInOfficeOnline = (url: string) => {
  try {
    const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
    window.open(officeUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error opening in Office Online:', error);
    }
    // Fallback to Google Docs viewer
    openInGoogleDocsViewer(url);
  }
};

/**
 * Opens a file in Google Sheets
 */
export const openInGoogleSheets = (url: string) => {
  try {
    const googleSheetsUrl = `https://docs.google.com/spreadsheets/d/create?usp=upload_embed&url=${encodeURIComponent(url)}`;
    const newWindow = window.open(googleSheetsUrl, '_blank', 'noopener,noreferrer');
    
    // If Google Sheets doesn't work, try Google Docs viewer as fallback
    if (!newWindow) {
      openInGoogleDocsViewer(url);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error opening in Google Sheets:', error);
    }
    // Fallback to Google Docs viewer
    openInGoogleDocsViewer(url);
  }
};

/**
 * Downloads a file
 */
export const downloadFile = (url: string, fileName: string) => {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Error downloading file:', error);
    }
    // Fallback to opening in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Gets the appropriate viewing method for a file type
 */
export const getFileViewingMethod = (fileType: string) => {
  const extension = fileType.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'pdf', 'mp4', 'mov', 'avi', 'webm', 'mkv', 'txt', 'rtf'].includes(extension)) {
    return 'direct';
  }
  
  if (['xlsx', 'xls', 'csv'].includes(extension)) {
    return 'google-sheets';
  }
  
  if (['doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
    return 'office-online';
  }
  
  if (['zip', 'rar', '7z'].includes(extension)) {
    return 'download';
  }
  
  return 'google-docs-viewer';
}; 
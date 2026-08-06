import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Improved file naming convention for ImageKit files
 * Converts ImageKit file names to clean, readable display names
 */
export function getCleanFileName(fileName: string): string {
  // Remove file extension first
  const lastDotIndex = fileName.lastIndexOf('.');
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
  let nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

  // Remove ImageKit unique identifiers (patterns like __rN5rSNzZd or _ABC123)
  nameWithoutExt = nameWithoutExt.replace(/_{2,}[a-zA-Z0-9]+(?=_|$)/g, '');
  nameWithoutExt = nameWithoutExt.replace(/_[a-zA-Z0-9]{6,}(?=_|$)/g, '');

  // Replace multiple underscores with single spaces
  nameWithoutExt = nameWithoutExt.replace(/_{2,}/g, ' ');
  
  // Replace single underscores with hyphens
  nameWithoutExt = nameWithoutExt.replace(/_/g, '-');

  // Clean up multiple spaces and hyphens
  nameWithoutExt = nameWithoutExt.replace(/\s+/g, ' ').replace(/-+/g, '-');
  
  // Remove leading/trailing spaces and hyphens
  nameWithoutExt = nameWithoutExt.replace(/^[\s-]+|[\s-]+$/g, '');

  // Capitalize first letter of each word
  nameWithoutExt = nameWithoutExt
    .split(/[\s-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Add extension back
  return nameWithoutExt + extension;
}

/**
 * Generate a clean file name for uploads
 */
export function generateCleanFileName(originalName: string): string {
  const extension = originalName.split('.').pop() || '';
  const nameWithoutExt = originalName.replace(`.${extension}`, '');
  
  // Clean the name
  let cleanName = nameWithoutExt
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .toLowerCase();
  
  // Remove leading/trailing hyphens
  cleanName = cleanName.replace(/^-+|-+$/g, '');
  
  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  
  return `${cleanName}_${timestamp}.${extension}`;
}

/**
 * Convert any date format (including Firestore Timestamps) to a JavaScript Date object
 * @param dateInput - The date input which can be Date, string, Firestore Timestamp, or object with seconds
 * @returns JavaScript Date object or null if invalid
 */
export function parseDate(dateInput: any): Date | null {
  if (!dateInput) return null;
  
  try {
    // If it's already a Date object
    if (dateInput instanceof Date) {
      return dateInput;
    }
    
    // If it's a string
    if (typeof dateInput === 'string') {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // If it's an object (Firestore Timestamp)
    if (typeof dateInput === 'object') {
      // Check if it has toDate method (Firestore Timestamp)
      if (typeof dateInput.toDate === 'function') {
        return dateInput.toDate();
      }
      
      // Check if it has seconds property (Firestore Timestamp without toDate)
      if (typeof dateInput.seconds === 'number') {
        return new Date(dateInput.seconds * 1000);
      }
      
      // Check if it has _seconds property (older Firestore format)
      if (typeof dateInput._seconds === 'number') {
        return new Date(dateInput._seconds * 1000);
      }
    }
    
    // Try to create a Date object as fallback
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('Error parsing date:', dateInput, error);
    }
    return null;
  }
}

/**
 * Check if a date is today
 * @param dateInput - The date to check
 * @returns boolean indicating if the date is today
 */
export function isToday(dateInput: any): boolean {
  const date = parseDate(dateInput);
  if (!date) return false;
  
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/** Parse HTML date input value (YYYY-MM-DD) in local timezone. */
export function parseLocalDateInput(ymd: string): Date | null {
  if (!ymd) return null;
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Compare a lead/date field to an HTML date input value (calendar day, local TZ). */
export function isSameCalendarDay(dateInput: any, ymd: string): boolean {
  const date = parseDate(dateInput);
  const filterDate = parseLocalDateInput(ymd);
  if (!date || !filterDate) return false;
  return (
    date.getFullYear() === filterDate.getFullYear() &&
    date.getMonth() === filterDate.getMonth() &&
    date.getDate() === filterDate.getDate()
  );
}

/**
 * Format a date for display
 * @param dateInput - The date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns formatted date string
 */
export function formatDate(dateInput: any, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDate(dateInput);
  if (!date) return 'Invalid Date';
  
  // Format as DD/MM/YYYY
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Date Utility Functions for ZICA ZIMA CRM
 * Standardized date formatting across the application
 */

// Standard date format: DD/MM/YYYY (e.g., "15/01/2025")
export const STANDARD_DATE_FORMAT = 'DD/MM/YYYY';

// Standard date format for display: DD/MM/YYYY (e.g., "15/01/2025")
export const DISPLAY_DATE_FORMAT = 'DD/MM/YYYY';

// Standard date format for forms: YYYY-MM-DD
export const FORM_DATE_FORMAT = 'YYYY-MM-DD';

// Standard date format for database: ISO string
export const DATABASE_DATE_FORMAT = 'ISO';

/**
 * Format date to standard display format (DD/MM/YYYY)
 * @param date - Date to format (Date, Firestore Timestamp, string, or number)
 * @returns Formatted date string or '-' if invalid
 */
export const formatDate = (date: any): string => {
  if (!date) return '-';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamp with toDate method
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      d = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    // Handle string or number
    else {
      d = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    // Format as DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return '-';
  }
};

/**
 * Format date to compact display format (DD/MM/YYYY)
 * @param date - Date to format
 * @returns Formatted date string or '-' if invalid
 */
export const formatDateCompact = (date: any): string => {
  if (!date) return '-';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamp with toDate method
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      d = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    // Handle string or number
    else {
      d = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    // Format as DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting compact date:', error, date);
    return '-';
  }
};

/**
 * Format date to form input format (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Formatted date string or empty string if invalid
 */
export const formatDateForInput = (date: any): string => {
  if (!date) return '';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamp with toDate method
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      d = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    // Handle string
    else if (typeof date === 'string') {
      d = new Date(date);
    }
    // Handle number (timestamp)
    else if (typeof date === 'number') {
      d = new Date(date);
    }
    else {
      return '';
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      return '';
    }
    
    // Return in YYYY-MM-DD format for date inputs
    return d.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date for input:', error, date);
    return '';
  }
};

/**
 * Format date with time (DD/MM/YYYY, HH:MM)
 * @param date - Date to format
 * @returns Formatted date string with time or '-' if invalid
 */
export const formatDateTime = (date: any): string => {
  if (!date) return '-';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamp with toDate method
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      d = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    // Handle string or number
    else {
      d = new Date(date);
    }
    
    // Check if the date is valid
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    // Format as DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateStr}, ${timeStr}`;
  } catch (error) {
    console.error('Error formatting date time:', error, date);
    return '-';
  }
};

/**
 * Parse Excel date (serial number or string)
 * @param dateStr - Excel date to parse
 * @returns Date object or null if invalid
 */
export const parseExcelDate = (dateStr: string | number): Date | null => {
  if (!dateStr) return null;
  
  // If it's a number (Excel serial date)
  if (typeof dateStr === 'number') {
    // Excel's date system starts from December 30, 1899
    const excelEpoch = new Date(1899, 11, 30);
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const offsetDays = dateStr;
    const resultDate = new Date(excelEpoch.getTime() + (offsetDays * millisecondsPerDay));
    return isNaN(resultDate.getTime()) ? null : resultDate;
  }
  
  // If it's a string, try parsing it
  try {
    // Try parsing as ISO string first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Try parsing dd/mm/yyyy or dd-mm-yyyy format
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      // Assuming dd/mm/yyyy format
      const [day, month, year] = parts;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Excel date:', error);
    return null;
  }
};

/**
 * Convert any date to Date object
 * @param date - Date to convert
 * @returns Date object or null if invalid
 */
export const toDateObject = (date: any): Date | null => {
  if (!date) return null;
  
  try {
    // Handle Firestore Timestamp with toDate method
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    // Handle Firestore Timestamp with seconds and nanoseconds (serialized format)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      const d = new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
      return isNaN(d.getTime()) ? null : d;
    }
    // Handle Date object
    else if (date instanceof Date) {
      return date;
    }
    // Handle string or number
    else {
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch (error) {
    console.error('Error converting to date object:', error, date);
    return null;
  }
};

/**
 * Check if date is valid
 * @param date - Date to check
 * @returns True if valid date, false otherwise
 */
export const isValidDate = (date: any): boolean => {
  const d = toDateObject(date);
  return d !== null;
};

/**
 * Get relative time (e.g., "2 days ago", "1 week ago")
 * @param date - Date to get relative time for
 * @returns Relative time string
 */
export const getRelativeTime = (date: any): string => {
  const d = toDateObject(date);
  if (!d) return '-';
  
  const now = new Date();
  const diffInMs = now.getTime() - d.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays === -1) return 'Tomorrow';
  if (diffInDays > 0) return `${diffInDays} days ago`;
  if (diffInDays < 0) return `In ${Math.abs(diffInDays)} days`;
  
  return formatDate(d);
};

/**
 * Get month and year (e.g., "Jan 2025")
 * @param date - Date to format
 * @returns Month and year string
 */
export const getMonthYear = (date: any): string => {
  const d = toDateObject(date);
  if (!d) return '-';
  
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${year}`;
};

/**
 * Get day of week (e.g., "Monday", "Tue")
 * @param date - Date to format
 * @param short - Whether to return short format
 * @returns Day of week string
 */
export const getDayOfWeek = (date: any, short: boolean = false): string => {
  const d = toDateObject(date);
  if (!d) return '-';
  
  const days = short 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}; 

/**
 * Format date for chart display in "2025-08" format
 */
export function formatChartDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format date for chart display with proper sorting
 */
export function formatChartDateWithSort(date: Date | string): { display: string; sort: Date } {
  const d = new Date(date);
  const display = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { display, sort: d };
} 
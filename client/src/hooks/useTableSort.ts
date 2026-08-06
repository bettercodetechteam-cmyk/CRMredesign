import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | string | null;
  direction: SortDirection;
}

export function useTableSort<T>(data: T[], initialConfig: SortConfig<T> = { key: null, direction: null }) {
  const safeData = Array.isArray(data) ? data : [];
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(initialConfig);

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return safeData;

    return [...safeData].sort((a, b) => {
      const aValue = getValue(a, sortConfig.key as string);
      const bValue = getValue(b, sortConfig.key as string);

      if (aValue === bValue) return 0;
      
      // Handle null/undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      // Handle numeric sorting when values might be strings
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
         return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Make string comparison case-insensitive
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (aString < bString) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aString > bString) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [safeData, sortConfig]);

  return { sortedData, requestSort, sortConfig };
}

// Helper function to allow dot notation for nested objects
function getValue(obj: any, path: string) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

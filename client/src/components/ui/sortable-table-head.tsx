import React from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { SortConfig } from '@/hooks/useTableSort';
import { cn } from '@/lib/utils';

interface SortableTableHeadProps<T> extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortConfig: SortConfig<T>;
  sortKey: keyof T | string;
  requestSort: (key: keyof T | string) => void;
  children: React.ReactNode;
}

export function SortableTableHead<T>({ 
  sortConfig, 
  sortKey, 
  requestSort, 
  children, 
  className,
  ...props 
}: SortableTableHeadProps<T>) {
  const isActive = sortConfig.key === sortKey;
  
  return (
    <TableHead 
      className={cn("cursor-pointer select-none hover:bg-slate-100/50 transition-colors", className)} 
      onClick={() => requestSort(sortKey)}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <span className="flex items-center">
          {isActive ? (
            sortConfig.direction === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';

interface ProfessionalTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ProfessionalTable: React.FC<ProfessionalTableProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100/50 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className={cn("w-full", className)}>
          {children}
        </table>
      </div>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ 
  children, 
  className 
}) => {
  return (
    <thead className={cn("bg-gray-50/50 border-b border-gray-100/50", className)}>
      {children}
    </thead>
  );
};

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ 
  children, 
  className 
}) => {
  return (
    <tbody className={cn("divide-y divide-gray-100/50", className)}>
      {children}
    </tbody>
  );
};

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ 
  children, 
  className,
  onClick 
}) => {
  return (
    <tr 
      className={cn(
        "hover:bg-gray-50/50 transition-colors duration-200",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({ 
  children, 
  className 
}) => {
  return (
    <th className={cn(
      "px-4 xs:px-6 py-3 xs:py-4 text-left text-xs xs:text-sm font-medium text-gray-500 uppercase tracking-wider font-sans",
      className
    )}>
      {children}
    </th>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  className 
}) => {
  return (
    <td className={cn(
      "px-4 xs:px-6 py-3 xs:py-4 text-sm xs:text-base text-gray-900 font-body",
      className
    )}>
      {children}
    </td>
  );
};

// Mobile Card View Component
interface MobileCardViewProps {
  data: Array<Record<string, any>>;
  renderCard: (item: any, index: number) => React.ReactNode;
  className?: string;
}

export const MobileCardView: React.FC<MobileCardViewProps> = ({ 
  data, 
  renderCard, 
  className 
}) => {
  return (
    <div className={cn("grid grid-cols-1 gap-4 xs:gap-5", className)}>
      {data.map((item, index) => (
        <div key={index} className="bg-white rounded-xl border border-gray-100/50 shadow-soft p-4 xs:p-5">
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  );
};

// Responsive Table Wrapper
interface ResponsiveTableWrapperProps {
  children: React.ReactNode;
  mobileView?: React.ReactNode;
  showMobileView?: boolean;
  className?: string;
}

export const ResponsiveTableWrapper: React.FC<ResponsiveTableWrapperProps> = ({ 
  children, 
  mobileView,
  showMobileView = false,
  className 
}) => {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop Table View */}
      <div className="hidden xs:block">
        {children}
      </div>
      
      {/* Mobile Card View */}
      <div className="xs:hidden">
        {showMobileView ? mobileView : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Switch to desktop view for table data</p>
          </div>
        )}
      </div>
    </div>
  );
};

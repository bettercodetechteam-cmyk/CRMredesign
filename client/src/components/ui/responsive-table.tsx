import { forwardRef, type HTMLAttributes, type ThHTMLAttributes, type TdHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

const ResponsiveTable = forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "table-responsive overflow-x-auto -mx-3 sm:mx-0 rounded-lg border border-gray-200 bg-white shadow-sm",
        className
      )}
      {...props}
    >
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  )
);
ResponsiveTable.displayName = "ResponsiveTable";

const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-gray-50", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("bg-white divide-y divide-gray-200", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "hover:bg-gray-50 transition-colors",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 whitespace-nowrap",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

// Mobile Card View Component
interface MobileCardViewProps {
  data: Array<Record<string, any>>;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any) => ReactNode;
    className?: string;
  }>;
  className?: string;
}

const MobileCardView = forwardRef<HTMLDivElement, MobileCardViewProps>(
  ({ data, columns, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("space-y-3 sm:hidden", className)}
      {...props}
    >
      {data.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
        >
          <div className="space-y-2">
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {column.label}
                </span>
                <div className="text-right min-w-0 flex-1 ml-2">
                  {column.render 
                    ? column.render(item[column.key], item)
                    : <span className="text-sm text-gray-900 truncate">{item[column.key]}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
);
MobileCardView.displayName = "MobileCardView";

// Combined Responsive Table Component
interface ResponsiveDataTableProps {
  data: Array<Record<string, any>>;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any) => ReactNode;
    className?: string;
    headerClassName?: string;
  }>;
  className?: string;
  showMobileView?: boolean;
}

const ResponsiveDataTable = forwardRef<HTMLDivElement, ResponsiveDataTableProps>(
  ({ data, columns, className, showMobileView = true, ...props }, ref) => (
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {/* Mobile Card View */}
      {showMobileView && (
        <MobileCardView data={data} columns={columns} />
      )}
      
      {/* Desktop Table View */}
      <div className="hidden sm:block">
        <ResponsiveTable>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.headerClassName}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render 
                      ? column.render(item[column.key], item)
                      : item[column.key]
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </ResponsiveTable>
      </div>
    </div>
  )
);
ResponsiveDataTable.displayName = "ResponsiveDataTable";

export {
  ResponsiveTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  MobileCardView,
  ResponsiveDataTable,
};

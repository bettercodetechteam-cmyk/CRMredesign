import { useMemo, type FC, type ReactNode, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// Enhanced responsive table interfaces
interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, item: any, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  width?: string;
  minWidth?: string;
  hideOnMobile?: boolean;
  priority?: 'high' | 'medium' | 'low'; // For progressive disclosure on mobile
}

interface ResponsiveDataTableProps {
  data: Array<Record<string, any>>;
  columns: TableColumn[];
  className?: string;
  title?: string;
  description?: string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: any, index: number) => void;
  actions?: {
    view?: (item: any) => void;
    edit?: (item: any) => void;
    delete?: (item: any) => void;
    custom?: Array<{
      label: string;
      icon?: ComponentType<any>;
      onClick: (item: any) => void;
      variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    }>;
  };
  mobileCardFields?: Array<{
    key: string;
    label?: string;
    render?: (value: any, item: any) => ReactNode;
    className?: string;
  }>;
  enableMobileCards?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

// Mobile Card Component
const MobileCard: FC<{
  item: any;
  index: number;
  mobileCardFields?: ResponsiveDataTableProps['mobileCardFields'];
  actions?: ResponsiveDataTableProps['actions'];
  onRowClick?: ResponsiveDataTableProps['onRowClick'];
  className?: string;
}> = ({ item, index, mobileCardFields, actions, onRowClick, className }) => {
  return (
    <Card 
      className={cn(
        "mb-3 hover:shadow-md transition-all duration-200 cursor-pointer touch-target",
        className
      )}
      onClick={() => onRowClick?.(item, index)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {mobileCardFields?.map((field, fieldIndex) => (
            <div key={field.key} className="flex justify-between items-start">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0">
                {field.label || field.key}
              </span>
              <div className={cn("text-right min-w-0 flex-1 ml-3", field.className)}>
                {field.render 
                  ? field.render(item[field.key], item)
                  : <span className="text-sm text-gray-900 break-words">{item[field.key] || '-'}</span>
                }
              </div>
            </div>
          ))}
          
          {/* Actions */}
          {actions && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {actions.view && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.view!(item);
                  }}
                  className="flex-1 touch-target"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              )}
              {actions.edit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.edit!(item);
                  }}
                  className="flex-1 touch-target"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
              {actions.delete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.delete!(item);
                  }}
                  className="touch-target"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {actions.custom?.map((customAction, actionIndex) => {
                const Icon = customAction.icon;
                return (
                  <Button
                    key={actionIndex}
                    size="sm"
                    variant={customAction.variant || "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      customAction.onClick(item);
                    }}
                    className="touch-target"
                  >
                    {Icon && <Icon className="w-4 h-4 mr-1" />}
                    {customAction.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Desktop Table Component
const DesktopTable: FC<{
  data: any[];
  columns: TableColumn[];
  actions?: ResponsiveDataTableProps['actions'];
  onRowClick?: ResponsiveDataTableProps['onRowClick'];
  emptyMessage?: string;
}> = ({ data, columns, actions, onRowClick, emptyMessage }) => {
  return (
    <div className="table-responsive overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider",
                  column.headerClassName
                )}
                style={{ 
                  width: column.width, 
                  minWidth: column.minWidth 
                }}
              >
                {column.label}
              </th>
            ))}
            {actions && (
              <th className="px-3 sm:px-6 py-3 text-right text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length + (actions ? 1 : 0)} 
                className="px-6 py-12 text-center text-gray-500"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 text-gray-300">📄</div>
                  <p className="text-lg font-medium">No data found</p>
                  <p className="text-sm">{emptyMessage || "No records to display"}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={index}
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item, index)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900",
                      column.className
                    )}
                  >
                    {column.render 
                      ? column.render(item[column.key], item, index)
                      : item[column.key] || '-'
                    }
                  </td>
                ))}
                {actions && (
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-sm font-medium">
                    <div className="flex gap-2 justify-end">
                      {actions.view && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.view!(item);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {actions.edit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.edit!(item);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {actions.delete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.delete!(item);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {actions.custom?.map((customAction, actionIndex) => {
                        const Icon = customAction.icon;
                        return (
                          <Button
                            key={actionIndex}
                            size="sm"
                            variant={customAction.variant || "outline"}
                            onClick={(e) => {
                              e.stopPropagation();
                              customAction.onClick(item);
                            }}
                          >
                            {Icon && <Icon className="w-4 h-4" />}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// Main Responsive Data Table Component
export const ResponsiveDataTable: FC<ResponsiveDataTableProps> = ({
  data,
  columns,
  className,
  title,
  description,
  loading = false,
  emptyMessage,
  onRowClick,
  actions,
  mobileCardFields,
  enableMobileCards = true,
  pagination,
}) => {
  const isMobile = useIsMobile();

  // Auto-generate mobile card fields if not provided
  const autoMobileFields = useMemo(() => {
    if (mobileCardFields) return mobileCardFields;
    
    // Use high priority columns first, then medium, then low
    const priorityOrder = ['high', 'medium', 'low'];
    const sortedColumns = columns
      .filter(col => !col.hideOnMobile)
      .sort((a, b) => {
        const aPriority = priorityOrder.indexOf(a.priority || 'medium');
        const bPriority = priorityOrder.indexOf(b.priority || 'medium');
        return aPriority - bPriority;
      })
      .slice(0, 6); // Limit to 6 fields for mobile

    return sortedColumns.map(col => ({
      key: col.key,
      label: col.label,
      render: col.render ? (value: any, item: any) => col.render!(value, item, 0) : undefined,
      className: col.className,
    }));
  }, [mobileCardFields, columns]);

  if (loading) {
    return (
      <div className="w-full p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {(title || description) && (
        <div className="mb-4 xs:mb-6">
          {title && (
            <h3 className="text-lg xs:text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-600">{description}</p>
          )}
        </div>
      )}

      {/* Mobile Card View */}
      {isMobile && enableMobileCards ? (
        <div className="sm:hidden">
          {data.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 text-gray-300 text-4xl">📄</div>
                  <p className="text-lg font-medium text-gray-900">No data found</p>
                  <p className="text-sm text-gray-600">{emptyMessage || "No records to display"}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.map((item, index) => (
                <MobileCard
                  key={index}
                  item={item}
                  index={index}
                  mobileCardFields={autoMobileFields}
                  actions={actions}
                  onRowClick={onRowClick}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Desktop Table View */}
      <div className={enableMobileCards ? "hidden sm:block" : ""}>
        <DesktopTable
          data={data}
          columns={columns}
          actions={actions}
          onRowClick={onRowClick}
          emptyMessage={emptyMessage}
        />
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-gray-700">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsiveDataTable;
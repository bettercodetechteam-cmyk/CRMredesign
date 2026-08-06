import type { TaskFilters, TaskStatus, TaskPriority } from '@shared/taskTypes';
import { TASK_STATUSES, TASK_PRIORITIES } from '@shared/taskTypes';
import { getStatusLabel, getPriorityLabel } from '@shared/taskTypes';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { TaskAssignee } from '@/lib/taskService';

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  assignees?: TaskAssignee[];
  showAssigneeFilter?: boolean;
}

export function TaskFiltersBar({
  filters,
  onChange,
  assignees = [],
  showAssigneeFilter = false,
}: TaskFiltersBarProps) {
  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
      <div className="relative xs:col-span-2 lg:col-span-1 xl:col-span-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          className="pl-9 w-full"
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => onChange({ ...filters, status: v as TaskStatus | 'all' })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.priority || 'all'}
        onValueChange={(v) => onChange({ ...filters, priority: v as TaskPriority | 'all' })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>{getPriorityLabel(p)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showAssigneeFilter && (
        <Select
          value={filters.assigneeId || 'all'}
          onValueChange={(v) => onChange({ ...filters, assigneeId: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {[a.firstName, a.lastName].filter(Boolean).join(' ') || a.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        type="date"
        className="w-full"
        value={filters.dueDateFrom || ''}
        onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value || undefined })}
        title="Due from"
      />
      <Input
        type="date"
        className="w-full"
        value={filters.dueDateTo || ''}
        onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value || undefined })}
        title="Due to"
      />
    </div>
  );
}

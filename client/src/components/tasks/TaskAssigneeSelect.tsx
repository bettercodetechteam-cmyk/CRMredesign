import { useMemo, useState } from 'react';
import type { TaskAssignee } from '@/lib/taskService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { AlertTriangle, Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolvePermissions } from '@shared/permissions';
import type { ModulePermission } from '@shared/permissions';
import { ROLE_NAMES } from '@/lib/types';
import { normalizeRole } from '@shared/permissions';

interface TaskAssigneeSelectProps {
  assignees: TaskAssignee[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

function getAssigneeLabel(assignee: TaskAssignee): string {
  return [assignee.firstName, assignee.lastName].filter(Boolean).join(' ') || assignee.email;
}

function getAssigneeSearchValue(assignee: TaskAssignee): string {
  return [assignee.firstName, assignee.lastName, assignee.email, assignee.role]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function TaskAssigneeSelect({
  assignees,
  selected,
  onChange,
  loading,
}: TaskAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const roleOptions = useMemo(() => {
    const roles = new Set(assignees.map((a) => normalizeRole(a.role)).filter(Boolean));
    return Array.from(roles).sort();
  }, [assignees]);

  const filteredAssignees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignees.filter((assignee) => {
      const matchesRole =
        roleFilter === 'all' || normalizeRole(assignee.role) === roleFilter;
      const matchesSearch =
        !query || getAssigneeSearchValue(assignee).includes(query);
      return matchesRole && matchesSearch;
    });
  }, [assignees, roleFilter, search]);

  const selectedAssignees = useMemo(
    () =>
      selected
        .map((id) => assignees.find((a) => a.id === id))
        .filter((a): a is TaskAssignee => Boolean(a)),
    [assignees, selected]
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  const missingTasksPermission = selectedAssignees.filter((assignee) => {
    const perms = resolvePermissions(
      assignee.role,
      undefined,
      undefined
    );
    return !perms.includes('tasks' as ModulePermission);
  });

  return (
    <div className="space-y-3">
      {selectedAssignees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAssignees.map((assignee) => (
            <Badge key={assignee.id} variant="secondary" className="gap-1 pr-1">
              {getAssigneeLabel(assignee)}
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-muted p-0.5"
                onClick={() => remove(assignee.id)}
                aria-label={`Remove ${getAssigneeLabel(assignee)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
        <Input
          placeholder="Search employees by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_NAMES[role as keyof typeof ROLE_NAMES] ?? role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={loading}
          >
            <span className="truncate text-muted-foreground">
              {loading
                ? 'Loading employees...'
                : selected.length
                  ? `${selected.length} employee${selected.length === 1 ? '' : 's'} selected`
                  : 'Select employees from dropdown...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search in dropdown..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading employees...' : 'No employees found.'}
              </CommandEmpty>
              <CommandGroup>
                {filteredAssignees.map((assignee) => {
                  const isSelected = selected.includes(assignee.id);
                  const label = getAssigneeLabel(assignee);
                  return (
                    <CommandItem
                      key={assignee.id}
                      value={assignee.id}
                      onSelect={() => toggle(assignee.id)}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {assignee.email}
                          {assignee.role ? ` · ${ROLE_NAMES[normalizeRole(assignee.role) as keyof typeof ROLE_NAMES] ?? assignee.role}` : ''}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="border rounded-md max-h-40 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground p-3">Loading employees...</p>
        ) : filteredAssignees.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">No employees match your search.</p>
        ) : (
          <div className="divide-y">
            {filteredAssignees.map((assignee) => {
              const label = getAssigneeLabel(assignee);
              const isSelected = selected.includes(assignee.id);
              return (
                <button
                  key={assignee.id}
                  type="button"
                  onClick={() => toggle(assignee.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors',
                    isSelected && 'bg-blue-50'
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label className="cursor-pointer font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground truncate">{assignee.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                    {ROLE_NAMES[normalizeRole(assignee.role) as keyof typeof ROLE_NAMES] ?? assignee.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {missingTasksPermission.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Some selected users lack Task Management permission. Grant access via Access Management.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

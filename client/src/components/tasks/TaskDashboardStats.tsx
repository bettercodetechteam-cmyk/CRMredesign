import type { TaskStats } from '@shared/taskTypes';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, AlertTriangle, ListTodo, PlayCircle, Hourglass } from 'lucide-react';

interface TaskDashboardStatsProps {
  stats: TaskStats;
  loading?: boolean;
}

const statConfig = [
  { key: 'total' as const, label: 'Total Tasks', icon: ListTodo, color: 'text-blue-600 bg-blue-50' },
  { key: 'pending' as const, label: 'Pending', icon: Clock, color: 'text-slate-600 bg-slate-50' },
  { key: 'inProgress' as const, label: 'In Progress', icon: PlayCircle, color: 'text-indigo-600 bg-indigo-50' },
  { key: 'completedPendingApproval' as const, label: 'Awaiting Approval', icon: Hourglass, color: 'text-amber-700 bg-amber-50' },
  { key: 'completed' as const, label: 'Completed', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  { key: 'overdue' as const, label: 'Overdue', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
];

export function TaskDashboardStats({ stats, loading }: TaskDashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
      {statConfig.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${color}`}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {loading ? '—' : stats[key]}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

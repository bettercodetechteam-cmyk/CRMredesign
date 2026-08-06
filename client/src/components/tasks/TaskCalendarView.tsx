import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import type { Task } from '@shared/taskTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskPriorityBadge } from './TaskStatusBadge';

interface TaskCalendarViewProps {
  tasks: Task[];
}

export function TaskCalendarView({ tasks }: TaskCalendarViewProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const startPadding = startOfMonth(currentMonth).getDay();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3 sm:py-4 px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6 overflow-x-auto">
        <div className="min-w-[320px]">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.charAt(0)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[52px] sm:min-h-[80px]" />
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(key) || [];
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[52px] sm:min-h-[80px] border rounded-md p-0.5 sm:p-1',
                  !isSameMonth(day, currentMonth) && 'opacity-40',
                  isToday(day) && 'border-blue-400 bg-blue-50/30'
                )}
              >
                <span className={cn('text-xs font-medium', isToday(day) && 'text-blue-600')}>
                  {format(day, 'd')}
                </span>
                <div className="space-y-0.5 mt-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="w-full text-left text-[10px] truncate px-1 py-0.5 rounded bg-white border hover:bg-muted"
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

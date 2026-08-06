import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  dateRange: { start: Date; end: Date } | null;
  onDateRangeChange: (range: { start: Date; end: Date } | null) => void;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (!dateRange?.start || (dateRange.start && dateRange.end)) {
      // Start new range
      onDateRangeChange({ start: date, end: date });
    } else {
      // Complete the range
      const start = dateRange.start;
      const end = date;
      
      if (end < start) {
        // Swap if end is before start
        onDateRangeChange({ start: end, end: start });
      } else {
        onDateRangeChange({ start, end });
      }
      setIsOpen(false);
    }
  };

  const clearRange = () => {
    onDateRangeChange(null);
    setIsOpen(false);
  };

  const getPresetRanges = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const last90Days = new Date(today);
    last90Days.setDate(last90Days.getDate() - 90);

    return [
      { label: 'Today', start: today, end: today },
      { label: 'Yesterday', start: yesterday, end: yesterday },
      { label: 'Last 7 days', start: last7Days, end: today },
      { label: 'Last 30 days', start: last30Days, end: today },
      { label: 'Last 90 days', start: last90Days, end: today },
    ];
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.start ? (
            dateRange.end ? (
              <>
                {format(dateRange.start, "LLL dd, y")} -{" "}
                {format(dateRange.end, "LLL dd, y")}
              </>
            ) : (
              format(dateRange.start, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Quick Select</h4>
            <div className="grid grid-cols-2 gap-2">
              {getPresetRanges().map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDateRangeChange({ start: preset.start, end: preset.end });
                    setIsOpen(false);
                  }}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <Calendar
          mode="range"
          selected={dateRange ? { from: dateRange.start, to: dateRange.end } : undefined}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              onDateRangeChange({ start: range.from, end: range.to });
              setIsOpen(false);
            }
          }}
          numberOfMonths={2}
          className="rounded-md border-0"
        />
        <div className="p-3 border-t flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={clearRange}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;

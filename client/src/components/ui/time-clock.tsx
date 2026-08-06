"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0")
);

export interface TimeClockProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function TimeClock({
  value = "",
  onChange,
  placeholder = "--:--",
  className,
  disabled = false,
  "aria-label": ariaLabel = "Select time",
}: TimeClockProps) {
  const [open, setOpen] = React.useState(false);
  const [hour, setHour] = React.useState(() => {
    if (value && /^\d{1,2}/.test(value)) {
      const h = value.split(":")[0];
      return h.length === 1 ? `0${h}` : h;
    }
    return "";
  });
  const [minute, setMinute] = React.useState(() => {
    if (value && value.includes(":")) {
      const m = value.split(":")[1]?.slice(0, 2) ?? "";
      return m.length === 1 ? `0${m}` : m;
    }
    return "";
  });

  React.useEffect(() => {
    if (value && /^\d{1,2}:\d{1,2}/.test(value)) {
      const [h, m] = value.split(":");
      setHour(h.length === 1 ? `0${h}` : h.slice(0, 2));
      setMinute((m ?? "").length === 1 ? `0${m}` : (m ?? "").slice(0, 2));
    } else {
      setHour("");
      setMinute("");
    }
  }, [value]);

  const handleApply = () => {
    if (hour && minute) {
      onChange?.(`${hour}:${minute}`);
      setOpen(false);
    }
  };

  const displayValue = value && /^\d{1,2}:\d{1,2}/.test(value) ? value : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-9 justify-start gap-2 border-slate-200 bg-background text-left font-normal hover:bg-slate-50",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="tabular-nums">
            {displayValue || placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-slate-500">Select time</p>
          <div className="flex items-center gap-2">
            <Select
              value={hour || undefined}
              onValueChange={(v) => setHour(v)}
            >
              <SelectTrigger className="w-[72px] h-9">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-slate-400 font-medium">:</span>
            <Select
              value={minute || undefined}
              onValueChange={(v) => setMinute(v)}
            >
              <SelectTrigger className="w-[72px] h-9">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!hour || !minute}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import React, { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GstMonthUpload } from "@shared/annualGstTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { financialYearLabel, inr, monthLabel, monthlyCollection, yearLabel, yearlyCollection, type YearMode } from "./utils";

interface CollectionDashboardProps {
  uploads: GstMonthUpload[];
  startYear: number;
  onSelectYear: (startYear: number) => void;
}

const HEAD = "text-sm font-medium text-slate-600";

function shortAmount(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

const MODES: { value: YearMode; label: string }[] = [
  { value: "financial", label: "Apr – Mar" },
  { value: "calendar", label: "Jan – Dec" },
];

const CollectionDashboard: React.FC<CollectionDashboardProps> = ({ uploads, startYear, onSelectYear }) => {
  const [mode, setMode] = useState<YearMode>("financial");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const selectedYear = mode === "financial" ? startYear : calendarYear;
  const selectYear = (year: number) => (mode === "financial" ? onSelectYear(year) : setCalendarYear(year));
  const months = useMemo(() => monthlyCollection(uploads, selectedYear, mode), [uploads, selectedYear, mode]);
  const years = useMemo(() => yearlyCollection(uploads, mode), [uploads, mode]);
  const yearTotal = months.reduce((sum, month) => sum + month.amount, 0);
  const yearFiles = months.reduce((sum, month) => sum + month.files, 0);
  const chartData = months.map((month) => ({ name: monthLabel(month.key).split(" ")[0], amount: month.amount }));

  return (
    <div className="space-y-4">
      <h3 className="pt-2 text-lg font-semibold text-slate-900">Collection dashboard</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Monthly collection</CardTitle>
              <CardDescription>
                {mode === "financial" ? `${financialYearLabel(selectedYear)}, April to March` : `${selectedYear}, January to December`}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Year total</p>
              <p className="text-xl font-semibold text-emerald-700">{inr(yearTotal)}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortAmount} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(value: number) => [inr(value), "Collection"]} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="amount" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[420px] table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={HEAD}>Month</TableHead>
                    <TableHead className={cn(HEAD, "text-center")}>Files</TableHead>
                    <TableHead className={cn(HEAD, "text-right")}>Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((month) => (
                    <TableRow key={month.key} className={cn(month.files === 0 && "text-slate-400")}>
                      <TableCell className="text-sm">{monthLabel(month.key)}</TableCell>
                      <TableCell className="text-center text-sm">{month.files || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{month.files ? inr(month.amount) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Year total</TableCell>
                    <TableCell className="text-center font-semibold">{yearFiles}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(yearTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-slate-50 p-1" role="group" aria-label="Year type">
          {MODES.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={mode === option.value ? "default" : "ghost"}
              className={cn(mode === option.value ? "bg-emerald-700 text-white hover:bg-emerald-800" : "text-slate-600")}
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Yearly collection</CardTitle>
            <CardDescription>
              {mode === "financial" ? "Financial years, April to March." : "Calendar years, January to December."} Click a year to see its months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {years.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={HEAD}>Year</TableHead>
                    <TableHead className={cn(HEAD, "text-right")}>Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map((year) => (
                    <TableRow
                      key={year.key}
                      onClick={() => selectYear(Number(year.key))}
                      className={cn("cursor-pointer", Number(year.key) === selectedYear && "bg-emerald-50")}
                    >
                      <TableCell className="text-sm">
                        {yearLabel(Number(year.key), mode)}
                        <span className="ml-2 text-xs text-slate-500">{year.files} file{year.files === 1 ? "" : "s"}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{inr(year.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default CollectionDashboard;

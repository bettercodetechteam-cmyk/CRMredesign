import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Upload } from "lucide-react";
import type { GstMonthUpload } from "@shared/annualGstTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { annualGstApi } from "@/lib/annualGstApi";
import CollectionDashboard from "./CollectionDashboard";
import MonthDetail from "./MonthDetail";
import UploadDialog from "./UploadDialog";
import { currentMonth, financialYearLabel, financialYearMonths, financialYearOf, financialYearsWithData, monthLabel } from "./utils";

const QUERY_KEY = ["annual-gst"];

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

function searchableText(upload: GstMonthUpload): string {
  const [year, monthNumber] = upload.month.split("-").map(Number);
  const longMonth = new Date(year, monthNumber - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  return normalizeSearch([upload.fileName, monthLabel(upload.month), longMonth, upload.uploadedByName, upload.fileType].join(" "));
}

const AnnualGst: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startYear, setStartYear] = useState(financialYearOf(currentMonth()));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMonth, setUploadMonth] = useState(currentMonth());

  const { data: uploads = [], isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: annualGstApi.list });

  const uploadMutation = useMutation({
    mutationFn: async ({ files, month }: { files: File[]; month: string }) => {
      const results: GstMonthUpload[] = [];
      const failures: string[] = [];
      for (const file of files) {
        try {
          results.push(await annualGstApi.upload(file, month));
        } catch (uploadError) {
          failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : "Upload failed"}`);
        }
      }
      return { results, failures, month };
    },
    onSuccess: ({ results, failures, month }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setStartYear(financialYearOf(month));
      if (results.length > 0) {
        const rows = results.reduce((sum, upload) => sum + upload.rows.length, 0);
        toast({ title: "Uploaded", description: `${results.length} file(s), ${rows} student rows added.` });
      }
      if (failures.length > 0) {
        toast({ title: "Some files were not added", description: failures.join(" "), variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (upload: GstMonthUpload) => {
      setDeletingId(upload.id);
      return annualGstApi.remove(upload.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (deleteError: Error) => toast({ title: "Remove failed", description: deleteError.message, variant: "destructive" }),
    onSettled: () => setDeletingId(null),
  });

  const years = useMemo(() => financialYearsWithData(uploads), [uploads]);
  const searchText = normalizeSearch(search);
  const filesByMonth = useMemo(() => {
    const matches = searchText ? uploads.filter((upload) => searchableText(upload).includes(searchText)) : uploads;
    const monthList = searchText
      ? [...new Set(matches.map((upload) => upload.month))].sort().reverse()
      : financialYearMonths(startYear).reverse();
    return monthList
      .map((month) => ({ month, files: matches.filter((upload) => upload.month === month) }))
      .filter((group) => group.files.length > 0);
  }, [uploads, startYear, searchText]);

  const openUpload = (month: string) => {
    setUploadMonth(month);
    setUploadOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search files..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={String(startYear)} onValueChange={(value) => setStartYear(Number(value))}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>{`${year}-${String(year + 1).slice(2)}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => openUpload(currentMonth())}>
          <Upload className="mr-2 h-4 w-4" />
          Upload file
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GST Files by Month</CardTitle>
          <CardDescription>Upload the monthly fees Excel file. Each file stays in the month you choose.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading files...</p>}
          {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
          {!isLoading && !error && filesByMonth.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {searchText ? "No files match your search." : `No files uploaded for ${financialYearLabel(startYear)} yet.`}
            </p>
          )}
          {filesByMonth.map((group) => (
            <div key={group.month} id={`gst-month-${group.month}`} className="scroll-mt-4">
              <MonthDetail
                month={group.month}
                uploads={group.files}
                deletingId={deletingId}
                onDelete={(upload) => deleteMutation.mutate(upload)}
                onUploadFor={openUpload}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!isLoading && !error && <CollectionDashboard uploads={uploads} startYear={startYear} onSelectYear={setStartYear} />}

      <UploadDialog
        open={uploadOpen}
        initialMonth={uploadMonth}
        busy={uploadMutation.isPending}
        onOpenChange={setUploadOpen}
        onUpload={(files, month) => uploadMutation.mutate({ files, month })}
      />
    </div>
  );
};

export default AnnualGst;

import React, { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, ExternalLink, FileSpreadsheet, FileText, Plus, Trash2 } from "lucide-react";
import type { GstMonthUpload } from "@shared/annualGstTypes";
import { EnhancedFileViewer } from "@/components/EnhancedFileViewer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGstFileActions } from "./useGstFileActions";
import { monthLabel } from "./utils";

interface MonthDetailProps {
  month: string;
  uploads: GstMonthUpload[];
  deletingId: string | null;
  onDelete: (upload: GstMonthUpload) => void;
  onUploadFor: (month: string) => void;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function monthName(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-IN", { month: "long" });
}

const MonthDetail: React.FC<MonthDetailProps> = ({ month, uploads, deletingId, onDelete, onUploadFor }) => {
  const [open, setOpen] = useState(true);
  const { viewerFile, busyId, openFile, download, closeViewer } = useGstFileActions();

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2">
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          <span className="text-[15px] font-semibold text-slate-900">{monthLabel(month)}</span>
          <span className="text-xs text-emerald-700">{uploads.length} file{uploads.length === 1 ? "" : "s"}</span>
        </button>
        <Button variant="outline" size="sm" className="font-normal text-emerald-700" onClick={() => onUploadFor(month)}>
          <Plus className="mr-1 h-4 w-4" />
          Upload for {monthName(month)}
        </Button>
      </div>
      {open && (
        <div className="overflow-x-auto">
          <Table className="min-w-[720px] table-fixed">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-medium text-slate-600">File Name</TableHead>
                <TableHead className="text-sm font-medium text-slate-600">File Size</TableHead>
                <TableHead className="text-sm font-medium text-slate-600">Uploaded On</TableHead>
                <TableHead className="text-sm font-medium text-slate-600">Uploaded By</TableHead>
                <TableHead className="text-right text-sm font-medium text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => {
                const isPdf = upload.fileType === "pdf";
                const unavailable = !upload.fileUrl || busyId === upload.id;
                return (
                  <TableRow key={upload.id}>
                    <TableCell className="py-4">
                      <button
                        type="button"
                        className="group flex w-full min-w-0 items-center gap-2 text-left disabled:cursor-default"
                        disabled={unavailable}
                        onClick={() => openFile(upload)}
                        title={upload.fileUrl ? upload.fileName : "File not saved. Upload it again to view it."}
                      >
                        {isPdf ? <FileText className="h-4 w-4 shrink-0 text-red-500" /> : <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />}
                        <span className="truncate text-sm text-slate-800 group-enabled:group-hover:underline">{upload.fileName}</span>
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-slate-800">{formatSize(upload.fileSize)}</TableCell>
                    <TableCell className="text-sm text-slate-400">{formatDate(upload.createdAt)}</TableCell>
                    <TableCell className="truncate text-sm text-slate-800">{upload.uploadedByName || "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" className="h-8 w-8 text-slate-700" title={isPdf ? "Open PDF" : "Open"} disabled={unavailable} onClick={() => openFile(upload)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-slate-700"
                          title="Download"
                          disabled={unavailable}
                          onClick={() => download(upload)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" title="Delete" disabled={deletingId === upload.id} onClick={() => onDelete(upload)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {viewerFile && <EnhancedFileViewer file={viewerFile} onClose={closeViewer} />}
    </div>
  );
};

export default MonthDetail;

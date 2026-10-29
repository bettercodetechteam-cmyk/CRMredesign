import React, { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACCEPT = ".xlsx,.xls,.csv";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface UploadDialogProps {
  open: boolean;
  initialMonth: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[], month: string) => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({ open, initialMonth, busy, onOpenChange, onUpload }) => {
  const [month, setMonth] = useState(initialMonth);
  const [files, setFiles] = useState<File[]>([]);
  const [year, monthNumber] = month.split("-");
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => String(thisYear + 1 - index));

  useEffect(() => {
    if (open) {
      setMonth(initialMonth);
      setFiles([]);
    }
  }, [open, initialMonth]);

  const submit = () => {
    if (files.length === 0) return;
    onUpload(files, month);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload GST file</DialogTitle>
          <DialogDescription>Excel file of the fees paid that month. The file is stored under the month you pick.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Month</Label>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Select value={monthNumber} onValueChange={(value) => setMonth(`${year}-${value}`)}>
                <SelectTrigger aria-label="Month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => {
                    const value = String(index + 1).padStart(2, "0");
                    return <SelectItem key={value} value={value}>{name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={(value) => setMonth(`${value}-${monthNumber}`)}>
                <SelectTrigger aria-label="Year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gst-file">File</Label>
            <Input
              id="gst-file"
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || files.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;

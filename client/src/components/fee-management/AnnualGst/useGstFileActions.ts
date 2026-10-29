import { useCallback, useEffect, useState } from "react";
import type { GstMonthUpload } from "@shared/annualGstTypes";
import { useToast } from "@/hooks/use-toast";
import { annualGstApi } from "@/lib/annualGstApi";
import { downloadFile } from "@/lib/fileViewerUtils";

export interface ViewerFile {
  url: string;
  type: string;
  name: string;
  size?: number;
  fileType?: string;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Opens, previews and downloads stored GST files through the signed-in user's token. */
export function useGstFileActions() {
  const { toast } = useToast();
  const [viewerFile, setViewerFile] = useState<ViewerFile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fail = useCallback(
    (error: unknown) => toast({ title: "Could not open file", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }),
    [toast],
  );

  const closeViewer = useCallback(() => {
    setViewerFile((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => closeViewer(), [closeViewer]);

  const openFile = async (upload: GstMonthUpload) => {
    if (!upload.fileUrl) return;
    const extension = extensionOf(upload.fileName);
    // Open the tab before awaiting so the browser does not block it as a pop-up.
    const pdfTab = extension === "pdf" ? window.open("", "_blank") : null;
    setBusyId(upload.id);
    try {
      const url = await annualGstApi.fileObjectUrl(upload.fileUrl);
      if (pdfTab) {
        pdfTab.location.href = url;
        return;
      }
      closeViewer();
      setViewerFile({ url, type: extension, name: upload.fileName, size: upload.fileSize, fileType: extension.toUpperCase() });
    } catch (error) {
      pdfTab?.close();
      fail(error);
    } finally {
      setBusyId(null);
    }
  };

  const download = async (upload: GstMonthUpload) => {
    if (!upload.fileUrl) return;
    setBusyId(upload.id);
    try {
      const url = await annualGstApi.fileObjectUrl(upload.fileUrl);
      downloadFile(url, upload.fileName);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      fail(error);
    } finally {
      setBusyId(null);
    }
  };

  return { viewerFile, busyId, openFile, download, closeViewer };
}

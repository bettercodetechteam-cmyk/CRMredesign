import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Download, FileText, Image, FileVideo, FileSpreadsheet, Search } from "lucide-react";
import { openFileInNewTab, openInGoogleDocsViewer, openInOfficeOnline, openInGoogleSheets, downloadFile } from "@/lib/fileViewerUtils";
import { InlineLoading } from "@/components/ui/loading";
import * as XLSX from "xlsx";

interface FileViewerProps {
  file: {
    url: string;
    type: string;
    name: string;
    size?: number;
    fileType?: string;
  };
  onClose: () => void;
}

export function EnhancedFileViewer({ file, onClose }: FileViewerProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'google' | 'office'>('preview');
  const [loading, setLoading] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [sheetRows, setSheetRows] = useState<Array<Array<string | number | boolean | null>>>([]);
  const [sheetPreviewError, setSheetPreviewError] = useState("");
  const [sheetPreviewLoading, setSheetPreviewLoading] = useState(false);
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetPage, setSheetPage] = useState(1);

  const fileExtension = useMemo(() => file.type.toLowerCase(), [file.type]);
  const isSpreadsheetFile = useMemo(
    () => ['xlsx', 'xls', 'csv'].includes(fileExtension),
    [fileExtension]
  );

  useEffect(() => {
    const loadSpreadsheetPreview = async () => {
      if (!isSpreadsheetFile) {
        setSheetNames([]);
        setSelectedSheet("");
        setSheetRows([]);
        setSheetPreviewError("");
        return;
      }

      try {
        setSheetPreviewLoading(true);
        setSheetPreviewError("");

        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file (${response.status})`);
        }

        const fileBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(fileBuffer, { type: "array" });
        const names = workbook.SheetNames || [];

        if (names.length === 0) {
          setSheetNames([]);
          setSelectedSheet("");
          setSheetRows([]);
          setSheetPreviewError("No sheets found in this file.");
          return;
        }

        const firstSheetName = names[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          raw: false,
          blankrows: false,
        }) as Array<Array<string | number | boolean | null>>;

        setSheetNames(names);
        setSelectedSheet(firstSheetName);
        setSheetRows(rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not preview this spreadsheet.";
        setSheetPreviewError(message);
        setSheetNames([]);
        setSelectedSheet("");
        setSheetRows([]);
      } finally {
        setSheetPreviewLoading(false);
      }
    };

    loadSpreadsheetPreview();
  }, [file.url, isSpreadsheetFile]);

  useEffect(() => {
    setSheetSearch("");
    setSheetPage(1);
  }, [selectedSheet, file.url]);

  const handleSheetChange = async (sheetName: string) => {
    if (!sheetName || !isSpreadsheetFile) return;
    try {
      setSheetPreviewLoading(true);
      setSheetPreviewError("");

      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file (${response.status})`);
      }
      const fileBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error("Selected sheet not found.");
      }

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        blankrows: false,
      }) as Array<Array<string | number | boolean | null>>;

      setSelectedSheet(sheetName);
      setSheetRows(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load sheet preview.";
      setSheetPreviewError(message);
    } finally {
      setSheetPreviewLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    const extension = type.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      return <Image className="h-8 w-8 text-purple-500" />;
    }
    if (extension === 'pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension)) {
      return <FileVideo className="h-8 w-8 text-blue-500" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(extension)) {
      return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    }
    if (['doc', 'docx'].includes(extension)) {
      return <FileText className="h-8 w-8 text-blue-600" />;
    }
    if (['ppt', 'pptx'].includes(extension)) {
      return <FileText className="h-8 w-8 text-orange-500" />;
    }
    if (['txt', 'rtf'].includes(extension)) {
      return <FileText className="h-8 w-8 text-gray-500" />;
    }
    if (['zip', 'rar', '7z'].includes(extension)) {
      return <FileText className="h-8 w-8 text-yellow-500" />;
    }
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  const handleGoogleSheetsView = () => {
    setLoading(true);
    openInGoogleSheets(file.url);
    setLoading(false);
  };

  const handleOfficeOnlineView = () => {
    setLoading(true);
    openInOfficeOnline(file.url);
    setLoading(false);
  };

  const handleOpenInNewTab = () => {
    openFileInNewTab({
      url: file.url,
      fileName: file.name,
      fileType: file.type
    });
  };

  const renderPreview = () => {
    const extension = file.type.toLowerCase();
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      return (
        <div className="w-full flex flex-col items-center space-y-4">
          <img 
            src={file.url} 
            alt={file.name} 
            className="object-contain max-h-[50vh] max-w-full rounded border border-gray-200 shadow"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden text-center">
            <p className="text-gray-600 mb-2">Image preview not available</p>
            <Button onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOpenInNewTab}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
            <Button 
              onClick={() => downloadFile(file.url, file.name)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }
    
    // PDFs
    if (extension === 'pdf') {
      return (
        <div className="w-full text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="h-16 w-16 text-red-500" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-600">PDF Document</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOpenInNewTab}
              className="bg-red-600 hover:bg-red-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open PDF in new tab
            </Button>
            <Button 
              onClick={() => openInGoogleDocsViewer(file.url)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open in Google Docs Viewer
            </Button>
            <Button 
              onClick={() => downloadFile(file.url, file.name)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }
    
    // Videos
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension)) {
      return (
        <div className="w-full flex flex-col items-center space-y-4">
          <video 
            src={file.url} 
            controls 
            className="w-full max-h-[50vh] rounded shadow border border-gray-200"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden text-center">
            <p className="text-gray-600 mb-2">Video preview not available</p>
            <Button onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOpenInNewTab}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
            <Button 
              onClick={() => downloadFile(file.url, file.name)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }
    
    // Excel/Spreadsheet files
    if (['xlsx', 'xls', 'csv'].includes(extension)) {
      const maxPreviewCols = 30;
      const rowsPerPage = 25;
      const headerRow = sheetRows[0] || [];
      const bodyRows = sheetRows.slice(1);
      const normalizedSearch = sheetSearch.trim().toLowerCase();
      const filteredBodyRows = normalizedSearch
        ? bodyRows.filter((row) =>
            row.some((cell) => String(cell ?? "").toLowerCase().includes(normalizedSearch))
          )
        : bodyRows;

      const totalPages = Math.max(1, Math.ceil(filteredBodyRows.length / rowsPerPage));
      const safePage = Math.min(sheetPage, totalPages);
      const startIndex = (safePage - 1) * rowsPerPage;
      const pagedBodyRows = filteredBodyRows.slice(startIndex, startIndex + rowsPerPage);
      const visibleRows = [headerRow, ...pagedBodyRows];
      const columnCount = visibleRows.reduce((count, row) => Math.max(count, row.length), 0);
      const visibleColumns = Math.min(columnCount, maxPreviewCols);

      return (
        <div className="w-full space-y-4">

          {sheetNames.length > 1 && (
            <div className="flex gap-2 flex-wrap border-b pb-2">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    selectedSheet === name
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => handleSheetChange(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="relative w-full sm:max-w-sm">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sheetSearch}
                onChange={(e) => {
                  setSheetSearch(e.target.value);
                  setSheetPage(1);
                }}
                placeholder="Search rows in this sheet..."
                className="w-full border border-indigo-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-gradient-to-r from-white to-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 font-medium">
              {filteredBodyRows.length} row(s) found
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 overflow-auto max-h-[52vh] shadow-inner bg-gradient-to-b from-white to-slate-50/80">
            {sheetPreviewLoading ? (
              <div className="p-6 flex items-center justify-center">
                <InlineLoading size="md" color="primary" />
              </div>
            ) : sheetPreviewError ? (
              <div className="p-4 text-sm text-red-600">
                Could not load inline preview: {sheetPreviewError}
              </div>
            ) : visibleRows.length === 0 || visibleColumns === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                This sheet is empty.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse min-w-max">
                <tbody>
                  {visibleRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? "bg-gradient-to-r from-indigo-100 to-purple-100" : "bg-white even:bg-indigo-50/25 hover:bg-purple-50/60"}>
                      {Array.from({ length: visibleColumns }).map((_, colIndex) => (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          className={`border border-indigo-100 px-2 py-1.5 align-top whitespace-nowrap ${
                            colIndex === 0 ? "sticky left-0 z-10 bg-white shadow-[1px_0_0_0_#dbeafe]" : ""
                          } ${
                            rowIndex === 0 ? "font-semibold text-indigo-900 sticky top-0 z-20 bg-gradient-to-r from-indigo-100 to-purple-100 shadow-[0_1px_0_0_#dbeafe]" : "text-slate-700"
                          }`}
                          title={String(row[colIndex] ?? "")}
                        >
                          {String(row[colIndex] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 bg-slate-100 rounded-full px-3 py-1">
              Showing columns: {visibleColumns}/{columnCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setSheetPage((prev) => Math.max(1, prev - 1))}
                className="rounded-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                Prev
              </Button>
              <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
                Page {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setSheetPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                Next
              </Button>
            </div>
          </div>

        </div>
      );
    }
    
    // Word documents
    if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="w-full text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="h-16 w-16 text-blue-600" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-600">Word Document</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOfficeOnlineView}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <InlineLoading size="sm" color="primary" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Open in Office Online
            </Button>
            <Button 
              onClick={() => openInGoogleDocsViewer(file.url)}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open in Google Docs Viewer
            </Button>
            <Button 
              onClick={handleOpenInNewTab}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </div>
      );
    }
    
    // PowerPoint presentations
    if (['ppt', 'pptx'].includes(extension)) {
      return (
        <div className="w-full text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="h-16 w-16 text-orange-500" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-600">PowerPoint Presentation</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOfficeOnlineView}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <InlineLoading size="sm" color="primary" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Open in Office Online
            </Button>
            <Button 
              onClick={() => openInGoogleDocsViewer(file.url)}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open in Google Docs Viewer
            </Button>
            <Button 
              onClick={handleOpenInNewTab}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </div>
      );
    }
    
    // Text files
    if (['txt', 'rtf'].includes(extension)) {
      return (
        <div className="w-full text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="h-16 w-16 text-gray-500" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-600">Text Document</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleOpenInNewTab}
              className="bg-gray-600 hover:bg-gray-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
            <Button 
              onClick={() => downloadFile(file.url, file.name)}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      );
    }
    
    // Compressed files
    if (['zip', 'rar', '7z'].includes(extension)) {
      return (
        <div className="w-full text-center space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <FileText className="h-16 w-16 text-yellow-500" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-600">Compressed Archive</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => downloadFile(file.url, file.name)}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Archive
            </Button>
            <Button 
              onClick={handleOpenInNewTab}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </div>
      );
    }
    
    // Default fallback
    return (
      <div className="w-full text-center space-y-4">
        <div className="flex items-center justify-center space-x-4">
          {getFileIcon(file.type)}
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">{file.name}</h3>
            <p className="text-sm text-gray-600">File type: {file.type.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={handleOpenInNewTab}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
          <Button 
            onClick={() => downloadFile(file.url, file.name)}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/55 to-indigo-900/55 backdrop-blur-[3px] p-4">
      <div className="bg-gradient-to-b from-white via-white to-indigo-50/35 rounded-2xl shadow-2xl p-6 sm:p-7 max-w-6xl w-full relative flex flex-col items-center border border-indigo-100 min-h-[600px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-5 pb-4 border-b border-indigo-100">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-indigo-100 border border-emerald-200 flex items-center justify-center shadow-sm">
              {getFileIcon(file.type)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 break-words">{file.name}</h2>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Badge variant="outline" className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 border-indigo-200 rounded-full px-2.5">
                  {file.fileType || file.type.toUpperCase()}
                </Badge>
                {file.size && <span>{(file.size / 1024).toFixed(1)} KB</span>}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full border border-transparent hover:border-red-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="w-full flex-1 overflow-auto pr-1">
          {renderPreview()}
        </div>

        {/* Footer Actions */}
        <div className="w-full flex justify-center gap-3 mt-5 pt-4 border-t border-slate-200">
          <Button 
            onClick={handleOpenInNewTab}
            variant="outline"
            className="rounded-full px-5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
          <Button 
            onClick={() => downloadFile(file.url, file.name)}
            variant="outline"
            className="rounded-full px-5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
} 
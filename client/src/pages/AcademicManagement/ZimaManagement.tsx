import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image,
  ArrowLeft,
  Folder as FolderIcon,
  FileVideo,
  Eye,
  Download as DownloadIcon,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  X,
  ExternalLink,
  Search
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getCleanFileName } from "@/lib/utils";
import { getImageKitAuthParams, initializeImageKit, testImageKitConfig } from "@/lib/imagekitConfig";
import { EnhancedFileViewer } from "@/components/EnhancedFileViewer";
import { openFileInNewTab } from "@/lib/fileViewerUtils";
import { InlineLoading } from "@/components/ui/loading";
import { getAcademicApiUrl, getDeleteFileUrl, fetchWithRetry, parseListFilesResponse } from "@/lib/academicFileApi";

interface FileItem {
  name: string;
  url: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
  path: string;
  fileId?: string;
}

const SKELETON_COUNT = 8;
let imagekit: any = null;

const initializeImageKitInstance = async () => {
  try {
    imagekit = await initializeImageKit();
  } catch (error) {
    console.error("Failed to initialize ImageKit:", error);
  }
};

function getDisplayFileName(fileName: string) {
  return getCleanFileName(fileName);
}

const ZIMA_FOLDER = "/zima-curriculum";

export default function ZimaManagement() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>(ZIMA_FOLDER);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([ZIMA_FOLDER]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewFile, setPreviewFile] = useState<{url: string, type: string, name: string, size?: number, fileType?: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const init = async () => {
      const configTest = await testImageKitConfig();
      if (configTest) await initializeImageKitInstance();
    };
    init();
  }, []);

  useEffect(() => {
    loadFiles(currentFolder);
  }, [currentFolder]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) setSelectedFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFiles?.length) {
      toast({ title: "No files selected", description: "Please select files to upload", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await Promise.all(Array.from(selectedFiles).map(async (file) => {
        const { token, expire, signature } = await getImageKitAuthParams();
        return new Promise<void>((resolve, reject) => {
          imagekit.upload(
            { file, fileName: file.name, token, expire, signature, folder: currentFolder },
            (err: any, result: any) => {
              if (err) reject(err);
              else if (result?.url) resolve();
              else reject(new Error("Unknown upload error"));
            }
          );
        });
      }));
      toast({ title: "Success", description: `${selectedFiles.length} file(s) uploaded successfully` });
      setSelectedFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadFiles(currentFolder);
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload files", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!window.confirm(`Delete ${fileName}? This cannot be undone.`)) return;
    try {
      const deleteUrl = getDeleteFileUrl(fileId);
      const res = await fetchWithRetry(deleteUrl, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }) });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      loadFiles(currentFolder);
      toast({ title: "Deleted", description: `${fileName} deleted` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" });
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = getDisplayFileName(fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    let safeFolderName = newFolderName.trim().replace(/[^a-zA-Z0-9-_. ]/g, "").replace(/ +/g, "-").replace(/^[\-.\/]+|[\-.\/]$/g, "");
    if (!safeFolderName) {
      toast({ title: "Error", description: "Invalid folder name.", variant: "destructive" });
      return;
    }
    let folderPath = `${currentFolder.replace(/\/+$/, '')}/${safeFolderName}`.replace(/^\/+/, '');
    setCreatingFolder(true);
    try {
      const { token, expire, signature } = await getImageKitAuthParams();
      await new Promise((resolve, reject) => {
        imagekit.upload(
          { file: new Blob(["keep"], { type: "text/plain" }), fileName: ".keep", token, expire, signature, folder: folderPath },
          (err: any, result: any) => { if (err) reject(err); else resolve(result); }
        );
      });
      setShowNewFolderModal(false);
      setNewFolderName("");
      loadFiles(currentFolder);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create folder", variant: "destructive" });
    } finally {
      setCreatingFolder(false);
    }
  };

  async function loadFiles(folder: string) {
    setLoading(true);
    try {
      const listFilesUrl = getAcademicApiUrl("list-files");
      const res = await fetchWithRetry(listFilesUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const filesArr = parseListFilesResponse(data);
      if (filesArr.length === 0 && data && typeof data === "object" && "error" in data) {
        setFiles([]);
        setFolders([]);
        setLoading(false);
        toast({ title: "Error", description: (data as { error?: string }).error ?? "Failed to load files.", variant: "destructive" });
        return;
      }
      const folderNorm = folder.replace(/^\/+/, '');
      const folderSet = new Set<string>();
      const fileList: any[] = [];
      filesArr.forEach((f: any) => {
        const rawPath = f.filePath || f.path || '';
        const path = (typeof rawPath === 'string' ? rawPath : '').replace(/^\/+/, '');
        const isInCurrentFolder = path === folderNorm || path.startsWith(folderNorm + "/");
        if (!isInCurrentFolder) return;
        const relPath = path === folderNorm ? '' : path.slice(folderNorm.length + 1);
        if (relPath.includes("/")) {
          folderSet.add(relPath.split("/")[0]);
        } else if (f.name !== ".keep") {
          fileList.push({ name: f.name, url: f.url, type: 'file', path: path, fileId: f.fileId, size: f.size, ext: (f.name || '').split('.').pop()?.toLowerCase() || '' });
        }
      });
      setFiles(fileList);
      setFolders(Array.from(folderSet));
    } catch (err) {
      toast({ title: "Error", description: "Failed to load files from ImageKit", variant: "destructive" });
      setFiles([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  const handleFolderClick = (folderName: string) => {
    const newPath = `${currentFolder.replace(/\/+$/, '')}/${folderName}`;
    setCurrentFolder(newPath);
    setBreadcrumbs([...breadcrumbs, folderName]);
  };

  const handleBreadcrumbClick = (idx: number) => {
    const newPath = breadcrumbs.slice(0, idx + 1).join("/");
    setCurrentFolder(newPath);
    setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
  };

  const handleOpenOrDownload = (file: FileItem) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    openFileInNewTab({ url: file.url, fileName: file.name, fileType: ext });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => window.history.back()} className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to Academics
            </button>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderIcon className="w-8 h-8 text-blue-600" />
            ZIMA Curriculum Management
          </h1>
          <p className="text-slate-500 mt-1">
            Upload and manage ZIMA curriculum files and folders
          </p>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-sm">
        <CardContent className="p-4">
          <div
            className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border-2 border-dashed transition-all ${dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept="*/*" />
            <div className="flex-1 flex items-center gap-3 p-3 cursor-pointer min-h-[52px]">
              <Upload className={`h-5 w-5 shrink-0 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
              <span className="text-sm text-slate-600">
                {selectedFiles?.length ? `${selectedFiles.length} file(s) selected` : 'Drag & drop files here or click to browse'}
              </span>
            </div>
            {selectedFiles && (
              <div className="flex flex-wrap gap-2 px-3 pb-3 sm:pb-0 sm:px-0">
                {Array.from(selectedFiles).map((file, idx) => (
                  <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                    <FileText className="h-3 w-3 mr-1" /> {file.name}
                    <button type="button" className="ml-1.5 text-blue-500 hover:text-red-500" aria-label={`Remove ${file.name}`} onClick={e => { e.stopPropagation(); const dt = new DataTransfer(); Array.from(selectedFiles).forEach((f, i) => { if (i !== idx) dt.items.add(f); }); setSelectedFiles(dt.files.length ? dt.files : null); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <Button onClick={e => { e.stopPropagation(); handleUpload(); }} disabled={uploading || !selectedFiles} size="sm" className="shrink-0 mx-3 mb-3 sm:mb-0 sm:mx-0 bg-blue-600 hover:bg-blue-700">
              {uploading ? <><InlineLoading size="sm" color="primary" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center w-full justify-between gap-3">
              <div className="flex items-center gap-2">
                <FolderIcon className="h-5 w-5 text-slate-600" />
                <span className="text-lg font-semibold text-slate-900">Uploaded Files</span>
                <span className="text-sm text-slate-500">
                  ({searchQuery.trim() ? `${folders.filter(f => f.toLowerCase().includes(searchQuery.trim().toLowerCase())).length} of ${folders.length} folders` : `${folders.length} folders`}, {searchQuery.trim() ? `${files.filter(f => getDisplayFileName(f.name).toLowerCase().includes(searchQuery.trim().toLowerCase())).length} of ${files.length} files` : `${files.length} files`})
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {breadcrumbs.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => { setCurrentFolder(breadcrumbs.slice(0, -1).join("/")); setBreadcrumbs(breadcrumbs.slice(0, -1)); }} className="border-slate-200">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Up
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowNewFolderModal(true)} className="bg-blue-600 hover:bg-blue-700">+ New Folder</Button>
                <Button variant="outline" size="icon" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-slate-100' : ''}><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-slate-100' : ''}><ListIcon className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex gap-2 mt-2 w-full text-sm text-slate-600">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className={`cursor-pointer hover:underline ${idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-900' : ''}`} onClick={() => handleBreadcrumbClick(idx)}>
                  {idx > 0 && ' / '}{crumb.replace(ZIMA_FOLDER, 'ZIMA')}
                </span>
              ))}
            </div>
            <div className="mt-3 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search curriculum..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 border-slate-200 bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
          </CardHeader>
          {showNewFolderModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col gap-4 min-w-[280px]">
                <h2 className="text-lg font-bold">Create New Folder</h2>
                <input className="border border-slate-200 p-2 rounded-lg" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" disabled={creatingFolder} />
                <div className="flex gap-2 justify-end">
                  <Button onClick={() => !creatingFolder && setShowNewFolderModal(false)} variant="ghost" disabled={creatingFolder}>Cancel</Button>
                  <Button onClick={handleCreateFolder} disabled={!newFolderName || creatingFolder}>
                    {creatingFolder ? <><InlineLoading size="sm" color="primary" /> Creating...</> : "Create"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <CardContent className="w-full p-6 relative">
            {uploading && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-b-lg">
                <div className="flex flex-col items-center gap-2">
                  <InlineLoading size="md" color="primary" />
                  <span className="text-sm font-medium text-slate-600">Uploading...</span>
                </div>
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-6 w-full">
                {[...Array(SKELETON_COUNT)].map((_, idx) => (
                  <div key={idx} className="animate-pulse flex flex-col items-center p-4 bg-slate-100 rounded-lg h-40">
                    <div className="h-12 w-12 bg-slate-300 rounded-full mb-4" />
                    <div className="h-4 w-24 bg-slate-300 rounded mb-2" />
                    <div className="h-3 w-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {(() => {
                  const q = searchQuery.trim().toLowerCase();
                  const filteredFolders = q ? folders.filter(f => f.toLowerCase().includes(q)) : folders;
                  const filteredFiles = q ? files.filter(f => getDisplayFileName(f.name).toLowerCase().includes(q)) : files;
                  return (
                    <>
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full mb-4">
                    {filteredFolders.map(folder => (
                      <div key={folder} className="group flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all min-h-[88px] cursor-pointer" onClick={() => handleFolderClick(folder)}>
                        <FolderIcon className="h-10 w-10 text-slate-600 mb-2" />
                        <div className="font-medium text-sm text-slate-900 w-full text-center break-words truncate" title={folder}>{folder}</div>
                      </div>
                    ))}
                  </div>
                )}
                {filteredFiles.length > 0 && (
                  viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                      {filteredFiles.filter(f => !f.name.endsWith('.keep')).map((file) => {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        let icon = <FileText className="h-12 w-12 text-gray-400" />;
                        if (["jpg","jpeg","png","gif","bmp","svg","webp"].includes(ext || "")) icon = <Image className="h-12 w-12 text-purple-500" />;
                        else if (ext === "pdf") icon = <FileText className="h-12 w-12 text-red-500" />;
                        else if (["mp4","mov","avi","webm","mkv"].includes(ext || "")) icon = <FileVideo className="h-12 w-12 text-blue-500" />;
                        return (
                          <div key={file.fileId} className="group relative flex flex-col items-center p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all min-h-[180px] cursor-pointer"
                            onClick={() => ext === 'pdf' ? window.open(file.url, '_blank') : setPreviewFile({ url: file.url, type: ext || '', name: file.name, size: file.size, fileType: file.type })}>
                            <div className="mb-4 flex items-center justify-center w-full">{icon}</div>
                            <div className="w-full text-center mb-2">
                              <span className="block font-semibold text-base text-gray-900 break-words whitespace-normal leading-tight" title={file.name}>{getDisplayFileName(file.name)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-4">
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200 px-2 py-0.5">file</Badge>
                              {file.size && <span>{(file.size / 1024).toFixed(1)} KB</span>}
                            </div>
                            <div className="flex gap-3 mt-auto w-full justify-center" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => handleDownload(file.url, file.name)} className="h-10 w-10 p-0 text-blue-600 hover:bg-blue-100" title="Download"><DownloadIcon className="h-5 w-5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => ext === 'pdf' ? window.open(file.url, '_blank') : setPreviewFile({ url: file.url, type: ext || '', name: file.name, size: file.size, fileType: file.type })} className="h-10 w-10 p-0 text-green-600 hover:bg-green-100" title={ext === 'pdf' ? 'Open PDF' : 'Preview'}><Eye className="h-5 w-5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(file.fileId!, file.name)} className="h-10 w-10 p-0 text-red-500 hover:bg-red-100" title="Delete"><Trash2 className="h-5 w-5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleOpenOrDownload(file)} className="h-10 w-10 p-0 text-purple-600 hover:bg-purple-100" title="Open in new tab"><ExternalLink className="h-5 w-5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <table className="w-full bg-white rounded shadow text-left">
                      <thead><tr><th className="p-3">File</th><th className="p-3">Type</th><th className="p-3">Size</th><th className="p-3">Actions</th></tr></thead>
                      <tbody>
                        {filteredFiles.filter(f => !f.name.endsWith('.keep')).map(file => {
                          const ext = file.name.split('.').pop()?.toLowerCase();
                          return (
                            <tr key={file.fileId} className="hover:bg-blue-50 cursor-pointer" onClick={() => ext === 'pdf' ? window.open(file.url, '_blank') : setPreviewFile({ url: file.url, type: ext || '', name: file.name, size: file.size, fileType: file.type })}>
                              <td className="p-3 flex items-center gap-3">
                                {ext === 'pdf' ? <FileText className="h-7 w-7 text-red-500" /> : <FileText className="h-7 w-7 text-gray-400" />}
                                <span className="font-semibold text-base text-gray-900 break-words" title={file.name}>{getDisplayFileName(file.name)}</span>
                              </td>
                              <td className="p-3">file</td>
                              <td className="p-3">{file.size ? (file.size / 1024).toFixed(1) + ' KB' : ''}</td>
                              <td className="p-3 flex gap-2" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => handleDownload(file.url, file.name)} className="h-9 w-9 p-0 text-blue-600"><DownloadIcon className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => ext === 'pdf' ? window.open(file.url, '_blank') : setPreviewFile({ url: file.url, type: ext || '', name: file.name, size: file.size, fileType: file.type })} className="h-9 w-9 p-0 text-green-600"><Eye className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(file.fileId!, file.name)} className="h-9 w-9 p-0 text-red-500"><Trash2 className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenOrDownload(file)} className="h-9 w-9 p-0 text-purple-600"><ExternalLink className="h-5 w-5" /></Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                )}
                {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 w-full">
                    <FolderIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-slate-900 mb-1 text-center">
                      {searchQuery.trim() ? "No matching files or folders" : "No files or folders found"}
                    </h3>
                    <p className="text-sm text-slate-500 text-center">
                      {searchQuery.trim() ? "Try a different search term." : "Upload your first file or create a new folder above."}
                    </p>
                  </div>
                )}
                    </>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      {previewFile && <EnhancedFileViewer file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

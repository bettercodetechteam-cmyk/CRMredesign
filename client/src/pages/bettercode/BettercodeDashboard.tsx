import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowLeft, FileText, Receipt, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import bettercodeLogo from "@/assets/abettercode logo updated.png";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";

export interface BettercodeRecentFile {
  id: string;
  quotationNumber: string | null;
  clientCompanyName: string;
  projectTitle: string;
  pdfUrl: string;
  fileName: string;
  createdAt: Timestamp | null;
}

export default function BettercodeDashboard() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const [recentFiles, setRecentFiles] = useState<BettercodeRecentFile[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoadingRecent(false);
      return;
    }
    const q = query(
      collection(db, "bettercodeQuotations"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    getDocs(q)
      .then((snap) => {
        const list: BettercodeRecentFile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            quotationNumber: data.quotationNumber ?? null,
            clientCompanyName: data.clientCompanyName ?? "",
            projectTitle: data.projectTitle ?? "",
            pdfUrl: data.pdfUrl ?? "",
            fileName: data.fileName ?? "",
            createdAt: data.createdAt ?? null,
          };
        });
        setRecentFiles(list);
      })
      .catch(() => setRecentFiles([]))
      .finally(() => setLoadingRecent(false));
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/bettercode");
    } catch {
      navigate("/bettercode");
    }
  };

  const handleBackToZica = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-black/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <img
              src={bettercodeLogo}
              alt="a-bettercode"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToZica}
              className="text-neutral-300 hover:text-white hover:bg-neutral-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden xs:inline">ZICA CRM</span>
            </Button>
            <div className="w-px h-5 bg-neutral-700" />
            <span className="text-sm text-neutral-400 hidden sm:inline truncate max-w-[120px]">
              {userProfile?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main - Quotation & Invoice cards */}
      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Dashboard
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Welcome back. Choose a module below.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
          {/* Quotation card */}
          <Card
            className="bg-neutral-900 border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors cursor-pointer group"
            onClick={() => navigate("/bettercode/quotation")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-orange-500/20 text-orange-500">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Quotation</h2>
                    <p className="text-neutral-400 text-sm">Create & manage quotations</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-500 text-sm">
                View and create quotation documents.
              </p>
            </CardContent>
          </Card>

          {/* Invoice card */}
          <Card
            className="bg-neutral-900 border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors cursor-pointer group"
            onClick={() => navigate("/bettercode/invoice")}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-orange-500/20 text-orange-500">
                    <Receipt className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Invoice</h2>
                    <p className="text-neutral-400 text-sm">Create & manage invoices</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-500 text-sm">
                View and create invoice documents.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent files */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white mb-3">Recent files</h2>
          {loadingRecent ? (
            <div className="flex items-center gap-2 text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : recentFiles.length === 0 ? (
            <p className="text-neutral-500 text-sm">No quotations yet. Create one from Quotation.</p>
          ) : (
            <Card className="bg-neutral-900 border-neutral-800 rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <ul className="divide-y divide-neutral-800">
                  {recentFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">
                          {file.clientCompanyName || file.projectTitle || file.fileName || "Quotation"}
                        </p>
                        <p className="text-neutral-400 text-sm truncate">
                          {file.projectTitle && file.clientCompanyName
                            ? `${file.projectTitle} • ${file.clientCompanyName}`
                            : file.quotationNumber || file.fileName}
                        </p>
                        {file.createdAt && (
                          <p className="text-neutral-500 text-xs mt-0.5">
                            {file.createdAt.toDate?.()?.toLocaleDateString?.() ?? ""}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(file.pdfUrl, "_blank")}
                        className="text-orange-400 hover:text-orange-300 hover:bg-neutral-800 shrink-0"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View PDF
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

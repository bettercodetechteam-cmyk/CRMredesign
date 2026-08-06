import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ArrowLeft, Receipt } from "lucide-react";
import bettercodeLogo from "@/assets/abettercode logo updated.png";

export default function BettercodeInvoice() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/bettercode");
    } catch {
      navigate("/bettercode");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
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
              onClick={() => navigate("/bettercode/dashboard")}
              className="text-neutral-300 hover:text-white hover:bg-neutral-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden xs:inline">Dashboard</span>
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

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Invoice
          </h1>
        </div>
        <p className="text-neutral-400 text-sm mb-6">
          Create and manage invoices.
        </p>

        <Card className="bg-neutral-900 border-neutral-800 rounded-xl overflow-hidden">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">Invoice list</h2>
            <p className="text-neutral-400 text-sm">Your invoices will appear here.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-[280px] w-full bg-neutral-800 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 bg-neutral-700 rounded" />
              <Skeleton className="h-9 w-28 bg-neutral-700 rounded" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

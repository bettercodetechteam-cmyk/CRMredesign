import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DollarSign, FileText, GraduationCap, ArrowRight, X, FolderPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import zicaImage from "@/assets/Zica Image .jpg";
import zimaImage from "@/assets/Zima Image.jpg";

export default function Academics() {
  const [feesModalOpen, setFeesModalOpen] = useState(false);
  const [curriculumModalOpen, setCurriculumModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleFeesNavigation = (brand: "zica" | "zima" | "other") => {
    setFeesModalOpen(false);
    if (brand === "zica") navigate("/academics/fees");
    else if (brand === "zima") navigate("/academics/zima-fees");
    else navigate("/academics/other");
  };

  const handleCurriculumNavigation = (brand: "zica" | "zima" | "other") => {
    setCurriculumModalOpen(false);
    if (brand === "zica") navigate("/academics/zica-management");
    else if (brand === "zima") navigate("/academics/zima-management");
    else navigate("/academics/other");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            Academic Management
          </h1>
          <p className="text-slate-500 mt-1">
            Curriculum and fees management for ZICA and ZIMA programs
          </p>
        </div>
      </div>

      {/* Cards - equal height so buttons align on one line */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-stretch">
        {/* Fees Management */}
        <Card className="border-slate-200/60 shadow-sm flex flex-col h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Fees Management
                </h2>
                <p className="text-sm text-slate-500">
                  Financial administration and payment tracking
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col flex-1 min-h-0">
            <div className="flex flex-col flex-1 min-h-0">
              <p className="text-sm text-slate-600 mb-4">
                Manage fee structures, payment schedules, and records for ZICA and
                ZIMA programs.
              </p>
              <div className="flex-1 min-h-[1rem]" />
              <Dialog open={feesModalOpen} onOpenChange={setFeesModalOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap justify-center">
                  Access Fees Portal
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </DialogTrigger>
              <DialogContent hideCloseButton className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-xl bg-white">
                <DialogHeader className="relative px-5 py-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3 pr-10">
                    <div>
                      <DialogTitle className="text-lg font-semibold text-slate-900 tracking-tight">
                        Select brand for Fees
                      </DialogTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        Choose ZICA or ZIMA to manage fees and payments
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFeesModalOpen(false)}
                      className="shrink-0 absolute right-3 top-3 rounded-full h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogHeader>
                <div className="p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleFeesNavigation("zica")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-blue-50/50 hover:border-blue-200/80 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center overflow-hidden group-hover:shadow transition-shadow">
                      <img
                        src={zicaImage}
                        alt="ZICA"
                        className="max-w-full max-h-full w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">ZICA Fees</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Animation & VFX programs
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeesNavigation("zima")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-emerald-50/50 hover:border-emerald-200/80 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center overflow-hidden group-hover:shadow transition-shadow">
                      <img
                        src={zimaImage}
                        alt="ZIMA"
                        className="max-w-full max-h-full w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">ZIMA Fees</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Digital marketing programs
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeesNavigation("other")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center text-slate-500 group-hover:text-slate-700 transition-colors">
                      <FolderPlus className="h-9 w-9" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">Other</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Other fees and documents
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Curriculum Management */}
        <Card className="border-slate-200/60 shadow-sm flex flex-col h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Curriculum Management
                </h2>
                <p className="text-sm text-slate-500">
                  Course materials and educational resources
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col flex-1 min-h-0">
            <div className="flex flex-col flex-1 min-h-0">
              <p className="text-sm text-slate-600 mb-4">
                Access and manage curriculum documents and course materials for
                ZICA and ZIMA programs.
              </p>
              <div className="flex-1 min-h-[1rem]" />
              <Dialog open={curriculumModalOpen} onOpenChange={setCurriculumModalOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap justify-center">
                  Access Curriculum Portal
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </DialogTrigger>
              <DialogContent hideCloseButton className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-xl bg-white">
                <DialogHeader className="relative px-5 py-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3 pr-10">
                    <div>
                      <DialogTitle className="text-lg font-semibold text-slate-900 tracking-tight">
                        Select brand for Curriculum
                      </DialogTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        Choose ZICA or ZIMA to access curriculum and materials
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurriculumModalOpen(false)}
                      className="shrink-0 absolute right-3 top-3 rounded-full h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogHeader>
                <div className="p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleCurriculumNavigation("zica")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-blue-50/50 hover:border-blue-200/80 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center overflow-hidden group-hover:shadow transition-shadow">
                      <img
                        src={zicaImage}
                        alt="ZICA"
                        className="max-w-full max-h-full w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        ZICA Curriculum
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Animation & VFX programs
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurriculumNavigation("zima")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-emerald-50/50 hover:border-emerald-200/80 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center overflow-hidden group-hover:shadow transition-shadow">
                      <img
                        src={zimaImage}
                        alt="ZIMA"
                        className="max-w-full max-h-full w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        ZIMA Curriculum
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Digital marketing programs
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurriculumNavigation("other")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200 text-left group"
                  >
                    <div className="shrink-0 w-[72px] h-[72px] rounded-xl border border-slate-200/80 bg-white shadow-sm flex items-center justify-center text-slate-500 group-hover:text-slate-700 transition-colors">
                      <FolderPlus className="h-9 w-9" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900">Other</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Other curriculum and documents
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardContent>
        </Card>
        {/* Certificate Generation */}
        <Card className="border-slate-200/60 shadow-sm flex flex-col h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Certificate Generation
                </h2>
                <p className="text-sm text-slate-500">
                  Issue and manage student certifications
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col flex-1 min-h-0">
            <div className="flex flex-col flex-1 min-h-0">
              <p className="text-sm text-slate-600 mb-4">
                Generate, download, and track course completion certificates for
                your students.
              </p>
              <div className="flex-1 min-h-[1rem]" />
              <Button 
                onClick={() => navigate("/academics/certificates")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap justify-center"
              >
                Access Certificate Portal
                <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

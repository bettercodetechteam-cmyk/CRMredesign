import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ZICA_CENTRE_ADDRESS, ZICA_CENTRE_ADDRESS_SINGLE_LINE } from "@/constants/centreAddress";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, ArrowLeft, FileText, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import bettercodeLogo from "@/assets/abettercode logo updated.png";
import { generateQuotationPdf, type QuotationPdfData } from "@/lib/bettercodeQuotationPdf";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

type ScopeEntry = { scope_title: string; scope_description: string };
type FeatureEntry = { feature_name: string; feature_description: string };
type ModuleEntry = {
  module_name: string;
  module_description: string;
  features: FeatureEntry[];
};
type CostEntry = {
  service_name: string;
  cost_amount: string;
  cost_type: string;
  remarks: string;
};
type TermEntry = { term_text: string };
type BenefitEntry = { benefit_text: string };

const STATUS_OPTIONS = ["Draft", "Sent", "Approved", "Rejected"];
const COST_TYPES = ["Fixed", "Annual", "At actuals"];

export default function BettercodeQuotation() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();

  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [validTillDate, setValidTillDate] = useState("");
  const [status, setStatus] = useState("Draft");

  const [clientCompanyName, setClientCompanyName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientContactPerson, setClientContactPerson] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");

  const [fromCompanyName, setFromCompanyName] = useState(
    "Bettercode Technologies Pvt Ltd"
  );
  const [fromCompanyAddress, setFromCompanyAddress] = useState(
    ZICA_CENTRE_ADDRESS
  );
  const [fromCompanyWebsite, setFromCompanyWebsite] = useState(
    "www.bettercode.co.in"
  );

  const [projectTitle, setProjectTitle] = useState("");
  const [projectOverview, setProjectOverview] = useState("");
  const [mainObjective, setMainObjective] = useState("");

  const [scopes, setScopes] = useState<ScopeEntry[]>([
    { scope_title: "", scope_description: "" },
  ]);
  const [modules, setModules] = useState<ModuleEntry[]>([
    {
      module_name: "",
      module_description: "",
      features: [{ feature_name: "", feature_description: "" }],
    },
  ]);
  const [costs, setCosts] = useState<CostEntry[]>([
    { service_name: "", cost_amount: "", cost_type: "Fixed", remarks: "" },
  ]);
  const [terms, setTerms] = useState<TermEntry[]>([{ term_text: "" }]);
  const [totalAmount, setTotalAmount] = useState("");
  const [gstPercentage, setGstPercentage] = useState("18");
  const [amountInWords, setAmountInWords] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryEmail, setSignatoryEmail] = useState("");
  const [signatoryPhone, setSignatoryPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [benefits, setBenefits] = useState<BenefitEntry[]>([{ benefit_text: "" }]);
  const [generating, setGenerating] = useState(false);

  const { toast } = useToast();

  const gstAmount = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const pct = parseFloat(gstPercentage) || 0;
    return ((total * pct) / 100).toFixed(2);
  }, [totalAmount, gstPercentage]);

  const grandTotal = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const gst = parseFloat(gstAmount) || 0;
    return (total + gst).toFixed(2);
  }, [totalAmount, gstAmount]);

  const addScope = () =>
    setScopes((s) => [...s, { scope_title: "", scope_description: "" }]);
  const removeScope = (i: number) =>
    setScopes((s) => s.filter((_, idx) => idx !== i));
  const updateScope = (i: number, field: keyof ScopeEntry, value: string) =>
    setScopes((s) =>
      s.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item
      )
    );

  const addModule = () =>
    setModules((m) => [
      ...m,
      {
        module_name: "",
        module_description: "",
        features: [{ feature_name: "", feature_description: "" }],
      },
    ]);
  const removeModule = (i: number) =>
    setModules((m) => m.filter((_, idx) => idx !== i));
  const updateModule = (
    i: number,
    field: keyof ModuleEntry,
    value: string | FeatureEntry[]
  ) =>
    setModules((m) =>
      m.map((item, idx) => (idx === i ? { ...item, [field]: value } : item))
    );
  const addFeature = (moduleIdx: number) =>
    setModules((m) =>
      m.map((item, idx) =>
        idx === moduleIdx
          ? {
              ...item,
              features: [
                ...item.features,
                { feature_name: "", feature_description: "" },
              ],
            }
          : item
      )
    );
  const removeFeature = (moduleIdx: number, featureIdx: number) =>
    setModules((m) =>
      m.map((item, idx) =>
        idx === moduleIdx
          ? {
              ...item,
              features: item.features.filter((_, fi) => fi !== featureIdx),
            }
          : item
      )
    );
  const updateFeature = (
    moduleIdx: number,
    featureIdx: number,
    field: keyof FeatureEntry,
    value: string
  ) =>
    setModules((m) =>
      m.map((item, idx) =>
        idx === moduleIdx
          ? {
              ...item,
              features: item.features.map((f, fi) =>
                fi === featureIdx ? { ...f, [field]: value } : f
              ),
            }
          : item
      )
    );

  const addCost = () =>
    setCosts((c) => [
      ...c,
      { service_name: "", cost_amount: "", cost_type: "Fixed", remarks: "" },
    ]);
  const removeCost = (i: number) =>
    setCosts((c) => c.filter((_, idx) => idx !== i));
  const updateCost = (i: number, field: keyof CostEntry, value: string) =>
    setCosts((c) =>
      c.map((item, idx) => (idx === i ? { ...item, [field]: value } : item))
    );

  const addTerm = () => setTerms((t) => [...t, { term_text: "" }]);
  const removeTerm = (i: number) =>
    setTerms((t) => t.filter((_, idx) => idx !== i));
  const updateTerm = (i: number, value: string) =>
    setTerms((t) =>
      t.map((item, idx) => (idx === i ? { term_text: value } : item))
    );

  const addBenefit = () => setBenefits((b) => [...b, { benefit_text: "" }]);
  const removeBenefit = (i: number) =>
    setBenefits((b) => b.filter((_, idx) => idx !== i));
  const updateBenefit = (i: number, value: string) =>
    setBenefits((b) =>
      b.map((item, idx) => (idx === i ? { benefit_text: value } : item))
    );

  const handleGenerateQuotation = async () => {
    if (!db) {
      toast({
        title: "Error",
        description: "Firebase is not configured. Cannot save quotation.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const gstAmt = ((parseFloat(totalAmount) || 0) * (parseFloat(gstPercentage) || 0)) / 100;
      const grandTot = (parseFloat(totalAmount) || 0) + gstAmt;

      const data: QuotationPdfData = {
        quotationNumber,
        quotationDate,
        validTillDate,
        status,
        clientCompanyName,
        clientAddress,
        clientContactPerson,
        clientEmail,
        clientPhone,
        fromCompanyName,
        fromCompanyAddress,
        fromCompanyWebsite,
        projectTitle,
        projectOverview,
        industry,
        location,
        mainObjective,
        scopes,
        modules,
        costs,
        terms,
        totalAmount,
        gstPercentage,
        gstAmount: gstAmt.toFixed(2),
        grandTotal: grandTot.toFixed(2),
        amountInWords,
        signatoryName,
        signatoryEmail,
        signatoryPhone,
        designation,
        benefits,
      };

      const pdfBytes = await generateQuotationPdf(data);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const safeName = (data.clientCompanyName || "document").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
      const fileName = `Quotation_${quotationNumber?.replace(/\s+/g, "_") || Date.now()}_${safeName}.pdf`;

      let pdfUrl: string | null = null;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Part = dataUrl.indexOf(",") >= 0 ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
          resolve(base64Part);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      try {
        const res = await fetch("/api/bettercode/upload-quotation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName, fileBase64: base64 }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed: ${res.status}`);
        }
        const result = await res.json();
        pdfUrl = result.url || null;
      } catch (uploadErr) {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        toast({
          title: "PDF downloaded",
          description: "Upload to ImageKit failed. Your PDF was downloaded. Ensure the dev server (API) is running.",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      if (pdfUrl && db) {
        const quotationRef = doc(collection(db, "bettercodeQuotations"));
        await setDoc(quotationRef, {
          id: quotationRef.id,
          quotationNumber: quotationNumber || null,
          clientCompanyName: data.clientCompanyName || "",
          projectTitle: data.projectTitle || "",
          pdfUrl,
          fileName,
          createdAt: serverTimestamp(),
          createdBy: userProfile?.id || userProfile?.uid || null,
        });
      }

      toast({
        title: "Quotation generated",
        description: "PDF saved to ImageKit. You can view it from the dashboard.",
      });
      navigate("/bettercode/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate quotation";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/bettercode");
    } catch {
      navigate("/bettercode");
    }
  };

  const handleAutoFill = () => {
    setQuotationNumber("QTN 2026 001");
    setQuotationDate("2026-02-20");
    setValidTillDate("2026-03-20");
    setStatus("Draft");
    setClientCompanyName("RG Spectra Diamond Tools Pvt Ltd");
    setClientAddress("Bhosari, Pune");
    setClientContactPerson("");
    setClientEmail("");
    setClientPhone("");
    setIndustry("Manufacturing (Resin Bond Diamond Wheels & Diamond Tools)");
    setLocation("Bhosari, Pune");
    setFromCompanyName("Bettercode Technologies Pvt Ltd");
    setFromCompanyAddress(ZICA_CENTRE_ADDRESS);
    setFromCompanyWebsite("www.bettercode.co.in");
    setProjectTitle("Cloud-Based Inventory Management Software");
    setProjectOverview(
      "We propose to design and develop a Cloud-Based Inventory Management Software to manage our stock inward and outward operations efficiently at our office and factory."
    );
    setMainObjective(
      "To implement a cloud-based system that enables:\n• Real-time stock tracking\n• Stock inward & outward entry\n• Lot-wise / batch-wise tracking\n• User access control\n• Reports and analytics\n• Multi-user login from different locations"
    );
    setScopes([
      {
        scope_title: "Requirement for Cloud-Based Inventory Management Software",
        scope_description: "Requirement for Cloud-Based Inventory Management Software.",
      },
    ]);
    setModules([
      {
        module_name: "A) Stock Inward Module",
        module_description: "GRN (Goods Receipt Note) entry, Supplier name entry, Material name & code, Quantity received, Batch/Lot number, Date of inward, Auto stock update, Upload purchase invoice copy.",
        features: [
          { feature_name: "GRN (Goods Receipt Note) entry", feature_description: "" },
          { feature_name: "Supplier name entry", feature_description: "" },
          { feature_name: "Material name & code", feature_description: "" },
          { feature_name: "Quantity received", feature_description: "" },
          { feature_name: "Batch/Lot number", feature_description: "" },
          { feature_name: "Date of inward", feature_description: "" },
          { feature_name: "Auto stock update", feature_description: "" },
          { feature_name: "Upload purchase invoice copy", feature_description: "" },
        ],
      },
      {
        module_name: "B) Stock Outward Module",
        module_description: "Issue material to production / sales.",
        features: [
          { feature_name: "Issue material to production / sales", feature_description: "" },
          { feature_name: "Customer name / department name", feature_description: "" },
          { feature_name: "Quantity issued", feature_description: "" },
          { feature_name: "Date of dispatch", feature_description: "" },
          { feature_name: "Delivery challan generation", feature_description: "" },
          { feature_name: "Auto stock deduction", feature_description: "" },
        ],
      },
      {
        module_name: "C) Inventory Control",
        module_description: "Real-time stock availability and control.",
        features: [
          { feature_name: "Real-time stock availability", feature_description: "" },
          { feature_name: "Minimum stock level alert", feature_description: "" },
          { feature_name: "Dead stock report", feature_description: "" },
          { feature_name: "Material movement history", feature_description: "" },
          { feature_name: "Stock adjustment option", feature_description: "" },
        ],
      },
      {
        module_name: "D) Reports Required",
        module_description: "Daily, monthly and export reports.",
        features: [
          { feature_name: "Daily inward/outward report", feature_description: "" },
          { feature_name: "Monthly stock summary", feature_description: "" },
          { feature_name: "Material consumption report", feature_description: "" },
          { feature_name: "Supplier-wise purchase report", feature_description: "" },
          { feature_name: "Customer-wise dispatch report", feature_description: "" },
          { feature_name: "Closing stock report", feature_description: "" },
          { feature_name: "Export options: Excel / PDF", feature_description: "" },
        ],
      },
      {
        module_name: "E) Admin & Security",
        module_description: "Role-based access and security.",
        features: [
          { feature_name: "Role-based access (Admin / Store / Accounts / Production)", feature_description: "" },
          { feature_name: "Data backup (Automatic cloud backup)", feature_description: "" },
          { feature_name: "Secure login with password", feature_description: "" },
          { feature_name: "Audit trail (who edited what and when)", feature_description: "" },
        ],
      },
      {
        module_name: "F) Additional Requirements",
        module_description: "Cloud, GST, barcode, interface.",
        features: [
          { feature_name: "Cloud-based (accessible from mobile & desktop)", feature_description: "" },
          { feature_name: "GST compatible", feature_description: "" },
          { feature_name: "Barcode integration (future scope)", feature_description: "" },
          { feature_name: "Easy to use interface", feature_description: "" },
          { feature_name: "Data import from Excel", feature_description: "" },
          { feature_name: "Low maintenance", feature_description: "" },
        ],
      },
    ]);
    setCosts([
      { service_name: "Application Development Cost", cost_amount: "200000", cost_type: "Fixed", remarks: "" },
      { service_name: "Domain Name Purchase", cost_amount: "", cost_type: "At actuals", remarks: "" },
      { service_name: "Server Hosting & Maintenance", cost_amount: "10000", cost_type: "Annual", remarks: "Annual Cost" },
    ]);
    setTerms([
      { term_text: "Provided quotation is valid for 1 month only." },
      { term_text: "Provided Quotation is for scope mentioned above and any additional scope will be reviewed separately." },
      { term_text: "This quotation comes with 3 months warranty for bug fixes on given scope." },
      { term_text: "50% advance payment required to start the work" },
      { term_text: "Remaining 50% payment to be made before application deployment." },
      { term_text: "Above charges are not inclusive of GST (18%)" },
    ]);
    setTotalAmount("210000");
    setGstPercentage("18");
    setAmountInWords("Two Lacs and Ten thousands only");
    setSignatoryName("Amol Paritkar");
    setSignatoryEmail("amolp@bettercode.co.in");
    setSignatoryPhone("9823087861");
    setDesignation("");
    setBenefits([
      { benefit_text: "Accurate stock control" },
      { benefit_text: "Reduce manual errors" },
      { benefit_text: "Avoid stock shortages" },
      { benefit_text: "Better production planning" },
      { benefit_text: "Real-time visibility to management" },
    ]);
    toast({
      title: "Auto fill applied",
      description: "Form filled with sample data for testing.",
    });
  };

  const inputClass =
    "bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 focus:border-orange-500 focus:ring-orange-500/20";
  const labelClass = "text-neutral-300";

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

      <main className="p-4 sm:p-6 max-w-4xl mx-auto pb-12">
        <div className="mb-6 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              New Quotation
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
            className="w-fit border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Auto fill (testing)
          </Button>
        </div>

        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Section 1: Basic Details */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">
                Section 1 – Basic Details
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>Quotation number</Label>
                  <Input
                    value={quotationNumber}
                    onChange={(e) => setQuotationNumber(e.target.value)}
                    placeholder="e.g. QTN 2026 001"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>Quotation date</Label>
                  <Input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Valid till date</Label>
                  <Input
                    type="date"
                    value={validTillDate}
                    onChange={(e) => setValidTillDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Client Details */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">
                Section 2 – Client Details
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Client company name</Label>
                <Input
                  value={clientCompanyName}
                  onChange={(e) => setClientCompanyName(e.target.value)}
                  placeholder="e.g. RG Spectra Diamond Tools Pvt Ltd"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Client address</Label>
                <Textarea
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Full address"
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>Contact person</Label>
                  <Input
                    value={clientContactPerson}
                    onChange={(e) => setClientContactPerson(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Client email</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>Client phone</Label>
                  <Input
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Industry</Label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Manufacturing"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bhosari Pune"
                  className={inputClass}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: From Company */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">
                Section 3 – From Company
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Company name</Label>
                <Input
                  value={fromCompanyName}
                  onChange={(e) => setFromCompanyName(e.target.value)}
                  placeholder="e.g. Bettercode Technologies Pvt Ltd"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Company address</Label>
                <Textarea
                  value={fromCompanyAddress}
                  onChange={(e) => setFromCompanyAddress(e.target.value)}
                  placeholder={ZICA_CENTRE_ADDRESS_SINGLE_LINE}
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Company website</Label>
                <Input
                  value={fromCompanyWebsite}
                  onChange={(e) => setFromCompanyWebsite(e.target.value)}
                  placeholder="e.g. www.bettercode.co.in"
                  className={inputClass}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Project Details */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">
                Section 4 – Project Details
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Project title</Label>
                <Input
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g. Cloud Based Inventory Management Software"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Project overview</Label>
                <Textarea
                  value={projectOverview}
                  onChange={(e) => setProjectOverview(e.target.value)}
                  placeholder="Detailed description"
                  className={inputClass}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Main objective</Label>
                <Textarea
                  value={mainObjective}
                  onChange={(e) => setMainObjective(e.target.value)}
                  className={inputClass}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Scope of Work */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Section 5 – Scope of Work
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addScope}
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4 mr-1" /> Add scope
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {scopes.map((scope, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-neutral-700 p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-400">Scope {i + 1}</span>
                    {scopes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeScope(i)}
                        className="text-red-400 hover:text-red-300 hover:bg-neutral-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Scope title</Label>
                    <Input
                      value={scope.scope_title}
                      onChange={(e) =>
                        updateScope(i, "scope_title", e.target.value)
                      }
                      placeholder="e.g. Required Features, Inventory Control"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Scope description</Label>
                    <Textarea
                      value={scope.scope_description}
                      onChange={(e) =>
                        updateScope(i, "scope_description", e.target.value)
                      }
                      className={inputClass}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 6: Modules & Features */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Section 6 – Modules & Features
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addModule}
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4 mr-1" /> Add module
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {modules.map((mod, mi) => (
                <div
                  key={mi}
                  className="rounded-lg border border-neutral-700 p-4 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-400">
                      Module {mi + 1}
                    </span>
                    {modules.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModule(mi)}
                        className="text-red-400 hover:text-red-300 hover:bg-neutral-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Module name</Label>
                    <Input
                      value={mod.module_name}
                      onChange={(e) =>
                        updateModule(mi, "module_name", e.target.value)
                      }
                      placeholder="e.g. Stock Inward Module"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Module description</Label>
                    <Textarea
                      value={mod.module_description}
                      onChange={(e) =>
                        updateModule(mi, "module_description", e.target.value)
                      }
                      className={inputClass}
                      rows={2}
                    />
                  </div>
                  <div className="pl-2 border-l-2 border-neutral-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className={labelClass}>Features</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addFeature(mi)}
                        className="text-orange-400 hover:text-orange-300 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add feature
                      </Button>
                    </div>
                    {mod.features.map((feat, fi) => (
                      <div key={fi} className="flex gap-2 items-start">
                        <Input
                          value={feat.feature_name}
                          onChange={(e) =>
                            updateFeature(
                              mi,
                              fi,
                              "feature_name",
                              e.target.value
                            )
                          }
                          placeholder="Feature name"
                          className={`${inputClass} flex-1`}
                        />
                        <Input
                          value={feat.feature_description}
                          onChange={(e) =>
                            updateFeature(
                              mi,
                              fi,
                              "feature_description",
                              e.target.value
                            )
                          }
                          placeholder="Description (optional)"
                          className={`${inputClass} flex-1`}
                        />
                        {mod.features.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFeature(mi, fi)}
                            className="text-red-400 hover:text-red-300 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 7: Cost Breakdown */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Section 7 – Cost Breakdown
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCost}
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4 mr-1" /> Add row
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {costs.map((cost, i) => (
                <div
                  key={i}
                  className="grid gap-3 sm:grid-cols-12 items-end rounded-lg border border-neutral-700 p-3"
                >
                  <div className="sm:col-span-4 space-y-1">
                    <Label className={labelClass}>Service name</Label>
                    <Input
                      value={cost.service_name}
                      onChange={(e) =>
                        updateCost(i, "service_name", e.target.value)
                      }
                      placeholder="e.g. Application Development"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className={labelClass}>Amount</Label>
                    <Input
                      type="number"
                      value={cost.cost_amount}
                      onChange={(e) =>
                        updateCost(i, "cost_amount", e.target.value)
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className={labelClass}>Type</Label>
                    <Select
                      value={cost.cost_type}
                      onValueChange={(v) => updateCost(i, "cost_type", v)}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className={labelClass}>Remarks</Label>
                    <Input
                      value={cost.remarks}
                      onChange={(e) =>
                        updateCost(i, "remarks", e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    {costs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCost(i)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 8: Terms and Conditions */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Section 8 – Terms and Conditions
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTerm}
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4 mr-1" /> Add term
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {terms.map((term, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-neutral-500 mt-2.5 shrink-0 w-6">
                    {i + 1}.
                  </span>
                  <Textarea
                    value={term.term_text}
                    onChange={(e) => updateTerm(i, e.target.value)}
                    placeholder="Enter term text"
                    className={`${inputClass} flex-1`}
                    rows={2}
                  />
                  {terms.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTerm(i)}
                      className="text-red-400 hover:text-red-300 shrink-0 mt-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 9: Totals & Signatory */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">
                Section 9 – Final Review
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>Total amount (excl. GST)</Label>
                  <Input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>GST %</Label>
                  <Input
                    type="number"
                    value={gstPercentage}
                    onChange={(e) => setGstPercentage(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className={labelClass}>GST amount</Label>
                  <p className="text-white font-medium">{gstAmount}</p>
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>Grand total</Label>
                  <p className="text-white font-medium">{grandTotal}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Amount in words</Label>
                <Input
                  value={amountInWords}
                  onChange={(e) => setAmountInWords(e.target.value)}
                  placeholder="e.g. Two Lakh Rupees Only"
                  className={inputClass}
                />
              </div>
              <div className="pt-2 border-t border-neutral-700 space-y-4">
                <Label className={labelClass}>Signatory details</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className={labelClass}>Name</Label>
                    <Input
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      placeholder="e.g. Amol Paritkar"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Email</Label>
                    <Input
                      type="email"
                      value={signatoryEmail}
                      onChange={(e) => setSignatoryEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className={labelClass}>Phone</Label>
                    <Input
                      value={signatoryPhone}
                      onChange={(e) => setSignatoryPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelClass}>Designation</Label>
                    <Input
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 10: Expected Benefits (optional) */}
          <Card className="bg-neutral-900 border-neutral-800 rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Section 10 – Expected Benefits (optional)
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBenefit}
                className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4 mr-1" /> Add benefit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={b.benefit_text}
                    onChange={(e) => updateBenefit(i, e.target.value)}
                    placeholder="e.g. Accurate stock control, Reduce manual errors"
                    className={`${inputClass} flex-1`}
                  />
                  {benefits.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBenefit(i)}
                      className="text-red-400 hover:text-red-300 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Generate Quotation button */}
          <div className="flex justify-end pt-4">
            <Button
              type="button"
              onClick={handleGenerateQuotation}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-6 text-base rounded-xl disabled:opacity-70"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate Quotation"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

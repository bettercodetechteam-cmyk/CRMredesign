import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Megaphone,
  Calendar,
  Clock,
  ArrowUpCircle,
  AlertCircle
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ProfessionalTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ResponsiveTableWrapper,
  MobileCardView
} from "@/components/ui/professional-table";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import PromotionalOfferService from "@/lib/promotionalOfferService";
import { PromotionalOffer } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PromotionalOffers() {
  const { toast } = useToast();
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  // Selected offer for edit/delete
  const [currentOffer, setCurrentOffer] = useState<PromotionalOffer | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    text: "",
    priority: 0,
    active: true,
    startDate: "",
    endDate: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await PromotionalOfferService.getAllOffers();
      setOffers(data);
    } catch (error) {
      console.error("Error loading offers:", error);
      toast({
        title: "Error",
        description: "Failed to load promotional offers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const filteredOffers = offers.filter(offer => 
    offer.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setFormData({
      text: "",
      priority: 0,
      active: true,
      startDate: "",
      endDate: ""
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (offer: PromotionalOffer) => {
    setCurrentOffer(offer);
    setFormData({
      text: offer.text,
      priority: offer.priority,
      active: offer.active,
      startDate: offer.startDate ? format(offer.startDate.toDate ? offer.startDate.toDate() : new Date(offer.startDate), "yyyy-MM-dd") : "",
      endDate: offer.endDate ? format(offer.endDate.toDate ? offer.endDate.toDate() : new Date(offer.endDate), "yyyy-MM-dd") : ""
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteAlert = (offer: PromotionalOffer) => {
    setCurrentOffer(offer);
    setIsDeleteAlertOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.text) {
      toast({
        title: "Validation Error",
        description: "Message text is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        text: formData.text,
        priority: Number(formData.priority),
        active: formData.active,
      };

      if (formData.startDate) payload.startDate = new Date(formData.startDate);
      if (formData.endDate) payload.endDate = new Date(formData.endDate);

      if (isAddModalOpen) {
        await PromotionalOfferService.createOffer(payload);
        toast({
          title: "Offer Created",
          description: "New promotional offer has been added successfully.",
        });
        setIsAddModalOpen(false);
      } else if (isEditModalOpen && currentOffer) {
        await PromotionalOfferService.updateOffer(currentOffer.id, payload);
        toast({
          title: "Offer Updated",
          description: "Promotional offer has been updated successfully.",
        });
        setIsEditModalOpen(false);
      }
      loadOffers();
    } catch (error) {
      console.error("Error saving offer:", error);
      toast({
        title: "Error",
        description: "Failed to save the promotional offer",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (offer: PromotionalOffer, active: boolean) => {
    try {
      await PromotionalOfferService.toggleOfferStatus(offer.id, active);
      setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, active } : o));
      toast({
        title: active ? "Offer Activated" : "Offer Deactivated",
        description: `Offer is now ${active ? 'visible' : 'hidden'} on the website.`,
      });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({
        title: "Error",
        description: "Failed to update offer status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!currentOffer) return;
    try {
      setSubmitting(true);
      await PromotionalOfferService.deleteOffer(currentOffer.id);
      toast({
        title: "Offer Deleted",
        description: "Promotional offer has been removed permanently.",
      });
      setIsDeleteAlertOpen(false);
      loadOffers();
    } catch (error) {
      console.error("Error deleting offer:", error);
      toast({
        title: "Error",
        description: "Failed to delete promotional offer",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateString = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "dd MMM yyyy");
  };

  const isOfferRunning = (offer: PromotionalOffer) => {
    if (!offer.active) return false;
    const now = new Date();
    if (offer.startDate) {
      const start = offer.startDate.toDate ? offer.startDate.toDate() : new Date(offer.startDate);
      if (now < start) return false;
    }
    if (offer.endDate) {
      const end = offer.endDate.toDate ? offer.endDate.toDate() : new Date(offer.endDate);
      if (now > end) return false;
    }
    return true;
  };

  if (loading && offers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" text="Loading promotional offers..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            Promotional Offers
          </h1>
          <p className="text-slate-500 font-medium">
            Manage the scrolling ticker offers on the main website portal
          </p>
        </div>
        
        <Button 
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-200/50 h-12 px-6 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Promotional Offer
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-soft bg-white group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors">
              <Megaphone className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Offers</p>
              <h3 className="text-2xl font-bold text-slate-900">{offers.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-soft bg-white group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-green-50 rounded-2xl group-hover:bg-green-100 transition-colors">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Currently Active</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {offers.filter(o => isOfferRunning(o)).length}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-soft bg-white group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors">
              <ArrowUpCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">High Priority</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {offers.filter(o => o.priority > 0).length}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card className="border-none shadow-soft bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search promotional messages..."
              className="pl-12 h-12 border-slate-100 bg-slate-50/50 focus:bg-white rounded-xl transition-all text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Offers Table */}
      <ResponsiveTableWrapper
        showMobileView={true}
        mobileView={
          <MobileCardView
            data={filteredOffers}
            renderCard={(offer) => (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-slate-900 leading-tight">{offer.text}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="bg-slate-50">Priority: {offer.priority}</Badge>
                      {isOfferRunning(offer) ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">Running</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">Inactive/Expired</Badge>
                      )}
                    </div>
                  </div>
                  <Switch 
                    checked={offer.active} 
                    onCheckedChange={(checked) => handleToggleStatus(offer, checked)} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  <div className="text-xs text-slate-500">
                    <span className="block font-semibold">Start Date</span>
                    {formatDateString(offer.startDate)}
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="block font-semibold">End Date</span>
                    {formatDateString(offer.endDate)}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEditModal(offer)}>
                    <Edit2 className="w-3 h-3 mr-2" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={() => handleOpenDeleteAlert(offer)}>
                    <Trash2 className="w-3 h-3 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            )}
          />
        }
      >
        <ProfessionalTable>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Promotional Message</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOffers.map((offer) => {
              const running = isOfferRunning(offer);
              return (
                <TableRow key={offer.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{offer.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Created: {formatDateString(offer.createdAt)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        offer.priority > 5 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"
                      )}>
                        {offer.priority}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDateString(offer.startDate)} - {formatDateString(offer.endDate)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Switch 
                          checked={offer.active} 
                          onCheckedChange={(checked) => handleToggleStatus(offer, checked)} 
                        />
                        <span className={cn("text-xs font-bold uppercase tracking-wider", offer.active ? "text-green-600" : "text-slate-400")}>
                          {offer.active ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      {offer.active && !running && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                          <AlertCircle className="w-3 h-3" />
                          {new Date() < (offer.startDate?.toDate ? offer.startDate.toDate() : new Date(offer.startDate)) ? "Scheduled" : "Expired"}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl border-slate-100">
                        <DropdownMenuItem onClick={() => handleOpenEditModal(offer)} className="gap-2 cursor-pointer py-2">
                          <Edit2 className="w-4 h-4 text-blue-600" /> Edit Offer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenDeleteAlert(offer)} className="gap-2 cursor-pointer py-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                          <Trash2 className="w-4 h-4" /> Delete Offer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ProfessionalTable>
      </ResponsiveTableWrapper>

      {filteredOffers.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-100">
          <div className="p-6 bg-slate-50 rounded-full mb-4">
            <Megaphone className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No promotional offers found</h3>
          <p className="text-slate-500 mt-2">Start by creating your first promotional message for the website.</p>
          <Button onClick={handleOpenAddModal} className="mt-6 bg-blue-600 hover:bg-blue-700 px-8 rounded-xl">
            Create Offer
          </Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl overflow-hidden p-0">
          <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <form onSubmit={handleSubmit}>
            <DialogHeader className="px-8 pt-8 pb-4">
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {isAddModalOpen ? "New Promotional Offer" : "Edit Promotional Offer"}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Configure the message and display rules for the website ticker.
              </DialogDescription>
            </DialogHeader>
            
            <div className="px-8 py-4 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Promotional Message</label>
                <textarea
                  required
                  placeholder="e.g., Flat 20% Off on all VFX Courses! Limited time offer."
                  className="w-full min-h-[100px] px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none resize-none"
                  value={formData.text}
                  onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Priority (0-100)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="h-12 rounded-xl border-slate-200"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Initial Status</label>
                  <div className="h-12 flex items-center gap-3 bg-slate-50 px-4 rounded-xl border border-slate-100">
                    <Switch
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                    />
                    <span className="text-sm font-semibold text-slate-600">Active</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Start Date (Optional)</label>
                  <Input
                    type="date"
                    className="h-12 rounded-xl border-slate-200"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">End Date (Optional)</label>
                  <Input
                    type="date"
                    className="h-12 rounded-xl border-slate-200"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-8 py-6 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="h-12 px-6 rounded-xl border-slate-200 hover:bg-white"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                disabled={submitting}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  isAddModalOpen ? "Create Offer" : "Update Offer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="rounded-3xl border-none p-8">
          <AlertDialogHeader>
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">Delete Offer Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-500">
              Are you sure you want to delete this promotional offer? This action cannot be undone and it will be immediately removed from the website rotation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="h-12 px-6 rounded-xl border-slate-200">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={submitting}
              className="h-12 px-8 rounded-xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              {submitting ? "Deleting..." : "Yes, Delete Offer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

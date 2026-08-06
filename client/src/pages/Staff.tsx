import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import Loading from "@/components/ui/loading";
import StaffDirectoryService, {
  StaffDirectoryMember,
  StaffDirectoryInput,
  getFullName,
  formatDate,
  getYearsSince,
  daysUntilNextOccurrence,
  isThisMonth,
} from "@/lib/staffDirectoryService";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Cake,
  Award,
  Pencil,
  Trash2,
  UserCog,
  PartyPopper,
} from "lucide-react";

const DESIGNATIONS = [
  "Director",
  "Centre Head",
  "Faculty",
  "BDM",
  "Marketing Executive",
  "Accountant",
  "Receptionist",
  "Designer",
  "Employee",
  "Other",
];

const PREDEFINED_DESIGNATIONS = DESIGNATIONS.filter((d) => d !== "Other");

function resolveSelectValue(value: string, predefined: string[]) {
  if (!value) return "";
  if (predefined.includes(value)) return value;
  return "Other";
}

function getCustomValue(value: string, predefined: string[]) {
  if (!value || predefined.includes(value)) return "";
  return value;
}

const EMPTY_FORM: StaffDirectoryInput = {
  centreId: "",
  firstName: "",
  lastName: "",
  employeeId: "",
  designation: "",
  email: "",
  phone: "",
  address: "",
  dateOfBirth: undefined,
  joiningDate: undefined,
  emergencyContactName: "",
  emergencyContactPhone: "",
  gender: "",
  status: "active",
  notes: "",
};

function toDateInputValue(date?: Date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function memberToForm(member: StaffDirectoryMember, centreId: string): StaffDirectoryInput {
  return {
    centreId: member.centreId || centreId,
    firstName: member.firstName,
    lastName: member.lastName,
    employeeId: member.employeeId || "",
    designation: member.designation,
    email: member.email || "",
    phone: member.phone || "",
    address: member.address || "",
    dateOfBirth: member.dateOfBirth,
    joiningDate: member.joiningDate,
    emergencyContactName: member.emergencyContactName || "",
    emergencyContactPhone: member.emergencyContactPhone || "",
    gender: member.gender || "",
    status: member.status,
    notes: member.notes || "",
  };
}

export default function Staff() {
  const { userProfile } = useAuth();
  const { canAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const centreId = userProfile?.centreId?.trim() || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffDirectoryMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffDirectoryMember | null>(null);
  const [form, setForm] = useState<StaffDirectoryInput>({ ...EMPTY_FORM, centreId });
  const [designationSelect, setDesignationSelect] = useState("");
  const [otherDesignation, setOtherDesignation] = useState("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staffDirectory", centreId],
    queryFn: () => StaffDirectoryService.getByCentre(centreId),
    enabled: !!centreId && canAccess('staff'),
  });

  const createMutation = useMutation({
    mutationFn: (data: StaffDirectoryInput) => StaffDirectoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffDirectory", centreId] });
      setDialogOpen(false);
      toast({ title: "Staff added", description: "Employee record created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add staff member.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffDirectoryInput> }) =>
      StaffDirectoryService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffDirectory", centreId] });
      setDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Updated", description: "Staff record updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff member.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => StaffDirectoryService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staffDirectory", centreId] });
      setDeleteTarget(null);
      toast({ title: "Removed", description: "Staff member deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete staff member.", variant: "destructive" });
    },
  });

  if (!canAccess('staff')) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!centreId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-slate-500">No centre assigned. Staff management is unavailable.</p>
      </div>
    );
  }

  const openAddDialog = () => {
    setEditingMember(null);
    setForm({ ...EMPTY_FORM, centreId });
    setDesignationSelect("");
    setOtherDesignation("");
    setDialogOpen(true);
  };

  const openEditDialog = (member: StaffDirectoryMember) => {
    setEditingMember(member);
    setForm(memberToForm(member, centreId));
    setDesignationSelect(resolveSelectValue(member.designation, PREDEFINED_DESIGNATIONS));
    setOtherDesignation(getCustomValue(member.designation, PREDEFINED_DESIGNATIONS));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const designation =
      designationSelect === "Other" ? otherDesignation.trim() : designationSelect.trim();

    if (!form.firstName.trim() || !form.lastName.trim() || !designation) {
      toast({
        title: "Required fields",
        description:
          designationSelect === "Other" && !otherDesignation.trim()
            ? "Please enter a custom designation for Other."
            : "First name, last name, and designation are required.",
        variant: "destructive",
      });
      return;
    }
    const payload: StaffDirectoryInput = {
      ...form,
      centreId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      designation,
      status: editingMember?.status ?? "active",
    };
    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      getFullName(member).toLowerCase().includes(term) ||
      member.designation.toLowerCase().includes(term) ||
      member.email?.toLowerCase().includes(term) ||
      member.phone?.includes(term) ||
      member.employeeId?.toLowerCase().includes(term);
    return matchesSearch;
  });

  const birthdaysThisMonth = staff.filter((s) => isThisMonth(s.dateOfBirth)).length;
  const anniversariesThisMonth = staff.filter((s) => isThisMonth(s.joiningDate)).length;

  const upcomingEvents = staff
    .flatMap((member) => {
      const events: Array<{
        member: StaffDirectoryMember;
        type: "birthday" | "anniversary";
        daysUntil: number;
        years?: number;
      }> = [];
      const bDays = daysUntilNextOccurrence(member.dateOfBirth);
      if (bDays !== null && bDays <= 30) {
        events.push({ member, type: "birthday", daysUntil: bDays });
      }
      const aDays = daysUntilNextOccurrence(member.joiningDate);
      if (aDays !== null && aDays <= 30 && member.joiningDate) {
        const years = getYearsSince(member.joiningDate) + (aDays === 0 ? 0 : 1);
        events.push({ member, type: "anniversary", daysUntil: aDays, years });
      }
      return events;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 8);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <Loading size="md" color="primary" text="Loading staff..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-sm shrink-0">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Staff Management</h1>
            <p className="text-sm text-slate-500 truncate">
              {staff.length} employees · birthdays &amp; anniversaries
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search staff..."
              className="pl-9 h-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={openAddDialog} className="h-9 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Staff</p>
              <p className="text-lg font-bold text-slate-900">{staff.length}</p>
            </div>
            <Users className="w-5 h-5 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Birthdays</p>
              <p className="text-lg font-bold text-slate-900">{birthdaysThisMonth}</p>
            </div>
            <Cake className="w-5 h-5 text-pink-400" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Anniversaries</p>
              <p className="text-lg font-bold text-slate-900">{anniversariesThisMonth}</p>
            </div>
            <Award className="w-5 h-5 text-amber-400" />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 flex items-center gap-1 shrink-0">
            <PartyPopper className="w-4 h-4" />
            Upcoming:
          </span>
          {upcomingEvents.map((event, idx) => (
            <Badge
              key={`${event.member.id}-${event.type}-${idx}`}
              variant="outline"
              className="text-xs font-normal"
            >
              {event.type === "birthday" ? (
                <Cake className="w-3 h-3 mr-1" />
              ) : (
                <Award className="w-3 h-3 mr-1" />
              )}
              {getFullName(event.member)}
              {event.type === "anniversary" && event.years ? ` (${event.years}y)` : ""}
              {" · "}
              {event.daysUntil === 0
                ? "Today"
                : event.daysUntil === 1
                  ? "Tomorrow"
                  : `${event.daysUntil}d`}
            </Badge>
          ))}
        </div>
      )}

      {/* Staff table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {filteredStaff.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Birthday</TableHead>
                    <TableHead className="hidden sm:table-cell">Anniversary</TableHead>
                    <TableHead className="text-right w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((member) => {
                    const bDays = daysUntilNextOccurrence(member.dateOfBirth);
                    const aDays = daysUntilNextOccurrence(member.joiningDate);
                    const workYears = getYearsSince(member.joiningDate);

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="font-medium text-slate-800">{getFullName(member)}</div>
                          {member.employeeId && (
                            <div className="text-xs text-slate-400">{member.employeeId}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {member.designation}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm text-slate-600 space-y-0.5">
                            {member.email && (
                              <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{member.email}</span>
                              </div>
                            )}
                            {member.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                            {!member.email && !member.phone && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                            <span className="text-slate-700">{formatDate(member.dateOfBirth)}</span>
                            {bDays !== null && bDays <= 14 && (
                              <span className="block text-xs text-pink-600">
                                {bDays === 0 ? "Today" : `in ${bDays}d`}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm">
                            <span className="text-slate-700">{formatDate(member.joiningDate)}</span>
                            {member.joiningDate && (
                              <span className="block text-xs text-amber-600">
                                {workYears}y
                                {aDays !== null && aDays <= 14
                                  ? aDays === 0
                                    ? " · Today"
                                    : ` · ${aDays}d`
                                  : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openEditDialog(member)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteTarget(member)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 px-4 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-800">
                {staff.length === 0 ? "No staff added yet" : "No matching staff"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {staff.length === 0
                  ? "Add employees with birthday and joining date."
                  : "Try a different search term."}
              </p>
              {staff.length === 0 && (
                <Button onClick={openAddDialog} size="sm" className="mt-3">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Employee
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription className="text-sm">
              Birthday and joining date are used for anniversary reminders.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  placeholder="e.g. EMP-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Designation *</Label>
                <Select
                  value={designationSelect}
                  onValueChange={(v) => {
                    setDesignationSelect(v);
                    if (v !== "Other") setOtherDesignation("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESIGNATIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {designationSelect === "Other" && (
                  <Input
                    id="otherDesignation"
                    value={otherDesignation}
                    onChange={(e) => setOtherDesignation(e.target.value)}
                    placeholder="Enter designation"
                    required
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={toDateInputValue(form.dateOfBirth)}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: parseDateInput(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="joiningDate">Joining Date (Anniversary)</Label>
                <Input
                  id="joiningDate"
                  type="date"
                  value={toDateInputValue(form.joiningDate)}
                  onChange={(e) =>
                    setForm({ ...form, joiningDate: parseDateInput(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={form.gender || ""}
                  onValueChange={(v) => setForm({ ...form, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional information..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editingMember ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget ? getFullName(deleteTarget) : ""}</strong> from the staff
              directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

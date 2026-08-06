import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Loading from "@/components/ui/loading";
import { Target, Calendar, TrendingUp, Plus, Edit, Trash2, Download, User } from "lucide-react";

interface TargetData {
  id: number;
  startDate: string;
  endDate: string;
  targetType: string;
  targetValue: string;
  achievedValue: string;
  period: string;
  assignedTo: string;
  status: string;
  centreId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TargetFormData {
  startDate: string;
  endDate: string;
  targetType: string;
  targetValue: string;
  achievedValue: string;
  period: string;
  assignedTo: string;
  status: string;
}

export default function Targets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: targets = [], isLoading } = useQuery<TargetData[]>({
    queryKey: ['/api/targets'],
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<TargetFormData>();

  const createMutation = useMutation({
    mutationFn: (data: TargetFormData) => apiRequest("POST", "/api/targets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/targets'] });
      setIsDialogOpen(false);
      reset();
      toast({ title: "Success", description: "Target created successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create target", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TargetFormData }) => 
      apiRequest("PUT", `/api/targets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/targets'] });
      setIsDialogOpen(false);
      setEditingTarget(null);
      reset();
      toast({ title: "Success", description: "Target updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update target", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/targets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/targets'] });
      toast({ title: "Success", description: "Target deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete target", variant: "destructive" });
    }
  });

  const handleCreateOrUpdate = (data: TargetFormData) => {
    if (editingTarget) {
      updateMutation.mutate({ id: editingTarget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (target: TargetData) => {
    setEditingTarget(target);
    setValue("startDate", target.startDate);
    setValue("endDate", target.endDate);
    setValue("targetType", target.targetType);
    setValue("targetValue", target.targetValue);
    setValue("achievedValue", target.achievedValue || "0");
    setValue("period", target.period);
    setValue("assignedTo", target.assignedTo);
    setValue("status", target.status || "active");
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this target?")) {
      deleteMutation.mutate(id);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Target Type", "Target Value", "Achieved Value", "Period", "Assigned To", "Start Date", "End Date", "Status", "Progress %"],
      ...targets.map((target: TargetData) => [
        target.targetType,
        target.targetValue,
        target.achievedValue || "0",
        target.period,
        target.assignedTo,
        target.startDate,
        target.endDate,
        target.status || "active",
        Math.round(((parseFloat(target.achievedValue || "0") / parseFloat(target.targetValue)) * 100))
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "targets.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Targets exported successfully!" });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = (achieved: string, target: string) => {
    const achievedVal = parseFloat(achieved || "0");
    const targetVal = parseFloat(target || "1");
    return Math.min(Math.round((achievedVal / targetVal) * 100), 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <Loading size="md" color="primary" text="Loading targets..." />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Target Management</h1>
          <p className="text-sm sm:text-base text-gray-600">Set and track performance targets</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTarget(null); reset(); }} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Set Target
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTarget ? "Edit Target" : "Set New Target"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetType">Target Type</Label>
                    <Select onValueChange={(value) => setValue("targetType", value)} value={watch("targetType")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enrollment">Student Enrollment</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="completion">Course Completion</SelectItem>
                        <SelectItem value="retention">Student Retention</SelectItem>
                        <SelectItem value="satisfaction">Satisfaction Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period">Period</Label>
                    <Select onValueChange={(value) => setValue("period", value)} value={watch("period")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetValue">Target Value</Label>
                    <Input 
                      id="targetValue" 
                      {...register("targetValue", { required: true })} 
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="achievedValue">Achieved Value</Label>
                    <Input 
                      id="achievedValue" 
                      {...register("achievedValue")} 
                      placeholder="e.g., 75"
                      defaultValue="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      type="date" 
                      {...register("startDate", { required: true })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input 
                      id="endDate" 
                      type="date" 
                      {...register("endDate", { required: true })} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input 
                      id="assignedTo" 
                      {...register("assignedTo", { required: true })} 
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setValue("status", value)} value={watch("status")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {editingTarget ? "Update Target" : "Set Target"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setIsDialogOpen(false); setEditingTarget(null); reset(); }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {targets.map((target: TargetData) => {
          const progressPercentage = getProgressPercentage(target.achievedValue, target.targetValue);
          return (
            <Card key={target.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg truncate">{target.targetType}</CardTitle>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{target.period}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(target.status)} text-xs flex-shrink-0 ml-2`}>
                    {target.status || 'active'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{progressPercentage}%</span>
                  </div>
                  <Progress 
                    value={progressPercentage} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{target.achievedValue || 0}</span>
                    <span>{target.targetValue}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-600 truncate">{target.assignedTo}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600 truncate">Start: {target.startDate}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-gray-600 truncate">End: {target.endDate}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleEdit(target)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(target.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {targets.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No targets found</h3>
          <p className="text-gray-600 mb-4">Get started by setting your first target.</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Set First Target
          </Button>
        </div>
      )}
    </div>
  );
}
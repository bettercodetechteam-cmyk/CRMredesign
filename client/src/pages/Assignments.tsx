 import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Loading from "@/components/ui/loading";
import { FileText, Calendar, Clock, Plus, Edit, Trash2, Download, Users } from "lucide-react";

interface Assignment {
  id: number;
  batchId: number;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number;
  createdBy: string;
  createdAt: Date;
}

interface AssignmentFormData {
  batchId: number;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number;
  createdBy: string;
}

interface Batch {
  id: number;
  name: string;
}

export default function Assignments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ['/api/batches'],
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<AssignmentFormData>();

  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) => apiRequest("POST", "/api/assignments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      setIsDialogOpen(false);
      reset();
      toast({ title: "Success", description: "Assignment created successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create assignment", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssignmentFormData }) => 
      apiRequest("PUT", `/api/assignments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      setIsDialogOpen(false);
      setEditingAssignment(null);
      reset();
      toast({ title: "Success", description: "Assignment updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update assignment", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({ title: "Success", description: "Assignment deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete assignment", variant: "destructive" });
    }
  });

  const handleCreateOrUpdate = (data: AssignmentFormData) => {
    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setValue("batchId", assignment.batchId);
    setValue("title", assignment.title);
    setValue("description", assignment.description);
    setValue("dueDate", assignment.dueDate);
    setValue("totalMarks", assignment.totalMarks);
    setValue("createdBy", assignment.createdBy);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      deleteMutation.mutate(id);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Title", "Batch ID", "Description", "Due Date", "Total Marks", "Created By"],
      ...assignments.map((assignment: Assignment) => [
        assignment.title,
        assignment.batchId,
        assignment.description,
        assignment.dueDate,
        assignment.totalMarks,
        assignment.createdBy
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assignments.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Assignments exported successfully!" });
  };

  const getBatchName = (batchId: number) => {
    const batch = batches.find((b: Batch) => b.id === batchId);
    return batch ? batch.name : `Batch ${batchId}`;
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <Loading
        size="lg"
        text="Loading assignments..."
        color="primary"
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Assignment Management</h1>
          <p className="text-sm sm:text-base text-gray-600">Create and manage student assignments</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingAssignment(null); reset(); }} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAssignment ? "Edit Assignment" : "Create New Assignment"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Assignment Title</Label>
                  <Input 
                    id="title" 
                    {...register("title", { required: true })} 
                    placeholder="e.g., Character Animation Project"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    {...register("description", { required: true })} 
                    placeholder="Assignment description and requirements"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batchId">Batch</Label>
                    <Select onValueChange={(value) => setValue("batchId", parseInt(value))} value={watch("batchId")?.toString()}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch: Batch) => (
                          <SelectItem key={batch.id} value={batch.id.toString()}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalMarks">Total Marks</Label>
                    <Input 
                      id="totalMarks" 
                      type="number" 
                      {...register("totalMarks", { required: true, valueAsNumber: true })} 
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input 
                      id="dueDate" 
                      type="date" 
                      {...register("dueDate", { required: true })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="createdBy">Created By</Label>
                    <Input 
                      id="createdBy" 
                      {...register("createdBy", { required: true })} 
                      placeholder="e.g., John Doe"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {editingAssignment ? "Update Assignment" : "Create Assignment"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setIsDialogOpen(false); setEditingAssignment(null); reset(); }}
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
        {assignments.map((assignment: Assignment) => {
          const daysUntilDue = getDaysUntilDue(assignment.dueDate);
          const overdue = isOverdue(assignment.dueDate);
          
          return (
            <Card key={assignment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base sm:text-lg truncate">{assignment.title}</CardTitle>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{getBatchName(assignment.batchId)}</p>
                    </div>
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ml-2 ${
                    overdue 
                      ? 'bg-red-100 text-red-800' 
                      : daysUntilDue <= 3 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                  }`}>
                    {overdue ? 'Overdue' : daysUntilDue <= 0 ? 'Due Today' : `${daysUntilDue} days`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 line-clamp-2">{assignment.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600 truncate">{assignment.dueDate}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600 truncate">{assignment.totalMarks} marks</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 truncate">Created by: {assignment.createdBy}</p>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleEdit(assignment)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(assignment.id)}
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

      {assignments.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first assignment.</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Assignment
          </Button>
        </div>
      )}
    </div>
  );
}
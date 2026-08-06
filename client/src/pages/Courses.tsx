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
import { BookOpen, Clock, Users, Plus, Edit, Trash2, Download, DollarSign } from "lucide-react";

interface Course {
  id: number;
  name: string;
  description: string;
  duration: string;
  category: string;
  level: string;
  fee: string;
  maxStudents: number;
  instructor: string;
  status: string;
  centreId: string;
}

interface CourseFormData {
  name: string;
  description: string;
  duration: string;
  category: string;
  level: string;
  fee: string;
  maxStudents: number;
  instructor: string;
  status: string;
}

export default function Courses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['/api/courses'],
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<CourseFormData>();

  const createMutation = useMutation({
    mutationFn: (data: CourseFormData) => apiRequest("POST", "/api/courses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setIsDialogOpen(false);
      reset();
      toast({ title: "Success", description: "Course created successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create course", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CourseFormData }) => 
      apiRequest("PUT", `/api/courses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setIsDialogOpen(false);
      setEditingCourse(null);
      reset();
      toast({ title: "Success", description: "Course updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update course", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({ title: "Success", description: "Course deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete course", variant: "destructive" });
    }
  });

  const handleCreateOrUpdate = (data: CourseFormData) => {
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setValue("name", course.name);
    setValue("description", course.description);
    setValue("duration", course.duration);
    setValue("category", course.category);
    setValue("level", course.level);
    setValue("fee", course.fee);
    setValue("maxStudents", course.maxStudents);
    setValue("instructor", course.instructor);
    setValue("status", course.status);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this course?")) {
      deleteMutation.mutate(id);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Name", "Category", "Level", "Duration", "Fee", "Max Students", "Instructor", "Status"],
      ...courses.map((course: Course) => [
        course.name,
        course.category,
        course.level,
        course.duration,
        course.fee,
        course.maxStudents,
        course.instructor,
        course.status
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "courses.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Courses exported successfully!" });
  };

  const getCategoryColor = (category: string) => {
    if (!category) return 'bg-gray-100 text-gray-800';
    switch (category.toLowerCase()) {
      case 'animation': return 'bg-blue-100 text-blue-800';
      case 'vfx': return 'bg-purple-100 text-purple-800';
      case 'gaming': return 'bg-green-100 text-green-800';
      case 'design': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelColor = (level: string) => {
    if (!level) return 'bg-gray-100 text-gray-800';
    switch (level.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <Loading fullScreen={true} text="Loading courses..." color="primary" />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage course catalog and curriculum</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingCourse(null); reset(); }} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Edit Course" : "Create New Course"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Course Name</Label>
                    <Input 
                      id="name" 
                      {...register("name", { required: true })} 
                      placeholder="e.g., 2D Animation Fundamentals"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select onValueChange={(value) => setValue("category", value)} value={watch("category")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="animation">Animation</SelectItem>
                        <SelectItem value="vfx">VFX</SelectItem>
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    {...register("description", { required: true })} 
                    placeholder="Course description and objectives"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Select onValueChange={(value) => setValue("level", value)} value={watch("level")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input 
                      id="duration" 
                      {...register("duration", { required: true })} 
                      placeholder="e.g., 6 months"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee">Fee</Label>
                    <Input 
                      id="fee" 
                      {...register("fee", { required: true })} 
                      placeholder="e.g., ₹50,000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Max Students</Label>
                    <Input 
                      id="maxStudents" 
                      type="number" 
                      {...register("maxStudents", { required: true, valueAsNumber: true })} 
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instructor">Primary Instructor</Label>
                    <Input 
                      id="instructor" 
                      {...register("instructor", { required: true })} 
                      placeholder="e.g., John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select onValueChange={(value) => setValue("status", value)} value={watch("status")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {editingCourse ? "Update Course" : "Create Course"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setIsDialogOpen(false); setEditingCourse(null); reset(); }}
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
        {courses.map((course: Course) => (
          <Card key={course.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base sm:text-lg truncate">{course.name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge className={`${getCategoryColor(course.category)} text-xs`}>
                        {course.category}
                      </Badge>
                      <Badge className={`${getLevelColor(course.level)} text-xs`}>
                        {course.level}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 line-clamp-2">{course.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-600 truncate">{course.duration}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-600 truncate">{course.fee}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-sm">
                <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-600 truncate">Max {course.maxStudents} students</span>
              </div>
              
              <p className="text-sm text-gray-600 truncate">Instructor: {course.instructor}</p>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleEdit(course)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleDelete(course.id)}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first course.</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Course
          </Button>
        </div>
      )}
    </div>
  );
}
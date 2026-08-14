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
import Loading from "@/components/ui/loading";
import { BookOpen, Clock, Plus, Edit, Download, IndianRupee } from "lucide-react";
import { nestCoursesApi, type NestCourse } from "@/services/nest/coursesApi";

interface CourseFormData {
  name: string;
  code: string;
  rollPrefix: string;
  durationMonths: number;
  category: string;
  fees: number;
  description: string;
  isActive: string;
}

const CATEGORIES = ["Animation", "VFX", "Gaming", "Design", "Development"];

export default function Courses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<NestCourse | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["nest-courses"],
    queryFn: () => nestCoursesApi.list({ activeOnly: false, limit: 100 }),
  });
  const courses = data?.items ?? [];

  const { register, handleSubmit, reset, setValue, watch } = useForm<CourseFormData>({
    defaultValues: { durationMonths: 6, fees: 0, isActive: "true", category: "Animation" },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["nest-courses"] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => nestCoursesApi.create(payload),
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      reset();
      toast({ title: "Course created" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not create course", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      nestCoursesApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      setEditingCourse(null);
      reset();
      toast({ title: "Course updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update course", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateOrUpdate = (form: CourseFormData) => {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      rollPrefix: (form.rollPrefix || form.code).trim().toUpperCase(),
      durationMonths: Number(form.durationMonths),
      category: form.category,
      fees: Number(form.fees),
      description: form.description?.trim() || undefined,
      ...(editingCourse ? { isActive: form.isActive === "true" } : {}),
    };
    if (editingCourse) {
      const { code: _code, ...updatePayload } = payload;
      updateMutation.mutate({ id: editingCourse.id, payload: updatePayload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (course: NestCourse) => {
    setEditingCourse(course);
    setValue("name", course.name);
    setValue("code", course.code);
    setValue("rollPrefix", course.rollPrefix);
    setValue("durationMonths", course.durationMonths);
    setValue("category", course.category || "Animation");
    setValue("fees", Number(course.fees ?? 0));
    setValue("description", "");
    setValue("isActive", course.isActive ? "true" : "false");
    setIsDialogOpen(true);
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Name", "Code", "Roll prefix", "Duration (months)", "Fee", "Category", "Active"],
      ...courses.map((course) => [
        course.name,
        course.code,
        course.rollPrefix,
        course.durationMonths,
        course.fees ?? "",
        course.category ?? "",
        course.isActive ? "yes" : "no",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "courses.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading courses..." color="primary" />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-600">Catalogue used for roll numbers, batches and admissions</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingCourse(null);
                  reset({ durationMonths: 6, fees: 0, isActive: "true", category: "Animation", name: "", code: "", rollPrefix: "", description: "" });
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create course
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Edit course" : "Create course"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input {...register("name", { required: true })} placeholder="Graphic Design" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input {...register("code", { required: true })} placeholder="GD" disabled={!!editingCourse} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Roll prefix</Label>
                    <Input {...register("rollPrefix", { required: true })} placeholder="GD" />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (months)</Label>
                    <Input type="number" min={1} {...register("durationMonths", { required: true, valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fee (INR)</Label>
                    <Input type="number" min={0} {...register("fees", { required: true, valueAsNumber: true })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select onValueChange={(value) => setValue("category", value)} value={watch("category")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea {...register("description")} rows={3} />
                </div>
                {editingCourse && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select onValueChange={(value) => setValue("isActive", value)} value={watch("isActive")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingCourse ? "Save" : "Create"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <Card key={course.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">{course.name}</CardTitle>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary">{course.code}</Badge>
                    <Badge className={course.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}>
                      {course.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {course.durationMonths} months · prefix {course.rollPrefix}
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                {Number(course.fees ?? 0).toLocaleString("en-IN")}
              </div>
              <p>{course.category || "Uncategorised"}</p>
              <Button size="sm" variant="outline" onClick={() => handleEdit(course)}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12 text-gray-600">No courses yet. Create the catalogue before adding batches.</div>
      )}
    </div>
  );
}

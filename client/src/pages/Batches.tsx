import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import { Layers, Plus, RefreshCw, Users } from "lucide-react";
import { nestBatchesApi, type NestBatch } from "@/services/nest/batchesApi";
import { nestCoursesApi } from "@/services/nest/coursesApi";

const STATUSES = ["upcoming", "ongoing", "completed", "cancelled"] as const;

interface BatchForm {
  name: string;
  courseId: string;
  timings: string;
  capacity: number;
  status: string;
  startDate: string;
  endDate: string;
}

const emptyForm: BatchForm = {
  name: "",
  courseId: "",
  timings: "",
  capacity: 20,
  status: "upcoming",
  startDate: "",
  endDate: "",
};

export default function Batches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NestBatch | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyForm);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["nest-batches", status],
    queryFn: () =>
      nestBatchesApi.list({
        limit: 100,
        status: status === "all" ? undefined : status,
      }),
    refetchInterval: 20_000,
  });

  const { data: coursesData } = useQuery({
    queryKey: ["nest-courses"],
    queryFn: () => nestCoursesApi.list({ activeOnly: true, limit: 100 }),
  });

  const batches = data?.items ?? [];
  const courses = coursesData?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((batch) =>
      [batch.name, batch.course?.name, batch.course?.code, batch.timings]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [batches, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        courseId: form.courseId,
        timings: form.timings.trim() || undefined,
        capacity: Number(form.capacity),
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (editing) {
        const { courseId: _courseId, ...updatePayload } = payload;
        return nestBatchesApi.update(editing.id, updatePayload);
      }
      return nestBatchesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nest-batches"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Batch updated" : "Batch created" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save batch", description: error.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, courseId: courses[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (batch: NestBatch) => {
    setEditing(batch);
    setForm({
      name: batch.name,
      courseId: batch.courseId,
      timings: batch.timings ?? "",
      capacity: batch.capacity,
      status: batch.status,
      startDate: batch.startDate?.slice(0, 10) ?? "",
      endDate: batch.endDate?.slice(0, 10) ?? "",
    });
    setDialogOpen(true);
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading batches..." color="primary" />;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-sm text-gray-600">Course batches at the centre — students are assigned here</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New batch
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4" />
            {filtered.length} batch{filtered.length === 1 ? "" : "es"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search name or course" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.name}</TableCell>
                  <TableCell>{batch.course?.name ?? batch.courseId}</TableCell>
                  <TableCell>{batch.timings || "—"}</TableCell>
                  <TableCell>
                    {(batch.startDate || "—").slice(0, 10)} → {(batch.endDate || "—").slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {batch._count?.students ?? 0}/{batch.capacity || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{batch.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEdit(batch)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No batches match these filters.</p>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit batch" : "Create batch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Course</Label>
              <Select
                value={form.courseId}
                onValueChange={(value) => setForm({ ...form, courseId: value })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({course.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Timings</Label>
              <Input value={form.timings} onChange={(e) => setForm({ ...form, timings: e.target.value })} placeholder="Mon–Fri 10:00–12:00" />
            </div>
            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || !form.courseId || saveMutation.isPending}>
              Save batch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

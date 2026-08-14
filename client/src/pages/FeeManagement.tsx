import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import { IndianRupee, Receipt, RefreshCw, Wallet } from "lucide-react";
import { nestFeesApi, type NestFeePlan } from "@/services/nest/feesApi";

const PAYMENT_MODES = ["cash", "upi", "card", "bank_transfer", "cheque", "other"] as const;

function inr(value: string | number | undefined): string {
  return Number(value ?? 0).toLocaleString("en-IN");
}

function studentName(plan: NestFeePlan): string {
  const student = plan.student;
  if (!student) return plan.studentId;
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

export default function FeeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payPlan, setPayPlan] = useState<NestFeePlan | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("upi");
  const [installmentId, setInstallmentId] = useState<string>("");
  const [txn, setTxn] = useState("");

  const plansQuery = useQuery({
    queryKey: ["nest-fee-plans"],
    queryFn: () => nestFeesApi.listPlans({ limit: 100 }),
    refetchInterval: 12_000,
  });

  const receiptsQuery = useQuery({
    queryKey: ["nest-receipts"],
    queryFn: () => nestFeesApi.listReceipts({ limit: 100 }),
    refetchInterval: 12_000,
  });

  const plans = plansQuery.data?.items ?? [];
  const receipts = receiptsQuery.data?.items ?? [];

  const totals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    for (const plan of plans) {
      billed += Number(plan.totalAmount ?? 0);
      for (const payment of plan.payments ?? []) {
        collected += Number(payment.amount ?? 0);
      }
    }
    return { billed, collected, outstanding: Math.max(0, billed - collected) };
  }, [plans]);

  const payMutation = useMutation({
    mutationFn: () =>
      nestFeesApi.recordPayment({
        studentFeeId: payPlan?.id,
        installmentId: installmentId || undefined,
        amount: Number(amount),
        paymentMode: mode,
        transactionRef: txn || undefined,
      }),
    onSuccess: (result) => {
      const receiptNo =
        result && typeof result === "object" && "receipt" in result
          ? (result as { receipt?: { receiptNo?: string } }).receipt?.receiptNo
          : undefined;
      toast({
        title: "Payment recorded",
        description: receiptNo ? `Receipt ${receiptNo}` : "Receipt issued",
      });
      setPayPlan(null);
      setAmount("");
      setTxn("");
      queryClient.invalidateQueries({ queryKey: ["nest-fee-plans"] });
      queryClient.invalidateQueries({ queryKey: ["nest-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["nest-dashboard-live"] });
    },
    onError: (error: Error) => {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    },
  });

  if (plansQuery.isLoading) {
    return <Loading fullScreen text="Loading fee plans..." color="primary" />;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee management</h1>
          <p className="text-sm text-gray-600">Normalized fee plans, installments, payments and receipts</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void plansQuery.refetch();
            void receiptsQuery.refetch();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Billed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">₹{inr(totals.billed)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">₹{inr(totals.collected)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">₹{inr(totals.outstanding)}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">
            <Wallet className="w-4 h-4 mr-1" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="receipts">
            <Receipt className="w-4 h-4 mr-1" />
            Receipts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll no</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Installments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{studentName(plan)}</TableCell>
                      <TableCell>{plan.student?.rollNo}</TableCell>
                      <TableCell>₹{inr(plan.totalAmount)}</TableCell>
                      <TableCell>
                        {(plan.installments ?? []).map((item) => (
                          <Badge key={item.id} variant="outline" className="mr-1 mb-1">
                            {item.label}: ₹{inr(item.amountPaid)}/{inr(item.amountDue)}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{plan.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {plan.status === "active" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayPlan(plan);
                              setInstallmentId(plan.installments?.[0]?.id ?? "");
                              const firstOpen = plan.installments?.find((item) => item.status !== "paid");
                              const remaining = firstOpen
                                ? Number(firstOpen.amountDue) - Number(firstOpen.amountPaid)
                                : 0;
                              setAmount(remaining > 0 ? String(remaining) : "");
                              setInstallmentId(firstOpen?.id ?? plan.installments?.[0]?.id ?? "");
                            }}
                          >
                            <IndianRupee className="w-4 h-4 mr-1" />
                            Record payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {plans.length === 0 && (
                <p className="text-sm text-gray-500 py-8 text-center">No fee plans yet. Convert a lead or seed workflow data.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="receipts" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll no</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Paid at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">{receipt.receiptNo}</TableCell>
                      <TableCell>{receipt.studentName}</TableCell>
                      <TableCell>{receipt.rollNo}</TableCell>
                      <TableCell>₹{inr(receipt.amount)}</TableCell>
                      <TableCell>{receipt.paymentMode}</TableCell>
                      <TableCell>{new Date(receipt.paidAt).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!payPlan} onOpenChange={(open) => !open && setPayPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment{payPlan ? ` · ${studentName(payPlan)}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Installment</Label>
              <Select value={installmentId} onValueChange={setInstallmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select installment" />
                </SelectTrigger>
                <SelectContent>
                  {(payPlan?.installments ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label} · remaining ₹{inr(Number(item.amountDue) - Number(item.amountPaid))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Transaction ref</Label>
              <Input value={txn} onChange={(e) => setTxn(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!amount || Number(amount) <= 0 || payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              Save payment and issue receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import ApprovalsPanel from "@/components/ApprovalsPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { useApprovalNotifications } from "@/hooks/useApprovalNotifications";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";

export default function UserApprovals() {
  const { isDirector } = usePermissions();
  const { pendingCount } = useApprovalNotifications();

  if (!isDirector) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-sm shrink-0">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">User Approvals</h1>
            <p className="text-sm text-slate-500">
              Director-only: approve sign-ups and assign roles before users can access the CRM
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit bg-blue-50 text-blue-700 border-blue-100">
          {pendingCount} pending
        </Badge>
      </div>
      <ApprovalsPanel />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useApprovalNotifications } from '@/hooks/useApprovalNotifications';
import { InlineLoading } from '@/components/ui/loading';
import { ASSIGNABLE_ROLES } from '@shared/permissions';
import { approveUser, rejectUser } from '@/lib/iamService';
import { ROLE_NAMES } from '@/lib/types';
import { nestUsersApi } from '@/services/nest/usersApi';

interface PendingUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  centreId?: string;
  createdAt: any;
  approved: boolean;
}

export default function ApprovalsPanel() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const { isDirector } = usePermissions();
  const { toast } = useToast();
  const { pendingCount, loading } = useApprovalNotifications();

  useEffect(() => {
    if (!isDirector) return;

    const fetchPendingUsers = async () => {
      try {
        const result = await nestUsersApi.list({ approved: false, limit: 100 });
        const users = result.items
          .filter((user) => user.approved === false)
          .map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName ?? '',
            email: user.email,
            role: user.role,
            approved: user.approved,
            createdAt: user.createdAt,
          })) as PendingUser[];
        setPendingUsers(users);
        setSelectedRoles((prev) => {
          const next = { ...prev };
          for (const user of users) {
            if (!next[user.id]) next[user.id] = 'faculty';
          }
          return next;
        });
      } catch (error) {
        console.error('Error fetching pending users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load pending users.',
          variant: 'destructive',
        });
      }
    };
    fetchPendingUsers();
  }, [toast, isDirector, pendingCount]);

  const handleApprove = async (userId: string) => {
    const role = selectedRoles[userId];
    if (!role) {
      toast({ title: 'Select a role', description: 'Choose a role before approving.', variant: 'destructive' });
      return;
    }
    setApproving(userId);
    try {
      await approveUser(userId, role);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({
        title: 'User Approved',
        description: 'User has been approved with the selected role.',
      });
    } catch (error: unknown) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve user.',
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (userId: string) => {
    setApproving(userId);
    try {
      await rejectUser(userId);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: 'User Rejected', description: 'User request has been rejected.' });
    } catch (error: unknown) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject user.',
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  };

  if (!isDirector) {
    return null;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <InlineLoading size="sm" color="primary" />
            <span className="text-sm text-slate-600">Loading pending approvals...</span>
          </div>
        ) : pendingCount === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">All clear</h3>
            <p className="text-sm text-slate-500">No pending approvals at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((user, index) => (
              <div key={user.id} className="group">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-col lg:flex-row">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10 border-2 border-gray-100">
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-sm">
                          {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {user.firstName} {user.lastName}
                          </h4>
                          <Badge variant="outline" className="text-xs font-medium">
                            pending
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span>
                              Requested {user.createdAt ?
                                new Date(user.createdAt.toDate()).toLocaleDateString() :
                                'Unknown date'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                      <Select
                        value={selectedRoles[user.id] ?? 'faculty'}
                        onValueChange={(value) => setSelectedRoles((prev) => ({ ...prev, [user.id]: value }))}
                      >
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.filter((r) => r !== 'director').map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_NAMES[role as keyof typeof ROLE_NAMES] ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleReject(user.id)}
                          disabled={approving === user.id}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="h-3 w-3" />
                          <span className="ml-1 text-xs">Reject</span>
                        </Button>
                        <Button
                          onClick={() => handleApprove(user.id)}
                          disabled={approving === user.id}
                          size="sm"
                          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span className="ml-1 text-xs">Approve</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                {index < pendingUsers.length - 1 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

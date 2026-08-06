import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Shield, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { InlineLoading } from '@/components/ui/loading';
import {
  ASSIGNABLE_ROLES,
  MODULE_LABELS,
  MODULE_PERMISSIONS,
  type ModulePermission,
  resolvePermissions,
  getRoleDefaultPermissions,
  normalizeRole,
} from '@shared/permissions';
import { updateUserAccess, migrateKnownUsers } from '@/lib/iamService';
import { ROLE_NAMES } from '@/lib/types';

interface CrmUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  approved?: boolean;
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}

const EDITABLE_MODULES = MODULE_PERMISSIONS.filter(
  (p) => !['dashboard', 'profile', 'user_approvals', 'access_management'].includes(p)
);

export default function AccessManagement() {
  const { isDirector } = usePermissions();
  const { toast } = useToast();
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, {
    role: string;
    permissionsGranted: ModulePermission[];
    permissionsRevoked: ModulePermission[];
  }>>({});

  const loadUsers = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CrmUser, 'id'>),
      }));
      setUsers(list);
      const nextDrafts: typeof drafts = {};
      for (const user of list) {
        nextDrafts[user.id] = {
          role: normalizeRole(user.role) || 'pending',
          permissionsGranted: (user.permissionsGranted ?? []) as ModulePermission[],
          permissionsRevoked: (user.permissionsRevoked ?? []) as ModulePermission[],
        };
      }
      setDrafts(nextDrafts);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load users.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDirector) loadUsers();
  }, [isDirector]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => (a.email ?? '').localeCompare(b.email ?? '')),
    [users]
  );

  if (!isDirector) {
    return <Navigate to="/unauthorized" replace />;
  }

  const updateDraft = (userId: string, patch: Partial<(typeof drafts)[string]>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  };

  const toggleOverride = (userId: string, module: ModulePermission, user: CrmUser) => {
    const draft = drafts[userId];
    if (!draft) return;
    const defaults = getRoleDefaultPermissions(draft.role);
    const inDefaults = defaults.includes(module);
    const granted = new Set(draft.permissionsGranted);
    const revoked = new Set(draft.permissionsRevoked);

    if (inDefaults) {
      if (revoked.has(module)) revoked.delete(module);
      else revoked.add(module);
    } else if (granted.has(module)) {
      granted.delete(module);
    } else {
      granted.add(module);
    }

    updateDraft(userId, {
      permissionsGranted: [...granted],
      permissionsRevoked: [...revoked],
    });
  };

  const isModuleChecked = (userId: string, module: ModulePermission) => {
    const user = users.find((u) => u.id === userId);
    const draft = drafts[userId];
    if (!user || !draft) return false;
    return resolvePermissions(draft.role, draft.permissionsGranted, draft.permissionsRevoked).includes(module);
  };

  const handleSave = async (userId: string) => {
    const draft = drafts[userId];
    if (!draft) return;
    setSavingId(userId);
    try {
      await updateUserAccess({
        targetUid: userId,
        role: draft.role,
        permissionsGranted: draft.permissionsGranted,
        permissionsRevoked: draft.permissionsRevoked,
      });
      toast({ title: 'Access updated', description: 'User permissions saved successfully.' });
      await loadUsers();
    } catch (error: unknown) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not update user access.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const result = await migrateKnownUsers();
      toast({
        title: 'Migration complete',
        description: `Updated ${result.updated} user(s).`,
      });
      await loadUsers();
    } catch (error: unknown) {
      toast({
        title: 'Migration failed',
        description: error instanceof Error ? error.message : 'Could not run migration.',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Access Management</h1>
            <p className="text-sm text-slate-500">Assign roles and manage module access for all users</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadUsers} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleMigrate} disabled={migrating}>
            {migrating ? <InlineLoading size="sm" color="primary" /> : 'Run Email Migration'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <InlineLoading size="md" color="primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {sortedUsers.map((user) => {
            const draft = drafts[user.id];
            if (!draft) return null;
            const effective = resolvePermissions(draft.role, draft.permissionsGranted, draft.permissionsRevoked);

            return (
              <Card key={user.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {user.firstName} {user.lastName}
                      </CardTitle>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.approved ? 'default' : 'secondary'}>
                        {user.approved ? 'Approved' : 'Pending'}
                      </Badge>
                      <Select
                        value={draft.role}
                        onValueChange={(value) => updateDraft(user.id, { role: value, permissionsGranted: [], permissionsRevoked: [] })}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_NAMES[role as keyof typeof ROLE_NAMES] ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => handleSave(user.id)} disabled={savingId === user.id}>
                        {savingId === user.id ? <InlineLoading size="sm" color="primary" /> : <Save className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {EDITABLE_MODULES.map((module) => (
                      <label key={module} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={isModuleChecked(user.id, module)}
                          onCheckedChange={() => toggleOverride(user.id, module, user)}
                        />
                        <span>{MODULE_LABELS[module]}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Effective access: {effective.filter((p) => EDITABLE_MODULES.includes(p)).join(', ') || 'none'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

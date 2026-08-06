import { Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export default function PendingApproval() {
  const { signOut, userProfile } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Pending Approval</h1>
        <p className="text-slate-600">
          {userProfile?.firstName ? `Hi ${userProfile.firstName}, your` : 'Your'} account is waiting for director approval.
          You will be able to sign in once a director assigns your role and approves access.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

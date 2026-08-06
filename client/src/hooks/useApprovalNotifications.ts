import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { firebaseListenerManager } from '@/lib/firebaseListenerManager';

export function useApprovalNotifications() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isDirector } = usePermissions();

  useEffect(() => {
    if (!isDirector) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = firebaseListenerManager.subscribe(
      'users',
      (usersData) => {
        const pendingUsers = usersData.filter(
          (user: { approved?: boolean; rejected?: boolean }) =>
            user.approved === false && !user.rejected
        );
        setPendingCount(pendingUsers.length);
        setLoading(false);
      },
      {}
    );

    return () => unsubscribe();
  }, [isDirector]);

  return { pendingCount, loading };
}

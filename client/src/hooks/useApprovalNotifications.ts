import { useCallback, useEffect, useState } from 'react';
import { nestUsersApi } from '@/services/nest/usersApi';
import { usePermissions } from '@/hooks/usePermissions';

export function useApprovalNotifications() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isDirector } = usePermissions();

  const refresh = useCallback(async () => {
    if (!isDirector) {
      setPendingCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await nestUsersApi.list({ approved: false, limit: 100 });
      setPendingCount(result.items.filter((user) => user.role === 'pending' || user.approved === false).length);
    } catch {
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [isDirector]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { pendingCount, loading, refresh };
}

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { usePermissions } from '@/hooks/usePermissions';
import { db } from '@/lib/firebase';

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

    if (!db) {
      setPendingCount(0);
      setLoading(false);
      return;
    }

    const pendingQuery = query(collection(db, 'users'), where('approved', '==', false));
    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const pendingUsers = snapshot.docs.filter((userDoc) => userDoc.data().rejected !== true);
        setPendingCount(pendingUsers.length);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isDirector]);

  return { pendingCount, loading };
}

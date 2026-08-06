import { useEffect, useRef, useState } from 'react';
import { realtimeService, RealtimeCallbacks } from '../lib/realtimeService';
import { useAuth } from './useAuth';

export interface UseRealtimeOptions {
  enableLeads?: boolean;
  enableReminders?: boolean;
  enableStaff?: boolean;
  enableStudents?: boolean;
  enableNotifications?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { userProfile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const callbacksRef = useRef<RealtimeCallbacks>({});

  useEffect(() => {
    if (!userProfile?.centreId) {
      return;
    }

    const callbacks: RealtimeCallbacks = {};

    if (options.enableLeads) {
      callbacks.onLeadUpdate = () => {
        setLastUpdate(new Date());
      };
    }

    if (options.enableReminders) {
      callbacks.onReminderUpdate = () => {
        setLastUpdate(new Date());
      };
    }

    if (options.enableStaff) {
      callbacks.onStaffUpdate = () => {
        setLastUpdate(new Date());
      };
    }

    if (options.enableStudents) {
      callbacks.onStudentUpdate = () => {
        setLastUpdate(new Date());
      };
    }

    if (options.enableNotifications) {
      callbacks.onNotificationUpdate = () => {
        setLastUpdate(new Date());
      };
    }

    callbacksRef.current = callbacks;

    realtimeService.init(userProfile.centreId, userProfile.id, callbacks);
    setIsConnected(true);

    return () => {
      realtimeService.cleanup();
      setIsConnected(false);
    };
  }, [userProfile?.centreId, userProfile?.id]);

  useEffect(() => {
    if (isConnected) {
      realtimeService.updateCallbacks(callbacksRef.current);
    }
  }, [isConnected, options]);

  return {
    isConnected,
    lastUpdate,
    dataCount: realtimeService.getDataCount()
  };
}

export function useRealtimeLeads() {
  return useRealtime({ enableLeads: true });
}

export function useRealtimeReminders() {
  return useRealtime({ enableReminders: true });
}

export function useRealtimeStaff() {
  return useRealtime({ enableStaff: true });
}

export function useRealtimeStudents() {
  return useRealtime({ enableStudents: true });
}

export function useRealtimeNotifications() {
  return useRealtime({ enableNotifications: true });
}

export function useRealtimeAll() {
  return useRealtime({
    enableLeads: true,
    enableReminders: true,
    enableStaff: true,
    enableStudents: true,
    enableNotifications: true
  });
}

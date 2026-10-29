import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { centreDataStore, type LeadRecord } from '@/lib/centreDataStore';
import { isLearnerRole } from '@shared/permissions';

export interface CentreDataContextValue {
  leads: LeadRecord[];
  loading: boolean;
  isLive: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  patchLead: (leadId: string, updates: Partial<LeadRecord>) => void;
  applyLeadsUpdater: (updater: LeadRecord[] | ((prev: LeadRecord[]) => LeadRecord[])) => void;
}

const CentreDataContext = createContext<CentreDataContextValue | null>(null);

export function CentreDataProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const centreId = userProfile?.centreId?.trim() || null;

  const [state, setState] = useState(() => centreDataStore.getState());

  useEffect(() => {
    return centreDataStore.subscribe(() => {
      setState(centreDataStore.getState());
    });
  }, []);

  useEffect(() => {
    if (!isLearnerRole(userProfile?.role) && (centreId || userProfile?.role === 'director' || userProfile?.role === 'centre_head')) {
      centreDataStore.init({ centreId: centreId || 'global', role: userProfile?.role });
    } else {
      centreDataStore.cleanup();
    }
  }, [centreId, userProfile?.role]);

  const refresh = useCallback(async () => {
    await centreDataStore.refresh();
  }, []);

  const patchLead = useCallback((leadId: string, updates: Partial<LeadRecord>) => {
    centreDataStore.patchLead(leadId, updates);
  }, []);

  const applyLeadsUpdater = useCallback(
    (updater: LeadRecord[] | ((prev: LeadRecord[]) => LeadRecord[])) => {
      centreDataStore.applyLeadsUpdater(updater);
    },
    []
  );

  const value = useMemo<CentreDataContextValue>(
    () => ({
      leads: state.leads,
      loading: state.loading && !state.hasSnapshot,
      isLive: state.isLive,
      lastUpdate: state.lastUpdate,
      refresh,
      patchLead,
      applyLeadsUpdater,
    }),
    [state.leads, state.loading, state.hasSnapshot, state.isLive, state.lastUpdate, refresh, patchLead, applyLeadsUpdater]
  );

  return <CentreDataContext.Provider value={value}>{children}</CentreDataContext.Provider>;
}

export function useCentreData(): CentreDataContextValue {
  const context = useContext(CentreDataContext);
  if (!context) {
    throw new Error('useCentreData must be used within CentreDataProvider');
  }
  return context;
}

/** Alias for leads-focused pages (Dashboard, Leads, Performance). */
export function useLeadsStore(): CentreDataContextValue {
  return useCentreData();
}

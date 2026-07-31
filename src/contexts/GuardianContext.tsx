import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { guardianService } from '../services/guardianService';
import type { Guardian } from '../types';

interface GuardianContextValue {
  guardians: Guardian[];
  isLoading: boolean;
  addGuardian: (g: Omit<Guardian, 'id'>) => Promise<void>;
  updateGuardian: (id: string, patch: Partial<Guardian>) => Promise<void>;
  removeGuardian: (id: string) => Promise<void>;
}

const GuardianContext = createContext<GuardianContextValue | undefined>(undefined);

export function GuardianProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGuardians([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    guardianService.list(user.id).then((list) => {
      setGuardians(list);
      setIsLoading(false);
    }).catch(() => {
      setGuardians([]);
      setIsLoading(false);
    });
  }, [user]);

  const addGuardian = useCallback(async (g: Omit<Guardian, 'id'>) => {
    if (!user) return;
    const created = await guardianService.add(user.id, g);
    setGuardians((prev) => [...prev, created]);
  }, [user]);

  const updateGuardian = useCallback(async (id: string, patch: Partial<Guardian>) => {
    if (!user) return;
    const updated = await guardianService.update(user.id, id, patch);
    setGuardians((prev) => prev.map((g) => (g.id === id ? updated : g)));
  }, [user]);

  const removeGuardian = useCallback(async (id: string) => {
    if (!user) return;
    await guardianService.remove(user.id, id);
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  }, [user]);

  const value = useMemo(
    () => ({ guardians, isLoading, addGuardian, updateGuardian, removeGuardian }),
    [guardians, isLoading, addGuardian, updateGuardian, removeGuardian],
  );

  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>;
}

export function useGuardians() {
  const ctx = useContext(GuardianContext);
  if (!ctx) throw new Error('useGuardians must be used within GuardianProvider');
  return ctx;
}

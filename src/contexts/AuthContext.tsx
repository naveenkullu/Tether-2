import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'tether_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? (JSON.parse(cached) as User) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    profileService.get(user.id).then(setUser).catch(() => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('tether_token');
      setUser(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true);
    try {
      const { user: loggedIn } = await authService.loginWithGoogle(credential);
      setUser(loggedIn);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsGuest = async () => {
    setIsLoading(true);
    try {
      const { user: loggedIn } = await authService.loginAsGuest();
      setUser(loggedIn);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateProfile = async (patch: Partial<User>) => {
    if (!user) return;
    const updated = await profileService.update(user, patch);
    setUser(updated);
  };

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, loginWithGoogle, loginAsGuest, logout, updateProfile }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading], 
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

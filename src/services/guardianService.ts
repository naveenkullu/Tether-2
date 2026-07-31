import { mockDelay } from './apiClient';
import type { Guardian } from '../types';

const STORAGE_KEY = 'tether_guardians';

const defaultGuardians: Guardian[] = [
  { id: 'g_1', name: 'Meera Nair', relation: 'Mother', phone: '+91 98110 22334', email: 'warp639@gmail.com', avatarColor: '#4FA89B', isPrimary: true },
  { id: 'g_2', name: 'Kabir Singh', relation: 'Roommate', phone: '+91 99887 11223', email: 'warp639@gmail.com', avatarColor: '#5C8FB4' },
  { id: 'g_3', name: 'Dr. Priya Menon', relation: 'Family friend', phone: '+91 90123 45678', email: 'warp639@gmail.com', avatarColor: '#D97D6C' },
];

function getStoredGuardians(): Guardian[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: Guardian[] = JSON.parse(stored);
      return parsed.map((g, idx) => ({
        ...g,
        email: g.email || defaultGuardians[idx]?.email || `${g.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      }));
    } catch (e) {
      console.error('Failed to parse guardians from localStorage');
    }
  }
  // Initialize with defaults if empty
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultGuardians));
  return defaultGuardians;
}

function saveGuardians(guardians: Guardian[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guardians));
}

export const guardianService = {
  async list(): Promise<Guardian[]> {
    return mockDelay(getStoredGuardians(), 200);
  },
  async add(guardian: Omit<Guardian, 'id'>): Promise<Guardian> {
    const created: Guardian = { ...guardian, id: `g_${Date.now()}` };
    const current = getStoredGuardians();
    saveGuardians([...current, created]);
    return mockDelay(created, 300);
  },
  async update(id: string, patch: Partial<Guardian>): Promise<Guardian> {
    const current = getStoredGuardians();
    const updatedList = current.map((g) => (g.id === id ? { ...g, ...patch } : g));
    saveGuardians(updatedList);
    const updated = updatedList.find((g) => g.id === id)!;
    return mockDelay(updated, 300);
  },
  async remove(id: string): Promise<void> {
    const current = getStoredGuardians();
    const updatedList = current.filter((g) => g.id !== id);
    saveGuardians(updatedList);
    return mockDelay(undefined, 250);
  },
};


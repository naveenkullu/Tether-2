import { apiClient } from './apiClient';
import type { Guardian } from '../types';

function toGuardian(raw: Guardian & { _id?: string }): Guardian {
  return {
    ...raw,
    id: raw.id || raw._id || '',
  };
}

export const guardianService = {
  async list(userId: string): Promise<Guardian[]> {
    const { data } = await apiClient.get<{ guardians: (Guardian & { _id?: string })[] }>(`/users/${userId}/guardians`);
    return data.guardians.map(toGuardian);
  },
  async add(userId: string, guardian: Omit<Guardian, 'id'>): Promise<Guardian> {
    const { data } = await apiClient.post<{ guardian: Guardian & { _id?: string } }>(`/users/${userId}/guardians`, guardian);
    return toGuardian(data.guardian);
  },
  async update(userId: string, id: string, patch: Partial<Guardian>): Promise<Guardian> {
    const { data } = await apiClient.put<{ guardian: Guardian & { _id?: string } }>(`/users/${userId}/guardians/${id}`, patch);
    return toGuardian(data.guardian);
  },
  async remove(userId: string, id: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/guardians/${id}`);
  },
};

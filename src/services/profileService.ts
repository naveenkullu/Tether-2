import { apiClient } from './apiClient';
import { toFrontendUser } from './authService';
import type { User } from '../types';

export const profileService = {
  async get(userId: string): Promise<User> {
    const { data } = await apiClient.get(`/users/${userId}/profile`);
    return toFrontendUser(data.user);
  },
  async update(current: User, patch: Partial<User>): Promise<User> {
    const { data } = await apiClient.put(`/users/${current.id}/profile`, patch);
    return toFrontendUser(data.user);
  },
  async uploadAvatar(file: File): Promise<{ url: string }> {
    const url = URL.createObjectURL(file);
    return { url };
  },
};

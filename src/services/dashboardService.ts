import { apiClient } from './apiClient';
import type { TimelineEvent } from '../types';

export interface DashboardSummary {
  stats: {
    protectedMinutes: number;
    tripsTracked: number;
    alertsTriggered: number;
    activeGuardians: number;
  };
  timeline: TimelineEvent[];
  recentAlerts: {
    id: string;
    title: string;
    description: string;
    resolved: boolean;
  }[];
}

export async function fetchDashboardSummary(userId: string): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>(`/users/${userId}/dashboard`);
  return data;
}

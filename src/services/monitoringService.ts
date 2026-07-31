import { apiClient } from './apiClient';
import type { Coordinates, Guardian, RiskScore, SafePlace } from '../types';
import type { WeatherData } from './weatherService';

interface MonitoringSession {
  _id: string;
  user: string;
  status: 'active' | 'ended' | 'sos';
  startedAt: string;
  endedAt?: string;
}

interface MonitoringSnapshotInput {
  userId: string;
  sessionId: string;
  location: Coordinates;
  riskScore: RiskScore;
  weather: WeatherData;
  safePlaces: SafePlace[];
  guardians: Guardian[];
  walkingSpeedKmph: number;
  stoppedUnexpectedly: boolean;
  longInactivity: boolean;
  isSos?: boolean;
  batteryLevel?: number;
}

interface MonitoringStartContext {
  currentSafeScore: number;
  currentRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  weather: WeatherData;
  nearbySafePlaces: SafePlace[];
  nearbyPoliceStations: SafePlace[];
  nearbyHospitals: SafePlace[];
  aiInsight: { message: string; tone: 'reassuring' | 'advisory' | 'urgent'; createdAt: string };
  batteryLevel?: number;
  walkingSpeedKmph: number;
  dayNight: 'day' | 'night';
  timestamp: string;
  guardians: Guardian[];
}

function assertValidLocation(location: Coordinates): void {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error('Cannot send monitoring payload without valid live coordinates.');
  }
}

export const monitoringService = {
  async start(userId: string, location: Coordinates, context: MonitoringStartContext): Promise<MonitoringSession> {
    assertValidLocation(location);
    const { data } = await apiClient.post<{ session: MonitoringSession }>('/monitoring/start', {
      userId,
      latitude: location.lat,
      longitude: location.lng,
      ...context,
    });
    return data.session;
  },

  async update(input: MonitoringSnapshotInput) {
    assertValidLocation(input.location);
    const nearbyPoliceStations = input.safePlaces.filter((place) => place.type === 'police');
    const nearbyHospitals = input.safePlaces.filter((place) => place.type === 'hospital');

    const { data } = await apiClient.post('/monitoring/update', {
      userId: input.userId,
      sessionId: input.sessionId,
      latitude: input.location.lat,
      longitude: input.location.lng,
      timestamp: new Date().toISOString(),
      currentSafeScore: input.riskScore.score,
      weather: input.weather,
      dayNight: input.weather.isDay ? 'day' : 'night',
      nearbySafePlaces: input.safePlaces,
      nearbyPoliceStations,
      nearbyHospitals,
      aiInsight: {
        message: input.riskScore.factors[0] ?? 'Safe Walk monitoring active.',
        factors: input.riskScore.factors,
      },
      batteryLevel: input.batteryLevel,
      walkingSpeedKmph: input.walkingSpeedKmph,
      stoppedUnexpectedly: input.stoppedUnexpectedly,
      longInactivity: input.longInactivity,
      isSos: input.isSos ?? false,
      guardians: input.guardians,
    });

    return data;
  },

  async stop(userId: string, sessionId: string, location?: Coordinates, guardians: Guardian[] = []) {
    const { data } = await apiClient.post<{ session: MonitoringSession }>('/monitoring/stop', {
      userId,
      sessionId,
      latitude: location?.lat,
      longitude: location?.lng,
      guardians,
    });
    return data.session;
  },
};

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  phone?: string;
}

export interface Guardian {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email?: string;
  avatarColor: string;
  isPrimary?: boolean;
}

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';
export type SafeWalkStatus = 'idle' | 'monitoring' | 'suspicious' | 'emergency';

export interface RiskScore {
  score: number; // 0 - 100
  level: RiskLevel;
  factors: string[];
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  type: 'location' | 'alert' | 'ai' | 'guardian' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

export interface AlertRecord {
  id: string;
  status: 'sent' | 'acknowledged' | 'resolved';
  location: { lat: number; lng: number };
  triggeredAt: string;
  guardiansNotified: string[];
}

export interface SafePlace {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'store' | 'friend';
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface AIInsight {
  id: string;
  message: string;
  tone: 'reassuring' | 'advisory' | 'urgent';
  createdAt: string;
}

export interface AppSettings {
  darkMode: boolean;
  notifications: {
    push: boolean;
    sms: boolean;
    email: boolean;
  };
  privacy: {
    shareLiveLocation: boolean;
    shareWithGuardiansOnly: boolean;
  };
  locationAccuracy: 'high' | 'balanced' | 'battery-saver';
  language: 'en' | 'hi';
}

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

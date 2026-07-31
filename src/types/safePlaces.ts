import type { Coordinates } from './index';

export type SafePlaceCategory =
  | 'police'
  | 'hospital'
  | 'pharmacy'
  | 'fire_station'
  | 'women_help_centre'
  | 'emergency_clinic';

export interface NearbySafePlace {
  id: string;
  name: string;
  category: SafePlaceCategory;
  address: string;
  coords: Coordinates;
  distanceKm: number;
  walkingMinutes: number;
  drivingMinutes: number;
  safetyScore: number;
}

export interface OverpassSafePlaceOptions {
  origin: Coordinates;
  radiusMeters?: number;
}
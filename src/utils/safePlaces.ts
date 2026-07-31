import type { Coordinates } from '../types';
import type { NearbySafePlace, SafePlaceCategory } from '../types/safePlaces';

export const SAFE_PLACE_RADIUS_METERS = 5000;

export const safePlaceLabels: Record<SafePlaceCategory, string> = {
  police: 'Police Station',
  hospital: 'Hospital',
  pharmacy: '24/7 Pharmacy',
  fire_station: 'Fire Station',
  women_help_centre: "Women's Help Centre",
  emergency_clinic: 'Emergency Clinic',
};

export const safetyScores: Record<SafePlaceCategory, number> = {
  police: 100,
  hospital: 95,
  fire_station: 90,
  women_help_centre: 85,
  emergency_clinic: 80,
  pharmacy: 70,
};

export function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateTravelMinutes(distanceKm: number, speedKmh: number): number {
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60));
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function googleMapsDirectionsUrl(coords: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
}

export function chooseSafestPlace(places: NearbySafePlace[]): NearbySafePlace | null {
  return [...places].sort((a, b) => b.safetyScore - a.safetyScore || a.distanceKm - b.distanceKm)[0] ?? null;
}

export function chooseNearestPlace(places: NearbySafePlace[]): NearbySafePlace | null {
  return [...places].sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
}
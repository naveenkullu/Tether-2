import type { Coordinates } from '../types';
import type { NearbySafePlace, OverpassSafePlaceOptions, SafePlaceCategory } from '../types/safePlaces';
import {
  SAFE_PLACE_RADIUS_METERS,
  calculateDistanceKm,
  estimateTravelMinutes,
  safePlaceLabels,
  safetyScores,
} from '../utils/safePlaces';

interface OverpassElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const REQUEST_TIMEOUT_MS = 10000;

function buildOverpassQuery({ lat, lng }: Coordinates, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${lat},${lng})`;
  return `[out:json][timeout:25];
(
  nwr["amenity"~"police|hospital|fire_station|pharmacy|clinic"]${around};
  nwr["healthcare"~"hospital|clinic"]${around};
  nwr["social_facility"]${around};
  nwr["office"="ngo"]${around};
);
out center tags 120;`;
}

function classify(tags: Record<string, string>): SafePlaceCategory | null {
  const text = Object.values(tags).join(' ').toLowerCase();
  if (tags.amenity === 'police') return 'police';
  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') return 'hospital';
  if (tags.amenity === 'fire_station') return 'fire_station';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (text.includes('women') || text.includes('mahila') || text.includes('female')) return 'women_help_centre';
  if (tags.amenity === 'clinic' || tags.healthcare === 'clinic') return 'emergency_clinic';
  return null;
}

function addressFromTags(tags: Record<string, string>): string {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:postcode'],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : tags.address ?? tags['addr:full'] ?? 'Address not available';
}

export async function fetchNearbySafePlaces({
  origin,
  radiusMeters = SAFE_PLACE_RADIUS_METERS,
}: OverpassSafePlaceOptions): Promise<NearbySafePlace[]> {
  const query = buildOverpassQuery(origin, radiusMeters);
  let data: OverpassResponse;
  try {
    data = await fetchOverpassWithFallback(query);
  } catch (error) {
    console.warn('Overpass failed, trying Nominatim fallback:', error);
    return fetchNominatimFallback(origin, radiusMeters);
  }

  const overpassPlaces = parseOverpassPlaces(data, origin);
  if (overpassPlaces.length > 0) return overpassPlaces;

  console.warn('Overpass returned no safe places, trying Nominatim fallback.');
  return fetchNominatimFallback(origin, radiusMeters);
}

function parseOverpassPlaces(data: OverpassResponse, origin: Coordinates): NearbySafePlace[] {
  const seen = new Set<string>();

  return (data.elements ?? [])
    .map((element): NearbySafePlace | null => {
      const tags = element.tags ?? {};
      const category = classify(tags);
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!category || lat === undefined || lng === undefined) return null;

      const id = `${element.type}-${element.id}`;
      if (seen.has(id)) return null;
      seen.add(id);

      const coords = { lat, lng };
      const distanceKm = calculateDistanceKm(origin, coords);
      return {
        id,
        name: tags.name || safePlaceLabels[category],
        category,
        address: addressFromTags(tags),
        coords,
        distanceKm,
        walkingMinutes: estimateTravelMinutes(distanceKm, 5),
        drivingMinutes: estimateTravelMinutes(distanceKm, 30),
        safetyScore: safetyScores[category],
      };
    })
    .filter((place): place is NearbySafePlace => place !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function fetchOverpassWithFallback(query: string): Promise<OverpassResponse> {
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  const attempts = OVERPASS_ENDPOINTS.map((endpoint, index) =>
    fetchOverpassEndpoint(endpoint, query, controllers[index].signal),
  );

  try {
    return await firstSuccessful(attempts);
  } catch (error) {
    console.error('All Overpass endpoints failed:', error);
  } finally {
    controllers.forEach((controller) => controller.abort());
  }

  throw new Error('Unable to reach OpenStreetMap right now. Please check your network and try again.');
}

async function fetchOverpassEndpoint(
  endpoint: string,
  query: string,
  signal: AbortSignal,
): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });

  const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal: controller.signal });

  window.clearTimeout(timeout);
  signal.removeEventListener('abort', abort);

  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`);
  }

  return (await response.json()) as OverpassResponse;
}

async function fetchNominatimFallback(origin: Coordinates, radiusMeters: number): Promise<NearbySafePlace[]> {
  const delta = radiusMeters / 111_000;
  const viewbox = [
    origin.lng - delta,
    origin.lat + delta,
    origin.lng + delta,
    origin.lat - delta,
  ].join(',');
  const searches: { query: string; category: SafePlaceCategory }[] = [
    { query: 'police station', category: 'police' },
    { query: 'hospital', category: 'hospital' },
    { query: '24/7 pharmacy', category: 'pharmacy' },
    { query: 'pharmacy', category: 'pharmacy' },
    { query: 'fire station', category: 'fire_station' },
    { query: 'women help centre', category: 'women_help_centre' },
    { query: 'emergency clinic', category: 'emergency_clinic' },
    { query: 'clinic', category: 'emergency_clinic' },
  ];

  const responses = await Promise.allSettled(
    searches.map(async ({ query, category }) => {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        viewbox,
        bounded: '1',
        limit: '8',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const places = (await response.json()) as NominatimPlace[];
      return places.map((place) => nominatimToSafePlace(place, category, origin));
    }),
  );

  const deduped = new Map<string, NearbySafePlace>();
  responses.forEach((response) => {
    if (response.status !== 'fulfilled') return;
    response.value.forEach((place) => {
      if (place.distanceKm <= radiusMeters / 1000) deduped.set(place.id, place);
    });
  });

  return [...deduped.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

function nominatimToSafePlace(
  place: NominatimPlace,
  category: SafePlaceCategory,
  origin: Coordinates,
): NearbySafePlace {
  const coords = { lat: Number(place.lat), lng: Number(place.lon) };
  const distanceKm = calculateDistanceKm(origin, coords);
  const name = place.name || place.display_name.split(',')[0] || safePlaceLabels[category];
  return {
    id: `nominatim-${place.place_id}-${category}`,
    name,
    category,
    address: place.display_name,
    coords,
    distanceKm,
    walkingMinutes: estimateTravelMinutes(distanceKm, 5),
    drivingMinutes: estimateTravelMinutes(distanceKm, 30),
    safetyScore: safetyScores[category],
  };
}

function firstSuccessful<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const errors: unknown[] = [];
    let rejectedCount = 0;

    promises.forEach((promise) => {
      promise.then(resolve).catch((error: unknown) => {
        errors.push(error);
        rejectedCount += 1;
        if (rejectedCount === promises.length) reject(errors);
      });
    });
  });
}
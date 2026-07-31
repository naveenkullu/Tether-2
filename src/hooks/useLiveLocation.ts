import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../types';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface UseLiveLocationResult {
  coords: Coordinates | null;
  status: LocationStatus;
  lastUpdated: Date | null;
  error: string | null;
  refresh: () => void;
}

/**
 * Requests browser geolocation permission, then keeps `coords` fresh via
 * watchPosition. Falls back gracefully (with a status flag, never a crash)
 * if permission is denied or the API is unavailable — the LiveMap component
 * decides what to render for each status.
 */
export function useLiveLocation(enabled = true): UseLiveLocationResult {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    setLastUpdated(new Date());
    setStatus('granted');
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied');
      setError('Location permission was denied. Enable it in your browser settings to see your live position.');
    } else {
      setStatus('unavailable');
      setError('Your location is unavailable right now. Try again in a moment.');
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      setError('Geolocation is not supported on this device.');
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
  }, [handleSuccess, handleError]);

  useEffect(() => {
    if (!enabled) return undefined;
    startWatching();
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const refresh = useCallback(() => startWatching(), [startWatching]);

  return { coords, status, lastUpdated, error, refresh };
}

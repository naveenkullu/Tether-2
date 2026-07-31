import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { FiCrosshair, FiRefreshCw } from 'react-icons/fi';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import { useLiveLocation, type UseLiveLocationResult } from '../../hooks/useLiveLocation';
import type { Coordinates } from '../../types';
import { formatCoord } from '../../utils/format';

/**
 * Fix for the classic Leaflet + bundler issue: the default marker icon
 * references image paths that Vite doesn't resolve automatically. We import
 * the marker assets directly and rebuild the default icon from them.
 */
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const userIcon = L.divIcon({
  className: '',
  html: `<div class="relative flex items-center justify-center">
      <span class="absolute h-9 w-9 rounded-full bg-teal-400/25 animate-ping"></span>
      <span class="h-3.5 w-3.5 rounded-full bg-teal-400 border-2 border-white shadow-md"></span>
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface RecenterControlProps {
  target: Coordinates | null;
}

/** Small helper that lives inside MapContainer so it can call useMap(). */
function RecenterControl({ target }: RecenterControlProps) {
  const map = useMap();
  const recenter = () => {
    if (target) map.flyTo([target.lat, target.lng], 16, { duration: 0.8 });
  };
  return (
    <button
      onClick={recenter}
      aria-label="Recenter map"
      className="absolute z-[400] bottom-4 right-4 glass-light rounded-full p-3 text-sky-50 hover:bg-white/20 transition-colors"
    >
      <FiCrosshair size={16} />
    </button>
  );
}

interface LiveMapProps {
  /** Optional externally-supplied point (e.g. a future backend emergency location) to render alongside the user. */
  externalPoint?: { coords: Coordinates; label: string } | null;
  height?: string;
  liveLocation?: UseLiveLocationResult;
}

export default function LiveMap({ externalPoint = null, height = '420px', liveLocation }: LiveMapProps) {
  const ownLiveLocation = useLiveLocation(!liveLocation);
  const { coords, status, lastUpdated, error, refresh } = liveLocation ?? ownLiveLocation;
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (coords && mapRef.current) {
      mapRef.current.setView([coords.lat, coords.lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'granted' && !mapRef.current]);

  if (status === 'idle' || status === 'requesting') {
    return (
      <div
        className="rounded-[var(--radius-xl2)] glass flex items-center justify-center"
        style={{ height }}
      >
        <Loader label="Requesting your location…" />
      </div>
    );
  }

  if ((status === 'denied' || status === 'unavailable') && !coords) {
    return (
      <div
        className="rounded-[var(--radius-xl2)] glass flex flex-col items-center justify-center gap-3 text-center px-6"
        style={{ height }}
      >
        <p className="text-sm text-sky-200 max-w-xs">{error}</p>
        <Button size="sm" variant="secondary" icon={<FiRefreshCw />} onClick={refresh}>
          Try again
        </Button>
      </div>
    );
  }

  if (!coords) return null;

  return (
    <div className="dusk-map relative rounded-[var(--radius-xl2)] overflow-hidden glass" style={{ height }}>
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={16}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Marker position={[coords.lat, coords.lng]} icon={userIcon}>
          <Popup>
            <div className="font-mono text-xs leading-relaxed">
              <p>Lat: {formatCoord(coords.lat)}</p>
              <p>Lng: {formatCoord(coords.lng)}</p>
              <p className="mt-1 text-sky-600">
                Updated {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
              </p>
            </div>
          </Popup>
        </Marker>

        {externalPoint && (
          <Marker position={[externalPoint.coords.lat, externalPoint.coords.lng]}>
            <Popup>{externalPoint.label}</Popup>
          </Marker>
        )}

        <RecenterControl target={coords} />
      </MapContainer>

      <div className="absolute top-4 left-4 z-[400] glass-light rounded-2xl px-4 py-2.5 font-mono text-xs text-sky-50 leading-relaxed">
        <p>{formatCoord(coords.lat)}, {formatCoord(coords.lng)}</p>
        <p className="text-sky-300/70 mt-0.5">
          {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : 'awaiting fix'}
        </p>
      </div>

      <button
        onClick={refresh}
        aria-label="Refresh location"
        className="absolute z-[400] bottom-4 left-4 glass-light rounded-full p-3 text-sky-50 hover:bg-white/20 transition-colors"
      >
        <FiRefreshCw size={16} />
      </button>
    </div>
  );
}

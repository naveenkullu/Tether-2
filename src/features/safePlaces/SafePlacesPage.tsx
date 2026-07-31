import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiFilter,
  FiMapPin,
  FiNavigation,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from 'react-icons/fi';
import { FaClinicMedical, FaFireExtinguisher, FaHospital, FaPills, FaVenus } from 'react-icons/fa';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { fetchNearbySafePlaces } from '../../services/safePlacesService';
import type { Coordinates } from '../../types';
import type { NearbySafePlace, SafePlaceCategory } from '../../types/safePlaces';
import {
  chooseNearestPlace,
  chooseSafestPlace,
  formatDistance,
  formatEta,
  googleMapsDirectionsUrl,
  safePlaceLabels,
} from '../../utils/safePlaces';

type FilterCategory = 'all' | Exclude<SafePlaceCategory, 'emergency_clinic'>;
type LoadStatus = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'error';

const filters: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'police', label: 'Police' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'fire_station', label: 'Fire Station' },
  { key: 'women_help_centre', label: "Women's Help Centre" },
];

const markerColors: Record<SafePlaceCategory, string> = {
  police: '#4FA89B',
  hospital: '#E39485',
  pharmacy: '#A9C7DE',
  fire_station: '#D97D6C',
  women_help_centre: '#C9DFEE',
  emergency_clinic: '#6FBFB2',
};

const LOCATION_SCAN_TIMEOUT_MS = 15000;

const categoryIcon = {
  police: FiShield,
  hospital: FaHospital,
  pharmacy: FaPills,
  fire_station: FaFireExtinguisher,
  women_help_centre: FaVenus,
  emergency_clinic: FaClinicMedical,
} satisfies Record<SafePlaceCategory, React.ComponentType<{ size?: number; className?: string }>>;

const userIcon = L.divIcon({
  className: '',
  html: `<div class="relative flex items-center justify-center"><span class="absolute h-10 w-10 rounded-full bg-teal-400/25 animate-ping"></span><span class="h-4 w-4 rounded-full bg-teal-400 border-2 border-white shadow-lg"></span></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function placeIcon(category: SafePlaceCategory) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${markerColors[category]}" class="h-8 w-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-dusk-950 font-bold text-xs">${safePlaceLabels[category][0]}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function RecenterMap({ coords }: { coords: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lng], 14, { duration: 0.7 });
  }, [coords, map]);
  return null;
}

export default function SafePlacesPage() {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [places, setPlaces] = useState<NearbySafePlace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const mounted = useRef(true);
  const scanTimer = useRef<number | null>(null);

  const clearScanTimer = () => {
    if (scanTimer.current !== null) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
  };

  const loadPlaces = () => {
    clearScanTimer();
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      setError('GPS is unavailable on this device.');
      return;
    }

    setStatus('locating');
    setError(null);
    scanTimer.current = window.setTimeout(() => {
      if (!mounted.current) return;
      setStatus('error');
      setError('Location or OpenStreetMap is taking too long to respond. Please allow location access and try again.');
    }, LOCATION_SCAN_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const origin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (!mounted.current) return;
        setCoords(origin);
        setStatus('loading');
        try {
          const results = await fetchNearbySafePlaces({ origin });
          if (!mounted.current) return;
          clearScanTimer();
          setPlaces(results);
          setStatus('ready');
        } catch (err) {
          if (!mounted.current) return;
          clearScanTimer();
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Network failure while finding safe places.');
        }
      },
      (geoError) => {
        clearScanTimer();
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('denied');
          setError('Location permission was denied. Enable location access to find nearby safe places.');
        } else {
          setStatus('unavailable');
          setError('GPS is unavailable right now. Move to an open area or try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    mounted.current = true;
    loadPlaces();
    return () => {
      mounted.current = false;
      clearScanTimer();
    };
  }, []);

  const filteredPlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => {
      const matchesFilter = filter === 'all' || place.category === filter || (filter === 'hospital' && place.category === 'emergency_clinic');
      const text = `${place.name} ${place.address} ${safePlaceLabels[place.category]}`.toLowerCase();
      return matchesFilter && (!needle || text.includes(needle));
    });
  }, [filter, places, query]);

  const nearest = chooseNearestPlace(places);
  const safest = chooseSafestPlace(places);
  const loading = status === 'idle' || status === 'locating' || status === 'loading';

  const navigateTo = (place: NearbySafePlace | null) => {
    if (place) window.open(googleMapsDirectionsUrl(place.coords), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-teal-300/80 mb-2">Emergency navigation</p>
          <h2 className="text-3xl sm:text-4xl text-sky-50">Nearby Safe Places</h2>
          <p className="text-sm text-sky-300/75 max-w-2xl mt-3">
            Finds real OpenStreetMap safe locations within about 5 km of your live GPS position.
          </p>
        </div>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={loadPlaces} loading={loading}>Refresh</Button>
      </section>

      {loading ? <SafePlacesSkeleton /> : error ? <ErrorState message={error} onRetry={loadPlaces} /> : null}

      {!loading && !error && nearest && (
        <NearestCard nearest={nearest} safest={safest} onQuickNavigate={() => navigateTo(safest)} />
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="dusk-map relative h-[380px] sm:h-[460px]">
          {coords ? (
            <MapContainer center={[coords.lat, coords.lng]} zoom={14} scrollWheelZoom className="h-full w-full" attributionControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <RecenterMap coords={coords} />
              <Marker position={[coords.lat, coords.lng]} icon={userIcon}>
                <Popup>Your live location</Popup>
              </Marker>
              {filteredPlaces.map((place) => (
                <Marker key={place.id} position={[place.coords.lat, place.coords.lng]} icon={placeIcon(place.category)}>
                  <Popup>
                    <div className="min-w-48 text-xs leading-relaxed">
                      <strong>{place.name}</strong>
                      <p>{safePlaceLabels[place.category]}</p>
                      <p>{formatDistance(place.distanceKm)} · Walk {formatEta(place.walkingMinutes)}</p>
                      <p>Safety Score: {place.safetyScore}</p>
                      <button className="mt-2 rounded-full bg-teal-500 px-3 py-1 text-dusk-950 font-medium" onClick={() => navigateTo(place)}>Navigate</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sky-300/80">Waiting for GPS…</div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between mb-5">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-300/60" size={16} />
            <input className="input pl-10" placeholder="Search by name, address, or category" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-full px-3.5 py-2 text-xs transition-colors ${filter === item.key ? 'bg-teal-500 text-dusk-950' : 'glass-light text-sky-200 hover:text-sky-50'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredPlaces.length === 0 ? (
          <EmptyState hasPlaces={places.length > 0} />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlaces.map((place) => <PlaceCard key={place.id} place={place} onNavigate={() => navigateTo(place)} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function NearestCard({ nearest, safest, onQuickNavigate }: { nearest: NearbySafePlace; safest: NearbySafePlace | null; onQuickNavigate: () => void }) {
  return (
    <Card className="border-teal-400/25">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal-300 mb-2">Nearest Safe Place</p>
          <h3 className="text-2xl text-sky-50">{nearest.name}</h3>
          <p className="text-sm text-sky-300/75 mt-1">{safePlaceLabels[nearest.category]} · {nearest.address}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="Distance" value={formatDistance(nearest.distanceKm)} />
          <Metric label="Walking" value={formatEta(nearest.walkingMinutes)} />
          <Metric label="Driving" value={formatEta(nearest.drivingMinutes)} />
          <Metric label="Safety" value={`${nearest.safetyScore}/100`} />
        </div>
        <Button icon={<FiNavigation />} onClick={onQuickNavigate}>Quick Navigate</Button>
      </div>
      {safest && safest.id !== nearest.id && <p className="mt-4 text-xs text-sky-300/70">Quick Navigate prioritizes safety first, then distance: {safest.name}.</p>}
    </Card>
  );
}

function PlaceCard({ place, onNavigate }: { place: NearbySafePlace; onNavigate: () => void }) {
  const Icon = categoryIcon[place.category];
  return (
    <div className="glass-light rounded-3xl p-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="h-11 w-11 rounded-2xl bg-white/[0.08] text-teal-300 flex items-center justify-center shrink-0"><Icon size={18} /></span>
        <div className="min-w-0">
          <h3 className="text-sky-50 font-medium truncate">{place.name}</h3>
          <p className="text-xs text-sky-300/70">{safePlaceLabels[place.category]}</p>
          <p className="text-xs text-sky-300/60 mt-1 line-clamp-2">{place.address}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Distance" value={formatDistance(place.distanceKm)} />
        <Metric label="Safety" value={`${place.safetyScore}/100`} />
        <Metric label="Walking" value={formatEta(place.walkingMinutes)} />
        <Metric label="Driving" value={formatEta(place.drivingMinutes)} />
      </div>
      <Button variant="secondary" size="sm" icon={<FiNavigation />} onClick={onNavigate} fullWidth>Navigate</Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/[0.05] px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-sky-300/55">{label}</p><p className="font-mono text-sky-50 mt-0.5">{value}</p></div>;
}

function SafePlacesSkeleton() {
  return <Card><div className="flex items-center gap-3 mb-5 text-sky-200"><FiMapPin className="animate-pulse" /> Requesting location and scanning OpenStreetMap…</div><div className="grid sm:grid-cols-3 gap-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-3xl bg-white/[0.06] animate-pulse" />)}</div></Card>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Card className="border-coral-400/25"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex gap-3"><FiAlertCircle className="text-coral-400 shrink-0 mt-0.5" /><p className="text-sm text-sky-200">{message}</p></div><Button variant="secondary" size="sm" icon={<FiRefreshCw />} onClick={onRetry}>Try again</Button></div></Card>;
}

function EmptyState({ hasPlaces }: { hasPlaces: boolean }) {
  return <div className="py-12 text-center text-sky-300/75"><FiFilter className="mx-auto mb-3" size={22} /><p>{hasPlaces ? 'No safe places match your filters or search.' : 'No nearby safe places found within approximately 5 km.'}</p></div>;
}
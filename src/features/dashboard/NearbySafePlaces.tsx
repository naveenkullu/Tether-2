import { useEffect, useState } from 'react';
import { FiHome, FiPlusCircle, FiShoppingBag, FiUserCheck } from 'react-icons/fi';
import Card from '../../components/common/Card';
import { fetchSafePlaces } from '../../services/safetyService';
import type { Coordinates, SafePlace } from '../../types';

const typeIcon: Record<SafePlace['type'], typeof FiHome> = {
  police: FiHome,
  hospital: FiPlusCircle,
  store: FiShoppingBag,
  friend: FiUserCheck,
};

interface NearbySafePlacesProps {
  origin?: Coordinates | null;
}

export default function NearbySafePlaces({ origin = null }: NearbySafePlacesProps) {
  const [places, setPlaces] = useState<SafePlace[]>([]);

  useEffect(() => {
    fetchSafePlaces(origin ?? undefined).then(setPlaces);
  }, [origin]);

  return (
    <Card>
      <div className="text-sky-300/80 text-xs uppercase tracking-wide mb-4">Nearby safe places</div>
      <ul className="space-y-3">
        {places.map((place) => {
          const Icon = typeIcon[place.type];
          return (
            <li key={place.id} className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-white/[0.06] text-sky-200 flex items-center justify-center shrink-0">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-sky-50 truncate">{place.name}</p>
                <p className="text-xs text-sky-300/70 capitalize">{place.type}</p>
              </div>
              <span className="text-xs font-mono text-sky-300/70 shrink-0">{place.distanceKm} km</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

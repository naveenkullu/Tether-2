import { FiClock, FiMapPin, FiShieldOff, FiUsers } from 'react-icons/fi';
import Card from '../../components/common/Card';
import { useGuardians } from '../../contexts/GuardianContext';
import type { DashboardSummary } from '../../services/dashboardService';

function formatProtectedTime(minutes = 0) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

interface StatisticsCardsProps {
  summary?: DashboardSummary | null;
}

export default function StatisticsCards({ summary = null }: StatisticsCardsProps) {
  const { guardians } = useGuardians();
  const stats = [
    { icon: FiClock, label: 'Protected time this week', value: formatProtectedTime(summary?.stats.protectedMinutes ?? 0) },
    { icon: FiMapPin, label: 'Trips tracked', value: String(summary?.stats.tripsTracked ?? 0) },
    { icon: FiShieldOff, label: 'Alerts triggered', value: String(summary?.stats.alertsTriggered ?? 0) },
    { icon: FiUsers, label: 'Active guardians', value: String(summary?.stats.activeGuardians ?? guardians.length) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} padded className="!p-4">
          <stat.icon size={16} className="text-teal-400 mb-3" />
          <p className="text-xl font-semibold text-sky-50 font-mono">{stat.value}</p>
          <p className="text-xs text-sky-300/70 mt-1 leading-snug">{stat.label}</p>
        </Card>
      ))}
    </div>
  );
}

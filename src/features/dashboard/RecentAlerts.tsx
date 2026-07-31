import { FiCheckCircle, FiClock } from 'react-icons/fi';
import Card from '../../components/common/Card';

interface RecentAlertsProps {
  alerts?: {
    id: string;
    title: string;
    description: string;
    resolved: boolean;
  }[];
}

const emptyRecent = [
  { id: 'empty', title: 'No alerts yet', description: 'Your alert history will appear here once Tether records activity.', resolved: true },
];

export default function RecentAlerts({ alerts = [] }: RecentAlertsProps) {
  const recent = alerts.length > 0 ? alerts : emptyRecent;
  return (
    <Card>
      <div className="flex items-center gap-2 text-sky-300/80 text-xs uppercase tracking-wide mb-4">
        <FiClock size={13} /> Recent alerts
      </div>
      <ul className="space-y-3">
        {recent.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="mt-0.5 text-teal-400 shrink-0">
              <FiCheckCircle size={16} />
            </span>
            <div>
              <p className="text-sm text-sky-50">{item.title}</p>
              <p className="text-xs text-sky-300/70 mt-0.5">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

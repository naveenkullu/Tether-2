import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LiveMap from '../map/LiveMap';
import AIInsights from './AIInsights';
import GuardianList from './GuardianList';
import IncidentTimeline from './IncidentTimeline';
import ProfileCard from './ProfileCard';
import QuickActions from './QuickActions';
import RecentAlerts from './RecentAlerts';
import SafeWalkPanel from '../safewalk/SafeWalkPanel';
import StatisticsCards from './StatisticsCards';
import VoiceIndicator from '../../components/emergency/VoiceIndicator';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useVoiceDistressDetection } from '../../hooks/useVoiceDistressDetection';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDashboardSummary, type DashboardSummary } from '../../services/dashboardService';
import type { TimelineEvent } from '../../types';

export default function DashboardPage() {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const liveLocation = useLiveLocation();

  // When distress is detected from dashboard, navigate to emergency page
  const onDistress = useCallback(() => {
    navigate('/emergency', { state: { autoTrigger: true } });
  }, [navigate]);

  const { status: voiceStatus, error: voiceError, startListening, stopListening } =
    useVoiceDistressDetection(onDistress, true);

  useEffect(() => {
    if (!user) return;
    fetchDashboardSummary(user.id).then((data) => {
      setSummary(data);
      setTimeline(data.timeline);
    }).catch(() => {
      setSummary(null);
      setTimeline([]);
    });
  }, [user]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <StatisticsCards summary={summary} />

      {/* Compact voice monitoring strip */}
      <div className="-mt-2">
        <VoiceIndicator
          status={voiceStatus}
          error={voiceError}
          onStart={startListening}
          onStop={stopListening}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <LiveMap height="380px" liveLocation={liveLocation} />
          <div className="grid sm:grid-cols-2 gap-6">
            <SafeWalkPanel liveLocation={liveLocation.coords} />
            <QuickActions />
          </div>
          <IncidentTimeline events={timeline} title="Live timeline" compact />
        </div>

        <div className="flex flex-col gap-6">
          <ProfileCard />
          <GuardianList />
          <AIInsights />
          <RecentAlerts alerts={summary?.recentAlerts ?? []} />
          
        </div>
      </div>
    </div>
  );
}

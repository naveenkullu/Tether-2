import { FiShield, FiStopCircle, FiCheckCircle, FiCompass, FiVolume2, FiRadio } from 'react-icons/fi';
import Card from '../../components/common/Card';
import { useSmartSafeWalk } from '../../hooks/useSmartSafeWalk';

export default function SafeWalkPanel() {
  const { status, riskScore, startWalk, stopWalk, confirmSafe } = useSmartSafeWalk();
  const isActive = status !== 'idle';

  const displayScore = riskScore?.score ?? (isActive ? 12 : 10);
  const displayLevel = riskScore?.level ?? (displayScore > 50 ? 'elevated' : displayScore > 25 ? 'moderate' : 'low');
  const displayFactors = riskScore?.factors ?? [
    'Walking speed & pace consistent',
    'Route matches usual history',
    'Sensors & live GPS active'
  ];

  // SVG Circular Gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const scoreColor =
    displayLevel === 'high' ? 'text-red-400 stroke-red-500' :
    displayLevel === 'elevated' ? 'text-orange-400 stroke-orange-500' :
    displayLevel === 'moderate' ? 'text-yellow-400 stroke-yellow-500' :
    'text-teal-300 stroke-teal-400';

  return (
    <Card className="relative overflow-hidden transition-all duration-500 border border-sky-400/20 bg-slate-900/60 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
            <FiShield size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-sky-100">Smart Safe Walk</h3>
            <p className="text-[11px] text-sky-300/60">Real-time risk &amp; sensor monitoring</p>
          </div>
        </div>

        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {!isActive ? (
        <div className="py-2 space-y-4">
          {/* Active Sensors overview */}
          <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-slate-800/40 border border-sky-400/10 text-center">
            <div className="flex flex-col items-center gap-1">
              <FiCompass className="text-teal-400" size={14} />
              <span className="text-[10px] text-sky-200/70 font-medium">GPS Motion</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <FiRadio className="text-sky-400" size={14} />
              <span className="text-[10px] text-sky-200/70 font-medium">Impact Detect</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <FiVolume2 className="text-purple-400" size={14} />
              <span className="text-[10px] text-sky-200/70 font-medium">Audio Spike</span>
            </div>
          </div>

          <p className="text-xs text-sky-200/60 leading-relaxed">
            Continuously analyzes motion, location telemetry, and audio spikes to auto-escalate if danger is detected.
          </p>

          <button
            onClick={startWalk}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl py-3 font-semibold text-sm shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <FiShield size={16} /> Start Walk Mode
          </button>
        </div>
      ) : (
        <div className="py-2 space-y-4">
          {/* Circular Risk Score Gauge Display */}
          <div className="flex items-center justify-around py-2 px-3 rounded-xl bg-slate-800/40 border border-sky-400/10">
            {/* SVG Circular Progress Meter */}
            <div className="relative flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  className="stroke-slate-700/60"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  className={`transition-all duration-1000 ease-out ${scoreColor.split(' ')[1]}`}
                  strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`text-xl font-bold ${scoreColor.split(' ')[0]}`}>{displayScore}</span>
                <span className="text-[9px] uppercase tracking-wider text-sky-300/60 font-semibold">Risk Index</span>
              </div>
            </div>

            {/* Status & Level details next to ring */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${
                  status === 'emergency' ? 'bg-red-500 animate-ping' :
                  status === 'suspicious' ? 'bg-yellow-500 animate-ping' : 'bg-teal-400'
                }`} />
                <span className={`text-xs font-bold uppercase tracking-wide ${
                  status === 'emergency' ? 'text-red-400' :
                  status === 'suspicious' ? 'text-yellow-400' : 'text-teal-300'
                }`}>
                  {status === 'emergency' ? 'EMERGENCY' :
                   status === 'suspicious' ? 'SUSPICIOUS' : 'MONITORING'}
                </span>
              </div>
              <p className="text-xs font-medium text-sky-100 capitalize">
                {displayLevel} Risk Environment
              </p>
              <p className="text-[10px] text-sky-300/50 leading-tight">
                {status === 'emergency' ? 'Alert dispatches to guardians' :
                 status === 'suspicious' ? 'Multiple anomalies in 5s' :
                 'Sensors active • Wake lock ON'}
              </p>
            </div>
          </div>

          {/* Key Safety Factors / Bullet Points */}
          <div className="space-y-1.5 px-0.5">
            <span className="text-[11px] font-semibold text-sky-300/70 uppercase tracking-wider">
              Safety Factors &amp; Telemetry
            </span>
            <ul className="space-y-1">
              {displayFactors.map((factor, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-sky-100/90 bg-slate-800/30 px-2.5 py-1.5 rounded-lg border border-sky-400/5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />
                  <span className="truncate">{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {status === 'suspicious' && (
              <button
                onClick={confirmSafe}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-2.5 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <FiCheckCircle size={14} /> I'm Safe
              </button>
            )}

            <button
              onClick={stopWalk}
              className="flex-1 bg-slate-800/80 hover:bg-slate-700/80 text-sky-200 rounded-xl py-2.5 font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-700/80"
            >
              <FiStopCircle size={14} /> Stop Monitoring
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

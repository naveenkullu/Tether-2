import { AnimatePresence, motion } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiCheck, FiMapPin, FiMic, FiShield, FiUsers } from 'react-icons/fi';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import VoiceIndicator from '../../components/emergency/VoiceIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { useGuardians } from '../../contexts/GuardianContext';
import { useVoiceDistressDetection } from '../../hooks/useVoiceDistressDetection';
import { triggerEmergencyAlert } from '../../services/safetyService';
import type { AlertRecord, Coordinates } from '../../types';
import { formatCoord } from '../../utils/format';

type Phase = 'idle' | 'arming' | 'sending' | 'sent';

function fakeCoordinates(): Coordinates {
  // Centered near Gurugram, Delhi-NCR, with a small random jitter for realism.
  return {
    lat: 28.4595 + (Math.random() - 0.5) * 0.01,
    lng: 77.0266 + (Math.random() - 0.5) * 0.01,
    accuracy: 8 + Math.random() * 6,
  };
}

export default function EmergencyPage() {
  const { user } = useAuth();
  const { guardians } = useGuardians();
  const [phase, setPhase] = useState<Phase>('idle');
  const [alert, setAlert] = useState<AlertRecord | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const location = useLocation();

  const handleTrigger = useCallback(async () => {
    if (phase !== 'idle') return; // prevent double-trigger
    setPhase('arming');
    await new Promise((r) => setTimeout(r, 900));
    setPhase('sending');
    const loc = fakeCoordinates();
    const record = await triggerEmergencyAlert(loc, guardians, user);
    setAlert(record);
    setPhase('sent');
    setSuccessOpen(true);
  }, [phase, guardians, user]);

  const { status: voiceStatus, error: voiceError, startListening, stopListening } =
    useVoiceDistressDetection(handleTrigger, true);

  useEffect(() => {
    if (location.state?.autoTrigger && phase === 'idle') {
      // Clear the state so it doesn't loop
      window.history.replaceState({}, document.title);
      handleTrigger();
    }
  }, [location.state?.autoTrigger, phase, handleTrigger]);

  const reset = () => {
    setPhase('idle');
    setSuccessOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center pb-10 pt-4">
      <p className="text-center text-sm text-sky-300/75 max-w-sm mb-10">
        Press and hold your circle close. This sends your live location, a fresh risk read,
        and an evidence timestamp to every guardian instantly.
      </p>

      <div className="relative flex items-center justify-center h-64 w-64 mb-10">
        {phase !== 'idle' && (
          <>
            <span className="absolute inset-0 rounded-full bg-coral-500/20 animate-ping" />
            <span className="absolute inset-4 rounded-full bg-coral-500/15 animate-pulse" />
          </>
        )}
        <motion.button
          onClick={phase === 'idle' ? handleTrigger : undefined}
          whileTap={{ scale: 0.94 }}
          className="relative h-52 w-52 rounded-full bg-gradient-to-b from-coral-400 to-coral-600 shadow-[0_20px_60px_-15px_rgba(217,125,108,0.7)] flex flex-col items-center justify-center text-dusk-950 disabled:cursor-not-allowed"
          disabled={phase !== 'idle'}
        >
          <FiShield size={40} />
          <span className="mt-3 text-lg font-semibold tracking-tight">
            {phase === 'idle' && 'Trigger alert'}
            {phase === 'arming' && 'Arming…'}
            {phase === 'sending' && 'Sending…'}
            {phase === 'sent' && 'Alert sent'}
          </span>
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {phase !== 'idle' && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <StatusSteps phase={phase} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Voice Distress Detection ── */}
      <div className="w-full mt-2">
        <div className="flex items-center gap-2 text-sky-300/70 text-xs uppercase tracking-wide mb-3">
          <FiMic size={11} />
          <span>Voice Distress Detection</span>
        </div>
        <VoiceIndicator
          status={voiceStatus}
          error={voiceError}
          onStart={startListening}
          onStop={stopListening}
        />
      </div>

      {phase === 'sent' && alert && (
        <Button variant="secondary" className="mt-8" onClick={reset}>
          Reset demo
        </Button>
      )}

      <Modal open={successOpen} onClose={() => setSuccessOpen(false)} title="Your circle has been tethered in">
        {alert && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-teal-300">
              <span className="h-10 w-10 rounded-full bg-teal-500/15 flex items-center justify-center">
                <FiCheck size={18} />
              </span>
              <p className="text-sm text-sky-100">
                Alert <span className="font-mono text-xs">{alert.id}</span> delivered.
              </p>
            </div>

            <div className="glass-light rounded-2xl p-4 font-mono text-xs text-sky-100 flex items-center gap-2">
              <FiMapPin className="text-teal-400 shrink-0" />
              {formatCoord(alert.location.lat)}, {formatCoord(alert.location.lng)}
            </div>

            <div>
              <p className="text-xs text-sky-300/70 mb-2 flex items-center gap-1.5">
                <FiUsers size={12} /> Guardians notified
              </p>
              <ul className="flex flex-col gap-1.5">
                {alert.guardiansNotified.map((name) => (
                  <li key={name} className="text-sm text-sky-50">{name}</li>
                ))}
              </ul>
            </div>

            <Button fullWidth onClick={() => setSuccessOpen(false)}>Done</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusSteps({ phase }: { phase: Phase }) {
  const steps = [
    { key: 'arming', label: 'Generating live GPS fix' },
    { key: 'sending', label: 'Recalculating risk score' },
    { key: 'sent', label: 'Notifying guardian circle' },
  ];
  const order = ['arming', 'sending', 'sent'];
  const currentIndex = order.indexOf(phase);

  return (
    <Card className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const done = i < currentIndex || phase === 'sent';
        const active = i === currentIndex && phase !== 'sent';
        return (
          <div key={step.key} className="flex items-center gap-3">
            <span
              className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                done ? 'bg-teal-500 text-dusk-950' : active ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-sky-400/50'
              }`}
            >
              {done ? <FiCheck size={12} /> : <span className={`h-1.5 w-1.5 rounded-full bg-current ${active ? 'animate-pulse' : ''}`} />}
            </span>
            <span className={`text-sm ${done || active ? 'text-sky-100' : 'text-sky-400/60'}`}>{step.label}</span>
          </div>
        );
      })}
    </Card>
  );
}

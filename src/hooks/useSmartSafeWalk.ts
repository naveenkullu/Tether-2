import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerEmergencyAlert, fetchRiskScore, type RiskContext } from '../services/safetyService';
import type { RiskScore, Coordinates, SafeWalkStatus } from '../types';

const DISTRESS_KEYWORDS = ['help', 'bachao', 'stop', 'no', 'emergency'];
const AUDIO_SPIKE_THRESHOLD = 0.15;   // RMS 0–1 scale: 0.15 ≈ sustained loud noise
const IMPACT_THRESHOLD = 25;          // m/s² (gravity alone ≈ 9.8; sharp impact > 25)
const ANOMALY_WINDOW_MS = 5000;       // Two anomalies within 5 s → suspicious
const ESCALATION_TIMEOUT_MS = 10000; // 10 s in suspicious without reset → emergency

/** All persistent sensor resources held in a single bag for atomic cleanup */
interface SensorResources {
  geoWatchId: number | null;
  audioCtx: AudioContext | null;
  analyser: AnalyserNode | null;
  stream: MediaStream | null;
  recognition: any;
  animFrame: number | null;
  motionHandler: ((e: DeviceMotionEvent) => void) | null;
  wakeLock: any;
  silentAudio: HTMLAudioElement | null;
}

function makeSensorResources(): SensorResources {
  return {
    geoWatchId: null,
    audioCtx: null,
    analyser: null,
    stream: null,
    recognition: null,
    animFrame: null,
    motionHandler: null,
    wakeLock: null,
    silentAudio: null,
  };
}

/** Atomically release all held sensor resources */
function releaseSensorResources(res: SensorResources) {
  if (res.geoWatchId !== null) {
    navigator.geolocation.clearWatch(res.geoWatchId);
    res.geoWatchId = null;
  }
  if (res.animFrame !== null) {
    cancelAnimationFrame(res.animFrame);
    res.animFrame = null;
  }
  if (res.silentAudio) {
    res.silentAudio.pause();
    res.silentAudio.src = '';
    res.silentAudio = null;
  }
  // Stop mic tracks first, then close the AudioContext
  if (res.stream) {
    res.stream.getTracks().forEach(t => t.stop());
    res.stream = null;
  }
  res.analyser = null;
  if (res.audioCtx && res.audioCtx.state !== 'closed') {
    res.audioCtx.close().catch(() => {});
    res.audioCtx = null;
  }
  if (res.recognition) {
    try { res.recognition.stop(); } catch (_) {}
    res.recognition = null;
  }
  if (res.motionHandler) {
    window.removeEventListener('devicemotion', res.motionHandler);
    res.motionHandler = null;
  }
  if (res.wakeLock) {
    res.wakeLock.release().catch(() => {});
    res.wakeLock = null;
  }
}

export function useSmartSafeWalk() {
  const [status, setStatus] = useState<SafeWalkStatus>('idle');
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);

  // Use a ref so callbacks always see current status without re-creating them
  const statusRef = useRef<SafeWalkStatus>('idle');
  const locationRef = useRef<Coordinates | null>(null);
  const speedRef = useRef(0);
  const stopsRef = useRef(0);
  const lastGeoUpdate = useRef(0);

  const anomalyTimestamps = useRef<number[]>([]);
  const escalationTimer = useRef<number | null>(null);
  const riskInterval = useRef<number | null>(null);
  const sensors = useRef<SensorResources>(makeSensorResources());

  // Keep statusRef in sync with state
  const updateStatus = useCallback((s: SafeWalkStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  /** ---------- Escalation Engine ---------- */
  const escalateToEmergency = useCallback(async () => {
    if (statusRef.current === 'emergency') return;
    updateStatus('emergency');
    const loc = locationRef.current ?? { lat: 28.6139, lng: 77.2090 };
    try {
      await triggerEmergencyAlert(loc);
    } catch (err) {
      console.error('[SafeWalk] Emergency alert failed:', err);
    }
  }, [updateStatus]);

  const recordAnomaly = useCallback((source: string) => {
    if (statusRef.current === 'emergency') return;

    console.warn(`[SafeWalk] Anomaly ← ${source}`);
    const now = Date.now();
    anomalyTimestamps.current = anomalyTimestamps.current.filter(t => now - t < ANOMALY_WINDOW_MS);
    anomalyTimestamps.current.push(now);

    if (anomalyTimestamps.current.length >= 2 && statusRef.current === 'monitoring') {
      updateStatus('suspicious');
      escalationTimer.current = window.setTimeout(() => {
        escalateToEmergency();
      }, ESCALATION_TIMEOUT_MS);
    }
  }, [updateStatus, escalateToEmergency]);

  /** ---------- Start sensors ---------- */
  const startSensors = useCallback(async () => {
    const res = sensors.current;

    // 1. GPS / Location
    if (navigator.geolocation) {
      res.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastGeoUpdate.current < 2000) return; // throttle 2s
          lastGeoUpdate.current = now;

          const { latitude, longitude, accuracy, speed } = pos.coords;
          locationRef.current = { lat: latitude, lng: longitude, accuracy };

          const kmh = (speed ?? 0) * 3.6;
          if (speedRef.current > 10 && kmh < 1) {
            stopsRef.current++;
            recordAnomaly('Sudden Stop');
          }
          speedRef.current = kmh;
        },
        (err) => console.error('[SafeWalk] GPS error', err),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    // 2. DeviceMotion
    const motionHandler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > IMPACT_THRESHOLD) recordAnomaly('Motion Impact');
    };
    res.motionHandler = motionHandler;
    window.addEventListener('devicemotion', motionHandler);

    // 3. Microphone / Audio (with graceful degradation)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      res.stream = stream;

      const AudioCtxClass = window.AudioContext ?? (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass() as AudioContext;
        res.audioCtx = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        res.analyser = analyser;

        audioCtx.createMediaStreamSource(stream).connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastSpike = 0;

        const tick = () => {
          // Stop ticking if sensors were released
          if (!res.analyser || !res.audioCtx || res.audioCtx.state === 'closed') return;

          analyser.getByteTimeDomainData(data);
          let sq = 0;
          for (let i = 0; i < data.length; i++) {
            const n = (data[i] / 128) - 1;
            sq += n * n;
          }
          const rms = Math.sqrt(sq / data.length);

          if (rms > AUDIO_SPIKE_THRESHOLD && Date.now() - lastSpike > 1500) {
            lastSpike = Date.now();
            recordAnomaly('Audio Spike (Loud Noise/Scream)');
          }

          res.animFrame = requestAnimationFrame(tick);
        };
        res.animFrame = requestAnimationFrame(tick);
      }

      // Layer 2: Speech Recognition (best-effort; silently skipped if unsupported)
      const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
          const text = (e.results[e.resultIndex][0]?.transcript ?? '').toLowerCase();
          if (DISTRESS_KEYWORDS.some(kw => text.includes(kw))) {
            recordAnomaly('Distress Keyword Detected');
            recordAnomaly('Distress Keyword (High Confidence Boost)');
          }
        };
        recognition.onerror = () => {}; // silence non-fatal errors
        recognition.start();
        res.recognition = recognition;
      }
    } catch (_) {
      console.warn('[SafeWalk] Microphone denied — running on location + motion only.');
    }

    // 4. Silent Audio Background Hack (Keeps JS execution thread alive on mobile lock screen)
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
      silentAudio.loop = true;
      await silentAudio.play();
      res.silentAudio = silentAudio;
    } catch (_) {
      console.warn('[SafeWalk] Silent audio background keep-alive failed or blocked by browser autoplay policy.');
    }

    // 5. Screen Wake Lock
    if ('wakeLock' in navigator) {
      try {
        res.wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch (_) {
        console.warn('[SafeWalk] Wake Lock unavailable.');
      }
    }
  }, [recordAnomaly]);

  /** ---------- Public Controls ---------- */
  const startWalk = useCallback(async () => {
    anomalyTimestamps.current = [];
    speedRef.current = 0;
    stopsRef.current = 0;
    lastGeoUpdate.current = 0;
    updateStatus('monitoring');
    await startSensors();

    // Start risk scoring — delay 5 s to avoid rate-limiting on button press
    riskInterval.current = window.setInterval(async () => {
      if (statusRef.current === 'idle') return;
      try {
        const ctx: RiskContext = {
          location: locationRef.current ?? undefined,
          currentSpeed: speedRef.current,
          recentStops: stopsRef.current,
          isOnUsualRoute: true,
        };
        const score = await fetchRiskScore(ctx);
        setRiskScore(score);
      } catch (_) {
        // Silently ignore API errors during walk (rate limits etc.)
      }
    }, 35000); // 35 s between calls to stay well within free tier limits
  }, [startSensors, updateStatus]);

  const stopWalk = useCallback(() => {
    if (escalationTimer.current) {
      clearTimeout(escalationTimer.current);
      escalationTimer.current = null;
    }
    if (riskInterval.current) {
      clearInterval(riskInterval.current);
      riskInterval.current = null;
    }
    releaseSensorResources(sensors.current);
    sensors.current = makeSensorResources(); // fresh bag for next walk
    anomalyTimestamps.current = [];
    updateStatus('idle');
    setRiskScore(null);
  }, [updateStatus]);

  const confirmSafe = useCallback(() => {
    // User manually confirms they are safe — cancel escalation
    if (escalationTimer.current) {
      clearTimeout(escalationTimer.current);
      escalationTimer.current = null;
    }
    anomalyTimestamps.current = [];
    updateStatus('monitoring');
  }, [updateStatus]);

  // Global unmount cleanup
  useEffect(() => {
    return () => {
      if (escalationTimer.current) clearTimeout(escalationTimer.current);
      if (riskInterval.current) clearInterval(riskInterval.current);
      releaseSensorResources(sensors.current);
    };
  }, []);

  return { status, riskScore, startWalk, stopWalk, confirmSafe };
}

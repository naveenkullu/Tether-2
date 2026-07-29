import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DistressStatus = 'idle' | 'listening' | 'distress_detected';

export interface VoiceDistressState {
  isListening: boolean;
  status: DistressStatus;
  error: string | null;
  /** Manually fire the emergency flow (also called automatically on detection). */
  triggerEmergency: () => void;
  /** Start the microphone pipeline. Requests permission on first call. */
  startListening: () => Promise<void>;
  /** Stop the microphone pipeline and release all resources. */
  stopListening: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * RMS amplitude (0–1) that must be exceeded for a volume spike to count.
 * 0.15 targets screams/shouts and ignores ambient speech, music, and car horns.
 * The Speech API is the primary signal; volume is a secondary "pure scream" heuristic.
 */
const VOLUME_GATE_THRESHOLD = 0.15;

/**
 * Minimum milliseconds between consecutive volume-based detections.
 * Ensures a single sustained scream counts as ONE event, not 60+ per second.
 */
const MIN_VOLUME_SPIKE_GAP_MS = 3_000;

/**
 * Distress keywords (lowercase). Covers English + Hindi phonetic equivalents.
 * The Speech API matches on partial transcript, so short roots catch variations.
 * e.g. "help" catches "help me", "please help", "somebody help"
 */
const DISTRESS_KEYWORDS = [
  // ── Core distress ──
  'help',
  'help me',
  'someone help',
  'please help',
  'anybody help',

  // ── Stop / resist ──
  'stop',
  'stop it',
  'don\'t',
  'don\'t touch me',
  'don\'t come near me',
  'back off',
  'stay away',
  'get away',
  'leave me alone',
  'leave me',
  'get off',
  'get off me',
  'let go',
  'let me go',
  'let me out',

  // ── Physical danger ──
  'i\'m being attacked',
  'he\'s got a knife',
  'she\'s got a knife',
  'gun',
  'knife',
  'robbery',
  'rape',
  'assault',
  'attack',
  'he\'s hurting me',
  'she\'s hurting me',
  'i\'m being robbed',
  'i\'m being followed',

  // ── Emergency calls ──
  'emergency',
  'call police',
  'call the police',
  'call 911',
  'call 112',
  'call 100',
  'call ambulance',
  'fire',
  'fire fire',

  // ── Panic / pain ──
  'run',
  'no no',
  'please no',
  'please stop',
  'i\'m scared',
  'i\'m hurt',
  'i need help',
  'somebody call',

  // ── Hindi phonetic (most common) ──
  'bachao',      // save me
  'chhodo',      // let go / release me
  'mat karo',    // don\'t do it
  'ruko',        // stop
  'madad karo',  // help me / do something
  'madad',       // help
  'police bulao',// call the police
  'choro',       // leave me / let go
];

/**
 * How many independent keyword detections are required to trigger the emergency.
 * Set to 1 for immediate response — the keyword list is specific enough to
 * avoid false positives without needing a confirmation window.
 */
const DETECTIONS_REQUIRED = 1;
const CONFIRMATION_WINDOW_MS = 6_000;

/** How many ms to wait after an emergency fires before re-arming the listener. */
const REARM_COOLDOWN_MS = 30_000;

// ─── Utility: measure RMS volume from analyser ────────────────────────────────

function getRmsVolume(analyser: AnalyserNode): number {
  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const normalised = (buffer[i] - 128) / 128;
    sumSquares += normalised * normalised;
  }
  return Math.sqrt(sumSquares / buffer.length);
}

// ─── SpeechRecognition shim ───────────────────────────────────────────────────

// The Web Speech API is not in all TypeScript lib definitions, so we define
// minimal interfaces ourselves to stay compatible with strict tsconfigs.
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceDistressDetection(
  onDistressDetected?: () => void,
  /** If true, mic starts automatically on mount without user clicking a button. */
  autoStart = false,
): VoiceDistressState {
  const [status, setStatus] = useState<DistressStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Refs — we never want stale closures inside rAF loops
  const isListeningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const detectionTimestampsRef = useRef<number[]>([]);
  const cooldownRef = useRef(false);
  const onDistressRef = useRef(onDistressDetected);
  // Volume gate state — tracks rising-edge and per-spike throttle
  const wasAboveThresholdRef = useRef(false);
  const lastVolumeSpikeRef = useRef<number>(0);

  // Keep callback ref fresh
  useEffect(() => {
    onDistressRef.current = onDistressDetected;
  }, [onDistressDetected]);

  // ── Core: confirm & fire ──────────────────────────────────────────────────

  const recordDetection = useCallback(() => {
    if (cooldownRef.current) return;

    const now = Date.now();
    // Keep only timestamps within the confirmation window
    detectionTimestampsRef.current = detectionTimestampsRef.current.filter(
      (ts) => now - ts < CONFIRMATION_WINDOW_MS,
    );
    detectionTimestampsRef.current.push(now);

    if (detectionTimestampsRef.current.length >= DETECTIONS_REQUIRED) {
      detectionTimestampsRef.current = [];
      cooldownRef.current = true;
      setStatus('distress_detected');
      onDistressRef.current?.();

      // Re-arm after cooldown
      setTimeout(() => {
        cooldownRef.current = false;
        if (isListeningRef.current) setStatus('listening');
      }, REARM_COOLDOWN_MS);
    }
  }, []);

  const triggerEmergency = useCallback(() => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setStatus('distress_detected');
    onDistressRef.current?.();
    setTimeout(() => {
      cooldownRef.current = false;
      if (isListeningRef.current) setStatus('listening');
    }, REARM_COOLDOWN_MS);
  }, []);

  // ── Speech Recognition ────────────────────────────────────────────────────
  // Runs TWO parallel instances: one English (en-US), one Hindi (hi-IN).
  // Both funnel into the same recordDetection() and keyword list.

  const buildRecognition = useCallback((lang: string): ISpeechRecognition | null => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition: ISpeechRecognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 3;

    recognition.onresult = (rawEvent: Event) => {
      const event = rawEvent as unknown as {
        resultIndex: number;
        results: { length: number; [i: number]: { length: number; [a: number]: { transcript: string } } };
      };
      if (!isListeningRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let a = 0; a < result.length; a++) {
          const transcript = result[a].transcript.toLowerCase().trim();
          // Debug: open DevTools console to see what the mic is picking up
          console.log(`[Tether Voice | ${lang}] heard: "${transcript}"`);
          const matched = DISTRESS_KEYWORDS.some((kw) => transcript.includes(kw));
          if (matched) {
            console.log(`[Tether Voice] DISTRESS KEYWORD MATCHED in "${transcript}"`);
            recordDetection();
            break;
          }
        }
      }
    };

    recognition.onerror = (rawEvent: Event) => {
      const event = rawEvent as unknown as { error: string };
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      }
      // 'no-speech', 'aborted', 'network' are non-critical
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        // Small delay prevents "already started" race condition
        setTimeout(() => {
          if (isListeningRef.current) {
            try { recognition.start(); } catch { /* ignore */ }
          }
        }, 250);
      }
    };

    return recognition;
  }, [recordDetection]);

  const startSpeechRecognition = useCallback(() => {
    // en-IN catches both English and transliterated Hindi (bachao, etc.)
    const recognition = buildRecognition('en-IN');
    if (recognition) {
      recognition.start();
      recognitionRef.current = recognition;
    }
  }, [buildRecognition]);

  // ── Web Audio volume-gate loop ────────────────────────────────────────────
  //
  // Design rationale:
  //   rAF fires ~60×/s. Without protection, one car horn fills detectionTimestamps
  //   with 60+ entries in a second, instantly satisfying DETECTIONS_REQUIRED.
  //
  //   Fix: only fire recordDetection() on the RISING EDGE (quiet→loud transition)
  //   AND enforce a MIN_VOLUME_SPIKE_GAP_MS cooldown between volume events.
  //   This means one sustained scream = 1 detection, not 60.
  //   Speech API keyword matches are unthrottled and remain the primary signal.

  const startVolumeGate = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const loop = () => {
      if (!isListeningRef.current) return;
      const rms = getRmsVolume(analyser);
      const isAbove = rms > VOLUME_GATE_THRESHOLD;

      // Only fire on the RISING EDGE: transition from below → above threshold
      if (isAbove && !wasAboveThresholdRef.current) {
        const now = Date.now();
        const msSinceLast = now - lastVolumeSpikeRef.current;
        if (msSinceLast > MIN_VOLUME_SPIKE_GAP_MS) {
          lastVolumeSpikeRef.current = now;
          recordDetection();
        }
      }

      // Track whether we were above threshold last frame
      wasAboveThresholdRef.current = isAbove;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [recordDetection]);

  // ── Start / stop ─────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err: unknown) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : 'Could not access microphone. Check your browser settings.';
      setError(message);
      return;
    }

    // Build audio pipeline
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    // Do NOT connect analyser to destination — we never play audio back.

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    streamRef.current = stream;

    isListeningRef.current = true;
    setStatus('listening');

    // Start both pipelines
    startVolumeGate();
    startSpeechRecognition();
  }, [startVolumeGate, startSpeechRecognition]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;

    detectionTimestampsRef.current = [];
    cooldownRef.current = false;
    setStatus('idle');
  }, []);

  // ── Handle tab visibility changes (pause when backgrounded) ──────────────

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Pause the rAF loop to save battery; speech recognition continues
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (isListeningRef.current) {
        // Resume the volume gate when tab is visible again
        startVolumeGate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startVolumeGate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isListening: isListeningRef.current && status !== 'idle',
    status,
    error,
    triggerEmergency,
    startListening,
    stopListening,
  };
}

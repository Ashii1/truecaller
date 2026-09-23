/**
 * Synthesizes telephone audio effects using Web Audio API:
 * - Realistic North American dual-tone multi-frequency phone ring (440Hz + 480Hz)
 * - Call disconnect / hangup tone
 * - Alert chime
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface RingController {
  stop: () => void;
}

export function playPhoneRing(): RingController {
  try {
    const ctx = getAudioContext();
    let isRunning = true;
    let timerId: number | null = null;
    const activeNodes: (OscillatorNode | GainNode)[] = [];

    const playBurst = () => {
      if (!isRunning) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = 440; // Standard US ringtone frequency 1
      osc2.frequency.value = 480; // Standard US ringtone frequency 2

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);

      activeNodes.push(osc1, osc2, gain);

      // Repeat after 4 seconds (standard 2s ring, 4s silence cycle)
      timerId = window.setTimeout(() => {
        if (isRunning) playBurst();
      }, 4000);
    };

    playBurst();

    return {
      stop: () => {
        isRunning = false;
        if (timerId) clearTimeout(timerId);
        activeNodes.forEach((node) => {
          try {
            if ('stop' in node) (node as OscillatorNode).stop();
            node.disconnect();
          } catch {
            // ignore if already stopped
          }
        });
      },
    };
  } catch {
    return { stop: () => {} };
  }
}

export function playCallCancelledTone() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.setValueAtTime(620, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Web audio blocked or unsupported
  }
}

export function playSpamAlertChime() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
}

// DTMF (Dual-Tone Multi-Frequency) frequency matrix for authentic keypad sounds
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

export function playDtmfTone(key: string, durationMs = 120) {
  try {
    const freqs = DTMF_FREQUENCIES[key] || [941, 1336];
    const ctx = getAudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];

    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + dur);
    osc2.stop(ctx.currentTime + dur);
  } catch {
    // AudioContext blocked or not supported
  }
}

export function playCallConnectingTone() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(350, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore
  }
}

export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore
  }
}

export function triggerHapticFeedback(pattern: number | number[] = 25) {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported
  }
}

export function triggerCallConnectedHaptic() {
  triggerHapticFeedback([180, 90, 220]);
}

export interface IncomingCallAlertController {
  stop: () => void;
  silence: () => void;
}

export function startIncomingCallAlerts(options: {
  ringerMode?: 'NORMAL' | 'VIBRATE' | 'SILENT';
  playRingtone?: boolean;
}): IncomingCallAlertController {
  const mode = options.ringerMode || 'NORMAL';
  const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidTelecomBridge);
  // On native Android, VigilShieldInCallService handles the phone's actual default ringtone and vibration.
  // Web Audio simulated tone is only for browser preview.
  const shouldPlayAudio = !isAndroid && mode === 'NORMAL' && options.playRingtone !== false;
  const shouldVibrate = !isAndroid && (mode === 'NORMAL' || mode === 'VIBRATE');

  let ringController: RingController | null = null;
  let vibrateInterval: number | null = null;
  let isSilenced = false;

  // 1. Audio ringtone
  if (shouldPlayAudio) {
    ringController = playPhoneRing();
  }

  // 2. Continuous vibration cadence for incoming calls: vibrate 800ms, pause 400ms, vibrate 800ms, pause 1500ms
  if (shouldVibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
    const doVibrate = () => {
      if (isSilenced) return;
      try {
        navigator.vibrate([800, 400, 800]);
      } catch {
        // ignore
      }
    };
    doVibrate();
    vibrateInterval = window.setInterval(doVibrate, 3500);
  }

  const stopAll = () => {
    isSilenced = true;
    if (ringController) {
      ringController.stop();
      ringController = null;
    }
    if (vibrateInterval) {
      clearInterval(vibrateInterval);
      vibrateInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    }
  };

  return {
    stop: stopAll,
    silence: stopAll,
  };
}


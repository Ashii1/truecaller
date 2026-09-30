/**
 * Synthesizes telephone audio effects using Web Audio API:
 * - Realistic North American dual-tone multi-frequency phone ring (440Hz + 480Hz)
 * - Call disconnect / hangup tone
 * - Alert chime
 */

let audioCtx: AudioContext | null = null;
let cachedRingtoneBlobUrl = '';

export function getAudioContext(): AudioContext {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx!;
}

// Global unlock listener: ensures AudioContext is unblocked on the very first user interaction
if (typeof window !== 'undefined') {
  const unlockAudioContext = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('click', unlockAudioContext, { passive: true });
  window.addEventListener('touchstart', unlockAudioContext, { passive: true });
  window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
  window.addEventListener('keydown', unlockAudioContext, { passive: true });
}

// Generate an authentic default smartphone melodic ringtone WAV audio Blob URL
// Features an iconic, melodic dual-bell marimba ring pattern (classic default smartphone ringtone)
function createDefaultRingtoneBlobUrl(): string {
  try {
    if (cachedRingtoneBlobUrl) return cachedRingtoneBlobUrl;

    const sampleRate = 24000;
    const durationSec = 4.2; // 3.2s melodic phrase + 1.0s natural phone cadence pause
    const totalSamples = Math.floor(sampleRate * durationSec);
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true); // chunk size
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, numChannels, true); // channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, byteRate, true); // byte rate
    view.setUint16(32, blockAlign, true); // block align
    view.setUint16(34, 16, true); // bits per sample

    // data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true); // data size

    // Default smartphone ringtone notes: [freq, startTimeSec, durationSec, volume]
    // Classic marimba/bell melody in E major:
    const notes: [number, number, number, number][] = [
      // Phrase 1:
      [659.25, 0.00, 0.16, 0.70], // E5
      [830.61, 0.15, 0.16, 0.75], // G#5
      [987.77, 0.30, 0.16, 0.80], // B5
      [1318.51, 0.45, 0.22, 0.90], // E6
      [1244.51, 0.68, 0.18, 0.80], // D#6
      [987.77, 0.88, 0.18, 0.75],  // B5
      [1108.73, 1.08, 0.20, 0.80], // C#6
      [1318.51, 1.30, 0.50, 0.95], // E6 long bell chime
      
      // Phrase 2 (counter-melody):
      [739.99, 1.85, 0.16, 0.70],  // F#5
      [880.00, 2.00, 0.16, 0.75],  // A5
      [1108.73, 2.15, 0.16, 0.80], // C#6
      [1479.98, 2.30, 0.24, 0.95], // F#6
      [1318.51, 2.55, 0.18, 0.85], // E6
      [1108.73, 2.75, 0.18, 0.80], // C#6
      [987.77, 2.95, 0.20, 0.75],  // B5
      [1318.51, 3.15, 0.55, 1.00], // E6 chord ring
    ];

    const samples = new Float32Array(totalSamples);

    for (const [freq, startSec, durSec, gain] of notes) {
      const startIdx = Math.floor(startSec * sampleRate);
      const endIdx = Math.min(totalSamples, Math.floor((startSec + durSec + 0.18) * sampleRate));
      const totalNoteSamples = Math.max(1, endIdx - startIdx);

      for (let i = startIdx; i < endIdx; i++) {
        const t = (i - startIdx) / sampleRate;
        const noteProgress = (i - startIdx) / totalNoteSamples;
        // Percussive bell/marimba decay envelope
        const env = Math.exp(-noteProgress * 4.0) * (t < 0.008 ? t / 0.008 : 1.0);
        // Fundamental sine + triangle overtone (warm bell body) + crystal chime 2x harmonic
        const s1 = Math.sin(2 * Math.PI * freq * t);
        const s2 = 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
        const s3 = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);
        samples[i] += (s1 + s2 + s3) * env * gain * 0.45;
      }
    }

    // Write 16-bit PCM samples with gentle soft clipping
    let offset = 44;
    for (let i = 0; i < totalSamples; i++) {
      let s = samples[i];
      if (s > 0.98) s = 0.98;
      if (s < -0.98) s = -0.98;
      const intSample = Math.floor(s * 32767);
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedRingtoneBlobUrl = URL.createObjectURL(blob);
    return cachedRingtoneBlobUrl;
  } catch {
    return '';
  }
}

interface RingController {
  stop: () => void;
}

export function playPhoneRing(): RingController {
  try {
    let isRunning = true;
    let timerId: number | null = null;
    const activeNodes: (OscillatorNode | GainNode | BiquadFilterNode)[] = [];
    let audioElem: HTMLAudioElement | null = null;
    let webAudioPlaying = false;

    // 1. Live Web Audio Synthesis for crystal-clear real-time acoustics
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }

    // Ringtone Melody notes: [freq, startTimeSec, durationSec, volume]
    const melody: [number, number, number, number][] = [
      // Motif 1:
      [659.25, 0.00, 0.16, 0.50], // E5
      [830.61, 0.15, 0.16, 0.52], // G#5
      [987.77, 0.30, 0.16, 0.55], // B5
      [1318.51, 0.45, 0.22, 0.65], // E6
      [1244.51, 0.68, 0.18, 0.58], // D#6
      [987.77, 0.88, 0.18, 0.55],  // B5
      [1108.73, 1.08, 0.20, 0.58], // C#6
      [1318.51, 1.30, 0.50, 0.70], // E6 long bell chime
      
      // Motif 2:
      [739.99, 1.85, 0.16, 0.50],  // F#5
      [880.00, 2.00, 0.16, 0.55],  // A5
      [1108.73, 2.15, 0.16, 0.58], // C#6
      [1479.98, 2.30, 0.24, 0.70], // F#6
      [1318.51, 2.55, 0.18, 0.65], // E6
      [1108.73, 2.75, 0.18, 0.58], // C#6
      [987.77, 2.95, 0.20, 0.55],  // B5
      [1318.51, 3.15, 0.55, 0.75], // E6 chord ring
    ];

    const playMelodicBurst = () => {
      if (!isRunning || !ctx || ctx.state !== 'running') return;
      webAudioPlaying = true;

      // Stop fallback HTML5 audio if live Web Audio is sounding
      if (audioElem && !audioElem.paused) {
        try {
          audioElem.pause();
        } catch {}
      }

      const now = ctx.currentTime + 0.05;

      // Filter for warm smartphone speaker acoustics
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, now);
      filter.connect(ctx.destination);
      activeNodes.push(filter);

      for (const [freq, startOffset, dur, vol] of melody) {
        if (!isRunning) break;
        const noteStart = now + startOffset;
        const noteEnd = noteStart + dur + 0.18;

        const osc = ctx.createOscillator();
        const oscHarmonic = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        oscHarmonic.type = 'sine';
        oscHarmonic.frequency.setValueAtTime(freq * 2, noteStart);

        // Percussive bell marimba envelope: rapid 8ms attack, natural decay
        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.linearRampToValueAtTime(vol, noteStart + 0.012);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        osc.connect(noteGain);
        oscHarmonic.connect(noteGain);
        noteGain.connect(filter);

        osc.start(noteStart);
        oscHarmonic.start(noteStart);
        osc.stop(noteEnd);
        oscHarmonic.stop(noteEnd);

        activeNodes.push(osc, oscHarmonic, noteGain);
      }

      // Schedule next ring cycle (3.5s melody + 1.0s cadence pause = 4.5s cadence)
      timerId = window.setTimeout(() => {
        if (isRunning) playMelodicBurst();
      }, 4500);
    };

    // 2. Play using HTML5 Audio (Universal mobile & browser autoplay fallback)
    try {
      const ringtoneUrl = createDefaultRingtoneBlobUrl();
      if (ringtoneUrl) {
        audioElem = new Audio(ringtoneUrl);
        audioElem.loop = true;
        audioElem.volume = 1.0;
        const playPromise = audioElem.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay prevented immediate playback; will unlock on user interaction
          });
        }
      }
    } catch {}

    // If Web Audio is already active, prefer crystal-clear synth
    if (ctx && ctx.state === 'running') {
      playMelodicBurst();
    } else if (ctx) {
      ctx.resume().then(() => {
        if (isRunning && !webAudioPlaying) playMelodicBurst();
      }).catch(() => {});
    }

    // Interaction handler: unblocks audio on ANY user click/touch
    const handleUserInteraction = () => {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (isRunning && !webAudioPlaying) playMelodicBurst();
        }).catch(() => {});
      }
      if (audioElem && audioElem.paused && isRunning && !webAudioPlaying) {
        audioElem.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleUserInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true, passive: true });

    return {
      stop: () => {
        isRunning = false;
        if (timerId) clearTimeout(timerId);
        window.removeEventListener('click', handleUserInteraction);
        window.removeEventListener('touchstart', handleUserInteraction);
        window.removeEventListener('pointerdown', handleUserInteraction);

        // Stop HTML5 audio element
        if (audioElem) {
          try {
            audioElem.pause();
            audioElem.currentTime = 0;
          } catch {}
          audioElem = null;
        }

        // Stop live audio nodes
        activeNodes.forEach((node) => {
          try {
            if ('stop' in node) (node as OscillatorNode).stop();
            node.disconnect();
          } catch {}
        });
        activeNodes.length = 0;
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
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported
  }
  try {
    if (typeof window !== 'undefined' && (window as any).AndroidTelecomBridge?.vibrate) {
      const ms = Array.isArray(pattern) ? (pattern[pattern.length - 1] || 25) : pattern;
      (window as any).AndroidTelecomBridge.vibrate(ms);
    }
  } catch {
    // ignore
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
  const shouldPlayAudio = mode === 'NORMAL' && options.playRingtone !== false;
  const shouldVibrate = mode === 'NORMAL' || mode === 'VIBRATE';

  let ringController: RingController | null = null;
  let vibrateInterval: number | null = null;
  let isSilenced = false;

  // 1. Audio ringtone: plays the authentic default smartphone melodic ringtone
  if (shouldPlayAudio) {
    ringController = playPhoneRing();
  }

  // 2. Continuous vibration cadence for incoming calls: vibrate 800ms, pause 400ms, vibrate 800ms
  if (shouldVibrate) {
    const doVibrate = () => {
      if (isSilenced) return;
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
          navigator.vibrate([800, 400, 800]);
        }
      } catch {}
      try {
        if (typeof window !== 'undefined' && (window as any).AndroidTelecomBridge?.vibrate) {
          (window as any).AndroidTelecomBridge.vibrate(800);
        }
      } catch {}
    };
    doVibrate();
    vibrateInterval = window.setInterval(doVibrate, 3200);
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
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidTelecomBridge?.silenceRinger) {
        (window as any).AndroidTelecomBridge.silenceRinger();
      }
    } catch {}
  };

  return {
    stop: stopAll,
    silence: stopAll,
  };
}


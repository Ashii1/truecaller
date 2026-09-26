import { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Grid, 
  UserPlus, 
  Pause, 
  Play, 
  Disc, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Radio, 
  Check, 
  X,
  AlertCircle,
  Folder,
  StickyNote,
  Copy,
  Trash2,
  PhoneCall,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { ActiveCallSession, CallShieldDirectoryProfile, CallRecordingItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playDtmfTone, triggerHapticFeedback, playNotificationChime, triggerCallConnectedHaptic } from '../utils/audioAlerts';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService } from '../services/callRecordingService';

interface ActiveCallModalProps {
  session: ActiveCallSession | null;
  onEndCall: (recordingItem?: CallRecordingItem | null, callDuration?: number, callerNote?: string) => void;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onAddCall?: (number: string) => void;
  powerButtonEndsCall?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
}

export default function ActiveCallModal({
  session,
  onEndCall,
  lookupProfile,
  onAddCall,
  powerButtonEndsCall = false,
  isMinimized,
  onToggleMinimize,
}: ActiveCallModalProps) {
  const { t } = useI18n();
  const [duration, setDuration] = useState(session?.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(session?.isMuted || false);
  const [isSpeaker, setIsSpeaker] = useState(session?.isSpeaker || false);
  const [isOnHold, setIsOnHold] = useState(session?.isHeld || false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingWarningPlayed, setRecordingWarningPlayed] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [keypadDigits, setKeypadDigits] = useState('');
  const [showAddCallPrompt, setShowAddCallPrompt] = useState(false);
  const [secondCallInput, setSecondCallInput] = useState('');
  const [internalMinimized, setInternalMinimized] = useState(false);

  // Call is considered attended if status is CONNECTED/MUTED/HELD or duration has elapsed
  const isAttended = session?.status === 'CONNECTED' || session?.status === 'MUTED' || session?.status === 'HELD' || duration > 0;
  const prevAttendedRef = useRef(isAttended);

  // When call status becomes attended / answered, vibrate the phone and bring call screen to front
  useEffect(() => {
    if (!prevAttendedRef.current && isAttended) {
      triggerCallConnectedHaptic();
      telecomBridge.vibratePhone([180, 90, 220]);
      setInternalMinimized(false);
      onToggleMinimize?.(false);
    }
    prevAttendedRef.current = isAttended;
  }, [isAttended, onToggleMinimize]);

  // Sync duration if session provides connected duration
  useEffect(() => {
    if (session?.durationSeconds && session.durationSeconds > duration) {
      setDuration(session.durationSeconds);
    }
  }, [session?.durationSeconds]);

  const isCallMinimized = isMinimized !== undefined ? isMinimized : internalMinimized;
  const setCallMinimized = (val: boolean) => {
    setInternalMinimized(val);
    onToggleMinimize?.(val);
  };

  // In-Call Private Notes state for jotting down details during the live call
  const [showInCallNotes, setShowInCallNotes] = useState(false);
  const [callerNote, setCallerNote] = useState('');
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Reset internal minimized state if a new call starts
  useEffect(() => {
    if (session?.id) {
      setInternalMinimized(false);
      onToggleMinimize?.(false);
    }
  }, [session?.id, onToggleMinimize]);

  // System notification when ongoing call is minimized so user can easily return
  useEffect(() => {
    if (!session || !isCallMinimized) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const durStr = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;
        const notif = new Notification(`Ongoing Call: ${session.name || formatPhoneNumber(session.number)}`, {
          body: !isAttended ? 'Calling...' : `${formatPhoneNumber(session.number)} • ${durStr} • Tap to view call screen`,
          tag: 'vigilshield-active-call',
          icon: '/favicon.ico',
        });
        notif.onclick = () => {
          window.focus();
          setCallMinimized(false);
        };
      } catch {}
    }
  }, [session, isCallMinimized, Math.floor(duration / 5), isAttended]);

  // Load existing notes for this caller on session start
  useEffect(() => {
    if (!session?.number) return;
    const cleanKey = session.number.replace(/\D/g, '');
    try {
      const raw = localStorage.getItem('vigilshield_call_notes_v1');
      if (raw) {
        const obj = JSON.parse(raw);
        const existing = obj[cleanKey] || session.notes || '';
        setCallerNote(existing);
      } else if (session.notes) {
        setCallerNote(session.notes);
      }
    } catch {
      if (session.notes) setCallerNote(session.notes);
    }
  }, [session?.number, session?.notes]);

  // Call timer increment ONLY when attended!
  useEffect(() => {
    if (!session || !isAttended) return;
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [session, isAttended]);

  // Recording timer increment
  useEffect(() => {
    if (!isRecording) {
      setRecordingDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const saveNoteLocally = (text: string) => {
    if (!session?.number) return;
    const cleanKey = session.number.replace(/\D/g, '');
    try {
      const raw = localStorage.getItem('vigilshield_call_notes_v1') || '{}';
      const obj = JSON.parse(raw);
      if (text.trim()) {
        obj[cleanKey] = text.trim();
      } else {
        delete obj[cleanKey];
      }
      localStorage.setItem('vigilshield_call_notes_v1', JSON.stringify(obj));
      setNoteSavedNotice(true);
      setTimeout(() => setNoteSavedNotice(false), 1600);
    } catch {
      // Storage fallback
    }
  };

  const handleNoteChange = (text: string) => {
    setCallerNote(text);
    saveNoteLocally(text);
  };

  const handleInsertTag = (tag: string) => {
    const updated = callerNote ? `${callerNote.trim()}\n${tag}` : tag;
    setCallerNote(updated);
    saveNoteLocally(updated);
    if (notesInputRef.current) {
      notesInputRef.current.focus();
    }
  };

  const handleCopyNote = () => {
    if (!callerNote.trim()) return;
    try {
      navigator.clipboard?.writeText(callerNote);
      triggerHapticFeedback(20);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {}
  };

  const handleClearNote = () => {
    if (window.confirm('Clear your in-call note?')) {
      setCallerNote('');
      saveNoteLocally('');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeypadPress = (digit: string) => {
    playDtmfTone(digit);
    triggerHapticFeedback(25);
    setKeypadDigits((prev) => prev + digit);
    if (session?.id) {
      telecomBridge.sendDtmfTone(session.id, digit);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    triggerHapticFeedback(30);
    telecomBridge.setMuted(next);
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    triggerHapticFeedback(30);
    telecomBridge.setSpeakerRoute(next);
  };

  const handleToggleHold = () => {
    const next = !isOnHold;
    setIsOnHold(next);
    triggerHapticFeedback(30);
    if (session?.id) {
      if (next) {
        telecomBridge.holdCall(session.id);
      } else {
        telecomBridge.unholdCall(session.id);
      }
    }
  };

  const handleSwapCalls = () => {
    triggerHapticFeedback(25);
    telecomBridge.swapCalls();
  };

  const handleMergeCalls = () => {
    triggerHapticFeedback(25);
    telecomBridge.mergeCalls();
  };

  const handleExecuteAddCall = () => {
    if (!secondCallInput.trim()) return;
    triggerHapticFeedback(30);
    if (onAddCall) {
      onAddCall(secondCallInput.trim());
    } else {
      telecomBridge.placeRealCall(secondCallInput.trim());
    }
    setShowAddCallPrompt(false);
    setSecondCallInput('');
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingWarningPlayed(true);
      playNotificationChime();
      triggerHapticFeedback(40);
      await callRecordingService.startRecording(
        session.number,
        session.name || 'Unknown Caller',
        session.id
      );
      setTimeout(() => setRecordingWarningPlayed(false), 3500);
    } else {
      setIsRecording(false);
      triggerHapticFeedback(30);
      const savedRec = await callRecordingService.stopRecording();
      if (savedRec) {
        setSavedNotice(savedRec.fileName);
        playNotificationChime();
        setTimeout(() => setSavedNotice(null), 4000);
      }
    }
  };

  const handleEndCallAction = async () => {
    triggerHapticFeedback(50);
    let recordingItem: CallRecordingItem | null = null;
    if (isRecording) {
      setIsRecording(false);
      recordingItem = await callRecordingService.stopRecording();
    }
    if (callerNote.trim()) {
      saveNoteLocally(callerNote);
    }
    onEndCall(recordingItem, durationRef.current, callerNote.trim() || undefined);
  };

  // Hardware Power Key Interception to End Active Call
  useEffect(() => {
    if (!session || !powerButtonEndsCall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isPowerKey =
        e.key === 'Power' ||
        e.code === 'Power' ||
        e.key === 'EndCall' ||
        e.code === 'EndCall' ||
        (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'End'));

      if (isPowerKey) {
        e.preventDefault();
        handleEndCallAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [session, powerButtonEndsCall]);

  if (!session) return null;

  const callerProfile = lookupProfile(session.number);
  const callerDisplayName = session.name || callerProfile?.name || t('unknown_caller');
  const formattedNumber = formatPhoneNumber(session.number);
  const initials = callerDisplayName
    ? callerDisplayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '👤';

  // =========================================================================
  // 1. MINIMIZED ONGOING CALL NOTIFICATION CARD (Floating at top of viewport)
  // =========================================================================
  if (isCallMinimized) {
    return (
      <div
        id="ongoing-call-minimized-notification"
        onClick={() => setCallMinimized(false)}
        className="fixed top-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[60] rounded-2xl border border-emerald-500/40 bg-[#070b13]/98 p-3.5 text-white shadow-2xl shadow-black/95 backdrop-blur-2xl cursor-pointer select-none transition-all duration-200 animate-spring-down animate-ongoing-glow hover:border-emerald-400/60 active:scale-[0.99]"
        title="Tap to expand fullscreen call"
        role="button"
        tabIndex={0}
      >
        {/* Top Bar: Live Status & Equalizer & Elapsed Duration */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              {isOnHold ? t('on_hold') : !isAttended ? 'Calling...' : 'Call In Progress'}
            </span>
            {/* Live Audio Equalizer Waveform */}
            {isAttended && !isOnHold && (
              <div className="flex items-center gap-0.5 h-3 ml-1" title="Audio connected">
                <span className="w-1 rounded bg-emerald-400 animate-wave-1" />
                <span className="w-1 rounded bg-emerald-400 animate-wave-2" />
                <span className="w-1 rounded bg-emerald-400 animate-wave-3" />
                <span className="w-1 rounded bg-emerald-400 animate-wave-4" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              {!isAttended ? 'Calling...' : formatTimer(duration)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCallMinimized(false);
              }}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-slate-300 hover:text-white transition"
              title="Expand call to fullscreen"
              aria-label="Expand call"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Middle Row: Caller Identity (Name & Number/Calling) & Quick Controls */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`grid h-10 w-10 place-items-center rounded-full bg-slate-800 border text-sm font-black text-white shrink-0 shadow ${!isAttended ? 'border-emerald-500/60 ring-2 ring-emerald-500/30 animate-pulse' : 'border-white/15'}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-extrabold text-white truncate">
                  {callerDisplayName}
                </h4>
                {session.isVerifiedBusiness && (
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {!isAttended ? (
                  <span className="text-xs font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                    <PhoneCall className="w-3 h-3 animate-bounce" />
                    Calling...
                  </span>
                ) : (
                  <span className="font-mono text-xs font-bold text-cyan-300 truncate bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                    {formattedNumber}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-medium">{session.sim || 'SIM 1'}</span>
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border transition active:scale-90 ${
                isMuted
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleToggleSpeaker}
              className={`p-2 rounded-xl border transition active:scale-90 ${
                isSpeaker
                  ? 'border-blue-500/50 bg-blue-500/20 text-blue-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title={isSpeaker ? 'Switch to earpiece' : 'Switch to speaker'}
              aria-label={isSpeaker ? 'Switch to earpiece' : 'Switch to speaker'}
            >
              {isSpeaker ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleEndCallAction}
              className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/50 hover:bg-rose-500 active:scale-90 transition-transform"
              title="End call"
              aria-label="End call"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. FULLSCREEN ACTIVE CALL VIEW
  // =========================================================================
  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Phone Handset Container with System-Level High Contrast Styling */}
      <div className="w-full sm:max-w-md bg-[#070a10] sm:border sm:border-white/15 sm:rounded-[36px] rounded-t-[32px] p-5 sm:p-6 shadow-2xl text-white flex flex-col justify-between relative overflow-hidden max-h-[96vh] sm:max-h-[880px] overflow-y-auto">
        
        {/* Top Header: System Status & Hardware Indicators */}
        <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10 select-none">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-bold uppercase tracking-wider text-emerald-400 text-[11px]">
              {isOnHold ? t('call_held') : !isAttended ? t('call_dialing') : t('call_connected')}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200 font-semibold text-[11px] border border-white/10">
              {session.sim || 'SIM 1'}
            </span>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>{isAttended ? 'HD 48kHz' : 'Cellular'}</span>
            </span>
            <button
              type="button"
              onClick={() => setCallMinimized(true)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-semibold"
              title="Minimize call to notification bar"
              aria-label="Minimize call"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Minimize</span>
            </button>
          </div>
        </div>

        {/* Middle Stage: Caller Identity & Calling / Number Display */}
        <div className="py-4 text-center space-y-3">
          {/* Avatar / Identity Glyph */}
          <div className="relative inline-block mx-auto">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 border-2 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl ring-8 ${!isAttended ? 'border-emerald-500/50 ring-emerald-500/20 animate-pulse' : 'border-white/20 ring-white/5'}`}>
              {initials}
            </div>
            {!isAttended && (
              <div className="absolute -inset-2 rounded-full border border-emerald-400/30 animate-ping pointer-events-none" />
            )}
            {session.isVerifiedBusiness && (
              <div
                className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1.5 border-2 border-[#070a10] shadow-md"
                title="Verified Enterprise Caller"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>

          {/* Caller Name & Formatted Phone Number / Calling Indicator */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-white tracking-tight leading-snug px-3 truncate max-w-sm mx-auto">
              {callerDisplayName}
            </h1>
            
            {/* TILL THEY ATTEND DISPLAY AS CALLING - IF THEY ATTEND THEN DISPLAY NUMBER */}
            {!isAttended ? (
              <div className="flex items-center justify-center gap-2 py-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-sm font-extrabold text-emerald-400 tracking-wider uppercase animate-pulse">
                  {t('call_dialing')}
                </span>
              </div>
            ) : (
              <div className="space-y-0.5 animate-in fade-in zoom-in-95 duration-300">
                <p className="text-base font-mono font-bold text-slate-200 tracking-wider">
                  {formattedNumber}
                </p>
                {callerProfile?.location && (
                  <p className="text-xs text-slate-400 font-medium">
                    {callerProfile.location}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* High-Legibility Tabular Call Timer or Calling Status Pill */}
          {!isAttended ? (
            <div className="inline-flex items-center justify-center gap-2.5 px-5 py-2 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 shadow-inner">
              <PhoneCall className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span className="text-sm font-bold tracking-wide text-emerald-300">
                {t('call_dialing')}
              </span>
              <span className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse delay-300" />
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center justify-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-inner animate-in fade-in duration-300">
              {!isOnHold && (
                <div className="flex items-center gap-1 h-3.5" title="HD Audio connected">
                  <span className="w-1 rounded bg-emerald-400 animate-wave-1" />
                  <span className="w-1 rounded bg-emerald-400 animate-wave-2" />
                  <span className="w-1 rounded bg-emerald-400 animate-wave-3" />
                  <span className="w-1 rounded bg-emerald-400 animate-wave-4" />
                </div>
              )}
              <span className="text-2xl font-mono font-extrabold text-white tracking-widest tabular-nums">
                {formatTimer(duration)}
              </span>
            </div>
          )}

          {/* Hold Alert Pill */}
          {isOnHold && (
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-center space-x-2 animate-pulse">
              <Pause className="w-4 h-4 text-amber-400" />
              <span>{t('call_on_hold')}</span>
            </div>
          )}

          {/* Real-time Lossless Recording Active Banner */}
          {isRecording && (
            <div className="p-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="font-black text-rose-100 tracking-wide font-mono">
                  REC {formatTimer(recordingDuration)}
                </span>
                <span className="text-[10px] bg-rose-500/30 px-1.5 py-0.5 rounded font-bold text-rose-200">
                  Lossless WAV
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-slate-300 font-mono">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>CallShield/</span>
              </div>
            </div>
          )}

          {/* Saved Notification */}
          {savedNotice && (
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-300 font-bold flex items-center justify-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="truncate">Saved: {savedNotice}</span>
            </div>
          )}

          {/* Recording Warning */}
          {recordingWarningPlayed && (
            <div className="p-2 rounded-xl bg-amber-950/70 border border-amber-500/30 text-xs text-amber-300 font-semibold flex items-center justify-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>High Fidelity Call Recording Active</span>
            </div>
          )}
        </div>

        {/* Dynamic In-Call Sheets: Keypad, Notes, and Add Call */}
        <div className="space-y-3">
          {/* DTMF Dialpad Sheet */}
          {showInCallKeypad && (
            <div className="p-4 rounded-3xl bg-slate-900/95 border border-white/20 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t('keypad')} (DTMF)
                </span>
                <div className="font-mono text-base font-bold text-white min-h-[24px] px-2 py-0.5 bg-black/60 rounded-lg border border-white/10 tracking-widest">
                  {keypadDigits || '—'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInCallKeypad(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-full bg-white/5 active:scale-95"
                  aria-label="Close Keypad"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto py-1">
                {[
                  { d: '1', sub: '' },
                  { d: '2', sub: 'ABC' },
                  { d: '3', sub: 'DEF' },
                  { d: '4', sub: 'GHI' },
                  { d: '5', sub: 'JKL' },
                  { d: '6', sub: 'MNO' },
                  { d: '7', sub: 'PQRS' },
                  { d: '8', sub: 'TUV' },
                  { d: '9', sub: 'WXYZ' },
                  { d: '*', sub: '' },
                  { d: '0', sub: '+' },
                  { d: '#', sub: '' },
                ].map(({ d, sub }) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleKeypadPress(d)}
                    className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/10 text-white flex flex-col items-center justify-center transition active:scale-90"
                  >
                    <span className="text-xl font-black leading-none">{d}</span>
                    {sub && <span className="text-[8.5px] font-bold text-slate-400 tracking-wider leading-none mt-0.5">{sub}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* In-Call Notes Scratchpad */}
          {showInCallNotes && (
            <div className="p-4 rounded-3xl bg-slate-900/95 border border-amber-500/40 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150 text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center space-x-2">
                  <StickyNote className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    In-Call Private Notes
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {noteSavedNotice ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Auto-saved</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Local Only</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInCallNotes(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-full bg-white/5 active:scale-95"
                    aria-label="Close notes"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Tags */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                {[
                  { label: '📍 Address', text: '📍 Address: ' },
                  { label: '🔢 Ref #', text: '🔢 Ref No: ' },
                  { label: '💰 Price', text: '💰 Price: ' },
                  { label: '📅 Meet', text: '📅 Meeting: ' },
                  { label: '⏰ Callback', text: '⏰ Call back at: ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleInsertTag(chip.text)}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-amber-500/20 hover:text-amber-200 border border-white/10 text-slate-300 font-semibold shrink-0 transition active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Note Textarea */}
              <textarea
                ref={notesInputRef}
                value={callerNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                rows={3}
                placeholder="Type OTP, address, reference numbers, or reminders..."
                className="w-full resize-none rounded-2xl border border-white/15 bg-black/60 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    disabled={!callerNote.trim()}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 disabled:opacity-30 text-xs font-semibold flex items-center space-x-1.5 active:scale-95 transition"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                  </button>
                  {callerNote.trim() && (
                    <button
                      type="button"
                      onClick={handleClearNote}
                      className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 text-xs font-medium active:scale-95 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInCallNotes(false)}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold active:scale-95 transition shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Add Conference Call Sheet */}
          {showAddCallPrompt && (
            <div className="p-3.5 rounded-3xl bg-slate-900/95 border border-white/20 shadow-2xl space-y-2.5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Add Second Call (Conference)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCallPrompt(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-full bg-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={secondCallInput}
                  onChange={(e) => setSecondCallInput(e.target.value)}
                  placeholder="Enter phone number to add"
                  className="flex-1 px-3.5 py-2.5 rounded-2xl bg-black/60 border border-white/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={handleExecuteAddCall}
                  className="px-4 py-2.5 rounded-2xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-200 active:scale-95 transition flex items-center space-x-1"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call</span>
                </button>
              </div>
            </div>
          )}

          {/* Secondary Conference Toolbar (Compact Pills) */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowAddCallPrompt((prev) => !prev);
                setShowInCallNotes(false);
                setShowInCallKeypad(false);
              }}
              className="flex-1 py-2 px-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] font-bold text-slate-200 active:scale-95 transition flex items-center justify-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-300" />
              <span>+ {t('add_call')}</span>
            </button>
            <button
              type="button"
              onClick={handleSwapCalls}
              className="flex-1 py-2 px-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] font-bold text-slate-200 active:scale-95 transition text-center"
            >
              {t('swap_calls')}
            </button>
            <button
              type="button"
              onClick={handleMergeCalls}
              className="flex-1 py-2 px-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] font-bold text-slate-200 active:scale-95 transition text-center"
            >
              {t('merge_calls')}
            </button>
          </div>

          {/* ONE-HANDED THUMB DECK: Large High-Contrast Primary Buttons */}
          <div className="pt-2 space-y-3">
            {/* ROW 1: The Big 3 Live Controls (Mute, Keypad, Speaker) with 72px Touch Targets */}
            <div className="grid grid-cols-3 gap-3 place-items-center">
              {/* 1. Mute Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? t('unmute') : t('mute')}
                  className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-xl border ${
                    isMuted
                      ? 'bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/30'
                      : 'bg-white/10 text-white hover:bg-white/15 border-white/15 active:bg-white/20'
                  }`}
                >
                  {isMuted ? (
                    <MicOff className="w-7 h-7 text-white stroke-[2.5]" />
                  ) : (
                    <Mic className="w-7 h-7 text-white stroke-[2.2]" />
                  )}
                </button>
                <span className="text-[11px] font-bold tracking-tight mt-1.5 text-slate-300">
                  {isMuted ? t('unmute') : t('mute')}
                </span>
              </div>

              {/* 2. Keypad Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowInCallKeypad((prev) => !prev);
                    setShowInCallNotes(false);
                    setShowAddCallPrompt(false);
                  }}
                  aria-label={t('keypad')}
                  className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-xl border ${
                    showInCallKeypad
                      ? 'bg-white text-slate-950 border-white ring-4 ring-white/30'
                      : 'bg-white/10 text-white hover:bg-white/15 border-white/15 active:bg-white/20'
                  }`}
                >
                  <Grid className={`w-7 h-7 stroke-[2.2] ${showInCallKeypad ? 'text-slate-950' : 'text-white'}`} />
                </button>
                <span className="text-[11px] font-bold tracking-tight mt-1.5 text-slate-300">
                  {t('keypad')}
                </span>
              </div>

              {/* 3. Speaker Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  aria-label={isSpeaker ? t('earpiece') : t('speaker')}
                  className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-xl border ${
                    isSpeaker
                      ? 'bg-emerald-500 text-white border-emerald-300 ring-4 ring-emerald-500/30'
                      : 'bg-white/10 text-white hover:bg-white/15 border-white/15 active:bg-white/20'
                  }`}
                >
                  {isSpeaker ? (
                    <Volume2 className="w-7 h-7 text-white stroke-[2.5]" />
                  ) : (
                    <VolumeX className="w-7 h-7 text-white stroke-[2.2]" />
                  )}
                </button>
                <span className="text-[11px] font-bold tracking-tight mt-1.5 text-slate-300">
                  {isSpeaker ? t('speaker') : t('speaker')}
                </span>
              </div>
            </div>

            {/* ROW 2: Utility In-Call Functions (Notes, Hold, Record) with 60px Touch Targets */}
            <div className="grid grid-cols-3 gap-3 place-items-center">
              {/* Notes */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowInCallNotes((prev) => !prev);
                    setShowInCallKeypad(false);
                    setShowAddCallPrompt(false);
                  }}
                  aria-label="In-Call Notes"
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-lg border relative ${
                    showInCallNotes
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-500/30'
                      : callerNote.trim()
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                      : 'bg-white/10 text-slate-300 hover:bg-white/15 border-white/15'
                  }`}
                >
                  <StickyNote className="w-6 h-6 stroke-[2]" />
                  {callerNote.trim() && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-black" />
                  )}
                </button>
                <span className="text-[10.5px] font-semibold text-slate-300 mt-1">
                  {callerNote.trim() ? 'Notes (Saved)' : 'Notes'}
                </span>
              </div>

              {/* Hold */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleToggleHold}
                  aria-label={isOnHold ? t('unhold') : t('hold')}
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-lg border ${
                    isOnHold
                      ? 'bg-amber-500 text-slate-950 border-amber-300 ring-4 ring-amber-500/30'
                      : 'bg-white/10 text-slate-300 hover:bg-white/15 border-white/15'
                  }`}
                >
                  {isOnHold ? (
                    <Play className="w-6 h-6 fill-current" />
                  ) : (
                    <Pause className="w-6 h-6 stroke-[2]" />
                  )}
                </button>
                <span className="text-[10.5px] font-semibold text-slate-300 mt-1">
                  {isOnHold ? t('unhold') : t('hold')}
                </span>
              </div>

              {/* Record (Lossless 48kHz) */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  aria-label={isRecording ? t('recording') : t('record')}
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-lg border ${
                    isRecording
                      ? 'bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/40'
                      : 'bg-white/10 text-slate-300 hover:bg-white/15 border-white/15'
                  }`}
                >
                  <Disc className={`w-6 h-6 stroke-[2] ${isRecording ? 'animate-spin text-white' : ''}`} />
                </button>
                <span className="text-[10.5px] font-semibold text-slate-300 mt-1">
                  {isRecording ? t('recording') : t('record')}
                </span>
              </div>
            </div>

            {/* ROW 3: Massive One-Handed End Call Action Button */}
            <div className="pt-3 pb-1">
              <button
                type="button"
                onClick={handleEndCallAction}
                aria-label={t('end_call')}
                className="w-full h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 active:scale-98 text-white font-black text-base shadow-2xl shadow-rose-950/80 transition-all flex items-center justify-center space-x-3 border border-rose-400/30 select-none ring-4 ring-rose-500/10 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <PhoneOff className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <span className="tracking-wider uppercase text-sm font-black">
                  {t('end_call')}
                </span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

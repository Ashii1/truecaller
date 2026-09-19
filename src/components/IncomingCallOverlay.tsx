import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Lock,
  MessageSquare,
  Phone,
  PhoneOff,
  Pin,
  PinOff,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  VolumeX,
  X,
} from 'lucide-react';
import { IncomingCallState, ScreeningTranscriptEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
import { telecomBridge } from '../services/telephony/telecomBridge';
import CallScreeningOverlay from './CallScreeningOverlay';

interface IncomingCallOverlayProps {
  call: IncomingCallState | null;
  autoCancelEnabled: boolean;
  onCancelCall: (reason: string, block: boolean, screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }) => void;
  onAnswerCall: (screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }) => void;
  onDismiss?: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
  isAiScreeningEnabled?: boolean;
  isDeviceLocked?: boolean;
}

const QUICK_RESPONSES = [
  "Can't talk right now. Call back later?",
  "I'm in a meeting. Talk soon.",
  "I'll call you right back.",
  "Please text me instead.",
];

export default function IncomingCallOverlay({
  call,
  autoCancelEnabled,
  onCancelCall,
  onAnswerCall,
  onDismiss,
  onScreenCall,
  isAiScreeningEnabled = true,
  isDeviceLocked: propIsDeviceLocked,
}: IncomingCallOverlayProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [isScreeningInternal, setIsScreeningInternal] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showQuickMessage, setShowQuickMessage] = useState(false);

  // Dynamic lock state tracking with immediate re-render support
  const [deviceLocked, setDeviceLocked] = useState<boolean>(() =>
    typeof propIsDeviceLocked === 'boolean' ? propIsDeviceLocked : telecomBridge.isDeviceLocked()
  );

  // 'Always On Top' flag state: forces device screen wake and maintains top-priority window over lock
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(() => telecomBridge.isAlwaysOnTopEnabled());
  const [canOverlay, setCanOverlay] = useState<boolean>(() => telecomBridge.canDrawOverlays());

  // Synchronize when parent lock state changes
  useEffect(() => {
    if (typeof propIsDeviceLocked === 'boolean') {
      setDeviceLocked(propIsDeviceLocked);
    }
  }, [propIsDeviceLocked]);

  // Subscribe to native Android lock state change events, always-on-top updates & window visibility
  useEffect(() => {
    const unsubBridge = telecomBridge.subscribe((eventType, payload) => {
      if (eventType === 'DEVICE_LOCK_STATE_CHANGED') {
        const locked =
          typeof payload?.isLocked === 'boolean'
            ? payload.isLocked
            : payload?.state === 'locked';
        setDeviceLocked(locked);
      } else if (eventType === 'ALWAYS_ON_TOP_CHANGED') {
        if (typeof payload?.enabled === 'boolean') {
          setIsAlwaysOnTop(payload.enabled);
        }
      }
    });

    const handleCustomEvent = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail && typeof ce.detail.isLocked === 'boolean') {
        setDeviceLocked(ce.detail.isLocked);
      } else if (telecomBridge.isAndroidEnvironment()) {
        setDeviceLocked(telecomBridge.isDeviceLocked());
      }
    };
    window.addEventListener('DEVICE_LOCK_STATE_CHANGED', handleCustomEvent);

    const handleSyncOnVisibility = () => {
      if (telecomBridge.isAndroidEnvironment()) {
        setDeviceLocked(telecomBridge.isDeviceLocked());
        setCanOverlay(telecomBridge.canDrawOverlays());
        setIsAlwaysOnTop(telecomBridge.isAlwaysOnTopEnabled());
      }
    };
    window.addEventListener('focus', handleSyncOnVisibility);
    document.addEventListener('visibilitychange', handleSyncOnVisibility);

    return () => {
      unsubBridge();
      window.removeEventListener('DEVICE_LOCK_STATE_CHANGED', handleCustomEvent);
      window.removeEventListener('focus', handleSyncOnVisibility);
      document.removeEventListener('visibilitychange', handleSyncOnVisibility);
    };
  }, []);

  const aiScreeningAllowed = isAiScreeningEnabled !== false && telecomBridge.isAiScreeningEnabled();

  const critical = !!call?.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM');
  const suspicious = (!!call?.isSpam && !critical) || !!call?.isNeighborSpoof || !!call?.isPingBackScam;

  useEffect(() => {
    let wakeLockSentinel: any = null;
    // Force device screen to wake up immediately for incoming alert
    if (isAlwaysOnTop) {
      telecomBridge.wakeDeviceScreen();
    }
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockSentinel = lock;
      }).catch(() => {});
    }

    const handleSilence = () => {
      setSilenced(true);
      telecomBridge.silenceRinger();
    };

    window.addEventListener('SILENCE_RINGER', handleSilence);
    const unsubSilence = telecomBridge.subscribe((eventType) => {
      if (eventType === 'SILENCE_RINGER') {
        setSilenced(true);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const isVol =
        e.key === 'AudioVolumeDown' ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'AudioVolumeMute' ||
        e.key === 'VolumeDown' ||
        e.key === 'VolumeUp' ||
        e.keyCode === 174 ||
        e.keyCode === 175 ||
        e.keyCode === 173;
      if (isVol) {
        handleSilence();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('SILENCE_RINGER', handleSilence);
      window.removeEventListener('keydown', handleKeyDown);
      unsubSilence();
      if (wakeLockSentinel) {
        try { wakeLockSentinel.release(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!call || call.status !== 'RINGING' || !autoCancelEnabled || !call.isSpam || call.riskScore < 90) {
      setCountdown(0);
      return;
    }
    setCountdown(3);
    const timer = window.setInterval(() => setCountdown(value => {
      if (value <= 1) {
        window.clearInterval(timer);
        onCancelCall(call.spamReason || 'High-confidence spam call', true);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [call, autoCancelEnabled, onCancelCall]);

  if (!call) return null;

  // Active AI Screening Mode
  if (aiScreeningAllowed && (call.status === 'SCREENING' || isScreeningInternal)) {
    return (
      <CallScreeningOverlay
        call={call}
        onPickUp={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          onAnswerCall({ transcript, intent });
        }}
        onHangUp={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          onCancelCall('Screening concluded: user declined', false, { transcript, intent });
        }}
        onBlockSpam={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          onCancelCall('Screening concluded: caller blocked as spam', true, { transcript, intent });
        }}
      />
    );
  }

  if (call.status !== 'RINGING' && call.status !== 'SCREENING') return null;

  const answer = () => { setSilenced(true); onAnswerCall(); };
  const decline = () => { setSilenced(true); onCancelCall('Declined by user', false); };
  const screen = () => {
    if (!aiScreeningAllowed) return;
    setSilenced(true);
    setIsScreeningInternal(true);
    if (onScreenCall) {
      onScreenCall(call);
    }
  };
  const silence = () => {
    setSilenced(true);
    telecomBridge.silenceRinger();
  };

  const handleQuickDecline = (msg: string) => {
    setSilenced(true);
    setShowQuickMessage(false);
    onCancelCall(`Declined with message: "${msg}"`, false);
  };

  const handleUnlockRequest = () => {
    telecomBridge.requestDeviceUnlock();
  };

  const handleToggleAlwaysOnTop = () => {
    if (!canOverlay && telecomBridge.isAndroidEnvironment()) {
      telecomBridge.requestOverlayPermission();
      return;
    }
    const next = !isAlwaysOnTop;
    setIsAlwaysOnTop(next);
    telecomBridge.setAlwaysOnTopEnabled(next);
    if (next) {
      telecomBridge.wakeDeviceScreen();
    }
  };

  return (
    <div
      id="incoming-call-overlay"
      className="fixed inset-0 z-[99999] flex flex-col justify-between w-screen h-[100dvh] min-h-[100dvh] bg-gradient-to-b from-[#030712] via-[#0b0f19] to-[#030712] text-white p-4 sm:p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] select-none overflow-y-auto overscroll-none"
      aria-label={t('incoming_call_title')}
    >
      {/* Top Bar: Verification, Lock State, Always On Top & Silence Button */}
      <header id="incoming-call-header" className="shrink-0 flex items-center justify-between gap-2 w-full max-w-lg mx-auto border-b border-slate-800/80 pb-3">
        {/* Spam / Verification Badge */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {critical ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          ) : call.isNeighborSpoof ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          ) : suspicious ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className={critical ? 'text-red-300' : call.isNeighborSpoof ? 'text-amber-300' : suspicious ? 'text-amber-300' : 'text-emerald-300'}>
            {critical
              ? t('high_risk_caller')
              : call.isNeighborSpoof
              ? 'Neighbor Spoof'
              : call.isPingBackScam
              ? '1-Ring Ping Scam'
              : suspicious
              ? t('potential_spam')
              : call.isVerifiedBusiness
              ? t('verified_caller')
              : `${t('safe_badge')} · ${t('public_directory_verified')}`}
          </span>
        </div>

        {/* Lock State Pill, Always-On-Top & Silence Action */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Always On Top Toggle / Indicator */}
          <button
            id="always-on-top-toggle-btn"
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border shadow-sm transition active:scale-95 cursor-pointer ${
              isAlwaysOnTop
                ? 'text-cyan-300 bg-cyan-950/70 border-cyan-500/40 hover:bg-cyan-900/60'
                : 'text-slate-400 bg-slate-900/60 border-slate-700/50 hover:bg-slate-800/60'
            }`}
            title={
              isAlwaysOnTop
                ? 'Always On Top: Active. Screen wakes and stays prioritized over lock screen.'
                : 'Always On Top: Off. Tap to keep screen awake and prioritize incoming call window.'
            }
          >
            {isAlwaysOnTop ? <Pin className="w-3 h-3 text-cyan-400 rotate-45" /> : <PinOff className="w-3 h-3 text-slate-500" />}
            <span className="hidden sm:inline">Always On Top</span>
            <span className="sm:hidden">Top</span>
          </button>

          {deviceLocked ? (
            <button
              id="unlock-device-btn"
              type="button"
              onClick={handleUnlockRequest}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-sm active:scale-95 hover:bg-amber-900/50 transition cursor-pointer"
              title="Screen is showing over lock. Tap to unlock device."
            >
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Locked</span>
            </button>
          ) : (
            <div
              id="unlocked-device-pill"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/40 shadow-sm animate-in fade-in duration-200"
              title="Device is unlocked"
            >
              <Unlock className="w-3 h-3 text-emerald-400" />
              <span>Unlocked</span>
            </div>
          )}

          <button
            id="silence-call-btn"
            type="button"
            onClick={silence}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition active:scale-95 ${
              silenced
                ? 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
            aria-label={silenced ? 'Ringtone Silenced' : 'Silence Ringtone'}
          >
            <VolumeX className="h-3.5 w-3.5" />
            <span>{silenced ? 'Silenced' : 'Silence'}</span>
          </button>
        </div>
      </header>

      {/* Informative Priority Alert Bar */}
      {(deviceLocked || isAlwaysOnTop) && (
        <div id="incoming-call-lock-status-banner" className="w-full max-w-lg mx-auto mt-2 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {deviceLocked ? 'Displaying over lock screen' : 'Full-screen priority overlay active'}
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono font-medium">
            {isAlwaysOnTop ? 'ALWAYS-ON-TOP ACTIVE' : 'STANDARD'}
          </span>
        </div>
      )}

      {/* Main Center Area: Pulsing Avatar, Caller ID & Details */}
      <main id="incoming-call-main" className="flex-1 flex flex-col items-center justify-center text-center my-auto px-2 max-w-md mx-auto w-full py-4 min-h-0">
        {/* Pulsing Avatar */}
        <div className="relative mb-5 shrink-0">
          <div className={`absolute inset-0 rounded-full animate-ping opacity-25 ${critical ? 'bg-red-500' : suspicious ? 'bg-amber-500' : 'bg-indigo-500'}`} />
          <div className={`relative grid h-24 w-24 sm:h-28 sm:w-28 place-items-center rounded-full text-3xl sm:text-4xl font-bold shadow-2xl border-2 ${
            critical
              ? 'bg-red-950/60 text-red-200 border-red-500/50 shadow-red-950/50'
              : suspicious
              ? 'bg-amber-950/60 text-amber-200 border-amber-500/50 shadow-amber-950/50'
              : 'bg-indigo-950/60 text-indigo-200 border-indigo-500/50 shadow-indigo-950/50'
          }`}>
            {(call.callerName || '?').slice(0, 1).toUpperCase()}
          </div>
        </div>

        {/* Caller Name & Formatted Phone Number */}
        <h2 className="truncate max-w-full text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {call.callerName || t('unknown_caller')}
        </h2>
        <p className="mt-1.5 font-mono text-base sm:text-lg text-slate-300 tracking-wider">
          {formatPhoneNumber(typeof call.number === 'string' ? call.number : String(call.number ?? ''))}
        </p>

        {/* Carrier & Location Pill */}
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
          <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-slate-300">{call.carrier || 'Cellular'}</span>
          <span>•</span>
          <span>{call.location || 'India'}</span>
        </div>

        {/* Silenced Status Indicator */}
        {silenced && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-xs text-slate-300 animate-in fade-in">
            <VolumeX className="h-3.5 w-3.5 text-amber-400" />
            <span>Ringtone silenced</span>
          </div>
        )}

        {/* Neighbor Spoof Warning Banner */}
        {call.isNeighborSpoof && (
          <div className="mt-3 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-left text-xs text-amber-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Likely Spoofed (Neighbor Spoofing)</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
              Matches your local prefix but is not in contacts. Scammers fake local numbers to trick you into answering.
            </p>
          </div>
        )}

        {/* 1-Ring Ping-Back Scam Banner */}
        {call.isPingBackScam && (
          <div className="mt-3 w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-left text-xs text-rose-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>1-Ring Callback Scam Trap</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">
              Automated dialers drop after 1 ring to trick you into calling back expensive premium numbers.
            </p>
          </div>
        )}

        {/* Critical or Suspicious Alert Box */}
        {(critical || (suspicious && !call.isNeighborSpoof && !call.isPingBackScam)) && (
          <div className={`mt-3 w-full rounded-2xl px-3.5 py-2.5 text-left text-xs ${critical ? 'bg-red-500/15 border border-red-500/30 text-red-200' : 'bg-amber-500/15 border border-amber-500/30 text-amber-200'}`}>
            <div className="font-semibold">{critical ? 'Do not share OTPs, PINs, or banking details.' : 'Review caller information before answering.'}</div>
            {countdown > 0 && <div className="mt-1 font-mono text-[11px] opacity-90">{t('auto_cancelling_in')} {countdown}{t('seconds_short')}.</div>}
          </div>
        )}

        {/* Expanded Caller Info (Reacts dynamically to device lock status) */}
        {expanded && (
          <div className="mt-3 w-full space-y-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5 text-left text-xs text-slate-400 animate-in fade-in duration-200">
            <div className="flex justify-between"><span>{t('carrier_label')}</span><span className="text-slate-200">{call.carrier || 'Cellular'}</span></div>
            <div className="flex justify-between"><span>{t('location_label')}</span><span className="max-w-[65%] text-right text-slate-200">{call.location || 'Unavailable'}</span></div>
            {call.reportsCount > 0 && <div className="flex justify-between"><span>{t('spam_reports_count')}</span><span className="text-slate-200">{call.reportsCount.toLocaleString()}</span></div>}

            {/* Lock-sensitive context details */}
            {deviceLocked ? (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-300/80">
                <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3 text-amber-400" /> Private notes hidden on lock screen</span>
                <button type="button" onClick={handleUnlockRequest} className="text-amber-400 hover:text-amber-300 underline font-semibold">Unlock</button>
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1 text-[11px] text-emerald-400">
                <Unlock className="w-3 h-3 text-emerald-400" />
                <span>Device unlocked: full caller history and quick replies accessible</span>
              </div>
            )}
          </div>
        )}

        {/* Toggle Details Button */}
        <button
          id="toggle-caller-details-btn"
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition active:scale-95"
        >
          {t('caller_details')} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </main>

      {/* Quick Message Drawer / Sheet (Accessible or prompt unlock) */}
      {showQuickMessage && (
        <div id="quick-message-drawer" className="w-full max-w-md mx-auto mb-3 bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Decline & Send SMS
            </span>
            <button type="button" onClick={() => setShowQuickMessage(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {QUICK_RESPONSES.map((msg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickDecline(msg)}
                className="w-full text-left px-3 py-2 text-xs rounded-xl bg-slate-800/60 hover:bg-indigo-600/30 text-slate-200 hover:text-white border border-slate-700/50 hover:border-indigo-500/50 transition flex items-center justify-between group"
              >
                <span>{msg}</span>
                <Send className="w-3 h-3 text-slate-500 group-hover:text-indigo-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Controls */}
      <footer id="incoming-call-actions" className="shrink-0 w-full max-w-md mx-auto space-y-3">
        {/* Quick Message / Decline with SMS Button */}
        <div className="flex items-center justify-center">
          <button
            id="quick-decline-msg-btn"
            type="button"
            onClick={() => {
              if (deviceLocked) {
                handleUnlockRequest();
              } else {
                setShowQuickMessage(prev => !prev);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900/80 border border-slate-800/80 px-3.5 py-1.5 rounded-full transition active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>{deviceLocked ? 'Unlock to Send Quick SMS' : showQuickMessage ? 'Hide Quick Replies' : 'Decline with Quick Message'}</span>
          </button>
        </div>

        {/* Screen Call with AI Assistant Button */}
        {aiScreeningAllowed && (
          <button
            id="screen-call-ai-btn"
            type="button"
            onClick={screen}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-indigo-900/80 px-4 py-3 text-xs sm:text-sm font-bold text-indigo-100 shadow-xl shadow-indigo-950/50 transition hover:from-indigo-800 hover:to-purple-800 active:scale-98"
          >
            <Bot className="h-4 w-4 text-indigo-300" />
            <span>Screen Call with AI Assistant</span>
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
          </button>
        )}

        {/* Primary Large Call Actions (Decline, Quick Silence, Answer) */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="decline-call-btn"
              type="button"
              onClick={decline}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-950/60 active:scale-90 transition cursor-pointer"
              aria-label={t('decline')}
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <span className="text-xs font-semibold text-slate-300">{t('decline')}</span>
          </div>

          {/* Quick Silence Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="silence-ring-btn"
              type="button"
              onClick={silence}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg active:scale-90 transition cursor-pointer"
              aria-label={silenced ? 'Silenced' : 'Silence'}
            >
              <VolumeX className="h-6 w-6" />
            </button>
            <span className="text-xs font-semibold text-slate-400">{silenced ? 'Silenced' : 'Silence'}</span>
          </div>

          {/* Answer Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              id="answer-call-btn"
              type="button"
              onClick={answer}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-950/60 active:scale-90 transition cursor-pointer"
              aria-label={t('answer')}
            >
              <Phone className="h-7 w-7" />
            </button>
            <span className="text-xs font-semibold text-slate-300">{t('answer')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


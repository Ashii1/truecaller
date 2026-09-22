import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Lock,
  Maximize2,
  MessageSquare,
  Phone,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
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
  onCancelCall: (
    reason: string,
    block: boolean,
    screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }
  ) => void;
  onAnswerCall: (
    screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }
  ) => void;
  onDismiss: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
  isDeviceLocked?: boolean;
  isUserActive?: boolean;
}

export default function IncomingCallOverlay({
  call,
  autoCancelEnabled,
  onCancelCall,
  onAnswerCall,
  onDismiss,
  onScreenCall,
  isDeviceLocked = false,
  isUserActive = true,
}: IncomingCallOverlayProps) {
  const { t } = useI18n();
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const [showQuickSms, setShowQuickSms] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [isScreeningInternal, setIsScreeningInternal] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const critical = !!call?.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM');
  const suspicious =
    (!!call?.isSpam && !critical) || !!call?.isNeighborSpoof || !!call?.isPingBackScam;

  useEffect(() => {
    let wakeLockSentinel: any = null;
    if (
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      (navigator as any).wakeLock?.request
    ) {
      (navigator as any).wakeLock
        .request('screen')
        .then((lock: any) => {
          wakeLockSentinel = lock;
        })
        .catch(() => {});
    }

    const handleSilence = () => {
      setSilenced(true);
      telecomBridge.silenceRinger();
    };

    window.addEventListener('SILENCE_RINGER', handleSilence);
    const unsubBridge = telecomBridge.subscribe((eventType) => {
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
      unsubBridge();
      if (wakeLockSentinel) {
        try {
          wakeLockSentinel.release();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (
      !call ||
      call.status !== 'RINGING' ||
      !autoCancelEnabled ||
      !call.isSpam ||
      call.riskScore < 90
    ) {
      setCountdown(0);
      return;
    }
    setCountdown(3);
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          onCancelCall(call.spamReason || 'High-confidence spam call', true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [call, autoCancelEnabled, onCancelCall]);

  if (!call) return null;

  // Active AI Screening Mode
  if (call.status === 'SCREENING' || isScreeningInternal) {
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
          onCancelCall('Screening concluded: caller blocked as spam', true, {
            transcript,
            intent,
          });
        }}
      />
    );
  }

  if (call.status !== 'RINGING') return null;

  const answer = () => {
    setSilenced(true);
    onAnswerCall();
  };

  const decline = () => {
    setSilenced(true);
    onCancelCall('Declined by user', false);
  };

  const screen = () => {
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

  const handleQuickSmsReject = (messageText: string) => {
    setSilenced(true);
    onCancelCall(`Declined with SMS: "${messageText}"`, false);
  };

  // Requirement 2: "while user active then at that time fullnotification not required only in app notification (top of screen)"
  // Requirement 1: "In lockscreen im not getting fullscreen caller info"
  // When device is locked, ALWAYS show full-screen caller info.
  // When device is unlocked and user is active, show the top in-app notification banner unless expanded.
  const showTopBannerOnly = !isDeviceLocked && isUserActive && !isManuallyExpanded;

  const callerInitial = (call.callerName || '?').slice(0, 1).toUpperCase();
  const formattedNumber = formatPhoneNumber(
    typeof call.number === 'string' ? call.number : String(call.number ?? '')
  );

  /* -------------------------------------------------------------
   * 1. IN-APP HEADS-UP NOTIFICATION BANNER (Top of screen)
   * ------------------------------------------------------------- */
  if (showTopBannerOnly) {
    return (
      <div
        className="fixed top-2 sm:top-4 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 max-w-lg z-[99999] pointer-events-auto transition-all animate-in slide-in-from-top-4 duration-200"
        role="alert"
        aria-live="assertive"
      >
        <div className="rounded-3xl border border-white/20 bg-slate-950/95 backdrop-blur-2xl p-3.5 shadow-2xl shadow-black/90 text-white">
          {/* Top Row: Caller Identity & Expand Button */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setIsManuallyExpanded(true)}
            title="Tap to expand full screen caller UI"
          >
            {/* Pulsing Avatar */}
            <div className="relative shrink-0">
              <div
                className={`absolute inset-0 rounded-full animate-ping opacity-30 ${
                  critical ? 'bg-rose-500' : suspicious ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <div
                className={`relative flex h-12 w-12 items-center justify-center rounded-full text-lg font-black border-2 shadow-lg ${
                  critical
                    ? 'bg-rose-950 text-rose-200 border-rose-500'
                    : suspicious
                    ? 'bg-amber-950 text-amber-200 border-amber-500'
                    : 'bg-emerald-950 text-emerald-200 border-emerald-500'
                }`}
              >
                {callerInitial}
              </div>
            </div>

            {/* Caller Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-white truncate">
                  {call.callerName || t('unknown_caller')}
                </h2>
                {call.isVerifiedBusiness && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-400" />
                )}
              </div>
              <p className="font-mono text-xs text-slate-300 tracking-wide truncate">
                {formattedNumber}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                <span className="font-medium text-slate-300">
                  {call.carrier || 'Cellular'}
                </span>
                <span>•</span>
                <span>{call.location || 'India'}</span>
                {critical && (
                  <span className="ml-1 rounded px-1.5 py-0.2 bg-rose-500/25 text-rose-300 font-bold border border-rose-500/40">
                    High Risk
                  </span>
                )}
                {call.isNeighborSpoof && (
                  <span className="ml-1 rounded px-1.5 py-0.2 bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40">
                    Spoof
                  </span>
                )}
              </div>
            </div>

            {/* Expand Fullscreen Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsManuallyExpanded(true);
              }}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition active:scale-95"
              title="Expand to Fullscreen Caller UI"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom Row: One-Handed High-Contrast Actions */}
          <div className="mt-3 grid grid-cols-4 gap-2 pt-2 border-t border-white/10">
            {/* Decline */}
            <button
              type="button"
              onClick={decline}
              className="flex items-center justify-center gap-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 active:scale-95 transition"
              aria-label="Decline Call"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Decline</span>
            </button>

            {/* Silence */}
            <button
              type="button"
              onClick={silence}
              className={`flex items-center justify-center gap-1 py-2.5 rounded-2xl border text-xs font-semibold active:scale-95 transition ${
                silenced
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
              }`}
              aria-label={silenced ? 'Silenced' : 'Silence'}
            >
              <VolumeX className="h-4 w-4" />
              <span>{silenced ? 'Silenced' : 'Silence'}</span>
            </button>

            {/* AI Screen */}
            <button
              type="button"
              onClick={screen}
              className="flex items-center justify-center gap-1 py-2.5 rounded-2xl bg-indigo-900/90 hover:bg-indigo-800/90 border border-indigo-500/40 text-indigo-200 font-bold text-xs active:scale-95 transition"
              title="Screen with AI"
            >
              <Bot className="h-4 w-4 text-indigo-300" />
              <span>Screen</span>
            </button>

            {/* Answer */}
            <button
              type="button"
              onClick={answer}
              className="flex items-center justify-center gap-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 active:scale-95 transition"
              aria-label="Answer Call"
            >
              <Phone className="h-4 w-4" />
              <span>Answer</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------
   * 2. REDESIGNED FULLSCREEN CALLER INFO (Lockscreen & Full mode)
   * ------------------------------------------------------------- */
  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col justify-between w-screen h-screen bg-gradient-to-b from-[#050811] via-[#090e1a] to-[#04060c] text-white p-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] select-none overflow-y-auto"
      aria-label={t('incoming_call_title')}
    >
      {/* Top Bar: Security Badge, Lock Status & Quick Collapse */}
      <div className="flex items-center justify-between w-full max-w-lg mx-auto border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          {isDeviceLocked ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-[11px] font-semibold">
              <Lock className="h-3 w-3 text-amber-400" />
              <span>Lockscreen Call Guard</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsManuallyExpanded(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-slate-300 text-[11px] font-semibold transition active:scale-95"
              title="Collapse to in-app banner"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>In-App Banner</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-[11px] font-bold">
            {critical ? (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> High Risk Spam
              </span>
            ) : call.isNeighborSpoof ? (
              <span className="text-amber-400 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Spoofed Prefix
              </span>
            ) : call.isPingBackScam ? (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> 1-Ring Trap
              </span>
            ) : suspicious ? (
              <span className="text-amber-300 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Potential Spam
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified Call
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={silence}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
            silenced
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
          }`}
          aria-label={silenced ? 'Ringtone Silenced' : 'Silence Ringtone'}
        >
          <VolumeX className="h-3.5 w-3.5" />
          <span>{silenced ? 'Silenced' : 'Silence'}</span>
        </button>
      </div>

      {/* Middle Stage: Caller Avatar, Name, Number, Badges & Alerts */}
      <div className="flex flex-col items-center justify-center text-center my-auto px-4 max-w-md mx-auto w-full py-4">
        {/* Radar Ringing Animation with Large Avatar */}
        <div className="relative mb-6">
          <div
            className={`absolute -inset-4 rounded-full animate-ping opacity-25 ${
              critical ? 'bg-rose-500' : suspicious ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <div
            className={`absolute -inset-8 rounded-full animate-pulse opacity-15 ${
              critical ? 'bg-rose-600' : suspicious ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          />
          <div
            className={`relative flex h-32 w-32 items-center justify-center rounded-full text-5xl font-black shadow-2xl border-4 ${
              critical
                ? 'bg-gradient-to-b from-rose-950 to-slate-950 text-rose-200 border-rose-500/60 shadow-rose-950/60'
                : suspicious
                ? 'bg-gradient-to-b from-amber-950 to-slate-950 text-amber-200 border-amber-500/60 shadow-amber-950/60'
                : 'bg-gradient-to-b from-emerald-950 to-slate-950 text-emerald-200 border-emerald-500/60 shadow-emerald-950/60'
            }`}
          >
            {callerInitial}
            {call.isVerifiedBusiness && (
              <div
                className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-2 border-2 border-[#04060c] shadow-lg"
                title="Verified Enterprise Caller"
              >
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Caller Name & Formatted Phone Number */}
        <div className="space-y-1 max-w-full">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight truncate px-2">
            {call.callerName || t('unknown_caller')}
          </h1>
          <p className="font-mono text-xl text-slate-200 tracking-wider">
            {formattedNumber}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium pt-1">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-slate-200">
              {call.carrier || 'Cellular'}
            </span>
            <span>•</span>
            <span>{call.location || 'India'}</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Incoming Voice</span>
          </div>
        </div>

        {/* Silenced Status Pill */}
        {silenced && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/90 px-3.5 py-1 text-xs text-slate-300 animate-in fade-in">
            <VolumeX className="h-3.5 w-3.5 text-amber-400" />
            <span>Ringtone silenced (Volume key or button)</span>
          </div>
        )}

        {/* High Risk / Spoofing Context Banners */}
        {call.isNeighborSpoof && (
          <div className="mt-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/15 p-3 text-left text-xs text-amber-200">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Neighbor Spoof Warning</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
              This number mimics your local area code to manipulate you into answering.
            </p>
          </div>
        )}

        {call.isPingBackScam && (
          <div className="mt-4 w-full rounded-2xl border border-rose-500/40 bg-rose-500/15 p-3 text-left text-xs text-rose-200">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>1-Ring Callback Scam Trap</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">
              Dialers drop after 1 ring to trick you into calling back expensive premium numbers.
            </p>
          </div>
        )}

        {(critical || (suspicious && !call.isNeighborSpoof && !call.isPingBackScam)) && (
          <div
            className={`mt-4 w-full rounded-2xl p-3 text-left text-xs ${
              critical
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                {critical
                  ? 'High Risk Spam Caller — Do Not Share Credentials'
                  : 'Suspicious Caller — Exercise Caution'}
              </span>
            </div>
            {countdown > 0 && (
              <div className="mt-1 font-mono text-[11px] text-amber-300 font-bold">
                {t('auto_cancelling_in')} {countdown}s...
              </div>
            )}
          </div>
        )}

        {/* Collapsible Technical Details */}
        {detailsExpanded && (
          <div className="mt-3 w-full space-y-1.5 rounded-2xl border border-white/10 bg-black/60 p-3 text-left text-xs text-slate-300 animate-in fade-in">
            <div className="flex justify-between">
              <span className="text-slate-400">Carrier:</span>
              <span className="font-medium">{call.carrier || 'Cellular'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Location:</span>
              <span className="font-medium">{call.location || 'Unavailable'}</span>
            </div>
            {call.reportsCount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Spam Reports:</span>
                <span className="font-bold text-rose-400">{call.reportsCount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Reputation Risk:</span>
              <span className="font-bold">{call.riskScore}/100</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDetailsExpanded((prev) => !prev)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <span>{detailsExpanded ? 'Hide Details' : 'Caller Details & Network'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Bottom Action Deck */}
      <div className="w-full max-w-md mx-auto space-y-3">
        {/* Quick SMS Reject Options Drawer */}
        {showQuickSms && (
          <div className="p-3 rounded-2xl bg-slate-900/95 border border-white/20 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                Quick Decline with SMS
              </span>
              <button
                type="button"
                onClick={() => setShowQuickSms(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              {[
                "Can't talk right now. What's up?",
                "I'll call you right back.",
                'Please text me instead.',
                'In a meeting, will call later.',
              ].map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => handleQuickSmsReject(msg)}
                  className="text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs text-slate-200 active:scale-98 transition"
                >
                  "{msg}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Screen Call with AI Button */}
        <button
          type="button"
          onClick={screen}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-indigo-900/80 px-4 py-3 text-xs sm:text-sm font-bold text-indigo-100 shadow-xl shadow-indigo-950/50 hover:from-indigo-800 hover:to-purple-800 active:scale-98 transition"
        >
          <Bot className="h-4 w-4 text-indigo-300" />
          <span>Screen Call with AI Assistant</span>
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
        </button>

        {/* Primary Large Tactile Controls: Decline, Quick SMS/Silence, Answer */}
        <div className="grid grid-cols-3 gap-3 pt-1 place-items-center">
          {/* Decline */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={decline}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-2xl shadow-rose-950/80 active:scale-90 transition border-2 border-rose-400/50"
              aria-label={t('decline')}
            >
              <PhoneOff className="h-8 w-8 stroke-[2.5]" />
            </button>
            <span className="text-xs font-bold text-slate-300">{t('decline')}</span>
          </div>

          {/* Quick SMS / Silence Toggle */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowQuickSms((prev) => !prev)}
              className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 shadow-xl active:scale-90 transition"
              aria-label="Quick Message Decline"
              title="Decline with SMS"
            >
              <MessageSquare className="h-6 w-6 text-slate-300" />
            </button>
            <span className="text-[11px] font-semibold text-slate-400">Quick SMS</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={answer}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xl shadow-emerald-950/80 active:scale-90 transition border-2 border-emerald-400/50 ring-4 ring-emerald-500/20"
              aria-label={t('answer')}
            >
              <Phone className="h-8 w-8 stroke-[2.5]" />
            </button>
            <span className="text-xs font-bold text-slate-300">{t('answer')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

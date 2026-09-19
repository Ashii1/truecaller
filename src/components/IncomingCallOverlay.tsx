import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, Phone, PhoneOff, ShieldAlert, ShieldCheck, Sparkles, Volume2, VolumeX } from 'lucide-react';
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
  onDismiss: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
}

export default function IncomingCallOverlay({ call, autoCancelEnabled, onCancelCall, onAnswerCall, onDismiss, onScreenCall }: IncomingCallOverlayProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [isScreeningInternal, setIsScreeningInternal] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const critical = !!call?.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM');
  const suspicious = (!!call?.isSpam && !critical) || !!call?.isNeighborSpoof || !!call?.isPingBackScam;

  useEffect(() => {
    let wakeLockSentinel: any = null;
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
          onCancelCall('Screening concluded: caller blocked as spam', true, { transcript, intent });
        }}
      />
    );
  }

  if (call.status !== 'RINGING') return null;

  const answer = () => { setSilenced(true); onAnswerCall(); };
  const decline = () => { setSilenced(true); onCancelCall('Declined by user', false); };
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

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col justify-between w-screen h-screen bg-gradient-to-b from-[#030712] via-[#0b0f19] to-[#030712] text-white p-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] select-none overflow-y-auto" aria-label={t('incoming_call_title')}>
      {/* Top Bar Status */}
      <div className="flex items-center justify-between w-full max-w-lg mx-auto border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {critical ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : call.isNeighborSpoof ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : suspicious ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          )}
          <span className={critical ? 'text-red-300' : call.isNeighborSpoof ? 'text-amber-300' : suspicious ? 'text-amber-300' : 'text-emerald-300'}>
            {critical
              ? t('high_risk_caller')
              : call.isNeighborSpoof
              ? 'Neighbor Spoof Detected'
              : call.isPingBackScam
              ? '1-Ring Ping-Back Scam'
              : suspicious
              ? t('potential_spam')
              : call.isVerifiedBusiness
              ? t('verified_caller')
              : `${t('safe_badge')} · ${t('public_directory_verified')}`}
          </span>
        </div>

        <button
          onClick={silence}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
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

      {/* Main Caller Profile Info */}
      <div className="flex flex-col items-center justify-center text-center my-auto px-4 max-w-md mx-auto w-full">
        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className={`absolute inset-0 rounded-full animate-ping opacity-25 ${critical ? 'bg-red-500' : suspicious ? 'bg-amber-500' : 'bg-indigo-500'}`} />
          <div className={`relative grid h-28 w-28 place-items-center rounded-full text-4xl font-bold shadow-2xl border-2 ${
            critical
              ? 'bg-red-950/60 text-red-200 border-red-500/50 shadow-red-950/50'
              : suspicious
              ? 'bg-amber-950/60 text-amber-200 border-amber-500/50 shadow-amber-950/50'
              : 'bg-indigo-950/60 text-indigo-200 border-indigo-500/50 shadow-indigo-950/50'
          }`}>
            {(call.callerName || '?').slice(0, 1).toUpperCase()}
          </div>
        </div>

        <h2 className="truncate max-w-full text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {call.callerName || t('unknown_caller')}
        </h2>
        <p className="mt-2 font-mono text-lg text-slate-300 tracking-wider">
          {formatPhoneNumber(typeof call.number === 'string' ? call.number : String(call.number ?? ''))}
        </p>

        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
          <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-slate-300">{call.carrier || 'Cellular'}</span>
          <span>•</span>
          <span>{call.location || 'India'}</span>
        </div>

        {silenced && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 px-3.5 py-1 text-xs text-slate-300 animate-in fade-in">
            <VolumeX className="h-3.5 w-3.5 text-amber-400" />
            <span>Ringtone silenced (Volume key or button)</span>
          </div>
        )}

        {/* Neighbor Spoof High-Visibility Banner */}
        {call.isNeighborSpoof && (
          <div className="mt-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-left text-xs text-amber-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Likely Spoofed (Neighbor Spoofing)</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
              This caller matches your local prefix but is not in your contacts. Scammers often fake local numbers to trick you into answering.
            </p>
          </div>
        )}

        {/* 1-Ring Ping-Back Scam Banner */}
        {call.isPingBackScam && (
          <div className="mt-4 w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-left text-xs text-rose-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>1-Ring Callback Scam Trap</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">
              Automated dialers drop after 1 ring to trick you into calling back expensive premium numbers.
            </p>
          </div>
        )}

        {(critical || (suspicious && !call.isNeighborSpoof && !call.isPingBackScam)) && (
          <div className={`mt-4 w-full rounded-2xl px-3.5 py-2.5 text-left text-xs ${critical ? 'bg-red-500/15 border border-red-500/30 text-red-200' : 'bg-amber-500/15 border border-amber-500/30 text-amber-200'}`}>
            <div className="font-semibold">{critical ? 'Do not share OTPs, PINs, or banking details.' : 'Review caller information before answering.'}</div>
            {countdown > 0 && <div className="mt-1 font-mono text-[11px] opacity-90">{t('auto_cancelling_in')} {countdown}{t('seconds_short')}.</div>}
          </div>
        )}

        {expanded && (
          <div className="mt-3 w-full space-y-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 text-left text-xs text-slate-400">
            <div className="flex justify-between"><span>{t('carrier_label')}</span><span className="text-slate-200">{call.carrier || 'Cellular'}</span></div>
            <div className="flex justify-between"><span>{t('location_label')}</span><span className="max-w-[65%] text-right text-slate-200">{call.location || 'Unavailable'}</span></div>
            {call.reportsCount > 0 && <div className="flex justify-between"><span>{t('spam_reports_count')}</span><span className="text-slate-200">{call.reportsCount.toLocaleString()}</span></div>}
          </div>
        )}

        <button onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
          {t('caller_details')} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Bottom Action Controls */}
      <div className="w-full max-w-md mx-auto space-y-3 pt-2">
        {/* Screen Call with AI Button */}
        <button
          type="button"
          onClick={screen}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-indigo-900/80 px-4 py-3.5 text-xs sm:text-sm font-bold text-indigo-100 shadow-xl shadow-indigo-950/50 transition hover:from-indigo-800 hover:to-purple-800 active:scale-98"
        >
          <Bot className="h-4 w-4 text-indigo-300" />
          <span>Screen Call with AI Assistant</span>
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
        </button>

        {/* Primary Large Call Actions */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {/* Decline */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={decline}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-950/60 active:scale-90 transition"
              aria-label={t('decline')}
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <span className="text-xs font-semibold text-slate-300">{t('decline')}</span>
          </div>

          {/* Quick Silence */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={silence}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg active:scale-90 transition"
              aria-label={silenced ? 'Silenced' : 'Silence'}
            >
              <VolumeX className="h-6 w-6" />
            </button>
            <span className="text-xs font-semibold text-slate-400">{silenced ? 'Silenced' : 'Silence'}</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={answer}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-950/60 active:scale-90 transition"
              aria-label={t('answer')}
            >
              <Phone className="h-7 w-7" />
            </button>
            <span className="text-xs font-semibold text-slate-300">{t('answer')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


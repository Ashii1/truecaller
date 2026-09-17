import { useEffect, useState } from 'react';
import { AlertTriangle, Bot, ChevronDown, Phone, PhoneOff, ShieldAlert, ShieldCheck, Sparkles, VolumeX } from 'lucide-react';
import { IncomingCallState, ScreeningTranscriptEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:pt-3">
      <section className="w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-700 bg-[#11161d] shadow-2xl" aria-label={t('incoming_call_title')}>
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
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
          <button onClick={() => { setSilenced(true); onDismiss(); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label={t('dismiss')}>
            <VolumeX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 pt-6 text-center">
          <div className={`mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full text-2xl font-bold ${critical ? 'bg-red-500/15 text-red-300' : suspicious ? 'bg-amber-500/15 text-amber-300' : 'bg-blue-500/15 text-blue-300'}`}>
            {(call.callerName || '?').slice(0, 1).toUpperCase()}
          </div>
          <h2 className="truncate text-2xl font-bold text-white">{call.callerName || t('unknown_caller')}</h2>
          <p className="mt-1 font-mono text-sm text-slate-400">{formatPhoneNumber(call.number)}</p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <span>{call.carrier || 'Cellular'}</span>
            <span>·</span>
            <span>{call.location || 'India'}</span>
          </div>

          {/* Neighbor Spoof High-Visibility Banner */}
          {call.isNeighborSpoof && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-left text-xs text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>Likely Spoofed (Neighbor Spoofing)</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
                This caller matches your area prefix but is not in your contacts. Scammers often fake local numbers to trick you into answering.
              </p>
            </div>
          )}

          {/* 1-Ring Ping-Back Scam Banner */}
          {call.isPingBackScam && (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-left text-xs text-rose-200">
              <div className="flex items-center gap-1.5 font-bold text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>1-Ring Callback Scam Trap</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">
                Likely Wangiri scam pattern. Automated dialers drop after 1 ring to trick you into calling back expensive premium numbers.
              </p>
            </div>
          )}

          {(critical || (suspicious && !call.isNeighborSpoof && !call.isPingBackScam)) && (
            <div className={`mt-4 rounded-2xl px-3 py-2.5 text-left text-xs ${critical ? 'bg-red-500/10 text-red-200' : 'bg-amber-500/10 text-amber-200'}`}>
              <div className="font-semibold">{critical ? 'Do not share OTPs, PINs or banking details.' : 'Review caller information before answering.'}</div>
              {countdown > 0 && <div className="mt-1 opacity-80">{t('auto_cancelling_in')} {countdown}{t('seconds_short')}.</div>}
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left text-xs text-slate-400">
              <div className="flex justify-between"><span>{t('carrier_label')}</span><span className="text-slate-200">{call.carrier || 'Cellular'}</span></div>
              <div className="flex justify-between"><span>{t('location_label')}</span><span className="max-w-[65%] text-right text-slate-200">{call.location || 'Unavailable'}</span></div>
              {call.reportsCount > 0 && <div className="flex justify-between"><span>{t('spam_reports_count')}</span><span className="text-slate-200">{call.reportsCount.toLocaleString()}</span></div>}
            </div>
          )}

          <button onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
            {t('caller_details')} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Prominent Screen Call Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={screen}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 px-4 py-3 text-xs font-bold text-indigo-100 shadow-lg shadow-indigo-950/50 transition hover:from-indigo-800/80 hover:to-purple-800/80 active:scale-98"
            >
              <Bot className="h-4 w-4 text-indigo-400" />
              <span>Screen Call with AI Assistant</span>
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            </button>
          </div>

          {/* Primary Answer & Decline Buttons */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={decline} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-rose-600 font-bold text-white hover:bg-rose-500 active:scale-95 transition">
              <PhoneOff className="h-5 w-5" /> {t('decline')}
            </button>
            <button onClick={answer} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 active:scale-95 transition">
              <Phone className="h-5 w-5" /> {t('answer')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


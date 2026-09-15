import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Phone, PhoneOff, ShieldCheck, VolumeX } from 'lucide-react';
import { IncomingCallState } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';

interface IncomingCallOverlayProps {
  call: IncomingCallState | null;
  autoCancelEnabled: boolean;
  onCancelCall: (reason: string, block: boolean) => void;
  onAnswerCall: () => void;
  onDismiss: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
}

export default function IncomingCallOverlay({ call, autoCancelEnabled, onCancelCall, onAnswerCall, onDismiss, onScreenCall }: IncomingCallOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const critical = !!call?.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM');
  const suspicious = !!call?.isSpam && !critical;

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

  if (!call || call.status !== 'RINGING') return null;

  const answer = () => { setSilenced(true); onAnswerCall(); };
  const decline = () => { setSilenced(true); onCancelCall('Declined by user', false); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:pt-3">
      <section className="w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-700 bg-[#11161d] shadow-2xl" aria-label="Incoming call">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {critical ? <AlertTriangle className="h-4 w-4 text-red-400" /> : suspicious ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-400" />}
            <span className={critical ? 'text-red-300' : suspicious ? 'text-amber-300' : 'text-emerald-300'}>
              {critical ? 'High risk caller' : suspicious ? 'Potential spam' : 'Incoming call'}
            </span>
          </div>
          <button onClick={() => { setSilenced(true); onDismiss(); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Dismiss">
            <VolumeX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 pt-6 text-center">
          <div className={`mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full text-2xl font-bold ${critical ? 'bg-red-500/15 text-red-300' : suspicious ? 'bg-amber-500/15 text-amber-300' : 'bg-blue-500/15 text-blue-300'}`}>
            {(call.callerName || '?').slice(0, 1).toUpperCase()}
          </div>
          <h2 className="truncate text-2xl font-bold text-white">{call.callerName || 'Unknown caller'}</h2>
          <p className="mt-1 font-mono text-sm text-slate-400">{formatPhoneNumber(call.number)}</p>

          {(critical || suspicious) && (
            <div className={`mt-4 rounded-2xl px-3 py-2.5 text-left text-xs ${critical ? 'bg-red-500/10 text-red-200' : 'bg-amber-500/10 text-amber-200'}`}>
              <div className="font-semibold">{critical ? 'Do not share OTPs, PINs or banking details.' : 'Review caller information before answering.'}</div>
              {countdown > 0 && <div className="mt-1 opacity-80">Auto-blocking high-confidence spam in {countdown}s.</div>}
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left text-xs text-slate-400">
              <div className="flex justify-between"><span>Carrier</span><span className="text-slate-200">{call.carrier || 'Cellular'}</span></div>
              <div className="flex justify-between"><span>Location</span><span className="max-w-[65%] text-right text-slate-200">{call.location || 'Unavailable'}</span></div>
              {call.reportsCount > 0 && <div className="flex justify-between"><span>Community reports</span><span className="text-slate-200">{call.reportsCount.toLocaleString()}</span></div>}
              {onScreenCall && <button onClick={() => onScreenCall(call)} className="mt-1 w-full rounded-xl border border-slate-700 px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800">Screen this call</button>}
            </div>
          )}

          <button onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white">
            More details <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={decline} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 font-bold text-white hover:bg-rose-500">
              <PhoneOff className="h-5 w-5" /> Decline
            </button>
            <button onClick={answer} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-bold text-white hover:bg-emerald-500">
              <Phone className="h-5 w-5" /> Answer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

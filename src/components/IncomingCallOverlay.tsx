import { useEffect, useState, useRef } from 'react';
import { 
  PhoneOff, 
  PhoneCall, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldBan,
  Volume2, 
  VolumeX, 
  MapPin, 
  Radio, 
  X,
  AlertTriangle,
  Building2,
  MessageSquare,
  Sparkles,
  Check,
  Send,
  Flag
} from 'lucide-react';
import { IncomingCallState } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playPhoneRing, playCallCancelledTone } from '../utils/audioAlerts';

interface IncomingCallOverlayProps {
  call: IncomingCallState | null;
  autoCancelEnabled: boolean;
  onCancelCall: (reason: string, block: boolean) => void;
  onAnswerCall: () => void;
  onDismiss: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
}

export default function IncomingCallOverlay({
  call,
  autoCancelEnabled,
  onCancelCall,
  onAnswerCall,
  onDismiss,
  onScreenCall,
}: IncomingCallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const [showQuickSms, setShowQuickSms] = useState(false);
  const [confirmDangerousAnswer, setConfirmDangerousAnswer] = useState(false);
  const ringControllerRef = useRef<{ stop: () => void } | null>(null);

  // Play audio ringtone when call starts
  useEffect(() => {
    if (!call || call.status !== 'RINGING') {
      if (ringControllerRef.current) {
        ringControllerRef.current.stop();
        ringControllerRef.current = null;
      }
      return;
    }

    if (!isMuted) {
      ringControllerRef.current = playPhoneRing();
    }

    return () => {
      if (ringControllerRef.current) {
        ringControllerRef.current.stop();
        ringControllerRef.current = null;
      }
    };
  }, [call?.status, isMuted]);

  // Handle Auto-Cancel countdown for High-Confidence Spam calls
  useEffect(() => {
    if (!call || call.status !== 'RINGING') return;

    if (call.isSpam && autoCancelEnabled) {
      setCountdown(2);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setAutoCancelled(true);
            if (ringControllerRef.current) {
              ringControllerRef.current.stop();
            }
            playCallCancelledTone();
            setTimeout(() => {
              onCancelCall(call.spamReason || 'Firewall auto-cancelled spam call', true);
            }, 600);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [call?.isSpam, call?.status, autoCancelEnabled]);

  if (!call || call.status !== 'RINGING') return null;

  const isCriticalScam = call.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM');
  const isSuspicious = call.isSpam && !isCriticalScam;
  const isSafe = !call.isSpam;

  const handleSendQuickMessage = (msg: string) => {
    if (ringControllerRef.current) {
      ringControllerRef.current.stop();
    }
    onCancelCall(`Declined with canned message: "${msg}"`, false);
  };

  const handleSilenceRingtone = () => {
    setIsMuted(true);
    if (ringControllerRef.current) {
      ringControllerRef.current.stop();
      ringControllerRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden text-white transition-all transform duration-300 scale-100 ${
          isCriticalScam
            ? 'bg-gradient-to-b from-red-950 via-slate-900 to-black border-red-500/70 shadow-red-950/80 ring-2 ring-red-500/40'
            : isSuspicious
            ? 'bg-gradient-to-b from-amber-950/90 via-slate-900 to-slate-950 border-amber-500/60 shadow-amber-950/60 ring-1 ring-amber-500/30'
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-700/80 shadow-slate-950/60'
        }`}
      >
        {/* Top Banner Bar */}
        <div className={`px-4 py-3 flex items-center justify-between text-xs font-semibold ${
          isCriticalScam
            ? 'bg-red-600/30 border-b border-red-500/40'
            : isSuspicious
            ? 'bg-amber-600/30 border-b border-amber-500/40'
            : 'bg-emerald-600/20 border-b border-emerald-500/30'
        }`}>
          <div className="flex items-center space-x-2">
            {isCriticalScam ? (
              <>
                <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-red-200 tracking-wide uppercase font-extrabold text-[11px]">
                  CRITICAL THREAT: SCAM DETECTED
                </span>
              </>
            ) : isSuspicious ? (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 tracking-wide uppercase font-extrabold text-[11px]">
                  SUSPECTED TELEMARKETING / SPAM
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-200 tracking-wide uppercase font-extrabold text-[11px]">
                  VERIFIED CALLER ID
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleSilenceRingtone}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 transition"
              title={isMuted ? 'Ringtone Silenced' : 'Silence Ringtone'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Close overlay"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Caller Identity Presentation Body */}
        <div className="p-6 text-center space-y-4">
          {/* Avatar with dynamic ring */}
          <div className="relative inline-block mx-auto">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold shadow-xl border-4 transition-all ${
                isCriticalScam
                  ? 'bg-red-600/20 border-red-500 text-red-300 ring-8 ring-red-500/20 animate-pulse'
                  : isSuspicious
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-8 ring-amber-500/20'
                  : 'bg-emerald-600/20 border-emerald-400 text-emerald-300 ring-8 ring-emerald-500/20'
              }`}
            >
              {isCriticalScam ? (
                <ShieldBan className="w-12 h-12 text-red-400" />
              ) : isSuspicious ? (
                <ShieldAlert className="w-12 h-12 text-amber-400" />
              ) : call.isVerifiedBusiness ? (
                <Building2 className="w-12 h-12 text-blue-400" />
              ) : (
                call.callerName.slice(0, 1).toUpperCase()
              )}
            </div>

            <span className={`absolute -bottom-1 -right-1 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow border ${
              isCriticalScam
                ? 'bg-red-600 border-red-400'
                : isSuspicious
                ? 'bg-amber-600 border-amber-400'
                : 'bg-emerald-600 border-emerald-400'
            }`}>
              {isCriticalScam ? 'Scam' : isSuspicious ? 'Spam' : 'Safe'}
            </span>
          </div>

          {/* Caller Identification Texts */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Incoming Call
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-1.5">
              <span>{call.callerName}</span>
              {call.isVerifiedBusiness && (
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
              )}
            </h2>
            <p className="text-base font-mono font-bold text-slate-200 mt-0.5">
              {formatPhoneNumber(call.number)}
            </p>
          </div>

          {/* Carrier & Location Metadata */}
          <div className="flex items-center justify-center space-x-3 text-xs text-slate-300 font-medium">
            <span className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{call.location}</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              <span>{call.carrier}</span>
            </span>
          </div>

          {/* SPECIFIC SCREEN 3: SAFE CALLER BANNER */}
          {isSafe && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 text-left space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-400">
                <Check className="w-4 h-4 shrink-0" />
                <span>🟢 Verified Safe Connection</span>
              </div>
              <p className="text-slate-300">
                {call.isVerifiedBusiness 
                  ? 'Official registered business partner. Authentic cryptographic Caller ID.'
                  : 'Known personal contact or subscriber with clean community reputation.'}
              </p>
            </div>
          )}

          {/* SPECIFIC SCREEN 4: SUSPICIOUS CALLER BANNER */}
          {isSuspicious && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-left space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">
                  🟠 Suspected {call.spamCategory || 'Telemarketing'}
                </span>
                <span className="font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 text-[10px]">
                  {call.riskScore}% Risk
                </span>
              </div>
              <p className="text-slate-300">{call.spamReason}</p>
              {call.reportsCount > 0 && (
                <div className="text-[11px] text-amber-400/90 pt-1 border-t border-amber-500/20">
                  Reported by {call.reportsCount.toLocaleString()} community users.
                </div>
              )}
              <div className="p-2 rounded-xl bg-amber-900/30 text-amber-200 text-[11px] font-medium flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>AI Recommendation: High chance of robocall. Decline recommended.</span>
              </div>
            </div>
          )}

          {/* SPECIFIC SCREEN 5: CRITICAL SCAM BANNER */}
          {isCriticalScam && (
            <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/60 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-red-300 text-sm flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>🔴 CRITICAL FRAUD THREAT</span>
                </span>
                <span className="font-bold text-red-200 px-2 py-0.5 rounded bg-red-600/30 text-[10px]">
                  {call.riskScore}% Scam
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-red-900/50 border border-red-500/40 font-bold text-red-200">
                ⚠️ Do not answer. Multiple users report financial fraud attempts impersonating bank security desks.
              </div>
              <p className="text-[11px] text-red-300">
                {call.spamReason}
              </p>
            </div>
          )}

          {/* Auto-Cancel Countdown Notice */}
          {call.isSpam && autoCancelEnabled && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center space-x-2 text-xs text-amber-300 font-semibold animate-pulse">
              <PhoneOff className="w-4 h-4" />
              <span>
                {autoCancelled 
                  ? 'Hangup signal sent! Dropping call...' 
                  : `Auto-dropping spam call in ${countdown}s (Zero ring)`}
              </span>
            </div>
          )}

          {/* Canned SMS Quick Modal Popover */}
          {showQuickSms && (
            <div className="p-3 rounded-2xl bg-slate-850 border border-slate-700 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>Quick SMS Response</span>
                <button onClick={() => setShowQuickSms(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {[
                  "Can't talk right now. What's up?",
                  "I'll call you back shortly.",
                  "In a meeting, please text me.",
                ].map((msg) => (
                  <button
                    key={msg}
                    onClick={() => handleSendQuickMessage(msg)}
                    className="w-full text-left p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center justify-between transition"
                  >
                    <span>{msg}</span>
                    <Send className="w-3 h-3 text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirm Dangerous Answer Dialog */}
          {confirmDangerousAnswer && (
            <div className="p-3 rounded-2xl bg-red-950 border border-red-500 space-y-2 text-xs text-left animate-in zoom-in-95">
              <div className="font-bold text-red-200">
                Are you sure you want to answer this high-risk scam call?
              </div>
              <p className="text-[11px] text-red-300">
                Never share OTPs, bank pins, or personal passwords with this caller.
              </p>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => setConfirmDangerousAnswer(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={onAnswerCall}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                >
                  Answer Anyway
                </button>
              </div>
            </div>
          )}

          {/* ACTION BUTTON CONTROLS BY CATEGORY */}
          {isCriticalScam ? (
            /* Screen 5: High Risk Scam Controls */
            <div className="space-y-2 pt-2">
              <button
                onClick={() => onCancelCall('Scam call cancelled, blocked, and reported', true)}
                className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-red-950/60 transition flex items-center justify-center space-x-2"
              >
                <ShieldBan className="w-5 h-5" />
                <span>BLOCK & REPORT THREAT</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSilenceRingtone}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition"
                >
                  Silence Ringtone
                </button>

                <button
                  onClick={() => setConfirmDangerousAnswer(true)}
                  className="py-2.5 rounded-xl bg-slate-900 border border-red-500/30 text-red-400 font-semibold text-xs hover:bg-red-950/40 transition"
                >
                  Answer Anyway...
                </button>
              </div>
            </div>
          ) : isSuspicious ? (
            /* Screen 4: Suspicious Caller Controls */
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onCancelCall('Suspicious telemarketing call declined & blocked', true)}
                  className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow"
                >
                  <ShieldBan className="w-4 h-4" />
                  <span>Decline & Block</span>
                </button>

                <button
                  onClick={() => onCancelCall('Declined by user', false)}
                  className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Decline</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (onScreenCall) onScreenCall(call);
                  }}
                  className="py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-semibold text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Screen with AI</span>
                </button>

                <button
                  onClick={onAnswerCall}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow transition"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Answer Call</span>
                </button>
              </div>
            </div>
          ) : (
            /* Screen 3: Safe / Known Caller Controls */
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onCancelCall('Declined call', false)}
                  className="py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-950/50 transition flex items-center justify-center space-x-2"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={onAnswerCall}
                  className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition flex items-center justify-center space-x-2"
                >
                  <PhoneCall className="w-5 h-5" />
                  <span>Answer</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowQuickSms(!showQuickSms)}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Quick Message</span>
                </button>

                <button
                  onClick={() => {
                    if (onScreenCall) onScreenCall(call);
                  }}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Screen Call</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

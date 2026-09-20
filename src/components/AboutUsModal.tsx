import {
  X,
  ShieldCheck,
  Cpu,
  Radio,
  Lock,
  Globe2,
  Code2,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';

interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutUsModal({ isOpen, onClose }: AboutUsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="About Us"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-750 bg-[#0c121d] text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">About CallShield OS</h2>
              <p className="text-[11px] text-slate-400">Privacy-First Intelligent Telecommunications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Hero Banner */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                <Sparkles className="h-2.5 w-2.5" />
                Release v2.4.0 Production Ready
              </span>
              <span className="text-[11px] font-mono text-slate-400">Build 2026.09</span>
            </div>
            <h3 className="mt-2 text-base font-bold text-white leading-tight">
              Defending personal telecommunications with intelligent on-device protection.
            </h3>
            <p className="mt-1 text-slate-300 leading-relaxed text-[11.5px]">
              CallShield was engineered to eliminate unwanted robocalls, aggressive telemarketer rings, and phishing scams. Combining a carrier-grade spam firewall with real-time conversational AI screening, it puts users firmly back in control of their calls.
            </p>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                <Lock className="h-3.5 w-3.5" />
                <span>Zero Telemetry</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Your contacts and call logs never leave your device. All matching is strictly local.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
                <Cpu className="h-3.5 w-3.5" />
                <span>Gemini Intelligence</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dynamic 2-way voice assistant that interacts naturally with unknown callers.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
                <Radio className="h-3.5 w-3.5" />
                <span>Telecom Bridge</span>
              </div>
              <p className="text-[11px] text-slate-400">
                W3C Web Telephony & native Android TelecomManager integration with dual-SIM.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                <Zap className="h-3.5 w-3.5" />
                <span>Sub-300ms Filter</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Instant pre-ring cluster cancellation for known fraud and telemarketing series.
              </p>
            </div>
          </div>

          {/* Compliance & Standards */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Telecom Standards & Architecture
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px]">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>FCC STIR/SHAKEN:</strong> Verifies cryptographic carrier token attestation (Levels A, B, C).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>TRAI Gateway Filters:</strong> Auto-flags unconsented 140/160 series promotional lines.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>W3C Telephony:</strong> Clean dual-SIM dialing, DTMF transmission, and call lifecycle states.</span>
              </li>
            </ul>
          </div>

          {/* Technology Credits */}
          <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-3 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-400" />
              <span>Developed with React, TypeScript, Tailwind CSS, and Google Gemini.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/90 px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>CallShield Telecommunications OS</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

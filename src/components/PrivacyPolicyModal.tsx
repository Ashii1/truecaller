import {
  X,
  ShieldCheck,
  Lock,
  EyeOff,
  Database,
  KeyRound,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Policy"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-750 bg-[#0c121d] text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Privacy Policy & Sovereignty</h2>
              <p className="text-[11px] text-slate-400">Zero-knowledge on-device data architecture</p>
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
          {/* Commitment Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Our Privacy Pledge: Your Calls & Contacts Are Private</span>
            </div>
            <p className="mt-1.5 text-slate-300 text-[11.5px] leading-relaxed">
              Unlike traditional caller-ID apps that scrape and harvest your entire address book into centralized marketing repositories, CallShield operates under a strict <strong>Zero-Harvesting Philosophy</strong>. Your personal data belongs exclusively to you.
            </p>
          </div>

          {/* Core Principles */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-1">
                <EyeOff className="h-4 w-4 text-indigo-400" />
                <span>1. 100% On-Device Contact Matching</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Contact names, phone numbers, and address books are queried entirely in local memory using native device APIs. No external server ever receives your contact list.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-1">
                <Database className="h-4 w-4 text-cyan-400" />
                <span>2. Local Storage & Zero External Tracking</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Your call history, custom firewall rules, whitelists, tags, and caller notes reside exclusively in your browser/device local sandbox. Clearing your app data permanently purges these records.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-1">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>3. Ephemeral AI Screening Privacy</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                When you invoke the AI Voice Screener, caller speech is processed strictly in real-time to generate screening transcripts and summaries. These transcripts are never used to train advertising models or sold to third parties.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold mb-1">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>4. Android Permissions Transparency</span>
              </div>
              <ul className="mt-1 space-y-1 text-slate-400 text-[11px]">
                <li>• <strong>READ_PHONE_STATE / CALL_PHONE:</strong> Required to detect incoming rings and initiate outgoing carrier calls.</li>
                <li>• <strong>READ_CONTACTS:</strong> Queried locally to display recognized names instead of raw digits.</li>
                <li>• <strong>RECORD_AUDIO:</strong> Only active when you explicitly press Call Recording or Voice Dictation.</li>
                <li>• <strong>POST_NOTIFICATIONS:</strong> Used to display the ongoing minimized call bar and missed spam alerts.</li>
              </ul>
            </div>
          </div>

          {/* Compliance Statement */}
          <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Compliant with GDPR, CCPA, and global telecommunications consumer rights standards.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/90 px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Last Updated: September 2026</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

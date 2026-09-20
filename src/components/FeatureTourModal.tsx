import { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Bot,
  ShieldCheck,
  PhoneCall,
  BellRing,
  FileText,
  Sparkles,
  CheckCircle2,
  Lock,
  Layers,
  Zap,
} from 'lucide-react';

interface FeatureTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScreeningDemo?: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: typeof ShieldCheck;
  iconBg: string;
  iconColor: string;
  description: string;
  highlights: { title: string; desc: string }[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Intelligent Spam & Scam Firewall',
    subtitle: 'Real-time carrier-grade cluster protection',
    badge: '4-Tier Threat Shield',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-500/20 border-emerald-500/40',
    iconColor: 'text-emerald-400',
    description:
      'CallShield inspects every inbound call against live 4-tier risk profiles (Safe, Verified, Suspicious, High-Risk Scam). High-confidence telemarketer bots are cancelled in under 300 milliseconds before your phone rings.',
    highlights: [
      { title: 'Series Cluster Blocking', desc: 'Block entire spam number ranges (e.g. +1 800 555-xxxx, TRAI 140/160 series).' },
      { title: 'STIR/SHAKEN Attestation', desc: 'Cryptographic carrier signature checks prevent caller ID spoofing.' },
      { title: 'Offline-First Rules Engine', desc: 'Custom rules, regex patterns, and whitelists run 100% on your device.' },
    ],
  },
  {
    title: 'Two-Way AI Voice Screener',
    subtitle: 'Gemini conversational intelligence for unknown callers',
    badge: 'Gemini 3.8 Powered',
    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: Bot,
    iconBg: 'bg-indigo-500/20 border-indigo-500/40',
    iconColor: 'text-indigo-400',
    description:
      'Never wonder who is calling again. The AI Gatekeeper answers unknown callers on your behalf, asks clarifying questions, listens to caller responses with real-time waveform visualization, and summarizes intent live.',
    highlights: [
      { title: 'Dynamic Conversations', desc: 'No canned scripts—Gemini adapts contextually to couriers, clinics, and banks.' },
      { title: 'Real-Time Audio Waveform', desc: 'Active ripple and frequency visualizers show ongoing voice activity.' },
      { title: '1-Tap Intercept', desc: 'Pick up the call anytime with full transcript context already on screen.' },
    ],
  },
  {
    title: 'Flexible Call Alerts: Heads-Up & Fullscreen',
    subtitle: 'Never interrupted while using your phone',
    badge: 'Smart Multitasking',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: BellRing,
    iconBg: 'bg-cyan-500/20 border-cyan-500/40',
    iconColor: 'text-cyan-400',
    description:
      'When your phone is in use, incoming calls appear as a discreet floating Heads-Up notification banner at the top of your screen. When locked or inactive, it displays an immersive fullscreen alert.',
    highlights: [
      { title: 'Minimizable Calls', desc: 'Collapse ringing or active calls into a floating status banner with 1 tap.' },
      { title: 'Notification Bar Details', desc: 'Caller name, risk score, and quick Answer/Decline/Mute stay visible.' },
      { title: 'Never Both at Once', desc: 'Clean, glitch-free presentation ensures popup and fullscreen never conflict.' },
    ],
  },
  {
    title: 'Smart Dialer & Dual-SIM Control',
    subtitle: 'Private dialing, T9 search, and directory verification',
    badge: 'Telecom Control',
    badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    icon: PhoneCall,
    iconBg: 'bg-blue-500/20 border-blue-500/40',
    iconColor: 'text-blue-400',
    description:
      'Seamlessly switch between SIM 1 and SIM 2 for both inbound and outbound calls. Dial privately with automatic *67 prefixing, and search your contacts or the CallShield verified directory in milliseconds.',
    highlights: [
      { title: 'Dual-SIM Selection', desc: 'Assign default SIM per contact or toggle on the fly before connecting.' },
      { title: 'Private Call Prefix', desc: 'Mask outbound caller ID with configurable telecom codes.' },
      { title: 'T9 Contact Lookup', desc: 'Type names using the numeric keypad for rapid one-handed dialing.' },
    ],
  },
  {
    title: 'Post-Call Intel & Persistent Notes',
    subtitle: 'Bullet summaries, intent tags, and synced caller notes',
    badge: 'Smart Organizer',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: FileText,
    iconBg: 'bg-amber-500/20 border-amber-500/40',
    iconColor: 'text-amber-400',
    description:
      'After every call or AI screening session, review bulleted conversational highlights, listen aloud with audio playback, tag the category, and save persistent notes that stay linked to the caller forever.',
    highlights: [
      { title: 'Persistent Notes Everywhere', desc: 'Notes saved in post-call, dialer, or logs synchronize seamlessly.' },
      { title: 'Audio Summary Playback', desc: 'Listen to AI-synthesized spoken highlights with animated waveforms.' },
      { title: '1-Tap Contact Creation', desc: 'Promote screened numbers directly into trusted contacts with saved notes.' },
    ],
  },
];

export default function FeatureTourModal({
  isOpen,
  onClose,
  onOpenScreeningDemo,
}: FeatureTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const IconComponent = step.icon;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Feature Tour"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-750 bg-[#0c121d] text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Progress & Close Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
              {currentStep + 1}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              of {TOUR_STEPS.length} · Feature Tour
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex h-1.5 w-full bg-slate-850">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`flex-1 transition-all cursor-pointer ${
                idx === currentStep
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                  : idx < currentStep
                  ? 'bg-indigo-700/60'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Header Card */}
          <div className="flex items-start gap-3.5">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${step.iconBg} ${step.iconColor}`}
            >
              <IconComponent className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${step.badgeColor}`}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {step.badge}
                </span>
              </div>
              <h3 className="mt-1 text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                {step.title}
              </h3>
              <p className="text-xs text-slate-400">{step.subtitle}</p>
            </div>
          </div>

          {/* Description Paragraph */}
          <p className="text-xs leading-relaxed text-slate-300 rounded-2xl bg-slate-900/60 border border-slate-800 p-3.5">
            {step.description}
          </p>

          {/* Key Feature Highlights */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Key Capabilities
            </div>
            <div className="space-y-2">
              {step.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-xs transition hover:border-slate-700"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <strong className="font-semibold text-slate-200">{h.title}: </strong>
                    <span className="text-slate-400">{h.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Action for AI Screening Step */}
          {currentStep === 1 && onOpenScreeningDemo && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-2">
              <div className="text-xs text-indigo-200">
                Want to test the AI voice screener right now?
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenScreeningDemo();
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition"
              >
                Try Live Demo
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/90 px-4 py-3 sm:px-5">
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={onClose}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                Skip Tour
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-950/60 transition"
            >
              <span>{isLast ? 'Get Started' : 'Next Feature'}</span>
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

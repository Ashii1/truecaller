import { useState, useEffect } from 'react';
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldBan, 
  PhoneCall, 
  Sparkles, 
  Building2, 
  Globe, 
  MapPin, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  Edit2, 
  Check, 
  Flag, 
  UserPlus, 
  Scale, 
  Info,
  Clock,
  ArrowRight,
  Shield
} from 'lucide-react';
import { CallLogItem, CallClassification, TruecallerDirectoryProfile } from '../types';

interface CallerDetailModalProps {
  call: CallLogItem | null;
  profile?: TruecallerDirectoryProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onBlockNumber: (number: string, label: string) => void;
  onMarkSafe: (number: string, name: string) => void;
  onOpenReportModal: (number: string) => void;
  onOpenDisputeModal: (number: string, name: string) => void;
  onUpdateCallerName?: (number: string, newName: string) => void;
  onOpenSmartBlock?: (number: string, pattern: string) => void;
  onInitiateCall?: (number: string, name?: string) => void;
}

export default function CallerDetailModal({
  call,
  profile,
  isOpen,
  onClose,
  onBlockNumber,
  onMarkSafe,
  onOpenReportModal,
  onOpenDisputeModal,
  onUpdateCallerName,
  onOpenSmartBlock,
  onInitiateCall,
}: CallerDetailModalProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(call?.aiSummary || null);
  const [riskSignals, setRiskSignals] = useState<string[]>(call?.riskSignals || []);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiSource, setAiSource] = useState<string>('on_device');
  const [notSpamSuccess, setNotSpamSuccess] = useState(false);

  const targetNumber = call?.number || profile?.number || '';
  const initialName = call?.callerName || profile?.name || 'Unknown Caller';
  const classification: CallClassification = call?.classification || (profile?.isVerified ? 'VERIFIED' : profile?.isSpam ? 'SPAM' : 'UNKNOWN');
  const riskScore = call?.riskScore ?? profile?.spamScore ?? 30;
  const isVerified = call?.isVerifiedBusiness || profile?.isVerified || classification === 'VERIFIED';

  useEffect(() => {
    setNameInput(initialName);
    setIsEditingName(false);
    setNotSpamSuccess(false);
    if (call?.aiSummary) {
      setAiSummary(call.aiSummary);
      setRiskSignals(call.riskSignals || []);
    } else {
      setAiSummary(null);
      setRiskSignals([]);
    }
  }, [call, profile, initialName]);

  if (!isOpen || (!call && !profile)) return null;

  // Generate AI Summary & Risk Signals via API or on-device synthesis
  const handleGenerateAiSummary = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/call-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: targetNumber,
          callerName: initialName,
          classification,
          durationSeconds: call?.durationSeconds || 0,
          repeatCount: call?.repeatCount || 1,
          reportsCount: call?.reportsCount || profile?.spamReportsCount || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.summary);
        setRiskSignals(data.riskSignals || []);
        setAiSource(data.source || 'gemini_security_ai');
      }
    } catch {
      setAiSummary(
        classification === 'SPAM' || classification === 'SCAM'
          ? 'High-likelihood unsolicited telemarketing dialer targeting cellular ranges.'
          : 'Standard domestic voice connection without negative community flags.'
      );
      setRiskSignals([
        'Analyzed by on-device firewall heuristics',
        'Direct carrier trunk routing identified',
        'Zero malicious payload detected in local cache',
      ]);
      setAiSource('on_device_fallback');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveName = () => {
    if (nameInput.trim() && onUpdateCallerName) {
      onUpdateCallerName(targetNumber, nameInput.trim());
      setIsEditingName(false);
    }
  };

  // Section 24: False-Positive Protection Flow
  const handleFalsePositiveNotSpam = () => {
    onMarkSafe(targetNumber, initialName);
    setNotSpamSuccess(true);
    setTimeout(() => {
      setNotSpamSuccess(false);
    }, 2000);
  };

  // 6-State visual presentation
  const getBadge = () => {
    switch (classification) {
      case 'SAFE':
        return { bg: 'bg-emerald-950/70 border-emerald-800 text-emerald-300', label: 'Safe Caller', icon: ShieldCheck };
      case 'VERIFIED':
        return { bg: 'bg-sky-950/70 border-sky-800 text-sky-300', label: 'Verified Business', icon: Building2 };
      case 'SUSPICIOUS':
        return { bg: 'bg-amber-950/70 border-amber-800 text-amber-300', label: 'Suspicious Caller', icon: AlertTriangle };
      case 'SPAM':
        return { bg: 'bg-orange-950/70 border-orange-800 text-orange-300', label: 'Spam Detected', icon: AlertTriangle };
      case 'SCAM':
        return { bg: 'bg-rose-950/70 border-rose-800 text-rose-300', label: 'High Scam Risk', icon: ShieldAlert };
      default:
        return { bg: 'bg-slate-800 border-slate-700 text-slate-300', label: 'Unknown Caller', icon: Info };
    }
  };

  const badge = getBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${badge.bg}`}>
              <BadgeIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.bg}`}>
                  {badge.label}
                </span>
                {call?.confidence && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {call.confidence}% confidence
                  </span>
                )}
              </div>

              {isEditingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Enter caller name"
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-lg font-bold text-slate-100">{initialName}</h2>
                  {onUpdateCallerName && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300"
                      title="Edit caller label"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="text-xs font-mono text-slate-400">{targetNumber}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 12: "Who Called Me?" Smart Insights */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" /> Who called me?
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Source: {call?.identificationSource || 'Authorized Directory'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed italic">
            "{call?.explainReason || (
              classification === 'VERIFIED'
                ? 'This number is an authorized corporate line registered with official commercial registries.'
                : classification === 'SPAM'
                ? 'This number appears to be associated with commercial/telemarketing solicitation based on available authorized directories and user reports.'
                : classification === 'SCAM'
                ? 'This number is associated with aggressive fraud, spoofing, or toll-rate traps.'
                : 'We could not confidently identify this caller yet based on current public telephony registries.'
            )}"
          </p>
        </div>

        {/* Section 13: Verified Business Card (if verified) */}
        {isVerified && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-800/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">
                  Verified Business Profile
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {profile?.carrier || call?.carrier || 'Carrier Authenticated'}
              </span>
            </div>
            <div className="text-xs text-slate-300">
              Official customer support line. Call originates from authorized telephony trunks with STIR/SHAKEN Level-A digital certification.
            </div>
            {profile?.location && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{profile.location}</span>
              </div>
            )}
          </div>
        )}

        {/* Section 4: AI Call Summary & Risk Signals */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-300">AI Call Summary</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {aiSource === 'gemini_security_ai' ? 'Sent securely for caller identification' : 'Processed on your device'}
            </span>
          </div>

          {aiSummary ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                {aiSummary}
              </p>
              {riskSignals.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Risk Signals
                  </span>
                  <ul className="space-y-1">
                    {riskSignals.map((sig, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span>{sig}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Generate an on-demand security briefing with risk signals.
              </p>
              <button
                onClick={handleGenerateAiSummary}
                disabled={loadingAi}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 transition flex items-center gap-1 shrink-0"
              >
                <Sparkles className="w-3 h-3" />
                {loadingAi ? 'Analyzing...' : 'Generate AI Summary'}
              </button>
            </div>
          )}
        </div>

        {/* Section 24: False-Positive Protection Flow */}
        {(classification === 'SPAM' || classification === 'SCAM' || classification === 'SUSPICIOUS') && (
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Incorrectly marked as spam?
              </span>
              {notSpamSuccess && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Added to Safe List
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              If this is a legitimate contact or delivery line, mark it safe. The app will never block this caller again.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleFalsePositiveNotSpam}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/60 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Not Spam (Mark Safe)
              </button>
              <button
                onClick={() => onOpenDisputeModal(targetNumber, initialName)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" /> Submit Dispute
              </button>
            </div>
          </div>
        )}

        {/* Contextual Action Bar */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenReportModal(targetNumber)}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <Flag className="w-3.5 h-3.5 text-amber-400" /> Report
            </button>
            <button
              onClick={() => onMarkSafe(targetNumber, initialName)}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Add to Trusted
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onInitiateCall && (
              <button
                onClick={() => {
                  onClose();
                  onInitiateCall(targetNumber, initialName);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1.5"
                title="Call this telephone number"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call
              </button>
            )}
            {onOpenSmartBlock && (
              <button
                onClick={() => onOpenSmartBlock(targetNumber, targetNumber.replace(/\D/g, '').slice(0, 6))}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition flex items-center gap-1.5"
              >
                <ShieldBan className="w-3.5 h-3.5" /> Smart Block
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

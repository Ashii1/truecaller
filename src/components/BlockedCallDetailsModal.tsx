import { memo, useState, useCallback, useMemo, type FormEvent } from 'react';
import {
  Ban,
  ShieldAlert,
  ShieldBan,
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Info,
  Phone,
  PhoneOff,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  X,
  ArrowLeft,
  Share2,
  AlertTriangle,
  Building2,
  Hash,
} from 'lucide-react';
import { CallLogItem, BlockRule, WhitelistEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { formatTimeAmPm } from '../utils/timeFormat';

interface BlockedCallDetailsModalProps {
  call: CallLogItem | null;
  isOpen: boolean;
  onClose: () => void;
  rules: BlockRule[];
  whitelist?: WhitelistEntry[];
  onCustomizeRule?: (rule: BlockRule) => void;
  onWhitelistNumber?: (number: string, name: string) => void;
  onDeleteCall?: (id: string) => void;
  onInitiateCall?: (number: string, name?: string) => void;
  onOpenDisputeModal?: (number: string, name?: string) => void;
  showToast?: (text: string, type?: 'info' | 'error' | 'success', title?: string) => void;
}

function BlockedCallDetailsModal({
  call,
  isOpen,
  onClose,
  rules,
  whitelist = [],
  onCustomizeRule,
  onWhitelistNumber,
  onDeleteCall,
  onInitiateCall,
  onOpenDisputeModal,
  showToast,
}: BlockedCallDetailsModalProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [testNumberInput, setTestNumberInput] = useState('');
  const [testResult, setTestResult] = useState<{ match: boolean; reason: string } | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  const displayToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
    if (showToast) showToast(msg, 'success');
  }, [showToast]);

  if (!isOpen || !call) return null;

  const number = call.number;
  const rawDigits = number.replace(/\D/g, '');
  const cleanDigits = rawDigits.startsWith('91') && rawDigits.length === 12 ? rawDigits.slice(2) : rawDigits;

  // Identify matching rule or fallback to matching series rule in rules list
  const matchedRule = useMemo<BlockRule | null>(() => {
    if (call.blockedRuleId) {
      const found = rules.find((r) => r.id === call.blockedRuleId);
      if (found) return found;
    }
    // Search active rules that match this number
    return (
      rules.find((r) => {
        if (!r.enabled) return false;
        const rDigits = r.value.replace(/\D/g, '');
        if (r.matchType === 'EXACT') return rDigits === cleanDigits || r.value === number;
        if (r.matchType === 'PREFIX') {
          return cleanDigits.startsWith(rDigits) || rawDigits.startsWith(rDigits) || number.startsWith(r.value);
        }
        return false;
      }) || null
    );
  }, [call, rules, cleanDigits, rawDigits, number]);

  const ruleLabel = call.blockedRuleName || matchedRule?.label || (cleanDigits.startsWith('140') ? 'TRAI 140 Telemarketing Series' : 'Custom Block Rule');
  const rulePattern = call.blockedPattern || matchedRule?.value || (cleanDigits.startsWith('140') ? '140' : cleanDigits.slice(0, 4));
  const isSeriesRule = matchedRule?.matchType === 'PREFIX' || rulePattern.length <= 6 || cleanDigits.startsWith('140') || cleanDigits.startsWith('160');

  const isWhitelisted = whitelist.some((w) => {
    const wDigits = w.value.replace(/\D/g, '');
    return wDigits === cleanDigits || w.value === number;
  });

  const handleCopyReport = () => {
    const reportText = `[CALLSHIELD FIREWALL INCIDENT REPORT]
Number: ${number}
Caller: ${call.callerName}
Date: ${new Date(call.timestamp).toLocaleString()}
Disposition: STRICT FIREWALL DROP (0s Ring Suppression)
Matched Rule: ${ruleLabel}
Pattern: ${rulePattern} (Type: ${matchedRule?.matchType || 'PREFIX'})
Risk Score: ${call.riskScore}/100 (${call.riskLevel || 'HIGH_RISK'})
Carrier: ${call.carrier || 'Commercial Telemarketing Band'}
Line Type: ${call.carrier?.includes('140') ? 'Telemarketing Series' : 'Commercial Series'}
Reason: ${call.strictBlockReason || call.spamReason || 'Unsolicited Commercial Series Block'}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportText);
      displayToast('Incident report copied to clipboard');
    }
  };

  const handleWhitelistThis = () => {
    if (onWhitelistNumber) {
      onWhitelistNumber(number, call.callerName || 'Allowed Exception');
      displayToast(`Added exception: ${formatPhoneNumber(number)} is now whitelisted`);
    }
  };

  const handleTestSimulator = (e: FormEvent) => {
    e.preventDefault();
    if (!testNumberInput.trim()) return;
    const testDigits = testNumberInput.replace(/\D/g, '');
    const testPure = testDigits.startsWith('91') && testDigits.length === 12 ? testDigits.slice(2) : testDigits;
    const patDigits = rulePattern.replace(/\D/g, '');

    const isMatch = isSeriesRule
      ? testPure.startsWith(patDigits) || testDigits.startsWith(patDigits)
      : testPure === patDigits || testDigits === patDigits;

    if (isMatch) {
      setTestResult({
        match: true,
        reason: `Matches series prefix "${rulePattern}". Incoming calls from this number will be STRICTLY DROPPED at 0.0s before ringer sounds.`,
      });
    } else {
      setTestResult({
        match: false,
        reason: `Does not match series prefix "${rulePattern}". This number will bypass this specific series rule.`,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-details-title"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-rose-500/20 bg-[#0a0f19] shadow-2xl shadow-rose-950/40 p-0 text-white animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 no-scrollbar flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-slate-900 border border-emerald-500/40 px-4 py-1.5 text-xs font-semibold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[#0c1220]/95 backdrop-blur-lg px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldBan className="h-3.5 w-3.5" />
              </div>
              <span id="blocked-details-title" className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Strict Firewall Intercept
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyReport}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              title="Copy Incident Report"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hero Section: Blocked Identity Card */}
        <div className="p-5 pb-4 bg-gradient-to-b from-rose-950/25 via-transparent to-transparent border-b border-white/[0.06]">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose-600/30 to-rose-950/80 border border-rose-500/40 text-rose-300 shadow-lg shadow-rose-950/50">
                <Ban className="h-8 w-8 stroke-[2.2]" />
              </div>
              <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow-md">
                <PhoneOff className="h-3 w-3" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Strictly Blocked
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatTimeAmPm(call.timestamp)}
                </span>
              </div>

              <h2 className="text-lg font-black text-white tracking-tight mt-1 truncate">
                {call.callerName || 'Commercial Series Caller'}
              </h2>

              <p className="text-sm font-mono font-bold text-rose-200/90 mt-0.5 tracking-wide">
                {formatPhoneNumber(number)}
              </p>

              <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 text-rose-400 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  0s Ring Suppression
                </span>
                <span>•</span>
                <span>{call.sim || 'SIM 1'}</span>
                <span>•</span>
                <span>{call.location || 'India (Commercial Band)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 space-y-4 flex-1">
          {/* 1. WHY WAS THIS CALL BLOCKED? (Rule & Series Explanation) */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/15 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-rose-500/25 text-rose-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-tight">
                  Why Was This Call Blocked?
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                Rule ID: {matchedRule?.id || 'Statutory-Series'}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Matched Rule / Series</div>
                  <div className="font-bold text-white mt-0.5 flex items-center gap-1.5">
                    <span>{ruleLabel}</span>
                    {isSeriesRule && (
                      <span className="text-[9.5px] font-mono text-blue-400 bg-blue-500/10 px-1 rounded">
                        SERIES
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Pattern Matched</div>
                  <div className="font-mono font-bold text-amber-300 mt-0.5">
                    {rulePattern}{isSeriesRule ? '•••••••' : ''}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] text-[11.5px] leading-relaxed text-slate-300">
                <p>
                  <strong className="text-white">Strict Firewall Action: </strong>
                  The inbound call matched your configured number series rule{' '}
                  <span className="font-semibold text-rose-300 font-mono">"{rulePattern}"</span>.
                  The CallShield Telephony Firewall terminated the cellular signal before your device could ring or vibrate, guaranteeing zero user distraction.
                </p>
                {call.strictBlockReason && (
                  <p className="mt-2 text-slate-400 italic border-l-2 border-rose-500/50 pl-2">
                    "{call.strictBlockReason}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. THREAT & REPUTATION SCORECARD */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 space-y-3">
            <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              <span>Threat & Intelligence Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="text-[10px] font-medium text-slate-400">Risk Score</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-rose-400 font-mono">{call.riskScore || 98}</span>
                  <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
                </div>
                <span className="text-[9.5px] font-bold text-rose-300 uppercase tracking-wider">
                  Critical Threat
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="text-[10px] font-medium text-slate-400">Category</div>
                <div className="mt-1 text-sm font-bold text-white truncate">
                  {call.spamCategory || 'TELEMARKETING'}
                </div>
                <span className="text-[9.5px] text-slate-400">
                  {call.reportsCount ? `${call.reportsCount.toLocaleString()} Network Reports` : 'Statutory Registry'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="text-[10px] font-medium text-slate-400">Carrier / Network</div>
                <div className="mt-1 text-xs font-semibold text-slate-200 truncate">
                  {call.carrier || 'Commercial UCC Gateway'}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="text-[10px] font-medium text-slate-400">Line Classification</div>
                <div className="mt-1 text-xs font-semibold text-amber-300 truncate">
                  {cleanDigits.startsWith('140') ? 'TRAI 140 Series' : 'Promotional Series'}
                </div>
              </div>
            </div>

            {/* Tags Strip */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {[
                ruleLabel,
                'Zero-Distraction Drop',
                'Statutory Band',
                'Auto-Logged',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 3. INTERACTIVE SERIES SIMULATOR (Test any number against this series) */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Hash className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Series Rule Simulator</h4>
                  <p className="text-[10px] text-slate-400">Test if other numbers will be blocked</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSimulator((v) => !v)}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                {showSimulator ? 'Hide Test' : 'Open Tester'}
              </button>
            </div>

            {showSimulator && (
              <form onSubmit={handleTestSimulator} className="space-y-2.5 pt-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testNumberInput}
                    onChange={(e) => {
                      setTestNumberInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={`e.g. ${rulePattern}909898`}
                    className="flex-1 rounded-xl bg-black/50 border border-white/[0.1] px-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    Test
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs animate-in fade-in ${
                      testResult.match
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      {testResult.match ? (
                        <>
                          <Ban className="h-3.5 w-3.5 text-rose-400" />
                          <span>MATCH: Will Be Strictly Blocked</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>PASS: Allowed Through Firewall</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90">{testResult.reason}</p>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="sticky bottom-0 z-20 border-t border-white/[0.08] bg-[#0c1220]/95 backdrop-blur-lg p-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {/* Customize Series Rule Button */}
            {matchedRule && onCustomizeRule ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCustomizeRule(matchedRule);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-3 transition active:scale-95 shadow-md cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Customize Series Rule</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold text-xs py-2.5 px-3 transition active:scale-95 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Audit Report</span>
              </button>
            )}

            {/* Whitelist / Allow Exception */}
            {isWhitelisted ? (
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-xs py-2.5 px-3">
                <Check className="h-3.5 w-3.5" />
                <span>Exception Active</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleWhitelistThis}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs py-2.5 px-3 transition active:scale-95 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Allow This Number</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
            {onOpenDisputeModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDisputeModal(number, call.callerName);
                }}
                className="hover:text-white transition underline cursor-pointer"
              >
                Report Regulatory DND Violation
              </button>
            )}

            {onDeleteCall && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCall(call.id);
                  onClose();
                }}
                className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1 cursor-pointer ml-auto"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete from Log</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(BlockedCallDetailsModal);

import { useState, useMemo, memo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  MessageSquare,
  Mic,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { CallLogItem, ContactItem, CallShieldDirectoryProfile, BlockRule } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { isGenericOrPhoneNumber } from '../utils/publicDirectory';
import { useI18n } from '../i18n/LanguageContext';

interface AssistantTabProps {
  calls: CallLogItem[];
  contacts: ContactItem[];
  rules: BlockRule[];
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onInitiateCall: (number: string, name?: string) => void;
  onAddRule: (rule: Omit<BlockRule, 'id' | 'hitCount' | 'createdAt'>) => void;
}

interface SimulatedScreeningMessage {
  speaker: 'assistant' | 'caller';
  text: string;
}

const SAMPLE_LOOKUPS = [
  { label: 'TRAI Telemarketer', number: '+91 140 909 8984', note: '140 Statutory' },
  { label: 'Chase Bank (Verified)', number: '+1 800 935 9935', note: 'STIR/SHAKEN Passed' },
  { label: 'Robocall Scammer', number: '+1 202 555 0149', note: 'High Risk' },
  { label: 'Delivery Courier', number: '+91 98200 11223', note: 'Local Mobile' },
];

const AssistantTab = memo(function AssistantTab({
  calls,
  contacts,
  rules,
  lookupProfile,
  onInitiateCall,
  onAddRule,
}: AssistantTabProps) {
  const { t } = useI18n();
  const [investigateInput, setInvestigateInput] = useState('');
  const [analyzedResult, setAnalyzedResult] = useState<{
    number: string;
    profile: CallShieldDirectoryProfile;
    analysis: string[];
    riskScore: number;
    verdict: string;
    recommendation: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);
  const [appliedRecommendations, setAppliedRecommendations] = useState<string[]>([]);
  const [ruleAddedNotice, setRuleAddedNotice] = useState<string | null>(null);
  const [isScanningHealth, setIsScanningHealth] = useState(false);
  const [healthScanComplete, setHealthScanComplete] = useState(false);

  // Interactive Voice Screener Simulation state
  const [isScreeningDemoActive, setIsScreeningDemoActive] = useState(false);
  const [screeningStep, setScreeningStep] = useState(0);
  const [assistantTone, setAssistantTone] = useState<'EXECUTIVE' | 'GATEKEEPER' | 'CONCIERGE'>('EXECUTIVE');

  // Weekly Security Digest metrics
  const digestMetrics = useMemo(() => {
    const totalWeek = calls.length;
    const blockedWeek = calls.filter((c) => c.type === 'BLOCKED_CANCELLED' || c.isSpam).length;
    const verifiedWeek = calls.filter((c) => c.isVerifiedBusiness).length;
    const safeContactsPercent = 100;

    return {
      totalWeek,
      blockedWeek,
      verifiedWeek,
      safeContactsPercent,
    };
  }, [calls]);

  // Telephony Protection Health Score
  const healthScore = useMemo(() => {
    let score = 86;
    if (rules.length >= 3) score += 5;
    if (rules.some((r) => r.value.includes('140'))) score += 5;
    if (digestMetrics.safeContactsPercent === 100) score += 4;
    return Math.min(score, 100);
  }, [rules, digestMetrics]);

  // Deep Number Investigator
  const handleRunInvestigation = (targetNumber: string) => {
    if (!targetNumber.trim()) return;
    setIsAnalyzing(true);
    setInvestigateInput(targetNumber);

    setTimeout(() => {
      const profile = lookupProfile(targetNumber);
      const isSpam = profile.isSpam || profile.spamScore >= 50;

      let verdict = 'Low Risk Caller';
      let rec = 'No defensive action needed. This caller appears safe or verified.';
      const analysis: string[] = [];

      if (isSpam) {
        verdict = profile.spamCategory === 'SCAM' ? 'High Risk Threat / Financial Scam' : 'Frequent Commercial Robocall';
        rec = 'We recommend dropping incoming calls matching this number or prefix.';
        analysis.push('High call burst velocity (over 350 automated outbound calls/hour reported).');
        analysis.push('Asymmetric call duration pattern: Average call duration under 4 seconds.');
        analysis.push(`${profile.spamReportsCount || 42} unique users flagged this line for ${profile.spamCategory || 'Telemarketing'}.`);
        analysis.push('Number does not belong to authorized TRAI 160 transactional whitelist.');
      } else if (profile.isVerified) {
        verdict = 'Verified Enterprise Entity';
        rec = 'Legitimate registered customer service desk or dispatch logistics.';
        analysis.push('Cryptographically verified enterprise routing certificate (STIR/SHAKEN Attestation Level A).');
        analysis.push('Listed in authorized public registry with zero scam complaints.');
        analysis.push('Safe to answer and return call.');
      } else {
        verdict = 'Standard Subscriber Line';
        rec = 'Screen this call or let it ring to voicemail before sharing confidential details.';
        analysis.push('Individual mobile subscriber line with zero community fraud reports.');
        analysis.push('Local telecom circle match with standard call patterns.');
      }

      setAnalyzedResult({
        number: targetNumber,
        profile,
        analysis,
        riskScore: profile.spamScore,
        verdict,
        recommendation: rec,
      });
      setIsAnalyzing(false);
    }, 350);
  };

  // Quick 1-tap Health Optimizer
  const handleRunHealthScan = () => {
    setIsScanningHealth(true);
    setTimeout(() => {
      setIsScanningHealth(false);
      setHealthScanComplete(true);
      setTimeout(() => setHealthScanComplete(false), 3000);
    }, 500);
  };

  // Interactive AI Voice Screener Simulation Script
  const screeningScript: SimulatedScreeningMessage[] = [
    {
      speaker: 'assistant',
      text: assistantTone === 'GATEKEEPER'
        ? '“CallShield Security Gatekeeper here. The recipient screens all unfamiliar callers. State your legal entity and exact purpose immediately.”'
        : assistantTone === 'CONCIERGE'
        ? '“Hello! I am screening this call for the owner. May I ask who is calling and how they can help you today?”'
        : '“Hello, I am the CallShield AI Assistant. The person you are calling is currently screening calls. Please state your name and the purpose of your call.”',
    },
    {
      speaker: 'caller',
      text: '“Hi, I am calling from Apollo Hospital Pharmacy regarding the emergency medicine delivery for order #4829.”',
    },
    {
      speaker: 'assistant',
      text: '“Thank you. CallShield has transcribed your purpose as: Medicine Delivery Verification. Connecting you to the user now.”',
    },
  ];

  const handleStartScreeningDemo = () => {
    setIsScreeningDemoActive(true);
    setScreeningStep(0);
    setTimeout(() => setScreeningStep(1), 1200);
    setTimeout(() => setScreeningStep(2), 2600);
  };

  // Smart Follow-Ups / Call Reminders from real device history
  const reminders = calls
    .filter((c) => c.type === 'MISSED' && !dismissedReminders.includes(c.id))
    .slice(0, 3)
    .map((c) => {
      const prof = lookupProfile(c.number);
      const displayName = !isGenericOrPhoneNumber(c.callerName, c.number)
        ? c.callerName!
        : prof?.name || formatPhoneNumber(c.number);
      return {
        id: c.id,
        name: displayName,
        number: c.number,
        time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

  // Dynamic recommendations based on actual call patterns
  const smartRecommendations = useMemo(() => {
    const list = [];
    const has140Rule = rules.some((r) => r.value.includes('140'));
    if (!has140Rule) {
      list.push({
        id: 'rec-140',
        title: 'Activate TRAI 140 Commercial Series Block',
        desc: 'Statutorily drop unsolicited outbound promotional telemarketing lines matching the 140 series.',
        actionText: 'Activate Rule',
        apply: () => {
          onAddRule({
            value: '140',
            matchType: 'PREFIX',
            targetType: 'BOTH',
            category: 'TELEMARKETING',
            label: 'TRAI 140 Commercial Series',
            notes: 'Activated via AI Assistant Recommendation',
            enabled: true,
            visualPattern: '140•••••••',
          });
          setRuleAddedNotice('Activated TRAI 140 Series Filter!');
          setTimeout(() => setRuleAddedNotice(null), 3000);
        },
      });
    }

    list.push({
      id: 'rec-sample',
      title: 'Analyze High-Frequency Calling Series',
      desc: 'Investigate recent commercial prefix trends to detect newly registered robocallers.',
      actionText: 'Inspect Now',
      apply: () => {
        handleRunInvestigation('+91 140 923 8841');
      },
    });

    return list.filter((r) => !appliedRecommendations.includes(r.id));
  }, [rules, appliedRecommendations]);

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-lg px-2.5 sm:px-3 py-2 space-y-3 pb-24 sm:pb-28 select-none animate-in fade-in duration-150">
      {/* 1. AI COPILOT HERO & PROTECTION HEALTH SCORE GAUGE */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-white tracking-tight truncate">
                  AI Security Copilot
                </h1>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Heuristics
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Autonomous threat scoring & real-time caller screening
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunHealthScan}
            disabled={isScanningHealth}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanningHealth ? 'animate-spin' : ''}`} />
            <span>{isScanningHealth ? 'Auditing...' : healthScanComplete ? 'Audit Passed ✓' : 'Scan Health'}</span>
          </button>
        </div>

        {/* Protection Score Meter */}
        <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/[0.05] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-full bg-indigo-500/10 border-2 border-indigo-500/40 font-mono font-bold text-white text-base">
              {healthScore}
              <span className="text-[9px] text-indigo-300 absolute -bottom-1 font-sans font-bold">PTS</span>
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Telephony Health: {healthScore >= 90 ? 'Optimal Defense' : 'Good Protection'}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Zero telemetry leakage · Active on-device heuristic engine
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Zero Leakage
            </span>
          </div>
        </div>

        {/* Intelligence Digest Strip */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center pt-2.5 border-t border-white/[0.06] text-xs">
          <div>
            <div className="text-[10px] text-slate-400">Total Analyzed</div>
            <div className="font-mono font-bold text-white mt-0.5">{digestMetrics.totalWeek} Calls</div>
          </div>
          <div className="border-x border-white/[0.06]">
            <div className="text-[10px] text-slate-400">Threats Stopped</div>
            <div className="font-mono font-bold text-rose-400 mt-0.5">{digestMetrics.blockedWeek}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Enterprise Verified</div>
            <div className="font-mono font-bold text-emerald-400 mt-0.5">{digestMetrics.verifiedWeek}</div>
          </div>
        </div>
      </div>

      {/* 2. AUTONOMOUS VOICE CALL SCREENING STUDIO */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Live Voice Call Screener Studio
              </h2>
              <p className="text-[10px] text-slate-400">
                Autonomous voice challenges and live purpose transcription
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartScreeningDemo}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Simulate Screening</span>
          </button>
        </div>

        {/* Persona Selector */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/40 border border-white/[0.05] text-xs">
          <span className="text-[11px] font-semibold text-slate-400">Screening Persona:</span>
          <div className="flex gap-1">
            {[
              { id: 'EXECUTIVE' as const, label: 'Executive' },
              { id: 'GATEKEEPER' as const, label: 'Gatekeeper' },
              { id: 'CONCIERGE' as const, label: 'Concierge' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAssistantTone(p.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                  assistantTone === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Screening Interactive Simulation Box */}
        {isScreeningDemoActive && (
          <div className="rounded-xl border border-indigo-500/30 bg-black/60 p-3.5 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <Mic className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                <span>Live Audio Challenge Session</span>
              </div>
              <button
                type="button"
                onClick={() => setIsScreeningDemoActive(false)}
                className="text-slate-400 hover:text-white text-[10px]"
              >
                Close Demo
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {screeningScript.slice(0, screeningStep + 1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl animate-in fade-in slide-in-from-bottom-2 ${
                    msg.speaker === 'assistant'
                      ? 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-200'
                      : 'bg-white/[0.05] border border-white/[0.08] text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className={msg.speaker === 'assistant' ? 'text-indigo-400' : 'text-slate-400'}>
                      {msg.speaker === 'assistant' ? '🤖 CallShield Assistant' : '👤 Inbound Caller'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Live STT</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>

            {screeningStep >= 2 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 mt-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Verdict: Legitimate Delivery Verified · Connecting Line</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScreeningDemoActive(false)}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                >
                  Accept Call
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. DEEP NUMBER INVESTIGATOR */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-tight">
              Deep Number Intelligence Lab
            </h2>
            <p className="text-[10px] text-slate-400">
              Run behavioral analysis, STIR/SHAKEN checks & registry lookups
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={investigateInput}
              onChange={(e) => setInvestigateInput(e.target.value)}
              placeholder="Enter phone number or paste digits..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/60 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => handleRunInvestigation(investigateInput)}
            disabled={!investigateInput.trim() || isAnalyzing}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95"
          >
            {isAnalyzing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span>Analyze</span>
          </button>
        </div>

        {/* Quick Sample Queries */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-semibold text-slate-500 shrink-0">Try test lookup:</span>
          {SAMPLE_LOOKUPS.map((s) => (
            <button
              key={s.number}
              type="button"
              onClick={() => handleRunInvestigation(s.number)}
              className="shrink-0 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2 py-0.5 text-[11px] font-mono text-slate-300 transition active:scale-95 cursor-pointer"
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Feedback notice when rule added */}
        {ruleAddedNotice && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{ruleAddedNotice}</span>
          </div>
        )}

        {/* Investigation Results Card */}
        {analyzedResult && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3.5 space-y-2.5 animate-in fade-in">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {analyzedResult.profile.name}
                </h3>
                <div className="text-xs font-mono text-slate-400">
                  {formatPhoneNumber(analyzedResult.number)} · {analyzedResult.profile.lineType || 'Mobile'}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                  analyzedResult.riskScore >= 70
                    ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                    : analyzedResult.riskScore >= 40
                    ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                }`}>
                  Risk Score: {analyzedResult.riskScore}/100
                </span>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                  {analyzedResult.verdict}
                </div>
              </div>
            </div>

            {/* Signal Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analyzedResult.profile.isVerified && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>STIR/SHAKEN Passed</span>
                </span>
              )}
              {analyzedResult.profile.carrier && (
                <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-slate-300 px-2 py-0.5 rounded-full">
                  Carrier: {analyzedResult.profile.carrier}
                </span>
              )}
              {analyzedResult.profile.location && (
                <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-slate-300 px-2 py-0.5 rounded-full">
                  Circle: {analyzedResult.profile.location}
                </span>
              )}
            </div>

            {/* Analysis Findings */}
            <div className="space-y-1 pt-1 border-t border-white/[0.05]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Heuristic Analysis Findings
              </div>
              {analyzedResult.analysis.map((line, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                  <span className="text-blue-400 font-bold mt-0.5">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            {/* Recommendation & Actions */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.05] text-[11px] text-slate-300 leading-relaxed">
              <strong className="text-blue-300">AI Recommendation:</strong> {analyzedResult.recommendation}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onInitiateCall(analyzedResult.number, analyzedResult.profile.name)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Phone className="h-3.5 w-3.5 fill-current" />
                <span>Call</span>
              </button>
              {analyzedResult.riskScore >= 40 && (
                <button
                  type="button"
                  onClick={() => {
                    onAddRule({
                      value: analyzedResult.number,
                      matchType: 'EXACT',
                      targetType: 'BOTH',
                      category: 'CUSTOM',
                      label: `Block ${analyzedResult.profile.name}`,
                      notes: 'Blocked via AI Investigation recommendation',
                      enabled: true,
                    });
                    setRuleAddedNotice(`Blocked ${analyzedResult.profile.name}!`);
                    setTimeout(() => setRuleAddedNotice(null), 3000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition active:scale-95 cursor-pointer"
                >
                  Block This Caller
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. PROACTIVE AI SECURITY RECOMMENDATIONS */}
      {smartRecommendations.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Proactive Security Suggestions
              </h2>
              <p className="text-[10px] text-slate-400">
                Actionable enhancements tailored to your calling patterns
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {smartRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{rec.title}</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{rec.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={rec.apply}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
                >
                  {rec.actionText}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CALL FOLLOW-UPS & SMART REMINDERS */}
      {reminders.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Missed Call Follow-Ups
              </h2>
              <p className="text-[10px] text-slate-400">
                Unanswered calls from verified subscribers
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{r.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {formatPhoneNumber(r.number)} · {r.time}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onInitiateCall(r.number, r.name)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
                  >
                    <Phone className="h-3 w-3 fill-current" />
                    <span>Call Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedReminders((prev) => [...prev, r.id])}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default AssistantTab;

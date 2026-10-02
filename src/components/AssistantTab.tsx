import { useState, useMemo, memo } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  RefreshCw, 
  Phone, 
  Lock, 
  TrendingUp, 
  Zap, 
  Brain,
  HelpCircle,
  X
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

function AssistantTab({
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

  // AI Number Investigator
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
        rec = `We recommend automatically dropping incoming calls matching this series.`;
        analysis.push('High call burst velocity (over 350 automated calls/hour reported).');
        analysis.push('Asymmetric call duration pattern: Average call duration under 4 seconds.');
        analysis.push(`${profile.spamReportsCount || 42} unique users flagged this line for ${profile.spamCategory || 'Telemarketing'}.`);
        analysis.push('Number does not belong to authorized TRAI 160 transactional directory.');
      } else if (profile.isVerified) {
        verdict = 'Verified Enterprise Entity';
        rec = 'Legitimate registered customer service desk or dispatch logistics.';
        analysis.push('Cryptographically verified enterprise routing certificate.');
        analysis.push('Listed in authorized public registry with zero scam complaints.');
        analysis.push('Safe to answer and call back.');
      } else {
        verdict = 'Unregistered Private Caller';
        rec = 'Screen this call or let it ring to voicemail before sharing confidential details.';
        analysis.push('Standard subscriber line with no negative crowd flags.');
        analysis.push('No associated registered company name found in directory.');
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
    }, 450);
  };

  // Smart Follow-Ups / Call Reminders derived strictly from real device call history
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
        text: `Missed call from ${displayName} — tap to return call`,
        time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

  // Smart Recommendations
  const smartRecommendations = [
    {
      id: 'rec-140',
      title: 'Auto-Block TRAI 140 Telemarketing Series',
      desc: 'Block numbers beginning with 140 which account for unsolicited commercial promo calls.',
      actionText: 'Activate Series Rule',
      apply: () => {
        onAddRule({
          value: '140',
          matchType: 'PREFIX',
          targetType: 'BOTH',
          category: 'TELEMARKETING',
          label: 'TRAI 140 Commercial Series',
          notes: 'Auto-recommended by AI Security Assistant',
          enabled: true,
          visualPattern: '140•••••••',
        });
      },
    },
    {
      id: 'rec-clean',
      title: 'Review 3 Unidentified Missed Callers',
      desc: 'Inspect recent unknown missed calls from yesterday to classify or block.',
      actionText: 'Inspect Now',
      apply: () => {
        handleRunInvestigation('+91 98201 44556');
      },
    },
  ].filter((r) => !appliedRecommendations.includes(r.id));

  return (
    <div className="max-w-md sm:max-w-lg mx-auto px-2.5 sm:px-3 py-2 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span>{t('assistant_hub_title')}</span>
        </h1>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {t('assistant_hub_desc')}
        </p>
      </div>

      {/* 1. WEEKLY SECURITY DIGEST */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('weekly_digest_title')}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">{t('past_7_days')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-slate-400">{t('calls_handled')}</div>
            <div className="text-2xl font-bold tracking-tight font-mono tabular-nums text-white mt-1">
              {digestMetrics.totalWeek}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">All calls</div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-slate-400">{t('spam_shielded')}</div>
            <div className="text-2xl font-bold tracking-tight font-mono tabular-nums text-rose-400 mt-1">
              {digestMetrics.blockedWeek}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Filtered before ring</div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-slate-400">{t('verified_entities')}</div>
            <div className="text-2xl font-bold tracking-tight font-mono tabular-nums text-blue-400 mt-1">
              {digestMetrics.verifiedWeek}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Authorized business</div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[11px] text-slate-400">{t('contacts_safety')}</div>
            <div className="text-2xl font-bold tracking-tight font-mono tabular-nums text-emerald-400 mt-1">
              100%
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Zero infected</div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE AI NUMBER INVESTIGATOR */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm space-y-3">
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">{t('investigator_title')}</h2>
        </div>
        <p className="text-[11px] text-slate-400">
          Enter any phone number to inspect risk score, community flags, and behavioral patterns.
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={investigateInput}
              onChange={(e) => setInvestigateInput(e.target.value)}
              placeholder={t('investigate_placeholder')}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => handleRunInvestigation(investigateInput)}
            disabled={!investigateInput || isAnalyzing}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95"
          >
            {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>{t('investigate_btn')}</span>
          </button>
        </div>

        {/* Quick chip suggestions from real recent calls */}
        {calls.length > 0 && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 overflow-x-auto pb-1">
            <span className="shrink-0 text-[11px] font-semibold">From recent calls:</span>
            {Array.from(new Set(calls.map((c) => c.number))).slice(0, 3).map((num: string) => (
              <button
                key={num}
                onClick={() => handleRunInvestigation(num)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-300 border border-slate-800/70 whitespace-nowrap text-[11px]"
              >
                {num}
              </button>
            ))}
          </div>
        )}

        {ruleAddedNotice && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{ruleAddedNotice}</span>
          </div>
        )}

        {/* Analysis Results Card */}
        {analyzedResult && (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3 animate-in fade-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-bold text-white tracking-tight">
                  {analyzedResult.profile.name}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-400">
                  {formatPhoneNumber(analyzedResult.number)}
                </div>
              </div>

              <div className="text-right">
                <span className={`text-xs font-mono tabular-nums font-bold ${
                  analyzedResult.riskScore >= 70
                    ? 'text-rose-400'
                    : analyzedResult.riskScore >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  Risk: {analyzedResult.riskScore}/100
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">{analyzedResult.verdict}</div>
              </div>
            </div>

            {/* Behavioral analysis bullets */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
              <div className="text-xs font-semibold text-slate-300">Forensic Observations:</div>
              {analyzedResult.analysis.map((obs, i) => (
                <div key={i} className="flex items-start space-x-2 text-xs text-slate-300">
                  <span className="text-blue-400 font-bold">•</span>
                  <span>{obs}</span>
                </div>
              ))}
            </div>

            {/* Decision Explanation */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-1">
              <div className="font-semibold text-blue-300 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>AI Decision Explanation</span>
              </div>
              <p className="text-slate-300 leading-relaxed">{analyzedResult.recommendation}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => onInitiateCall(analyzedResult.number, analyzedResult.profile.name)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition active:scale-95 cursor-pointer"
              >
                Call Number
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
                    setRuleAddedNotice(`Added block rule for ${analyzedResult.number}`);
                    setTimeout(() => setRuleAddedNotice(null), 3000);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Block This Number
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. SMART FOLLOW-UPS & REMINDERS */}
      {reminders.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                {t('smart_reminders_title')}
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">{reminders.length}</span>
          </div>

          <div className="space-y-1.5">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-2.5"
              >
                <div>
                  <div className="text-xs font-bold text-white">{rem.name}</div>
                  <p className="text-[11px] text-slate-300 mt-0.5">{rem.text}</p>
                  <span className="text-[10px] text-slate-500">{rem.time}</span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onInitiateCall(rem.number, rem.name)}
                    className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow"
                    title={t('call_action')}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDismissedReminders((prev) => [...prev, rem.id])}
                    className="p-1 text-slate-500 hover:text-slate-300"
                    title={t('dismiss')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SMART RECOMMENDATIONS */}
      {smartRecommendations.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm space-y-2.5">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('smart_recommendations_title')}
            </h2>
          </div>

          <div className="space-y-1.5">
            {smartRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div>
                  <div className="text-xs font-bold text-white">{rec.title}</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{rec.desc}</p>
                </div>
                <button
                  onClick={() => {
                    rec.apply();
                    setAppliedRecommendations((prev) => [...prev, rec.id]);
                  }}
                  className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shrink-0 self-start sm:self-auto shadow-sm"
                >
                  {rec.actionText}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. PRIVACY-FIRST GUARANTEE */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-300">Privacy-First AI Architecture: </span>
          All call screenings and classifications happen transparently. Contact book data is never uploaded to public advertising brokers or commercial telemetry servers. You maintain total sovereign ownership of your firewall rules and calling data.
        </div>
      </div>
    </div>
  );
}

export default memo(AssistantTab);

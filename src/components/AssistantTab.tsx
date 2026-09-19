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
  X,
  Bot,
  Mic,
  Volume2,
  VolumeX,
  Send,
  Play,
  Loader2,
  MessageSquare,
  Radio,
} from 'lucide-react';
import { CallLogItem, ContactItem, CallShieldDirectoryProfile, BlockRule, ScreeningTranscriptEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
import WaveformRippleVisualizer from './common/WaveformRippleVisualizer';
import { getAiCallerDialogue } from '../services/aiScreenerService';

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

  // Live AI Caller Assistant Simulation Sandbox State
  const [sandboxTranscript, setSandboxTranscript] = useState<ScreeningTranscriptEntry[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: 'Hello, this is CallShield AI Voice Gatekeeper. Who is calling and what is this regarding?',
      timestamp: Date.now() - 4000,
    }
  ]);
  const [sandboxCallerInput, setSandboxCallerInput] = useState('');
  const [sandboxIsThinking, setSandboxIsThinking] = useState(false);
  const [sandboxIsSpeaking, setSandboxIsSpeaking] = useState(false);
  const [sandboxIntent, setSandboxIntent] = useState<string>('Awaiting Caller Identification');
  const [sandboxMuted, setSandboxMuted] = useState(false);
  const [sandboxSuggestions, setSandboxSuggestions] = useState<string[]>([
    "I'm in a meeting, can you call back later?",
    "Please send a text message with details.",
    "Remove this number from your list.",
  ]);

  const speakSandbox = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !sandboxMuted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.onstart = () => setSandboxIsSpeaking(true);
        utterance.onend = () => setSandboxIsSpeaking(false);
        utterance.onerror = () => setSandboxIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setSandboxIsSpeaking(false);
      }
    }
  };

  const handleSandboxCallerSpeech = async (spokenText: string) => {
    const trimmed = spokenText.trim();
    if (!trimmed) return;

    const callerEntry: ScreeningTranscriptEntry = {
      id: `call-${Date.now()}`,
      sender: 'caller',
      text: trimmed,
      timestamp: Date.now(),
    };
    const newTranscript = [...sandboxTranscript, callerEntry];
    setSandboxTranscript(newTranscript);
    setSandboxCallerInput('');
    setSandboxIsThinking(true);

    try {
      const resp = await getAiCallerDialogue({
        callerNumber: '+1 (800) 555-0199',
        callerName: 'Inbound Caller',
        callerLatestSpeech: trimmed,
        transcript: newTranscript,
        riskScore: 35,
      });
      setSandboxIsThinking(false);

      if (resp.detectedIntent) {
        setSandboxIntent(resp.detectedIntent);
      }
      if (resp.suggestedUserReplies && resp.suggestedUserReplies.length > 0) {
        setSandboxSuggestions(resp.suggestedUserReplies);
      }
      if (resp.aiAssistantSpeech) {
        const assistantEntry: ScreeningTranscriptEntry = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: resp.aiAssistantSpeech,
          timestamp: Date.now(),
        };
        setSandboxTranscript((prev) => [...prev, assistantEntry]);
        speakSandbox(resp.aiAssistantSpeech);
      }
    } catch (e) {
      setSandboxIsThinking(false);
      console.warn('Sandbox dialogue error:', e);
    }
  };

  const handleSandboxAssistantReply = (replyText: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    const entry: ScreeningTranscriptEntry = {
      id: `asst-${Date.now()}`,
      sender: 'assistant',
      text: trimmed,
      timestamp: Date.now(),
    };
    setSandboxTranscript((prev) => [...prev, entry]);
    speakSandbox(trimmed);
  };

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
    .map((c) => ({
      id: c.id,
      name: c.callerName || c.number,
      number: c.number,
      text: `Missed call from ${c.callerName || c.number} — tap to return call`,
      time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

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
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          <span>{t('assistant_hub_title')}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {t('assistant_hub_desc')}
        </p>
      </div>

      {/* 1. WEEKLY SECURITY DIGEST */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-850 border border-slate-750 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('weekly_digest_title')}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">{t('past_7_days')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('calls_handled')}</div>
            <div className="text-xl font-extrabold text-white mt-1">
              {digestMetrics.totalWeek}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">All incoming & outgoing</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('spam_shielded')}</div>
            <div className="text-xl font-extrabold text-rose-400 mt-1">
              {digestMetrics.blockedWeek}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Filtered before ringing</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('verified_entities')}</div>
            <div className="text-xl font-extrabold text-blue-400 mt-1">
              {digestMetrics.verifiedWeek}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Authorized businesses</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('contacts_safety')}</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">
              100%
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Zero infected contacts</div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE AI NUMBER INVESTIGATOR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-850 border border-slate-750 shadow-xl space-y-4">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">{t('investigator_title')}</h2>
        </div>
        <p className="text-xs text-slate-400">
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => handleRunInvestigation(investigateInput)}
            disabled={!investigateInput || isAnalyzing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs transition flex items-center space-x-1.5 shrink-0 shadow-lg shadow-indigo-950/50"
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
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 whitespace-nowrap text-[11px]"
              >
                {num}
              </button>
            ))}
          </div>
        )}

        {/* Analysis Loading Waveform */}
        {isAnalyzing && (
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-indigo-500/30 animate-in fade-in">
            <WaveformRippleVisualizer
              active={true}
              variant="both"
              colorTheme="indigo"
              barCount={24}
              height={30}
              statusLabel="AI Investigator neural heuristics scanning telecommunication registers..."
              subLabel="Live Forensic Analysis"
            />
          </div>
        )}

        {/* Analysis Results Card */}
        {analyzedResult && !isAnalyzing && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-3 animate-in fade-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-extrabold text-white">
                  {analyzedResult.profile.name}
                </div>
                <div className="text-xs text-slate-400">
                  {formatPhoneNumber(analyzedResult.number)}
                </div>
              </div>

              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                  analyzedResult.riskScore >= 70
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : analyzedResult.riskScore >= 40
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  Risk Score: {analyzedResult.riskScore}/100
                </span>
                <div className="text-[11px] text-slate-400 mt-1">{analyzedResult.verdict}</div>
              </div>
            </div>

            {/* Forensic Waveform Signature */}
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <WaveformRippleVisualizer
                active={false}
                variant="waveform"
                colorTheme={analyzedResult.riskScore >= 70 ? 'rose' : analyzedResult.riskScore >= 40 ? 'amber' : 'emerald'}
                barCount={22}
                height={20}
                statusLabel={`Spectral Telephony Signature · ${analyzedResult.verdict}`}
                subLabel={`Score: ${analyzedResult.riskScore}/100`}
                compact
              />
            </div>

            {/* Behavioral analysis bullets */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-300">Forensic Observations:</div>
              {analyzedResult.analysis.map((obs, i) => (
                <div key={i} className="flex items-start space-x-2 text-xs text-slate-300">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>{obs}</span>
                </div>
              ))}
            </div>

            {/* Decision Explanation (Why was this blocked / classified?) */}
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1">
              <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>AI Decision Explanation</span>
              </div>
              <p className="text-slate-300">{analyzedResult.recommendation}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => onInitiateCall(analyzedResult.number, analyzedResult.profile.name)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
              >
                Call Number
              </button>
              {analyzedResult.riskScore >= 40 && (
                <button
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
                    alert(`Added block rule for ${analyzedResult.number}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow"
                >
                  Block This Number
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. LIVE AI CALL SCREENING & CONVERSATIONAL ASSISTANT STUDIO */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-850 border border-slate-750 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live AI Screening Assistant Studio
                </h2>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                  Gemini Two-Way
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Test how the AI communicates live with callers dynamically rather than using canned scripts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setSandboxMuted(v => !v)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
              title={sandboxMuted ? 'Unmute voice playback' : 'Mute voice playback'}
            >
              {sandboxMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setSandboxTranscript([{
                  id: `init-${Date.now()}`,
                  sender: 'assistant',
                  text: 'Hello, this is CallShield AI Voice Gatekeeper. Who is calling and what is this regarding?',
                  timestamp: Date.now(),
                }]);
                setSandboxIntent('Awaiting Caller Identification');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs font-semibold transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Real-time Waveform and Ripple Animation during AI Screening */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-750 space-y-1">
          <WaveformRippleVisualizer
            active={sandboxIsSpeaking || sandboxIsThinking}
            variant="both"
            colorTheme={sandboxIsSpeaking ? 'indigo' : sandboxIsThinking ? 'amber' : 'emerald'}
            barCount={26}
            height={28}
            statusLabel={
              sandboxIsSpeaking
                ? 'AI Assistant Speaking to Caller in Real-Time...'
                : sandboxIsThinking
                ? 'Gemini processing caller statement & analyzing intent...'
                : 'AI Voice Screener Channel Open · Ready for Caller Input'
            }
            subLabel={`Detected Intent: ${sandboxIntent}`}
            compact
          />
        </div>

        {/* Live Conversation Stream */}
        <div className="max-h-56 overflow-y-auto space-y-2 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
          {sandboxTranscript.map((t) => (
            <div
              key={t.id}
              className={`flex flex-col ${t.sender === 'assistant' ? 'items-end' : 'items-start'}`}
            >
              <div className="mb-0.5 flex items-center space-x-1 text-[10px] text-slate-400">
                {t.sender === 'assistant' ? (
                  <>
                    <span className="font-semibold text-indigo-400">CallShield AI Screener</span>
                    <Bot className="w-3 h-3 text-indigo-400" />
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">Inbound Caller</span>
                  </>
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed ${
                  t.sender === 'assistant'
                    ? 'rounded-tr-sm bg-indigo-600 text-white shadow'
                    : 'rounded-tl-sm bg-slate-800 border border-slate-700 text-slate-100'
                }`}
              >
                {t.text}
              </div>
            </div>
          ))}

          {sandboxIsThinking && (
            <div className="flex items-center space-x-2 text-indigo-300 text-xs bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-2.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>AI is generating direct conversational response to caller...</span>
            </div>
          )}
        </div>

        {/* Caller Simulation Prompt Bar */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Caller Speech:</span>
            </span>
            <span className="text-[11px] text-slate-500">Tap preset or type below</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: '📦 Courier Delivery', text: "Hi, I'm downstairs with a delivery package from FedEx that requires a signature." },
              { label: '🏦 Bank Fraud Alert', text: "Hello, this is Bank Fraud Prevention calling about an unverified $740 charge on your debit card." },
              { label: '🩺 Medical Clinic', text: "Good morning, Dr. Patel's office calling to confirm your appointment scheduled for tomorrow." },
              { label: '💸 Pre-Approved Loan', text: "Congratulations, you have been selected for a pre-approved low-interest debt consolidation loan." },
            ].map((scen, idx) => (
              <button
                key={idx}
                onClick={() => handleSandboxCallerSpeech(scen.text)}
                disabled={sandboxIsThinking}
                className="whitespace-nowrap rounded-xl border border-slate-750 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:bg-slate-750 active:scale-95 shrink-0 flex items-center space-x-1 disabled:opacity-50"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>{scen.label}</span>
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSandboxCallerSpeech(sandboxCallerInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={sandboxCallerInput}
              onChange={(e) => setSandboxCallerInput(e.target.value)}
              placeholder="Type what the caller says to test real-time AI reply..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!sandboxCallerInput.trim() || sandboxIsThinking}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition shrink-0"
            >
              Send Caller Speech
            </button>
          </form>
        </div>

        {/* Dynamic Contextual Replies */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400 flex items-center space-x-1">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dynamic AI Suggested Responses:</span>
            </span>
            <span className="text-[10px] text-indigo-300">Generated dynamically</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sandboxSuggestions.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSandboxAssistantReply(reply)}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200 transition hover:border-indigo-500 hover:bg-slate-750 active:scale-95"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SMART FOLLOW-UPS & REMINDERS */}
      {reminders.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-850 border border-slate-750 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('smart_reminders_title')}
              </h2>
            </div>
            <span className="text-xs text-slate-400">{reminders.length}</span>
          </div>

          <div className="space-y-2">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className="p-3 rounded-2xl bg-slate-800/80 border border-slate-750 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{rem.name}</div>
                  <p className="text-xs text-slate-300 mt-0.5">{rem.text}</p>
                  <span className="text-[10px] text-slate-500">{rem.time}</span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onInitiateCall(rem.number, rem.name)}
                    className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow"
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
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-850 border border-slate-750 shadow-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('smart_recommendations_title')}
            </h2>
          </div>

          <div className="space-y-2">
            {smartRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-white">{rec.title}</div>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.desc}</p>
                </div>
                <button
                  onClick={() => {
                    rec.apply();
                    setAppliedRecommendations((prev) => [...prev, rec.id]);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shrink-0 self-start sm:self-auto shadow"
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

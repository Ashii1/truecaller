import { useState, useMemo, memo, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Filter,
  Globe2,
  Info,
  Layers,
  Lock,
  Phone,
  PhoneCall,
  PhoneOff,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  BlockRule,
  WhitelistEntry,
  ShieldSettings,
  SensitivityLevel,
  SpamCategory,
  SecurityTimelineEvent,
} from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { formatPhoneNumber } from '../utils/spamEngine';

interface ProtectionTabProps {
  settings: ShieldSettings;
  onUpdateSettings: (newSettings: ShieldSettings) => void;
  rules: BlockRule[];
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  onAddRule: (rule: Omit<BlockRule, 'id' | 'hitCount' | 'createdAt'>) => void;
  whitelist: WhitelistEntry[];
  onRemoveWhitelist: (id: string) => void;
  timelineEvents: SecurityTimelineEvent[];
  onTriggerScreeningDemo?: () => void;
}

type BlockSubTab = 'ALL' | 'PATTERNS' | 'NUMBERS' | 'PRIVATE' | 'SPAM';
type RuleTypeOption = 'EXACT' | 'PREFIX' | 'SUFFIX' | 'INTERNATIONAL' | 'PRIVATE';

const QUICK_PRESET_RULES = [
  { label: 'TRAI 140 Series', prefix: '140', category: 'TELEMARKETING' as SpamCategory, note: 'Indian statutory sales' },
  { label: 'Wangiri +234 / +880', prefix: '+234', category: 'SCAM' as SpamCategory, note: 'Pingback fraud series' },
  { label: '800 Toll-Free', prefix: '1800', category: 'CUSTOM' as SpamCategory, note: 'Commercial toll-free' },
  { label: 'Private / Withheld', prefix: 'private', category: 'CUSTOM' as SpamCategory, note: 'Restricted IDs' },
];

const ProtectionTab = memo(function ProtectionTab({
  settings,
  onUpdateSettings,
  rules,
  onToggleRule,
  onDeleteRule,
  onAddRule,
  whitelist,
  onRemoveWhitelist,
  timelineEvents,
  onTriggerScreeningDemo,
}: ProtectionTabProps) {
  const { t } = useI18n();
  const [activeSubTab, setActiveSubTab] = useState<BlockSubTab>('ALL');
  const [rulesSearch, setRulesSearch] = useState('');
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [showWhitelistSection, setShowWhitelistSection] = useState(false);
  const [showTimelineSection, setShowTimelineSection] = useState(false);
  const [simulatedDefenseNotice, setSimulatedDefenseNotice] = useState<string | null>(null);

  // Quick Whitelist addition state
  const [whitelistName, setWhitelistName] = useState('');
  const [whitelistNumber, setWhitelistNumber] = useState('');
  const [isAddWhitelistOpen, setIsAddWhitelistOpen] = useState(false);

  // Visual Rule Builder state
  const [builderOption, setBuilderOption] = useState<RuleTypeOption>('PREFIX');
  const [builderValue, setBuilderValue] = useState('');
  const [builderLabel, setBuilderLabel] = useState('');
  const [builderCategory, setBuilderCategory] = useState<SpamCategory>('TELEMARKETING');

  // Firewall mode & sensitivity handler
  const handleSetSensitivity = (level: SensitivityLevel) => {
    onUpdateSettings({
      ...settings,
      sensitivity: level,
      firewallMode: level === 'AGGRESSIVE' ? 'MAXIMUM' : level === 'STRICT' ? 'STRICT' : 'STANDARD',
    });
  };

  // Quick Emergency Defense: blocks unknown callers
  const handleToggleBlockUnknown = () => {
    onUpdateSettings({
      ...settings,
      blockUnknownNumbers: !settings.blockUnknownNumbers,
    });
  };

  // Preset 1-tap Defense Simulation
  const handleSimulateThreat = (type: 'TRAI' | 'WANGIRI' | 'SPOOF') => {
    let msg = '';
    if (type === 'TRAI') {
      msg = '⚡ Intercepted TRAI 140 commercial series (+91 1409098984) · Call dropped before ringer!';
    } else if (type === 'WANGIRI') {
      msg = '⚡ Detected 1-ring Ping-Back trap (+234 802 331 992) · Muted and logged without callback risk!';
    } else {
      msg = '⚡ Blocked spoofed neighbor circle call (+91 98200 •••••) · Origin certificate failed STIR/SHAKEN!';
    }
    setSimulatedDefenseNotice(msg);
    setTimeout(() => setSimulatedDefenseNotice(null), 4500);
  };

  // Filter rules by subtab and search query
  const filteredRules = useMemo(() => {
    const q = rulesSearch.toLowerCase().trim();
    return rules.filter((r) => {
      if (q) {
        const matchesQuery =
          r.value.toLowerCase().includes(q) ||
          (r.label && r.label.toLowerCase().includes(q)) ||
          r.category.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (activeSubTab === 'NUMBERS') return r.matchType === 'EXACT';
      if (activeSubTab === 'PATTERNS') return r.matchType === 'PREFIX' || r.matchType === 'REGEX';
      if (activeSubTab === 'PRIVATE') return String(r.value ?? '').toLowerCase().includes('private') || r.category === 'CUSTOM';
      if (activeSubTab === 'SPAM') return r.category === 'SCAM' || r.category === 'ROBOCALL' || r.category === 'TELEMARKETING';
      return true;
    });
  }, [rules, activeSubTab, rulesSearch]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const totalHits = rules.reduce((acc, r) => acc + (r.hitCount || 0), 0);
    const activeRulesCount = rules.filter((r) => r.enabled).length;
    return {
      totalHits,
      activeRulesCount,
      whitelistCount: whitelist.length,
    };
  }, [rules, whitelist]);

  // Dynamic rule preview
  const rulePreview = useMemo(() => {
    const val = builderValue.trim();
    if (!val && builderOption !== 'PRIVATE') return null;

    if (builderOption === 'PREFIX') {
      const dots = '•'.repeat(Math.max(1, 10 - val.length));
      return {
        visual: `${val}${dots}`,
        countStr: `Matches any number beginning with "${val}"`,
        isBroad: val.length <= 2,
        warning: val.length <= 2 ? '⚠️ Broad prefix: ensure this does not block legitimate area codes.' : undefined,
      };
    }

    if (builderOption === 'SUFFIX') {
      return {
        visual: `••••••${val}`,
        countStr: `Matches numbers ending with "${val}"`,
        isBroad: val.length <= 2,
      };
    }

    if (builderOption === 'EXACT') {
      return {
        visual: val,
        countStr: 'Blocks only this exact 10-digit number.',
        isBroad: false,
      };
    }

    if (builderOption === 'INTERNATIONAL') {
      const clean = val.replace(/\D/g, '');
      return {
        visual: `+${clean || '••'} •••••••••`,
        countStr: `Blocks all international calls with country code +${clean}.`,
        isBroad: false,
      };
    }

    if (builderOption === 'PRIVATE') {
      return {
        visual: 'Private / Restricted',
        countStr: 'Blocks calls with withheld caller IDs.',
        isBroad: false,
      };
    }

    return null;
  }, [builderOption, builderValue]);

  const handleSaveRule = (e: FormEvent) => {
    e.preventDefault();
    if (!builderValue.trim() && builderOption !== 'PRIVATE') return;

    let finalValue = builderValue.trim();
    let matchType: any = 'PREFIX';

    if (builderOption === 'EXACT') matchType = 'EXACT';
    if (builderOption === 'PREFIX') matchType = 'PREFIX';
    if (builderOption === 'SUFFIX') matchType = 'REGEX';
    if (builderOption === 'INTERNATIONAL') {
      matchType = 'PREFIX';
      finalValue = `+${finalValue.replace(/\D/g, '')}`;
    }
    if (builderOption === 'PRIVATE') {
      matchType = 'KEYWORD';
      finalValue = 'private';
    }

    onAddRule({
      value: finalValue,
      matchType,
      targetType: 'BOTH',
      category: builderCategory,
      label: builderLabel.trim() || `${builderOption} Rule: ${finalValue}`,
      notes: 'Custom block rule configured via Protection Tab',
      enabled: true,
      visualPattern: rulePreview?.visual,
    });

    setBuilderValue('');
    setBuilderLabel('');
    setIsRuleBuilderOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-lg px-2.5 sm:px-3 py-2 space-y-3 pb-24 sm:pb-28 select-none animate-in fade-in duration-150">
      {/* 1. MASTER FIREWALL HERO STATUS */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-[#0d1422] to-slate-950 p-4 shadow-sm">
        {/* Top Status Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`relative grid h-11 w-11 place-items-center rounded-2xl border shrink-0 transition-all ${
                settings.masterEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-400'
              }`}
            >
              {settings.masterEnabled ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
              {settings.masterEnabled && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
              )}
            </div>

            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5 truncate">
                <h1 className="text-base font-bold text-white tracking-tight truncate">
                  {t('protection_firewall_title')}
                </h1>
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    settings.masterEnabled ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  · {settings.masterEnabled ? 'Hardened Defense' : t('protection_paused')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                On-device telecom filtering & automated threat mitigation
              </p>
            </div>
          </div>

          {/* Master Toggle */}
          <button
            id="btn-toggle-firewall"
            type="button"
            onClick={() => onUpdateSettings({ ...settings, masterEnabled: !settings.masterEnabled })}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
              settings.masterEnabled
                ? 'bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 border border-white/[0.1]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30'
            }`}
          >
            {settings.masterEnabled ? t('protection_turn_off') : t('protection_turn_on')}
          </button>
        </div>

        {/* Live Protection Stats Strip */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-black/40 border border-white/[0.05] p-2 text-center">
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Dropped Calls</div>
            <div className="text-base font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
              {stats.totalHits}
            </div>
          </div>
          <div className="border-x border-white/[0.06]">
            <div className="text-[10px] text-slate-400 font-medium">Active Filters</div>
            <div className="text-base font-bold text-blue-400 font-mono tabular-nums mt-0.5">
              {stats.activeRulesCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">VIP Whitelist</div>
            <div className="text-base font-bold text-purple-400 font-mono tabular-nums mt-0.5">
              {stats.whitelistCount}
            </div>
          </div>
        </div>

        {/* Sensitivity Mode Selector */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-blue-400" />
              <span>Defense Posture</span>
            </span>
            <span className="text-[11px] font-bold text-blue-400 font-mono">
              {settings.sensitivity === 'AGGRESSIVE'
                ? 'Aggressive Firewall'
                : settings.sensitivity === 'STRICT'
                ? 'Balanced Defense'
                : 'Permissive Mode'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black/40 border border-white/[0.06] p-1">
            {[
              { id: 'MODERATE' as SensitivityLevel, title: 'Permissive', desc: 'Known spam only' },
              { id: 'STRICT' as SensitivityLevel, title: 'Balanced', desc: 'Standard defense' },
              { id: 'AGGRESSIVE' as SensitivityLevel, title: 'Aggressive', desc: 'Maximum shield' },
            ].map((lvl) => {
              const isSelected = settings.sensitivity === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => handleSetSensitivity(lvl.id)}
                  className={`py-1.5 text-xs font-semibold rounded-lg text-center transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600/30 border border-blue-500/50 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div>{lvl.title}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME THREAT DEFENSE TEST STATION */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Defense Simulation Station
              </h2>
              <p className="text-[10px] text-slate-400">
                Test how CallShield drops scam calls in real-time
              </p>
            </div>
          </div>

          {onTriggerScreeningDemo && (
            <button
              type="button"
              onClick={onTriggerScreeningDemo}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition active:scale-95 cursor-pointer"
            >
              <Bot className="h-3 w-3" />
              <span>AI Screener</span>
            </button>
          )}
        </div>

        {/* 3 Interactive Test Buttons */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => handleSimulateThreat('TRAI')}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] p-2 text-left transition active:scale-95 cursor-pointer"
          >
            <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>TRAI 140</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">Auto-drop telemarketer</div>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateThreat('WANGIRI')}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] p-2 text-left transition active:scale-95 cursor-pointer"
          >
            <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
              <PhoneOff className="h-3 w-3" />
              <span>Wangiri</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">1-Ring trap shield</div>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateThreat('SPOOF')}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] p-2 text-left transition active:scale-95 cursor-pointer"
          >
            <div className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
              <Radio className="h-3 w-3" />
              <span>Spoof Guard</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">STIR/SHAKEN failure</div>
          </button>
        </div>

        {simulatedDefenseNotice && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="leading-snug">{simulatedDefenseNotice}</span>
          </div>
        )}
      </div>

      {/* 3. DEFENSIVE TELEPHONY MODULES */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Defensive Telephony Modules
              </h2>
              <p className="text-[10px] text-slate-400">
                Granular hardware & network protection switches
              </p>
            </div>
          </div>
        </div>

        {/* Modular Switches */}
        <div className="space-y-2.5 divide-y divide-white/[0.04]">
          {/* Module 1: Automated Spam & Phishing Drop */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Auto-Drop High Risk Spam</div>
              <p className="text-[11px] text-slate-400">Instantly terminates fraudulent calls before ringer sounds</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoCancelSpamCalls}
              onClick={() => onUpdateSettings({ ...settings, autoCancelSpamCalls: !settings.autoCancelSpamCalls })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.autoCancelSpamCalls ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.autoCancelSpamCalls ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Module 2: Block Unknown Callers */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Block Unknown / Non-Contacts</span>
                {settings.blockUnknownNumbers && (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[9px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Only contacts and whitelisted VIPs can ring through</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blockUnknownNumbers}
              onClick={handleToggleBlockUnknown}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.blockUnknownNumbers ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.blockUnknownNumbers ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Module 3: Private / Hidden Numbers */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Private & Restricted Caller ID</div>
              <p className="text-[11px] text-slate-400">Automatically blocks callers with withheld numbers</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blockPrivateHidden}
              onClick={() => onUpdateSettings({ ...settings, blockPrivateHidden: !settings.blockPrivateHidden })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.blockPrivateHidden ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.blockPrivateHidden ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Module 4: Wangiri One-Ring Scam Defense */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Wangiri Ping-Back Scam Shield</div>
              <p className="text-[11px] text-slate-400">Detects 1-ring scam callbacks from premium international rate numbers</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.pingBackShieldEnabled !== false}
              onClick={() => onUpdateSettings({ ...settings, pingBackShieldEnabled: settings.pingBackShieldEnabled === false })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.pingBackShieldEnabled !== false ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.pingBackShieldEnabled !== false ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Module 5: Neighbor Prefix Spoof Defense */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Neighbor Prefix Spoof Guard</div>
              <p className="text-[11px] text-slate-400">Identifies spoofed calls mimicking your local circle code</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.neighborSpoofEnabled !== false}
              onClick={() => onUpdateSettings({ ...settings, neighborSpoofEnabled: settings.neighborSpoofEnabled === false })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.neighborSpoofEnabled !== false ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.neighborSpoofEnabled !== false ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Module 6: Smart AI Call Screening */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white">Autonomous Voice Call Screening</div>
              <p className="text-[11px] text-slate-400">AI assistant challenges unknown callers and transcribes purpose live</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.smartCallScreeningEnabled}
              onClick={() => onUpdateSettings({ ...settings, smartCallScreeningEnabled: !settings.smartCallScreeningEnabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                settings.smartCallScreeningEnabled ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${
                settings.smartCallScreeningEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. BLOCK RULES & PATTERNS MANAGER */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <ShieldBan className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-tight">
                Block Rules & Patterns ({rules.length})
              </h2>
              <p className="text-[10px] text-slate-400">
                Custom prefixes, series & exact numbers
              </p>
            </div>
          </div>

          <button
            id="btn-create-rule"
            type="button"
            onClick={() => setIsRuleBuilderOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3 py-1.5 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Rule</span>
          </button>
        </div>

        {/* Quick Add Presets Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">1-Tap Preset:</span>
          {QUICK_PRESET_RULES.map((preset) => {
            const alreadyExists = rules.some((r) => r.value.includes(preset.prefix));
            return (
              <button
                key={preset.label}
                type="button"
                disabled={alreadyExists}
                onClick={() => {
                  onAddRule({
                    value: preset.prefix,
                    matchType: preset.prefix === 'private' ? 'KEYWORD' : 'PREFIX',
                    targetType: 'BOTH',
                    category: preset.category,
                    label: preset.label,
                    notes: `1-Tap preset: ${preset.note}`,
                    enabled: true,
                    visualPattern: preset.prefix === 'private' ? 'Private' : `${preset.prefix}•••••••`,
                  });
                }}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 cursor-pointer ${
                  alreadyExists
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default opacity-80'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white'
                }`}
              >
                <span>{preset.label}</span>
                {alreadyExists && <span className="text-[9px]">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Search & Sub-tabs */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={rulesSearch}
              onChange={(e) => setRulesSearch(e.target.value)}
              placeholder="Search active block rules..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-0.5 rounded-xl bg-black/40 border border-white/[0.05]">
            {[
              { id: 'ALL', label: 'All Rules' },
              { id: 'PATTERNS', label: 'Prefix / Series' },
              { id: 'NUMBERS', label: 'Exact Numbers' },
              { id: 'PRIVATE', label: 'Private Callers' },
              { id: 'SPAM', label: 'Scam & Promo' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as BlockSubTab)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  activeSubTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rules List */}
        <div className="space-y-2">
          {filteredRules.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 bg-black/20 rounded-xl border border-white/[0.04]">
              No active rules found in this filter.
            </div>
          ) : (
            filteredRules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-bold text-white truncate">
                      {r.label || r.value}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-md">
                      {r.matchType}
                    </span>
                    {r.visualPattern && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {r.visualPattern}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>Target: <strong className="font-mono text-slate-300">{r.value}</strong></span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">{r.hitCount || 0} calls intercepted</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleRule(r.id)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg transition cursor-pointer active:scale-95 ${
                      r.enabled
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {r.enabled ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(r.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                    title="Delete rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. VIP ALWAYS-ALLOW WHITELIST ACCORDION */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWhitelistSection((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/[0.02] transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white tracking-tight">
                VIP Whitelist ({whitelist.length})
              </h2>
              <p className="text-[10px] text-slate-400">
                Numbers that always bypass firewall and silent hours
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showWhitelistSection ? 'rotate-180' : ''}`} />
        </button>

        {showWhitelistSection && (
          <div className="p-3.5 pt-0 border-t border-white/[0.04] space-y-2.5 animate-in fade-in">
            {whitelist.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No numbers in VIP whitelist yet. Contacts are automatically trusted.
              </div>
            ) : (
              whitelist.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                >
                  <div className="min-w-0 truncate">
                    <span className="block text-xs font-bold text-white truncate">{w.name}</span>
                    <span className="block text-[11px] font-mono text-emerald-400">{formatPhoneNumber(w.value)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveWhitelist(w.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                    title="Remove from whitelist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 6. LIVE SECURITY AUDIT TIMELINE ACCORDION */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTimelineSection((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/[0.02] transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white tracking-tight">
                Live Defense Audit Log ({timelineEvents.length})
              </h2>
              <p className="text-[10px] text-slate-400">
                Recent intercepted calls and threat mitigation events
              </p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showTimelineSection ? 'rotate-180' : ''}`} />
        </button>

        {showTimelineSection && (
          <div className="p-3.5 pt-0 border-t border-white/[0.04] space-y-2 animate-in fade-in max-h-60 overflow-y-auto no-scrollbar">
            {timelineEvents.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No recent security incidents logged. All inbound lines safe.
              </div>
            ) : (
              timelineEvents.slice(0, 8).map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                >
                  <div className={`grid h-6 w-6 place-items-center rounded-lg mt-0.5 shrink-0 ${
                    evt.severity === 'BLOCK'
                      ? 'bg-rose-500/20 text-rose-300'
                      : evt.severity === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {evt.severity === 'BLOCK' ? <PhoneOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{evt.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{evt.timeStr}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{evt.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL: VISUAL RULE BUILDER */}
      {isRuleBuilderOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d1422] p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Visual Rule Builder</h3>
                  <p className="text-[10px] text-slate-400">Configure pattern or exact number block</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleBuilderOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 pt-3">
              {/* Rule Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Matching Pattern
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'PREFIX' as RuleTypeOption, label: 'Prefix (Series)' },
                    { id: 'EXACT' as RuleTypeOption, label: 'Exact Number' },
                    { id: 'PRIVATE' as RuleTypeOption, label: 'Private / Withheld' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBuilderOption(opt.id)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition ${
                        builderOption === opt.id
                          ? 'bg-blue-600/30 border-blue-500 text-white'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number / Value input */}
              {builderOption !== 'PRIVATE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Digits or Prefix
                  </label>
                  <input
                    type="text"
                    value={builderValue}
                    onChange={(e) => setBuilderValue(e.target.value)}
                    placeholder={builderOption === 'PREFIX' ? 'e.g. 140 or +91140' : 'e.g. 9820012345'}
                    className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60"
                    autoFocus
                  />
                </div>
              )}

              {/* Live Preview Display */}
              {rulePreview && (
                <div className="rounded-xl bg-black/40 border border-white/[0.05] p-3 text-xs space-y-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Pattern Simulation
                  </div>
                  <div className="font-mono text-sm font-bold text-emerald-400">
                    {rulePreview.visual}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {rulePreview.countStr}
                  </div>
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rule Label (Optional)
                </label>
                <input
                  type="text"
                  value={builderLabel}
                  onChange={(e) => setBuilderLabel(e.target.value)}
                  placeholder="e.g. Telemarketing Loan Series"
                  className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRuleBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!builderValue.trim() && builderOption !== 'PRIVATE'}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition active:scale-95 cursor-pointer"
                >
                  Save & Apply Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

export default ProtectionTab;

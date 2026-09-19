import { useState, useMemo, memo, type FormEvent } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldBan, 
  Plus, 
  Sliders, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Layers, 
  X, 
  Sparkles,
  Info,
  ChevronRight,
  Activity,
  Globe,
  UserX,
  PhoneOff,
  Bot,
  EyeOff,
  Radio
} from 'lucide-react';
import { 
  BlockRule, 
  WhitelistEntry, 
  ShieldSettings, 
  SensitivityLevel, 
  SpamCategory,
  SecurityTimelineEvent 
} from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { telecomBridge } from '../services/telephony/telecomBridge';

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

type BlockSubTab = 'NUMBERS' | 'PATTERNS' | 'PRIVATE' | 'SPAM';
type RuleTypeOption = 'EXACT' | 'PREFIX' | 'SUFFIX' | 'RANGE' | 'INTERNATIONAL' | 'PRIVATE';

function ProtectionTab({
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
  const [activeSubTab, setActiveSubTab] = useState<BlockSubTab>('PATTERNS');
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);

  // Visual Rule Builder state
  const [builderOption, setBuilderOption] = useState<RuleTypeOption>('PREFIX');
  const [builderValue, setBuilderValue] = useState('');
  const [builderLabel, setBuilderLabel] = useState('');
  const [builderCategory, setBuilderCategory] = useState<SpamCategory>('TELEMARKETING');

  // AI Screening state & handler
  const isAiScreeningOn = settings.aiScreeningEnabled !== false && settings.smartCallScreeningEnabled !== false;
  const handleToggleAiScreening = (enabled: boolean) => {
    onUpdateSettings({
      ...settings,
      aiScreeningEnabled: enabled,
      smartCallScreeningEnabled: enabled,
    });
    telecomBridge.setAiScreeningEnabled(enabled);
  };

  // Firewall level handler
  const handleSetSensitivity = (level: SensitivityLevel) => {
    onUpdateSettings({
      ...settings,
      sensitivity: level,
      firewallMode: level === 'AGGRESSIVE' ? 'MAXIMUM' : level === 'STRICT' ? 'STRICT' : 'STANDARD',
    });
  };

  // Filter rules by subtab
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (activeSubTab === 'NUMBERS') return r.matchType === 'EXACT';
      if (activeSubTab === 'PATTERNS') return r.matchType === 'PREFIX' || r.matchType === 'REGEX';
      if (activeSubTab === 'PRIVATE') return String(r.value ?? '').toLowerCase().includes('private') || r.category === 'CUSTOM';
      if (activeSubTab === 'SPAM') return r.category === 'SCAM' || r.category === 'ROBOCALL' || r.category === 'TELEMARKETING';
      return true;
    });
  }, [rules, activeSubTab]);

  // Calculate dynamic rule preview
  const rulePreview = useMemo(() => {
    const val = builderValue.trim();
    if (!val) return null;

    if (builderOption === 'PREFIX') {
      const dots = '•'.repeat(Math.max(1, 10 - val.length));
      const digitsCount = 10 - val.length;
      const estimatedCount = digitsCount > 0 ? Math.pow(10, Math.min(digitsCount, 6)) : 1;
      const isBroad = val.length <= 2;
      return {
        visual: `${val}${dots}`,
        countStr: `Approximately ${estimatedCount.toLocaleString()} possible numbers may match this rule.`,
        isBroad,
        warning: isBroad ? '⚠️ Warning: Broad 1-2 digit prefix will block large carrier ranges.' : undefined,
      };
    }

    if (builderOption === 'SUFFIX') {
      return {
        visual: `••••••${val}`,
        countStr: 'Matches all phone numbers terminating with this digit pattern.',
        isBroad: val.length <= 2,
        warning: val.length <= 2 ? '⚠️ Warning: Short suffixes may inadvertently match standard numbers.' : undefined,
      };
    }

    if (builderOption === 'EXACT') {
      return {
        visual: val,
        countStr: 'Exactly 1 unique telephone number will be blocked.',
        isBroad: false,
      };
    }

    if (builderOption === 'INTERNATIONAL') {
      return {
        visual: `+${val.replace(/\D/g, '')} •••••••••`,
        countStr: 'All inbound calls originating from this country calling code.',
        isBroad: false,
      };
    }

    if (builderOption === 'PRIVATE') {
      return {
        visual: 'Private / Anonymous / Restricted Numbers',
        countStr: 'Any incoming caller with withheld or concealed Caller ID.',
        isBroad: false,
      };
    }

    return {
      visual: val,
      countStr: 'Targeted custom matching pattern.',
      isBroad: false,
    };
  }, [builderOption, builderValue]);

  const handleSaveRule = (e: FormEvent) => {
    e.preventDefault();
    if (!builderValue.trim() && builderOption !== 'PRIVATE') return;

    let finalValue = builderValue.trim();
    let matchType: any = 'PREFIX';

    if (builderOption === 'EXACT') matchType = 'EXACT';
    if (builderOption === 'PREFIX') matchType = 'PREFIX';
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
      notes: 'Custom block rule configured via Visual Rule Builder',
      enabled: true,
      visualPattern: rulePreview?.visual,
    });

    setBuilderValue('');
    setBuilderLabel('');
    setIsRuleBuilderOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-3 py-2 space-y-4">
      {/* 1. SMART CALL FIREWALL STATUS HERO */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950/40 border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-md ${
              settings.masterEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-950/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              {settings.masterEnabled ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  {t('protection_firewall_title')}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  settings.masterEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {settings.masterEnabled ? t('status') + ': ' + t('safe') : t('status') + ': ' + t('protection_paused')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('protection_firewall_desc')}
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Button */}
          <button
            id="btn-toggle-firewall"
            onClick={() => onUpdateSettings({ ...settings, masterEnabled: !settings.masterEnabled })}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg flex items-center space-x-2 self-start sm:self-auto ${
              settings.masterEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
          >
            <span>{settings.masterEnabled ? t('protection_turn_off') : t('protection_turn_on')}</span>
          </button>
        </div>

        {/* Protection Level Selector (Low - Balanced - Strict) */}
        <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('protection_level')}</span>
            </span>
            <span className="font-semibold text-indigo-300">
              {settings.sensitivity === 'AGGRESSIVE' ? t('protection_level_strict') : settings.sensitivity === 'STRICT' ? t('protection_level_balanced') : t('protection_level_low')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'MODERATE' as SensitivityLevel, title: t('protection_level_low'), desc: 'Scams only' },
              { id: 'STRICT' as SensitivityLevel, title: t('protection_level_balanced'), desc: 'Spam, TRAI 140' },
              { id: 'AGGRESSIVE' as SensitivityLevel, title: t('protection_level_strict'), desc: 'Strict mode' },
            ].map((lvl) => {
              const isSelected = settings.sensitivity === lvl.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => handleSetSensitivity(lvl.id)}
                  className={`p-2.5 rounded-2xl border text-left transition ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-400/30'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">{lvl.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{lvl.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Firewall Toggle Rules & Allowlist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800">
          {/* Rules Toggles */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">Active Firewall Filters:</div>
            <div className="space-y-1.5">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.scamShieldEnabled}
                  onChange={(e) => onUpdateSettings({ ...settings, scamShieldEnabled: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>✓ High-confidence spam & phishing</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoCancelSpamCalls}
                  onChange={(e) => onUpdateSettings({ ...settings, autoCancelSpamCalls: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>✓ Auto-drop without ringing</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.blockPrivateHidden}
                  onChange={(e) => onUpdateSettings({ ...settings, blockPrivateHidden: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>✓ Private & hidden caller IDs</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.blockInternational}
                  onChange={(e) => onUpdateSettings({ ...settings, blockInternational: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>International toll fraud (+232, etc.)</span>
              </label>
            </div>
          </div>

          {/* Always Allow */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">Always Allowed Lines:</div>
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved Contacts (Always bypass firewall)</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VIP & Starred Favorites</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Businesses (Logistics, Banking)</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TRAI 160 Official Transactional Lines</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: INTELLIGENT CALL SCREENING & SPOOF SHIELD CARD */}
      <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/30 to-[#0e141c] p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-500/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                AI Screener & Advanced Spoof Shields
              </h3>
              <p className="text-xs text-indigo-200/80">
                Automated voice assistant, Wangiri ping-back protection, and masked private callbacks.
              </p>
            </div>
          </div>

          {onTriggerScreeningDemo && (
            <button
              type="button"
              onClick={() => {
                if (!isAiScreeningOn) {
                  handleToggleAiScreening(true);
                }
                onTriggerScreeningDemo();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/30 px-3.5 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600 hover:text-white transition active:scale-95 shadow-sm"
              title={isAiScreeningOn ? "Test live AI call screening simulation" : "Enable AI screening and launch test call"}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isAiScreeningOn ? 'Test AI Call Screener Demo' : 'Enable & Test Screener'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Feature 1: AI Screening Toggle */}
          <div className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${isAiScreeningOn ? 'border-indigo-500/30 bg-[#121827] shadow-lg shadow-indigo-950/20' : 'border-slate-800 bg-[#0d121b]'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded-lg border ${isAiScreeningOn ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800/80 border-slate-700 text-slate-500'}`}>
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">AI Screening</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase ${isAiScreeningOn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                      {isAiScreeningOn ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Autonomous voice agent for incoming calls</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  id="toggle-ai-screening"
                  type="checkbox"
                  checked={isAiScreeningOn}
                  onChange={(e) => handleToggleAiScreening(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              {isAiScreeningOn
                ? 'When enabled, the AI screening agent answers unknown or suspicious callers, challenges them for caller identity & intent, and provides real-time transcripts before you answer.'
                : 'AI Screening is completely disabled. Incoming calls will ring straight through without voice assistant intervention or call screening prompts.'}
            </p>
          </div>

          {/* Feature 2: Neighbor Spoof Shield */}
          <div className="rounded-2xl border border-white/5 bg-[#121822] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Neighbor Spoof Shield</span>
              </div>
              <input
                type="checkbox"
                checked={settings.neighborSpoofEnabled !== false}
                onChange={(e) => onUpdateSettings({ ...settings, neighborSpoofEnabled: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Flags incoming numbers that share your local area prefix but are not in your contacts. Scammers spoof local prefixes to trick you into picking up.
            </p>
            <div className="pt-1">
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Your Mobile Number / Local Prefix (Optional):
              </label>
              <input
                type="text"
                value={settings.userPhoneNumber || ''}
                onChange={(e) => onUpdateSettings({ ...settings, userPhoneNumber: e.target.value })}
                placeholder="e.g. +91 98765 00000"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Feature 3: Ping-Back & Wangiri Scam Shield */}
          <div className="rounded-2xl border border-white/5 bg-[#121822] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white">Ping-Back & Wangiri Shield</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pingBackShieldEnabled !== false}
                onChange={(e) => onUpdateSettings({ ...settings, pingBackShieldEnabled: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Detects suspicious 1-ring dropped calls from unknown or high-rate international lines. Automatically mutes ringers and flags calls with "1-Ring Callback Scam" alert.
            </p>
          </div>

          {/* Feature 4: 1-Tap Private / Masked Callback */}
          <div className="rounded-2xl border border-white/5 bg-[#121822] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">1-Tap Private / Masked Callback</span>
              </div>
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300">
                Active
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Suppresses your caller ID when returning calls to unknown callers, online sellers, or delivery drivers.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <label className="text-[10px] font-semibold text-slate-400 shrink-0">Carrier Code:</label>
              <select
                value={settings.privateCallPrefix || '*67'}
                onChange={(e) => onUpdateSettings({ ...settings, privateCallPrefix: e.target.value })}
                className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="*67">*67 (North America)</option>
                <option value="#31#">#31# (Worldwide GSM / India)</option>
                <option value="141">141 (United Kingdom)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED BLOCKING UI & RULE BUILDER */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <ShieldBan className="w-5 h-5 text-rose-400" />
              <span>{t('blocked_rules_patterns')}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                {rules.length} {t('status')}: {t('safe')}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {t('protection_subtitle')}
            </p>
          </div>

          <button
            id="btn-create-rule"
            onClick={() => setIsRuleBuilderOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-indigo-950/50 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t('create_block_rule')}</span>
          </button>
        </div>

        {/* Sub-tabs: Numbers, Patterns, Private Callers, Spam */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {[
            { id: 'PATTERNS', label: t('subtab_patterns') },
            { id: 'NUMBERS', label: t('subtab_numbers') },
            { id: 'PRIVATE', label: t('subtab_private') },
            { id: 'SPAM', label: t('subtab_spam') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as BlockSubTab)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeSubTab === tab.id
                  ? 'bg-slate-750 text-white border border-slate-600 shadow'
                  : 'bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rules List */}
        <div className="space-y-2">
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 bg-slate-850 rounded-2xl border border-slate-800 text-xs text-slate-400">
              No rules in this category. Click "Create Block Rule" to add one.
            </div>
          ) : (
            filteredRules.map((r) => (
              <div
                key={r.id}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-850 border border-slate-750 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white truncate">
                      {r.label || r.value}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                      {r.matchType}
                    </span>
                    {r.visualPattern && (
                      <span className="font-mono text-xs text-slate-400 bg-slate-800 px-1.5 rounded">
                        {r.visualPattern}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span>Pattern: <strong className="text-slate-300">{r.value}</strong></span>
                    <span>•</span>
                    <span>Hits: <strong className="text-emerald-400">{r.hitCount || 0} calls dropped</strong></span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onToggleRule(r.id)}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title={r.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {r.enabled ? (
                      <ToggleRight className="w-6 h-6 text-indigo-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteRule(r.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. CALL SECURITY TIMELINE */}
      <div className="p-4 rounded-3xl bg-slate-850 border border-slate-750 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Call Security Timeline</h3>
          </div>
          <span className="text-[11px] text-slate-400">Automated defense audit</span>
        </div>

        <div className="space-y-2.5">
          {timelineEvents.map((evt, idx) => (
            <div key={evt.id} className="flex items-start space-x-3 text-xs">
              <div className="text-[11px] font-mono text-slate-400 shrink-0 w-12 pt-0.5">
                {evt.timeStr}
              </div>
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                evt.severity === 'BLOCK' ? 'bg-rose-500' : evt.severity === 'WARNING' ? 'bg-amber-400' : 'bg-indigo-400'
              }`} />
              <div className="min-w-0">
                <span className="font-semibold text-white">{evt.title}: </span>
                <span className="text-slate-300">{evt.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VISUAL BLOCK RULE BUILDER MODAL */}
      {isRuleBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldBan className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Visual Block Rule Builder</h3>
              </div>
              <button
                onClick={() => setIsRuleBuilderOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              {/* Question: What do you want to block? */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  What do you want to block?
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'PREFIX' as RuleTypeOption, label: 'Numbers beginning with... (Series)' },
                    { id: 'EXACT' as RuleTypeOption, label: 'This specific number' },
                    { id: 'SUFFIX' as RuleTypeOption, label: 'Numbers ending with...' },
                    { id: 'INTERNATIONAL' as RuleTypeOption, label: 'International Country Code' },
                    { id: 'PRIVATE' as RuleTypeOption, label: 'Private & Anonymous Callers' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                        builderOption === opt.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rule_builder_type"
                        value={opt.id}
                        checked={builderOption === opt.id}
                        onChange={() => setBuilderOption(opt.id)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pattern input */}
              {builderOption !== 'PRIVATE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {builderOption === 'PREFIX' ? 'Enter Beginning Digits (e.g. 98765 or 140)' : builderOption === 'INTERNATIONAL' ? 'Country Code (e.g. 232 or 44)' : 'Enter Digits'}
                  </label>
                  <input
                    type="text"
                    required
                    value={builderValue}
                    onChange={(e) => setBuilderValue(e.target.value)}
                    placeholder={builderOption === 'PREFIX' ? 'e.g. 98765' : 'e.g. +91 98765 43210'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Dynamic Interactive Pattern Preview */}
              {rulePreview && (
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Rule Preview:
                  </div>
                  <div className="text-base font-extrabold text-indigo-300 font-mono">
                    Block: {rulePreview.visual}
                  </div>
                  <p className="text-slate-300">{rulePreview.countStr}</p>
                  {rulePreview.warning && (
                    <p className="text-amber-300 font-semibold">{rulePreview.warning}</p>
                  )}
                  <div className="pt-1 flex items-center space-x-1.5 text-rose-400 font-bold">
                    <span>Action: 🔴 Automatically block & drop</span>
                  </div>
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rule Name / Label (Optional)
                </label>
                <input
                  type="text"
                  value={builderLabel}
                  onChange={(e) => setBuilderLabel(e.target.value)}
                  placeholder="e.g. Telemarketing Robocall Series"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRuleBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50"
                >
                  Create & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProtectionTab);

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
  ArrowLeft,
  Sparkles,
  Info,
  ChevronRight,
  Activity,
  Globe,
  UserX,
  PhoneOff,
  Bot,
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
    <div className="max-w-md sm:max-w-lg mx-auto px-2.5 sm:px-3 py-2 space-y-3">
      {/* 1. SMART CALL FIREWALL STATUS HERO */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              settings.masterEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}>
              {settings.masterEnabled ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white tracking-tight truncate">
                  {t('protection_firewall_title')}
                </h2>
                <span className={`text-[11px] font-semibold ${
                  settings.masterEnabled ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {settings.masterEnabled ? '· ' + t('safe') : '· ' + t('protection_paused')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {t('protection_firewall_desc')}
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Button */}
          <button
            id="btn-toggle-firewall"
            type="button"
            onClick={() => onUpdateSettings({ ...settings, masterEnabled: !settings.masterEnabled })}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
              settings.masterEnabled
                ? 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm'
            }`}
          >
            <span>{settings.masterEnabled ? t('protection_turn_off') : t('protection_turn_on')}</span>
          </button>
        </div>

        {/* Protection Level Selector (Low - Balanced - Strict) */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('protection_level')}</span>
            </span>
            <span className="font-semibold text-blue-400 text-[11px]">
              {settings.sensitivity === 'AGGRESSIVE' ? t('protection_level_strict') : settings.sensitivity === 'STRICT' ? t('protection_level_balanced') : t('protection_level_low')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
            {[
              { id: 'MODERATE' as SensitivityLevel, title: t('protection_level_low') },
              { id: 'STRICT' as SensitivityLevel, title: t('protection_level_balanced') },
              { id: 'AGGRESSIVE' as SensitivityLevel, title: t('protection_level_strict') },
            ].map((lvl) => {
              const isSelected = settings.sensitivity === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => handleSetSensitivity(lvl.id)}
                  className={`py-1 text-xs font-medium rounded-lg text-center transition cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600/25 border border-blue-500/50 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Firewall Toggle Rules */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/[0.06]">
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.scamShieldEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, scamShieldEnabled: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-3.5 w-3.5"
            />
            <span className="truncate">Spam & Phishing</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoCancelSpamCalls}
              onChange={(e) => onUpdateSettings({ ...settings, autoCancelSpamCalls: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-3.5 w-3.5"
            />
            <span className="truncate">Auto-Drop Spam</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.blockPrivateHidden}
              onChange={(e) => onUpdateSettings({ ...settings, blockPrivateHidden: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-3.5 w-3.5"
            />
            <span className="truncate">Private / Hidden</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.pingBackShieldEnabled !== false}
              onChange={(e) => onUpdateSettings({ ...settings, pingBackShieldEnabled: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-3.5 w-3.5"
            />
            <span className="truncate">Wangiri Scam Shield</span>
          </label>
        </div>
      </div>

      {/* AI CALL SCREENER & SPOOF SHIELD */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight">
                AI Screener & Spoof Shields
              </h3>
              <p className="text-[10px] text-slate-400">
                Voice assistant & Wangiri callback protection
              </p>
            </div>
          </div>

          {onTriggerScreeningDemo && (
            <button
              type="button"
              onClick={onTriggerScreeningDemo}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition active:scale-95"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Test Screener</span>
            </button>
          )}
        </div>

        <div className="space-y-2 divide-y divide-white/[0.04]">
          {/* Feature 1: AI Call Screener */}
          <div className="pt-1 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-white">Smart Call Screening</div>
              <p className="text-[10px] text-slate-400">Voice assistant screens unknown callers and transcribes live</p>
            </div>
            <input
              type="checkbox"
              checked={settings.smartCallScreeningEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, smartCallScreeningEnabled: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 h-4 w-4 shrink-0 cursor-pointer"
            />
          </div>

          {/* Feature 2: Neighbor Spoof Shield */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-white">Neighbor Prefix Spoof Shield</div>
              <p className="text-[10px] text-slate-400">Flags numbers mimicking your local area prefix</p>
            </div>
            <input
              type="checkbox"
              checked={settings.neighborSpoofEnabled !== false}
              onChange={(e) => onUpdateSettings({ ...settings, neighborSpoofEnabled: e.target.checked })}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 h-4 w-4 shrink-0 cursor-pointer"
            />
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
        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {[
            { id: 'PATTERNS', label: t('subtab_patterns') },
            { id: 'NUMBERS', label: t('subtab_numbers') },
            { id: 'PRIVATE', label: t('subtab_private') },
            { id: 'SPAM', label: t('subtab_spam') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as BlockSubTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                activeSubTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rules List */}
        <div className="space-y-2">
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 bg-[#0c121e]/80 rounded-2xl border border-white/[0.08] text-xs text-slate-400">
              No rules in this category. Click "Create Block Rule" to add one.
            </div>
          ) : (
            filteredRules.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-[#0c121e]/90 border border-white/[0.08] hover:border-white/20 transition flex items-center justify-between"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white tracking-tight truncate">
                      {r.label || r.value}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      · {r.matchType}
                    </span>
                    {r.visualPattern && (
                      <span className="font-mono tabular-nums text-xs text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded">
                        {r.visualPattern}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Pattern: <strong className="font-mono text-slate-300">{r.value}</strong></span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono tabular-nums text-emerald-400 font-semibold">{r.hitCount || 0} calls dropped</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleRule(r.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
                    title={r.enabled ? 'Disable rule' : 'Enable rule'}
                    aria-label={r.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {r.enabled ? (
                      <ToggleRight className="w-6 h-6 text-blue-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(r.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer active:scale-95"
                    title="Delete rule"
                    aria-label="Delete rule"
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
                type="button"
                onClick={() => setIsRuleBuilderOpen(false)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-xs font-semibold">Back</span>
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

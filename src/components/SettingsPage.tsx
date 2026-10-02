import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Database,
  Download,
  FolderOpen,
  Globe,
  Grid,
  Info,
  Layers,
  Lock,
  Mic,
  Palette,
  Phone,
  PhoneCall,
  PhoneOff,
  Power,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Stethoscope,
  Trash2,
  Vibrate,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ShieldSettings,
  DisplayDensity,
  ContactItem,
  CallLogItem,
  BlockRule,
  WhitelistEntry,
  SecurityTimelineEvent,
  SensitivityLevel,
} from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { triggerHapticFeedback } from '../utils/audioAlerts';
import { playDtmfTone } from '../utils/dtmfTones';

import ThemeCustomizerModal from './ThemeCustomizerModal';
import PermissionCenterModal from './PermissionCenterModal';
import SystemDiagnosticsModal from './SystemDiagnosticsModal';
import DataSourcesModal from './DataSourcesModal';
import InstallApkModal from './InstallApkModal';
import AboutAppModal from './AboutAppModal';
import PrivacyTermsModal from './PrivacyTermsModal';

export interface SettingsPageProps {
  settings?: ShieldSettings;
  onUpdateSettings?: (settings: ShieldSettings | ((prev: ShieldSettings) => ShieldSettings)) => void;
  isDefaultDialer?: boolean;
  onRequestDefaultDialer?: () => void;
  onOpenPermissionCenter?: () => void;
  onSyncDatabase?: () => void;
  isSyncing?: boolean;
  autoCancelEnabled?: boolean;
  onToggleAutoCancel?: () => void;
  onOpenInstallModal?: () => void;
  onOpenDataSources?: () => void;
  onOpenDiagnostics?: () => void;
  density?: DisplayDensity;
  onDensityChange?: (density: DisplayDensity) => void;
  onBack: () => void;
  onOpenAbout?: () => void;
  onOpenPrivacyTerms?: (tab?: 'privacy' | 'terms') => void;
  onOpenTheme?: () => void;
  contacts?: ContactItem[];
  calls?: CallLogItem[];
  rules?: BlockRule[];
  whitelist?: WhitelistEntry[];
  timelineEvents?: SecurityTimelineEvent[];
  onClearAllData?: () => void;
  onImportAllData?: (data: any) => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => void;
}

type ActiveModal =
  | null
  | 'theme'
  | 'permissions'
  | 'diagnostics'
  | 'data-sources'
  | 'install'
  | 'about'
  | 'privacy'
  | 'terms';

export default function SettingsPage({
  settings,
  onUpdateSettings,
  isDefaultDialer,
  onRequestDefaultDialer,
  onSyncDatabase,
  isSyncing = false,
  autoCancelEnabled = true,
  onToggleAutoCancel,
  density = 'comfortable',
  onDensityChange,
  onBack,
  contacts = [],
  calls = [],
  rules = [],
  whitelist = [],
  timelineEvents = [],
  onClearAllData,
  onImportAllData,
  deferredPrompt,
  onTriggerInstall,
}: SettingsPageProps) {
  const { t, language, setLanguage } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Handle hardware / gesture back navigation
  useEffect(() => {
    const handleBack = (e: any) => {
      if (activeModal !== null) {
        setActiveModal(null);
        e.detail?.handled?.();
      } else {
        onBack();
        e.detail?.handled?.();
      }
    };
    window.addEventListener('callshield_back_request', handleBack);
    return () => window.removeEventListener('callshield_back_request', handleBack);
  }, [activeModal, onBack]);

  const updateShieldSetting = <K extends keyof ShieldSettings>(key: K, value: ShieldSettings[K]) => {
    if (onUpdateSettings) {
      onUpdateSettings((prev) => {
        const next = { ...prev, [key]: value };
        telecomBridge.syncHardwareConfig({
          powerButtonEndsCall: Boolean(next.powerButtonEndsCall),
          volumeButtonSilencesRinger: next.volumeButtonAction === 'REJECT_CALL' ? false : next.volumeButtonSilencesRinger !== false,
          volumeButtonAction: next.volumeButtonAction || 'MUTE_RINGER',
        });
        return next;
      });
    }
  };

  const currentKeypadHapticMs = useMemo(() => {
    if (settings?.keypadHapticFeedback === false) return 0;
    if (settings?.keypadHapticIntensity === 'SOFT') return 15;
    if (settings?.keypadHapticIntensity === 'STRONG') return 40;
    return 25; // STANDARD
  }, [settings?.keypadHapticFeedback, settings?.keypadHapticIntensity]);

  const testHapticPulse = (ms = currentKeypadHapticMs || 25) => {
    triggerHapticFeedback(ms);
    telecomBridge.vibratePhone(ms);
  };

  const q = searchQuery.toLowerCase().trim();
  const matchesSearch = (text: string) => (!q ? true : text.toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-[#070b12] text-white pb-28 animate-in fade-in duration-150">
      {/* Top App Bar with Search */}
      <header
        className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070b12]/95 backdrop-blur-xl px-3 py-2.5"
        style={{ paddingTop: 'max(0.6rem, calc(env(safe-area-inset-top, 0px) + 0.4rem))' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-bold text-white tracking-tight">
              {t('settings_title')}
            </h1>
          </div>

          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-full border border-white/10 bg-white/[0.05] pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="mx-auto max-w-md px-3 py-3 space-y-4">
        {/* Status / Default Phone Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 truncate">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>VigilShield Protection</span>
                <span className="text-[10px] text-emerald-400 font-mono">v1.5.7</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {isDefaultDialer ? 'Active Default Phone App' : 'Set as default dialer for call protection'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isDefaultDialer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <Check className="h-3 w-3" />
                <span>Active</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onRequestDefaultDialer}
                className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[11px] px-3 py-1 shadow-sm active:scale-95 transition cursor-pointer"
              >
                Set Default
              </button>
            )}
          </div>
        </div>

        {/* 1. CALLER ID & SPAM PROTECTION */}
        {matchesSearch('protection spam shield firewall call block scam telemarketing trai') && (
          <SettingsGroup title="Spam & Caller ID">
            {/* Master Shield */}
            <SettingRow
              icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10"
              title="Master Shield"
              subtitle="Real-time call screening & spam filtering"
              checked={settings?.masterEnabled !== false}
              onToggle={(v) => updateShieldSetting('masterEnabled', v)}
            />

            {/* Spam Sensitivity Segmented */}
            <div className="px-3.5 py-2.5 flex flex-col gap-1.5 bg-white/[0.01]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Blocking Sensitivity</span>
                <span className="text-emerald-400 font-semibold text-[11px]">
                  {settings?.sensitivity === 'AGGRESSIVE' ? 'Aggressive' : settings?.sensitivity === 'MODERATE' ? 'Moderate' : 'Strict (Recommended)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                {[
                  { id: 'MODERATE', label: 'Moderate' },
                  { id: 'STRICT', label: 'Strict' },
                  { id: 'AGGRESSIVE', label: 'Aggressive' },
                ].map((s) => {
                  const active = (settings?.sensitivity || 'STRICT') === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateShieldSetting('sensitivity', s.id as SensitivityLevel)}
                      className={`py-1 text-xs font-medium rounded-lg transition active:scale-95 cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto Drop Spam */}
            <SettingRow
              icon={<PhoneOff className="h-4 w-4 text-rose-400" />}
              iconBg="bg-rose-500/10"
              title="Auto-Drop Verified Spam"
              subtitle="Silently reject high-confidence spam calls"
              checked={settings?.autoCancelSpamCalls !== false}
              onToggle={(v) => updateShieldSetting('autoCancelSpamCalls', v)}
            />

            {/* Block Private Numbers */}
            <SettingRow
              icon={<Lock className="h-4 w-4 text-indigo-400" />}
              iconBg="bg-indigo-500/10"
              title="Block Private / Hidden"
              subtitle="Filter anonymous & withheld callers"
              checked={Boolean(settings?.blockPrivateHidden)}
              onToggle={(v) => updateShieldSetting('blockPrivateHidden', v)}
            />

            {/* International One-Ring Wangiri */}
            <SettingRow
              icon={<Globe className="h-4 w-4 text-cyan-400" />}
              iconBg="bg-cyan-500/10"
              title="Wangiri Scam Trap Shield"
              subtitle="Protect against high-cost international callback traps"
              checked={settings?.pingBackShieldEnabled !== false}
              onToggle={(v) => updateShieldSetting('pingBackShieldEnabled', v)}
            />
          </SettingsGroup>
        )}

        {/* 2. REDESIGNED KEYPAD & DIALING */}
        {matchesSearch('keypad dialing haptic vibrate dtmf tone tactile redial') && (
          <SettingsGroup title="Keypad & Dialing">
            {/* Haptic Feedback */}
            <SettingRow
              icon={<Vibrate className="h-4 w-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10"
              title="Keypad Haptic Pulse"
              subtitle="Tactile feedback on every digit tap"
              checked={settings?.keypadHapticFeedback !== false}
              onToggle={(v) => {
                updateShieldSetting('keypadHapticFeedback', v);
                if (v) testHapticPulse();
              }}
            />

            {/* Haptic Strength */}
            {settings?.keypadHapticFeedback !== false && (
              <div className="px-3.5 py-2 flex flex-col gap-1.5 bg-white/[0.01]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Haptic Intensity</span>
                  <button
                    type="button"
                    onClick={() => testHapticPulse()}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 active:scale-95 cursor-pointer"
                  >
                    Test ({currentKeypadHapticMs}ms)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                  {[
                    { id: 'SOFT', label: 'Soft (15ms)', ms: 15 },
                    { id: 'STANDARD', label: 'Crisp (25ms)', ms: 25 },
                    { id: 'STRONG', label: 'Firm (40ms)', ms: 40 },
                  ].map((h) => {
                    const active = (settings?.keypadHapticIntensity || 'STANDARD') === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          updateShieldSetting('keypadHapticIntensity', h.id as any);
                          testHapticPulse(h.ms);
                        }}
                        className={`py-1 text-xs font-medium rounded-lg transition active:scale-95 cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DTMF Tones */}
            <SettingRow
              icon={<Volume2 className="h-4 w-4 text-blue-400" />}
              iconBg="bg-blue-500/10"
              title="Keypad DTMF Audio Tones"
              subtitle="Play standard acoustic tones while dialing"
              checked={settings?.keypadDtmfTones !== false}
              onToggle={(v) => {
                updateShieldSetting('keypadDtmfTones', v);
                if (v) playDtmfTone('5');
              }}
            />
          </SettingsGroup>
        )}

        {/* 3. CALL HANDLING & BUTTONS */}
        {matchesSearch('call hardware power button volume flip silence vibrate ringer') && (
          <SettingsGroup title="Call Handling & Buttons">
            {/* Power Button Ends Call */}
            <SettingRow
              icon={<Power className="h-4 w-4 text-rose-400" />}
              iconBg="bg-rose-500/10"
              title="Power Button Ends Call"
              subtitle="Press device power key to instantly hang up"
              checked={Boolean(settings?.powerButtonEndsCall)}
              onToggle={(v) => updateShieldSetting('powerButtonEndsCall', v)}
            />

            {/* Flip to Silence */}
            <SettingRow
              icon={<Smartphone className="h-4 w-4 text-amber-400" />}
              iconBg="bg-amber-500/10"
              title="Flip to Silence Ringer"
              subtitle="Turn phone face down to mute incoming ringer"
              checked={settings?.flipToSilence !== false}
              onToggle={(v) => updateShieldSetting('flipToSilence', v)}
            />

            {/* Volume Key Action */}
            <div className="px-3.5 py-2.5 flex flex-col gap-1.5 bg-white/[0.01]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Volume Button Behavior</span>
                <span className="text-slate-400 text-[11px]">
                  {settings?.volumeButtonAction === 'REJECT_CALL' ? 'Decline Call' : 'Mute Ringer'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                {[
                  { id: 'MUTE_RINGER', label: 'Silence Ringer' },
                  { id: 'REJECT_CALL', label: 'Decline Call' },
                ].map((act) => {
                  const active = (settings?.volumeButtonAction || 'MUTE_RINGER') === act.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => updateShieldSetting('volumeButtonAction', act.id as any)}
                      className={`py-1 text-xs font-medium rounded-lg transition active:scale-95 cursor-pointer ${
                        active
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {act.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibrate on Connect */}
            <SettingRow
              icon={<Vibrate className="h-4 w-4 text-teal-400" />}
              iconBg="bg-teal-500/10"
              title="Vibrate on Call Connected"
              subtitle="Haptic confirmation when remote caller answers"
              checked={settings?.vibrateOnCallConnected !== false}
              onToggle={(v) => updateShieldSetting('vibrateOnCallConnected', v)}
            />
          </SettingsGroup>
        )}

        {/* 4. DATABASE & PUBLIC DIRECTORY */}
        {matchesSearch('database sync directory whitepages live records source') && (
          <SettingsGroup title="Public Directory & Database">
            <div className="px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold text-white">Community & Public Registry</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {isSyncing ? 'Syncing...' : 'Updated telecom records & verified identities'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isSyncing}
                onClick={onSyncDatabase}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing' : 'Sync Now'}</span>
              </button>
            </div>

            <ActionRow
              icon={<Info className="h-4 w-4 text-slate-400" />}
              iconBg="bg-slate-500/10"
              title="Data Sources & Public Attribution"
              subtitle="TRAI Registry, OpenCorporates, and Public Telecom"
              onClick={() => setActiveModal('data-sources')}
            />
          </SettingsGroup>
        )}

        {/* 5. SYSTEM & APPEARANCE */}
        {matchesSearch('appearance theme language permissions diagnostics system density') && (
          <SettingsGroup title="Preferences & Diagnostics">
            {/* Permissions Center */}
            <ActionRow
              icon={<Shield className="h-4 w-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10"
              title="Permissions Center"
              subtitle="Telecom role, Call log & Notifications"
              onClick={() => setActiveModal('permissions')}
            />

            {/* System Diagnostics */}
            <ActionRow
              icon={<Stethoscope className="h-4 w-4 text-blue-400" />}
              iconBg="bg-blue-500/10"
              title="System Diagnostics & Health"
              subtitle="Hardware checks, database tables, and metrics"
              onClick={() => setActiveModal('diagnostics')}
            />

            {/* Theme Customizer */}
            <ActionRow
              icon={<Palette className="h-4 w-4 text-fuchsia-400" />}
              iconBg="bg-fuchsia-500/10"
              title="Theme & Accent Color"
              subtitle="Dark mode, contrast, and color palette"
              onClick={() => setActiveModal('theme')}
            />

            {/* Display Density */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                  <Grid className="h-4 w-4" />
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold text-white">Layout Density</div>
                  <div className="text-[11px] text-slate-400 truncate">Card and row height sizing</div>
                </div>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/40 border border-white/[0.06] shrink-0">
                <button
                  type="button"
                  onClick={() => onDensityChange?.('compact')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    density === 'compact'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => onDensityChange?.('comfortable')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    density === 'comfortable'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Comfortable
                </button>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold text-white">Language</div>
                  <div className="text-[11px] text-slate-400 truncate">Application UI language</div>
                </div>
              </div>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white outline-none cursor-pointer"
              >
                <option value="en" className="bg-slate-900 text-white">English</option>
                <option value="ta" className="bg-slate-900 text-white">தமிழ் (Tamil)</option>
                <option value="hi" className="bg-slate-900 text-white">हिंदी (Hindi)</option>
              </select>
            </div>
          </SettingsGroup>
        )}

        {/* 6. PRIVACY, ABOUT & RESET */}
        {matchesSearch('about terms privacy clear data reset install') && (
          <SettingsGroup title="Legal & App Info">
            {/* Install PWA / APK */}
            {deferredPrompt && (
              <ActionRow
                icon={<Download className="h-4 w-4 text-emerald-400" />}
                iconBg="bg-emerald-500/10"
                title="Install Application"
                subtitle="Add to home screen or install native Android package"
                onClick={() => setActiveModal('install')}
              />
            )}

            {/* About */}
            <ActionRow
              icon={<Info className="h-4 w-4 text-slate-400" />}
              iconBg="bg-slate-500/10"
              title="About VigilShield"
              subtitle="Version 1.5.7 · License & Telecom Compliance"
              onClick={() => setActiveModal('about')}
            />

            {/* Privacy Policy */}
            <ActionRow
              icon={<Lock className="h-4 w-4 text-slate-400" />}
              iconBg="bg-slate-500/10"
              title="Privacy Policy & Terms"
              subtitle="Device-local processing, zero data harvesting"
              onClick={() => setActiveModal('privacy')}
            />

            {/* Reset All Data */}
            <div className="px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold text-white">Clear App Data & Cache</div>
                  <div className="text-[11px] text-slate-400 truncate">Reset call records and directory cache</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0"
              >
                Clear Data
              </button>
            </div>
          </SettingsGroup>
        )}
      </main>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="w-full max-w-xs rounded-2xl border border-rose-500/30 bg-slate-900 p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-400">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Reset All Data?</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will clear local call logs, custom directory labels, and cache. Contacts will remain safe.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllData?.();
                  setShowClearConfirm(false);
                }}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 text-xs transition active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      {activeModal === 'theme' && (
        <ThemeCustomizerModal isOpen={true} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'permissions' && (
        <PermissionCenterModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          settings={settings}
          onUpdateSettings={onUpdateSettings as any}
          isDefaultDialer={isDefaultDialer}
          onRequestDefaultDialer={onRequestDefaultDialer}
          onSyncContacts={onSyncDatabase}
        />
      )}
      {activeModal === 'diagnostics' && (
        <SystemDiagnosticsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          contacts={contacts}
          calls={calls}
          rules={rules}
          whitelist={whitelist}
          settings={settings}
          timelineEvents={timelineEvents}
          onResetToCleanState={onClearAllData}
          onImportAllData={onImportAllData}
          isDefaultDialer={isDefaultDialer}
          onRequestDefaultDialer={onRequestDefaultDialer}
        />
      )}
      {activeModal === 'data-sources' && (
        <DataSourcesModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onClearAllData={onClearAllData}
        />
      )}
      {activeModal === 'install' && (
        <InstallApkModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          deferredPrompt={deferredPrompt}
          onTriggerInstall={onTriggerInstall}
        />
      )}
      {activeModal === 'about' && (
        <AboutAppModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onOpenPrivacyTerms={(tab) => setActiveModal(tab === 'terms' ? 'terms' : 'privacy')}
        />
      )}
      {(activeModal === 'privacy' || activeModal === 'terms') && (
        <PrivacyTermsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          defaultTab={activeModal === 'terms' ? 'terms' : 'privacy'}
        />
      )}
    </div>
  );
}

// Grouped inset card container
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold text-slate-400 px-1 tracking-tight">
        {title}
      </h2>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] divide-y divide-white/[0.05] overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}

// Toggle Row Component
function SettingRow({
  icon,
  iconBg = 'bg-white/[0.06]',
  title,
  subtitle,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div
      onClick={() => onToggle(!checked)}
      className="px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition cursor-pointer select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`grid h-8 w-8 place-items-center rounded-xl ${iconBg} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 truncate">
          <div className="text-xs font-semibold text-white tracking-tight">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!checked);
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// Action Trigger Row (navigates or opens sub-modal)
function ActionRow({
  icon,
  iconBg = 'bg-white/[0.06]',
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-3.5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition cursor-pointer select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`grid h-8 w-8 place-items-center rounded-xl ${iconBg} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 truncate">
          <div className="text-xs font-semibold text-white tracking-tight">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
    </div>
  );
}

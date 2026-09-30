import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Database,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Grid,
  Info,
  Lock,
  Mic,
  Palette,
  PhoneCall,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Stethoscope,
  Vibrate,
  Volume2,
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
} from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';
import { triggerHapticFeedback } from '../utils/audioAlerts';
import { playDtmfTone } from '../utils/dtmfTones';

import ThemeCustomizerModal from './ThemeCustomizerModal';
import PermissionCenterModal from './PermissionCenterModal';
import SystemDiagnosticsModal from './SystemDiagnosticsModal';
import DataSourcesModal from './DataSourcesModal';
import InstallApkModal from './InstallApkModal';
import AboutAppModal from './AboutAppModal';
import PrivacyTermsModal from './PrivacyTermsModal';

export type SettingsSubView =
  | 'main'
  | 'keypad'
  | 'theme'
  | 'permissions'
  | 'diagnostics'
  | 'data-sources'
  | 'install'
  | 'about'
  | 'privacy'
  | 'terms';

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
  // Inline data bindings for zero-popup experience
  contacts?: ContactItem[];
  calls?: CallLogItem[];
  rules?: BlockRule[];
  whitelist?: WhitelistEntry[];
  timelineEvents?: SecurityTimelineEvent[];
  onClearAllData?: () => void;
  onImportAllData?: (data: any) => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => void;
  initialSubView?: SettingsSubView;
}

type PrivacySettings = {
  callRecordingEnabled: boolean;
  showCallerDetailsInNotifications: boolean;
  privacyMode: boolean;
  clipboardPasteDetection: boolean;
  emergencyRepeatEnabled: boolean;
  emergencyRepeatThreshold: 3 | 4 | 5;
  emergencyRepeatWindow: 3 | 5 | 10;
};

export default function SettingsPage({
  settings,
  onUpdateSettings,
  isDefaultDialer,
  onRequestDefaultDialer,
  onSyncDatabase,
  isSyncing,
  autoCancelEnabled,
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
  initialSubView = 'main',
}: SettingsPageProps) {
  const { t, language, setLanguage } = useI18n();
  const [subView, setSubView] = useState<SettingsSubView>(initialSubView);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');

  const [privacy, setPrivacy] = useState<PrivacySettings>(() => {
    try {
      const raw = localStorage.getItem('callshield_privacy_settings');
      return raw
        ? JSON.parse(raw)
        : {
            callRecordingEnabled: true,
            showCallerDetailsInNotifications: true,
            privacyMode: false,
            clipboardPasteDetection: true,
            emergencyRepeatEnabled: true,
            emergencyRepeatThreshold: 3,
            emergencyRepeatWindow: 5,
          };
    } catch {
      return {
        callRecordingEnabled: true,
        showCallerDetailsInNotifications: true,
        privacyMode: false,
        clipboardPasteDetection: true,
        emergencyRepeatEnabled: true,
        emergencyRepeatThreshold: 3,
        emergencyRepeatWindow: 5,
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('callshield_privacy_settings', JSON.stringify(privacy));
    telecomBridge.setSecuritySetting('call_recording_enabled', privacy.callRecordingEnabled);
    telecomBridge.setSecuritySetting('notification_caller_details', privacy.showCallerDetailsInNotifications);
    telecomBridge.setSecuritySetting('privacy_mode', privacy.privacyMode);
    telecomBridge.setSecuritySetting('clipboard_paste_detection', privacy.clipboardPasteDetection);
    telecomBridge.setSecuritySetting('emergency_repeat_enabled', privacy.emergencyRepeatEnabled);
    telecomBridge.setSecuritySetting('emergency_repeat_threshold_4', privacy.emergencyRepeatThreshold === 4);
    telecomBridge.setSecuritySetting('emergency_repeat_threshold_5', privacy.emergencyRepeatThreshold === 5);
    telecomBridge.setSecuritySetting('emergency_repeat_window_3', privacy.emergencyRepeatWindow === 3);
    telecomBridge.setSecuritySetting('emergency_repeat_window_10', privacy.emergencyRepeatWindow === 10);
  }, [privacy]);

  const updatePrivacy = (key: keyof PrivacySettings, value: boolean | 3 | 4 | 5 | 10) =>
    setPrivacy((prev) => ({ ...prev, [key]: value } as PrivacySettings));

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

  const isTamil = language === 'ta';
  const isCompact = density === 'compact';

  // Haptic feedback intensity calculation
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

  const testKeypadDigit = (digit: string) => {
    if (settings?.keypadDtmfTones !== false) {
      playDtmfTone(digit);
    }
    testHapticPulse();
  };

  // --------------------------------------------------------------------------
  // SUB-VIEWS (Rendered inline without popup modals)
  // --------------------------------------------------------------------------
  if (subView === 'theme') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <ThemeCustomizerModal
            isOpen={true}
            inline={true}
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'permissions') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <PermissionCenterModal
            isOpen={true}
            inline={true}
            settings={settings || ({} as any)}
            onUpdateSettings={onUpdateSettings as any}
            isDefaultDialer={Boolean(isDefaultDialer)}
            onRequestDefaultDialer={onRequestDefaultDialer || (() => {})}
            onSyncContacts={onSyncDatabase || (() => {})}
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'diagnostics') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <SystemDiagnosticsModal
            isOpen={true}
            inline={true}
            contacts={contacts}
            calls={calls}
            rules={rules}
            whitelist={whitelist}
            settings={settings || ({} as any)}
            timelineEvents={timelineEvents}
            onResetToCleanState={onClearAllData || (() => {})}
            onImportAllData={onImportAllData || (() => {})}
            isDefaultDialer={isDefaultDialer}
            onRequestDefaultDialer={onRequestDefaultDialer}
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'data-sources') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <DataSourcesModal
            isOpen={true}
            inline={true}
            onClearAllData={onClearAllData || (() => {})}
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'install') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <InstallApkModal
            isOpen={true}
            inline={true}
            deferredPrompt={deferredPrompt}
            onTriggerInstall={onTriggerInstall || (() => {})}
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'about') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <AboutAppModal
            isOpen={true}
            inline={true}
            onClose={() => setSubView('main')}
            onOpenPrivacyTerms={(t) => setSubView(t || 'privacy')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'privacy') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <PrivacyTermsModal
            isOpen={true}
            inline={true}
            defaultTab="privacy"
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  if (subView === 'terms') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white p-4 sm:p-6 pb-28 animate-in fade-in duration-200">
        <div className="mx-auto max-w-3xl">
          <PrivacyTermsModal
            isOpen={true}
            inline={true}
            defaultTab="terms"
            onClose={() => setSubView('main')}
          />
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // DEDICATED INLINE KEYPAD & DIALING SETTINGS SUB-VIEW
  // --------------------------------------------------------------------------
  if (subView === 'keypad') {
    return (
      <div className="min-h-screen bg-[#070b12] text-white pb-28 animate-in fade-in duration-200">
        <header
          className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/95 backdrop-blur-xl px-4 py-3.5 sm:px-6 safe-top-header transition-all"
          style={{ paddingTop: 'max(0.85rem, calc(env(safe-area-inset-top, 0px) + 0.65rem))' }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95"
                aria-label="Back to Settings"
                title="Return to main settings"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Keypad & Dialing Experience
                </h1>
                <p className="text-[11px] text-slate-400">
                  Haptic pulses, DTMF audio, speed dial & dialing ergonomics
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => testHapticPulse()}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition"
            >
              <Vibrate className="h-3.5 w-3.5" />
              <span>Test Pulse</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-3.5 py-5 sm:px-6 space-y-6">
          {/* 1. HAPTIC FEEDBACK CARD */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Vibrate className="h-4 w-4" />
              <span>Tactile Haptic Feedback</span>
            </div>

            <SettingRow
              icon={<Vibrate className="h-4 w-4 text-emerald-400" />}
              title="Keypad Digit Haptic Feedback"
              description="Triggers an explicit physical vibration pulse on each number press for a realistic phone dialer feel."
              checked={settings?.keypadHapticFeedback !== false}
              onChange={(v) => updateShieldSetting('keypadHapticFeedback', v)}
            />

            {settings?.keypadHapticFeedback !== false && (
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Vibration Intensity</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Adjust tactile kick duration for digit keys, matching incoming calls and active calls
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => testHapticPulse()}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 active:scale-90 transition"
                  >
                    Test ({currentKeypadHapticMs}ms)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                  {[
                    { id: 'SOFT', label: 'Soft', ms: '15 ms', desc: 'Subtle tick' },
                    { id: 'STANDARD', label: 'Standard', ms: '25 ms', desc: 'Balanced' },
                    { id: 'STRONG', label: 'Strong', ms: '40 ms', desc: 'Crisp kick' },
                  ].map((level) => {
                    const isSelected = (settings?.keypadHapticIntensity || 'STANDARD') === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => {
                          updateShieldSetting('keypadHapticIntensity', level.id as any);
                          testHapticPulse(level.id === 'SOFT' ? 15 : level.id === 'STRONG' ? 40 : 25);
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition active:scale-95 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/20'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-bold">{level.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">{level.ms}</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">{level.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 2. AUDIO FEEDBACK CARD */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
              <Volume2 className="h-4 w-4" />
              <span>Keypad Audio & DTMF Tones</span>
            </div>

            <SettingRow
              icon={<Volume2 className="h-4 w-4 text-blue-400" />}
              title="Play DTMF Keypad Tones"
              description="Synthesize dual-tone multi-frequency audio for each digit (0-9, *, #) with gentle envelope shaping."
              checked={settings?.keypadDtmfTones !== false}
              onChange={(v) => updateShieldSetting('keypadDtmfTones', v)}
            />

            {/* Interactive Keypad Test Strip */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Interactive Keypad Preview & Tone Test
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tap any key to test your configured DTMF audio and tactile haptic pulse
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1 border-t border-slate-800">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => testKeypadDigit(d)}
                    className="flex flex-col items-center justify-center h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 active:border-emerald-500/40 active:ring-2 active:ring-emerald-400/30 active:scale-90 transition font-bold text-base text-white"
                  >
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3. DIALING CONVENIENCE & SHORTCUTS */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Sparkles className="h-4 w-4" />
              <span>Dialing Convenience & Shortcuts</span>
            </div>

            <SettingRow
              icon={<Sparkles className="h-4 w-4 text-amber-400" />}
              title="Clipboard Paste Detection"
              description="Automatically sanitizes pasted telephone numbers, removing dashes, brackets and illegal characters."
              checked={privacy.clipboardPasteDetection}
              onChange={(v) => updatePrivacy('clipboardPasteDetection', v)}
            />

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
              <div className="text-sm font-semibold text-white">Speed Dial Shortcuts</div>
              <p className="text-xs text-slate-400">
                • <strong>Hold 1:</strong> Direct Voicemail access (*86)
                <br />• <strong>Hold 0:</strong> Inserts international prefix (+)
                <br />• <strong>Press Call on empty dialer:</strong> Recalls last dialed number
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN SETTINGS HUB (Categorized Cards, Quick Search, No Popups)
  // --------------------------------------------------------------------------
  const q = searchQuery.toLowerCase().trim();
  const matchesSearch = (text: string) => (!q ? true : text.toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-[#070b12] text-white pb-28 animate-in fade-in duration-200">
      {/* Sticky Top Header with safe area clearance */}
      <header
        className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/95 backdrop-blur-xl px-4 py-3.5 sm:px-6 safe-top-header transition-all"
        style={{ paddingTop: 'max(0.85rem, calc(env(safe-area-inset-top, 0px) + 0.65rem))' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95"
              aria-label="Back"
              title="Return to dialer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">{t('settings_title')}</h1>
              <p className="text-[11px] text-slate-400">Caller ID, Spam Firewall, Audio & Device Roles</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDensityChange?.(isCompact ? 'comfortable' : 'compact')}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                isCompact
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              title="Toggle View Density"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isCompact ? 'Compact' : 'Comfortable'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="mx-auto max-w-3xl px-3.5 py-5 sm:px-6 space-y-6">
        {/* Quick Search in Settings */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all settings (e.g. keypad, haptic, SIM, recording, spam, lockscreen)..."
            className="w-full rounded-2xl border border-white/10 bg-[#0e141e] pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500/50 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Settings' },
            { id: 'KEYPAD', label: '🔢 Keypad & Dialing' },
            { id: 'PROTECTION', label: '🛡️ Spam Firewall' },
            { id: 'AUDIO', label: '📱 Hardware & Audio' },
            { id: 'RECORDING', label: '🎙️ Call Recording' },
            { id: 'SYSTEM', label: '⚙️ System & Roles' },
            { id: 'LEGAL', label: 'ℹ️ About & Legal' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 font-semibold transition active:scale-95 ${
                activeCategoryFilter === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 1. KEYPAD & DIALING EXPERIENCE (NEW & FEATURED) */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'KEYPAD') &&
          matchesSearch('keypad haptic dialer vibrate tone dtmf touch speed dial') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <div className="flex items-center gap-2">
                  <Grid className="h-4 w-4" />
                  <span>Keypad & Dialing Experience</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('keypad')}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <span>Customize</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                      <Vibrate className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Tactile Keypad Haptic Feedback</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        Physical vibration pulse on each digit press, tuned to match incoming calls and ongoing calls.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings?.keypadHapticFeedback !== false}
                    onClick={() => updateShieldSetting('keypadHapticFeedback', !(settings?.keypadHapticFeedback !== false))}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                      settings?.keypadHapticFeedback !== false ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        settings?.keypadHapticFeedback !== false ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Intensity:</span>
                    <span className="font-bold text-white uppercase text-[11px] bg-slate-800 px-2 py-0.5 rounded-md">
                      {settings?.keypadHapticIntensity || 'STANDARD'} ({currentKeypadHapticMs}ms)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => testHapticPulse()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-emerald-300 font-bold active:scale-95 transition"
                  >
                    <Vibrate className="h-3 w-3" />
                    <span>Test Pulse</span>
                  </button>
                </div>
              </div>

              <SettingRow
                icon={<Volume2 className="h-4 w-4 text-blue-400" />}
                title="Keypad DTMF Audio Tones"
                description="Play dual-frequency sound on each digit press for authentic telephony audio feedback."
                checked={settings?.keypadDtmfTones !== false}
                onChange={(v) => updateShieldSetting('keypadDtmfTones', v)}
              />

              <button
                type="button"
                onClick={() => setSubView('keypad')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Grid className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">Full Keypad & Dialing Settings</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Configure speed dial, auto-paste, private prefixes and test key sounds inline
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            </section>
          )}

        {/* 2. LANGUAGE & DISPLAY SECTION */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'SYSTEM') &&
          matchesSearch('language english tamil display appearance theme color') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                <Globe className="h-4 w-4" />
                <span>{t('settings_cat_lang_display')}</span>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{t('language_section_title')}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{t('language_section_desc')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                      language === 'en'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg">🇬🇧</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold">English</div>
                      <div className={`text-[10px] ${language === 'en' ? 'text-blue-100' : 'text-slate-500'}`}>Default</div>
                    </div>
                    {language === 'en' && <Check className="h-4 w-4 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('ta')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition ${
                      language === 'ta'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-lg">🇮🇳</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold">தமிழ்</div>
                      <div className={`text-[10px] ${language === 'ta' ? 'text-blue-100' : 'text-slate-500'}`}>Tamil</div>
                    </div>
                    {language === 'ta' && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Appearance & Theme Inline Navigation (No popup!) */}
              <button
                type="button"
                onClick={() => setSubView('theme')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                    <Palette className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('appearance_title')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('appearance_desc')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                  <span>Open Theme</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            </section>
          )}

        {/* 3. SPAM SHIELD & PRIVACY SECTION */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'PROTECTION') &&
          matchesSearch('spam shield privacy autocancel notification emergency') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <Shield className="h-4 w-4" />
                <span>{t('settings_cat_protection')}</span>
              </div>

              <SettingRow
                icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
                title={t('autocancel_spam_title')}
                description={t('autocancel_spam_desc')}
                checked={autoCancelEnabled !== false}
                onChange={onToggleAutoCancel || (() => {})}
              />

              <SettingRow
                icon={<Lock className="h-4 w-4 text-blue-400" />}
                title={t('private_notification_title')}
                description={t('private_notification_desc')}
                checked={privacy.privacyMode}
                onChange={(v) => updatePrivacy('privacyMode', v)}
              />

              <SettingRow
                icon={<Bell className="h-4 w-4 text-amber-400" />}
                title={t('detailed_notifications_title')}
                description={t('detailed_notifications_desc')}
                checked={privacy.showCallerDetailsInNotifications}
                onChange={(v) => updatePrivacy('showCallerDetailsInNotifications', v)}
              />

              {/* Repeated-Call Emergency Alert Configuration */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{t('emergency_repeat_title')}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{t('emergency_repeat_desc')}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={privacy.emergencyRepeatEnabled}
                    onClick={() => updatePrivacy('emergencyRepeatEnabled', !privacy.emergencyRepeatEnabled)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      privacy.emergencyRepeatEnabled ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        privacy.emergencyRepeatEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {privacy.emergencyRepeatEnabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">{t('calls_needed')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[3, 4, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => updatePrivacy('emergencyRepeatThreshold', count as 3 | 4 | 5)}
                            className={`rounded-xl p-2 text-xs font-bold transition border ${
                              privacy.emergencyRepeatThreshold === count
                                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                            }`}
                          >
                            {count} {isTamil ? 'அழைப்புகள்' : 'calls'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

        {/* 4. HARDWARE & AUDIO CONTROLS */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'AUDIO') &&
          matchesSearch('hardware audio power volume ringer connected silence flash') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Smartphone className="h-4 w-4" />
                <span>{t('settings_cat_hardware')}</span>
              </div>

              <SettingRow
                icon={<PhoneCall className="h-4 w-4 text-rose-400" />}
                title={t('power_ends_call')}
                description={t('power_ends_call_desc')}
                checked={Boolean(settings?.powerButtonEndsCall)}
                onChange={(v) => updateShieldSetting('powerButtonEndsCall', v)}
              />

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{t('volume_button_action')}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{t('volume_button_action_desc')}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateShieldSetting('volumeButtonAction', 'MUTE_RINGER')}
                    className={`rounded-xl p-2.5 text-xs font-bold transition border text-center ${
                      settings?.volumeButtonAction !== 'REJECT_CALL'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('volume_action_mute')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateShieldSetting('volumeButtonAction', 'REJECT_CALL')}
                    className={`rounded-xl p-2.5 text-xs font-bold transition border text-center ${
                      settings?.volumeButtonAction === 'REJECT_CALL'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('volume_action_reject')}
                  </button>
                </div>
              </div>

              <SettingRow
                icon={<Vibrate className="h-4 w-4 text-emerald-400" />}
                title={t('vibrate_on_connected')}
                description={t('vibrate_on_connected_desc')}
                checked={settings?.vibrateOnCallConnected !== false}
                onChange={(v) => updateShieldSetting('vibrateOnCallConnected', v)}
              />

              <SettingRow
                icon={<Smartphone className="h-4 w-4 text-cyan-400" />}
                title={t('flip_to_silence')}
                description={t('flip_to_silence_desc')}
                checked={settings?.flipToSilence !== false}
                onChange={(v) => updateShieldSetting('flipToSilence', v)}
              />

              <SettingRow
                icon={<Sparkles className="h-4 w-4 text-amber-400" />}
                title={t('flash_alert')}
                description={t('flash_alert_desc')}
                checked={Boolean(settings?.flashAlertOnIncomingCall)}
                onChange={(v) => updateShieldSetting('flashAlertOnIncomingCall', v)}
              />
            </section>
          )}

        {/* 5. CALL RECORDING & AUDIO */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'RECORDING') &&
          matchesSearch('recording mic audio folder wav storage') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                <Mic className="h-4 w-4" />
                <span>{t('settings_cat_recording')}</span>
              </div>

              <SettingRow
                icon={<Mic className="h-4 w-4 text-rose-400" />}
                title={t('call_recording_title')}
                description={t('call_recording_desc')}
                checked={privacy.callRecordingEnabled}
                onChange={(v) => updatePrivacy('callRecordingEnabled', v)}
              />

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">{t('recording_clear_title')}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t('recording_hardware_note')}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  <span>{t('noise_cancellation_active')}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <FolderOpen className="h-4 w-4 text-blue-400" />
                  <span>{t('recording_storage_folder')}</span>
                </div>
                <div className="font-mono text-xs text-slate-400 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {DEFAULT_RECORDINGS_FOLDER}
                </div>
              </div>
            </section>
          )}

        {/* 6. SYSTEM, TELECOM & INTEGRATION (No Popups!) */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'SYSTEM') &&
          matchesSearch('system telecom default role permissions sync diagnostics database sources apk install') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <Sliders className="h-4 w-4" />
                <span>{t('settings_cat_system')}</span>
              </div>

              {/* Default Phone Role Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      isDefaultDialer ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">
                      {isDefaultDialer ? t('default_phone_status_active') : t('default_phone_title')}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {isDefaultDialer ? t('default_phone_role_desc') : t('default_phone_desc')}
                    </div>
                  </div>
                </div>
                {!isDefaultDialer && onRequestDefaultDialer && (
                  <button
                    type="button"
                    onClick={onRequestDefaultDialer}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition active:scale-95"
                  >
                    {t('set_as_default_phone_button')}
                  </button>
                )}
              </div>

              {/* Permission Center & Safety (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('permissions')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                    <Sliders className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('permission_center')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('permission_center_desc')}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>

              {/* Sync Database Action */}
              {onSyncDatabase && (
                <button
                  type="button"
                  onClick={onSyncDatabase}
                  disabled={isSyncing}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition disabled:opacity-60"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Database className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">
                      {isSyncing ? t('synchronizing') : t('sync_device_data')}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('sync_device_desc')}</span>
                  </div>
                </button>
              )}

              {/* System Diagnostics (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('diagnostics')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('system_diagnostics')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('system_diagnostics_desc')}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>

              {/* Data Sources & Privacy Registry (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('data-sources')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                    <Database className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('data_sources_privacy')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('data_sources_desc')}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>

              {/* Packaging & Offline APK (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('install')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                    <Download className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('install_packaging')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{t('install_packaging_desc')}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            </section>
          )}

        {/* 7. ABOUT & LEGAL (No Popups!) */}
        {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'LEGAL') &&
          matchesSearch('about legal privacy policy terms version') && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>About & Legal</span>
              </div>

              {/* About Us (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('about')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                    <Info className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('about_us')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      CallShield v2.4.0 Production • Zero-telemetry protection
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>

              {/* Privacy Policy (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('privacy')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Lock className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('privacy_policy')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Strict on-device processing • No cloud contact uploads
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>

              {/* Terms of Service (Inline Sub-page) */}
              <button
                type="button"
                onClick={() => setSubView('terms')}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-bold text-white">{t('terms_of_service')}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Emergency routing, local recording terms & compliance
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            </section>
          )}
      </main>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-xs text-slate-400">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

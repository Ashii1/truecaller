import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Database,
  Download,
  FileText,
  FolderOpen,
  Globe,
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
  X,
} from 'lucide-react';
import { ShieldSettings, DisplayDensity } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';

interface SettingsPageProps {
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
  onOpenAbout: () => void;
  onOpenPrivacyTerms: (tab?: 'privacy' | 'terms') => void;
  onOpenTheme: () => void;
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
  onOpenPermissionCenter,
  onSyncDatabase,
  isSyncing,
  autoCancelEnabled,
  onToggleAutoCancel,
  onOpenInstallModal,
  onOpenDataSources,
  onOpenDiagnostics,
  density = 'comfortable',
  onDensityChange,
  onBack,
  onOpenAbout,
  onOpenPrivacyTerms,
  onOpenTheme,
}: SettingsPageProps) {
  const { t, language, setLanguage } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="min-h-screen bg-[#070b12] text-white pb-28 animate-in fade-in duration-200">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/95 backdrop-blur-xl px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95"
              aria-label="Back"
              title="Return to previous screen"
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
                isCompact ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
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
            placeholder="Search all settings (e.g. SIM, recording, spam, lockscreen)..."
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

        {/* 1. LANGUAGE & DISPLAY SECTION */}
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

          <button
            type="button"
            onClick={onOpenTheme}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
              <Palette className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{t('appearance_title')}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{t('appearance_desc')}</span>
            </span>
            <span className="text-xs font-bold text-blue-400 shrink-0">{t('customize')} &rarr;</span>
          </button>
        </section>

        {/* 2. SPAM SHIELD & PRIVACY SECTION */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Shield className="h-4 w-4" />
            <span>{t('settings_cat_protection')}</span>
          </div>

          <SettingRow
            icon={<ShieldCheck className="h-4 w-4" />}
            title={t('autocancel_spam_title')}
            description={t('autocancel_spam_desc')}
            checked={autoCancelEnabled !== false}
            onChange={onToggleAutoCancel || (() => {})}
          />

          <SettingRow
            icon={<Lock className="h-4 w-4" />}
            title={t('private_notification_title')}
            description={t('private_notification_desc')}
            checked={privacy.privacyMode}
            onChange={(v) => updatePrivacy('privacyMode', v)}
          />

          <SettingRow
            icon={<Bell className="h-4 w-4" />}
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

        {/* 3. HARDWARE & AUDIO CONTROLS */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Smartphone className="h-4 w-4" />
            <span>{t('settings_cat_hardware')}</span>
          </div>

          <SettingRow
            icon={<PhoneCall className="h-4 w-4" />}
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
            icon={<Vibrate className="h-4 w-4" />}
            title={t('vibrate_on_connected')}
            description={t('vibrate_on_connected_desc')}
            checked={settings?.vibrateOnCallConnected !== false}
            onChange={(v) => updateShieldSetting('vibrateOnCallConnected', v)}
          />

          <SettingRow
            icon={<Smartphone className="h-4 w-4" />}
            title={t('flip_to_silence')}
            description={t('flip_to_silence_desc')}
            checked={settings?.flipToSilence !== false}
            onChange={(v) => updateShieldSetting('flipToSilence', v)}
          />

          <SettingRow
            icon={<Sparkles className="h-4 w-4" />}
            title={t('flash_alert')}
            description={t('flash_alert_desc')}
            checked={Boolean(settings?.flashAlertOnIncomingCall)}
            onChange={(v) => updateShieldSetting('flashAlertOnIncomingCall', v)}
          />
        </section>

        {/* 4. CALL RECORDING & AUDIO */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
            <Mic className="h-4 w-4" />
            <span>{t('settings_cat_recording')}</span>
          </div>

          <SettingRow
            icon={<Mic className="h-4 w-4" />}
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

        {/* 5. SYSTEM, TELECOM & INTEGRATION */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <Sliders className="h-4 w-4" />
            <span>{t('settings_cat_system')}</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isDefaultDialer ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
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
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
              >
                {t('set_as_default_phone_button')}
              </button>
            )}
          </div>

          {onOpenPermissionCenter && (
            <button
              type="button"
              onClick={onOpenPermissionCenter}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                <Sliders className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{t('permission_center')}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{t('permission_center_desc')}</span>
              </span>
            </button>
          )}

          {onSyncDatabase && (
            <button
              type="button"
              onClick={onSyncDatabase}
              disabled={isSyncing}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition disabled:opacity-60"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Database className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{isSyncing ? t('synchronizing') : t('sync_device_data')}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{t('sync_device_desc')}</span>
              </span>
            </button>
          )}

          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                <Stethoscope className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{t('system_diagnostics')}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{t('system_diagnostics_desc')}</span>
              </span>
            </button>
          )}

          {onOpenDataSources && (
            <button
              type="button"
              onClick={onOpenDataSources}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                <Database className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{t('data_sources_privacy')}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{t('data_sources_desc')}</span>
              </span>
            </button>
          )}

          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300 shrink-0">
                <Download className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{t('install_packaging')}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{t('install_packaging_desc')}</span>
              </span>
            </button>
          )}
        </section>

        {/* 6. ABOUT & LEGAL */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>About & Legal</span>
          </div>

          <button
            type="button"
            onClick={onOpenAbout}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
              <Info className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{t('about_us')}</span>
              <span className="mt-0.5 block text-xs text-slate-400">CallShield v2.4.0 Production • Zero-telemetry protection</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPrivacyTerms('privacy')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Lock className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{t('privacy_policy')}</span>
              <span className="mt-0.5 block text-xs text-slate-400">Strict on-device processing • No cloud contact uploads</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPrivacyTerms('terms')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <FileText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{t('terms_of_service')}</span>
              <span className="mt-0.5 block text-xs text-slate-400">Emergency routing, local recording terms & compliance</span>
            </span>
          </button>
        </section>
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

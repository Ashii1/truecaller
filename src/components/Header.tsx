import { useEffect, useState, useMemo, memo, type ReactNode } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock,
  Database,
  Download,
  LockKeyhole,
  Maximize2,
  MicOff,
  Minimize2,
  PhoneCall,
  LayoutGrid,
  Palette,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { CallLogItem, DisplayDensity, ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import ThemeCustomizerModal from './ThemeCustomizerModal';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../i18n/LanguageContext';
import { formatPhoneNumber } from '../utils/spamEngine';

interface HeaderProps {
  settings?: ShieldSettings;
  onToggleShield?: () => void;
  isDefaultDialer?: boolean;
  onRequestDefaultDialer?: () => void;
  onOpenPermissionCenter?: () => void;
  onSyncDatabase?: () => void;
  isSyncing?: boolean;
  onTriggerIncomingCall?: () => void;
  autoCancelEnabled?: boolean;
  onToggleAutoCancel?: () => void;
  onOpenInstallModal?: () => void;
  onOpenDataSources?: () => void;
  onOpenDiagnostics?: () => void;
  recentSpamCalls?: CallLogItem[];
  onSelectCall?: (call: CallLogItem) => void;
  onOpenRecents?: () => void;
  onOpenProtection?: () => void;
  density?: DisplayDensity;
  onDensityChange?: (density: DisplayDensity) => void;
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

const PRIVACY_DEFAULTS: PrivacySettings = {
  callRecordingEnabled: false,
  showCallerDetailsInNotifications: false,
  privacyMode: true,
  clipboardPasteDetection: true,
  emergencyRepeatEnabled: true,
  emergencyRepeatThreshold: 3,
  emergencyRepeatWindow: 5,
};

function readPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem('callshield_privacy_settings');
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...PRIVACY_DEFAULTS, ...parsed };
  } catch {
    return PRIVACY_DEFAULTS;
  }
}

function Header({
  settings,
  onToggleShield,
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
  recentSpamCalls = [],
  onSelectCall,
  onOpenRecents,
  onOpenProtection,
  density = 'comfortable',
  onDensityChange,
}: HeaderProps) {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [widgetFeedback, setWidgetFeedback] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings>(readPrivacySettings);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('callshield_dismissed_notifications');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowSettings(false);
      setShowNotifications(false);
      setShowTheme(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

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
    setPrivacy(prev => ({ ...prev, [key]: value } as PrivacySettings));

  // Active notifications derived from recent spam/blocked calls and security system
  const activeNotifications = useMemo(() => {
    return recentSpamCalls.filter(c => !dismissedNotificationIds.includes(c.id)).slice(0, 10);
  }, [recentSpamCalls, dismissedNotificationIds]);

  const handleDismissNotification = (id: string) => {
    setDismissedNotificationIds(prev => {
      const updated = [...prev, id];
      localStorage.setItem('callshield_dismissed_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllNotifications = () => {
    const allIds = recentSpamCalls.map(c => c.id);
    setDismissedNotificationIds(allIds);
    localStorage.setItem('callshield_dismissed_notifications', JSON.stringify(allIds));
  };

  return (
    <>
      {/* Top Header Bar with Safe-Area Clearance for Android Notification Panel */}
      <header
        id="app-top-header"
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0f14]/98 backdrop-blur-xl safe-top-header pb-2 transition-all shadow-md shadow-black/20"
      >
        <div className="mx-auto flex h-14 sm:h-16 max-w-4xl items-center justify-between gap-2 px-3.5 sm:px-6">
          {/* Brand & Live Protection Status */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-md transition-all ${
                settings?.masterEnabled !== false
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
              aria-hidden="true"
            >
              {settings?.masterEnabled !== false ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight tracking-tight text-white">{t('app_title')}</div>
              <div className="text-[9px] font-medium leading-tight text-slate-500">{t('app_tagline')}</div>
              <div className="truncate text-[10.5px] font-medium text-slate-400 flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${settings?.masterEnabled !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>{isDefaultDialer ? t('default_phone_app') : t('phone_setup_required')}</span>
              </div>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher variant="header" />

            {/* User-Controlled Compact / Comfortable Display Toggle */}
            {onDensityChange && (
              <div
                id="header-density-toggle-group"
                className="flex items-center rounded-lg border border-slate-700/80 bg-slate-900 p-0.5"
                role="group"
                aria-label={t('display_density')}
              >
                <button
                  id="header-density-compact-btn"
                  type="button"
                  onClick={() => onDensityChange('compact')}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-all ${
                    density === 'compact'
                      ? 'bg-emerald-500/25 text-emerald-300 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={t('compact_mode_desc')}
                  aria-label={t('compact_mode')}
                  aria-pressed={density === 'compact'}
                >
                  <Minimize2 className="h-3 w-3" />
                  <span className="hidden md:inline">{t('compact_mode')}</span>
                </button>
                <button
                  id="header-density-comfortable-btn"
                  type="button"
                  onClick={() => onDensityChange('comfortable')}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-all ${
                    density === 'comfortable'
                      ? 'bg-emerald-500/25 text-emerald-300 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={t('comfortable_mode_desc')}
                  aria-label={t('comfortable_mode')}
                  aria-pressed={density === 'comfortable'}
                >
                  <Maximize2 className="h-3 w-3" />
                  <span className="hidden md:inline">{t('comfortable_mode')}</span>
                </button>
              </div>
            )}

            {/* Notification Panel Button */}
            <button
              id="header-notification-panel-btn"
              type="button"
              onClick={() => setShowNotifications(prev => !prev)}
              className={`relative grid h-8 w-8 place-items-center rounded-lg border transition-all ${
                showNotifications
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                  : 'border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              aria-label={t('notification_panel_title')}
              title={t('notification_panel_title')}
            >
              <Bell className="h-3.5 w-3.5" />
              {activeNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white shadow-sm ring-2 ring-[#0b0f14]">
                  {activeNotifications.length > 9 ? '9+' : activeNotifications.length}
                </span>
              )}
            </button>

            {onRequestDefaultDialer && !isDefaultDialer && (
              <button
                onClick={onRequestDefaultDialer}
                className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 sm:flex"
              >
                <PhoneCall className="h-3.5 w-3.5" /> {t('set_as_phone_app')}
              </button>
            )}

            {isDefaultDialer && onToggleShield && (
              <button
                onClick={onToggleShield}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  settings?.masterEnabled !== false
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {settings?.masterEnabled !== false ? t('protected') : t('paused')}
              </button>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              aria-label={t('settings_title')}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ONE UI NOTIFICATION PANEL (Accessible from Header Bell) */}
      {showNotifications && (
        <div
          id="oneui-notification-panel-overlay"
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm p-2 safe-top-panel sm:p-4 sm:pt-16 animate-in fade-in duration-150"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e141c] shadow-2xl shadow-black/80"
            onClick={e => e.stopPropagation()}
          >
            {/* Notification Panel Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#121924] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <BellRing className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {t('notification_panel_title')}
                    {activeNotifications.length > 0 && (
                      <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-400">
                        {activeNotifications.length}
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeNotifications.length > 0 && (
                  <button
                    onClick={handleClearAllNotifications}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-white/5 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t('clear_all')}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label={t('close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick System Protection Banner in Notification Panel */}
            <div className="border-b border-white/[0.06] bg-emerald-500/[0.04] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">
                    {settings?.masterEnabled !== false ? 'Live Call Firewall Active' : 'Protection Paused'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenProtection?.();
                  }}
                  className="text-[11px] font-bold text-emerald-400 hover:underline"
                >
                  {t('nav_protection')} &rarr;
                </button>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                <span>Auto-Cancel: {autoCancelEnabled !== false ? 'ON' : 'OFF'}</span>
                <span>·</span>
                <span>TRAI Gateways: Monitored</span>
                <span>·</span>
                <span>Dual-SIM: Protected</span>
              </div>
            </div>

            {/* Notification Items List */}
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-white/[0.05] p-1">
              {activeNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/5 text-slate-500">
                    <CheckCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-300">{t('notification_panel_empty')}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Spam calls, blocked telemarketers, and urgent repeats will appear here.
                  </p>
                </div>
              ) : (
                activeNotifications.map(call => (
                  <div
                    key={call.id}
                    className="flex items-start justify-between gap-3 p-3 transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400 mt-0.5">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{call.callerName || formatPhoneNumber(call.number)}</span>
                          <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-extrabold text-rose-300">
                            {call.spamCategory || 'SPAM'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                          {call.spamReason || 'Flagged by CallShield security engine'}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">{formatPhoneNumber(call.number)}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onSelectCall && (
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            onSelectCall(call);
                          }}
                          className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
                        >
                          Details
                        </button>
                      )}
                      <button
                        onClick={() => handleDismissNotification(call.id)}
                        className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Notification Settings Footer */}
            <div className="border-t border-white/[0.08] bg-[#121924]/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{t('private_notification_title')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={privacy.privacyMode}
                  onClick={() => updatePrivacy('privacyMode', !privacy.privacyMode)}
                  className={`relative h-6 w-10 rounded-full transition ${
                    privacy.privacyMode ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                      privacy.privacyMode ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[70] bg-black/60 p-0 sm:p-4" onClick={() => setShowSettings(false)} role="presentation">
          <section
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 shadow-2xl sm:relative sm:mx-auto sm:my-8 sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:rounded-3xl sm:border"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 pb-4 safe-top-modal sm:pt-5 backdrop-blur">
              <div>
                <h2 className="text-lg font-bold text-white">{t('settings_title')}</h2>
                <p className="mt-0.5 text-xs text-slate-400">{t('settings_subtitle')}</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <LanguageSwitcher variant="settings" />

              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowTheme(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-left hover:bg-blue-500/10"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Palette className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{t('appearance_title')}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{t('appearance_desc')}</span>
                </span>
                <span className="text-xs font-bold text-blue-400">{t('customize')}</span>
              </button>

              {!isDefaultDialer && onRequestDefaultDialer && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{t('default_phone_title')}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{t('default_phone_desc')}</div>
                      <button
                        onClick={onRequestDefaultDialer}
                        className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                      >
                        {t('set_as_default_phone_button')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <SettingRow
                icon={<LockKeyhole className="h-4 w-4" />}
                title={t('private_notification_title')}
                description={t('private_notification_desc')}
                checked={privacy.privacyMode}
                onChange={v => updatePrivacy('privacyMode', v)}
              />
              <SettingRow
                icon={<Bell className="h-4 w-4" />}
                title={t('detailed_notifications_title')}
                description={t('detailed_notifications_desc')}
                checked={privacy.showCallerDetailsInNotifications}
                onChange={v => updatePrivacy('showCallerDetailsInNotifications', v)}
              />
              <SettingRow
                icon={<MicOff className="h-4 w-4" />}
                title={t('call_recording_title')}
                description={t('call_recording_desc')}
                checked={privacy.callRecordingEnabled}
                onChange={v => updatePrivacy('callRecordingEnabled', v)}
                danger={privacy.callRecordingEnabled}
              />
              <SettingRow
                icon={<Settings className="h-4 w-4" />}
                title={t('clipboard_paste_title')}
                description={t('clipboard_paste_desc')}
                checked={privacy.clipboardPasteDetection}
                onChange={v => updatePrivacy('clipboardPasteDetection', v)}
              />

              {onToggleAutoCancel && (
                <SettingRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title={t('autocancel_spam_title')}
                  description={t('autocancel_spam_desc')}
                  checked={autoCancelEnabled !== false}
                  onChange={() => onToggleAutoCancel()}
                />
              )}

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Siren className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{t('emergency_repeat_title')}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{t('emergency_repeat_desc')}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <SettingRow
                    icon={<Siren className="h-4 w-4" />}
                    title={t('enable_repeat_alert')}
                    description={t('repeat_alert_desc')}
                    checked={privacy.emergencyRepeatEnabled}
                    onChange={v => updatePrivacy('emergencyRepeatEnabled', v)}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">
                    {t('calls_needed')}
                    <select
                      value={privacy.emergencyRepeatThreshold}
                      onChange={e => updatePrivacy('emergencyRepeatThreshold', Number(e.target.value) as 3 | 4 | 5)}
                      className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm font-semibold text-white outline-none"
                    >
                      <option value={3}>{t('calls_count_3')}</option>
                      <option value={4}>{t('calls_count_4')}</option>
                      <option value={5}>{t('calls_count_5')}</option>
                    </select>
                  </label>
                  <label className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">
                    {t('time_window')}
                    <select
                      value={privacy.emergencyRepeatWindow}
                      onChange={e => updatePrivacy('emergencyRepeatWindow', Number(e.target.value) as 3 | 5 | 10)}
                      className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm font-semibold text-white outline-none"
                    >
                      <option value={3}>{t('time_window_3')}</option>
                      <option value={5}>{t('time_window_5')}</option>
                      <option value={10}>{t('time_window_10')}</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 rounded-xl bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-500">
                  {t('emergency_footer_note')}
                </div>
              </div>

              {onRequestDefaultDialer && (
                <button
                  onClick={onRequestDefaultDialer}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  {isDefaultDialer ? t('default_phone_status_active') : t('set_as_default_phone_button')}
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {t('default_phone_role_desc')}
                  </span>
                </button>
              )}
              {onOpenPermissionCenter && (
                <button
                  onClick={() => {
                    setShowSettings(false);
                    onOpenPermissionCenter();
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  {t('permission_center')}
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {t('permission_center_desc')}
                  </span>
                </button>
              )}
              {onSyncDatabase && (
                <button
                  onClick={onSyncDatabase}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"
                >
                  <Database className="h-5 w-5 text-cyan-400" />
                  <span className="flex-1">
                    <b className="block text-sm text-white">{t('sync_device_data')}</b>
                    <span className="mt-1 block text-xs text-slate-500">
                      {isSyncing ? t('synchronizing') : t('sync_device_desc')}
                    </span>
                  </span>
                </button>
              )}
              {onOpenDataSources && (
                <button
                  onClick={() => {
                    setShowSettings(false);
                    onOpenDataSources();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"
                >
                  <Database className="h-5 w-5 text-indigo-400" />
                  <span>
                    <b className="block text-sm text-white">{t('data_sources_privacy')}</b>
                    <span className="mt-1 block text-xs text-slate-500">{t('data_sources_desc')}</span>
                  </span>
                </button>
              )}
              {onOpenDiagnostics && (
                <button
                  onClick={() => {
                    setShowSettings(false);
                    onOpenDiagnostics();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"
                >
                  <Stethoscope className="h-5 w-5 text-amber-400" />
                  <span>
                    <b className="block text-sm text-white">{t('system_diagnostics')}</b>
                    <span className="mt-1 block text-xs text-slate-500">{t('system_diagnostics_desc')}</span>
                  </span>
                </button>
              )}
              {onOpenInstallModal && (
                <button
                  onClick={() => {
                    setShowSettings(false);
                    onOpenInstallModal();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"
                >
                  <Download className="h-5 w-5 text-emerald-400" />
                  <span>
                    <b className="block text-sm text-white">{t('install_packaging')}</b>
                    <span className="mt-1 block text-xs text-slate-500">{t('install_packaging_desc')}</span>
                  </span>
                </button>
              )}

              {/* Home Screen Widgets Section */}
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-start gap-3">
                  <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">Home Screen Widgets</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      Add quick one-tap calling and live spam protection status to your Android home screen.
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const res = telecomBridge.pinWidget('speed_dial');
                      setWidgetFeedback(res.message);
                      setTimeout(() => setWidgetFeedback(null), 4500);
                    }}
                    className="flex flex-col items-start gap-1 rounded-xl border border-sky-500/30 bg-slate-900/90 p-3 text-left transition-colors hover:bg-slate-800 active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>Speed Dial Widget</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Top contacts & 1-tap dialer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const res = telecomBridge.pinWidget('security');
                      setWidgetFeedback(res.message);
                      setTimeout(() => setWidgetFeedback(null), 4500);
                    }}
                    className="flex flex-col items-start gap-1 rounded-xl border border-emerald-500/30 bg-slate-900/90 p-3 text-left transition-colors hover:bg-slate-800 active:scale-98"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Protection Widget</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Live spam guard stats & dialer</span>
                  </button>
                </div>

                {widgetFeedback && (
                  <div className="mt-2.5 rounded-lg bg-sky-950/80 border border-sky-500/40 px-3 py-2 text-xs font-medium text-sky-200">
                    {widgetFeedback}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs leading-5 text-slate-500">
                {t('security_principle_note')}
              </div>
            </div>
          </section>
        </div>
      )}
      <ThemeCustomizerModal isOpen={showTheme} onClose={() => setShowTheme(false)} />
    </>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              danger ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            checked ? (danger ? 'bg-amber-500' : 'bg-emerald-600') : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              checked ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export default memo(Header);

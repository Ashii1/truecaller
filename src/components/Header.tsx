import { useEffect, useState, useMemo, memo, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  Database,
  Download,
  FolderOpen,
  Globe,
  Lock,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneCall,
  PhoneOff,
  Palette,
  Settings,
  Power,
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
  Radio,
} from 'lucide-react';
import { CallLogItem, DisplayDensity, IncomingCallState, ShieldSettings, ActiveCallSession } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import ThemeCustomizerModal from './ThemeCustomizerModal';
import { useI18n } from '../i18n/LanguageContext';
import { formatPhoneNumber } from '../utils/spamEngine';
import { formatTimeAmPm } from '../utils/timeFormat';
import { DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';

interface HeaderProps {
  settings?: ShieldSettings;
  onUpdateSettings?: (settings: ShieldSettings | ((prev: ShieldSettings) => ShieldSettings)) => void;
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
  closeSettingsSignal?: number;
  activeIncomingCall?: IncomingCallState | null;
  onAnswerIncomingCall?: () => void;
  onDeclineIncomingCall?: () => void;
  onExpandIncomingCall?: () => void;
  isDeviceLocked?: boolean;
  onToggleLockDevice?: () => void;
  activeCallSession?: ActiveCallSession | null;
  onMaximizeOngoingCall?: () => void;
  onEndOngoingCall?: () => void;
  isSettingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  isNotificationsOpen?: boolean;
  onNotificationsOpenChange?: (open: boolean) => void;
  isThemeOpen?: boolean;
  onThemeOpenChange?: (open: boolean) => void;
  minimizedCaller?: CallLogItem | null;
  onReopenCaller?: () => void;
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
  callRecordingEnabled: true,
  showCallerDetailsInNotifications: true,
  privacyMode: false,
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
  onUpdateSettings,
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
  closeSettingsSignal = 0,
  activeIncomingCall,
  onAnswerIncomingCall,
  onDeclineIncomingCall,
  onExpandIncomingCall,
  isDeviceLocked = false,
  onToggleLockDevice,
  onTriggerIncomingCall,
  activeCallSession,
  onMaximizeOngoingCall,
  onEndOngoingCall,
  isSettingsOpen,
  onSettingsOpenChange,
  isNotificationsOpen,
  onNotificationsOpenChange,
  isThemeOpen,
  onThemeOpenChange,
  minimizedCaller,
  onReopenCaller,
}: HeaderProps) {
  const { t, language, setLanguage, isTamil } = useI18n();
  const [internalSettings, setInternalSettings] = useState(false);
  const [internalNotifications, setInternalNotifications] = useState(false);
  const [internalTheme, setInternalTheme] = useState(false);

  const showSettings = isSettingsOpen !== undefined ? isSettingsOpen : internalSettings;
  const setShowSettings = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(showSettings) : val;
    setInternalSettings(next);
    onSettingsOpenChange?.(next);
  };

  const showNotifications = isNotificationsOpen !== undefined ? isNotificationsOpen : internalNotifications;
  const setShowNotifications = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(showNotifications) : val;
    setInternalNotifications(next);
    onNotificationsOpenChange?.(next);
  };

  const showTheme = isThemeOpen !== undefined ? isThemeOpen : internalTheme;
  const setShowTheme = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(showTheme) : val;
    setInternalTheme(next);
    onThemeOpenChange?.(next);
  };

  const [privacy, setPrivacy] = useState<PrivacySettings>(readPrivacySettings);
  const [liveCallDuration, setLiveCallDuration] = useState(0);

  useEffect(() => {
    if (!activeCallSession) {
      setLiveCallDuration(0);
      return;
    }
    setLiveCallDuration(activeCallSession.durationSeconds || 0);
    const interval = window.setInterval(() => {
      setLiveCallDuration((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeCallSession?.id]);

  const formatCallDuration = (totalSeconds: number): string => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('callshield_dismissed_notifications');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

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

  useEffect(() => {
    setShowSettings(false);
    setShowTheme(false);
    setShowNotifications(false);
  }, [closeSettingsSignal]);

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
    setPrivacy((prev) => ({ ...prev, [key]: value } as PrivacySettings));

  const activeNotifications = useMemo(() => {
    return recentSpamCalls.filter((c) => !dismissedNotificationIds.includes(c.id)).slice(0, 10);
  }, [recentSpamCalls, dismissedNotificationIds]);

  const handleDismissNotification = (id: string) => {
    setDismissedNotificationIds((prev) => {
      const updated = [...prev, id];
      localStorage.setItem('callshield_dismissed_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllNotifications = () => {
    const allIds = recentSpamCalls.map((c) => c.id);
    setDismissedNotificationIds(allIds);
    localStorage.setItem('callshield_dismissed_notifications', JSON.stringify(allIds));
  };

  return (
    <>
      {/* Top Header Bar with Clean Minimalist Layout */}
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
              <div className="text-sm font-black leading-tight tracking-tight text-white">{t('app_title')}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${settings?.masterEnabled !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span>{settings?.masterEnabled !== false ? t('protected') : t('paused')}</span>
              </div>
            </div>
          </div>

          {/* Header Action Tools */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Display Density Switcher */}
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
                      ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-xs'
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
                      ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-xs'
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
              onClick={() => setShowNotifications((prev) => !prev)}
              className={`relative grid h-8 w-8 place-items-center rounded-lg border transition-all ${
                showNotifications
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                  : 'border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              aria-label={t('notification_panel_title')}
              title={t('notification_panel_title')}
            >
              <Bell className="h-3.5 w-3.5" />
              {(activeCallSession || activeIncomingCall || minimizedCaller) && (
                <span className="absolute -top-1 -left-1 flex h-2.5 w-2.5" title={activeCallSession ? "Active Call Ongoing" : activeIncomingCall ? "Incoming Call Ringing" : "Caller Profile Minimized"}>
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${activeIncomingCall ? 'bg-blue-400' : activeCallSession ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activeIncomingCall ? 'bg-blue-500' : activeCallSession ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                </span>
              )}
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

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              aria-label={t('settings_title')}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Ongoing Call Persistent Mini-Bar right under Header */}
        {activeCallSession && (
          <div
            onClick={onMaximizeOngoingCall}
            className="border-t border-emerald-500/30 bg-emerald-950/80 hover:bg-emerald-900/90 px-3.5 sm:px-6 py-2 transition-all cursor-pointer flex items-center justify-between gap-3 text-white backdrop-blur-md"
            title="Active Call Ongoing - Tap to view"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="text-xs font-black text-emerald-300 truncate">
                  {activeCallSession.name || formatPhoneNumber(activeCallSession.number)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  {formatPhoneNumber(activeCallSession.number)}
                </span>
                <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/40 px-1.5 py-0.2 rounded-full shrink-0">
                  {formatCallDuration(liveCallDuration)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onMaximizeOngoingCall}
                className="flex items-center gap-1 rounded-lg bg-emerald-600/30 border border-emerald-500/40 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/50 transition active:scale-95"
              >
                <Maximize2 className="h-3 w-3" />
                <span>{t('view')}</span>
              </button>
              {onEndOngoingCall && (
                <button
                  type="button"
                  onClick={onEndOngoingCall}
                  className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 transition active:scale-95 shadow-sm"
                  title={t('end_call')}
                >
                  <PhoneOff className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Incoming Call Persistent Mini-Bar right under Header (when swiped to notification or minimized) */}
        {!activeCallSession && activeIncomingCall && activeIncomingCall.viewMode === 'notification' && (
          <div
            onClick={onExpandIncomingCall}
            className="border-t border-blue-500/40 bg-blue-950/85 hover:bg-blue-900/90 px-3.5 sm:px-6 py-2 transition-all cursor-pointer flex items-center justify-between gap-3 text-white backdrop-blur-md animate-pulse"
            title="Incoming Call - Tap to view"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="text-xs font-black text-blue-300 truncate">
                  {activeIncomingCall.callerName || formatPhoneNumber(activeIncomingCall.number)}
                </span>
                <span className="text-[10px] text-slate-300 font-mono hidden sm:inline">
                  {formatPhoneNumber(activeIncomingCall.number)}
                </span>
                {activeIncomingCall.isSpam && (
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[8px] font-black uppercase text-rose-300 border border-rose-500/30">
                    Spam
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onAnswerIncomingCall}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition active:scale-95 shadow-sm"
              >
                <Phone className="h-3 w-3" />
                <span>Answer</span>
              </button>
              <button
                type="button"
                onClick={onDeclineIncomingCall}
                className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 transition active:scale-95 shadow-sm"
              >
                <PhoneOff className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ONE UI NOTIFICATION PANEL */}
      {showNotifications && (
        <div
          id="oneui-notification-panel-overlay"
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm p-2 safe-top-panel sm:p-4 sm:pt-16 animate-in fade-in duration-150"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e141c] shadow-2xl shadow-black/80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#121924] px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95 flex items-center justify-center mr-0.5"
                  aria-label="Back"
                  title="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <BellRing className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {t('notification_panel_title')}
                  {(activeNotifications.length > 0 || Boolean(activeCallSession) || Boolean(activeIncomingCall)) && (
                    <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-400">
                      {activeNotifications.length + (activeCallSession ? 1 : 0) + (activeIncomingCall ? 1 : 0)}
                    </span>
                  )}
                </h2>
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
              </div>
            </div>

            {/* Notification items */}
            <div className="max-h-[55vh] overflow-y-auto p-2 space-y-2">
              {/* 1. Live Ongoing Call Notification Card */}
              {activeCallSession && (
                <div
                  onClick={() => {
                    setShowNotifications(false);
                    onMaximizeOngoingCall?.();
                  }}
                  className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-950 p-3.5 shadow-lg shadow-emerald-950/60 text-white cursor-pointer hover:border-emerald-400/70 transition active:scale-[0.99]"
                  title="Click to view full call screen"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                        {activeCallSession.status === 'HELD' ? t('on_hold') : 'Active Call in Progress'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      {formatCallDuration(liveCallDuration)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-white truncate">
                          {activeCallSession.name || activeCallSession.number}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-0.5">
                          <span>{formatPhoneNumber(activeCallSession.number)}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">{activeCallSession.sim || 'SIM 1'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          onMaximizeOngoingCall?.();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm active:scale-95"
                        title="Return to fullscreen call"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>{t('view')}</span>
                      </button>
                      {onEndOngoingCall && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifications(false);
                            onEndOngoingCall();
                          }}
                          className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition shadow-sm active:scale-95"
                          title={t('end_call')}
                        >
                          <PhoneOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Live Incoming Call Notification Card (if ringing/minimized) */}
              {activeIncomingCall && (
                <div
                  onClick={() => {
                    setShowNotifications(false);
                    onExpandIncomingCall?.();
                  }}
                  className="rounded-2xl border-2 border-blue-500/50 bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-slate-950 p-3.5 shadow-lg shadow-blue-950/60 text-white animate-pulse cursor-pointer hover:border-blue-400/70 transition active:scale-[0.99]"
                  title="Click to view incoming call"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400">
                        Incoming Call Ringing
                      </span>
                    </div>
                    {activeIncomingCall.isSpam && (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-black uppercase text-rose-300 border border-rose-500/30">
                        {activeIncomingCall.spamCategory || 'SPAM'}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 shrink-0">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-white truncate">
                          {activeIncomingCall.callerName || activeIncomingCall.number}
                        </h4>
                        <span className="text-xs text-slate-300 font-mono block mt-0.5">
                          {formatPhoneNumber(activeIncomingCall.number)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          onAnswerIncomingCall?.();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm active:scale-95"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Answer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          onDeclineIncomingCall?.();
                        }}
                        className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition shadow-sm active:scale-95"
                      >
                        <PhoneOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Minimized / Recent Caller Profile Card */}
              {minimizedCaller && (
                <div
                  onClick={() => {
                    setShowNotifications(false);
                    onReopenCaller?.();
                  }}
                  className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 via-slate-900/90 to-slate-950 p-3 text-white cursor-pointer hover:border-indigo-400/60 transition active:scale-[0.99]"
                  title="Tap to return to caller details"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-indigo-500/20">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                      Recent Caller Profile
                    </span>
                    <span className="text-[10px] text-slate-400">Tap to resume</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate">
                        {minimizedCaller.callerName || minimizedCaller.number}
                      </h4>
                      <span className="font-mono text-[11px] text-slate-300">
                        {formatPhoneNumber(minimizedCaller.number)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNotifications(false);
                        onReopenCaller?.();
                      }}
                      className="flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-500 transition shadow"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Empty state if no calls and no notifications */}
              {activeNotifications.length === 0 && !activeCallSession && !activeIncomingCall && !minimizedCaller ? (
                <div className="p-8 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/5 text-slate-500">
                    <CheckCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-300">{t('notification_panel_empty')}</p>
                </div>
              ) : (
                activeNotifications.map((call) => (
                  <div key={call.id} className="flex items-start justify-between gap-3 p-3 transition hover:bg-white/[0.03]">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400 mt-0.5">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {call.callerName || formatPhoneNumber(call.number)}
                          </span>
                          <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-extrabold text-rose-300">
                            {call.spamCategory || 'SPAM'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{call.spamReason || 'CallShield Heuristics'}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">{formatPhoneNumber(call.number)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTimeAmPm(call.timestamp)}
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
                          {t('view')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDismissNotification(call.id)}
                        className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        title={t('close')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIZED REDESIGNED SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] bg-black/70 p-0 sm:p-4 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <section
            className="w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-full p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95 flex items-center justify-center mr-0.5"
                  aria-label="Back"
                  title="Back to previous screen"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-300" />
                </button>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">{t('settings_title')}</h2>
                  <p className="text-xs text-slate-400">{t('settings_subtitle')}</p>
                </div>
              </div>
            </div>

            {/* Unified Settings List - Redesigned without Category Tabs */}

            {/* Category Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              {/* 1. LANGUAGE & DISPLAY SECTION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{t('settings_cat_lang_display')}</span>
                </div>
                  {/* Language Section */}
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

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
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

                  {/* Appearance & Themes Launcher */}
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setShowTheme(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                      <Palette className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">{t('appearance_title')}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{t('appearance_desc')}</span>
                    </span>
                    <span className="text-xs font-bold text-blue-400">{t('customize')} &rarr;</span>
                  </button>

                  {/* Display Density Setting */}
                  {onDensityChange && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
                      <div className="text-sm font-bold text-white">{t('display_density')}</div>
                      <div className="text-xs text-slate-400">{t('compact_mode_desc')}</div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onDensityChange('compact')}
                          className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                            density === 'compact'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                          }`}
                        >
                          {t('compact_mode')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDensityChange('comfortable')}
                          className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                            density === 'comfortable'
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                          }`}
                        >
                          {t('comfortable_mode')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              {/* 2. SPAM SHIELD & PRIVACY SECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Shield className="h-3.5 w-3.5" />
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

                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1">{t('time_window')}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[3, 5, 10].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => updatePrivacy('emergencyRepeatWindow', mins as 3 | 5 | 10)}
                                className={`rounded-xl p-2 text-xs font-bold transition border ${
                                  privacy.emergencyRepeatWindow === mins
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                                }`}
                              >
                                {mins} {isTamil ? 'நிமிடங்கள்' : 'min'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {/* 3. CALL & HARDWARE CONTROLS SECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{t('settings_cat_call_controls')}</span>
                </div>
                  {/* Call Simulation Tester */}
                  <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-bold text-white">{t('call_testing_title')}</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/15 px-2 py-0.5 rounded-full">
                        {isDeviceLocked ? t('screen_locked') : t('screen_unlocked')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{t('call_testing_desc')}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {onTriggerIncomingCall && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettings(false);
                            onTriggerIncomingCall();
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 transition active:scale-95"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>{t('simulate_call')}</span>
                        </button>
                      )}
                      {onToggleLockDevice && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettings(false);
                            onToggleLockDevice();
                          }}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${
                            isDeviceLocked
                              ? 'bg-amber-600/25 border-amber-500/50 text-amber-300 hover:bg-amber-600/35'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>{isDeviceLocked ? t('unlock_device') : t('lock_device')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Power Button Ends Call */}
                  <SettingRow
                    icon={<Power className="h-4 w-4" />}
                    title={t('power_ends_call_title')}
                    description={t('power_ends_call_desc')}
                    checked={Boolean(settings?.powerButtonEndsCall)}
                    onChange={(v) => updateShieldSetting('powerButtonEndsCall', v)}
                  />

                  {/* Volume Button Behavior */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300">
                        {settings?.volumeButtonAction === 'REJECT_CALL' ? (
                          <PhoneOff className="h-4 w-4 text-rose-400" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{t('volume_button_behavior')}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{t('volume_button_behavior_desc')}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          updateShieldSetting('volumeButtonAction', 'MUTE_RINGER');
                          updateShieldSetting('volumeButtonSilencesRinger', true);
                        }}
                        className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold transition border text-left ${
                          (settings?.volumeButtonAction || 'MUTE_RINGER') === 'MUTE_RINGER'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <VolumeX className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t('mute_ringer')}</div>
                          <div className="text-[10px] font-normal opacity-75">{t('mute_ringer_desc')}</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateShieldSetting('volumeButtonAction', 'REJECT_CALL');
                          updateShieldSetting('volumeButtonSilencesRinger', false);
                        }}
                        className={`flex items-center gap-2 rounded-xl p-3 text-xs font-bold transition border text-left ${
                          settings?.volumeButtonAction === 'REJECT_CALL'
                            ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <PhoneOff className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t('reject_call')}</div>
                          <div className="text-[10px] font-normal opacity-75">{t('reject_call_desc')}</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* System Ringer Sync Mode */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300">
                        <Volume2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{t('system_ringer_sync_title')}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{t('system_ringer_sync_desc')}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => updateShieldSetting('ringerMode', 'NORMAL')}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 text-xs font-bold transition border ${
                          (settings?.ringerMode || 'NORMAL') === 'NORMAL'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{t('sound_and_vibrate')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateShieldSetting('ringerMode', 'VIBRATE')}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 text-xs font-bold transition border ${
                          settings?.ringerMode === 'VIBRATE'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Vibrate className="h-4 w-4" />
                        <span>{t('vibrate_only')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateShieldSetting('ringerMode', 'SILENT')}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 text-xs font-bold transition border ${
                          settings?.ringerMode === 'SILENT'
                            ? 'border-slate-500 bg-slate-500/20 text-slate-200'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        <VolumeX className="h-4 w-4" />
                        <span>{t('silent_ring')}</span>
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
                </div>

              {/* 4. CALL RECORDING & AUDIO SECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-rose-400">
                  <Mic className="h-3.5 w-3.5" />
                  <span>{t('settings_cat_recording')}</span>
                </div>
                  <SettingRow
                    icon={<Mic className="h-4 w-4" />}
                    title={t('call_recording_title')}
                    description={t('call_recording_desc')}
                    checked={privacy.callRecordingEnabled}
                    onChange={(v) => updatePrivacy('callRecordingEnabled', v)}
                  />

                  {/* Lossless HD Recording Badge Info */}
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

                  {/* Storage folder path */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <FolderOpen className="h-4 w-4 text-blue-400" />
                      <span>{t('recording_storage_folder')}</span>
                    </div>
                    <div className="font-mono text-xs text-slate-400 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      {DEFAULT_RECORDINGS_FOLDER}
                    </div>
                  </div>
                </div>

              {/* 5. SYSTEM & INTEGRATION SECTION */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-indigo-400">
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{t('settings_cat_system')}</span>
                </div>
                  {/* Default Phone App status */}
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
                        onClick={onRequestDefaultDialer}
                        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition"
                      >
                        {t('set_as_default_phone_button')}
                      </button>
                    )}
                  </div>

                  {/* Permission Center */}
                  {onOpenPermissionCenter && (
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        onOpenPermissionCenter();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400">
                        <Sliders className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{t('permission_center')}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{t('permission_center_desc')}</span>
                      </span>
                    </button>
                  )}

                  {/* Sync Device Data */}
                  {onSyncDatabase && (
                    <button
                      onClick={onSyncDatabase}
                      disabled={isSyncing}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition disabled:opacity-60"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                        <Database className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{isSyncing ? t('synchronizing') : t('sync_device_data')}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{t('sync_device_desc')}</span>
                      </span>
                    </button>
                  )}

                  {/* Diagnostics */}
                  {onOpenDiagnostics && (
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        onOpenDiagnostics();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300">
                        <Stethoscope className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{t('system_diagnostics')}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{t('system_diagnostics_desc')}</span>
                      </span>
                    </button>
                  )}

                  {/* Data Sources & Privacy */}
                  {onOpenDataSources && (
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        onOpenDataSources();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300">
                        <Database className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{t('data_sources_privacy')}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{t('data_sources_desc')}</span>
                      </span>
                    </button>
                  )}

                  {/* Install Packaging */}
                  {onOpenInstallModal && (
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        onOpenInstallModal();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:bg-slate-800/80 transition"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-300">
                        <Download className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{t('install_packaging')}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{t('install_packaging_desc')}</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
          </section>
        </div>
      )}

      {/* Theme Customizer Modal */}
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

export default memo(Header);

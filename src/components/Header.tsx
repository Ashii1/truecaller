import { useEffect, useState, useMemo, memo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  Info,
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
  FileText,
} from 'lucide-react';
import { CallLogItem, DisplayDensity, IncomingCallState, ShieldSettings, ActiveCallSession } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { formatPhoneNumber } from '../utils/spamEngine';
import { resolveFromPublicDirectory, isGenericOrPhoneNumber } from '../utils/publicDirectory';
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
    const incDigits = String(activeIncomingCall?.number || '').replace(/\D/g, '');
    const onDigits = String(activeCallSession?.number || '').replace(/\D/g, '');
    const incId = activeIncomingCall?.callId;
    const onId = activeCallSession?.id;

    return (recentSpamCalls || [])
      .filter((c) => {
        if (!c) return false;
        if (dismissedNotificationIds.includes(c.id)) return false;
        const cDigits = String(c.number || '').replace(/\D/g, '');
        if (incDigits && (cDigits === incDigits || (cDigits.length >= 7 && incDigits.endsWith(cDigits.slice(-10))))) return false;
        if (onDigits && (cDigits === onDigits || (cDigits.length >= 7 && onDigits.endsWith(cDigits.slice(-10))))) return false;
        if (incId && (c.id === incId || (c as any).callId === incId)) return false;
        if (onId && (c.id === onId || (c as any).callId === onId)) return false;
        return true;
      })
      .slice(0, 10);
  }, [recentSpamCalls, dismissedNotificationIds, activeIncomingCall?.number, activeIncomingCall?.callId, activeCallSession?.number, activeCallSession?.id]);

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
      {/* Top Header Bar with Modern Flagship Layout */}
      <header
        id="app-top-header"
        className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080c14]/90 backdrop-blur-2xl safe-top-header transition-all"
      >
        <div className="mx-auto flex h-13 max-w-md sm:max-w-lg items-center justify-between gap-3 px-3 sm:px-4">
          {/* Zone 1: Single element Brand Wordmark & Subtle Live Indicator */}
          <div className="flex items-center gap-2.5">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
                settings?.masterEnabled !== false
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
              }`}
              aria-hidden="true"
            >
              {settings?.masterEnabled !== false ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white leading-tight">
                {t('app_title')}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${settings?.masterEnabled !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{settings?.masterEnabled !== false ? t('protected') : t('paused')}</span>
              </span>
            </div>
          </div>

          {/* Zone 3: Clean Actions with >=44px Hitboxes & Proper Spacing */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onRequestDefaultDialer && !isDefaultDialer && (
              <button
                type="button"
                onClick={onRequestDefaultDialer}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 min-h-[36px]"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{t('set_as_phone_app')}</span>
              </button>
            )}

            {/* Notification Panel Button with 44x44px Hitbox */}
            <button
              id="header-notification-panel-btn"
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-all cursor-pointer ${
                showNotifications
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06] active:scale-95'
              }`}
              aria-label={t('notification_panel_title')}
              title={t('notification_panel_title')}
            >
              <div className="relative grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <Bell className="h-4 w-4" />
                {(activeCallSession || activeIncomingCall || minimizedCaller) && (
                  <span className="absolute -top-1 -left-1 flex h-2.5 w-2.5" title={activeCallSession ? "Active Call Ongoing" : activeIncomingCall ? "Incoming Call Ringing" : "Caller Profile Minimized"}>
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${activeIncomingCall ? 'bg-blue-400' : activeCallSession ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${activeIncomingCall ? 'bg-blue-500' : activeCallSession ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                  </span>
                )}
                {activeNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8.5px] font-bold text-white shadow-sm ring-2 ring-[#080c14]">
                    {activeNotifications.length > 9 ? '9+' : activeNotifications.length}
                  </span>
                )}
              </div>
            </button>

            {/* Settings Button with 44x44px Hitbox */}
            <button
              type="button"
              onClick={() => {
                setShowNotifications(false);
                if (onSettingsOpenChange) {
                  onSettingsOpenChange(true);
                } else {
                  setShowSettings(true);
                }
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-95 cursor-pointer"
              aria-label={t('settings_title')}
              title={t('settings_title')}
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <Settings className="h-4 w-4" />
              </div>
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
                  {activeCallSession.status === 'DIALING' ? 'Dialing...' : formatCallDuration(liveCallDuration)}
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
        {!showNotifications && !activeCallSession && activeIncomingCall && activeIncomingCall.viewMode === 'notification' && (
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
                  {!isGenericOrPhoneNumber(activeIncomingCall.callerName, activeIncomingCall.number)
                    ? activeIncomingCall.callerName
                    : resolveFromPublicDirectory(activeIncomingCall.number)?.name || formatPhoneNumber(activeIncomingCall.number)}
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
      {showNotifications && createPortal(
        <div
          id="oneui-notification-panel-overlay"
          className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
          style={{
            paddingTop: 'max(4.75rem, calc(env(safe-area-inset-top, 0px) + 4.25rem))',
          }}
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
                        {activeCallSession.status === 'HELD'
                          ? t('on_hold')
                          : activeCallSession.status === 'DIALING'
                          ? 'Outgoing Call Ringing / Dialing...'
                          : 'Active Call in Progress'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-900/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                      {activeCallSession.status === 'DIALING' ? 'Calling...' : formatCallDuration(liveCallDuration)}
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

              {/* 2. Live Incoming Call Notification Card (Permanently expanded with large prominent controls) */}
              {activeIncomingCall && (
                <div
                  onClick={() => {
                    setShowNotifications(false);
                    onExpandIncomingCall?.();
                  }}
                  className="rounded-2xl border-2 border-blue-500/60 bg-gradient-to-br from-blue-950/95 via-slate-900/98 to-slate-950 p-4 shadow-xl shadow-blue-950/70 text-white cursor-pointer hover:border-blue-400 transition active:scale-[0.99]"
                  title="Incoming Call Ringing · Click to view fullscreen"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-blue-500/25">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-blue-300">
                        Incoming Call Ringing
                      </span>
                    </div>
                    {activeIncomingCall.isSpam ? (
                      <span className="rounded-lg bg-rose-500/25 px-2 py-0.5 text-[10px] font-black uppercase text-rose-300 border border-rose-500/40">
                        {activeIncomingCall.spamCategory || 'SPAM'} • High Risk
                      </span>
                    ) : (
                      <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300 border border-emerald-500/30">
                        Verified Safe
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 shrink-0 shadow-inner">
                        <Phone className="h-6 w-6 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-black text-white truncate leading-tight">
                          {activeIncomingCall.callerName || activeIncomingCall.number}
                        </h4>
                        <div className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{formatPhoneNumber(activeIncomingCall.number)}</span>
                          {activeIncomingCall.location && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{activeIncomingCall.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          onAnswerIncomingCall?.();
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-950/60 active:scale-95"
                        title="Answer call"
                      >
                        <Phone className="h-4 w-4" />
                        <span>Answer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          onDeclineIncomingCall?.();
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-black text-white hover:bg-rose-500 transition shadow-md shadow-rose-950/60 active:scale-95"
                        title="Decline call"
                      >
                        <PhoneOff className="h-4 w-4" />
                        <span>Decline</span>
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
                        {!isGenericOrPhoneNumber(minimizedCaller.callerName, minimizedCaller.number)
                          ? minimizedCaller.callerName
                          : resolveFromPublicDirectory(minimizedCaller.number)?.name || formatPhoneNumber(minimizedCaller.number)}
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
                activeNotifications.map((call) => {
                  const resolvedDirName = resolveFromPublicDirectory(call.number)?.name;
                  const displayCallerName = !isGenericOrPhoneNumber(call.callerName, call.number)
                    ? call.callerName
                    : resolvedDirName || formatPhoneNumber(call.number);
                  return (
                    <div key={call.id} className="flex items-start justify-between gap-3 p-3 transition hover:bg-white/[0.03]">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400 mt-0.5">
                          <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                              {displayCallerName}
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
                );
              })
            )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default memo(Header);

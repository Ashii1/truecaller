import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Database, Download, LockKeyhole, MicOff, PhoneCall, Palette, Settings, ShieldAlert, ShieldCheck, Siren, Stethoscope, X } from 'lucide-react';
import { ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import ThemeCustomizerModal from './ThemeCustomizerModal';

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
    const raw = localStorage.getItem('vigilshield_privacy_settings');
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...PRIVACY_DEFAULTS, ...parsed };
  } catch {
    return PRIVACY_DEFAULTS;
  }
}

export default function Header({ settings, onToggleShield, isDefaultDialer, onRequestDefaultDialer, onOpenPermissionCenter, onSyncDatabase, isSyncing, autoCancelEnabled, onToggleAutoCancel, onOpenInstallModal, onOpenDataSources, onOpenDiagnostics }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>(readPrivacySettings);

  useEffect(() => {
    if (isDefaultDialer || !telecomBridge.isAndroidEnvironment() || !onRequestDefaultDialer) return;
    try {
      if (sessionStorage.getItem('vigilshield_default_phone_prompted') === 'true') return;
      sessionStorage.setItem('vigilshield_default_phone_prompted', 'true');
    } catch {}
    const timer = window.setTimeout(() => onRequestDefaultDialer(), 350);
    return () => window.clearTimeout(timer);
  }, [isDefaultDialer, onRequestDefaultDialer]);

  useEffect(() => {
    localStorage.setItem('vigilshield_privacy_settings', JSON.stringify(privacy));
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

  const updatePrivacy = (key: keyof PrivacySettings, value: boolean | 3 | 4 | 5 | 10) => setPrivacy(prev => ({ ...prev, [key]: value } as PrivacySettings));

  return <>
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0b0f14]/98 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${settings?.masterEnabled !== false ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`} aria-hidden="true">
            {settings?.masterEnabled !== false ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-white">VigilShield</div>
            <div className="truncate text-[11px] text-slate-500">{isDefaultDialer ? 'Default phone app' : 'Phone setup required'}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onRequestDefaultDialer && !isDefaultDialer && <button onClick={onRequestDefaultDialer} className="hidden items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 sm:flex"><PhoneCall className="h-3.5 w-3.5" /> Set as phone app</button>}
          {isDefaultDialer && onToggleShield && <button onClick={onToggleShield} className={`rounded-xl px-3 py-2 text-xs font-bold ${settings?.masterEnabled !== false ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>{settings?.masterEnabled !== false ? 'Protected' : 'Paused'}</button>}
          <button onClick={() => setShowSettings(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Privacy and call settings"><Settings className="h-4 w-4" /></button>
        </div>
      </div>
    </header>

    {showSettings && <div className="fixed inset-0 z-[70] bg-black/60 p-0 sm:p-4" onMouseDown={() => setShowSettings(false)}>
      <section className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 shadow-2xl sm:relative sm:mx-auto sm:my-8 sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:rounded-3xl sm:border" onMouseDown={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur">
          <div><h2 className="text-lg font-bold text-white">Settings</h2><p className="mt-0.5 text-xs text-slate-400">Privacy, call controls and emergency protection.</p></div>
          <button onClick={() => setShowSettings(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close settings"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          <button onClick={() => { setShowSettings(false); setShowTheme(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-left hover:bg-blue-500/10">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Palette className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">Appearance & colours</span><span className="mt-1 block text-xs leading-5 text-slate-400">Theme, accent colour, custom colour, density, corners, backgrounds, text size and accessibility.</span></span>
            <span className="text-xs font-bold text-blue-400">Customize</span>
          </button>

          {!isDefaultDialer && onRequestDefaultDialer && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-start gap-3"><PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div className="min-w-0 flex-1"><div className="text-sm font-bold text-white">Default Phone App</div><div className="mt-1 text-xs leading-5 text-slate-400">VigilShield needs Android's official Phone role to handle real cellular calls and show the in-call screen.</div><button onClick={onRequestDefaultDialer} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500">Set as default Phone app</button></div></div></div>}

          <SettingRow icon={<LockKeyhole className="h-4 w-4" />} title="Private notification mode" description="Use generic text instead of exposing caller identity on the lock screen." checked={privacy.privacyMode} onChange={v => updatePrivacy('privacyMode', v)} />
          <SettingRow icon={<Bell className="h-4 w-4" />} title="Detailed caller notifications" description="Show names and risk details in notifications." checked={privacy.showCallerDetailsInNotifications} onChange={v => updatePrivacy('showCallerDetailsInNotifications', v)} />
          <SettingRow icon={<MicOff className="h-4 w-4" />} title="Call recording" description="OFF by default. VigilShield never silently starts recording." checked={privacy.callRecordingEnabled} onChange={v => updatePrivacy('callRecordingEnabled', v)} danger={privacy.callRecordingEnabled} />
          <SettingRow icon={<Settings className="h-4 w-4" />} title="Copied-number paste helper" description="Offer a copied number as a one-tap Paste action in the dialer." checked={privacy.clipboardPasteDetection} onChange={v => updatePrivacy('clipboardPasteDetection', v)} />

          {onToggleAutoCancel && <SettingRow icon={<ShieldCheck className="h-4 w-4" />} title="Auto-cancel high-risk spam" description="Automatically reject high-confidence spam calls before they ring." checked={autoCancelEnabled !== false} onChange={() => onToggleAutoCancel()} />}

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3"><Siren className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div className="min-w-0"><div className="text-sm font-bold text-white">Repeated-call emergency alert</div><div className="mt-1 text-xs leading-5 text-slate-400">Only saved device contacts qualify. Repeated calls never get blocked; they are escalated as a possible urgent call.</div></div></div>
            <div className="mt-3"><SettingRow icon={<Siren className="h-4 w-4" />} title="Enable repeat-call alert" description="Alert after the selected number of calls inside the selected time window." checked={privacy.emergencyRepeatEnabled} onChange={v => updatePrivacy('emergencyRepeatEnabled', v)} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">Calls needed<select value={privacy.emergencyRepeatThreshold} onChange={e => updatePrivacy('emergencyRepeatThreshold', Number(e.target.value) as 3|4|5)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm font-semibold text-white outline-none"><option value={3}>3 calls</option><option value={4}>4 calls</option><option value={5}>5 calls</option></select></label>
              <label className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400">Time window<select value={privacy.emergencyRepeatWindow} onChange={e => updatePrivacy('emergencyRepeatWindow', Number(e.target.value) as 3|5|10)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm font-semibold text-white outline-none"><option value={3}>3 minutes</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option></select></label>
            </div>
            <div className="mt-3 rounded-xl bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-500">When the screen is off and the phone is silent, VigilShield makes a short best-effort audible alert without changing your global ringer mode. When you are actively using the phone, it uses a visible high-priority alert instead.</div>
          </div>

          {onRequestDefaultDialer && <button onClick={onRequestDefaultDialer} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800">{isDefaultDialer ? 'Default Phone app active' : 'Set as default Phone app'}<span className="mt-1 block text-xs font-normal text-slate-500">Android Telecom role and real cellular call handling.</span></button>}
          {onOpenPermissionCenter && <button onClick={() => { setShowSettings(false); onOpenPermissionCenter(); }} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800">Permission Center<span className="mt-1 block text-xs font-normal text-slate-500">Live Android status for Phone role, Contacts, Call Log, Notifications and protection.</span></button>}
          {onSyncDatabase && <button onClick={onSyncDatabase} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"><Database className="h-5 w-5 text-cyan-400" /><span className="flex-1"><b className="block text-sm text-white">Sync device data</b><span className="mt-1 block text-xs text-slate-500">{isSyncing ? 'Synchronizing…' : 'Import latest call history and contacts.'}</span></span></button>}
          {onOpenDataSources && <button onClick={() => { setShowSettings(false); onOpenDataSources(); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"><Database className="h-5 w-5 text-indigo-400" /><span><b className="block text-sm text-white">Data sources & privacy</b><span className="mt-1 block text-xs text-slate-500">Data provenance, export and local-data controls.</span></span></button>}
          {onOpenDiagnostics && <button onClick={() => { setShowSettings(false); onOpenDiagnostics(); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"><Stethoscope className="h-5 w-5 text-amber-400" /><span><b className="block text-sm text-white">System diagnostics</b><span className="mt-1 block text-xs text-slate-500">Check telecom role, permissions and Android integration.</span></span></button>}
          {onOpenInstallModal && <button onClick={() => { setShowSettings(false); onOpenInstallModal(); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left"><Download className="h-5 w-5 text-emerald-400" /><span><b className="block text-sm text-white">Install / app packaging</b><span className="mt-1 block text-xs text-slate-500">WebAPK, QR and Android packaging tools.</span></span></button>}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs leading-5 text-slate-500">Security principle: no recording by default, no automatic blocking of saved contacts, no silent change to your ringer mode, and settings remain local.</div>
        </div>
      </section>
    </div>}
    <ThemeCustomizerModal isOpen={showTheme} onClose={() => setShowTheme(false)} />
  </>;
}

function SettingRow({ icon, title, description, checked, onChange, danger = false }: { icon: ReactNode; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; danger?: boolean }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>{icon}</div><div className="min-w-0"><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? (danger ? 'bg-amber-500' : 'bg-blue-600') : 'bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></div></div>;
}

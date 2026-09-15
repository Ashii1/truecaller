import { useEffect, useState } from 'react';
import { Bell, LockKeyhole, MicOff, PhoneCall, Settings, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface HeaderProps {
  settings: ShieldSettings;
  onToggleShield: () => void;
  onSyncDatabase: () => void;
  isSyncing: boolean;
  onTriggerIncomingCall: () => void;
  autoCancelEnabled: boolean;
  onToggleAutoCancel: () => void;
  onOpenInstallModal: () => void;
  onOpenDataSources: () => void;
  onOpenDiagnostics: () => void;
  isDefaultDialer: boolean;
  onRequestDefaultDialer: () => void;
  onOpenPermissionCenter?: () => void;
}

type PrivacySettings = {
  callRecordingEnabled: boolean;
  showCallerDetailsInNotifications: boolean;
  privacyMode: boolean;
  clipboardPasteDetection: boolean;
};

const PRIVACY_DEFAULTS: PrivacySettings = {
  callRecordingEnabled: false,
  showCallerDetailsInNotifications: false,
  privacyMode: true,
  clipboardPasteDetection: true,
};

function readPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem('vigilshield_privacy_settings');
    return raw ? { ...PRIVACY_DEFAULTS, ...JSON.parse(raw) } : PRIVACY_DEFAULTS;
  } catch {
    return PRIVACY_DEFAULTS;
  }
}

export default function Header({ settings, onToggleShield, isDefaultDialer, onRequestDefaultDialer, onOpenPermissionCenter }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>(readPrivacySettings);

  useEffect(() => {
    localStorage.setItem('vigilshield_privacy_settings', JSON.stringify(privacy));
    telecomBridge.setSecuritySetting('call_recording_enabled', privacy.callRecordingEnabled);
    telecomBridge.setSecuritySetting('notification_caller_details', privacy.showCallerDetailsInNotifications);
    telecomBridge.setSecuritySetting('privacy_mode', privacy.privacyMode);
    telecomBridge.setSecuritySetting('clipboard_paste_detection', privacy.clipboardPasteDetection);
  }, [privacy]);

  const updatePrivacy = (key: keyof PrivacySettings, value: boolean) => setPrivacy(prev => ({ ...prev, [key]: value }));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0b0f14]/98 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${settings.masterEnabled ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`} aria-hidden="true">{settings.masterEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}</div>
            <div className="min-w-0"><div className="text-base font-bold text-white">VigilShield</div><div className="truncate text-[11px] text-slate-500">{isDefaultDialer ? 'Default phone app' : 'Phone setup required'}</div></div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setShowSettings(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Privacy and call settings"><Settings className="h-4 w-4" /></button>
            {!isDefaultDialer && <button onClick={onRequestDefaultDialer} className="hidden sm:flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"><PhoneCall className="h-3.5 w-3.5" /> Set as phone app</button>}
            {isDefaultDialer && <button onClick={onToggleShield} className={`rounded-xl px-3 py-2 text-xs font-bold ${settings.masterEnabled ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>{settings.masterEnabled ? 'Protected' : 'Paused'}</button>}
          </div>
        </div>
      </header>

      {showSettings && <div className="fixed inset-0 z-[70] bg-black/60 p-0 sm:p-4" onMouseDown={() => setShowSettings(false)}>
        <section className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 shadow-2xl sm:relative sm:mx-auto sm:my-8 sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:rounded-3xl sm:border" onMouseDown={e => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur"><div><h2 className="text-lg font-bold text-white">Settings</h2><p className="mt-0.5 text-xs text-slate-400">Private by default. Change only what you need.</p></div><button onClick={() => setShowSettings(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close settings"><X className="h-5 w-5" /></button></div>
          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><div><div className="text-sm font-bold text-white">Privacy mode</div><div className="mt-1 text-xs leading-5 text-slate-400">Keeps caller details minimal in notification surfaces and avoids unnecessary data exposure.</div></div></div></div>
            <SettingRow icon={<MicOff className="h-4 w-4" />} title="Call recording" description="Off by default. VigilShield will not record calls unless you explicitly enable this option." checked={privacy.callRecordingEnabled} onChange={v => updatePrivacy('callRecordingEnabled', v)} danger={privacy.callRecordingEnabled} />
            <SettingRow icon={<Bell className="h-4 w-4" />} title="Detailed caller notifications" description="Show names and risk details in notifications. Keep off for a cleaner, more private lock screen." checked={privacy.showCallerDetailsInNotifications} onChange={v => updatePrivacy('showCallerDetailsInNotifications', v)} />
            <SettingRow icon={<LockKeyhole className="h-4 w-4" />} title="Private notification mode" description="Use generic notification text instead of exposing caller identity on the lock screen." checked={privacy.privacyMode} onChange={v => updatePrivacy('privacyMode', v)} />
            <SettingRow icon={<Settings className="h-4 w-4" />} title="Copied-number paste helper" description="Lets the dialer offer a copied number as a one-tap Paste action when available." checked={privacy.clipboardPasteDetection} onChange={v => updatePrivacy('clipboardPasteDetection', v)} />
            {onOpenPermissionCenter && <button onClick={onOpenPermissionCenter} className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800">Permission Center & Android setup<span className="mt-1 block text-xs font-normal text-slate-500">Review Contacts, Call Log, Notifications and Default Phone role.</span></button>}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs leading-5 text-slate-500">Security principle: recordings are never enabled silently, notification details are minimized by default, and settings are stored locally on this device.</div>
          </div>
        </section>
      </div>}
    </>
  );
}

function SettingRow({ icon, title, description, checked, onChange, danger = false }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; danger?: boolean }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>{icon}</div><div className="min-w-0"><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? (danger ? 'bg-amber-500' : 'bg-blue-600') : 'bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></div></div>;
}

import { PhoneCall, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ShieldSettings } from '../types';

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

export default function Header({ settings, onToggleShield, isDefaultDialer, onRequestDefaultDialer }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0b0f14]">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${settings.masterEnabled ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`} aria-hidden="true">
            {settings.masterEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-white">VigilShield</div>
            <div className="text-[11px] text-slate-500">{isDefaultDialer ? 'Default phone app' : 'Phone setup required'}</div>
          </div>
        </div>
        {!isDefaultDialer && <button onClick={onRequestDefaultDialer} className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"><PhoneCall className="h-3.5 w-3.5" /> Set as phone app</button>}
        {isDefaultDialer && <button onClick={onToggleShield} className={`rounded-xl px-3 py-2 text-xs font-bold ${settings.masterEnabled ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>{settings.masterEnabled ? 'Protected' : 'Paused'}</button>}
      </div>
    </header>
  );
}

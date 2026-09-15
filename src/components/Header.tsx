import { Shield, ShieldAlert, ShieldCheck, RefreshCw, PhoneCall, PhoneOff, Package, Database, Terminal } from 'lucide-react';
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

export default function Header({ settings, onToggleShield, onSyncDatabase, isSyncing, onTriggerIncomingCall: _onTriggerIncomingCall, autoCancelEnabled, onToggleAutoCancel, onOpenInstallModal, onOpenDataSources, onOpenDiagnostics, isDefaultDialer, onRequestDefaultDialer, onOpenPermissionCenter }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#07111f]/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border shadow-xl ${settings.masterEnabled ? 'border-cyan-300/20 bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 text-cyan-200 shadow-cyan-950/30' : 'border-rose-400/20 bg-rose-500/10 text-rose-300'}`}>
            {settings.masterEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07111f] ${settings.masterEnabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[17px] font-extrabold tracking-tight text-white sm:text-lg">VigilShield</span>
              <span className={`hidden rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:inline-flex ${settings.masterEnabled ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>{settings.masterEnabled ? 'Protected' : 'Paused'}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
              <span>{isDefaultDialer ? 'Phone service active' : 'Phone role not active'}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>{isDefaultDialer ? 'Ready for calls' : 'Setup required'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isDefaultDialer && <button onClick={onRequestDefaultDialer} className="hidden items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-300/15 sm:flex"><PhoneCall className="h-3.5 w-3.5" />Set as phone app</button>}
          {onOpenPermissionCenter && <button onClick={onOpenPermissionCenter} className="rounded-xl border border-white/10 bg-white/[.05] p-2 text-slate-300 transition hover:bg-white/[.08] hover:text-white" title="Permissions"><ShieldCheck className="h-4 w-4" /></button>}
          <button onClick={onOpenDiagnostics} className="hidden rounded-xl border border-white/10 bg-white/[.05] p-2 text-slate-300 transition hover:bg-white/[.08] hover:text-white md:block" title="Diagnostics"><Terminal className="h-4 w-4" /></button>
          <button onClick={onOpenDataSources} className="hidden rounded-xl border border-white/10 bg-white/[.05] p-2 text-slate-300 transition hover:bg-white/[.08] hover:text-white md:block" title="Data sources"><Database className="h-4 w-4" /></button>
          <button onClick={onOpenInstallModal} className="hidden rounded-xl border border-white/10 bg-white/[.05] p-2 text-slate-300 transition hover:bg-white/[.08] hover:text-white lg:block" title="Get APK"><Package className="h-4 w-4" /></button>
          <button onClick={onSyncDatabase} disabled={isSyncing} className="hidden rounded-xl border border-white/10 bg-white/[.05] p-2 text-slate-300 transition hover:bg-white/[.08] hover:text-white xl:block" title="Refresh"><RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-cyan-300' : ''}`} /></button>
          <button onClick={onToggleAutoCancel} className={`hidden items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold lg:flex ${autoCancelEnabled ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-white/10 bg-white/[.04] text-slate-400'}`}><PhoneOff className="h-3.5 w-3.5" />{autoCancelEnabled ? 'Auto-block ON' : 'Auto-block OFF'}</button>
          <button onClick={onToggleShield} className={`rounded-xl px-3 py-2 text-xs font-extrabold shadow-lg transition active:scale-95 ${settings.masterEnabled ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-cyan-950/30' : 'bg-rose-500 text-white shadow-rose-950/30'}`}>{settings.masterEnabled ? 'Protected' : 'Paused'}</button>
        </div>
      </div>
    </header>
  );
}

import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  PhoneCall, 
  PhoneOff, 
  Package, 
  Database,
  Sliders,
  Sparkles,
  Terminal
} from 'lucide-react';
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

export default function Header({
  settings,
  onToggleShield,
  onSyncDatabase,
  isSyncing,
  onTriggerIncomingCall,
  autoCancelEnabled,
  onToggleAutoCancel,
  onOpenInstallModal,
  onOpenDataSources,
  onOpenDiagnostics,
  isDefaultDialer,
  onRequestDefaultDialer,
  onOpenPermissionCenter,
}: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Telephony Status Indicators */}
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                settings.masterEnabled
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-950/50'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {settings.masterEnabled ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  VigilShield
                </span>
                
                {/* Telecom Status Badges: Caller Protection & Default Phone App */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 ${
                  settings.masterEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings.masterEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span>Caller Protection: {settings.masterEnabled ? 'ON' : 'OFF'}</span>
                </span>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 ${
                  isDefaultDialer ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDefaultDialer ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>Default Phone App: {isDefaultDialer ? 'ON' : 'OFF'}</span>
                </span>
              </div>

              {/* Status subline */}
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                <span className="sm:hidden">
                  Protection: {settings.masterEnabled ? 'ON' : 'OFF'} • Dialer: {isDefaultDialer ? 'ON' : 'OFF'}
                </span>
                <span className="hidden sm:inline">
                  {isDefaultDialer 
                    ? 'Default Android Dialer Active • Direct Cellular Voice' 
                    : 'System Telecom Standby • Tap setup to claim Default Phone App role'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* Set as Default Phone App Button (Prominent when OFF) */}
            {!isDefaultDialer && (
              <button
                onClick={onRequestDefaultDialer}
                id="btn-set-default-dialer"
                className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 hover:text-white transition active:scale-95 shadow-sm"
                title="Grant official Android Telecom ROLE_DIALER to handle cellular voice calls"
              >
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>Set as default phone app</span>
              </button>
            )}

            {/* Permission Center & Onboarding Wizard */}
            {onOpenPermissionCenter && (
              <button
                onClick={onOpenPermissionCenter}
                className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition active:scale-95 shadow-sm"
                title="View live permission status and 5-step telephony onboarding"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">Permissions</span>
              </button>
            )}

            {/* System Diagnostics */}
            <button
              onClick={onOpenDiagnostics}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 hover:text-white transition active:scale-95 shadow-sm"
              title="Inspect platform capabilities, Telecom status, Dual-SIM accounts, and CallLog permissions"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Diagnostics</span>
            </button>

            {/* Data Sources & Privacy Center */}
            <button
              onClick={onOpenDataSources}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition active:scale-95"
              title="Inspect legal data sources, privacy guarantees and architecture"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Data Sources</span>
            </button>

            {/* Get APK / Install Button */}
            <button
              onClick={onOpenInstallModal}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 hover:text-white transition active:scale-95 shadow-sm"
              title="Download Android APK package or install directly as WebAPK"
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>Get APK</span>
            </button>

            {/* Auto-Cancel Toggle Button */}
            <button
              onClick={onToggleAutoCancel}
              className={`hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                autoCancelEnabled
                  ? 'bg-rose-950/50 text-rose-300 border border-rose-700/50 hover:bg-rose-900/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
              }`}
              title="Automatically terminate identified scam calls before phone rings"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Auto-Cancel: {autoCancelEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Test Call Trigger Button */}
            <button
              onClick={onTriggerIncomingCall}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40 transition active:scale-95"
              title="Simulate incoming call to test real-time screening"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulate Call</span>
              <span className="sm:hidden">Test</span>
            </button>

            {/* Sync Database Button */}
            <button
              onClick={onSyncDatabase}
              disabled={isSyncing}
              className="hidden xl:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition active:scale-95 disabled:opacity-50"
              title="Sync with global SpamShield community directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Master Protection Toggle */}
            <button
              onClick={onToggleShield}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                settings.masterEnabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                  : 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-900/30'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{settings.masterEnabled ? 'Active' : 'Off'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

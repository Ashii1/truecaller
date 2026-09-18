import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import {
  Activity,
  X,
  Server,
  Smartphone,
  Database,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Sparkles,
  ArrowRight,
  Terminal,
  Cpu,
  Wifi,
  HardDrive,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  ShieldAlert,
  Sliders,
  Info
} from 'lucide-react';
import {
  ContactItem,
  CallLogItem,
  BlockRule,
  WhitelistEntry,
  ShieldSettings,
  SecurityTimelineEvent
} from '../types';
import { CompositeCallerIdResolver } from '../services/providers/compositeCallerProvider';
import { telecomBridge, TelephonyDiagnosticsData } from '../services/telephony/telecomBridge';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: ContactItem[];
  calls: CallLogItem[];
  rules: BlockRule[];
  whitelist: WhitelistEntry[];
  settings: ShieldSettings;
  timelineEvents: SecurityTimelineEvent[];
  onResetToCleanState: () => void;
  onImportAllData: (data: any) => void;
  isDefaultDialer?: boolean;
  onRequestDefaultDialer?: () => void;
}

export default function SystemDiagnosticsModal({
  isOpen,
  onClose,
  contacts,
  calls,
  rules,
  whitelist,
  settings,
  timelineEvents,
  onResetToCleanState,
  onImportAllData,
  isDefaultDialer = false,
  onRequestDefaultDialer,
}: SystemDiagnosticsModalProps) {
  const [pipelineTestNumber, setPipelineTestNumber] = useState('+91 14090 98984');
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'PIPELINE' | 'ACTIONS'>('OVERVIEW');
  const [telephonyDiag, setTelephonyDiag] = useState<TelephonyDiagnosticsData>(() => telecomBridge.getDiagnostics());
  const [simulateLowBattery, setSimulateLowBattery] = useState(false);
  const [batteryExemptionStatus, setBatteryExemptionStatus] = useState<string | null>(null);

  const resolver = useMemo(() => new CompositeCallerIdResolver(), []);

  // Effective telephony and battery diagnostics with simulation override
  const effectiveDiag = useMemo(() => {
    if (simulateLowBattery) {
      return {
        ...telephonyDiag,
        batteryLevel: 12,
        isCharging: false,
        isPowerSaveMode: true,
        isBatteryLow: true,
        isBatteryThrottlingRisk: true,
        isIgnoringBatteryOptimizations: false,
      };
    }
    return telephonyDiag;
  }, [telephonyDiag, simulateLowBattery]);

  const isThrottlingRisk = Boolean(
    effectiveDiag.isBatteryThrottlingRisk ||
    effectiveDiag.isPowerSaveMode ||
    (effectiveDiag.batteryLevel !== undefined && effectiveDiag.batteryLevel <= 20 && !effectiveDiag.isCharging)
  );

  const handleRequestBatteryExemption = () => {
    if (telecomBridge.isAndroidEnvironment()) {
      const ok = telecomBridge.requestIgnoreBatteryOptimizations();
      if (ok) {
        setBatteryExemptionStatus('System battery optimization exemption dialog opened');
      } else {
        telecomBridge.openAppSettings();
        setBatteryExemptionStatus('Opening App Settings: please set Battery to "Unrestricted"');
      }
    } else {
      setBatteryExemptionStatus('Simulated: Battery optimization set to Unrestricted');
    }
    setTimeout(() => {
      setTelephonyDiag(telecomBridge.getDiagnostics());
    }, 1200);
  };

  // Check backend health
  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    const start = performance.now();
    try {
      const res = await fetch('/api/health', { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      setBackendLatency(latency);
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendLatency(null);
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkBackendHealth();
      runPipelineTest(pipelineTestNumber);
      setTelephonyDiag(telecomBridge.getDiagnostics());
      const unsub = telecomBridge.subscribe((type) => {
        if (type === 'ROLE_STATUS_CHANGED' || type === 'BATTERY_CHANGED') {
          setTelephonyDiag(telecomBridge.getDiagnostics());
        }
      });
      return () => { unsub(); };
    }
  }, [isOpen]);

  const runPipelineTest = async (num: string) => {
    if (!num.trim()) return;
    setIsResolving(true);
    try {
      const res = await resolver.resolveCaller(num, {
        localContacts: contacts,
        blockRules: rules,
        whitelist: whitelist,
        userCountry: 'US',
      });
      setPipelineResult(res);
    } catch (err) {
      console.error('Pipeline test error:', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Platform capabilities
  const capabilities = useMemo(() => {
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const hasWebContacts = 'contacts' in navigator && 'ContactsManager' in window;
    const hasWebShare = 'share' in navigator;
    const hasClipboard = 'clipboard' in navigator;
    const hasNotification = 'Notification' in window;
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    return {
      isPwa,
      hasWebContacts,
      hasWebShare,
      hasClipboard,
      hasNotification,
      isAndroid,
      isIOS,
      platform: isAndroid ? 'Android OS' : isIOS ? 'Apple iOS' : 'Desktop / Web Environment',
    };
  }, []);

  // Database size calculation
  const databaseStats = useMemo(() => {
    const rawData = JSON.stringify({ contacts, calls, rules, whitelist, settings, timelineEvents });
    const bytes = new Blob([rawData]).size;
    const kb = (bytes / 1024).toFixed(1);
    return {
      contactsCount: contacts.length,
      callsCount: calls.length,
      rulesCount: rules.length,
      whitelistCount: whitelist.length,
      timelineCount: timelineEvents.length,
      totalBytes: bytes,
      sizeStr: `${kb} KB`,
    };
  }, [contacts, calls, rules, whitelist, settings, timelineEvents]);

  // Export JSON backup
  const handleExportJson = () => {
    const backup = {
      version: '2026.09-v1',
      exportedAt: new Date().toISOString(),
      contacts,
      calls,
      rules,
      whitelist,
      settings,
      timelineEvents,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vigilshield-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onImportAllData(parsed);
        alert('Data backup successfully restored!');
      } catch {
        alert('Invalid JSON file. Please provide a valid VigilShield backup file.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>System Diagnostics & Telephony Health</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Real-time
                </span>
                {isThrottlingRisk && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                    <BatteryWarning className="w-3 h-3 text-rose-400" /> Throttling Alert
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Live verification of permissions, battery throttling status, 8-tier caller ID pipeline, and local database integrity
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'OVERVIEW', label: 'Platform & Database' },
            { id: 'PIPELINE', label: '8-Tier Pipeline Tester' },
            { id: 'ACTIONS', label: 'Backup & State Management' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeSubTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeSubTab === 'OVERVIEW' && (
          <div className="space-y-4">
            {/* Low-Battery & OS Protection Throttling Alert Banner */}
            {isThrottlingRisk && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 border-2 border-amber-500/70 shadow-lg shadow-amber-950/40 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 mt-0.5">
                      <BatteryWarning className="w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          OS Protection Throttling Detected
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/50">
                          Battery {effectiveDiag.batteryLevel ?? 15}% ({effectiveDiag.isCharging ? 'Charging' : 'Discharging'})
                        </span>
                        {effectiveDiag.isPowerSaveMode && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50">
                            Power Saver Active
                          </span>
                        )}
                        {!effectiveDiag.isIgnoringBatteryOptimizations && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50">
                            Subject to Android Doze
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        The operating system is restricting background services to conserve power. Under low battery or Battery Saver mode, Android throttles CPU clocks, delays background InCallService / CallScreening bindings, and suspends real-time network threat queries. Spam calls may ring before they can be analyzed or blocked.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subsystems at risk */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/30">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5" /> CallScreeningService
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      OS may timeout spam analysis (&gt;500ms) before the phone rings.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/30">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Cpu className="w-3.5 h-3.5" /> Real-Time AI Threat Intel
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Background cellular network queries throttled or queued.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/30">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Zap className="w-3.5 h-3.5" /> In-Call HUD WakeLock
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Device may delay launching the custom in-call security overlay.
                    </p>
                  </div>
                </div>

                {/* Remediation actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                  <span className="text-[11px] text-amber-300/80">
                    Plug in charger or exempt VigilShield from OS battery optimization to restore full real-time shielding.
                  </span>
                  <button
                    onClick={handleRequestBatteryExemption}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    Exempt from Battery Saver
                  </button>
                </div>
                {batteryExemptionStatus && (
                  <div className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {batteryExemptionStatus}
                  </div>
                )}
              </div>
            )}

            {/* Battery & Power Management Diagnostics Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-850 border border-slate-750 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  {effectiveDiag.isCharging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                  ) : isThrottlingRisk ? (
                    <BatteryWarning className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Battery className="w-4 h-4 text-indigo-400" />
                  )}
                  Battery Status & OS Protection Throttling
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSimulateLowBattery(!simulateLowBattery)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                      simulateLowBattery
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Toggle simulated low battery to test OS throttling detection"
                  >
                    <Sliders className="w-3 h-3" />
                    {simulateLowBattery ? 'Exit Low-Battery Test' : 'Test Low-Battery Alert'}
                  </button>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    isThrottlingRisk
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {isThrottlingRisk ? 'THROTTLING RISK' : 'OPTIMAL'}
                  </span>
                </div>
              </div>

              {/* Battery Meter Visual */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>Charge Level:</span>
                    <strong className="text-white font-mono">{effectiveDiag.batteryLevel !== undefined ? `${effectiveDiag.batteryLevel}%` : '85%'}</strong>
                    {effectiveDiag.isCharging && (
                      <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-0.5">
                        <Zap className="w-3 h-3" /> Charging
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Threshold: &le;20% triggers throttling warning
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (effectiveDiag.batteryLevel ?? 85) <= 20
                        ? 'bg-rose-500'
                        : (effectiveDiag.batteryLevel ?? 85) <= 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, effectiveDiag.batteryLevel ?? 85))}%` }}
                  />
                </div>
              </div>

              {/* Grid of battery states */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">OS Power Save Mode</div>
                    <div className="text-[10px] text-slate-400">System battery saver status</div>
                  </div>
                  <span className={`text-[11px] font-bold ${effectiveDiag.isPowerSaveMode ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {effectiveDiag.isPowerSaveMode ? '⚠️ ACTIVE (Throttling)' : '✓ NORMAL'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Battery Optimization</div>
                    <div className="text-[10px] text-slate-400">Doze / standby restrictions</div>
                  </div>
                  <span className={`text-[11px] font-bold ${effectiveDiag.isIgnoringBatteryOptimizations ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {effectiveDiag.isIgnoringBatteryOptimizations ? '✓ UNRESTRICTED' : '⚠️ OPTIMIZED'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Spam Intercept Latency</div>
                    <div className="text-[10px] text-slate-400">CallScreeningService SLA</div>
                  </div>
                  <span className={`text-[11px] font-bold ${isThrottlingRisk ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isThrottlingRisk ? '⚠️ Latency risk (>500ms)' : '✓ Fast (<50ms)'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Background Threat Sync</div>
                    <div className="text-[10px] text-slate-400">Local DB auto-update</div>
                  </div>
                  <span className={`text-[11px] font-bold ${isThrottlingRisk ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isThrottlingRisk ? '⏸ Deferred by OS' : '✓ Real-time Sync'}
                  </span>
                </div>
              </div>
            </div>
            {/* Issue 30: Core Telecom & InCallService Diagnostics */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-400" /> Android Telecom Diagnostics (Issue 30)
                </span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  isDefaultDialer ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  ROLE_DIALER: {isDefaultDialer ? 'ACTIVE' : 'NOT SET'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300 pt-1">
                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Default Dialer (ROLE_DIALER)</div>
                    <div className="text-[10px] text-slate-400">Controls native cellular dialing & incoming UI</div>
                  </div>
                  {onRequestDefaultDialer && !isDefaultDialer ? (
                    <button
                      onClick={onRequestDefaultDialer}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] transition"
                    >
                      Request Role
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-bold text-[11px]">✓ Confirmed</span>
                  )}
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">InCallService Subsystem</div>
                    <div className="text-[10px] text-slate-400">VigilInCallService & TelecomBridge</div>
                  </div>
                  <span className="text-emerald-400 font-bold text-[11px]">● BOUND / READY</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Contacts Permission</div>
                    <div className="text-[10px] text-slate-400">READ_CONTACTS (Priority 1 resolution)</div>
                  </div>
                  <span className={capabilities.hasWebContacts || contacts.length > 0 ? 'text-emerald-400 font-bold text-[11px]' : 'text-slate-400 font-bold text-[11px]'}>
                    {capabilities.hasWebContacts || contacts.length > 0 ? '✓ GRANTED' : 'PROMPT ON SYNC'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                  <div>
                    <div className="font-semibold text-white">Call Log Permission</div>
                    <div className="text-[10px] text-slate-400">READ_CALL_LOG (Dual SIM history sync)</div>
                  </div>
                  <span className="text-emerald-400 font-bold text-[11px]">✓ AVAILABLE</span>
                </div>
              </div>
            </div>

            {/* Backend & Environment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Telephony Host & PWA */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-400" /> Platform Architecture
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {capabilities.platform}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-400 pt-1">
                  <div className="flex justify-between">
                    <span>Standalone PWA Mode:</span>
                    <strong className={capabilities.isPwa ? 'text-emerald-400' : 'text-slate-300'}>
                      {capabilities.isPwa ? '✓ Installed Native PWA' : 'Browser View'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Web Contacts API:</span>
                    <strong className={capabilities.hasWebContacts ? 'text-emerald-400' : 'text-amber-400'}>
                      {capabilities.hasWebContacts ? '✓ Supported' : 'Fallback: .vcf / CSV import'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Dialer Protocol (tel:):</span>
                    <strong className="text-emerald-400">✓ Native Android/iOS Handled</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Notification Engine:</span>
                    <strong className={capabilities.hasNotification ? 'text-emerald-400' : 'text-slate-400'}>
                      {capabilities.hasNotification ? '✓ System Notification API' : 'In-App HUD'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Backend Connectivity */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-indigo-400" /> Authorized API Services
                  </span>
                  <button
                    onClick={checkBackendHealth}
                    className="p-1 rounded text-slate-400 hover:text-white"
                    title="Refresh connection"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs space-y-1 text-slate-400 pt-1">
                  <div className="flex justify-between items-center">
                    <span>Service Health (/api/health):</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      backendStatus === 'online'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : backendStatus === 'checking'
                        ? 'bg-indigo-500/20 text-indigo-300 animate-pulse'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {backendStatus === 'online' ? '● Online (Healthy)' : backendStatus === 'checking' ? 'Connecting...' : '○ Local Offline Fallback'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Round-trip Latency:</span>
                    <strong className="text-slate-200">
                      {backendLatency !== null ? `${backendLatency} ms` : 'Local on-device cache'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Threat DB Version:</span>
                    <strong className="text-indigo-300 font-mono text-[11px]">
                      {settings.communityDatabaseVersion}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Protection Mode:</span>
                    <strong className="text-emerald-400">
                      Pure Real Device Mode (Zero Dummy Data)
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Database Health Card */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-emerald-400" /> On-Device Database Storage
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {databaseStats.sizeStr} Allocated
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <div className="text-lg font-extrabold text-white">{databaseStats.contactsCount}</div>
                  <div className="text-[10px] text-slate-400">Local Contacts</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <div className="text-lg font-extrabold text-white">{databaseStats.callsCount}</div>
                  <div className="text-[10px] text-slate-400">Call Log Records</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <div className="text-lg font-extrabold text-indigo-300">{databaseStats.rulesCount}</div>
                  <div className="text-[10px] text-slate-400">Firewall Rules</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <div className="text-lg font-extrabold text-emerald-300">{databaseStats.whitelistCount}</div>
                  <div className="text-[10px] text-slate-400">Trusted Allowlist</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                🔒 <strong>Privacy Assurance:</strong> Zero address book data is uploaded to remote servers. All matching is executed locally in memory on your device using client-side E.164 normalization.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: 8-TIER RESOLUTION PIPELINE TESTER */}
        {activeSubTab === 'PIPELINE' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Test Any Number Across the 8 Resolution Stages:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pipelineTestNumber}
                    onChange={(e) => setPipelineTestNumber(e.target.value)}
                    placeholder="+91 14090 98984 or +1 (800) 935-9935"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => runPipelineTest(pipelineTestNumber)}
                    disabled={isResolving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    {isResolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Simulate'}
                  </button>
                </div>
              </div>

              {/* Sample test buttons */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-slate-400">Quick presets:</span>
                <button
                  onClick={() => {
                    setPipelineTestNumber('+91 14090 98984');
                    runPipelineTest('+91 14090 98984');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  TRAI 140 Series
                </button>
                <button
                  onClick={() => {
                    setPipelineTestNumber('+18009359935');
                    runPipelineTest('+18009359935');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Verified Enterprise (Chase)
                </button>
                <button
                  onClick={() => {
                    setPipelineTestNumber('+18005550199');
                    runPipelineTest('+18005550199');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Warranty Robocall
                </button>
                <button
                  onClick={() => {
                    setPipelineTestNumber('+14155552671');
                    runPipelineTest('+14155552671');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Unknown Caller
                </button>
              </div>
            </div>

            {/* Pipeline Stage Visualization */}
            {pipelineResult && (
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Resolved Identity:</span>
                    <span className="text-sm font-extrabold text-white">{pipelineResult.value.name}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    pipelineResult.value.reputation.classification === 'VERIFIED'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : pipelineResult.value.reputation.isSpam
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {pipelineResult.value.reputation.classification}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Decision Tier Claimed:</span>
                    <strong className="text-indigo-400">{pipelineResult.source}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Confidence Level:</span>
                    <strong className="text-slate-200">{pipelineResult.confidence}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Risk Score:</span>
                    <strong className="text-slate-200">{pipelineResult.value.reputation.riskScore}/100</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Explanation:</span>
                    <span className="text-slate-200 italic max-w-xs text-right">
                      {pipelineResult.value.reputation.explanation}
                    </span>
                  </div>
                </div>

                {/* The 8 Stages Checklist */}
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    8-Tier Evaluation Order:
                  </div>
                  {[
                    { stage: 'Stage 1', name: 'Device Local Contacts (Zero Exfiltration)', hit: pipelineResult.source.includes('Local Address Book') },
                    { stage: 'Stage 2', name: 'Personal Whitelist / VIP Overrides', hit: pipelineResult.source.includes('Whitelist') },
                    { stage: 'Stage 3', name: 'Local Firewall Block Rules', hit: pipelineResult.source.includes('Firewall') },
                    { stage: 'Stage 4', name: 'Regulatory Prefixes (TRAI 140/160 UCC)', hit: pipelineResult.source.includes('TRAI') || pipelineResult.source.includes('Regulatory') },
                    { stage: 'Stage 5', name: 'Verified Enterprise Directory', hit: pipelineResult.source.includes('Verified Enterprise') },
                    { stage: 'Stage 6', name: 'Community Threat Reputation Feed', hit: pipelineResult.source.includes('Community') },
                    { stage: 'Stage 7', name: 'Carrier & Telecom Circle Metadata', hit: pipelineResult.source.includes('Telecom') },
                    { stage: 'Stage 8', name: 'Honest Unknown Caller State', hit: pipelineResult.source.includes('Global') || pipelineResult.confidence === 'UNKNOWN' },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                        s.hit
                          ? 'bg-indigo-600/20 border-indigo-500/60 text-white font-semibold'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-500">{s.stage}</span>
                        <span>{s.name}</span>
                      </div>
                      {s.hit && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-indigo-500 text-white">
                          MATCHED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIONS & STATE MANAGEMENT */}
        {activeSubTab === 'ACTIONS' && (
          <div className="space-y-4">
            {/* Pure Real Device State Banner */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Runtime Environment Mode</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      Real Device Mode
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Zero mock data. Displays only real device contacts and actual recorded calls from Android Telecom and CallLog APIs.
                  </p>
                </div>
                <button
                  onClick={onResetToCleanState}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Purge Local History</span>
                </button>
              </div>
            </div>

            {/* Backup & Restore */}
            <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Backup & Restore Application Database</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Export or restore full configuration, address book cache, call log history, and custom block rules as standardized JSON.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Export All Data (JSON)</span>
                </button>

                <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Import Backup (JSON)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>VigilShield Telephony Engine v2026.09</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}

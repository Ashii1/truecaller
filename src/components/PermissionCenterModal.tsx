import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock, PhoneCall, ShieldAlert, ShieldCheck, Users, X, Moon, Gauge, CalendarClock, UserRoundCheck, VolumeX, Landmark, AlertTriangle, Fingerprint } from 'lucide-react';
import { ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import Phase3SafetyCenter from './Phase3SafetyCenter';

interface PermissionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShieldSettings;
  onUpdateSettings: (newSettings: ShieldSettings) => void;
  isDefaultDialer: boolean;
  onRequestDefaultDialer: () => void;
  onSyncContacts: () => void;
}

type LiveState = 'ON' | 'OFF' | 'AVAILABLE' | 'UNAVAILABLE';
type SilentMode = 'OFF' | 'UNKNOWN_ONLY' | 'UNKNOWN_AND_SPAM';
type SpamQuietMode = 'WARN' | 'SILENCE' | 'REJECT_HIGH_RISK';
type UnknownMode = 'ALLOW' | 'SILENCE' | 'REJECT';
interface CallbackReminder { id: string; number: string; label: string; dueAt: number; done: boolean; }

const PREF_KEY = 'vigilshield_phase1_preferences_v1';
const PHASE2_KEY = 'vigilshield_phase2_security_v1';

export default function PermissionCenterModal({ isOpen, onClose, settings, onUpdateSettings, isDefaultDialer, onRequestDefaultDialer, onSyncContacts }: PermissionCenterModalProps) {
  const [notificationStatus, setNotificationStatus] = useState<LiveState>('OFF');
  const [contactsStatus, setContactsStatus] = useState<LiveState>('OFF');
  const [callLogStatus, setCallLogStatus] = useState<LiveState>('UNAVAILABLE');
  const [screeningStatus, setScreeningStatus] = useState<LiveState>('UNAVAILABLE');
  const [silentMode, setSilentMode] = useState<SilentMode>('UNKNOWN_AND_SPAM');
  const [spamQuietMode, setSpamQuietMode] = useState<SpamQuietMode>('SILENCE');
  const [unknownMode, setUnknownMode] = useState<UnknownMode>('ALLOW');
  const [trustedNumbers, setTrustedNumbers] = useState<string[]>([]);
  const [trustedInput, setTrustedInput] = useState('');
  const [reminders, setReminders] = useState<CallbackReminder[]>([]);
  const [reminderNumber, setReminderNumber] = useState('');
  const [reminderLabel, setReminderLabel] = useState('');
  const [reminderDue, setReminderDue] = useState('');
  const [riskDetection, setRiskDetection] = useState(true);
  const [financialWarnings, setFinancialWarnings] = useState(true);
  const [spoofWarnings, setSpoofWarnings] = useState(true);

  const refresh = () => {
    const diag = telecomBridge.getDiagnostics();
    setNotificationStatus(diag.notificationsPermission ? 'ON' : 'OFF');
    setContactsStatus(diag.contactsPermission ? 'ON' : 'OFF');
    setCallLogStatus(diag.callLogPermission ? 'ON' : 'OFF');
    setScreeningStatus(diag.isCallScreeningRoleHeld ? 'ON' : 'OFF');
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (saved.silentMode) setSilentMode(saved.silentMode);
      if (saved.spamQuietMode) setSpamQuietMode(saved.spamQuietMode);
      if (saved.unknownMode) setUnknownMode(saved.unknownMode);
      if (Array.isArray(saved.trustedNumbers)) setTrustedNumbers(saved.trustedNumbers);
      if (Array.isArray(saved.reminders)) setReminders(saved.reminders);
      const phase2 = JSON.parse(localStorage.getItem(PHASE2_KEY) || '{}');
      if (typeof phase2.riskDetection === 'boolean') setRiskDetection(phase2.riskDetection);
      if (typeof phase2.financialWarnings === 'boolean') setFinancialWarnings(phase2.financialWarnings);
      if (typeof phase2.spoofWarnings === 'boolean') setSpoofWarnings(phase2.spoofWarnings);
    } catch { /* keep safe defaults */ }
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, isDefaultDialer]);

  useEffect(() => {
    if (!isOpen) return;
    localStorage.setItem(PREF_KEY, JSON.stringify({ silentMode, spamQuietMode, unknownMode, trustedNumbers, reminders }));
    localStorage.setItem(PHASE2_KEY, JSON.stringify({ riskDetection, financialWarnings, spoofWarnings }));
    telecomBridge.setSecuritySetting('smart_silent_mode_enabled', silentMode !== 'OFF');
    telecomBridge.setSecuritySetting('smart_silent_unknown_only', silentMode === 'UNKNOWN_ONLY');
    telecomBridge.setSecuritySetting('smart_silent_unknown_and_spam', silentMode === 'UNKNOWN_AND_SPAM');
    telecomBridge.setSecuritySetting('smart_spam_quiet_enabled', spamQuietMode !== 'WARN');
    telecomBridge.setSecuritySetting('smart_spam_reject_high_risk', spamQuietMode === 'REJECT_HIGH_RISK');
    telecomBridge.setSecuritySetting('unknown_caller_silence', unknownMode === 'SILENCE');
    telecomBridge.setSecuritySetting('unknown_caller_reject', unknownMode === 'REJECT');
    telecomBridge.setSecuritySetting('phase2_risk_detection_enabled', riskDetection);
    telecomBridge.setSecuritySetting('phase2_financial_warnings_enabled', financialWarnings);
    telecomBridge.setSecuritySetting('phase2_spoof_warnings_enabled', spoofWarnings);
  }, [isOpen, silentMode, spamQuietMode, unknownMode, trustedNumbers, reminders, riskDetection, financialWarnings, spoofWarnings]);

  const handleRequestPermissions = () => {
    const result = telecomBridge.requestDevicePermissions();
    window.setTimeout(refresh, result.success ? 800 : 300);
  };

  const handleRequestScreening = () => {
    telecomBridge.requestCallScreeningRole();
    window.setTimeout(refresh, 800);
  };

  const handleOpenAppSettings = () => {
    telecomBridge.openAppSettings();
  };

  const addTrusted = () => {
    const value = trustedInput.trim().replace(/[^\d+]/g, '');
    if (!value) return;
    setTrustedNumbers(prev => Array.from(new Set([value, ...prev])).slice(0, 20));
    setTrustedInput('');
  };

  const addReminder = () => {
    const number = reminderNumber.trim();
    if (!number || !reminderDue) return;
    const dueAt = new Date(reminderDue).getTime();
    if (!Number.isFinite(dueAt)) return;
    setReminders(prev => [{ id: `cb-${Date.now()}`, number, label: reminderLabel.trim() || 'Callback', dueAt, done: false }, ...prev].slice(0, 30));
    setReminderNumber(''); setReminderLabel(''); setReminderDue('');
  };

  const riskDescription = useMemo(() => {
    if (settings.sensitivity === 'AGGRESSIVE') return 'Strict: unverified callers receive the strongest scrutiny.';
    if (settings.sensitivity === 'STRICT') return 'Balanced: spam, bot and suspicious signals are prioritized.';
    return 'Low: confirmed high-risk patterns are prioritized to reduce false positives.';
  }, [settings.sensitivity]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-5">
      <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-lg font-extrabold text-white">Settings & Protection</h2><p className="text-xs text-slate-400">Live permissions and everyday call protection</p></div></div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close settings"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Phone & permissions</h3><p className="text-xs text-slate-500">These buttons now open the real Android permission/role controls.</p></div><button onClick={handleOpenAppSettings} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800">Android settings</button></div>
            <StatusRow icon={<PhoneCall className="h-4 w-4" />} title="Default Phone App" description="Routes real cellular calls through VigilShield InCallService." status={isDefaultDialer ? 'ON' : 'OFF'} action={!isDefaultDialer ? <button onClick={onRequestDefaultDialer} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Set as default</button> : undefined} />
            <StatusRow icon={<Users className="h-4 w-4" />} title="Contacts" description="Reads device contacts for caller names and trusted-contact protection." status={contactsStatus} action={contactsStatus !== 'ON' ? <button onClick={handleRequestPermissions} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
            <StatusRow icon={<Clock className="h-4 w-4" />} title="Call Log" description="Reads real incoming, outgoing and missed call history." status={callLogStatus} action={callLogStatus !== 'ON' ? <button onClick={handleRequestPermissions} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
            <StatusRow icon={<Bell className="h-4 w-4" />} title="Notifications" description="Missed-call, spam and urgent-call alerts." status={notificationStatus} action={notificationStatus !== 'ON' ? <button onClick={handleRequestPermissions} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
            <StatusRow icon={<ShieldAlert className="h-4 w-4" />} title="Caller screening" description="Android caller-ID and spam-screening role." status={screeningStatus} action={screeningStatus !== 'ON' ? <button onClick={handleRequestScreening} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
          </section>

          <section className="space-y-3"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-red-400" /><div><h3 className="text-sm font-bold text-white">Scam & Spoof Protection</h3><p className="text-xs text-slate-500">Local-only heuristics flag financial scam patterns, urgency and impersonation signals. Caller ID is never treated as proof of identity.</p></div></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ToggleCard icon={<ShieldCheck className="h-4 w-4" />} title="Risk detection" description="Analyze suspicious caller metadata" on={riskDetection} onChange={setRiskDetection} />
              <ToggleCard icon={<Landmark className="h-4 w-4" />} title="Financial warnings" description="Flag bank, OTP, KYC and payment patterns" on={financialWarnings} onChange={setFinancialWarnings} />
              <ToggleCard icon={<Fingerprint className="h-4 w-4" />} title="Spoof warnings" description="Highlight unverified or inconsistent identity" on={spoofWarnings} onChange={setSpoofWarnings} />
            </div>
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><p className="text-[11px] leading-5 text-slate-400">VigilShield does not claim access to carrier or government fraud databases. These warnings are defensive local signals and can be wrong; verify important callers through a trusted channel.</p></div>
          </section>

          <section className="space-y-3"><div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-emerald-400" /><div><h3 className="text-sm font-bold text-white">Trusted Circle</h3><p className="text-xs text-slate-500">Saved contacts are always trusted. Add important numbers that are not saved yet.</p></div></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex gap-2"><input value={trustedInput} onChange={e=>setTrustedInput(e.target.value)} placeholder="Phone number" inputMode="tel" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-blue-500" /><button onClick={addTrusted} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Add trusted</button></div><div className="mt-3 flex flex-wrap gap-2">{trustedNumbers.length===0 ? <span className="text-xs text-slate-500">No extra trusted numbers.</span> : trustedNumbers.map(n=><button key={n} onClick={()=>setTrustedNumbers(p=>p.filter(x=>x!==n))} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">{n} ×</button>)}</div></div>
          </section>

          <section className="space-y-3"><div className="flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-400" /><div><h3 className="text-sm font-bold text-white">Smart Silent Mode</h3><p className="text-xs text-slate-500">Keep important calls audible while reducing interruptions.</p></div></div><ChoiceRow value={silentMode} onChange={setSilentMode} options={[['OFF','Off'],['UNKNOWN_ONLY','Unknown callers'],['UNKNOWN_AND_SPAM','Unknown + spam']]} /></section>
          <section className="space-y-3"><div className="flex items-center gap-2"><VolumeX className="h-4 w-4 text-amber-400" /><div><h3 className="text-sm font-bold text-white">Smart Spam Quieting</h3><p className="text-xs text-slate-500">Choose whether suspicious calls warn, silence, or reject at high confidence.</p></div></div><ChoiceRow value={spamQuietMode} onChange={setSpamQuietMode} options={[['WARN','Warn only'],['SILENCE','Silence spam'],['REJECT_HIGH_RISK','Reject high risk']]} /></section>
          <section className="space-y-3"><div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-400" /><div><h3 className="text-sm font-bold text-white">Call Priority & Risk</h3><p className="text-xs text-slate-500">Every caller is ranked using the existing Safe / Unknown / Suspicious / High Risk model.</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['SAFE','Safe'],['UNKNOWN','Unknown'],['SUSPICIOUS','Suspicious'],['HIGH_RISK','High risk']].map(([id,label])=><div key={id} className="rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="text-[11px] font-bold text-white">{label}</div><div className="mt-1 text-[10px] text-slate-500">{id==='HIGH_RISK'?'Urgent attention':id==='SUSPICIOUS'?'Review carefully':id==='UNKNOWN'?'Needs context':'Normal priority'}</div></div>)}</div><div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">Current sensitivity: <span className="font-bold text-slate-200">{settings.sensitivity}</span> · {riskDescription}</div></section>
          <section className="space-y-3"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-cyan-400" /><div><h3 className="text-sm font-bold text-white">Callback Reminders</h3><p className="text-xs text-slate-500">Keep a local follow-up queue after missed or unfinished calls.</p></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input value={reminderNumber} onChange={e=>setReminderNumber(e.target.value)} placeholder="Number" inputMode="tel" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /><input value={reminderLabel} onChange={e=>setReminderLabel(e.target.value)} placeholder="Reason" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /><input value={reminderDue} onChange={e=>setReminderDue(e.target.value)} type="datetime-local" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /></div><button onClick={addReminder} className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-600">Add callback reminder</button><div className="space-y-2">{reminders.length===0 ? <div className="text-xs text-slate-500">No callback reminders.</div> : reminders.slice(0,5).map(r=><div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="min-w-0 flex-1"><div className="text-xs font-bold text-white">{r.label}</div><div className="text-[11px] text-slate-500">{r.number} · {new Date(r.dueAt).toLocaleString()}</div></div><button onClick={()=>setReminders(p=>p.filter(x=>x.id!==r.id))} className="text-[11px] font-bold text-slate-400 hover:text-white">Done</button></div>)}</div></section>
          <section className="space-y-3"><div className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-slate-300" /><div><h3 className="text-sm font-bold text-white">Unknown Caller Handling</h3><p className="text-xs text-slate-500">A separate choice from spam protection, so normal unknown calls are not automatically treated as scams.</p></div></div><ChoiceRow value={unknownMode} onChange={setUnknownMode} options={[['ALLOW','Allow'],['SILENCE','Silence'],['REJECT','Reject']]} /></section>

          <Phase3SafetyCenter />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm font-bold text-white">Protection status</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><MiniStatus label="Shield" on={settings.masterEnabled} /><MiniStatus label="Trusted Circle" on={trustedNumbers.length>0} /><MiniStatus label="Smart Silent" on={silentMode!=='OFF'} /><MiniStatus label="Spam quieting" on={spamQuietMode!=='WARN'} /><MiniStatus label="Scam shield" on={riskDetection} /></div></div>
        </div>
      </section>
    </div>
  );
}

function ChoiceRow<T extends string>({ value, onChange, options }: { value:T; onChange:(v:T)=>void; options:[T,string][] }) { return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{options.map(([id,label])=><button key={id} onClick={()=>onChange(id)} className={`rounded-xl border px-3 py-2.5 text-left transition ${value===id?'border-blue-500/50 bg-blue-500/10 text-white':'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}><div className="text-xs font-bold">{label}</div><div className="mt-0.5 text-[10px] text-slate-500">{id===value?'Selected':'Tap to choose'}</div></button>)}</div>; }

function ToggleCard({ icon, title, description, on, onChange }: { icon: React.ReactNode; title:string; description:string; on:boolean; onChange:(value:boolean)=>void }) { return <button type="button" onClick={()=>onChange(!on)} className={`rounded-2xl border p-3 text-left transition ${on?'border-emerald-500/30 bg-emerald-500/5':'border-slate-800 bg-slate-900'}`}><div className="flex items-center justify-between"><span className={on?'text-emerald-400':'text-slate-500'}>{icon}</span><span className={`h-2 w-2 rounded-full ${on?'bg-emerald-400':'bg-slate-600'}`} /></div><div className="mt-2 text-xs font-bold text-white">{title}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div><div className="mt-2 text-[10px] font-bold text-slate-400">{on?'ON':'OFF'}</div></button>; }

function StatusRow({ icon, title, description, status, action }: { icon: React.ReactNode; title: string; description: string; status: LiveState; action?: React.ReactNode }) { const positive = status === 'ON' || status === 'AVAILABLE'; return <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{positive ? <CheckCircle2 className="h-4 w-4" /> : icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${positive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{status}</span>{action}</div></div>; }
function MiniStatus({ label, on }: { label: string; on: boolean }) { return <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className={`mt-1 text-xs font-bold ${on ? 'text-emerald-400' : 'text-slate-500'}`}>{on ? 'Active' : 'Off'}</div></div>; }

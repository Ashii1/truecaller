import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, Clock, PhoneCall, ShieldAlert, ShieldCheck, Users, X, Moon, Gauge, CalendarClock, UserRoundCheck, VolumeX, Palette, Sun, Smartphone, Sparkles } from 'lucide-react';
import { ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';

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
type AppTheme = 'SYSTEM' | 'LIGHT' | 'DARK';
type AppDensity = 'COMFORTABLE' | 'COMPACT';
type FontScale = 'SMALL' | 'DEFAULT' | 'LARGE' | 'XLARGE';

interface CallbackReminder { id: string; number: string; label: string; dueAt: number; done: boolean; }
interface AppearancePreferences {
  theme: AppTheme;
  accent: string;
  customAccent: string;
  density: AppDensity;
  fontScale: FontScale;
  reducedMotion: boolean;
  amoled: boolean;
}

const PREF_KEY = 'vigilshield_phase1_preferences_v1';
const APPEARANCE_KEY = 'vigilshield_appearance_v1';
const ACCENT_PRESETS = [
  ['#3b82f6', 'Ocean'], ['#6366f1', 'Indigo'], ['#8b5cf6', 'Violet'],
  ['#06b6d4', 'Cyan'], ['#10b981', 'Emerald'], ['#f59e0b', 'Amber'],
  ['#f43f5e', 'Rose'], ['#ec4899', 'Pink'],
] as const;

const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'SYSTEM', accent: '#3b82f6', customAccent: '#3b82f6', density: 'COMFORTABLE',
  fontScale: 'DEFAULT', reducedMotion: false, amoled: false,
};

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
  const [appearance, setAppearance] = useState<AppearancePreferences>(() => {
    try { return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}') }; }
    catch { return DEFAULT_APPEARANCE; }
  });

  const refresh = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) setNotificationStatus(Notification.permission === 'granted' ? 'ON' : 'OFF');
    const diag = telecomBridge.getDiagnostics();
    setContactsStatus(diag.contactsPermission ? 'ON' : 'OFF');
    setCallLogStatus(diag.callLogPermission || diag.isDefaultDialer ? 'AVAILABLE' : 'UNAVAILABLE');
    setScreeningStatus(diag.isDefaultDialer ? 'AVAILABLE' : 'UNAVAILABLE');
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
    } catch { /* keep safe defaults */ }
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [isOpen, isDefaultDialer]);

  useEffect(() => {
    if (!isOpen) return;
    localStorage.setItem(PREF_KEY, JSON.stringify({ silentMode, spamQuietMode, unknownMode, trustedNumbers, reminders }));
    telecomBridge.setSecuritySetting('smart_silent_mode_enabled', silentMode !== 'OFF');
    telecomBridge.setSecuritySetting('smart_silent_unknown_only', silentMode === 'UNKNOWN_ONLY');
    telecomBridge.setSecuritySetting('smart_silent_unknown_and_spam', silentMode === 'UNKNOWN_AND_SPAM');
    telecomBridge.setSecuritySetting('smart_spam_quiet_enabled', spamQuietMode !== 'WARN');
    telecomBridge.setSecuritySetting('smart_spam_reject_high_risk', spamQuietMode === 'REJECT_HIGH_RISK');
    telecomBridge.setSecuritySetting('unknown_caller_silence', unknownMode === 'SILENCE');
    telecomBridge.setSecuritySetting('unknown_caller_reject', unknownMode === 'REJECT');
  }, [isOpen, silentMode, spamQuietMode, unknownMode, trustedNumbers, reminders]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.vsTheme = appearance.theme.toLowerCase();
    root.dataset.vsDensity = appearance.density.toLowerCase();
    root.dataset.vsFontScale = appearance.fontScale.toLowerCase();
    root.dataset.vsReducedMotion = appearance.reducedMotion ? 'true' : 'false';
    root.dataset.vsAmoled = appearance.amoled ? 'true' : 'false';
    root.style.setProperty('--vs-accent', appearance.accent);
    root.style.setProperty('--vs-accent-soft', hexToRgba(appearance.accent, 0.14));
    root.style.setProperty('--vs-accent-ring', hexToRgba(appearance.accent, 0.28));
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try { await Notification.requestPermission(); refresh(); } catch (err) { console.warn('Notification permission request failed:', err); }
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
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-lg font-extrabold text-white">Settings & Protection</h2><p className="text-xs text-slate-400">Live permissions, protection and personalisation</p></div></div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close settings"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Phone & permissions</h3><p className="text-xs text-slate-500">Review live Android status here; no setup wizard.</p></div></div>
            <StatusRow icon={<PhoneCall className="h-4 w-4" />} title="Default Phone App" description="Routes real cellular calls through VigilShield InCallService." status={isDefaultDialer ? 'ON' : 'OFF'} action={!isDefaultDialer ? <button onClick={onRequestDefaultDialer} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Set as default</button> : undefined} />
            <StatusRow icon={<Users className="h-4 w-4" />} title="Contacts" description="Reads device contacts for caller names and trusted-contact protection." status={contactsStatus} action={contactsStatus !== 'ON' ? <button onClick={onSyncContacts} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600">Refresh</button> : undefined} />
            <StatusRow icon={<Clock className="h-4 w-4" />} title="Call Log" description="Reads real incoming, outgoing and missed call history." status={callLogStatus} />
            <StatusRow icon={<Bell className="h-4 w-4" />} title="Notifications" description="Missed-call, spam and urgent-call alerts." status={notificationStatus} action={notificationStatus !== 'ON' && typeof Notification !== 'undefined' ? <button onClick={handleRequestNotifications} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
            <StatusRow icon={<ShieldAlert className="h-4 w-4" />} title="Caller screening" description="Available when VigilShield has the required Android phone role." status={screeningStatus} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-blue-400" /><div><h3 className="text-sm font-bold text-white">Personalise VigilShield</h3><p className="text-xs text-slate-500">Your phone, your colours. All choices stay on this device.</p></div></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Sun className="h-4 w-4" /> Appearance</div>
                <ChoiceRow value={appearance.theme} onChange={theme=>setAppearance(p=>({...p, theme}))} options={[['SYSTEM','System'],['LIGHT','Light'],['DARK','Dark']]} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Palette className="h-4 w-4" /> Accent colour</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{ACCENT_PRESETS.map(([hex,name])=><button key={hex} title={name} aria-label={`Use ${name} accent`} onClick={()=>setAppearance(p=>({...p,accent:hex,customAccent:hex}))} className={`group rounded-xl border p-2 ${appearance.accent.toLowerCase()===hex.toLowerCase()?'border-white/70':'border-slate-700'}`}><span className="mx-auto block h-7 w-7 rounded-full ring-2 ring-black/20" style={{backgroundColor:hex}} /><span className="mt-1 block truncate text-[9px] text-slate-500">{name}</span></button>)}</div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2"><input type="color" value={appearance.customAccent} onChange={e=>setAppearance(p=>({...p,customAccent:e.target.value,accent:e.target.value}))} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Custom accent colour" /><input value={appearance.customAccent} onChange={e=>{const value=e.target.value; setAppearance(p=>({...p,customAccent:value,accent:/^#[0-9a-fA-F]{6}$/.test(value)?value:p.accent}))}} placeholder="#3b82f6" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" /><span className="text-[10px] text-slate-500">Custom</span></div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Smartphone className="h-4 w-4" /> Layout density</div>
                <ChoiceRow value={appearance.density} onChange={density=>setAppearance(p=>({...p,density}))} options={[['COMFORTABLE','Comfortable'],['COMPACT','Compact']]} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-200"><Sparkles className="h-4 w-4" /> Text size</div>
                <ChoiceRow value={appearance.fontScale} onChange={fontScale=>setAppearance(p=>({...p,fontScale}))} options={[['SMALL','Small'],['DEFAULT','Default'],['LARGE','Large'],['XLARGE','Extra large']]} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ToggleRow label="Reduce motion" description="Minimise UI animations." checked={appearance.reducedMotion} onChange={value=>setAppearance(p=>({...p,reducedMotion:value}))} />
                <ToggleRow label="AMOLED black" description="Use true black surfaces in dark mode." checked={appearance.amoled} onChange={value=>setAppearance(p=>({...p,amoled:value}))} />
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-500">Theme, accent, spacing and accessibility preferences apply across the app immediately and persist between launches.</div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-emerald-400" /><div><h3 className="text-sm font-bold text-white">Trusted Circle</h3><p className="text-xs text-slate-500">Saved contacts are always trusted. Add important numbers that are not saved yet.</p></div></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex gap-2"><input value={trustedInput} onChange={e=>setTrustedInput(e.target.value)} placeholder="Phone number" inputMode="tel" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-blue-500" /><button onClick={addTrusted} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Add trusted</button></div><div className="mt-3 flex flex-wrap gap-2">{trustedNumbers.length===0 ? <span className="text-xs text-slate-500">No extra trusted numbers.</span> : trustedNumbers.map(n=><button key={n} onClick={()=>setTrustedNumbers(p=>p.filter(x=>x!==n))} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">{n} ×</button>)}</div></div>
          </section>

          <section className="space-y-3"><div className="flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-400" /><div><h3 className="text-sm font-bold text-white">Smart Silent Mode</h3><p className="text-xs text-slate-500">Keep important calls audible while reducing interruptions.</p></div></div><ChoiceRow value={silentMode} onChange={setSilentMode} options={[['OFF','Off'],['UNKNOWN_ONLY','Unknown callers'],['UNKNOWN_AND_SPAM','Unknown + spam']]} /></section>
          <section className="space-y-3"><div className="flex items-center gap-2"><VolumeX className="h-4 w-4 text-amber-400" /><div><h3 className="text-sm font-bold text-white">Smart Spam Quieting</h3><p className="text-xs text-slate-500">Choose whether suspicious calls warn, silence, or reject at high confidence.</p></div></div><ChoiceRow value={spamQuietMode} onChange={setSpamQuietMode} options={[['WARN','Warn only'],['SILENCE','Silence spam'],['REJECT_HIGH_RISK','Reject high risk']]} /></section>

          <section className="space-y-3"><div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-blue-400" /><div><h3 className="text-sm font-bold text-white">Call Priority & Risk</h3><p className="text-xs text-slate-500">Every caller is ranked using the existing Safe / Unknown / Suspicious / High Risk model.</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['SAFE','Safe'],['UNKNOWN','Unknown'],['SUSPICIOUS','Suspicious'],['HIGH_RISK','High risk']].map(([id,label])=><div key={id} className="rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="text-[11px] font-bold text-white">{label}</div><div className="mt-1 text-[10px] text-slate-500">{id==='HIGH_RISK'?'Urgent attention':id==='SUSPICIOUS'?'Review carefully':id==='UNKNOWN'?'Needs context':'Normal priority'}</div></div>)}</div><div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">Current sensitivity: <span className="font-bold text-slate-200">{settings.sensitivity}</span> · {riskDescription}</div></section>

          <section className="space-y-3"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-cyan-400" /><div><h3 className="text-sm font-bold text-white">Callback Reminders</h3><p className="text-xs text-slate-500">Keep a local follow-up queue after missed or unfinished calls.</p></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input value={reminderNumber} onChange={e=>setReminderNumber(e.target.value)} placeholder="Number" inputMode="tel" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /><input value={reminderLabel} onChange={e=>setReminderLabel(e.target.value)} placeholder="Reason" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /><input value={reminderDue} onChange={e=>setReminderDue(e.target.value)} type="datetime-local" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" /></div><button onClick={addReminder} className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-600">Add callback reminder</button><div className="space-y-2">{reminders.length===0 ? <div className="text-xs text-slate-500">No callback reminders.</div> : reminders.slice(0,5).map(r=><div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="min-w-0 flex-1"><div className="text-xs font-bold text-white">{r.label}</div><div className="text-[11px] text-slate-500">{r.number} · {new Date(r.dueAt).toLocaleString()}</div></div><button onClick={()=>setReminders(p=>p.filter(x=>x.id!==r.id))} className="text-[11px] font-bold text-slate-400 hover:text-white">Done</button></div>)}</div></section>

          <section className="space-y-3"><div className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-slate-300" /><div><h3 className="text-sm font-bold text-white">Unknown Caller Handling</h3><p className="text-xs text-slate-500">A separate choice from spam protection, so normal unknown calls are not automatically treated as scams.</p></div></div><ChoiceRow value={unknownMode} onChange={setUnknownMode} options={[['ALLOW','Allow'],['SILENCE','Silence'],['REJECT','Reject']]} /></section>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm font-bold text-white">Protection status</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniStatus label="Shield" on={settings.masterEnabled} /><MiniStatus label="Trusted Circle" on={trustedNumbers.length>0} /><MiniStatus label="Smart Silent" on={silentMode!=='OFF'} /><MiniStatus label="Spam quieting" on={spamQuietMode!=='WARN'} /></div></div>
        </div>
      </section>
    </div>
  );
}

function ChoiceRow<T extends string>({ value, onChange, options }: { value:T; onChange:(v:T)=>void; options: readonly (readonly [T,string])[] }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{options.map(([id,label])=><button key={id} onClick={()=>onChange(id)} className={`rounded-xl border px-3 py-2.5 text-left transition ${value===id?'border-blue-500/50 bg-blue-500/10 text-white':'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}><div className="text-xs font-bold">{label}</div><div className="mt-0.5 text-[10px] text-slate-500">{id===value?'Selected':'Tap to choose'}</div></button>)}</div>;
}

function ToggleRow({ label, description, checked, onChange }: { label:string; description:string; checked:boolean; onChange:(value:boolean)=>void }) {
  return <button type="button" onClick={()=>onChange(!checked)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left"><div className="min-w-0"><div className="text-xs font-bold text-white">{label}</div><div className="mt-1 text-[10px] text-slate-500">{description}</div></div><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked?'bg-blue-600':'bg-slate-700'}`} aria-hidden="true"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked?'left-6':'left-1'}`} /></span></button>;
}

function StatusRow({ icon, title, description, status, action }: { icon: ReactNode; title: string; description: string; status: LiveState; action?: ReactNode }) {
  const positive = status === 'ON' || status === 'AVAILABLE';
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{positive ? <CheckCircle2 className="h-4 w-4" /> : icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${positive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{status}</span>{action}</div></div>;
}

function MiniStatus({ label, on }: { label: string; on: boolean }) { return <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className={`mt-1 text-xs font-bold ${on ? 'text-emerald-400' : 'text-slate-500'}`}>{on ? 'Active' : 'Off'}</div></div>; }

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(59,130,246,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

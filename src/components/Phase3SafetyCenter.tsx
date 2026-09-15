import { useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, BellRing, Car, CheckCircle2, Download, Eye, FileJson, LifeBuoy, LockKeyhole, MessageSquareWarning, Palette, Plus, RotateCcw, ShieldAlert, Trash2, Upload, Volume2 } from 'lucide-react';
import { telecomBridge } from '../services/telephony/telecomBridge';

const PREF_KEY = 'vigilshield_phase3_safety_v1';
const SECURITY_KEY = 'vigilshield_security_center_v1';
const MAX_CONTACTS = 10;

type SafetyPrefs = { emergencyContacts: string[]; emergencyMode: boolean; drivingMode: boolean; repeatedCallAttention: boolean };
type SecurityPrefs = { privacyLockScreen: boolean; highContrast: boolean; reducedMotion: boolean; largeText: boolean; notifications: boolean; notificationVibration: boolean; callAlerts: boolean; sim1Protection: boolean; sim2Protection: boolean };

const DEFAULTS: SafetyPrefs = { emergencyContacts: [], emergencyMode: false, drivingMode: false, repeatedCallAttention: true };
const SECURITY_DEFAULTS: SecurityPrefs = { privacyLockScreen: true, highContrast: false, reducedMotion: false, largeText: false, notifications: true, notificationVibration: true, callAlerts: true, sim1Protection: true, sim2Protection: true };

function normalize(value: string) { return value.trim().replace(/[^\d+]/g, ''); }
function nativeContactKey(number: string) { return `phase3_emergency_contact_${number.replace(/\D/g, '')}`; }

export default function Phase3SafetyCenter() {
  const [prefs, setPrefs] = useState<SafetyPrefs>(DEFAULTS);
  const [security, setSecurity] = useState<SecurityPrefs>(SECURITY_DEFAULTS);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      const contacts = Array.isArray(saved.emergencyContacts) ? saved.emergencyContacts.map(normalize).filter(Boolean).slice(0, MAX_CONTACTS) : [];
      setPrefs({ emergencyContacts: Array.from(new Set(contacts)), emergencyMode: saved.emergencyMode === true, drivingMode: saved.drivingMode === true, repeatedCallAttention: saved.repeatedCallAttention !== false });
      const savedSecurity = JSON.parse(localStorage.getItem(SECURITY_KEY) || '{}');
      setSecurity({ ...SECURITY_DEFAULTS, ...savedSecurity });
    } catch { setPrefs(DEFAULTS); setSecurity(SECURITY_DEFAULTS); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    prefs.emergencyContacts.forEach(number => telecomBridge.setSecuritySetting(nativeContactKey(number), true));
    telecomBridge.setSecuritySetting('phase3_emergency_mode_enabled', prefs.emergencyMode);
    telecomBridge.setSecuritySetting('phase3_driving_mode_enabled', prefs.drivingMode);
    telecomBridge.setSecuritySetting('phase3_repeated_call_attention_enabled', prefs.repeatedCallAttention);
  }, [prefs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(SECURITY_KEY, JSON.stringify(security));
    telecomBridge.setSecuritySetting('security_privacy_lock_screen', security.privacyLockScreen);
    telecomBridge.setSecuritySetting('security_high_contrast', security.highContrast);
    telecomBridge.setSecuritySetting('security_reduced_motion', security.reducedMotion);
    telecomBridge.setSecuritySetting('security_large_text', security.largeText);
    telecomBridge.setSecuritySetting('security_notifications', security.notifications);
    telecomBridge.setSecuritySetting('security_notification_vibration', security.notificationVibration);
    telecomBridge.setSecuritySetting('security_call_alerts', security.callAlerts);
    telecomBridge.setSecuritySetting('security_sim1_protection', security.sim1Protection);
    telecomBridge.setSecuritySetting('security_sim2_protection', security.sim2Protection);
    document.documentElement.classList.toggle('vigilshield-high-contrast', security.highContrast);
    document.documentElement.classList.toggle('vigilshield-reduced-motion', security.reducedMotion);
    document.documentElement.classList.toggle('vigilshield-large-text', security.largeText);
  }, [security, loaded]);

  const emergencyCount = prefs.emergencyContacts.length;
  const canAdd = useMemo(() => { const number = normalize(input); return number.length >= 3 && !prefs.emergencyContacts.includes(number) && emergencyCount < MAX_CONTACTS; }, [input, prefs.emergencyContacts, emergencyCount]);

  const addContact = () => {
    const number = normalize(input);
    if (!number || number.length < 3) return;
    if (prefs.emergencyContacts.includes(number)) { setNotice('That number is already in your Emergency Circle.'); return; }
    if (emergencyCount >= MAX_CONTACTS) { setNotice(`You can keep up to ${MAX_CONTACTS} emergency contacts.`); return; }
    setPrefs(prev => ({ ...prev, emergencyContacts: [number, ...prev.emergencyContacts] })); setInput(''); setNotice('Emergency contact added.');
  };
  const removeContact = (number: string) => { telecomBridge.setSecuritySetting(nativeContactKey(number), false); setPrefs(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter(item => item !== number) })); };
  const toggle = (key: keyof SafetyPrefs, on: string, off: string) => { setPrefs(prev => ({ ...prev, [key]: !prev[key] })); setNotice(prefs[key] ? off : on); };
  const toggleSecurity = (key: keyof SecurityPrefs) => setSecurity(prev => ({ ...prev, [key]: !prev[key] }));

  const sendSafetyMessage = () => {
    if (emergencyCount === 0) { setNotice('Add at least one emergency contact first.'); return; }
    const body = encodeURIComponent("I'm Not Safe. Please call me and check on me. This message was prepared by VigilShield.");
    window.location.href = `sms:${prefs.emergencyContacts.join(',')}?body=${body}`;
  };

  const exportBackup = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), safety: prefs, security, settings: localStorage.getItem('vigilshield_settings'), rules: localStorage.getItem('vigilshield_rules'), whitelist: localStorage.getItem('vigilshield_whitelist'), contexts: localStorage.getItem('vigilshield_call_context_v1'), notes: localStorage.getItem('vigilshield_call_notes_v1') };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `vigilshield-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); setNotice('Encrypted storage is not used here: backup is a local JSON export. Protect the file like personal data.');
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.safety) setPrefs({ ...DEFAULTS, ...data.safety });
      if (data?.security) setSecurity({ ...SECURITY_DEFAULTS, ...data.security });
      const map: Record<string, string | undefined> = { vigilshield_settings: data.settings, vigilshield_rules: data.rules, vigilshield_whitelist: data.whitelist, vigilshield_call_context_v1: data.contexts, vigilshield_call_notes_v1: data.notes };
      Object.entries(map).forEach(([key, value]) => { if (typeof value === 'string') localStorage.setItem(key, value); });
      setNotice('Backup restored. Existing local settings were replaced only for included sections.');
    } catch { setNotice('Backup could not be read. No settings were changed.'); }
    event.target.value = '';
  };

  return (
    <section className="space-y-4 rounded-3xl border border-rose-500/20 bg-slate-950 p-4 shadow-xl sm:p-5">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300"><LifeBuoy className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="text-base font-extrabold text-white">Safety & Security Center</h2><p className="mt-1 text-xs leading-5 text-slate-400">Emergency controls, accessibility, notification preferences, privacy safeguards and portable personal rules.</p></div></div>

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-300" /><div className="text-sm font-bold text-white">Emergency Circle</div><span className="ml-auto text-[10px] font-black text-rose-300">{emergencyCount}/{MAX_CONTACTS}</span></div>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">Emergency contacts always bypass automated silence/reject policies and are stored locally on this device.</p>
        <div className="mt-3 flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && canAdd) addContact(); }} placeholder="Emergency phone number" inputMode="tel" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-rose-400" /><button type="button" disabled={!canAdd} onClick={addContact} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Add</button></div>
        <div className="mt-3 space-y-2">{prefs.emergencyContacts.length === 0 ? <div className="text-xs text-slate-500">No emergency contacts configured.</div> : prefs.emergencyContacts.map(number => <div key={number} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="min-w-0 flex-1 text-xs font-semibold text-white">{number}</span><button type="button" onClick={() => removeContact(number)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300" aria-label={`Remove ${number}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SafetyToggle icon={<ShieldAlert className="h-4 w-4" />} title="Emergency Mode" description="Allow incoming calls through automated blocking and quieting." enabled={prefs.emergencyMode} onClick={() => toggle('emergencyMode', 'Emergency Mode enabled.', 'Emergency Mode disabled.')} />
        <SafetyToggle icon={<Car className="h-4 w-4" />} title="Driving Mode" description="Silence unknown calls temporarily without rejecting them." enabled={prefs.drivingMode} onClick={() => toggle('drivingMode', 'Driving Mode enabled.', 'Driving Mode disabled.')} />
        <SafetyToggle icon={<BellRing className="h-4 w-4" />} title="Repeated-call attention" description="Highlight a non-trusted caller who calls again within 10 minutes." enabled={prefs.repeatedCallAttention} onClick={() => toggle('repeatedCallAttention', 'Repeated-call attention enabled.', 'Repeated-call attention disabled.')} />
      </div>

      <button type="button" onClick={sendSafetyMessage} className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left hover:bg-amber-500/15"><MessageSquareWarning className="h-5 w-5 shrink-0 text-amber-300" /><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-white">I'm Not Safe</span><span className="mt-0.5 block text-[11px] leading-5 text-slate-400">Opens your SMS app with a pre-filled message to your Emergency Circle. You remain in control of sending it.</span></span><span className="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-black text-slate-950">Message</span></button>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-extrabold text-white">Security Center</h3></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SecurityToggle icon={<Eye className="h-4 w-4" />} title="Privacy on lock screen" enabled={security.privacyLockScreen} onClick={() => toggleSecurity('privacyLockScreen')} />
          <SecurityToggle icon={<BellRing className="h-4 w-4" />} title="Security notifications" enabled={security.notifications} onClick={() => toggleSecurity('notifications')} />
          <SecurityToggle icon={<Volume2 className="h-4 w-4" />} title="Call alert vibration" enabled={security.notificationVibration} onClick={() => toggleSecurity('notificationVibration')} />
          <SecurityToggle icon={<ShieldAlert className="h-4 w-4" />} title="Incoming call alerts" enabled={security.callAlerts} onClick={() => toggleSecurity('callAlerts')} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2"><SimToggle label="SIM 1 protection" enabled={security.sim1Protection} onClick={() => toggleSecurity('sim1Protection')} /><SimToggle label="SIM 2 protection" enabled={security.sim2Protection} onClick={() => toggleSecurity('sim2Protection')} /></div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center gap-2"><Accessibility className="h-4 w-4 text-emerald-300" /><h3 className="text-sm font-extrabold text-white">Accessibility & motion</h3></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SecurityToggle icon={<Accessibility className="h-4 w-4" />} title="High contrast" enabled={security.highContrast} onClick={() => toggleSecurity('highContrast')} />
          <SecurityToggle icon={<Palette className="h-4 w-4" />} title="Large text" enabled={security.largeText} onClick={() => toggleSecurity('largeText')} />
          <SecurityToggle icon={<RotateCcw className="h-4 w-4" />} title="Reduced motion" enabled={security.reducedMotion} onClick={() => toggleSecurity('reducedMotion')} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center gap-2"><FileJson className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-extrabold text-white">Backup & migration</h3></div>
        <p className="mb-3 text-[11px] leading-5 text-slate-500">Export personal rules, safety preferences, call context and notes so upgrades or device migration do not erase your configuration.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={exportBackup} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"><Download className="h-3.5 w-3.5" />Export backup</button><button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200"><Upload className="h-3.5 w-3.5" />Import backup</button><input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} className="hidden" /></div>
      </div>

      {notice && <div role="status" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-400">{notice}</div>}
      <p className="text-[10px] leading-4 text-slate-600">Safety modes are device-local controls. VigilShield does not automatically dispatch police, ambulance, emergency services, or claim third-party caller verification without a legitimate data source.</p>
    </section>
  );
}

function SafetyToggle({ icon, title, description, enabled, onClick }: { icon: React.ReactNode; title: string; description: string; enabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}><div className="flex items-center justify-between"><span className={enabled ? 'text-emerald-400' : 'text-slate-500'}>{icon}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{enabled ? 'ON' : 'OFF'}</span></div><div className="mt-3 text-xs font-bold text-white">{title}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></button>;
}

function SecurityToggle({ icon, title, enabled, onClick }: { icon: React.ReactNode; title: string; enabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left"><span className={enabled ? 'text-cyan-300' : 'text-slate-600'}>{icon}</span><span className="min-w-0 flex-1 text-xs font-semibold text-white">{title}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{enabled ? 'ON' : 'OFF'}</span></button>;
}

function SimToggle({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white"><span>{label}</span><span className={enabled ? 'text-emerald-300' : 'text-slate-600'}>{enabled ? 'Protected' : 'Off'}</span></button>;
}

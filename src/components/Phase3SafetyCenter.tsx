import { useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, LifeBuoy, MessageSquareWarning, Plus, ShieldAlert, Trash2, BellRing } from 'lucide-react';
import { telecomBridge } from '../services/telephony/telecomBridge';

const PREF_KEY = 'vigilshield_phase3_safety_v1';
const MAX_CONTACTS = 10;

type SafetyPrefs = {
  emergencyContacts: string[];
  emergencyMode: boolean;
  drivingMode: boolean;
  repeatedCallAttention: boolean;
};

const DEFAULTS: SafetyPrefs = { emergencyContacts: [], emergencyMode: false, drivingMode: false, repeatedCallAttention: true };

function normalize(value: string) {
  return value.trim().replace(/[^\d+]/g, '');
}

function nativeContactKey(number: string) {
  return `phase3_emergency_contact_${number.replace(/\D/g, '')}`;
}

export default function Phase3SafetyCenter() {
  const [prefs, setPrefs] = useState<SafetyPrefs>(DEFAULTS);
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      const contacts = Array.isArray(saved.emergencyContacts)
        ? saved.emergencyContacts.map(normalize).filter(Boolean).slice(0, MAX_CONTACTS)
        : [];
      setPrefs({
        emergencyContacts: Array.from(new Set(contacts)),
        emergencyMode: saved.emergencyMode === true,
        drivingMode: saved.drivingMode === true,
        repeatedCallAttention: saved.repeatedCallAttention !== false,
      });
    } catch {
      setPrefs(DEFAULTS);
    }
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

  const emergencyCount = prefs.emergencyContacts.length;
  const canAdd = useMemo(() => {
    const number = normalize(input);
    return number.length >= 3 && !prefs.emergencyContacts.includes(number) && emergencyCount < MAX_CONTACTS;
  }, [input, prefs.emergencyContacts, emergencyCount]);

  const addContact = () => {
    const number = normalize(input);
    if (!number || number.length < 3) return;
    if (prefs.emergencyContacts.includes(number)) {
      setNotice('That number is already in your Emergency Circle.');
      return;
    }
    if (emergencyCount >= MAX_CONTACTS) {
      setNotice(`You can keep up to ${MAX_CONTACTS} emergency contacts.`);
      return;
    }
    setPrefs(prev => ({ ...prev, emergencyContacts: [number, ...prev.emergencyContacts] }));
    setInput('');
    setNotice('Emergency contact added.');
  };

  const removeContact = (number: string) => {
    telecomBridge.setSecuritySetting(nativeContactKey(number), false);
    setPrefs(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter(item => item !== number) }));
  };

  const toggleEmergencyMode = () => {
    setPrefs(prev => ({ ...prev, emergencyMode: !prev.emergencyMode }));
    setNotice(prefs.emergencyMode ? 'Emergency Mode disabled.' : 'Emergency Mode enabled: automated call quieting is bypassed.');
  };

  const toggleDrivingMode = () => {
    setPrefs(prev => ({ ...prev, drivingMode: !prev.drivingMode }));
    setNotice(prefs.drivingMode ? 'Driving Mode disabled.' : 'Driving Mode enabled: unknown calls are silenced, not rejected.');
  };

  const toggleRepeatedCallAttention = () => {
    setPrefs(prev => ({ ...prev, repeatedCallAttention: !prev.repeatedCallAttention }));
    setNotice(prefs.repeatedCallAttention ? 'Repeated-call attention disabled.' : 'Repeated-call attention enabled.');
  };

  const sendSafetyMessage = () => {
    if (emergencyCount === 0) {
      setNotice('Add at least one emergency contact first.');
      return;
    }
    const body = encodeURIComponent("I'm Not Safe. Please call me and check on me. This message was prepared by VigilShield.");
    const recipients = prefs.emergencyContacts.join(',');
    window.location.href = `sms:${recipients}?body=${body}`;
  };

  return (
    <section className="space-y-4 rounded-3xl border border-rose-500/20 bg-slate-950 p-4 shadow-xl sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300"><LifeBuoy className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold text-white">Emergency Center</h2><p className="mt-1 text-xs leading-5 text-slate-400">Keep trusted people reachable and use temporary safety modes without silently contacting emergency services.</p></div>
      </div>

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-300" /><div className="text-sm font-bold text-white">Emergency Circle</div><span className="ml-auto text-[10px] font-black text-rose-300">{emergencyCount}/{MAX_CONTACTS}</span></div>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">Emergency contacts always bypass VigilShield's automated silence/reject policies. They are stored locally on this device.</p>
        <div className="mt-3 flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && canAdd) addContact(); }} placeholder="Emergency phone number" inputMode="tel" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-rose-400" /><button type="button" disabled={!canAdd} onClick={addContact} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Add</button></div>
        <div className="mt-3 space-y-2">{prefs.emergencyContacts.length === 0 ? <div className="text-xs text-slate-500">No emergency contacts configured.</div> : prefs.emergencyContacts.map(number => <div key={number} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="min-w-0 flex-1 text-xs font-semibold text-white">{number}</span><button type="button" onClick={() => removeContact(number)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300" aria-label={`Remove ${number}`}><Trash2 className="h-4 w-4" /></button></div>)}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SafetyToggle icon={<ShieldAlert className="h-4 w-4" />} title="Emergency Mode" description="Allow incoming calls through automated blocking and quieting." enabled={prefs.emergencyMode} onClick={toggleEmergencyMode} />
        <SafetyToggle icon={<Car className="h-4 w-4" />} title="Driving Mode" description="Silence unknown calls temporarily without rejecting them." enabled={prefs.drivingMode} onClick={toggleDrivingMode} />
        <SafetyToggle icon={<BellRing className="h-4 w-4" />} title="Repeated-call attention" description="Highlight a non-trusted caller who calls again within 10 minutes." enabled={prefs.repeatedCallAttention} onClick={toggleRepeatedCallAttention} />
      </div>

      <button type="button" onClick={sendSafetyMessage} className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left hover:bg-amber-500/15"><MessageSquareWarning className="h-5 w-5 shrink-0 text-amber-300" /><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-white">I'm Not Safe</span><span className="mt-0.5 block text-[11px] leading-5 text-slate-400">Opens your SMS app with a pre-filled safety message to your Emergency Circle. You remain in control of sending it.</span></span><span className="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-black text-slate-950">Message</span></button>

      {notice && <div role="status" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-400">{notice}</div>}
      <p className="text-[10px] leading-4 text-slate-600">Safety modes are device-local controls. VigilShield does not automatically dispatch police, ambulance, or emergency services.</p>
    </section>
  );
}

function SafetyToggle({ icon, title, description, enabled, onClick }: { icon: React.ReactNode; title: string; description: string; enabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}><div className="flex items-center justify-between"><span className={enabled ? 'text-emerald-400' : 'text-slate-500'}>{icon}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{enabled ? 'ON' : 'OFF'}</span></div><div className="mt-3 text-xs font-bold text-white">{title}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></button>;
}

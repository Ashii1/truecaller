import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, ChevronDown, CircleUserRound, Clock3, FileText, HeartPulse, PackageCheck, Save, Sparkles, Wrench } from 'lucide-react';

export type CallContext = 'PERSONAL' | 'WORK' | 'DELIVERY' | 'HEALTHCARE' | 'FINANCE' | 'SERVICE' | 'OTHER';

interface CallContextCardProps {
  number: string;
  name?: string;
}

const STORAGE_KEY = 'vigilshield_call_context_v1';
const NOTE_KEY = 'vigilshield_call_notes_v1';
const OPTIONS: { id: CallContext; label: string; icon: typeof CircleUserRound }[] = [
  { id: 'PERSONAL', label: 'Personal', icon: CircleUserRound },
  { id: 'WORK', label: 'Work', icon: BriefcaseBusiness },
  { id: 'DELIVERY', label: 'Delivery', icon: PackageCheck },
  { id: 'HEALTHCARE', label: 'Healthcare', icon: HeartPulse },
  { id: 'FINANCE', label: 'Finance', icon: FileText },
  { id: 'SERVICE', label: 'Service', icon: Wrench },
  { id: 'OTHER', label: 'Other', icon: Clock3 },
];

function normalize(number: string): string { return number.replace(/\D/g, ''); }

function readObject(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

export default function CallContextCard({ number, name }: CallContextCardProps) {
  const key = normalize(number);
  const [context, setContext] = useState<CallContext | ''>('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [insights, setInsights] = useState({ calls: 0, missed: 0, totalSeconds: 0 });

  useEffect(() => {
    if (!key) return;
    const all = readObject(STORAGE_KEY);
    const value = all[key];
    if (OPTIONS.some(option => option.id === value)) setContext(value as CallContext);
    const notes = readObject(NOTE_KEY);
    if (typeof notes[key] === 'string') setNote(notes[key] as string);

    try {
      const calls = JSON.parse(localStorage.getItem('vigilshield_calls') || '[]');
      const matching = Array.isArray(calls) ? calls.filter((call: any) => normalize(String(call?.number || call?.phoneNumber || '')) === key) : [];
      setInsights({
        calls: matching.length,
        missed: matching.filter((call: any) => String(call?.type || call?.direction || '').toUpperCase().includes('MISSED')).length,
        totalSeconds: matching.reduce((sum: number, call: any) => sum + Number(call?.durationSeconds || call?.duration || 0), 0),
      });
    } catch { setInsights({ calls: 0, missed: 0, totalSeconds: 0 }); }
  }, [key]);

  const selected = useMemo(() => OPTIONS.find(option => option.id === context), [context]);

  const save = () => {
    if (!key) return;
    try {
      if (context) {
        const all = readObject(STORAGE_KEY); all[key] = context; localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
      const notes = readObject(NOTE_KEY);
      if (note.trim()) notes[key] = note.trim(); else delete notes[key];
      localStorage.setItem(NOTE_KEY, JSON.stringify(notes));
      setSaved(true); window.setTimeout(() => setSaved(false), 1600);
    } catch { /* keep the call flow usable if storage is unavailable */ }
  };

  const minutes = Math.floor(insights.totalSeconds / 60);
  const deliveryHint = /delivery|courier|parcel|package|shipment|logistics/i.test(`${name || ''} ${note}`);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          {selected ? <selected.icon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><div className="text-xs font-bold text-white">Call intelligence</div>{deliveryHint && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black text-amber-300">Delivery hint</span>}</div>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Private context, notes and device-local history. These labels do not claim an external caller identity or business verification.</p>
        </div>
      </div>

      {insights.calls > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Insight label="Calls" value={String(insights.calls)} />
          <Insight label="Missed" value={String(insights.missed)} />
          <Insight label="Talk time" value={minutes > 0 ? `${minutes}m` : '<1m'} />
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select value={context} onChange={event => setContext(event.target.value as CallContext | '')} className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 pr-9 text-xs font-semibold text-white outline-none focus:border-cyan-500" aria-label="Call context">
            <option value="">Choose context…</option>
            {OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Sparkles className="h-3.5 w-3.5" /> Private call note</div>
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={500} placeholder="Add a reminder for your next call…" className="w-full resize-none bg-transparent text-xs text-white outline-none placeholder:text-slate-600" />
      </div>

      <button type="button" onClick={save} disabled={!context && !note.trim()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">
        <Save className="h-3.5 w-3.5" /> {saved ? 'Saved privately' : 'Save call context'}
      </button>
    </section>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-2 py-2 text-center"><div className="text-sm font-black text-white">{value}</div><div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">{label}</div></div>;
}

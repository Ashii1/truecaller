import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, ChevronDown, CircleUserRound, Clock3, FileText, HeartPulse, PackageCheck, Save, Wrench } from 'lucide-react';

export type CallContext = 'PERSONAL' | 'WORK' | 'DELIVERY' | 'HEALTHCARE' | 'FINANCE' | 'SERVICE' | 'OTHER';

interface CallContextCardProps {
  number: string;
  name?: string;
}

const STORAGE_KEY = 'vigilshield_call_context_v1';
const OPTIONS: { id: CallContext; label: string; icon: typeof CircleUserRound }[] = [
  { id: 'PERSONAL', label: 'Personal', icon: CircleUserRound },
  { id: 'WORK', label: 'Work', icon: BriefcaseBusiness },
  { id: 'DELIVERY', label: 'Delivery', icon: PackageCheck },
  { id: 'HEALTHCARE', label: 'Healthcare', icon: HeartPulse },
  { id: 'FINANCE', label: 'Finance', icon: FileText },
  { id: 'SERVICE', label: 'Service', icon: Wrench },
  { id: 'OTHER', label: 'Other', icon: Clock3 },
];

function normalize(number: string): string {
  return number.replace(/\D/g, '');
}

export default function CallContextCard({ number, name }: CallContextCardProps) {
  const key = normalize(number);
  const [context, setContext] = useState<CallContext | ''>('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!key) return;
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const value = all[key];
      if (OPTIONS.some(option => option.id === value)) setContext(value);
    } catch {
      setContext('');
    }
  }, [key]);

  const selected = useMemo(() => OPTIONS.find(option => option.id === context), [context]);

  const save = () => {
    if (!key || !context) return;
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[key] = context;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      // Keep the call flow usable if local storage is unavailable.
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          {selected ? <selected.icon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white">Call context</div>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            Save your own context for {name || 'this caller'}. It stays on this device and does not claim caller identity.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            value={context}
            onChange={event => setContext(event.target.value as CallContext | '')}
            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 pr-9 text-xs font-semibold text-white outline-none focus:border-cyan-500"
            aria-label="Call context"
          >
            <option value="">Choose context…</option>
            {OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!context}
          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { Ban, ChevronRight, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, TruecallerDirectoryProfile } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';

interface RecentsTabProps {
  calls: CallLogItem[]; rules: BlockRule[]; whitelist: WhitelistEntry[]; settings: ShieldSettings;
  lookupProfile: (num: string) => TruecallerDirectoryProfile;
  onInitiateCall: (number: string, name?: string) => void;
  onSelectCall: (call: CallLogItem) => void;
  onBlockNumber: (number: string, label: string) => void;
  onWhitelistNumber: (number: string, name: string) => void;
  onDeleteCall: (id: string) => void;
  onClearAllCalls: () => void;
  onStartScreeningDemo?: (number: string, name: string) => void;
  onSyncDeviceCalls?: () => void;
}

type Filter = 'ALL' | 'MISSED' | 'INCOMING' | 'OUTGOING' | 'BLOCKED';
const iconFor = (type: CallDirection, spam: boolean) => type === 'BLOCKED_CANCELLED' ? <PhoneOff className="h-4 w-4 text-rose-400" /> : type === 'MISSED' ? <PhoneMissed className="h-4 w-4 text-amber-400" /> : type === 'OUTGOING' ? <PhoneOutgoing className="h-4 w-4 text-blue-400" /> : <PhoneIncoming className={`h-4 w-4 ${spam ? 'text-rose-400' : 'text-emerald-400'}`} />;
const dayLabel = (timestamp: number) => { const date = new Date(timestamp); const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1); if (date.toDateString() === today.toDateString()) return 'Today'; if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'; return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }); };
const timeLabel = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function RecentsTab({ calls, lookupProfile, onInitiateCall, onSelectCall, onBlockNumber, onDeleteCall, onClearAllCalls }: RecentsTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showMissedOnly, setShowMissedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return [...calls].sort((a, b) => b.timestamp - a.timestamp).filter(call => {
      if (showMissedOnly && call.type !== 'MISSED') return false;
      if (filter === 'MISSED' && call.type !== 'MISSED') return false;
      if (filter === 'INCOMING' && call.type !== 'INCOMING') return false;
      if (filter === 'OUTGOING' && call.type !== 'OUTGOING') return false;
      if (filter === 'BLOCKED' && call.type !== 'BLOCKED_CANCELLED') return false;
      if (!q) return true;
      const name = (call.callerName || '').toLowerCase();
      const number = call.number.replace(/\D/g, '');
      return name.includes(q) || (digits.length > 0 && number.includes(digits));
    });
  }, [calls, query, filter, showMissedOnly]);

  const missedCount = calls.filter(call => call.type === 'MISSED').length;
  return <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-4">
    <header className="mb-4 flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Recents</h1><p className="mt-1 text-sm text-slate-400">Automatically updated from your device call history.</p></div>{calls.length > 0 && <button onClick={onClearAllCalls} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400" aria-label="Clear call history"><Trash2 className="h-5 w-5" /></button>}</header>
    {missedCount > 0 && <button onClick={() => setShowMissedOnly(value => !value)} className={`mb-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${showMissedOnly ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-900'}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/10"><PhoneMissed className="h-4 w-4 text-amber-400" /></span><div><div className="text-sm font-semibold text-white">{missedCount} missed {missedCount === 1 ? 'call' : 'calls'}</div><div className="text-xs text-slate-400">Tap to show only missed calls</div></div></div><ChevronRight className="h-4 w-4 text-slate-500" /></button>}
    <div className="mb-3 flex h-11 items-center rounded-2xl border border-slate-700 bg-slate-900 px-3"><Search className="mr-2 h-4 w-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or number" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500" />{query && <button onClick={() => setQuery('')} className="text-xs text-slate-500 hover:text-white">Clear</button>}</div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{(['ALL','MISSED','INCOMING','OUTGOING','BLOCKED'] as Filter[]).map(value => <button key={value} onClick={() => { setFilter(value); setShowMissedOnly(false); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === value && !showMissedOnly ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}</button>)}</div>
    {filtered.length === 0 ? <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-500">{calls.length ? 'No calls match your search.' : 'No call history yet.'}</div> : <div className="space-y-4">{(Object.entries(filtered.reduce<Record<string, CallLogItem[]>>((groups, call) => { const key = dayLabel(call.timestamp); (groups[key] ||= []).push(call); return groups; }, {})) as [string, CallLogItem[]][]).map(([day, items]) => <section key={day}><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{day}</h2><div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">{items.map((call, index) => { const profile = lookupProfile(call.number); const resolvedName = call.callerName; const name = resolvedName && !/^unknown caller$/i.test(resolvedName) && resolvedName !== call.number ? resolvedName : (profile.name || call.number || 'Unknown caller'); const spam = !!call.isSpam || !!profile.isSpam; return <div key={`${call.id}-${index}`} className="flex items-center gap-3 border-b border-slate-800 px-3 py-3.5 last:border-0"><button onClick={() => onSelectCall(call)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800" aria-label="Open call details">{iconFor(call.type, spam)}</button><button onClick={() => onSelectCall(call)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><span className={`truncate text-sm font-semibold ${call.type === 'MISSED' ? 'text-amber-200' : 'text-white'}`}>{name}</span>{spam && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />}{call.isVerifiedBusiness && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-400" />}</div><div className="mt-0.5 truncate text-xs text-slate-400">{formatPhoneNumber(call.number)} · {timeLabel(call.timestamp)}{call.durationSeconds ? ` · ${call.durationSeconds}s` : ''}</div></button><div className="flex shrink-0 items-center gap-0.5"><button onClick={() => onInitiateCall(call.number, name)} className="rounded-full p-2.5 text-emerald-400 hover:bg-slate-800" aria-label="Call"><Phone className="h-5 w-5" /></button><button onClick={() => onBlockNumber(call.number, name)} className="hidden rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-rose-400 sm:block" aria-label="Block"><Ban className="h-4 w-4" /></button><button onClick={() => onDeleteCall(call.id)} className="rounded-full p-2 text-slate-600 hover:bg-slate-800 hover:text-slate-300" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div></div>; })}</div></section>)}</div>}
  </div>;
}

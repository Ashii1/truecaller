import { useMemo, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Search, ShieldAlert, ShieldCheck, Trash2, Ban } from 'lucide-react';
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

function icon(type: CallDirection, spam: boolean) {
  if (type === 'BLOCKED_CANCELLED') return <PhoneOff className="h-4 w-4 text-rose-400" />;
  if (type === 'MISSED') return <PhoneMissed className="h-4 w-4 text-amber-400" />;
  if (type === 'OUTGOING') return <PhoneOutgoing className="h-4 w-4 text-blue-400" />;
  return <PhoneIncoming className={`h-4 w-4 ${spam ? 'text-rose-400' : 'text-emerald-400'}`} />;
}
function timeLabel(ts: number) { const d=new Date(ts); const now=new Date(); return d.toDateString()===now.toDateString()?d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([], {day:'numeric',month:'short'}); }

export default function RecentsTab({ calls, lookupProfile, onInitiateCall, onSelectCall, onBlockNumber, onDeleteCall, onClearAllCalls }: RecentsTabProps) {
  const [query,setQuery]=useState(''); const [filter,setFilter]=useState<Filter>('ALL');
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase(); const qDigits=q.replace(/\D/g,'');
    return [...calls].sort((a,b)=>b.timestamp-a.timestamp).filter(c=>{
      if(filter==='MISSED'&&c.type!=='MISSED')return false;
      if(filter==='INCOMING'&&c.type!=='INCOMING')return false;
      if(filter==='OUTGOING'&&c.type!=='OUTGOING')return false;
      if(filter==='BLOCKED'&&c.type!=='BLOCKED_CANCELLED')return false;
      if(!q)return true;
      const name=(c.callerName||'').toLowerCase(); const num=c.number.replace(/\D/g,'');
      return name.includes(q)||(qDigits.length>0&&num.includes(qDigits));
    });
  },[calls,query,filter]);

  return <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-6">
    <div className="mb-4 flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white">Recents</h1><p className="mt-0.5 text-sm text-slate-400">Your device call history</p></div>{calls.length>0&&<button onClick={onClearAllCalls} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400" aria-label="Clear call history"><Trash2 className="h-5 w-5"/></button>}</div>
    <div className="mb-3 flex h-11 items-center rounded-2xl border border-slate-700 bg-slate-900 px-3"><Search className="mr-2 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or number" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"/></div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{(['ALL','MISSED','INCOMING','OUTGOING','BLOCKED'] as Filter[]).map(f=><button key={f} onClick={()=>setFilter(f)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter===f?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}>{f==='ALL'?'All':f.charAt(0)+f.slice(1).toLowerCase()}</button>)}</div>
    {filtered.length===0?<div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-500">{calls.length?'No calls match your search.':'No call history yet.'}</div>:<div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">{filtered.map((call,index)=>{const p=lookupProfile(call.number);const name=call.callerName&&!/^unknown caller$/i.test(call.callerName)?call.callerName:(p.name||call.number||'Unknown caller');const spam=call.isSpam||p.isSpam;return <div key={`${call.id}-${index}`} className="flex items-center gap-3 border-b border-slate-800 px-3 py-3.5 last:border-0"><button onClick={()=>onSelectCall(call)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800" aria-label="Call details">{icon(call.type,spam)}</button><button onClick={()=>onSelectCall(call)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{name}</span>{spam&&<ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400"/>}{call.isVerifiedBusiness&&<ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-400"/>}</div><div className="mt-0.5 truncate text-xs text-slate-400">{formatPhoneNumber(call.number)} · {timeLabel(call.timestamp)}</div></button><div className="flex shrink-0 items-center gap-1"><button onClick={()=>onInitiateCall(call.number,name)} className="rounded-full p-2.5 text-emerald-400 hover:bg-slate-800" aria-label="Call"><Phone className="h-5 w-5"/></button><button onClick={()=>onBlockNumber(call.number,name)} className="rounded-full p-2.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400" aria-label="Block"><Ban className="h-4 w-4"/></button><button onClick={()=>onDeleteCall(call.id)} className="rounded-full p-2 text-slate-600 hover:bg-slate-800 hover:text-slate-300" aria-label="Delete"><Trash2 className="h-4 w-4"/></button></div></div>})}</div>}
  </div>;
}

import { useMemo, useState } from 'react';
import { Ban, ChevronRight, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Search, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, TruecallerDirectoryProfile } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { groupCallsByNumber, CallGroup } from '../utils/callHistory';
import { useI18n } from '../i18n/LanguageContext';

interface RecentsTabProps { calls: CallLogItem[]; rules: BlockRule[]; whitelist: WhitelistEntry[]; settings: ShieldSettings; lookupProfile: (num:string)=>TruecallerDirectoryProfile; onInitiateCall:(number:string,name?:string)=>void; onSelectCall:(call:CallLogItem)=>void; onBlockNumber:(number:string,label:string)=>void; onWhitelistNumber:(number:string,name:string)=>void; onDeleteCall:(id:string)=>void; onClearAllCalls:()=>void; onStartScreeningDemo?:(number:string,name:string)=>void; onSyncDeviceCalls?:()=>void; }
type Filter='ALL'|'MISSED'|'INCOMING'|'OUTGOING'|'BLOCKED';
const iconFor=(type:CallDirection)=>type==='BLOCKED_CANCELLED'?<PhoneOff className="h-4 w-4"/>:type==='MISSED'?<PhoneMissed className="h-4 w-4"/>:type==='OUTGOING'?<PhoneOutgoing className="h-4 w-4"/>:<PhoneIncoming className="h-4 w-4"/>;

export default function RecentsTab({calls,lookupProfile,onInitiateCall,onSelectCall,onBlockNumber,onDeleteCall,onClearAllCalls,onSyncDeviceCalls}:RecentsTabProps){
 const { t } = useI18n();
 const [query,setQuery]=useState(''); const [filter,setFilter]=useState<Filter>('ALL'); const [showMissed,setShowMissed]=useState(false);

 const dayLabel = (ts: number) => {
   const d = new Date(ts), today = new Date(), yesterday = new Date(today);
   yesterday.setDate(today.getDate() - 1);
   if (d.toDateString() === today.toDateString()) return t('today');
   if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
   return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
 };
 const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

 const filtered=useMemo(()=>{const q=query.trim().toLowerCase(),d=q.replace(/\D/g,'');return calls.filter(c=>{if(showMissed&&c.type!=='MISSED')return false;if(filter==='MISSED'&&c.type!=='MISSED')return false;if(filter==='INCOMING'&&c.type!=='INCOMING')return false;if(filter==='OUTGOING'&&c.type!=='OUTGOING')return false;if(filter==='BLOCKED'&&c.type!=='BLOCKED_CANCELLED')return false;if(!q)return true;return(c.callerName||'').toLowerCase().includes(q)||(d.length>0&&c.number.replace(/\D/g,'').includes(d))})},[calls,query,filter,showMissed]);
 const groups=useMemo<CallGroup[]>(()=>groupCallsByNumber(filtered),[filtered]); const missed=calls.filter(c=>c.type==='MISSED').length; const days=useMemo<Record<string,CallGroup[]>>(()=>groups.reduce<Record<string,CallGroup[]>>((m,g)=>{const key=dayLabel(g.latest.timestamp);if(!m[key])m[key]=[];m[key].push(g);return m},{}),[groups, t]);
 const dayEntries=useMemo(()=>Object.entries(days),[days]);

 const filterLabel = (v: Filter) => {
   if (v === 'ALL') return t('filter_all');
   if (v === 'MISSED') return t('filter_missed');
   if (v === 'INCOMING') return t('filter_incoming');
   if (v === 'OUTGOING') return t('filter_outgoing');
   return t('filter_blocked');
 };

 return <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-5 sm:px-6">
  <header className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">{t('recents_history')}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{t('recents_title')}</h1><p className="mt-1 text-sm text-slate-500">{t('recents_subtitle')}</p></div>{calls.length>0&&<button onClick={onClearAllCalls} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-slate-400 hover:text-rose-400" title={t('clear_all')}><Trash2 className="h-4 w-4"/></button>}</header>
  {missed>0&&<button onClick={()=>setShowMissed(v=>!v)} className={`mb-4 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${showMissed?'border-amber-400/30 bg-amber-400/10':'border-white/10 bg-[#10161d]'}`}><span className="grid h-10 w-10 place-items-center rounded-full bg-amber-400/10 text-amber-400"><PhoneMissed className="h-4 w-4"/></span><span className="min-w-0 flex-1"><b className="block text-sm text-white">{t('missed_calls_banner', { count: missed })}</b><span className="text-xs text-slate-500">{showMissed ? t('tap_to_show_all') : t('tap_to_view_missed')}</span></span><ChevronRight className="h-4 w-4 text-slate-600"/></button>}
  <div className="mb-3 flex h-12 items-center rounded-2xl border border-white/10 bg-[#10161d] px-3.5"><Search className="mr-2.5 h-4 w-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('search_calls')} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"/>{query&&<button onClick={()=>setQuery('')}><X className="h-4 w-4 text-slate-500"/></button>}</div>
  <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{(['ALL','MISSED','INCOMING','OUTGOING','BLOCKED'] as Filter[]).map(v=><button key={v} onClick={()=>{setFilter(v);setShowMissed(false)}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter===v&&!showMissed?'bg-white text-[#0a0f14]':'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{filterLabel(v)}</button>)}</div>
  {onSyncDeviceCalls&&<button onClick={onSyncDeviceCalls} className="mb-4 text-xs font-semibold text-blue-400">{t('sync_device_calls')}</button>}
  {groups.length===0?<div className="rounded-[28px] border border-white/10 bg-[#10161d] p-12 text-center"><Phone className="mx-auto h-8 w-8 text-slate-700"/><p className="mt-3 text-sm font-semibold text-slate-300">{calls.length?t('no_calls_match'):t('no_call_history')}</p><p className="mt-1 text-xs text-slate-600">{t('recent_calls_appear_here')}</p></div>:<div className="space-y-5">{dayEntries.map(([day,dayGroups])=><section key={day}><h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[.18em] text-slate-600">{day}</h2><div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#10161d]">{dayGroups.map(g=>{const p=lookupProfile(g.number),name=g.name&&g.name!==g.number&&!/^unknown caller$/i.test(g.name)?g.name:(p.name||g.number||t('unknown_caller')),spam=g.calls.some(c=>c.isSpam)||p.isSpam,latest=g.latest;return <div key={g.key} className="group flex items-center gap-3 border-b border-white/5 px-3 py-3.5 last:border-0"><button onClick={()=>onSelectCall(latest)} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${g.missedCount?'bg-amber-400/10 text-amber-400':spam?'bg-rose-400/10 text-rose-400':'bg-white/5 text-slate-400'}`}>{iconFor(latest.type)}</button><button onClick={()=>onSelectCall(latest)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-1.5"><span className={`truncate text-[15px] font-semibold ${g.missedCount?'text-amber-200':'text-white'}`}>{name}</span>{spam?(<span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300"><ShieldAlert className="h-3 w-3 text-rose-400"/>{t('spam_badge')}</span>):(latest.isVerifiedBusiness||p.isVerified)?(<span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300"><ShieldCheck className="h-3 w-3 text-blue-400"/>{t('verified_badge')}</span>):(<span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3 text-emerald-400"/>{t('safe_badge')}</span>)}</div><div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400"><span className="font-mono">{formatPhoneNumber(g.number)}</span><span>·</span><span>{p.location||'India'}</span><span>·</span><span>{g.totalCount} {g.totalCount===1?t('call'):t('calls')}</span><span>·</span><span>{timeLabel(latest.timestamp)}</span></div>{g.missedCount>0&&<div className="mt-1 text-[11px] font-semibold text-amber-400">{g.missedCount} {t('missed')}</div>}</button><button onClick={()=>onInitiateCall(g.number,name)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" aria-label={t('nav_phone')}><Phone className="h-4 w-4 fill-current"/></button><button onClick={()=>onDeleteCall(latest.id)} className="hidden rounded-full p-2 text-slate-700 hover:text-rose-400 sm:block" title={t('delete')}><Trash2 className="h-4 w-4"/></button><button onClick={()=>onBlockNumber(g.number,name)} className="hidden rounded-full p-2 text-slate-700 hover:text-rose-400 sm:block" title={t('block')}><Ban className="h-4 w-4"/></button></div>})}</div></section>)}</div>}
 </div>;
}

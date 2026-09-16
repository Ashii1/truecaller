import { useMemo, useState } from 'react';
import {
  Ban,
  ChevronRight,
  Disc,
  ListFilter,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, TruecallerDirectoryProfile } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { groupCallsByNumber, CallGroup } from '../utils/callHistory';
import { useI18n } from '../i18n/LanguageContext';

interface RecentsTabProps {
  calls: CallLogItem[];
  rules: BlockRule[];
  whitelist: WhitelistEntry[];
  settings: ShieldSettings;
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

type Filter = 'ALL' | 'MISSED' | 'INCOMING' | 'OUTGOING' | 'RECORDED' | 'BLOCKED';

const iconFor = (type: CallDirection) =>
  type === 'BLOCKED_CANCELLED' ? (
    <PhoneOff className="h-4 w-4" />
  ) : type === 'MISSED' ? (
    <PhoneMissed className="h-4 w-4" />
  ) : type === 'OUTGOING' ? (
    <PhoneOutgoing className="h-4 w-4" />
  ) : (
    <PhoneIncoming className="h-4 w-4" />
  );

export default function RecentsTab({
  calls,
  lookupProfile,
  onInitiateCall,
  onSelectCall,
  onBlockNumber,
  onDeleteCall,
  onClearAllCalls,
  onSyncDeviceCalls,
}: RecentsTabProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const dayLabel = (ts: number) => {
    const d = new Date(ts),
      today = new Date(),
      yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('today');
    if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const timeLabel = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const counts = useMemo(() => {
    return {
      ALL: calls.length,
      MISSED: calls.filter((c) => c.type === 'MISSED').length,
      INCOMING: calls.filter((c) => c.type === 'INCOMING').length,
      OUTGOING: calls.filter((c) => c.type === 'OUTGOING').length,
      RECORDED: calls.filter((c) => Boolean(c.recordingUri)).length,
      BLOCKED: calls.filter((c) => c.type === 'BLOCKED_CANCELLED' || c.isSpam).length,
    };
  }, [calls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(),
      d = q.replace(/\D/g, '');
    return calls.filter((c) => {
      if (filter === 'MISSED' && c.type !== 'MISSED') return false;
      if (filter === 'INCOMING' && c.type !== 'INCOMING') return false;
      if (filter === 'OUTGOING' && c.type !== 'OUTGOING') return false;
      if (filter === 'RECORDED' && !c.recordingUri) return false;
      if (filter === 'BLOCKED' && c.type !== 'BLOCKED_CANCELLED' && !c.isSpam) return false;
      if (!q) return true;
      return (
        (c.callerName || '').toLowerCase().includes(q) ||
        (d.length > 0 && c.number.replace(/\D/g, '').includes(d))
      );
    });
  }, [calls, query, filter]);

  const groups = useMemo<CallGroup[]>(() => groupCallsByNumber(filtered), [filtered]);
  const days = useMemo<Record<string, CallGroup[]>>(
    () =>
      groups.reduce<Record<string, CallGroup[]>>((m, g) => {
        const key = dayLabel(g.latest.timestamp);
        if (!m[key]) m[key] = [];
        m[key].push(g);
        return m;
      }, {}),
    [groups, t],
  );
  const dayEntries = useMemo(() => Object.entries(days), [days]);

  const filterTabs: { id: Filter; label: string; icon: typeof ListFilter }[] = [
    { id: 'ALL', label: t('filter_all'), icon: ListFilter },
    { id: 'MISSED', label: t('filter_missed'), icon: PhoneMissed },
    { id: 'INCOMING', label: t('filter_incoming'), icon: PhoneIncoming },
    { id: 'OUTGOING', label: t('filter_outgoing'), icon: PhoneOutgoing },
    { id: 'RECORDED', label: 'Recorded', icon: Disc },
    { id: 'BLOCKED', label: t('filter_blocked'), icon: PhoneOff },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-8 pt-2 sm:px-4 select-none">
      {/* Header */}
      <header className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{t('recents_history')}</p>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('recents_title')}</h1>
          <p className="text-xs text-slate-500">{t('recents_subtitle')}</p>
        </div>
        {calls.length > 0 && (
          <button
            type="button"
            onClick={onClearAllCalls}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
            title={t('clear_all')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Search Input */}
      <div className="mb-2.5 flex h-10 items-center rounded-xl border border-white/10 bg-[#0e141c] px-3 shadow-inner shadow-black/20 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
        <Search className="mr-2 h-3.5 w-3.5 text-slate-500 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_calls')}
          className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="p-1 text-slate-500 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Redesigned UI 9.5 Segmented Filter Tab Strip */}
      <div className="mb-3 rounded-2xl border border-white/10 bg-[#0e141c] p-1 shadow-lg shadow-black/20">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {filterTabs.map(({ id, label, icon: Icon }) => {
            const active = filter === id;
            const count = counts[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`group relative flex flex-1 min-w-[68px] sm:min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_2px_12px_rgba(16,185,129,0.35)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    active
                      ? 'text-slate-950 stroke-[2.5]'
                      : id === 'MISSED' && count > 0
                      ? 'text-amber-400'
                      : id === 'BLOCKED' && count > 0
                      ? 'text-rose-400'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none shrink-0 ${
                      active
                        ? 'bg-slate-950/25 text-slate-950'
                        : id === 'MISSED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : id === 'BLOCKED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {onSyncDeviceCalls && (
        <button
          type="button"
          onClick={onSyncDeviceCalls}
          className="mb-3 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
        >
          {t('sync_device_calls')}
        </button>
      )}

      {/* Call History List */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0e141c] p-8 text-center">
          <Phone className="mx-auto h-7 w-7 text-slate-700" />
          <p className="mt-2 text-xs font-semibold text-slate-300">
            {calls.length ? t('no_calls_match') : t('no_call_history')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">{t('recent_calls_appear_here')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dayEntries.map(([day, dayGroups]) => (
            <section key={day}>
              <h2 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">{day}</h2>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e141c]">
                {dayGroups.map((g) => {
                  const p = lookupProfile(g.number),
                    name =
                      g.name && g.name !== g.number && !/^unknown caller$/i.test(g.name)
                        ? g.name
                        : p.name || g.number || t('unknown_caller'),
                    spam = g.calls.some((c) => c.isSpam) || p.isSpam,
                    latest = g.latest;
                  return (
                    <div
                      key={g.key}
                      className="group flex items-center gap-2.5 border-b border-white/5 px-3 py-2.5 last:border-0 hover:bg-white/[0.02] transition"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectCall(latest)}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          g.missedCount
                            ? 'bg-amber-400/10 text-amber-400'
                            : spam
                            ? 'bg-rose-400/10 text-rose-400'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {iconFor(latest.type)}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectCall(latest)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`truncate text-sm font-semibold ${
                              g.missedCount ? 'text-amber-200' : 'text-white'
                            }`}
                          >
                            {name}
                          </span>
                          {spam ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                              <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
                              {t('spam_badge')}
                            </span>
                          ) : latest.isVerifiedBusiness || p.isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                              <ShieldCheck className="h-2.5 w-2.5 text-blue-400" />
                              {t('verified_badge')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                              <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                              {t('safe_badge')}
                            </span>
                          )}
                          {g.calls.some((c) => Boolean(c.recordingUri)) && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                              <Disc className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                              REC
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400">
                          <span className="font-mono">{formatPhoneNumber(g.number)}</span>
                          <span>·</span>
                          <span>{p.location || 'India'}</span>
                          <span>·</span>
                          <span>
                            {g.totalCount} {g.totalCount === 1 ? t('call') : t('calls')}
                          </span>
                          <span>·</span>
                          <span>{timeLabel(latest.timestamp)}</span>
                        </div>
                        {g.missedCount > 0 && (
                          <div className="mt-0.5 text-[10px] font-semibold text-amber-400">
                            {g.missedCount} {t('missed')}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onInitiateCall(g.number, name)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                        aria-label={t('nav_phone')}
                      >
                        <Phone className="h-3.5 w-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCall(latest.id)}
                        className="hidden rounded-full p-1.5 text-slate-700 hover:text-rose-400 sm:block transition"
                        title={t('delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlockNumber(g.number, name)}
                        className="hidden rounded-full p-1.5 text-slate-700 hover:text-rose-400 sm:block transition"
                        title={t('block')}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

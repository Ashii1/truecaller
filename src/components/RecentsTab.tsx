import { memo, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  Disc,
  EyeOff,
  ListFilter,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, TruecallerDirectoryProfile, DisplayDensity } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { groupCallsByNumber, CallGroup } from '../utils/callHistory';
import { useI18n } from '../i18n/LanguageContext';
import ModernFilterBar, { FilterTabOption } from './ModernFilterBar';

interface RecentsTabProps {
  calls: CallLogItem[];
  rules: BlockRule[];
  whitelist: WhitelistEntry[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => TruecallerDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)', isPrivate?: boolean) => void;
  onSelectCall: (call: CallLogItem) => void;
  onBlockNumber: (number: string, label: string) => void;
  onWhitelistNumber: (number: string, name: string) => void;
  onDeleteCall: (id: string) => void;
  onClearAllCalls: () => void;
  onStartScreeningDemo?: (number: string, name: string) => void;
  onSyncDeviceCalls?: () => void;
  density?: DisplayDensity;
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

function RecentsTab({
  calls,
  settings,
  lookupProfile,
  onInitiateCall,
  onSelectCall,
  onBlockNumber,
  onDeleteCall,
  onClearAllCalls,
  onSyncDeviceCalls,
  density = 'comfortable',
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

  const filterTabs: FilterTabOption<Filter>[] = [
    { id: 'ALL', label: t('filter_all'), icon: ListFilter, count: counts.ALL, badgeVariant: 'default' },
    { id: 'MISSED', label: t('filter_missed'), icon: PhoneMissed, count: counts.MISSED, badgeVariant: 'missed' },
    { id: 'INCOMING', label: t('filter_incoming'), icon: PhoneIncoming, count: counts.INCOMING, badgeVariant: 'default' },
    { id: 'OUTGOING', label: t('filter_outgoing'), icon: PhoneOutgoing, count: counts.OUTGOING, badgeVariant: 'default' },
    { id: 'RECORDED', label: 'Recorded', icon: Disc, count: counts.RECORDED, badgeVariant: 'recorded' },
    { id: 'BLOCKED', label: t('filter_blocked'), icon: PhoneOff, count: counts.BLOCKED, badgeVariant: 'blocked' },
  ];

  const isCompact = density === 'compact';

  return (
    <div className={`mx-auto w-full max-w-2xl select-none transition-all ${isCompact ? 'px-2 pb-6 pt-1 sm:px-3' : 'px-3 pb-8 pt-2 sm:px-4'}`}>
      {/* Header */}
      <header className={`flex items-end justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <p className={`font-bold uppercase tracking-[.18em] text-slate-500 transition-all ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>{t('recents_history')}</p>
          <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('recents_title')}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {onSyncDeviceCalls && (
            <button
              type="button"
              onClick={onSyncDeviceCalls}
              className={`rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-blue-500/15 hover:text-blue-300 active:scale-95 transition ${isCompact ? 'p-1.5' : 'p-2'}`}
              title={t('sync_device_calls')}
              aria-label={t('sync_device_calls')}
            >
              <RefreshCw className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          )}
          {calls.length > 0 && (
            <button
              type="button"
              onClick={onClearAllCalls}
              className={`rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition ${isCompact ? 'p-1.5' : 'p-2'}`}
              title={t('clear_all')}
            >
              <Trash2 className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          )}
        </div>
      </header>

      {/* Search Input */}
      <div className={`flex items-center rounded-xl border border-white/10 bg-[#0e141c] shadow-inner shadow-black/20 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all ${isCompact ? 'mb-2 h-8.5 px-2.5' : 'mb-2.5 h-10 px-3'}`}>
        <Search className={`mr-2 text-slate-500 shrink-0 ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_calls')}
          className={`min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-slate-600 ${isCompact ? 'text-[11.5px]' : 'text-xs'}`}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="p-1 text-slate-500 hover:text-white">
            <X className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}
      </div>

      {/* Modern Filter Navigation Bar with full text, scroll chevrons & popover */}
      <ModernFilterBar<Filter>
        tabs={filterTabs}
        activeId={filter}
        onChange={setFilter}
      />

      {/* Call History List */}
      {groups.length === 0 ? (
        <div className={`border border-white/10 bg-[#0e141c] text-center transition-all ${isCompact ? 'rounded-xl p-6' : 'rounded-2xl p-8'}`}>
          <Phone className={`mx-auto text-slate-700 ${isCompact ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <p className={`font-semibold text-slate-300 ${isCompact ? 'mt-1.5 text-[11px]' : 'mt-2 text-xs'}`}>
            {calls.length ? t('no_calls_match') : t('no_call_history')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">{t('recent_calls_appear_here')}</p>
        </div>
      ) : (
        <div className={isCompact ? 'space-y-3' : 'space-y-4'}>
          {dayEntries.map(([day, dayGroups]) => (
            <section key={day}>
              <h2 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">{day}</h2>
              <div className={`overflow-hidden border border-white/10 bg-[#0e141c] transition-all ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
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
                      className={`group flex items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition ${isCompact ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-3 py-2.5'}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectCall(latest)}
                        className={`grid shrink-0 place-items-center rounded-full transition-all ${
                          isCompact ? 'h-7.5 w-7.5 text-xs' : 'h-9 w-9'
                        } ${
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
                            className={`truncate font-semibold transition-all ${
                              isCompact ? 'text-xs' : 'text-sm'
                            } ${
                              g.missedCount ? 'text-amber-200' : 'text-white'
                            }`}
                          >
                            {name}
                          </span>
                          {spam ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-300">
                              <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
                              {t('spam_badge')}
                            </span>
                          ) : latest.isVerifiedBusiness || p.isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-blue-300">
                              <ShieldCheck className="h-2.5 w-2.5 text-blue-400" />
                              {t('verified_badge')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                              <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                              {t('safe_badge')}
                            </span>
                          )}
                          {g.calls.some((c) => c.isNeighborSpoof) && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                              <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                              Neighbor Spoof
                            </span>
                          )}
                          {g.calls.some((c) => c.isPingBackScam) && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-300">
                              <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
                              1-Ring Trap
                            </span>
                          )}
                          {g.calls.some((c) => Boolean(c.recordingUri)) && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                              <Disc className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                              REC
                            </span>
                          )}
                        </div>
                        <div className={`flex flex-wrap items-center text-slate-400 transition-all ${isCompact ? 'mt-0 text-[10px] gap-x-1' : 'mt-0.5 text-[11px] gap-x-1.5'}`}>
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
                          <div className={`font-semibold text-amber-400 ${isCompact ? 'mt-0 text-[9.5px]' : 'mt-0.5 text-[10px]'}`}>
                            {g.missedCount} {t('missed')}
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onInitiateCall(g.number, name)}
                        className={`grid shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition ${isCompact ? 'h-7 w-7' : 'h-8 w-8'}`}
                        aria-label={t('nav_phone')}
                        title="Call"
                      >
                        <Phone className={`fill-current ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onInitiateCall(g.number, name, undefined, true)}
                        className={`grid shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition ${isCompact ? 'h-7 w-7' : 'h-8 w-8'}`}
                        aria-label="Call Privately (*67 Masked)"
                        title={`Call Privately (${settings?.privateCallPrefix || '*67'} Masked)`}
                      >
                        <EyeOff className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCall(latest.id)}
                        className="hidden rounded-full p-1.5 text-slate-700 hover:text-rose-400 sm:block transition"
                        title={t('delete')}
                      >
                        <Trash2 className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlockNumber(g.number, name)}
                        className="hidden rounded-full p-1.5 text-slate-700 hover:text-rose-400 sm:block transition"
                        title={t('block')}
                      >
                        <Ban className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
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

export default memo(RecentsTab);

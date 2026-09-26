import { memo, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Disc,
  Layers,
  ListFilter,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, CallShieldDirectoryProfile, DisplayDensity } from '../types';
import { groupCallsByNumber, CallGroup } from '../utils/callHistory';
import { useI18n } from '../i18n/LanguageContext';
import { formatTimeAmPm } from '../utils/timeFormat';
import ModernFilterBar, { FilterTabOption } from './ModernFilterBar';
import SwipeableCallItem from './SwipeableCallItem';

interface RecentsTabProps {
  calls: CallLogItem[];
  rules: BlockRule[];
  whitelist: WhitelistEntry[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)', isPrivate?: boolean) => void;
  onSelectCall: (call: CallLogItem) => void;
  onBlockNumber: (number: string, label: string) => void;
  onWhitelistNumber: (number: string, name: string) => void;
  onDeleteCall: (id: string) => void;
  onDeleteCalls?: (ids: string[]) => void;
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
  onDeleteCalls,
  onClearAllCalls,
  onSyncDeviceCalls,
  density = 'comfortable',
}: RecentsTabProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [simFilter, setSimFilter] = useState<'ALL' | 'SIM 1' | 'SIM 2'>('ALL');

  const handleDeleteCalls = (ids: string[]) => {
    if (onDeleteCalls) {
      onDeleteCalls(ids);
    } else {
      ids.forEach((id) => onDeleteCall(id));
    }
  };

  const dayLabel = (ts: number) => {
    const d = new Date(ts),
      today = new Date(),
      yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('today');
    if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const timeLabel = (ts: number) => formatTimeAmPm(ts);

  const isBlockedCall = (c: CallLogItem) =>
    c.type === 'BLOCKED_CANCELLED' || c.isSpam || c.userAction === 'BLOCKED' || c.classification === 'SPAM';

  const isRecordedCall = (c: CallLogItem) =>
    Boolean(c.recordingUri) || (typeof c.notes === 'string' && c.notes.trim().length > 0) || Boolean(c.usedAiScreener);

  const matchSim = (call: CallLogItem, targetSim: 'SIM 1' | 'SIM 2') => {
    const simStr = (call.sim || call.carrier || '').toLowerCase();
    if (targetSim === 'SIM 1') {
      return !call.sim || simStr.includes('sim 1') || simStr.includes('personal') || simStr.includes('slot 0') || (call as any).simSlot === 0;
    }
    return simStr.includes('sim 2') || simStr.includes('work') || simStr.includes('slot 1') || (call as any).simSlot === 1;
  };

  const counts = useMemo(() => {
    return {
      ALL: calls.length,
      MISSED: calls.filter((c) => c.type === 'MISSED').length,
      INCOMING: calls.filter((c) => c.type === 'INCOMING' || c.type === 'BLOCKED_CANCELLED').length,
      OUTGOING: calls.filter((c) => c.type === 'OUTGOING').length,
      RECORDED: calls.filter(isRecordedCall).length,
      BLOCKED: calls.filter(isBlockedCall).length,
    };
  }, [calls]);

  const simCounts = useMemo(() => {
    return {
      ALL: calls.length,
      SIM1: calls.filter((c) => matchSim(c, 'SIM 1')).length,
      SIM2: calls.filter((c) => matchSim(c, 'SIM 2')).length,
    };
  }, [calls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(),
      d = q.replace(/\D/g, '');
    return calls.filter((c) => {
      // SIM Filter
      if (simFilter === 'SIM 1' && !matchSim(c, 'SIM 1')) return false;
      if (simFilter === 'SIM 2' && !matchSim(c, 'SIM 2')) return false;

      // Type Filter
      if (filter === 'MISSED' && c.type !== 'MISSED') return false;
      if (filter === 'INCOMING' && c.type !== 'INCOMING' && c.type !== 'BLOCKED_CANCELLED') return false;
      if (filter === 'OUTGOING' && c.type !== 'OUTGOING') return false;
      if (filter === 'RECORDED' && !isRecordedCall(c)) return false;
      if (filter === 'BLOCKED' && !isBlockedCall(c)) return false;
      if (!q) return true;
      return (
        String(c.callerName ?? '').toLowerCase().includes(q) ||
        (d.length > 0 && c.number.replace(/\D/g, '').includes(d))
      );
    });
  }, [calls, query, filter, simFilter]);

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
    { id: 'ALL', label: t('filter_all') || 'All', icon: ListFilter, count: counts.ALL, badgeVariant: 'default' },
    { id: 'MISSED', label: t('filter_missed') || 'Missed', icon: PhoneMissed, count: counts.MISSED, badgeVariant: 'missed' },
    { id: 'INCOMING', label: t('filter_incoming') || 'Incoming', icon: PhoneIncoming, count: counts.INCOMING, badgeVariant: 'default' },
    { id: 'OUTGOING', label: t('filter_outgoing') || 'Outgoing', icon: PhoneOutgoing, count: counts.OUTGOING, badgeVariant: 'default' },
    { id: 'RECORDED', label: t('filter_recorded') || 'Recorded', icon: Disc, count: counts.RECORDED, badgeVariant: 'recorded' },
    { id: 'BLOCKED', label: t('filter_blocked') || 'Blocked', icon: PhoneOff, count: counts.BLOCKED, badgeVariant: 'blocked' },
  ];

  const isCompact = density === 'compact';

  return (
    <div className={`mx-auto w-full max-w-2xl select-none transition-all ${isCompact ? 'px-2 pb-6 pt-1 sm:px-3' : 'px-3 pb-8 pt-2 sm:px-4'}`}>
      {/* Header */}
      <header className={`flex items-end justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
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

      {/* Modern Hardware Line & SIM Switcher Dock */}
      <div className={`flex items-center gap-1.5 p-1 rounded-2xl bg-[#0c121b]/80 border border-white/[0.07] backdrop-blur-md overflow-x-auto no-scrollbar transition-all ${isCompact ? 'mb-2' : 'mb-2.5'}`}>
        <button
          type="button"
          onClick={() => setSimFilter('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
            simFilter === 'ALL'
              ? 'bg-slate-700/80 text-white shadow-sm ring-1 ring-white/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="h-3.5 w-3.5 opacity-80" />
          <span>All Lines</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
            simFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-slate-400'
          }`}>
            {simCounts.ALL}
          </span>
        </button>

        <div className="h-4 w-[1px] bg-white/[0.08] shrink-0" />

        <button
          type="button"
          onClick={() => setSimFilter('SIM 1')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
            simFilter === 'SIM 1'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          {/* Micro Hardware SIM 1 Icon */}
          <div className="relative flex items-center justify-center w-4 h-4.5 rounded-[3px] border border-emerald-400/50 bg-emerald-500/20 text-[9px] font-black text-emerald-400 shadow-xs">
            <span className="absolute -top-[1px] -right-[1px] w-1 h-1 bg-[#0c121b] rotate-45" />
            1
          </div>
          <span>SIM 1</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
            simFilter === 'SIM 1' ? 'bg-emerald-500/25 text-emerald-200' : 'bg-slate-800/80 text-slate-400'
          }`}>
            {simCounts.SIM1}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSimFilter('SIM 2')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
            simFilter === 'SIM 2'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/10 ring-1 ring-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          {/* Micro Hardware SIM 2 Icon */}
          <div className="relative flex items-center justify-center w-4 h-4.5 rounded-[3px] border border-sky-400/50 bg-sky-500/20 text-[9px] font-black text-sky-400 shadow-xs">
            <span className="absolute -top-[1px] -right-[1px] w-1 h-1 bg-[#0c121b] rotate-45" />
            2
          </div>
          <span>SIM 2</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
            simFilter === 'SIM 2' ? 'bg-sky-500/25 text-sky-200' : 'bg-slate-800/80 text-slate-400'
          }`}>
            {simCounts.SIM2}
          </span>
        </button>
      </div>

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
                <AnimatePresence initial={false}>
                  {dayGroups.map((g) => (
                    <SwipeableCallItem
                      key={g.key}
                      group={g}
                      profile={lookupProfile(g.number)}
                      settings={settings}
                      density={density}
                      isCompact={isCompact}
                      onSelectCall={onSelectCall}
                      onInitiateCall={onInitiateCall}
                      onDeleteCalls={handleDeleteCalls}
                      onBlockNumber={onBlockNumber}
                      iconFor={iconFor}
                      timeLabel={timeLabel}
                      t={t}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(RecentsTab);

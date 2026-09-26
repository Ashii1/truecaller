import { memo, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ChevronDown,
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
  Smartphone,
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
  const [showSimMenu, setShowSimMenu] = useState(false);

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
      <header className={`flex items-center justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('recents_title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Subtle SIM Filter Dropdown (Tucked away, uncluttered) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSimMenu((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                simFilter !== 'ALL'
                  ? 'bg-sky-500/20 text-sky-200 border-sky-500/40 ring-1 ring-sky-500/30'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="Filter calls by SIM Line"
            >
              <Smartphone className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>{simFilter === 'ALL' ? 'SIM' : simFilter}</span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300">
                {simFilter === 'ALL' ? simCounts.ALL : simFilter === 'SIM 1' ? simCounts.SIM1 : simCounts.SIM2}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showSimMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* SIM Selector Menu Popover */}
            {showSimMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSimMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl border border-white/15 bg-[#0e141c] p-1.5 shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filter by Cellular SIM
                  </div>
                  {[
                    { id: 'ALL' as const, label: 'All Lines', count: simCounts.ALL },
                    { id: 'SIM 1' as const, label: 'SIM 1 (Primary)', count: simCounts.SIM1 },
                    { id: 'SIM 2' as const, label: 'SIM 2 (Secondary)', count: simCounts.SIM2 },
                  ].map((s) => {
                    const isSelected = simFilter === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSimFilter(s.id);
                          setShowSimMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30 font-bold'
                            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span>{s.label}</span>
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isSelected ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {s.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {onSyncDeviceCalls && (
            <button
              type="button"
              onClick={onSyncDeviceCalls}
              className={`rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-blue-500/15 hover:text-blue-300 active:scale-95 transition ${isCompact ? 'p-1.5' : 'p-2'}`}
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
              className={`rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition ${isCompact ? 'p-1.5' : 'p-2'}`}
              title={t('clear_all')}
            >
              <Trash2 className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          )}
        </div>
      </header>

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

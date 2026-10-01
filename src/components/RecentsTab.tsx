import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckSquare,
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
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { CallLogItem, CallDirection, BlockRule, WhitelistEntry, ShieldSettings, CallShieldDirectoryProfile, DisplayDensity, ContactItem } from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { formatTimeAmPm } from '../utils/timeFormat';
import { formatPhoneNumber } from '../utils/spamEngine';
import { isGenericOrPhoneNumber } from '../utils/publicDirectory';
import { callRecordingService } from '../services/callRecordingService';
import { callNotesService } from '../services/callNotesService';
import ModernFilterBar, { FilterTabOption } from './ModernFilterBar';
import SwipeableCallItem from './SwipeableCallItem';
import GlobalSearchAutocomplete, { AutocompleteItem } from './common/GlobalSearchAutocomplete';

interface RecentsTabProps {
  calls: CallLogItem[];
  rules: BlockRule[];
  whitelist: WhitelistEntry[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  onSelectCall: (call: CallLogItem) => void;
  onBlockNumber: (number: string, label: string) => void;
  onWhitelistNumber: (number: string, name: string) => void;
  onDeleteCall: (id: string) => void;
  onDeleteCalls?: (ids: string[]) => void;
  onClearAllCalls: () => void;
  onStartScreeningDemo?: (number: string, name: string) => void;
  onSyncDeviceCalls?: () => void;
  density?: DisplayDensity;
  contacts?: ContactItem[];
  onAddContact?: (contact: Omit<ContactItem, 'id'>) => void;
  onAddContacts?: (contacts: Array<{ name: string; number: string }>) => void;
  onWhitelistNumbers?: (calls: CallLogItem[]) => void;
  showToast?: (text: string, type?: 'info' | 'error' | 'success', title?: string) => void;
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
  onWhitelistNumber,
  onDeleteCall,
  onDeleteCalls,
  onClearAllCalls,
  onSyncDeviceCalls,
  density = 'comfortable',
  contacts = [],
  onAddContact,
  onAddContacts,
  onWhitelistNumbers,
  showToast,
}: RecentsTabProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [simFilter, setSimFilter] = useState<'ALL' | 'SIM 1' | 'SIM 2'>('ALL');
  const [showSimMenu, setShowSimMenu] = useState(false);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    const handleBack = (e: any) => {
      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedCallIds(new Set());
        e.detail?.handled?.();
      }
    };
    window.addEventListener('callshield_back_request', handleBack);
    return () => window.removeEventListener('callshield_back_request', handleBack);
  }, [isSelectionMode]);

  const handleDeleteCalls = useCallback((ids: string[]) => {
    if (onDeleteCalls) {
      onDeleteCalls(ids);
    } else {
      ids.forEach((id) => onDeleteCall(id));
    }
  }, [onDeleteCalls, onDeleteCall]);

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
    Boolean(c.recordingUri) ||
    (typeof c.notes === 'string' && c.notes.trim().length > 0) ||
    Boolean(c.usedAiScreener) ||
    Boolean(callNotesService.getNoteForCall(c.id)) ||
    callRecordingService.isCallRecordingFinalizing(c.id);

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
      const prof = lookupProfile(c.number);
      const displayName = !isGenericOrPhoneNumber(c.callerName, c.number)
        ? c.callerName!
        : prof?.name || '';
      return (
        displayName.toLowerCase().includes(q) ||
        (d.length > 0 && c.number.replace(/\D/g, '').includes(d))
      );
    });
  }, [calls, query, filter, simFilter, lookupProfile]);

  // Authoritative Chronological Sort: ONE CALL = ONE COMPLETE HISTORY RECORD (Requirement 1, 4, 5)
  const sortedCalls = useMemo(() => {
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }, [filtered]);

  const days = useMemo<Record<string, CallLogItem[]>>(
    () =>
      sortedCalls.reduce<Record<string, CallLogItem[]>>((m, c) => {
        const key = dayLabel(c.timestamp);
        if (!m[key]) m[key] = [];
        m[key].push(c);
        return m;
      }, {}),
    [sortedCalls, t],
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

  const autocompleteItems: AutocompleteItem[] = useMemo(() => {
    const map = new Map<string, AutocompleteItem>();
    calls.forEach((c) => {
      const prof = lookupProfile(c.number);
      const displayName = !isGenericOrPhoneNumber(c.callerName, c.number)
        ? c.callerName!
        : prof?.name || c.number;
      const key = `${displayName}_${c.number}`;
      if (!map.has(key)) {
        map.set(key, {
          id: c.id,
          name: displayName,
          number: c.number,
          type: 'recent',
          isSpam: c.isSpam || prof?.isSpam,
          category: c.isSpam ? (c.spamCategory || 'SPAM') : c.type,
          timestamp: c.timestamp,
        });
      }
    });
    return Array.from(map.values());
  }, [calls, lookupProfile]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedCallIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPressSelect = useCallback((id: string) => {
    setIsSelectionMode(true);
    setSelectedCallIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedCallIds.size === sortedCalls.length && sortedCalls.length > 0) {
      setSelectedCallIds(new Set());
    } else {
      setSelectedCallIds(new Set(sortedCalls.map((c) => c.id)));
    }
  }, [selectedCallIds.size, sortedCalls]);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCallIds(new Set());
  }, []);

  // 1. Bulk Delete Action
  const handleBulkDelete = useCallback(() => {
    if (selectedCallIds.size === 0) return;
    const ids = Array.from(selectedCallIds);
    handleDeleteCalls(ids);
    if (showToast) {
      showToast(`Deleted ${ids.length} call${ids.length > 1 ? 's' : ''}`, 'info');
    }
    handleExitSelectionMode();
  }, [selectedCallIds, handleDeleteCalls, showToast, handleExitSelectionMode]);

  // 2. Bulk Mark as Safe Action
  const handleBulkMarkSafe = useCallback(() => {
    if (selectedCallIds.size === 0) return;
    const selectedCalls = calls.filter((c) => selectedCallIds.has(c.id));
    if (selectedCalls.length === 0) return;

    if (onWhitelistNumbers) {
      onWhitelistNumbers(selectedCalls);
    } else {
      const uniqueNumbers = new Set<string>();
      selectedCalls.forEach((c) => {
        if (!uniqueNumbers.has(c.number)) {
          uniqueNumbers.add(c.number);
          const prof = lookupProfile(c.number);
          const safeName = !isGenericOrPhoneNumber(c.callerName, c.number)
            ? c.callerName!
            : prof?.name || 'Trusted Caller';
          onWhitelistNumber(c.number, safeName);
        }
      });
      if (showToast) {
        showToast(`Marked ${uniqueNumbers.size} number${uniqueNumbers.size > 1 ? 's' : ''} as safe`, 'success');
      }
    }
    handleExitSelectionMode();
  }, [selectedCallIds, calls, onWhitelistNumbers, onWhitelistNumber, showToast, handleExitSelectionMode]);

  // 3. Bulk Add to Contacts Action
  const handleBulkAddToContacts = useCallback(() => {
    if (selectedCallIds.size === 0) return;
    const selectedCalls = calls.filter((c) => selectedCallIds.has(c.id));
    if (selectedCalls.length === 0) return;

    const itemsToAdd: Array<{ name: string; number: string }> = [];
    const seenDigits = new Set<string>();

    selectedCalls.forEach((c) => {
      const digits = c.number.replace(/\D/g, '');
      if (digits && !seenDigits.has(digits)) {
        seenDigits.add(digits);
        const prof = lookupProfile(c.number);
        const contactName = !isGenericOrPhoneNumber(c.callerName, c.number)
          ? c.callerName!
          : prof?.name || formatPhoneNumber(c.number);
        itemsToAdd.push({
          name: contactName,
          number: c.number,
        });
      }
    });

    if (onAddContacts) {
      onAddContacts(itemsToAdd);
    } else if (onAddContact) {
      let added = 0;
      itemsToAdd.forEach((item) => {
        onAddContact({
          name: item.name,
          number: item.number,
          accountType: 'SIM1',
          category: 'GENERAL',
          trusted: true,
          isFavorite: false,
        });
        added++;
      });
      if (showToast) {
        showToast(`Added ${added} contact${added > 1 ? 's' : ''}`, 'success');
      }
    }
    handleExitSelectionMode();
  }, [selectedCallIds, calls, onAddContacts, onAddContact, showToast, handleExitSelectionMode]);

  return (
    <div className={`mx-auto w-full max-w-2xl select-none transition-all ${isCompact ? 'px-2 pb-6 pt-1 sm:px-3' : 'px-3 pb-8 pt-2 sm:px-4'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between gap-2 transition-all ${isCompact ? 'mb-2.5' : 'mb-3.5'}`}>
        {isSelectionMode ? (
          <div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-blue-500/30 bg-blue-950/40 px-3 py-2 text-white animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm font-mono">
                {selectedCallIds.size}
              </span>
              <span className="text-xs font-bold tracking-tight">
                {selectedCallIds.size === 1 ? '1 call selected' : `${selectedCallIds.size} calls selected`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 active:scale-95 transition cursor-pointer min-h-[32px]"
              >
                {selectedCallIds.size === sortedCalls.length && sortedCalls.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={handleExitSelectionMode}
                className="rounded-lg bg-white/10 hover:bg-white/15 px-2.5 py-1 text-xs font-semibold text-white active:scale-95 transition cursor-pointer min-h-[32px]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('recents_title')}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Select Mode Toggle */}
              {calls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSelectionMode(true)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white active:scale-95 transition cursor-pointer"
                  title="Select multiple calls for bulk actions"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
                  <span>Select</span>
                </button>
              )}

              {/* Subtle SIM Filter Dropdown (Tucked away, uncluttered) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSimMenu((prev) => !prev)}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                    simFilter !== 'ALL'
                      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40 ring-1 ring-blue-500/30'
                      : 'bg-white/[0.05] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]'
                  }`}
                  title="Filter calls by SIM Line"
                >
                  <Smartphone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>{simFilter === 'ALL' ? 'SIM' : simFilter}</span>
                  <span className="text-[10px] font-mono tabular-nums font-bold text-slate-400">
                    {simFilter === 'ALL' ? simCounts.ALL : simFilter === 'SIM 1' ? simCounts.SIM1 : simCounts.SIM2}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showSimMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* SIM Selector Menu Popover */}
                {showSimMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSimMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-2xl border border-white/10 bg-[#0e1422] p-1.5 shadow-2xl shadow-black/80 backdrop-blur-2xl">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30 font-bold'
                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                          >
                            <span>{s.label}</span>
                            <span className="font-mono tabular-nums text-[10px] text-slate-400">
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
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-blue-500/15 hover:text-blue-300 active:scale-95 transition cursor-pointer"
                  title={t('sync_device_calls')}
                  aria-label={t('sync_device_calls')}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              {calls.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllCalls}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition cursor-pointer"
                  title={t('clear_all')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </header>

      {/* Global Search Bar with Live Autocomplete Filtering */}
      <GlobalSearchAutocomplete
        value={query}
        onChange={setQuery}
        placeholder={t('search_recents') || 'Search call history or enter number...'}
        items={autocompleteItems}
        onSelectItem={(item) => {
          setQuery(item.name || item.number);
          const found = calls.find((c) => c.id === item.id || c.number === item.number);
          if (found) onSelectCall(found);
        }}
        onInitiateCall={(num, nm) => onInitiateCall(num, nm)}
        density={density}
      />

      {/* Modern Filter Navigation Bar with full text, scroll chevrons & popover */}
      <ModernFilterBar<Filter>
        tabs={filterTabs}
        activeId={filter}
        onChange={setFilter}
      />

      {/* Call History List: Authoritative 1 Call = 1 History Entry */}
      {sortedCalls.length === 0 ? (
        <div className={`border border-white/[0.08] bg-[#0c121e]/80 text-center transition-all ${isCompact ? 'rounded-xl p-6' : 'rounded-2xl p-8'}`}>
          <Phone className={`mx-auto text-slate-600 ${isCompact ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <p className={`font-semibold text-slate-300 ${isCompact ? 'mt-1.5 text-[11px]' : 'mt-2 text-xs'}`}>
            {calls.length ? t('no_calls_match') : t('no_call_history')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{t('recent_calls_appear_here')}</p>
        </div>
      ) : (
        <div className={isCompact ? 'space-y-3.5' : 'space-y-4.5'}>
          {dayEntries.map(([day, dayCalls]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-tight text-slate-400">{day}</h2>
              <div className={`overflow-hidden border border-white/[0.08] bg-[#0c121e]/90 shadow-sm transition-all ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
                <AnimatePresence initial={false}>
                  {dayCalls.map((call) => (
                    <SwipeableCallItem
                      key={call.id}
                      call={call}
                      profile={lookupProfile(call.number)}
                      settings={settings}
                      density={density}
                      isCompact={isCompact}
                      onSelectCall={onSelectCall}
                      onInitiateCall={onInitiateCall}
                      onDeleteCall={onDeleteCall}
                      onDeleteCalls={handleDeleteCalls}
                      onBlockNumber={onBlockNumber}
                      iconFor={iconFor}
                      timeLabel={timeLabel}
                      t={t}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedCallIds.has(call.id)}
                      onToggleSelect={handleToggleSelect}
                      onLongPressSelect={handleLongPressSelect}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Slide-Up Action Drawer for Bulk Actions on Selected Calls */}
      <AnimatePresence>
        {selectedCallIds.size > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 90, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="fixed bottom-[4.85rem] sm:bottom-[5.25rem] left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-40 select-none pointer-events-auto"
          >
            <div className="relative rounded-2xl border border-white/15 bg-[#0a111f]/95 p-3.5 shadow-2xl shadow-black/90 backdrop-blur-2xl ring-1 ring-white/10">
              {/* Top Handle Pill */}
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/20" />

              {/* Drawer Header Info */}
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-500/25 text-xs font-bold font-mono text-blue-300 border border-blue-500/30">
                    {selectedCallIds.size}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white tracking-tight leading-tight">
                      {selectedCallIds.size === 1
                        ? '1 call selected'
                        : `${selectedCallIds.size} calls selected`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Simultaneous bulk actions
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
                  >
                    {selectedCallIds.size === sortedCalls.length && sortedCalls.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExitSelectionMode}
                    className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95 cursor-pointer"
                    aria-label="Close selection drawer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Bulk Actions Button Grid (Delete, Mark as Safe, Add to Contacts) */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Delete */}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 p-2.5 text-rose-300 hover:bg-rose-500/25 active:scale-95 transition cursor-pointer min-h-[58px]"
                  title="Delete selected calls from history"
                >
                  <Trash2 className="h-4 w-4 text-rose-400" />
                  <span className="text-[11px] font-bold">Delete</span>
                </button>

                {/* 2. Mark as Safe */}
                <button
                  type="button"
                  onClick={handleBulkMarkSafe}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2.5 text-emerald-300 hover:bg-emerald-500/25 active:scale-95 transition cursor-pointer min-h-[58px]"
                  title="Mark selected numbers as safe whitelist"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-[11px] font-bold">Mark Safe</span>
                </button>

                {/* 3. Add to Contacts */}
                <button
                  type="button"
                  onClick={handleBulkAddToContacts}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/15 p-2.5 text-blue-300 hover:bg-blue-500/25 active:scale-95 transition cursor-pointer min-h-[58px]"
                  title="Add selected numbers to contacts"
                >
                  <UserPlus className="h-4 w-4 text-blue-400" />
                  <span className="text-[11px] font-bold truncate max-w-full">Add Contacts</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(RecentsTab);


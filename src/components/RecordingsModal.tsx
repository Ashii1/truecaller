import React, { useState, useEffect, useMemo } from 'react';
import {
  Disc,
  Folder,
  Search,
  Calendar,
  Phone,
  Trash2,
  Download,
  Filter,
  X,
  AudioLines,
  RefreshCw,
  HardDrive,
  Clock,
  User,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { CallRecordingItem, CallLogItem, ContactItem } from '../types';
import { callRecordingService, DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';
import AudioRecordingPlayer from './AudioRecordingPlayer';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';

interface RecordingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts?: ContactItem[];
  calls?: CallLogItem[];
  onInitiateCall?: (number: string, name?: string) => void;
  onSelectCall?: (call: CallLogItem) => void;
}

export default function RecordingsModal({
  isOpen,
  onClose,
  contacts = [],
  calls = [],
  onInitiateCall,
  onSelectCall,
}: RecordingsModalProps) {
  const { t } = useI18n();
  const [recordings, setRecordings] = useState<CallRecordingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'OLDER'>('ALL');
  const [selectedNumber, setSelectedNumber] = useState<string>('ALL');
  const [downloadAllNotice, setDownloadAllNotice] = useState<string | null>(null);

  // Load recordings on mount and subscribe to service updates
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const list = await callRecordingService.getAllRecordings();
        if (isMounted) {
          setRecordings(list);
        }
      } catch (err) {
        console.error('[RecordingsModal] Error loading recordings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (isOpen) {
      loadData();
    }

    const unsubscribe = callRecordingService.subscribe((updated) => {
      if (isMounted) {
        setRecordings(updated);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  const handleRefresh = async () => {
    setIsLoading(true);
    const list = await callRecordingService.getAllRecordings();
    setRecordings(list);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    await callRecordingService.deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  // Helper to get contact display name for a given number
  const getCallerName = (number: string, fallback?: string): string => {
    const cleanNum = number.replace(/\D/g, '');
    const foundContact = contacts.find((c) => c.number.replace(/\D/g, '') === cleanNum);
    if (foundContact?.name) return foundContact.name;

    const foundCall = calls.find((c) => c.number.replace(/\D/g, '') === cleanNum && c.callerName);
    if (foundCall?.callerName && foundCall.callerName !== number) return foundCall.callerName;

    return fallback || formatPhoneNumber(number);
  };

  // Extract unique caller numbers for the number filter dropdown
  const uniqueNumbers = useMemo(() => {
    const map = new Map<string, { number: string; name: string; count: number }>();
    recordings.forEach((rec) => {
      const num = rec.number || 'Unknown';
      const clean = num.replace(/\D/g, '');
      const key = clean || num;
      const current = map.get(key);
      const name = getCallerName(num, rec.callerName);
      if (current) {
        current.count += 1;
      } else {
        map.set(key, { number: num, name, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [recordings, contacts, calls]);

  // Date categorizer
  const matchesDateFilter = (timestamp: number, filter: typeof dateFilter): boolean => {
    if (filter === 'ALL') return true;
    const itemDate = new Date(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (filter === 'TODAY') {
      return itemDate >= today;
    }
    if (filter === 'YESTERDAY') {
      return itemDate >= yesterday && itemDate < today;
    }
    if (filter === 'THIS_WEEK') {
      return itemDate >= weekAgo;
    }
    if (filter === 'OLDER') {
      return itemDate < weekAgo;
    }
    return true;
  };

  // Filtered recordings
  const filteredRecordings = useMemo(() => {
    return recordings.filter((rec) => {
      // 1. Text Search (number, callerName, fileName, folderPath)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const callerName = getCallerName(rec.number, rec.callerName).toLowerCase();
        const numberClean = rec.number.replace(/\D/g, '');
        const queryClean = query.replace(/\D/g, '');
        const matchText =
          callerName.includes(query) ||
          rec.number.toLowerCase().includes(query) ||
          (queryClean && numberClean.includes(queryClean)) ||
          rec.fileName.toLowerCase().includes(query) ||
          (rec.folderPath && rec.folderPath.toLowerCase().includes(query));
        if (!matchText) return false;
      }

      // 2. Specific Number Filter
      if (selectedNumber !== 'ALL') {
        const cleanRecNum = rec.number.replace(/\D/g, '');
        const cleanSelected = selectedNumber.replace(/\D/g, '');
        if (cleanRecNum !== cleanSelected && rec.number !== selectedNumber) {
          return false;
        }
      }

      // 3. Date Filter
      if (!matchesDateFilter(rec.timestamp, dateFilter)) {
        return false;
      }

      return true;
    });
  }, [recordings, searchQuery, selectedNumber, dateFilter, contacts, calls]);

  // Summary statistics
  const totalSizeBytes = useMemo(() => {
    return recordings.reduce((acc, r) => acc + (r.fileSizeBytes || 0), 0);
  }, [recordings]);

  const totalDurationSeconds = useMemo(() => {
    return recordings.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
  }, [recordings]);

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="recordings-panel-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-2xl max-h-[92vh] rounded-3xl border border-slate-800 bg-[#0b1017] shadow-2xl shadow-black overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#0e1520] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Disc className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {t('call_recordings_title')}
                </h2>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                  {recordings.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">
                {DEFAULT_RECORDINGS_FOLDER}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh recordings"
              className="rounded-xl border border-slate-800 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white active:scale-95 transition"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Storage & Quality Summary Banner */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800/60 bg-[#080d14] px-4 py-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <HardDrive className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <div className="truncate">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Total Size</span>
              <span className="font-semibold text-slate-200">{formatFileSize(totalSizeBytes)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <div className="truncate">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Total Time</span>
              <span className="font-semibold text-slate-200">{formatTotalTime(totalDurationSeconds)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <AudioLines className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="truncate">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Quality</span>
              <span className="font-semibold text-slate-200">48 kHz HD WAV</span>
            </div>
          </div>
        </div>

        {/* Filter Controls: Search & Number Dropdown & Date Chips */}
        <div className="border-b border-slate-800/80 bg-[#0c121b] p-3 sm:p-4 space-y-3">
          {/* Search Bar + Number Filter Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Search Input */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus-within:border-emerald-500/50">
              <Search className="h-4 w-4 text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('recordings_search_placeholder')}
                className="w-full bg-transparent text-slate-200 placeholder-slate-500 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-500 hover:text-white ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Caller / Number Dropdown */}
            <div className="relative">
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 pr-8 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500/50 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="ALL">
                  {t('recordings_all_numbers')} ({recordings.length})
                </option>
                {uniqueNumbers.map((item) => (
                  <option key={item.number} value={item.number}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Date Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
              <Calendar className="h-3 w-3" />
              Date:
            </span>
            {(
              [
                { id: 'ALL', label: t('recordings_filter_all_dates') },
                { id: 'TODAY', label: t('today') },
                { id: 'YESTERDAY', label: t('yesterday') },
                { id: 'THIS_WEEK', label: t('recordings_this_week') },
                { id: 'OLDER', label: t('recordings_older') },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
                  dateFilter === f.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recordings Content List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#080c12]">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400 mx-auto mb-2" />
              Loading call recordings from storage…
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
                <Disc className="h-6 w-6 text-slate-600" />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-300">
                {t('recordings_empty_title')}
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || selectedNumber !== 'ALL' || dateFilter !== 'ALL'
                  ? 'No recordings match your search or date filter. Try clearing filters.'
                  : t('recordings_empty_desc')}
              </p>
              {(searchQuery || selectedNumber !== 'ALL' || dateFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedNumber('ALL');
                    setDateFilter('ALL');
                  }}
                  className="mt-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            filteredRecordings.map((rec) => {
              const callerName = getCallerName(rec.number, rec.callerName);
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-slate-800/90 bg-[#0d141e] p-3 shadow-md space-y-2.5 transition hover:border-slate-700"
                >
                  {/* Caller Header Card */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {callerName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatPhoneNumber(rec.number)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>
                            {new Date(rec.timestamp).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            at{' '}
                            {new Date(rec.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action: Call back if handler provided */}
                    {onInitiateCall && rec.number && (
                      <button
                        type="button"
                        onClick={() => onInitiateCall(rec.number, callerName)}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/25 transition shrink-0"
                        title="Call this number"
                      >
                        <Phone className="h-3 w-3" />
                        <span className="hidden sm:inline">Call</span>
                      </button>
                    )}
                  </div>

                  {/* Built-in Audio Media Player */}
                  <AudioRecordingPlayer recording={rec} onDelete={handleDelete} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="border-t border-slate-800/80 bg-[#0e1520] px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">
            Showing <strong className="text-slate-300">{filteredRecordings.length}</strong> of{' '}
            <strong className="text-slate-300">{recordings.length}</strong> recording{recordings.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            {t('close_button')}
          </button>
        </div>
      </div>
    </div>
  );
}

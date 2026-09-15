import { useState, useMemo } from 'react';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  PhoneOff, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldBan, 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  ChevronRight, 
  Sparkles, 
  Radio, 
  Plus, 
  HelpCircle, 
  Check, 
  X,
  Volume2,
  Info
} from 'lucide-react';
import { 
  CallLogItem, 
  CallDirection, 
  BlockRule, 
  WhitelistEntry, 
  ShieldSettings, 
  TruecallerDirectoryProfile 
} from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';

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

type FilterType = 'ALL' | 'MISSED' | 'OUTGOING' | 'INCOMING' | 'SPAM' | 'BLOCKED' | 'UNKNOWN';

interface GroupedCallItem {
  id: string;
  callerName: string;
  number: string;
  type: CallDirection;
  latestTimestamp: number;
  callTimestamps: number[];
  count: number;
  isSpam: boolean;
  spamCategory?: string;
  riskScore: number;
  isVerifiedBusiness?: boolean;
  carrier?: string;
  location?: string;
  originalCalls: CallLogItem[];
}

export default function RecentsTab({
  calls,
  rules,
  whitelist,
  settings,
  lookupProfile,
  onInitiateCall,
  onSelectCall,
  onBlockNumber,
  onWhitelistNumber,
  onDeleteCall,
  onClearAllCalls,
  onStartScreeningDemo,
  onSyncDeviceCalls,
}: RecentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [groupRepeated, setGroupRepeated] = useState(true);
  const [selectedCallDetail, setSelectedCallDetail] = useState<CallLogItem | null>(null);

  // Group calls by caller number or name for clean history display
  const groupedCalls = useMemo<GroupedCallItem[]>(() => {
    if (!groupRepeated) {
      return calls.map((c) => ({
        id: c.id,
        callerName: c.callerName,
        number: c.number,
        type: c.type,
        latestTimestamp: c.timestamp,
        callTimestamps: [c.timestamp],
        count: 1,
        isSpam: c.isSpam,
        spamCategory: c.spamCategory,
        riskScore: c.riskScore,
        isVerifiedBusiness: c.isVerifiedBusiness,
        carrier: c.carrier,
        location: c.location,
        originalCalls: [c],
      }));
    }

    const groups: GroupedCallItem[] = [];
    const map = new Map<string, GroupedCallItem>();

    for (const call of calls) {
      const cleanNum = call.number.replace(/\D/g, '') || call.number;
      const key = `${cleanNum}_${new Date(call.timestamp).toDateString()}`;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.count += 1;
        existing.callTimestamps.push(call.timestamp);
        existing.originalCalls.push(call);
        // keep latest timestamp
        if (call.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = call.timestamp;
          existing.type = call.type;
        }
      } else {
        const item: GroupedCallItem = {
          id: call.id,
          callerName: call.callerName,
          number: call.number,
          type: call.type,
          latestTimestamp: call.timestamp,
          callTimestamps: [call.timestamp],
          count: 1,
          isSpam: call.isSpam,
          spamCategory: call.spamCategory,
          riskScore: call.riskScore,
          isVerifiedBusiness: call.isVerifiedBusiness,
          carrier: call.carrier,
          location: call.location,
          originalCalls: [call],
        };
        map.set(key, item);
        groups.push(item);
      }
    }

    return groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  }, [calls, groupRepeated]);

  // Filter & search
  const filteredCalls = useMemo(() => {
    return groupedCalls.filter((item) => {
      // 1. Filter tabs
      if (activeFilter === 'MISSED' && item.type !== 'MISSED') return false;
      if (activeFilter === 'OUTGOING' && item.type !== 'OUTGOING') return false;
      if (activeFilter === 'INCOMING' && item.type !== 'INCOMING') return false;
      if (activeFilter === 'SPAM' && !item.isSpam) return false;
      if (activeFilter === 'BLOCKED' && item.type !== 'BLOCKED_CANCELLED') return false;
      if (activeFilter === 'UNKNOWN' && (item.isVerifiedBusiness || item.isSpam)) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.callerName?.toLowerCase().includes(q);
        const matchesNum = item.number.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        if (!matchesName && !matchesNum) return false;
      }

      return true;
    });
  }, [groupedCalls, activeFilter, searchQuery]);

  // Find missed unknown or suspicious calls for Missed Call Intelligence banner
  const missedSuspiciousCall = useMemo(() => {
    return calls.find(
      (c) => (c.type === 'MISSED' || c.type === 'BLOCKED_CANCELLED') && (c.isSpam || c.riskScore > 40)
    );
  }, [calls]);

  const renderDirectionIcon = (type: CallDirection, isSpam: boolean) => {
    if (type === 'BLOCKED_CANCELLED') {
      return (
        <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
          <PhoneOff className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'MISSED') {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
          <PhoneMissed className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'OUTGOING') {
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
          <PhoneOutgoing className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
        isSpam 
          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      }`}>
        <PhoneIncoming className="w-4 h-4" />
      </div>
    );
  };

  const renderRiskBadge = (item: GroupedCallItem) => {
    if (item.type === 'BLOCKED_CANCELLED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600/20 text-rose-300 border border-rose-500/30">
          <ShieldBan className="w-3 h-3" />
          <span>Blocked</span>
        </span>
      );
    }
    if (item.isSpam) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <ShieldAlert className="w-3 h-3" />
          <span>{item.spamCategory || 'Telemarketing'}</span>
        </span>
      );
    }
    if (item.isVerifiedBusiness) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
          <ShieldCheck className="w-3 h-3" />
          <span>Verified</span>
        </span>
      );
    }
    if (item.callerName && !item.callerName.toLowerCase().includes('unknown')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <Check className="w-3 h-3" />
          <span>Safe</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <HelpCircle className="w-3 h-3" />
        <span>Unknown</span>
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Recents</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
              {filteredCalls.length} logs
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Intelligent caller classifications, grouped repeats & risk insights
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onSyncDeviceCalls && (
            <button
              onClick={onSyncDeviceCalls}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center space-x-1.5 transition active:scale-95"
              title="Sync authentic call logs from Android CallLog.Calls"
            >
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sync Device Logs</span>
            </button>
          )}

          <button
            onClick={() => setGroupRepeated(!groupRepeated)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              groupRepeated 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {groupRepeated ? '✓ Grouped Repeats' : 'Separate Rows'}
          </button>

          <button
            onClick={onClearAllCalls}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
            title="Clear Recents"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Missed Call Intelligence Alert Card */}
      {missedSuspiciousCall && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2.5 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Missed Call Intelligence
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300">
                    🟠 Suspicious
                  </span>
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {missedSuspiciousCall.callerName} • {formatPhoneNumber(missedSuspiciousCall.number)}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Called recently. <span className="font-semibold text-amber-200">Recommended:</span> Don't call back unless you recognize this caller.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-amber-500/20">
            <button
              onClick={() => onBlockNumber(missedSuspiciousCall.number, missedSuspiciousCall.callerName)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow"
            >
              Block Number
            </button>
            <button
              onClick={() => setSelectedCallDetail(missedSuspiciousCall)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              Analyze Caller
            </button>
            <button
              onClick={() => onInitiateCall(missedSuspiciousCall.number, missedSuspiciousCall.callerName)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
            >
              Call Back Anyway
            </button>
          </div>
        </div>
      )}

      {/* Search Input & Filter Pills */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recents by name or phone number..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['ALL', 'MISSED', 'OUTGOING', 'INCOMING', 'SPAM', 'BLOCKED', 'UNKNOWN'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeFilter === filter
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {filter === 'ALL' ? 'All Calls' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Recents Call List */}
      <div className="space-y-2">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-800/20 rounded-2xl border border-slate-800 space-y-3">
            <Clock className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <div className="text-sm font-bold text-slate-300">
                {searchQuery || activeFilter !== 'ALL' ? 'No calls matching filter' : 'No Call History Recorded'}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                VigilShield displays authentic call events from your device&apos;s telephony stack. 
                Ensure VigilShield is set as your default phone app and granted <code>READ_CALL_LOG</code> permission to access native incoming, outgoing, and missed call records.
              </p>
            </div>
            {onSyncDeviceCalls && (
              <div className="pt-1">
                <button
                  onClick={onSyncDeviceCalls}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition active:scale-95 shadow"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Sync Call Logs from Device</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredCalls.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                const callItem = item.originalCalls[0];
                setSelectedCallDetail(callItem);
                onSelectCall(callItem);
              }}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                {renderDirectionIcon(item.type, item.isSpam)}

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition">
                      {item.callerName}
                    </span>
                    {item.count > 1 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-700 text-indigo-300">
                        ({item.count})
                      </span>
                    )}
                    {renderRiskBadge(item)}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span>{formatPhoneNumber(item.number)}</span>
                    <span>•</span>
                    <span>
                      {new Date(item.latestTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.count > 1 && (
                      <span className="hidden sm:inline text-slate-500">
                        • {item.count} calls today
                      </span>
                    )}
                  </div>

                  {item.count > 1 && (
                    <div className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
                      Timestamps: {item.callTimestamps.slice(0, 4).map((ts) => (
                        new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      )).join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInitiateCall(item.number, item.callerName);
                  }}
                  className="w-8 h-8 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 flex items-center justify-center transition shadow"
                  title="Call Back"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </div>
            </div>
          ))
        )}
      </div>



      {/* CALLER PROFILE DETAILS MODAL */}
      {selectedCallDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Caller Profile</h3>
                {selectedCallDetail.isVerifiedBusiness && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">
                    ✓ Verified Business
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedCallDetail(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Card */}
            <div className="text-center space-y-1">
              <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {selectedCallDetail.callerName.slice(0, 1).toUpperCase()}
              </div>
              <h2 className="text-lg font-extrabold text-white mt-2">
                {selectedCallDetail.callerName}
              </h2>
              <p className="text-xs text-slate-400">
                {formatPhoneNumber(selectedCallDetail.number)}
              </p>
            </div>

            {/* Reputation & Risk */}
            <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2">
              <div className="text-xs font-bold text-slate-300">Caller Reputation</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-850 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Risk Score</div>
                  <div className={`text-sm font-black ${
                    selectedCallDetail.riskScore >= 70 ? 'text-rose-400' : selectedCallDetail.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {selectedCallDetail.riskScore}/100
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-850 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Category</div>
                  <div className="text-xs font-bold text-white truncate">
                    {selectedCallDetail.spamCategory || 'General'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-850 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Reports</div>
                  <div className="text-xs font-bold text-slate-200">
                    {selectedCallDetail.reportsCount || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Call Activity */}
            <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-1.5 text-xs">
              <div className="font-bold text-slate-300">Call Activity</div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Recent calls:</span>
                <span className="font-medium text-white">{selectedCallDetail.repeatCount || 1} calls</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Carrier:</span>
                <span className="font-medium text-white">{selectedCallDetail.carrier || 'Standard Carrier'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Location:</span>
                <span className="font-medium text-white">{selectedCallDetail.location || 'Local Regional'}</span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  const num = selectedCallDetail.number;
                  const name = selectedCallDetail.callerName;
                  setSelectedCallDetail(null);
                  onInitiateCall(num, name);
                }}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </button>

              <button
                onClick={() => {
                  onBlockNumber(selectedCallDetail.number, selectedCallDetail.callerName);
                  setSelectedCallDetail(null);
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
              >
                <ShieldBan className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>

              <button
                onClick={() => {
                  onWhitelistNumber(selectedCallDetail.number, selectedCallDetail.callerName);
                  setSelectedCallDetail(null);
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mark Safe</span>
              </button>

              <button
                onClick={() => {
                  onDeleteCall(selectedCallDetail.id);
                  setSelectedCallDetail(null);
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold transition flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Log</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

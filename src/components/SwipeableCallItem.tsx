import { memo, useState, useCallback, useRef, useEffect, type MouseEvent } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'motion/react';
import {
  AlertTriangle,
  Ban,
  Bot,
  Check,
  Disc,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CallLogItem,
  CallShieldDirectoryProfile,
  ShieldSettings,
  DisplayDensity,
  CallDirection,
  CallRecordingItem,
} from '../types';
import { CallGroup } from '../utils/callHistory';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playSpamAlertChime, playCallCancelledTone } from '../utils/audioAlerts';
import { callRecordingService } from '../services/callRecordingService';
import { callNotesService } from '../services/callNotesService';
import { telecomBridge } from '../services/telephony/telecomBridge';
import AudioRecordingPlayer from './AudioRecordingPlayer';

interface SwipeableCallItemProps {
  call?: CallLogItem;
  group?: CallGroup;
  profile: CallShieldDirectoryProfile;
  settings: ShieldSettings;
  density?: DisplayDensity;
  isCompact: boolean;
  onSelectCall: (call: CallLogItem) => void;
  onInitiateCall: (
    number: string,
    name?: string,
    sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)'
  ) => void;
  onDeleteCall?: (id: string) => void;
  onDeleteCalls?: (ids: string[]) => void;
  onBlockNumber: (number: string, label: string) => void;
  iconFor: (type: CallDirection) => React.ReactNode;
  timeLabel: (ts: number) => string;
  t: (key: any) => string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPressSelect?: (id: string) => void;
}

const SWIPE_THRESHOLD = 70;

const formatDuration = (s?: number) => {
  if (!s || s <= 0) return '00:00';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function SwipeableCallItem({
  call,
  group,
  profile,
  settings,
  isCompact,
  onSelectCall,
  onInitiateCall,
  onDeleteCall,
  onDeleteCalls,
  onBlockNumber,
  iconFor,
  timeLabel,
  t,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPressSelect,
}: SwipeableCallItemProps) {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isBlockedFeedback, setIsBlockedFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showInlineRecording, setShowInlineRecording] = useState(false);
  const [recordingsToPlay, setRecordingsToPlay] = useState<CallRecordingItem[]>([]);
  const wasDraggedRef = useRef(false);
  const longPressTimerRef = useRef<any>(null);

  // Authoritative item for this exact call session (Requirement 1, 4, 15)
  const item: CallLogItem = call || group?.latest!;
  const callId = item.id;
  const targetNumber = item.number || group?.number || '';
  const timestamp = item.timestamp;
  const durationSeconds = item.durationSeconds || 0;
  const callType = item.type;

  // Derived transforms for responsive swipe visual indicators
  const blockOpacity = useTransform(x, [0, 25, SWIPE_THRESHOLD], [0, 0.65, 1]);
  const blockScale = useTransform(x, [0, SWIPE_THRESHOLD, 120], [0.75, 1, 1.15]);
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -25, 0], [1, 0.65, 0]);
  const deleteScale = useTransform(x, [-120, -SWIPE_THRESHOLD, 0], [1.15, 1, 0.75]);

  const p = profile;
  const name =
    item.callerName && item.callerName !== targetNumber && !/^unknown caller$/i.test(item.callerName)
      ? item.callerName
      : group?.name && group.name !== targetNumber && !/^unknown caller$/i.test(group.name)
      ? group.name
      : p.name || targetNumber || t('unknown_caller');
  const isSpam = item.isSpam || (group ? group.calls.some((c) => c.isSpam) : false) || p.isSpam;

  const [isFinalizingRecording, setIsFinalizingRecording] = useState(() =>
    callRecordingService.isCallRecordingFinalizing(callId)
  );
  const [latestNote, setLatestNote] = useState(() =>
    callNotesService.getNoteForCall(callId) || item.notes || ''
  );

  // Synchronize recording strictly for this exact call session (Requirement 2 & 15)
  useEffect(() => {
    let isMounted = true;

    const checkRecording = async () => {
      setIsFinalizingRecording(callRecordingService.isCallRecordingFinalizing(callId));
      try {
        const items = await callRecordingService.getRecordingsForCall(callId);
        if (!isMounted) return;
        if (items && items.length > 0) {
          setRecordingsToPlay(items);
        } else if (item.recordingUri) {
          setRecordingsToPlay([
            {
              id: `rec-${callId}`,
              callId: callId,
              number: targetNumber,
              callerName: name,
              timestamp,
              durationSeconds: durationSeconds || 15,
              folderPath: 'Internal Storage/Recordings/CallShield/',
              fileName: `REC_${targetNumber.replace(/\D/g, '')}_${new Date(timestamp).toISOString().slice(0, 10)}.wav`,
              fileSizeBytes: 128000,
              mimeType: 'audio/wav',
              dataUri: item.recordingUri,
              quality: '48 kHz Studio HD',
            },
          ]);
        } else {
          setRecordingsToPlay([]);
        }
      } catch {
        if (isMounted) setRecordingsToPlay([]);
      }
    };

    checkRecording();

    // Subscribe to recording updates
    const unsubRec = callRecordingService.subscribe(() => {
      if (isMounted) checkRecording();
    });

    // Subscribe to notes updates strictly for this call session
    const unsubNotes = callNotesService.subscribe(() => {
      if (isMounted) {
        setLatestNote(callNotesService.getNoteForCall(callId) || item.notes || '');
      }
    });

    return () => {
      isMounted = false;
      unsubRec();
      unsubNotes();
    };
  }, [callId, item.recordingUri, item.notes, timestamp, durationSeconds, targetNumber, name]);

  const hasRecordedCall = recordingsToPlay.length > 0 || Boolean(item.recordingUri);

  const handleToggleInlinePlayer = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation();
      if (!showInlineRecording) {
        if (recordingsToPlay.length === 0) {
          const found = await callRecordingService.getRecordingsForCall(callId);
          if (found && found.length > 0) {
            setRecordingsToPlay(found);
          } else if (item.recordingUri) {
            setRecordingsToPlay([
              {
                id: `rec-${callId}`,
                callId: callId,
                number: targetNumber,
                callerName: name,
                timestamp,
                durationSeconds: durationSeconds || 15,
                folderPath: 'Internal Storage/Recordings/CallShield/',
                fileName: `REC_${targetNumber.replace(/\D/g, '')}_${new Date(timestamp).toISOString().slice(0, 10)}.wav`,
                fileSizeBytes: 128000,
                mimeType: 'audio/wav',
                dataUri: item.recordingUri,
                quality: '48 kHz Studio HD',
              },
            ]);
          }
        }
        setShowInlineRecording(true);
      } else {
        setShowInlineRecording(false);
      }
    },
    [showInlineRecording, recordingsToPlay, callId, item.recordingUri, targetNumber, name, timestamp, durationSeconds]
  );

  const triggerBlock = useCallback(() => {
    try {
      playSpamAlertChime();
    } catch {
      // Audio optional
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // Vibrate optional
      }
    }

    onBlockNumber(targetNumber, name);
    setIsBlockedFeedback(true);
    setTimeout(() => {
      setIsBlockedFeedback(false);
    }, 2000);

    animate(x, 0, { type: 'spring', stiffness: 450, damping: 32 });
  }, [targetNumber, name, onBlockNumber, x]);

  const triggerDelete = useCallback(() => {
    try {
      playCallCancelledTone();
    } catch {
      // Audio optional
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch {
        // Vibrate optional
      }
    }

    setIsExiting(true);
    animate(x, -380, { duration: 0.22, ease: 'easeOut' }).then(() => {
      if (onDeleteCall) {
        onDeleteCall(callId);
      } else if (onDeleteCalls) {
        onDeleteCalls(group ? group.calls.map((c) => c.id) : [callId]);
      }
    });
  }, [callId, group, onDeleteCall, onDeleteCalls, x]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    setIsDragging(false);
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;

    if (offsetX < -SWIPE_THRESHOLD || (offsetX < -30 && velocityX < -220)) {
      // Swipe left -> Delete
      triggerDelete();
    } else if (offsetX > SWIPE_THRESHOLD || (offsetX > 30 && velocityX > 220)) {
      // Swipe right -> Block
      triggerBlock();
    } else {
      // Snap back to neutral
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
    }

    // Reset dragged flag slightly after click handler evaluates
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 80);
  };

  const handlePointerDown = () => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      telecomBridge.vibratePhone(35);
      onLongPressSelect?.(callId);
    }, 450);
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleItemClick = () => {
    if (wasDraggedRef.current || Math.abs(x.get()) > 8 || isDragging) {
      return;
    }
    if (isSelectionMode) {
      onToggleSelect?.(callId);
      return;
    }
    onSelectCall(item);
  };

  const isMissed = callType === 'MISSED';

  return (
    <div
      id={`call-session-${callId.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
      className={`relative overflow-hidden border-b border-white/5 last:border-0 transition-colors ${
        isExiting ? 'opacity-0 scale-y-0 transition-all duration-200' : ''
      }`}
    >
      {/* Background action layers revealed during gestures */}
      {!isSelectionMode && (
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
          {/* Left background: Swipe right to Block */}
          <motion.div
            style={{ opacity: blockOpacity }}
            className="absolute inset-y-0 left-0 right-1/2 flex items-center bg-gradient-to-r from-rose-950 via-rose-900 to-amber-900/90 px-4 text-white"
          >
            <motion.div
              style={{ scale: blockScale }}
              className="flex items-center gap-2 font-bold"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <Ban className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-rose-200 leading-tight">
                  {t('block')}
                </div>
                <div className="text-[9px] font-normal text-rose-300/80">
                  Firewall rule
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right background: Swipe left to Delete */}
          <motion.div
            style={{ opacity: deleteOpacity }}
            className="absolute inset-y-0 right-0 left-1/2 flex items-center justify-end bg-gradient-to-l from-red-950 via-rose-900 to-red-900/90 px-4 text-white"
          >
            <motion.div
              style={{ scale: deleteScale }}
              className="flex items-center gap-2 font-bold"
            >
              <div className="text-right">
                <div className="text-xs font-bold text-rose-200 leading-tight">
                  {t('delete')}
                </div>
                <div className="text-[9px] font-normal text-rose-300/80">
                  Remove log
                </div>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                <Trash2 className="h-4 w-4" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Foreground swipeable row */}
      <motion.div
        drag={isSelectionMode ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        style={{ x }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onDragStart={() => {
          setIsDragging(true);
          wasDraggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        className={`relative z-10 flex items-center bg-[#0d131f] hover:bg-[#121a2b] ${
          isSelectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        } select-none transition-colors ${
          isCompact ? 'gap-2 px-3 py-2.5' : 'gap-3 px-3.5 py-3'
        } ${isBlockedFeedback ? 'ring-1 ring-amber-500/40 bg-amber-950/20' : ''} ${
          isSelected ? 'bg-blue-950/35 border-l-2 border-l-blue-500' : ''
        }`}
      >
        {/* Selection Checkbox in Selection Mode */}
        {isSelectionMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(callId);
            }}
            className={`grid shrink-0 place-items-center rounded-xl border transition-all cursor-pointer ${
              isCompact ? 'h-7 w-7' : 'h-8 w-8'
            } ${
              isSelected
                ? 'bg-blue-600 border-blue-500 text-white shadow-md ring-2 ring-blue-500/30'
                : 'border-white/25 bg-white/5 hover:border-white/40 text-transparent'
            }`}
            aria-label={isSelected ? 'Deselect call' : 'Select call'}
          >
            <Check className={`h-4 w-4 stroke-[3] transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        )}

        {/* Caller Avatar / Type icon with min 40px hitbox */}
        <button
          type="button"
          onClick={handleItemClick}
          className={`grid shrink-0 place-items-center rounded-full transition-all cursor-pointer ${
            isCompact ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm'
          } ${
            isBlockedFeedback
              ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30'
              : isMissed
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
              : isSpam
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              : 'bg-white/[0.06] text-slate-300 border border-white/[0.08]'
          }`}
        >
          {isBlockedFeedback ? (
            <Ban className="h-4 w-4 text-amber-300" />
          ) : (
            iconFor(callType)
          )}
        </button>

        {/* Main Caller Details */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleItemClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleItemClick();
            }
          }}
          className="min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
        >
          {/* Caller Title & Semantic Indicators (Zero-Pill Discipline) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`truncate font-semibold tracking-tight transition-colors ${
                isCompact ? 'text-xs' : 'text-sm'
              } ${
                isBlockedFeedback
                  ? 'text-amber-300'
                  : isMissed
                  ? 'text-amber-300 font-bold'
                  : isSpam
                  ? 'text-rose-300 font-bold'
                  : 'text-white'
              }`}
            >
              {name}
            </span>

            {isBlockedFeedback ? (
              <span className="text-[11px] font-bold text-amber-400">· Blocked</span>
            ) : isSpam ? (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-rose-400">
                <ShieldAlert className="h-3 w-3 shrink-0" />
                <span>{t('spam_badge')}</span>
              </span>
            ) : item.isVerifiedBusiness || p.isVerified ? (
              <span className="flex items-center gap-0.5 text-[11px] font-medium text-blue-400">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span>{t('verified_badge')}</span>
              </span>
            ) : null}

            {item.isNeighborSpoof && (
              <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                <span>Neighbor Spoof</span>
              </span>
            )}

            {item.isPingBackScam && (
              <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-rose-400">
                <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
                <span>1-Ring Trap</span>
              </span>
            )}

            {isFinalizingRecording && (
              <span className="text-[10px] text-amber-400 font-medium animate-pulse">· Saving REC...</span>
            )}

            {latestNote && (
              <span className="text-[11px] text-slate-400 italic max-w-[140px] truncate" title={latestNote}>
                · "{latestNote}"
              </span>
            )}

            {item.usedAiScreener && (
              <span className="flex items-center gap-0.5 text-[10.5px] font-medium text-indigo-400">
                <Bot className="h-2.5 w-2.5 shrink-0" />
                <span>Screened</span>
              </span>
            )}
          </div>

          {/* Call Metadata Subtitle: Phone number · Location · Direction & Exact Duration · Time */}
          <div
            className={`flex flex-wrap items-center text-slate-400 transition-all ${
              isCompact ? 'mt-0 text-[10.5px] gap-x-1.5' : 'mt-0.5 text-[11.5px] gap-x-2'
            }`}
          >
            <span className="font-mono tabular-nums">{formatPhoneNumber(targetNumber)}</span>
            <span className="text-slate-600">·</span>
            <span>{p.location || 'India'}</span>
            <span className="text-slate-600">·</span>
            {callType === 'MISSED' ? (
              <span className="font-semibold text-amber-400">{t('missed') || 'Missed'}</span>
            ) : callType === 'BLOCKED_CANCELLED' ? (
              <span className="font-semibold text-rose-400">{t('blocked') || 'Blocked'}</span>
            ) : (
              <span className="text-slate-300">
                {callType === 'OUTGOING' ? 'Outgoing' : 'Incoming'}
                {durationSeconds > 0 && ` · ${formatDuration(durationSeconds)}`}
              </span>
            )}
            <span className="text-slate-600">·</span>
            <span className="font-mono tabular-nums text-slate-300">{timeLabel(timestamp)}</span>
            {item.sim && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-sky-300 font-medium text-[10.5px]">{item.sim.includes('1') ? 'SIM 1' : 'SIM 2'}</span>
              </>
            )}
          </div>

          {item.usedAiScreener &&
            item.screeningSummaryBullets &&
            item.screeningSummaryBullets.length > 0 && (
              <div
                className={`flex items-center gap-1.5 text-indigo-300 ${
                  isCompact ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'
                }`}
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                <span className="truncate">{item.screeningSummaryBullets[0]}</span>
              </div>
            )}
        </div>

        {/* Action buttons: Recording Playback, Phone Call with >=44px Hitboxes */}
        {hasRecordedCall && (
          <button
            type="button"
            onClick={handleToggleInlinePlayer}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl active:scale-95 transition cursor-pointer text-emerald-400 hover:bg-emerald-500/15`}
            aria-label={showInlineRecording ? 'Hide recording player' : 'Play call recording'}
            title={`Play call recording (${timeLabel(timestamp)})`}
          >
            <div className={`grid h-8 w-8 place-items-center rounded-full ${showInlineRecording ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
              <Disc className={`animate-pulse h-4 w-4`} />
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInitiateCall(targetNumber, name);
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 active:scale-95 transition cursor-pointer"
          aria-label={t('nav_phone')}
          title={`Call ${name || targetNumber}`}
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <Phone className="h-4 w-4 fill-current" />
          </div>
        </button>

        {/* Desktop hover actions: quick delete and block buttons */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerDelete();
          }}
          className="hidden rounded-full p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 sm:block transition"
          title={t('delete')}
        >
          <Trash2 className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerBlock();
          }}
          className="hidden rounded-full p-1.5 text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 active:scale-95 sm:block transition"
          title={t('block')}
        >
          <Ban className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </motion.div>

      {/* Inline Call Recording Player at this particular call timestamp (Requirement 4 & 17) */}
      <AnimatePresence>
        {showInlineRecording && recordingsToPlay.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-emerald-500/20 bg-slate-950/90 px-3 py-2.5 rounded-b-2xl space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium">
              <span className="flex items-center gap-1 font-semibold">
                <Disc className="h-3 w-3 animate-spin text-emerald-400" />
                {recordingsToPlay.length > 1
                  ? `Call Recordings (${recordingsToPlay.length} segments) — ${timeLabel(timestamp)}`
                  : `Call Recording (${timeLabel(timestamp)})`}
              </span>
              <span className="text-[10px] text-slate-400">
                {recordingsToPlay[0]?.quality || '48 kHz Studio Lossless'}
              </span>
            </div>

            {recordingsToPlay.map((rec, rIdx) => (
              <div key={rec.id} className="space-y-1">
                {recordingsToPlay.length > 1 && (
                  <div className="text-[10px] font-semibold text-slate-400">
                    Segment {rIdx + 1} • {formatDuration(rec.durationSeconds)}
                  </div>
                )}
                <AudioRecordingPlayer
                  recording={rec}
                  compact={true}
                  onDelete={(id) => {
                    callRecordingService.deleteRecording(id);
                    setRecordingsToPlay((prev) => prev.filter((r) => r.id !== id));
                    if (recordingsToPlay.length <= 1) {
                      setShowInlineRecording(false);
                    }
                  }}
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(SwipeableCallItem);


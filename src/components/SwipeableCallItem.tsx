import { memo, useState, useCallback, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'motion/react';
import {
  AlertTriangle,
  Ban,
  Bot,
  Check,
  Disc,
  EyeOff,
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
} from '../types';
import { CallGroup } from '../utils/callHistory';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playSpamAlertChime, playCallCancelledTone } from '../utils/audioAlerts';

interface SwipeableCallItemProps {
  group: CallGroup;
  profile: CallShieldDirectoryProfile;
  settings: ShieldSettings;
  density?: DisplayDensity;
  isCompact: boolean;
  onSelectCall: (call: CallLogItem) => void;
  onInitiateCall: (
    number: string,
    name?: string,
    sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)',
    isPrivate?: boolean
  ) => void;
  onDeleteCalls: (ids: string[]) => void;
  onBlockNumber: (number: string, label: string) => void;
  iconFor: (type: CallDirection) => React.ReactNode;
  timeLabel: (ts: number) => string;
  t: (key: any) => string;
}

const SWIPE_THRESHOLD = 70;

function SwipeableCallItem({
  group,
  profile,
  settings,
  isCompact,
  onSelectCall,
  onInitiateCall,
  onDeleteCalls,
  onBlockNumber,
  iconFor,
  timeLabel,
  t,
}: SwipeableCallItemProps) {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isBlockedFeedback, setIsBlockedFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const wasDraggedRef = useRef(false);

  // Derived transforms for responsive swipe visual indicators
  const blockOpacity = useTransform(x, [0, 25, SWIPE_THRESHOLD], [0, 0.65, 1]);
  const blockScale = useTransform(x, [0, SWIPE_THRESHOLD, 120], [0.75, 1, 1.15]);
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -25, 0], [1, 0.65, 0]);
  const deleteScale = useTransform(x, [-120, -SWIPE_THRESHOLD, 0], [1.15, 1, 0.75]);

  const p = profile;
  const name =
    group.name && group.name !== group.number && !/^unknown caller$/i.test(group.name)
      ? group.name
      : p.name || group.number || t('unknown_caller');
  const spam = group.calls.some((c) => c.isSpam) || p.isSpam;
  const latest = group.latest;

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

    onBlockNumber(group.number, name);
    setIsBlockedFeedback(true);
    setTimeout(() => {
      setIsBlockedFeedback(false);
    }, 2000);

    animate(x, 0, { type: 'spring', stiffness: 450, damping: 32 });
  }, [group.number, name, onBlockNumber, x]);

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
      onDeleteCalls(group.calls.map((c) => c.id));
    });
  }, [group.calls, onDeleteCalls, x]);

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

  const handleItemClick = () => {
    if (wasDraggedRef.current || Math.abs(x.get()) > 8 || isDragging) {
      return;
    }
    onSelectCall(latest);
  };

  return (
    <div
      id={`call-group-${group.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
      className={`relative overflow-hidden border-b border-white/5 last:border-0 transition-colors ${
        isExiting ? 'opacity-0 scale-y-0 transition-all duration-200' : ''
      }`}
    >
      {/* Background action layers revealed during gestures */}
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

      {/* Foreground swipeable row */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        style={{ x }}
        onDragStart={() => {
          setIsDragging(true);
          wasDraggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        className={`relative z-10 flex items-center bg-[#0e141c] hover:bg-white/[0.02] cursor-grab active:cursor-grabbing select-none transition-colors ${
          isCompact ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-3 py-2.5'
        } ${isBlockedFeedback ? 'ring-1 ring-amber-500/40 bg-amber-950/20' : ''}`}
      >
        {/* Caller Avatar / Type icon */}
        <button
          type="button"
          onClick={handleItemClick}
          className={`grid shrink-0 place-items-center rounded-full transition-all ${
            isCompact ? 'h-7.5 w-7.5 text-xs' : 'h-9 w-9'
          } ${
            isBlockedFeedback
              ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30'
              : group.missedCount
              ? 'bg-amber-400/10 text-amber-400'
              : spam
              ? 'bg-rose-400/10 text-rose-400'
              : 'bg-white/5 text-slate-400'
          }`}
        >
          {isBlockedFeedback ? (
            <Ban className="h-4 w-4 text-amber-300" />
          ) : (
            iconFor(latest.type)
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
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`truncate font-semibold transition-all ${
                isCompact ? 'text-xs' : 'text-sm'
              } ${
                isBlockedFeedback
                  ? 'text-amber-300'
                  : group.missedCount
                  ? 'text-amber-200'
                  : 'text-white'
              }`}
            >
              {name}
            </span>

            {isBlockedFeedback ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/25 border border-amber-500/40 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300 animate-pulse">
                <Check className="h-2.5 w-2.5 text-amber-400" />
                Blocked in Rules
              </span>
            ) : spam ? (
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

            {group.calls.some((c) => c.isNeighborSpoof) && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">
                <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                Neighbor Spoof
              </span>
            )}

            {group.calls.some((c) => c.isPingBackScam) && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 border border-rose-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-300">
                <ShieldAlert className="h-2.5 w-2.5 text-rose-400" />
                1-Ring Trap
              </span>
            )}

            {group.calls.some((c) => Boolean(c.recordingUri)) && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                <Disc className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                REC
              </span>
            )}

            {group.calls.some((c) => c.usedAiScreener) && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 text-[8.5px] font-bold text-indigo-300">
                <Bot className="h-2.5 w-2.5 text-indigo-400" />
                AI Screened
              </span>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center text-slate-400 transition-all ${
              isCompact ? 'mt-0 text-[10px] gap-x-1' : 'mt-0.5 text-[11px] gap-x-1.5'
            }`}
          >
            <span className="font-mono">{formatPhoneNumber(group.number)}</span>
            <span>·</span>
            <span>{p.location || 'India'}</span>
            <span>·</span>
            <span>
              {group.totalCount} {group.totalCount === 1 ? t('call') : t('calls')}
            </span>
            <span>·</span>
            <span>{timeLabel(latest.timestamp)}</span>
          </div>

          {latest.usedAiScreener &&
            latest.screeningSummaryBullets &&
            latest.screeningSummaryBullets.length > 0 && (
              <div
                className={`flex items-center gap-1.5 text-indigo-300 ${
                  isCompact ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'
                }`}
              >
                <Sparkles className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                <span className="truncate">{latest.screeningSummaryBullets[0]}</span>
              </div>
            )}

          {group.missedCount > 0 && (
            <div
              className={`font-semibold text-amber-400 ${
                isCompact ? 'mt-0 text-[9.5px]' : 'mt-0.5 text-[10px]'
              }`}
            >
              {group.missedCount} {t('missed')}
            </div>
          )}
        </div>

        {/* Action buttons: Phone and Privacy call */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInitiateCall(group.number, name);
          }}
          className={`grid shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition ${
            isCompact ? 'h-7 w-7' : 'h-8 w-8'
          }`}
          aria-label={t('nav_phone')}
          title="Call"
        >
          <Phone className={`fill-current ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInitiateCall(group.number, name, undefined, true);
          }}
          className={`grid shrink-0 place-items-center rounded-full bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition ${
            isCompact ? 'h-7 w-7' : 'h-8 w-8'
          }`}
          aria-label="Call Privately (*67 Masked)"
          title={`Call Privately (${settings?.privateCallPrefix || '*67'} Masked)`}
        >
          <EyeOff className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
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
    </div>
  );
}

export default memo(SwipeableCallItem);

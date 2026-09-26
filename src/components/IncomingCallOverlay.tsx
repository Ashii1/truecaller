import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Phone,
  PhoneOff,
  Power,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { IncomingCallState, ScreeningTranscriptEntry, ShieldSettings, ContactItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { startIncomingCallAlerts, IncomingCallAlertController } from '../utils/audioAlerts';
import CallScreeningOverlay from './CallScreeningOverlay';

interface IncomingCallOverlayProps {
  call: IncomingCallState | null;
  isDeviceLocked?: boolean;
  contacts?: ContactItem[];
  autoCancelEnabled: boolean;
  settings?: ShieldSettings;
  onCancelCall: (reason: string, block: boolean, screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }) => void;
  onAnswerCall: (screeningData?: { transcript: ScreeningTranscriptEntry[]; intent: string | null }) => void;
  onDismiss: () => void;
  onScreenCall?: (call: IncomingCallState) => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  onSwipeToNotification?: () => void;
  initialMode?: 'popup' | 'fullscreen';
}

export default function IncomingCallOverlay({
  call,
  isDeviceLocked = false,
  contacts,
  autoCancelEnabled,
  settings,
  onCancelCall,
  onAnswerCall,
  onDismiss,
  onScreenCall,
  onExpand,
  onMinimize,
  onSwipeToNotification,
  initialMode,
}: IncomingCallOverlayProps) {
  const { t } = useI18n();

  // On lockscreen or when call forces fullscreen, strictly enforce fullscreen mode.
  const isFullscreenEnforced = Boolean(isDeviceLocked || call?.viewMode === 'fullscreen');

  const [displayMode, setDisplayMode] = useState<'popup' | 'fullscreen'>(() => {
    if (isDeviceLocked || call?.viewMode === 'fullscreen') return 'fullscreen';
    return initialMode || 'popup';
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [isScreeningInternal, setIsScreeningInternal] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const alertControllerRef = useRef<IncomingCallAlertController | null>(null);

  // Swipe-to-notification gesture tracking
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDismissingToNotification, setIsDismissingToNotification] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  const triggerSwipeToNotification = useCallback(() => {
    setIsDismissingToNotification(true);
    telecomBridge.vibratePhone([30]);
    setTimeout(() => {
      if (onSwipeToNotification) {
        onSwipeToNotification();
      } else if (onMinimize) {
        onMinimize();
      }
      setIsDismissingToNotification(false);
      setDragOffset(null);
    }, 200);
  }, [onSwipeToNotification, onMinimize]);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    if (!touchStartRef.current || !isDraggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - touchStartRef.current.x;
    const dy = clientY - touchStartRef.current.y;
    // Allow dragging upward (negative dy) and slightly horizontal
    if (dy < 15 || Math.abs(dx) > 15) {
      setDragOffset({ x: dx, y: Math.min(15, dy) });
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    const offset = dragOffset;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (offset) {
      const isUpSwipe = offset.y < -35 || (offset.y < -18 && elapsed < 350);
      const isSideSwipe = Math.abs(offset.x) > 85;
      if (isUpSwipe || isSideSwipe) {
        triggerSwipeToNotification();
        return;
      }
    }
    setDragOffset(null);
  };

  // Sync mode if lockscreen state changes or if call forces a viewMode
  useEffect(() => {
    if (isDeviceLocked || call?.viewMode === 'fullscreen') {
      setDisplayMode('fullscreen');
    } else if (call?.viewMode === 'popup') {
      setDisplayMode('popup');
    }
  }, [isDeviceLocked, call?.viewMode]);

  const critical = Boolean(call?.isSpam && (call.riskScore >= 75 || call.spamCategory === 'SCAM'));
  const suspicious = Boolean((call?.isSpam && !critical) || call?.isNeighborSpoof || call?.isPingBackScam);

  const handleSilence = useCallback(() => {
    setSilenced(true);
    if (alertControllerRef.current) {
      alertControllerRef.current.silence();
    }
    telecomBridge.silenceRinger();
  }, []);

  // System ringtone and vibration lifecycle
  useEffect(() => {
    if (!call || call.status !== 'RINGING' || silenced) {
      if (alertControllerRef.current) {
        alertControllerRef.current.silence();
        alertControllerRef.current = null;
      }
      return;
    }

    const nativeMode = telecomBridge.getRingerMode();
    const effectiveMode = nativeMode || settings?.ringerMode || 'NORMAL';

    alertControllerRef.current = startIncomingCallAlerts({
      ringerMode: effectiveMode,
      playRingtone: settings?.playRingtone !== false,
    });

    return () => {
      if (alertControllerRef.current) {
        alertControllerRef.current.stop();
        alertControllerRef.current = null;
      }
    };
  }, [call?.status, silenced, settings?.ringerMode, settings?.playRingtone]);

  useEffect(() => {
    let wakeLockSentinel: any = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockSentinel = lock;
      }).catch(() => {});
    }

    window.addEventListener('SILENCE_RINGER', handleSilence);
    const unsubBridge = telecomBridge.subscribe((eventType) => {
      if (eventType === 'SILENCE_RINGER') {
        handleSilence();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Volume button silences ringer
      const isVol =
        e.key === 'AudioVolumeDown' ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'AudioVolumeMute' ||
        e.key === 'VolumeDown' ||
        e.key === 'VolumeUp' ||
        e.keyCode === 174 ||
        e.keyCode === 175 ||
        e.keyCode === 173 ||
        e.key === 'v' ||
        e.key === 'V' ||
        e.key === 's' ||
        e.key === 'S' ||
        e.key === 'Escape';

      // 1. Volume button behavior: Mute Ringer vs Reject Call
      if (isVol) {
        e.preventDefault();
        const action = settings?.volumeButtonAction || (settings?.volumeButtonSilencesRinger === false ? 'REJECT_CALL' : 'MUTE_RINGER');
        if (action === 'REJECT_CALL') {
          handleSilence();
          onCancelCall('Declined via volume button', false);
        } else {
          handleSilence();
        }
        return;
      }

      // 2. Power button ends/rejects call (when configured in settings)
      const isPowerKey =
        e.key === 'Power' ||
        e.code === 'Power' ||
        e.key === 'EndCall' ||
        e.code === 'EndCall' ||
        (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'End'));

      if (isPowerKey && settings?.powerButtonEndsCall) {
        e.preventDefault();
        handleSilence();
        onCancelCall('Declined via power button', false);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 3. Flip to silence (gyroscope/orientation trigger)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (settings?.flipToSilence === false) return;
      if (e.beta !== null && (e.beta > 150 || e.beta < -150 || Math.abs(e.beta) > 165)) {
        handleSilence();
      }
    };
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('SILENCE_RINGER', handleSilence);
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
      unsubBridge();
      if (wakeLockSentinel) {
        try { wakeLockSentinel.release(); } catch {}
      }
    };
  }, [handleSilence, onCancelCall, settings?.flipToSilence, settings?.powerButtonEndsCall, settings?.volumeButtonSilencesRinger, settings?.volumeButtonAction]);

  useEffect(() => {
    if (!call || call.status !== 'RINGING' || !autoCancelEnabled || !call.isSpam || call.riskScore < 90) {
      setCountdown(0);
      return;
    }
    setCountdown(3);
    const timer = window.setInterval(() => setCountdown(value => {
      if (value <= 1) {
        window.clearInterval(timer);
        onCancelCall(call.spamReason || 'High-confidence spam call', true);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [call, autoCancelEnabled, onCancelCall]);

  if (!call || call.viewMode === 'notification') return null;

  // Active AI Screening Mode
  if (call.status === 'SCREENING' || isScreeningInternal) {
    return (
      <CallScreeningOverlay
        call={call}
        onPickUp={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          if (alertControllerRef.current) {
            alertControllerRef.current.stop();
            alertControllerRef.current = null;
          }
          telecomBridge.silenceRinger();
          telecomBridge.clearStaleCallNotifications();
          onAnswerCall({ transcript, intent });
        }}
        onHangUp={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          if (alertControllerRef.current) {
            alertControllerRef.current.stop();
            alertControllerRef.current = null;
          }
          telecomBridge.silenceRinger();
          telecomBridge.clearStaleCallNotifications();
          onCancelCall('Screening concluded: user declined', false, { transcript, intent });
        }}
        onBlockSpam={(transcript, intent) => {
          setIsScreeningInternal(false);
          setSilenced(true);
          if (alertControllerRef.current) {
            alertControllerRef.current.stop();
            alertControllerRef.current = null;
          }
          telecomBridge.silenceRinger();
          telecomBridge.clearStaleCallNotifications();
          onCancelCall('Screening concluded: caller blocked as spam', true, { transcript, intent });
        }}
      />
    );
  }

  if (call.status !== 'RINGING') return null;

  const handleAnswer = (e?: MouseEvent) => {
    e?.stopPropagation();
    setSilenced(true);
    if (alertControllerRef.current) {
      alertControllerRef.current.stop();
      alertControllerRef.current = null;
    }
    telecomBridge.silenceRinger();
    telecomBridge.clearStaleCallNotifications();
    onAnswerCall();
  };

  const handleDecline = (e?: MouseEvent) => {
    e?.stopPropagation();
    setSilenced(true);
    if (alertControllerRef.current) {
      alertControllerRef.current.stop();
      alertControllerRef.current = null;
    }
    telecomBridge.silenceRinger();
    telecomBridge.clearStaleCallNotifications();
    onCancelCall('Declined by user', false);
  };

  const handleScreen = (e?: MouseEvent) => {
    e?.stopPropagation();
    setSilenced(true);
    if (alertControllerRef.current) {
      alertControllerRef.current.stop();
      alertControllerRef.current = null;
    }
    telecomBridge.silenceRinger();
    setIsScreeningInternal(true);
    if (onScreenCall) {
      onScreenCall(call);
    }
  };

  // Clicking on the in-app popup banner directly opens fullscreen caller
  const handleBannerClick = (e?: MouseEvent) => {
    e?.stopPropagation();
    setDisplayMode('fullscreen');
    onExpand?.();
  };

  const rawNumStr = typeof call.number === 'string' ? call.number.trim() : call.number != null ? String(call.number).trim() : '';
  const formattedNumber = formatPhoneNumber(rawNumStr);
  const rawDigits = rawNumStr.replace(/\D/g, '');

  // Look up in contacts address book with high-accuracy matching + fallback to localStorage
  const matchedContact = useMemo(() => {
    let sourceContacts = contacts;
    if (!sourceContacts || sourceContacts.length === 0) {
      try {
        const raw = localStorage.getItem('callshield_contacts');
        if (raw) sourceContacts = JSON.parse(raw);
      } catch {}
    }
    if (!sourceContacts || !rawDigits) return null;
    return (
      sourceContacts.find((c) => {
        const cDigits = (c.number || '').replace(/\D/g, '');
        if (!cDigits) return false;
        if (cDigits === rawDigits) return true;
        if (cDigits.length >= 7 && rawDigits.length >= 7) {
          const c10 = cDigits.slice(-10);
          const r10 = rawDigits.slice(-10);
          const c7 = cDigits.slice(-7);
          const r7 = rawDigits.slice(-7);
          return c10 === r10 || c7 === r7 || cDigits.endsWith(rawDigits) || rawDigits.endsWith(cDigits);
        }
        return false;
      }) || null
    );
  }, [contacts, rawDigits]);

  // Native Android bridge contact name lookup
  const nativeContactName = useMemo(() => {
    if (!rawNumStr) return null;
    return telecomBridge.lookupContactName(rawNumStr);
  }, [rawNumStr]);

  const callerNameStr = typeof call.callerName === 'string' ? call.callerName.trim() : call.callerName != null ? String(call.callerName).trim() : '';
  const isNameDigitsOnly = Boolean(callerNameStr && callerNameStr.replace(/\D/g, '') === rawDigits);
  const isGeneric = !callerNameStr || isNameDigitsOnly || callerNameStr.toLowerCase() === 'unknown caller' || callerNameStr.toLowerCase() === 'unknown';

  // Saved contact name strictly takes highest precedence over generic, simulated or carrier string
  const effectiveCallerName = matchedContact?.name || nativeContactName || (!isGeneric ? callerNameStr : '') || callerNameStr || '';
  const hasSpecificName = Boolean(effectiveCallerName && effectiveCallerName.replace(/\D/g, '') !== rawDigits);
  const callerDisplayName = hasSpecificName ? effectiveCallerName : formattedNumber;
  const isSavedContact = Boolean(matchedContact || nativeContactName);
  const avatarInitial = (callerDisplayName?.trim()?.[0] || '📞').toUpperCase();

  // =========================================================================
  // 1. IN-APP POPUP BANNER (Rendered ONLY when device is UNLOCKED & mode === 'popup')
  // On lockscreen, or when fullscreen is enforced, strictly suppress the popup!
  // =========================================================================
  if (!isFullscreenEnforced && displayMode === 'popup') {
    if (isCollapsed) {
      // Sleek collapsed compact pill at the top of the viewport with BOTH name and number
      return (
        <div
          id="inapp-caller-popup-collapsed"
          onClick={handleBannerClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            transform: isDismissingToNotification
              ? 'translateY(-140%) scale(0.92)'
              : dragOffset
              ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
              : undefined,
            opacity: isDismissingToNotification
              ? 0
              : dragOffset
              ? Math.max(0.2, 1 - Math.abs(dragOffset.y) / 90)
              : 1,
            transition: dragOffset ? 'none' : 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="fixed top-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[99999] flex items-center justify-between gap-2.5 rounded-full border border-white/20 bg-[#070b13]/95 px-3.5 py-2 shadow-2xl shadow-black/90 backdrop-blur-2xl cursor-pointer select-none transition-all duration-200 animate-spring-down hover:border-white/35 active:scale-[0.99]"
          title="Click to expand caller details · Swipe up to send to notification panel"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative flex shrink-0">
              <span className={`absolute -inset-1 rounded-full animate-radar-ripple ${critical ? 'bg-rose-500/40' : suspicious ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`} />
              <div className={`relative grid h-8 w-8 place-items-center rounded-full text-xs font-black shadow-md ${
                critical
                  ? 'bg-rose-950 text-rose-200 border border-rose-500/50'
                  : suspicious
                  ? 'bg-amber-950 text-amber-200 border border-amber-500/50'
                  : 'bg-emerald-950 text-emerald-200 border border-emerald-500/50'
              }`}>
                {avatarInitial}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-extrabold text-white truncate">{callerDisplayName}</span>
                <span className="font-mono text-[11px] font-bold text-cyan-300 truncate bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  {formattedNumber}
                </span>
                {isSavedContact ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-emerald-500/25 text-emerald-300 border border-emerald-500/30">
                    Saved
                  </span>
                ) : (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                    critical ? 'bg-rose-500/25 text-rose-300' : suspicious ? 'bg-amber-500/25 text-amber-300' : 'bg-emerald-500/25 text-emerald-300'
                  }`}>
                    {critical ? 'SPAM' : suspicious ? 'CHECK' : 'CALL'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleDecline}
              className="grid h-8 w-8 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-500 active:scale-90 transition-transform shadow-md"
              aria-label={t('decline')}
              title={t('decline')}
            >
              <PhoneOff className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleAnswer}
              className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 active:scale-90 transition-transform shadow-md"
              aria-label={t('answer')}
              title={t('answer')}
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSwipeToNotification();
              }}
              className="flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/25 hover:text-white transition active:scale-95"
              title="Swipe up to move to notification panel"
              aria-label="Move to notification panel"
            >
              <ChevronUp className="h-3 w-3" />
              <span className="hidden sm:inline">To Notification</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
              title="Expand in-app card"
              aria-label="Expand in-app card"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    // Fully redesigned In-App Incoming Call Card (Bold Display of BOTH Name & Number)
    return (
      <div
        id="inapp-caller-popup-card"
        onClick={handleBannerClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: isDismissingToNotification
            ? 'translateY(-140%) scale(0.92)'
            : dragOffset
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
            : undefined,
          opacity: isDismissingToNotification
            ? 0
            : dragOffset
            ? Math.max(0.2, 1 - Math.abs(dragOffset.y) / 90)
            : 1,
          transition: dragOffset ? 'none' : 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="fixed top-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[99999] rounded-2xl sm:rounded-3xl border border-white/[0.14] bg-[#070b13]/98 p-3.5 sm:p-4 text-white shadow-2xl shadow-black/95 backdrop-blur-2xl cursor-pointer select-none transition-all duration-200 animate-spring-down hover:border-white/25 active:scale-[0.99]"
        title="Tap anywhere to display fullscreen · Swipe up to send to notification panel"
        role="button"
        tabIndex={0}
      >
        {/* Touch drag handle & swipe prompt */}
        <div className="flex flex-col items-center justify-center -mt-1 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 rounded-full bg-white/30 mb-1" />
          <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-semibold tracking-wide">
            <ChevronUp className="h-3 w-3 animate-bounce" />
            <span>Swipe up to move to notification panel</span>
          </div>
        </div>

        {/* Top meta row with trust status and collapse handle */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {critical ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            ) : call.isNeighborSpoof ? (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : suspicious ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            )}
            <span className={`text-[11px] font-bold truncate ${
              critical
                ? 'text-rose-400'
                : call.isNeighborSpoof
                ? 'text-amber-400'
                : call.isPingBackScam
                ? 'text-rose-400'
                : suspicious
                ? 'text-amber-400'
                : call.isVerifiedBusiness
                ? 'text-emerald-400'
                : 'text-emerald-400'
            }`}>
              {critical
                ? t('high_risk_caller')
                : call.isNeighborSpoof
                ? 'Neighbor Spoof'
                : call.isPingBackScam
                ? '1-Ring Ping-Back Scam'
                : suspicious
                ? t('potential_spam')
                : call.isVerifiedBusiness
                ? t('verified_caller')
                : `${t('safe_badge')} · Verified`}
            </span>
            {countdown > 0 && (
              <span className="font-mono text-[10px] text-rose-400 bg-rose-500/15 px-1.5 py-0.2 rounded-full">
                Auto-drop in {countdown}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSwipeToNotification();
              }}
              className="flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/25 hover:text-white transition active:scale-95"
              title="Swipe up to move to notification panel"
              aria-label="Move to notification panel"
            >
              <ChevronUp className="h-3 w-3" />
              <span>To Notification</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
              title="Minimize to top pill"
              aria-label="Minimize in-app popup"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main Caller Profile Row with Crystal Clear NAME & NUMBER */}
        <div className="flex items-center gap-3.5 py-3">
          {/* Avatar with pulsing radar ring */}
          <div className="relative shrink-0">
            <div className={`absolute -inset-1.5 rounded-full animate-radar-ripple ${
              critical ? 'bg-rose-500/30' : suspicious ? 'bg-amber-500/30' : 'bg-emerald-500/30'
            }`} />
            <div className={`relative grid h-12 w-12 place-items-center rounded-full text-lg font-black shadow-xl ${
              critical
                ? 'bg-rose-950 text-rose-200 border-2 border-rose-500/60 shadow-rose-950/50'
                : suspicious
                ? 'bg-amber-950 text-amber-200 border-2 border-amber-500/60 shadow-amber-950/50'
                : 'bg-indigo-950 text-indigo-200 border-2 border-indigo-500/60 shadow-indigo-950/50'
            }`}>
              {avatarInitial}
            </div>
          </div>

          {/* Caller Details Info: BOTH Name and Number prominently displayed */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                {callerDisplayName}
              </h3>
              {isSavedContact && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Saved Contact
                </span>
              )}
              {call.isVerifiedBusiness && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  Verified
                </span>
              )}
            </div>

            {/* Formatted Phone Number Box & Carrier Details */}
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-md shadow-inner tracking-wider">
                {formattedNumber}
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-300 font-medium truncate">{call.carrier || 'Cellular'}</span>
              {call.location && (
                <>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-400 truncate">{call.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2 pt-1" onClick={e => e.stopPropagation()}>
          {/* AI Screen Call Pill */}
          <button
            type="button"
            onClick={handleScreen}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 active:scale-95 transition-transform"
            title="Screen call with AI assistant"
          >
            <Bot className="h-3.5 w-3.5 text-indigo-400" />
            <span>Screen</span>
          </button>

          {/* Decline & Answer System Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDecline}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/50 hover:bg-rose-500 active:scale-90 transition-transform"
              title="Decline incoming call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>{t('decline')}</span>
            </button>
            <button
              type="button"
              onClick={handleAnswer}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 active:scale-90 transition-transform"
              title="Answer incoming call"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{t('answer')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. FULLSCREEN CALLER (Active on Lockscreen OR when tapped from in-app popup)
  // =========================================================================
  return (
    <div
      id="fullscreen-caller-overlay"
      className="fixed inset-0 z-[99999] flex flex-col justify-between w-screen h-screen bg-gradient-to-b from-[#030712] via-[#0b0f19] to-[#030712] text-white p-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] select-none overflow-y-auto"
      aria-label={t('incoming_call_title')}
    >
      {/* Top Bar Status */}
      <div className="flex items-center justify-between w-full max-w-lg mx-auto border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {critical ? (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          ) : call.isNeighborSpoof ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : suspicious ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          )}
          <span className={critical ? 'text-red-300' : call.isNeighborSpoof ? 'text-amber-300' : suspicious ? 'text-amber-300' : 'text-emerald-300'}>
            {critical
              ? t('high_risk_caller')
              : call.isNeighborSpoof
              ? 'Neighbor Spoof Detected'
              : call.isPingBackScam
              ? '1-Ring Ping-Back Scam'
              : suspicious
              ? t('potential_spam')
              : call.isVerifiedBusiness
              ? t('verified_caller')
              : `${t('safe_badge')} · ${t('public_directory_verified')}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Allow minimizing back to in-app popup ONLY when NOT on lockscreen and NOT enforced */}
          {!isFullscreenEnforced && (
            <button
              type="button"
              onClick={() => {
                setDisplayMode('popup');
                onMinimize?.();
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Minimize to in-app banner"
              aria-label="Minimize to in-app banner"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Banner</span>
            </button>
          )}
        </div>
      </div>

      {settings?.flashAlertOnIncomingCall && !silenced && (
        <div className="pointer-events-none fixed inset-0 z-[100000] border-4 border-amber-400/40 animate-pulse" />
      )}

      {/* Main Caller Profile Info */}
      <div className="flex flex-col items-center justify-center text-center my-auto px-4 max-w-md mx-auto w-full">
        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className={`absolute inset-0 rounded-full animate-ping opacity-25 ${critical ? 'bg-red-500' : suspicious ? 'bg-amber-500' : 'bg-indigo-500'}`} />
          <div className={`relative grid h-28 w-28 place-items-center rounded-full text-4xl font-bold shadow-2xl border-2 ${
            critical
              ? 'bg-red-950/60 text-red-200 border-red-500/50 shadow-red-950/50'
              : suspicious
              ? 'bg-amber-950/60 text-amber-200 border-amber-500/50 shadow-amber-950/50'
              : 'bg-indigo-950/60 text-indigo-200 border-indigo-500/50 shadow-indigo-950/50'
          }`}>
            {avatarInitial}
          </div>
        </div>

        <h2 className="truncate max-w-full text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {callerDisplayName}
        </h2>
        {isSavedContact && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Saved Contact
          </div>
        )}
        <p className="mt-2 font-mono text-lg font-bold text-cyan-300 tracking-wider">
          {formattedNumber}
        </p>

        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
          <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-slate-300">{call.carrier || 'Cellular'}</span>
          <span>•</span>
          <span>{call.location || 'India'}</span>
        </div>

        {/* Neighbor Spoof High-Visibility Banner */}
        {call.isNeighborSpoof && (
          <div className="mt-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-left text-xs text-amber-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Likely Spoofed (Neighbor Spoofing)</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
              This caller matches your local prefix but is not in your contacts. Scammers often fake local numbers to trick you into answering.
            </p>
          </div>
        )}

        {/* 1-Ring Ping-Back Scam Banner */}
        {call.isPingBackScam && (
          <div className="mt-4 w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-left text-xs text-rose-200 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>1-Ring Callback Scam Trap</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-200/90">
              Automated dialers drop after 1 ring to trick you into calling back expensive premium numbers.
            </p>
          </div>
        )}

        {(critical || (suspicious && !call.isNeighborSpoof && !call.isPingBackScam)) && (
          <div className={`mt-4 w-full rounded-2xl px-3.5 py-2.5 text-left text-xs ${critical ? 'bg-red-500/15 border border-red-500/30 text-red-200' : 'bg-amber-500/15 border border-amber-500/30 text-amber-200'}`}>
            <div className="font-semibold">{critical ? 'Do not share OTPs, PINs, or banking details.' : 'Review caller information before answering.'}</div>
            {countdown > 0 && <div className="mt-1 font-mono text-[11px] opacity-90">{t('auto_cancelling_in')} {countdown}{t('seconds_short')}.</div>}
          </div>
        )}

        {expandedDetails && (
          <div className="mt-3 w-full space-y-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 text-left text-xs text-slate-400">
            <div className="flex justify-between"><span>{t('carrier_label')}</span><span className="text-slate-200">{call.carrier || 'Cellular'}</span></div>
            <div className="flex justify-between"><span>{t('location_label')}</span><span className="max-w-[65%] text-right text-slate-200">{call.location || 'Unavailable'}</span></div>
            {typeof call.reportsCount === 'number' && call.reportsCount > 0 && (
              <div className="flex justify-between">
                <span>{t('spam_reports_count')}</span>
                <span className="text-slate-200">{call.reportsCount.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpandedDetails(value => !value)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
        >
          {t('caller_details')} <ChevronDown className={`h-4 w-4 transition-transform ${expandedDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Bottom Action Controls */}
      <div className="w-full max-w-md mx-auto space-y-3 pt-2">
        {/* Screen Call with AI Button */}
        <button
          type="button"
          onClick={handleScreen}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-indigo-900/80 px-4 py-3.5 text-xs sm:text-sm font-bold text-indigo-100 shadow-xl shadow-indigo-950/50 transition hover:from-indigo-800 hover:to-purple-800 active:scale-98"
        >
          <Bot className="h-4 w-4 text-indigo-300" />
          <span>Screen Call with AI Assistant</span>
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
        </button>

        {/* Primary Large Call Actions (Clean 2-button layout: Decline and Answer) */}
        <div className="grid grid-cols-2 gap-6 pt-2 max-w-xs mx-auto w-full">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleDecline}
              className="flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-rose-600 font-bold text-white hover:bg-rose-500 shadow-xl shadow-rose-950/70 active:scale-90 transition transform"
              aria-label={t('decline')}
            >
              <PhoneOff className="h-8 w-8" />
            </button>
            <span className="text-xs font-bold text-slate-300">{t('decline')}</span>
          </div>

          {/* Answer */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleAnswer}
              className="flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-xl shadow-emerald-950/70 active:scale-90 transition transform animate-pulse"
              aria-label={t('answer')}
            >
              <Phone className="h-8 w-8" />
            </button>
            <span className="text-xs font-bold text-emerald-400">{t('answer')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

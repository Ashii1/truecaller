import { useState, useRef, useEffect, useCallback, type TouchEvent, type MouseEvent } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { telecomBridge } from '../services/telephony/telecomBridge';

export interface InAppToastPayload {
  id?: string;
  text: string;
  type: 'info' | 'error' | 'success';
  title?: string;
}

interface ModernInAppNotificationProps {
  notification: InAppToastPayload | null;
  onDismiss: () => void;
  onOpenNotificationPanel?: () => void;
}

export default function ModernInAppNotification({
  notification,
  onDismiss,
}: ModernInAppNotificationProps) {
  const [dragX, setDragX] = useState<number>(0);
  const [isSwipingOut, setIsSwipingOut] = useState<'left' | 'right' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setDragX(0);
    setIsSwipingOut(null);
  }, [notification?.text]);

  const handleSwipeToDismiss = useCallback((direction: 'left' | 'right') => {
    telecomBridge.vibratePhone(20);
    setIsSwipingOut(direction);
    setTimeout(() => {
      onDismiss();
    }, 180);
  }, [onDismiss]);

  const onTouchStart = (e: TouchEvent | MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };
    isDraggingRef.current = true;
  };

  const onTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!touchStartRef.current || !isDraggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const dx = clientX - touchStartRef.current.x;
    setDragX(dx);
  };

  const onTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const elapsed = start ? Date.now() - start.time : 1000;
    const isQuickFlick = elapsed < 280 && Math.abs(dragX) > 30;

    if (dragX > 50 || (dragX > 25 && isQuickFlick)) {
      handleSwipeToDismiss('right');
    } else if (dragX < -50 || (dragX < -25 && isQuickFlick)) {
      handleSwipeToDismiss('left');
    } else {
      setDragX(0);
    }
  };

  if (!notification) return null;

  const isError = notification.type === 'error';
  const isSuccess = notification.type === 'success';

  return (
    <div
      className="fixed left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[99999] pointer-events-none select-none transition-all duration-300"
      style={{
        top: 'max(4.5rem, calc(env(safe-area-inset-top, 0px) + 4rem))',
      }}
    >
      <div
        onClick={() => {
          onDismiss();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onTouchStart}
        onMouseMove={onTouchMove}
        onMouseUp={onTouchEnd}
        style={{
          transform: isSwipingOut === 'left'
            ? 'translateX(-130%) scale(0.92)'
            : isSwipingOut === 'right'
            ? 'translateX(130%) scale(0.92)'
            : `translateX(${dragX}px)`,
          opacity: isSwipingOut ? 0 : Math.max(0.15, 1 - Math.abs(dragX) / 160),
          transition: isDraggingRef.current ? 'none' : 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`pointer-events-auto cursor-pointer rounded-2xl border px-3.5 py-2.5 shadow-2xl backdrop-blur-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-3 flex items-center justify-between gap-3 active:scale-[0.99] ${
          isError
            ? 'border-rose-500/40 bg-[#160b11]/98 text-rose-100 shadow-rose-950/80 ring-1 ring-rose-500/20'
            : isSuccess
            ? 'border-emerald-500/40 bg-[#081510]/98 text-emerald-100 shadow-emerald-950/80 ring-1 ring-emerald-500/20'
            : 'border-white/15 bg-[#0b111e]/98 text-slate-100 shadow-black/90 ring-1 ring-white/10'
        }`}
        title="Tap or swipe to dismiss"
        role="alert"
      >
        {/* Left Side: Glyph Icon */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl font-bold shadow-md ${
              isError
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : isSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            {isError ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Info className="h-3.5 w-3.5" />
            )}
          </div>

          {/* Clean concise message */}
          <div className="min-w-0 flex-1">
            {notification.title && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
                {notification.title}
              </p>
            )}
            <p className="text-xs font-semibold leading-snug truncate text-white">
              {notification.text}
            </p>
          </div>
        </div>

        {/* Right Side: Close Button with >=36px hitbox */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-90 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

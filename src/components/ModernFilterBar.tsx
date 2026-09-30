import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, SlidersHorizontal, X } from 'lucide-react';
import { triggerHapticFeedback } from '../utils/audioAlerts';

export interface FilterTabOption<T extends string = string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badgeVariant?: 'default' | 'missed' | 'blocked' | 'favorite' | 'recorded';
}

interface ModernFilterBarProps<T extends string> {
  tabs: FilterTabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  accentClass?: string;
  activeTextClass?: string;
}

export default function ModernFilterBar<T extends string>({
  tabs,
  activeId,
  onChange,
  accentClass = 'bg-blue-600 text-white shadow-sm',
  activeTextClass = 'text-white font-semibold',
}: ModernFilterBarProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  // Check scroll boundary to show/hide modern edge arrows & fades
  const updateScrollBounds = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    updateScrollBounds();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => updateScrollBounds();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollBounds);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollBounds);
    };
  }, [tabs]);

  // Smoothly center the active tab whenever it changes
  useEffect(() => {
    const btn = tabRefs.current.get(activeId);
    if (btn && scrollContainerRef.current) {
      btn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeId]);

  // Close quick menu when clicking outside
  useEffect(() => {
    if (!showQuickMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setShowQuickMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQuickMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuickMenu]);

  const scrollNudge = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -160 : 160;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    try {
      triggerHapticFeedback(15);
    } catch {}
  };

  const handleSelect = (id: T) => {
    onChange(id);
    try {
      triggerHapticFeedback(20);
    } catch {}
    setShowQuickMenu(false);
  };

  return (
    <div className="relative mb-3 select-none">
      {/* Container with rounded modern bar design */}
      <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#0c121e]/90 p-1 backdrop-blur-md shadow-sm">
        
        {/* Left Arrow Navigation (Never overlaps tabs) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollNudge('left')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 shadow-sm hover:bg-white/10 hover:text-white transition-all active:scale-95 mr-1"
            aria-label="Scroll filters left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable Chip Strip - full text, no truncation, responsive */}
        <div
          ref={scrollContainerRef}
          className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 scroll-smooth"
        >
          {tabs.map((tab) => {
            const active = activeId === tab.id;
            const Icon = tab.icon;
            const count = tab.count ?? 0;

            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.id, node);
                  else tabRefs.current.delete(tab.id);
                }}
                type="button"
                onClick={() => handleSelect(tab.id)}
                className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                  active
                    ? `${accentClass} ${activeTextClass}`
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white border border-transparent'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    active
                      ? 'text-slate-950 stroke-[2.5]'
                      : tab.badgeVariant === 'missed' && count > 0
                      ? 'text-amber-400'
                      : tab.badgeVariant === 'blocked' && count > 0
                      ? 'text-rose-400'
                      : tab.badgeVariant === 'recorded' && count > 0
                      ? 'text-emerald-400'
                      : tab.badgeVariant === 'favorite' && count > 0
                      ? 'text-amber-300'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {/* Full label without truncation */}
                <span className="font-semibold tracking-tight">{tab.label}</span>

                {/* Counter Badge */}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 transition-colors ${
                      active
                        ? 'bg-slate-950/20 text-slate-950 font-black'
                        : tab.badgeVariant === 'missed'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : tab.badgeVariant === 'blocked'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : tab.badgeVariant === 'recorded'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : tab.badgeVariant === 'favorite'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Arrow Navigation (Never overlaps tabs) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollNudge('right')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 shadow-sm hover:bg-white/10 hover:text-white transition-all active:scale-95 ml-1"
            aria-label="Scroll filters right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Modern "Quick Filter" Menu Button at the right edge */}
        <div className="relative ml-1 pl-1 border-l border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback(15);
              setShowQuickMenu((prev) => !prev);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
              showQuickMenu
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
            title="All filter categories"
            aria-label="Toggle all categories view"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Modern Popover Grid for Instant 1-Tap Category Selection */}
      {showQuickMenu && (
        <div
          ref={quickMenuRef}
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-white/15 bg-[#111722] p-2.5 shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Filter Options
            </span>
            <button
              type="button"
              onClick={() => setShowQuickMenu(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {tabs.map((tab) => {
              const active = activeId === tab.id;
              const Icon = tab.icon;
              const count = tab.count ?? 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelect(tab.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    active
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? 'text-emerald-400'
                          : tab.badgeVariant === 'missed'
                          ? 'text-amber-400'
                          : tab.badgeVariant === 'blocked'
                          ? 'text-rose-400'
                          : tab.badgeVariant === 'recorded'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        {count}
                      </span>
                    )}
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { memo, type ComponentType } from 'react';

export interface NavigationTabProps {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  badge?: number;
  isCenter?: boolean;
  mobile?: boolean;
  onSelect: (id: string) => void;
}

const NavigationTab = memo(function NavigationTab({
  id,
  name,
  icon: Icon,
  active,
  badge,
  isCenter = false,
  onSelect,
}: NavigationTabProps) {
  if (isCenter) {
    return (
      <button
        type="button"
        id={`oneui-tab-${id}`}
        onClick={() => onSelect(id)}
        aria-current={active ? 'page' : undefined}
        aria-label={name}
        className="group relative flex flex-1 flex-col items-center justify-center outline-none transition-transform active:scale-95 select-none -my-1 px-1"
      >
        {/* Centered Hero Keypad Button (UI 9.5 Style) */}
        <div className="relative flex items-center justify-center">
          <div
            className={`grid h-10 w-12 sm:w-13 place-items-center rounded-2xl transition-all duration-200 ${
              active
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-[0_0_18px_rgba(16,185,129,0.5)] scale-105'
                : 'bg-white/[0.08] text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15 hover:text-emerald-300'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2.2} />
          </div>

          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-extrabold text-white ring-2 ring-[#0c1219] shadow-sm">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>

        {/* Hero Tab Label */}
        <span
          className={`mt-1 text-[9.5px] sm:text-[10px] tracking-tight leading-none transition-colors duration-200 ${
            active ? 'font-black text-emerald-400' : 'font-semibold text-slate-300 group-hover:text-emerald-400'
          }`}
        >
          {name}
        </span>

        {/* Signature UI 9.5 Active Indicator Dot */}
        <span
          className={`mt-0.5 h-1 w-1 rounded-full transition-all duration-200 ${
            active ? 'scale-100 bg-emerald-400 opacity-100 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'scale-0 opacity-0'
          }`}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      id={`oneui-tab-${id}`}
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      aria-label={name}
      className="group relative flex flex-1 flex-col items-center justify-center py-1 outline-none transition-transform active:scale-95 select-none"
    >
      {/* Wing Tab Icon Capsule */}
      <div className="relative flex items-center justify-center">
        <div
          className={`grid h-7 w-10 sm:w-11 place-items-center rounded-full transition-all duration-200 ${
            active
              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/35 shadow-sm shadow-emerald-500/10'
              : 'text-slate-400 group-hover:bg-white/5 group-hover:text-slate-200'
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 1.9} />
        </div>

        {/* Wing Tab Notification Badge */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-extrabold text-white ring-2 ring-[#0c1219] shadow-sm">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>

      {/* Wing Tab Label */}
      <span
        className={`mt-0.5 text-[9.5px] sm:text-[10px] tracking-tight leading-none transition-colors duration-200 ${
          active ? 'font-bold text-emerald-400' : 'font-medium text-slate-400 group-hover:text-slate-200'
        }`}
      >
        {name}
      </span>

      {/* Signature UI 9.5 Active Indicator Dot */}
      <span
        className={`mt-0.5 h-1 w-1 rounded-full transition-all duration-200 ${
          active ? 'scale-100 bg-emerald-400 opacity-100 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'scale-0 opacity-0'
        }`}
        aria-hidden="true"
      />
    </button>
  );
});

export default NavigationTab;

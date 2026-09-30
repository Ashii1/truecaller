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
        className="group relative flex min-h-[48px] flex-1 flex-col items-center justify-center outline-none transition-transform active:scale-95 select-none -mt-3 cursor-pointer"
      >
        {/* Centered Keypad Hero Button */}
        <div className="relative flex items-center justify-center">
          <div
            className={`grid h-12 w-12 place-items-center rounded-2xl transition-all duration-200 shadow-lg ${
              active
                ? 'bg-blue-600 text-white shadow-blue-500/30 scale-105'
                : 'bg-slate-800/90 text-slate-300 border border-white/10 hover:bg-slate-700/90 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
          </div>

          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#080c14]">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>

        {/* Hero Tab Label */}
        <span
          className={`mt-1 text-[10px] tracking-tight leading-none transition-colors duration-200 ${
            active ? 'font-bold text-blue-400' : 'font-medium text-slate-400 group-hover:text-slate-200'
          }`}
        >
          {name}
        </span>
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
      className="group relative flex min-h-[48px] flex-1 flex-col items-center justify-center py-1 outline-none transition-transform active:scale-95 select-none cursor-pointer"
    >
      {/* Tab Icon */}
      <div className="relative flex items-center justify-center">
        <div
          className={`grid h-8 w-11 place-items-center rounded-full transition-all duration-200 ${
            active
              ? 'bg-blue-500/15 text-blue-400'
              : 'text-slate-400 group-hover:text-slate-200'
          }`}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 1.9} />
        </div>

        {/* Tab Notification Badge */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8.5px] font-bold text-white ring-2 ring-[#080c14]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>

      {/* Tab Label */}
      <span
        className={`mt-0.5 text-[10px] tracking-tight leading-none transition-colors duration-200 ${
          active ? 'font-bold text-blue-400' : 'font-medium text-slate-400 group-hover:text-slate-200'
        }`}
      >
        {name}
      </span>

      {/* Signature Micro Active Indicator */}
      <span
        className={`mt-1 h-1 w-1 rounded-full transition-all duration-200 ${
          active ? 'scale-100 bg-blue-400 opacity-100' : 'scale-0 opacity-0'
        }`}
        aria-hidden="true"
      />
    </button>
  );
});

export default NavigationTab;

import { memo, type ComponentType } from 'react';

export interface NavigationTabProps {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  badge?: number;
  mobile?: boolean;
  onSelect: (id: string) => void;
}

const NavigationTab = memo(function NavigationTab({
  id,
  name,
  icon: Icon,
  active,
  badge,
  mobile = false,
  onSelect,
}: NavigationTabProps) {
  if (mobile) {
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={active ? 'page' : undefined}
        className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 transition ${active ? 'text-white' : 'text-slate-500'}`}
      >
        <span className={`grid h-9 w-14 place-items-center rounded-2xl transition ${active ? 'bg-white text-[#0a0f14] shadow-md' : ''}`}>
          <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.5 : 2} />
        </span>
        <span className="text-[10px] font-semibold">{name}</span>
        {badge !== undefined && (
          <span className="absolute right-[19%] top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-1 items-center justify-center gap-2 rounded-[17px] px-4 py-2.5 text-sm font-semibold transition-all ${active ? 'bg-white text-[#0a0f14] shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.5 : 2} />
      {name}
      {badge !== undefined && (
        <span className={`min-w-4 rounded-full px-1 text-[9px] ${active ? 'bg-[#0a0f14] text-white' : 'bg-rose-500 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  );
});

export default NavigationTab;

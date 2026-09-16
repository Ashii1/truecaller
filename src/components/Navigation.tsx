import { Clock3, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { TabId } from '../types';

interface NavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  spamCallsCount?: number;
  activeRulesCount?: number;
  assistantAlertsCount?: number;
}

export default function Navigation({ activeTab, onChangeTab, spamCallsCount = 0, activeRulesCount = 0 }: NavigationProps) {
  const tabs = [
    { id: 'dialer' as TabId, name: 'Phone', icon: Phone },
    { id: 'recents' as TabId, name: 'Recents', icon: Clock3, badge: spamCallsCount || undefined },
    { id: 'contacts' as TabId, name: 'Contacts', icon: UsersRound },
    { id: 'protection' as TabId, name: 'Protection', icon: ShieldCheck, badge: activeRulesCount || undefined },
  ];

  return (
    <>
      <div className="hidden sm:block sticky top-16 z-30 px-4 pt-3">
        <nav className="mx-auto flex max-w-3xl items-center gap-1 rounded-[22px] border border-white/10 bg-[#10161d]/90 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl">
          {tabs.map(({ id, name, icon: Icon, badge }) => {
            const active = activeTab === id;
            return <button key={id} onClick={() => onChangeTab(id)} className={`relative flex flex-1 items-center justify-center gap-2 rounded-[17px] px-4 py-2.5 text-sm font-semibold transition-all ${active ? 'bg-white text-[#0a0f14] shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.5 : 2} />
              {name}
              {badge !== undefined && <span className={`min-w-4 rounded-full px-1 text-[9px] ${active ? 'bg-[#0a0f14] text-white' : 'bg-rose-500 text-white'}`}>{badge}</span>}
            </button>;
          })}
        </nav>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0b1016]/95 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <nav className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ id, name, icon: Icon, badge }) => {
            const active = activeTab === id;
            return <button key={id} onClick={() => onChangeTab(id)} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 transition ${active ? 'text-white' : 'text-slate-500'}`}>
              <span className={`grid h-9 w-14 place-items-center rounded-2xl transition ${active ? 'bg-white text-[#0a0f14] shadow-md' : ''}`}><Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.5 : 2} /></span>
              <span className="text-[10px] font-semibold">{name}</span>
              {badge !== undefined && <span className="absolute right-[19%] top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">{badge}</span>}
            </button>;
          })}
        </nav>
      </div>
    </>
  );
}

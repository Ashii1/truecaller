import { Phone, Clock3, UsersRound, ShieldCheck, Sparkles } from 'lucide-react';
import { TabId } from '../types';

interface NavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  spamCallsCount?: number;
  activeRulesCount?: number;
  assistantAlertsCount?: number;
}

export default function Navigation({ activeTab, onChangeTab, spamCallsCount = 0, activeRulesCount = 0, assistantAlertsCount = 0 }: NavigationProps) {
  const tabs = [
    { id: 'dialer' as TabId, name: 'Keypad', icon: Phone },
    { id: 'recents' as TabId, name: 'Recents', icon: Clock3, badge: spamCallsCount > 0 ? spamCallsCount : undefined },
    { id: 'contacts' as TabId, name: 'Contacts', icon: UsersRound },
    { id: 'protection' as TabId, name: 'Protection', icon: ShieldCheck, badge: activeRulesCount > 0 ? activeRulesCount : undefined },
    { id: 'assistant' as TabId, name: 'Assistant', icon: Sparkles, badge: assistantAlertsCount > 0 ? '•' : undefined },
  ];

  return (
    <>
      <div className="hidden sm:block sticky top-16 z-30 px-4 py-3">
        <nav className="mx-auto flex max-w-3xl items-center justify-center gap-1 rounded-[24px] border border-white/10 bg-slate-900/70 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} id={`desktop-tab-${tab.id}`} onClick={() => onChangeTab(tab.id)}
                className={`relative flex min-w-[105px] items-center justify-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${active ? 'bg-[#2f6df6] text-white shadow-md' : 'text-slate-400 hover:bg-white/[.05] hover:text-white'}`}>
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
                {tab.badge !== undefined && <span className="rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">{tab.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2">
        <nav className="mx-auto grid max-w-md grid-cols-5 rounded-[26px] border border-white/[.07] bg-[#111216]/96 p-1.5 shadow-[0_-8px_28px_rgba(0,0,0,.45)] backdrop-blur-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} id={`mobile-tab-${tab.id}`} onClick={() => onChangeTab(tab.id)}
                className={`relative flex min-h-[56px] flex-col items-center justify-center rounded-[20px] transition-all ${active ? 'bg-[#2f6df6] text-white shadow-md' : 'text-slate-500 hover:text-slate-200'}`}>
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[10px] font-semibold tracking-wide">{tab.name}</span>
                {tab.badge !== undefined && <span className="absolute right-2 top-1.5 min-w-3 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">{tab.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

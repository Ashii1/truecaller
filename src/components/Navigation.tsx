import { Phone, Clock3, UsersRound, ShieldCheck } from 'lucide-react';
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
    { id: 'recents' as TabId, name: 'Recents', icon: Clock3, badge: spamCallsCount > 0 ? spamCallsCount : undefined },
    { id: 'contacts' as TabId, name: 'Contacts', icon: UsersRound },
    { id: 'protection' as TabId, name: 'Protection', icon: ShieldCheck, badge: activeRulesCount > 0 ? activeRulesCount : undefined },
  ];

  return (
    <>
      <div className="hidden sm:block sticky top-16 z-30 px-4 py-2">
        <nav className="mx-auto flex max-w-2xl items-center justify-center gap-1 rounded-2xl border border-slate-200/10 bg-slate-900/95 p-1 shadow-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`desktop-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex min-w-[112px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
                {tab.badge !== undefined && <span className="rounded-full bg-red-500 px-1.5 text-[9px] font-bold text-white">{tab.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/10 bg-slate-950/98 px-2 pt-1.5 pb-[max(.35rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,.3)]">
        <nav className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex min-h-[58px] flex-col items-center justify-center transition ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-200'}`}
              >
                <span className={`flex h-9 w-12 items-center justify-center rounded-full ${active ? 'bg-blue-500/15' : ''}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-0.5 text-[11px] font-medium">{tab.name}</span>
                {tab.badge !== undefined && <span className="absolute right-[18%] top-1 min-w-3 rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">{tab.badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

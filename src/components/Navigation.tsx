import { 
  Phone, 
  Clock, 
  Users, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';
import { TabId } from '../types';

interface NavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  spamCallsCount?: number;
  activeRulesCount?: number;
  assistantAlertsCount?: number;
}

export default function Navigation({
  activeTab,
  onChangeTab,
  spamCallsCount = 0,
  activeRulesCount = 0,
  assistantAlertsCount = 0,
}: NavigationProps) {
  const tabs = [
    {
      id: 'dialer' as TabId,
      name: 'Dialer',
      icon: Phone,
    },
    {
      id: 'recents' as TabId,
      name: 'Recents',
      icon: Clock,
      badge: spamCallsCount > 0 ? spamCallsCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'contacts' as TabId,
      name: 'Contacts',
      icon: Users,
    },
    {
      id: 'protection' as TabId,
      name: 'Protection',
      icon: ShieldCheck,
      badge: activeRulesCount > 0 ? activeRulesCount : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    {
      id: 'assistant' as TabId,
      name: 'Assistant',
      icon: Sparkles,
      badge: assistantAlertsCount > 0 ? '✨' : undefined,
      badgeColor: 'bg-indigo-500 text-white',
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Top Sticky Nav Bar */}
      <div className="hidden sm:block bg-slate-900/90 border-b border-slate-800/80 backdrop-blur sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex items-center justify-around py-2.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`desktop-tab-${tab.id}`}
                  onClick={() => onChangeTab(tab.id)}
                  className={`flex items-center space-x-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-indigo-400/30 scale-102'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.name}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-indigo-700 text-white' : tab.badgeColor
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (5 clean tabs, >=48px touch targets) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-xl px-2 py-2 shadow-2xl safe-bottom">
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`mobile-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition min-h-[48px] relative ${
                  isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {tab.badge !== undefined && (
                    <span className="absolute top-1 right-2 px-1 rounded-full text-[9px] font-bold bg-rose-600 text-white min-w-[14px] text-center shadow">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight font-medium">
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

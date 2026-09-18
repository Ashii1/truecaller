import { memo, useMemo, type ComponentType } from 'react';
import { Clock, Grid3x3, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { TabId } from '../types';
import NavigationTab from './common/NavigationTab';
import { useI18n } from '../i18n/LanguageContext';

interface NavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  spamCallsCount?: number;
  activeRulesCount?: number;
  assistantAlertsCount?: number;
  phoneOnly?: boolean;
}

type NavigationItem = {
  id: TabId;
  name: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  isCenter?: boolean;
};

const Navigation = memo(function Navigation({
  activeTab,
  onChangeTab,
  spamCallsCount = 0,
  activeRulesCount = 0,
  assistantAlertsCount = 0,
  phoneOnly = false,
}: NavigationProps) {
  const { t } = useI18n();

  const tabs = useMemo<NavigationItem[]>(
    () => {
      const all: NavigationItem[] = [
        { id: 'recents', name: t('nav_recents'), icon: Clock, badge: spamCallsCount || undefined },
        { id: 'contacts', name: t('nav_contacts'), icon: Users },
        { id: 'dialer', name: t('dialer_keypad'), icon: Grid3x3, isCenter: true },
        { id: 'protection', name: t('nav_protection'), icon: ShieldCheck, badge: activeRulesCount || undefined },
        { id: 'assistant', name: t('nav_assistant'), icon: Sparkles, badge: assistantAlertsCount || undefined },
      ];
      return phoneOnly ? all.filter(tab => tab.id === 'recents' || tab.id === 'dialer') : all;
    },
    [spamCallsCount, activeRulesCount, assistantAlertsCount, phoneOnly, t],
  );

  const handleSelect = (id: string) => onChangeTab(id as TabId);

  return (
    <nav
      id="ui-floating-navigation"
      aria-label="UI 9.5 Floating Dialer Navigation"
      className="fixed bottom-3 sm:bottom-4 inset-x-0 z-50 pointer-events-none flex justify-center px-3 sm:px-4 pb-[max(env(safe-area-inset-bottom,0px),0px)]"
    >
      <div className="pointer-events-auto flex w-full max-w-[420px] items-center justify-between rounded-full border border-white/[0.12] bg-[#0c1219]/92 backdrop-blur-2xl px-1.5 sm:px-2 py-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06] transition-all">
        {tabs.map((tab) => (
          <NavigationTab
            key={tab.id}
            {...tab}
            active={activeTab === tab.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </nav>
  );
});

export default Navigation;

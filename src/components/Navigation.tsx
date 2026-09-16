import { memo, useMemo, type ComponentType } from 'react';
import { Clock3, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { TabId } from '../types';
import NavigationTab from './common/NavigationTab';
import { useI18n } from '../i18n/LanguageContext';

interface NavigationProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
  spamCallsCount?: number;
  activeRulesCount?: number;
  assistantAlertsCount?: number;
}

type NavigationItem = {
  id: TabId;
  name: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
};

const Navigation = memo(function Navigation({
  activeTab,
  onChangeTab,
  spamCallsCount = 0,
  activeRulesCount = 0,
}: NavigationProps) {
  const { t } = useI18n();

  const tabs = useMemo<NavigationItem[]>(
    () => [
      { id: 'dialer', name: t('nav_phone'), icon: Phone },
      { id: 'recents', name: t('nav_recents'), icon: Clock3, badge: spamCallsCount || undefined },
      { id: 'contacts', name: t('nav_contacts'), icon: UsersRound },
      { id: 'protection', name: t('nav_protection'), icon: ShieldCheck, badge: activeRulesCount || undefined },
    ],
    [spamCallsCount, activeRulesCount, t],
  );

  const handleSelect = (id: string) => onChangeTab(id as TabId);

  return (
    <>
      <div className="hidden sm:block sticky top-16 z-30 px-4 pt-3">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-3xl items-center gap-1 rounded-[22px] border border-white/10 bg-[#10161d]/90 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl"
        >
          {tabs.map((tab) => (
            <NavigationTab
              key={tab.id}
              {...tab}
              active={activeTab === tab.id}
              onSelect={handleSelect}
            />
          ))}
        </nav>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0b1016]/95 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,.35)] backdrop-blur-2xl">
        <nav aria-label="Mobile navigation" className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => (
            <NavigationTab
              key={tab.id}
              {...tab}
              active={activeTab === tab.id}
              mobile
              onSelect={handleSelect}
            />
          ))}
        </nav>
      </div>
    </>
  );
});

export default Navigation;

import React from 'react';
import { useApp } from '../context/AppContext';

export const BottomNav: React.FC = () => {
  const { activeNavTab, setActiveNavTab, navigateTo, setIsSyncModalOpen, pendingSyncCount } = useApp();

  const handleTabClick = (tab: string) => {
    setActiveNavTab(tab);
    if (tab === 'sync') {
      setIsSyncModalOpen(true);
    } else {
      navigateTo('home');
    }
  };

  const navItems = [
    { id: 'home', labelEn: 'Home', labelMl: 'ഹോം', icon: 'dashboard' },
    { id: 'sales', labelEn: 'Sales', labelMl: 'വിൽപ്പന', icon: 'point_of_sale' },
    { id: 'purchases', labelEn: 'Purchases', labelMl: 'ബില്ലുകൾ', icon: 'receipt_long' },
    { id: 'sellers', labelEn: 'Sellers', labelMl: 'സപ്ലയർമാർ', icon: 'groups' },
    { id: 'sync', labelEn: 'Sync', labelMl: 'സിങ്ക്', icon: 'sync', badge: pendingSyncCount > 0 ? String(pendingSyncCount) : undefined },
    { id: 'more', labelEn: 'More', labelMl: 'കൂടുതൽ', icon: 'tune' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50 pb-safe bg-surface/95 backdrop-blur-xl shadow-[0_-1px_12px_rgba(0,0,0,0.06)] border-t border-surface-container">
      <div className="max-w-lg mx-auto flex justify-between items-center h-20 px-space-xs">
        {navItems.map((item) => {
          const isActive = activeNavTab === item.id;
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[56px] flex-1 transition-all py-1 active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-primary-container font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => handleTabClick(item.id)}
              type="button"
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">
                  {item.icon}
                </span>
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 bg-secondary text-on-secondary rounded-full font-label-caption text-[10px] leading-tight font-bold shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="font-label-caption text-label-caption mt-0.5">
                {item.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

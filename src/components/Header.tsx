import React from 'react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  showBack?: boolean;
  title?: string;
  subTitle?: string;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  showBack = false,
  title,
  subTitle = 'Kochi Yard #2',
  onBack
}) => {
  const { currentScreen, goBack, language, toggleLanguage } = useApp();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  };

  const isHome = currentScreen === 'home';
  const displayTitle = title || (isHome ? 'Home' : 'New Weighment');

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-lg mx-auto h-20 px-space-md flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm min-w-0">
          {showBack && (
            <button
              aria-label="Go Back"
              className="w-11 h-11 flex items-center justify-center text-on-surface bg-surface-container hover:bg-surface-container-high rounded-lg transition-colors flex-shrink-0 active:scale-95"
              onClick={handleBack}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          )}

          <img
            alt="Scrapo Brand Logo"
            className="h-8 w-auto object-contain flex-shrink-0 cursor-pointer"
            src="/assets/logo.png"
            onError={(e) => {
              // Fallback to high-contrast industrial SVG logo if asset isn't ready
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse flex-shrink-0"></span>
              <span className="font-label-bold text-label-bold text-on-surface truncate">
                {subTitle} {isHome && '• Live Sync'}
              </span>
            </div>
            <h1 className="font-title-md text-title-md text-primary font-bold truncate">
              {displayTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-space-sm flex-shrink-0">
          <button
            aria-label="Switch Language"
            className="h-11 px-space-sm bg-surface-container-high text-on-surface font-label-bold text-label-bold rounded-lg flex items-center justify-center hover:bg-surface-container-highest active:scale-95 transition-all"
            onClick={toggleLanguage}
            type="button"
          >
            {language === 'en' ? 'EN | മല' : 'മല | EN'}
          </button>

          <button
            aria-label="Worker Profile"
            className="w-11 h-11 rounded-full flex items-center justify-center p-0.5 hover:ring-2 hover:ring-primary/20 transition-all"
            type="button"
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover shadow-inner"
              src="/assets/avatar.png"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

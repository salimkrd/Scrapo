import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Header } from './Header';
import { ScrapCategory, LegacyMaterialCompat } from '../types';

export const MaterialSelection: React.FC = () => {
  const {
    navigateTo,
    goBack,
    allMaterials,
    selectedMaterialIds,
    toggleMaterialSelection,
    clearMaterialSelection,
    setActiveMaterial,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ScrapCategory>('all');

  const categories: { id: ScrapCategory; label: string; icon?: string }[] = [
    { id: 'all', label: `All (${allMaterials.length})` },
    { id: 'fav', label: 'Favorites (6)', icon: 'star' },
    { id: 'recent', label: 'Recently Used (8)', icon: 'schedule' },
    { id: 'metals', label: 'Metals / ലോഹങ്ങൾ' },
    { id: 'paper', label: 'Paper / പേപ്പർ' },
    { id: 'plastic', label: 'Plastic' },
  ];

  const filteredMaterials = useMemo(() => {
    return allMaterials.filter((material) => {
      // Category match
      let matchesCategory = true;
      if (selectedCategory === 'fav') {
        matchesCategory = Boolean(material.isFavorite);
      } else if (selectedCategory === 'recent') {
        matchesCategory = Boolean(material.isRecent);
      } else if (selectedCategory !== 'all') {
        matchesCategory = material.category === selectedCategory;
      }

      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        material.name.toLowerCase().includes(q) ||
        material.nameMl.includes(q) ||
        material.gradeEn.toLowerCase().includes(q) ||
        material.standardB2BTerm.toLowerCase().includes(q) ||
        material.keywords.some((k) => k.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [allMaterials, selectedCategory, searchQuery]);

  const handleVoiceSearchSim = () => {
    const hints = ['Irumbu', 'Chembu', 'അട്ട', 'Takaram', 'Petti', 'Kuppi'];
    const randomHint = hints[Math.floor(Math.random() * hints.length)];
    setSearchQuery(randomHint);
  };

  const handleProceedToWeight = () => {
    if (selectedMaterialIds.size === 0) return;
    const selectedList = allMaterials.filter((m) => selectedMaterialIds.has(m.id));
    if (selectedList.length > 0) {
      setActiveMaterial(selectedList[0]);
    }
    navigateTo('weight_entry');
  };

  const handleDirectCardSelect = (mat: LegacyMaterialCompat) => {
    toggleMaterialSelection(mat.id);
  };

  const selectedCount = selectedMaterialIds.size;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <Header showBack onBack={goBack} title="New Weighment" />

      <main className="flex flex-col relative w-full max-w-lg mx-auto px-space-md pt-24 pb-safe bg-surface flex-1">
        <div className="flex flex-col w-full pb-28">
          {/* Step 1 Progress Bar */}
          <div className="bg-surface-container-low px-space-md py-space-sm rounded-xl mb-space-md shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-bold text-label-bold flex items-center justify-center">
                  1
                </span>
                <span className="font-label-bold text-label-bold text-primary">
                  Step 1 of 3: Weighment Material
                </span>
              </div>
              <span className="font-label-caption text-label-caption text-on-surface-variant font-bold uppercase tracking-wider">
                വേ ബ്രിഡ്ജ് സ്കെയിൽ
              </span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-1/3 rounded-full transition-all duration-300"></div>
            </div>
          </div>

          {/* Search Bar & Voice Search */}
          <div className="flex flex-col gap-space-sm mb-space-md">
            <div className="relative flex items-center w-full shadow-sm rounded-xl">
              <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[22px]">search</span>
              </div>
              <input
                className="w-full h-14 pl-11 pr-20 rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 select-all"
                placeholder="Search (e.g., Irumbu, Copper, അട്ട, Petti)..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    aria-label="Clear Search"
                    className="w-8 h-8 flex items-center justify-center text-outline hover:text-on-surface"
                    type="button"
                    onClick={() => setSearchQuery('')}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
                <button
                  aria-label="Voice Search"
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container text-primary active:bg-primary active:text-on-primary transition-colors cursor-pointer"
                  type="button"
                  onClick={handleVoiceSearchSim}
                  title="Voice Search simulation"
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>
              </div>
            </div>

            {/* Filter Chips Horizontal Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar -mx-space-md px-space-md">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`filter-chip flex-shrink-0 h-10 px-3.5 rounded-lg font-label-bold text-label-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                    }`}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.icon && (
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          cat.id === 'fav'
                            ? isActive
                              ? 'text-yellow-300'
                              : 'text-secondary'
                            : ''
                        }`}
                        style={cat.id === 'fav' ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {cat.icon}
                      </span>
                    )}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Materials Grid (2 Columns) */}
          {filteredMaterials.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              {filteredMaterials.map((mat) => {
                const isSelected = selectedMaterialIds.has(mat.id);

                const stripeBg =
                  mat.accentColor === 'secondary'
                    ? 'bg-secondary'
                    : mat.accentColor === 'secondary-container'
                    ? 'bg-secondary-container'
                    : mat.accentColor === 'tertiary'
                    ? 'bg-tertiary'
                    : 'bg-primary';

                return (
                  <div
                    key={mat.id}
                    aria-checked={isSelected}
                    className={`material-card group relative rounded-xl p-3 min-h-[126px] flex flex-col justify-between shadow-sm active:translate-y-0.5 transition-all cursor-pointer overflow-hidden border ${
                      isSelected
                        ? 'bg-surface-container-high border-primary ring-2 ring-primary/40'
                        : 'bg-surface-container-lowest border-transparent hover:border-surface-container-high'
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleDirectCardSelect(mat)}
                  >
                    {/* Left category accent bar */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${stripeBg}`}></div>

                    <div className="flex items-start justify-between pl-1">
                      <div className="flex flex-col min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <span className="font-title-md text-title-md text-on-surface font-bold truncate">
                            {mat.name}
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant flex-shrink-0">
                            {mat.icon}
                          </span>
                        </div>
                        <span className="font-body-sm text-body-sm text-primary font-bold">
                          {mat.nameMl}
                        </span>
                        <span className="font-label-caption text-label-caption text-on-surface-variant truncate mt-0.5" title={mat.standardB2BTerm}>
                          {mat.gradeEn}
                        </span>
                      </div>

                      {/* Check circle */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-outline'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] transition-opacity ${
                            isSelected ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          check
                        </span>
                      </div>
                    </div>

                    {/* Bottom Rate & Tag Strip */}
                    <div
                      className={`flex items-center justify-between mt-2 pt-2 -mx-3 -mb-3 px-3 py-2 ${
                        mat.accentColor === 'secondary-container'
                          ? 'bg-secondary-fixed/40'
                          : 'bg-surface-container-low'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-label-caption text-label-caption text-on-surface-variant leading-none">
                          {mat.badge === 'PRIME' ? 'High Value' : 'Market Rate'}
                        </span>
                        <span
                          className={`font-label-bold text-label-bold font-extrabold mt-0.5 ${
                            mat.accentColor === 'secondary-container'
                              ? 'text-secondary'
                              : isSelected
                              ? 'text-primary'
                              : 'text-on-surface'
                          }`}
                        >
                          ₹{mat.rate}{' '}
                          <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">
                            / kg
                          </span>
                        </span>
                      </div>

                      {mat.badge ? (
                        <span
                          className={`font-label-caption text-label-caption px-1.5 py-0.5 rounded font-bold ${
                            mat.badge === 'PRIME'
                              ? 'bg-secondary text-on-secondary'
                              : mat.badge === 'POPULAR'
                              ? 'bg-primary text-on-primary'
                              : 'text-on-tertiary-container bg-tertiary-fixed-dim/30'
                          }`}
                        >
                          {mat.badge}
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-outline text-[18px]">
                          touch_app
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 px-space-md text-center bg-surface-container-low rounded-2xl mt-4">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-3">
                <span className="material-symbols-outlined text-[32px]">inventory</span>
              </div>
              <span className="font-title-md text-title-md text-on-surface font-bold">
                No scrap material found
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                സാധനം കണ്ടെത്തിയില്ല. Try clearing your search or filter.
              </span>
              <button
                className="mt-4 px-4 h-10 bg-primary text-on-primary font-label-bold text-label-bold rounded-lg shadow-sm active:scale-95 transition-transform cursor-pointer"
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                Show All Materials
              </button>
            </div>
          )}

          {/* Fixed Floating Bottom Cart Pill */}
          <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto pointer-events-none">
            <div
              className="pointer-events-auto bg-inverse-surface text-inverse-on-surface px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-200"
              id="cart-pill"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary relative shadow-inner">
                  <span className="material-symbols-outlined text-[20px]">scale</span>
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container font-label-bold text-[10px] flex items-center justify-center font-bold shadow">
                    {selectedCount}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-bold text-label-bold text-inverse-on-surface">
                    {selectedCount === 0
                      ? '0 Materials Selected'
                      : selectedCount === 1
                      ? '1 Material Selected'
                      : `${selectedCount} Materials Selected`}
                  </span>
                  <span className="font-label-caption text-label-caption text-surface-dim">
                    {selectedCount > 0 ? 'തുടരാൻ ടാപ്പ് ചെയ്യുക' : 'മെറ്റീരിയൽ തിരഞ്ഞെടുക്കുക'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <button
                    className="text-xs text-surface-dim hover:text-white underline mr-1"
                    type="button"
                    onClick={clearMaterialSelection}
                  >
                    Clear
                  </button>
                )}
                <button
                  className={`h-11 px-5 rounded-xl font-label-bold text-label-bold flex items-center gap-1.5 transition-all shadow-md ${
                    selectedCount > 0
                      ? 'bg-secondary-container text-on-secondary-container active:scale-95 cursor-pointer'
                      : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                  }`}
                  disabled={selectedCount === 0}
                  type="button"
                  onClick={handleProceedToWeight}
                >
                  <span>Weigh</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

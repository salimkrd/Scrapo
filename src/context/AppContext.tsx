import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Screen,
  Language,
  LegacyMaterialCompat,
  TicketItem,
  PurchaseSlip,
  PaymentMode,
  Payment,
  Seller,
  ResolvedMaterialView,
  Purchase,
} from '../types';
import { seedService, DEFAULT_YARD_ID } from '../services/seedService';
import { materialRepository } from '../repositories/materialRepository';
import { rateRepository } from '../repositories/rateRepository';
import { sellerRepository } from '../repositories/sellerRepository';
import { purchaseRepository } from '../repositories/purchaseRepository';
import { syncRepository } from '../repositories/syncRepository';
import { procurementService } from '../services/procurementService';
import { DEMO_CONFIG, YardNotice } from '../data/config';

interface AppContextType {
  currentScreen: Screen;
  navigateTo: (screen: Screen) => void;
  goBack: () => void;
  language: Language;
  toggleLanguage: () => void;
  t: (en: string, ml: string) => string;

  // Material selection & Taxonomy
  allMaterials: LegacyMaterialCompat[];
  selectedMaterialIds: Set<string>;
  toggleMaterialSelection: (materialId: string) => void;
  clearMaterialSelection: () => void;
  getSelectedMaterialsList: () => LegacyMaterialCompat[];
  updateTodayRate: (materialId: string, newRate: number) => Promise<void>;
  updateLocalAlias: (aliasId: string, englishName: string, malayalamName: string, subtitle: string) => Promise<void>;

  // Weighing & Active Ticket state
  activeMaterial: LegacyMaterialCompat | null;
  setActiveMaterial: (m: LegacyMaterialCompat | null) => void;
  ticketItems: TicketItem[];
  addTicketItem: (item: TicketItem) => void;
  removeTicketItem: (itemId: string) => void;
  clearTicket: () => void;

  // Active Seller & Purchases
  allSellers: Seller[];
  activeSeller: Seller;
  setActiveSeller: (s: Seller) => void;
  createSeller: (data: {
    name: string;
    nameMl: string;
    phone: string;
    type: string;
    vehicleNumber?: string;
  }) => Promise<Seller>;
  settleSellerBalance: (
    sellerId: string,
    amount: number,
    paymentMode: PaymentMode,
    notes?: string
  ) => Promise<Payment>;
  reloadData: () => Promise<void>;
  sellerLedger: { totalPurchaseValue: number; totalPaid: number; outstandingBalance: number } | null;
  recentSlips: PurchaseSlip[];
  completePurchase: (
    method: PaymentMode,
    isDraft?: boolean,
    splitBreakdown?: { mode: PaymentMode; amount: number }[]
  ) => Promise<PurchaseSlip>;

  // Modals & UI helpers
  viewingSlip: PurchaseSlip | null;
  setViewingSlip: (slip: PurchaseSlip | null) => void;
  isRatesModalOpen: boolean;
  setIsRatesModalOpen: (open: boolean) => void;
  isScaleModalOpen: boolean;
  setIsScaleModalOpen: (open: boolean) => void;
  isSellerPickerOpen: boolean;
  setIsSellerPickerOpen: (open: boolean) => void;
  isSyncModalOpen: boolean;
  setIsSyncModalOpen: (open: boolean) => void;

  // Scale simulation
  scaleConnected: boolean;
  setScaleConnected: (connected: boolean) => void;
  scaleGross: number;
  setScaleGross: (val: number) => void;
  scaleTare: number;
  setScaleTare: (val: number) => void;
  zeroTareScale: () => void;

  // Sync Queue
  pendingSyncCount: number;
  processSyncQueue: () => Promise<void>;

  // Bottom Navigation tab & Notices
  activeNavTab: string;
  setActiveNavTab: (tab: string) => void;
  yardNotices: YardNotice[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapResolvedToLegacy(view: ResolvedMaterialView): LegacyMaterialCompat {
  let cat: 'metals' | 'paper' | 'plastic' = 'metals';
  if (view.material.masterCategory === 'Paper') {
    cat = 'paper';
  } else if (view.material.masterCategory === 'Plastic') {
    cat = 'plastic';
  }

  return {
    id: view.material.id,
    name: view.primaryAlias.displayNameEnglish,
    nameMl: view.primaryAlias.displayNameMalayalam,
    gradeEn: view.primaryAlias.localSubtitle,
    standardB2BTerm: view.material.standardName,
    rate: view.activePurchaseRate,
    category: cat,
    isFavorite: view.primaryAlias.badgeType === 'secondary' || view.primaryAlias.badgeType === 'primary',
    isRecent: true,
    accentColor: view.material.accentColor,
    badge: view.primaryAlias.badge,
    badgeType: view.primaryAlias.badgeType,
    icon: view.material.icon,
    defaultTare: view.primaryAlias.defaultTare,
    keywords: view.primaryAlias.keywords,
    rawMaterial: view.material,
    rawAlias: view.primaryAlias,
    rawRate: view.currentRate,
  };
}

function purchaseToSlip(p: Purchase): PurchaseSlip {
  const primary = p.items[0];
  const dateObj = new Date(p.createdAt);
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return {
    ...p,
    primaryMaterialName: primary ? `${primary.materialNameSnapshot} (${primary.standardB2BTermSnapshot})` : 'Mixed Scrap',
    primaryMaterialMl: primary ? primary.materialMlSnapshot : '',
    totalWeight: p.totalNetWeight,
    ratePerKg: primary ? primary.ratePerKg : 0,
    timestamp: timeStr,
    date: 'Today',
    vehicleNumber: p.sellerSnapshot.vehicleNumber || 'Hand Carry',
    paymentMethod: p.primaryPaymentMode,
    status: p.paymentStatus === 'PAID' ? 'paid' : p.paymentStatus === 'DRAFT' ? 'draft' : 'pending',
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [screenHistory, setScreenHistory] = useState<Screen[]>(['home']);
  const [language, setLanguage] = useState<Language>('en');

  // Database loaded state
  const [allMaterials, setAllMaterials] = useState<LegacyMaterialCompat[]>([]);
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const [activeSeller, setActiveSeller] = useState<Seller>({
    id: 'seller_shaji_01',
    yardId: DEFAULT_YARD_ID,
    initials: 'KS',
    name: 'K.K. Shaji',
    nameMl: 'ഷാജി',
    type: 'Local Collector',
    phone: '+91 98471 22910',
    badge: 'Regular Seller',
    vehicleNumber: 'KL-07-CR-4412',
    upiId: 'shaji.scrapo@okaxis',
    bankName: 'Federal Bank',
    bankAccount: '•••• 8821',
    ifsc: 'FDRL0001244',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [sellerLedger, setSellerLedger] = useState<{ totalPurchaseValue: number; totalPaid: number; outstandingBalance: number } | null>(null);
  const [recentSlips, setRecentSlips] = useState<PurchaseSlip[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Material selection & active ticket
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [activeMaterial, setActiveMaterial] = useState<LegacyMaterialCompat | null>(null);
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);

  // Modals
  const [viewingSlip, setViewingSlip] = useState<PurchaseSlip | null>(null);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isSellerPickerOpen, setIsSellerPickerOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Hardware scale state
  const [scaleConnected, setScaleConnected] = useState(true);
  const [scaleGross, setScaleGross] = useState<number>(44.0);
  const [scaleTare, setScaleTare] = useState<number>(1.5);

  // Navigation tab & Notices
  const [activeNavTab, setActiveNavTab] = useState<string>('home');
  const [yardNotices] = useState<YardNotice[]>(DEMO_CONFIG.activeNotices);

  // Reload everything from IndexedDB
  const reloadData = useCallback(async () => {
    // 1. Seed if first time
    await seedService.seedInitialData();

    // 2. Load materials
    const resolved = await materialRepository.getResolvedMaterials(DEFAULT_YARD_ID);
    const legacyMapped = resolved.map(mapResolvedToLegacy);
    setAllMaterials(legacyMapped);
    if (!activeMaterial && legacyMapped.length > 4) {
      setActiveMaterial(legacyMapped[4]); // default to Atta (OCC)
    }

    // 3. Load sellers
    const sellers = await sellerRepository.getAllSellers(DEFAULT_YARD_ID);
    setAllSellers(sellers);
    if (sellers.length > 0 && !activeSeller.id) {
      setActiveSeller(sellers[0]);
    }

    // 4. Load purchases
    const purchases = await purchaseRepository.getAllPurchases(DEFAULT_YARD_ID);
    const slips = purchases.map(purchaseToSlip);
    setRecentSlips(slips);

    // 5. Load pending sync count
    const pending = await syncRepository.getPendingCount(DEFAULT_YARD_ID);
    setPendingSyncCount(pending);

    // 6. Refresh seller ledger
    if (activeSeller?.id) {
      const ledger = await sellerRepository.getSellerLedger(activeSeller.id);
      setSellerLedger(ledger);
    }
  }, [activeMaterial, activeSeller?.id]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  useEffect(() => {
    if (activeSeller?.id) {
      sellerRepository.getSellerLedger(activeSeller.id).then((l) => setSellerLedger(l));
    }
  }, [activeSeller?.id]);

  const navigateTo = (screen: Screen) => {
    setScreenHistory((prev) => [...prev, screen]);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (screenHistory.length > 1) {
      const nextHistory = [...screenHistory];
      nextHistory.pop();
      const prevScreen = nextHistory[nextHistory.length - 1];
      setScreenHistory(nextHistory);
      setCurrentScreen(prevScreen);
    } else {
      setCurrentScreen('home');
    }
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ml' : 'en'));
  };

  const t = (en: string, ml: string): string => {
    return language === 'ml' ? ml : en;
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const clearMaterialSelection = () => {
    setSelectedMaterialIds(new Set());
  };

  const getSelectedMaterialsList = (): LegacyMaterialCompat[] => {
    return allMaterials.filter((m) => selectedMaterialIds.has(m.id));
  };

  const addTicketItem = (item: TicketItem) => {
    setTicketItems((prev) => [...prev, item]);
  };

  const removeTicketItem = (itemId: string) => {
    setTicketItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearTicket = () => {
    setTicketItems([]);
    setSelectedMaterialIds(new Set());
  };

  const zeroTareScale = () => {
    setScaleTare(0.0);
  };

  // Update today's material rate in RateRepository (keeps past purchase price snapshots unchanged)
  const updateTodayRate = async (materialId: string, newRate: number) => {
    const mat = allMaterials.find((m) => m.id === materialId);
    if (!mat) return;
    await rateRepository.setRate(
      materialId,
      DEFAULT_YARD_ID,
      newRate,
      mat.rawMaterial?.expectedSellingRate || newRate * 1.15
    );
    await reloadData();
  };

  // Update local worker-facing alias without altering standard B2B taxonomy
  const updateLocalAlias = async (
    aliasId: string,
    englishName: string,
    malayalamName: string,
    subtitle: string
  ) => {
    await materialRepository.updateAlias(aliasId, {
      displayNameEnglish: englishName,
      displayNameMalayalam: malayalamName,
      localSubtitle: subtitle,
    });
    await reloadData();
  };

  const createSeller = async (data: {
    name: string;
    nameMl: string;
    phone: string;
    type: string;
    vehicleNumber?: string;
  }): Promise<Seller> => {
    const initials = data.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newSeller: Seller = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `seller_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      yardId: DEFAULT_YARD_ID,
      initials: initials || 'NW',
      name: data.name,
      nameMl: data.nameMl || data.name,
      type: data.type || 'Walk-in Seller',
      phone: data.phone,
      badge: 'New Seller',
      vehicleNumber: data.vehicleNumber,
      upiId: `${data.phone.replace(/[^0-9]/g, '')}@upi`,
      bankName: 'Federal Bank',
      bankAccount: '•••• 0000',
      ifsc: 'FDRL0001244',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await sellerRepository.saveSeller(newSeller);
    await reloadData();
    setActiveSeller(newSeller);
    return newSeller;
  };

  const settleSellerBalance = async (
    sellerId: string,
    amount: number,
    paymentMode: PaymentMode,
    notes?: string
  ): Promise<Payment> => {
    const payment = await sellerRepository.recordSettlementPayment(
      DEFAULT_YARD_ID,
      sellerId,
      amount,
      paymentMode,
      notes
    );
    await syncRepository.addToQueue(
      DEFAULT_YARD_ID,
      'PAYMENT',
      payment.id,
      'INSERT',
      payment
    );
    await reloadData();
    return payment;
  };

  // Execute complete procurement transaction
  const completePurchase = async (
    method: PaymentMode,
    isDraft = false,
    splitBreakdown?: { mode: PaymentMode; amount: number }[]
  ): Promise<PurchaseSlip> => {
    // Collect line items
    const itemsToRecord =
      ticketItems.length > 0
        ? ticketItems.map((it) => ({
            material: it.material,
            grossWeight: it.grossWeight,
            tareWeight: it.tareWeight,
            netWeight: it.netWeight,
            ratePerKg: it.ratePerKg,
            lineAmount: it.total,
            weightSource: it.weightSource || 'SIMULATED_SCALE',
            scaleDeviceId: it.scaleDeviceId || 'CAS-CI-2001-YARD02',
            rawWeight: it.grossWeight,
            tareActive: it.tareActive,
          }))
        : [
            {
              material: activeMaterial || allMaterials[4],
              grossWeight: 44.0,
              tareWeight: 1.5,
              netWeight: 42.5,
              ratePerKg: activeMaterial ? activeMaterial.rate : 18,
              lineAmount: 42.5 * (activeMaterial ? activeMaterial.rate : 18),
              weightSource: 'SIMULATED_SCALE' as const,
              scaleDeviceId: 'CAS-CI-2001-YARD02',
              rawWeight: 44.0,
              tareActive: true,
            },
          ];

    const created = await procurementService.executePurchase({
      yardId: DEFAULT_YARD_ID,
      seller: activeSeller,
      items: itemsToRecord,
      paymentMode: method,
      splitBreakdown,
      isDraft,
    });

    const slip = purchaseToSlip(created);
    await reloadData();
    return slip;
  };

  // Process offline sync queue
  const processSyncQueue = async () => {
    await syncRepository.processSyncQueue(DEFAULT_YARD_ID);
    await reloadData();
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        navigateTo,
        goBack,
        language,
        toggleLanguage,
        t,
        allMaterials,
        selectedMaterialIds,
        toggleMaterialSelection,
        clearMaterialSelection,
        getSelectedMaterialsList,
        updateTodayRate,
        updateLocalAlias,
        activeMaterial,
        setActiveMaterial,
        ticketItems,
        addTicketItem,
        removeTicketItem,
        clearTicket,
        allSellers,
        activeSeller,
        setActiveSeller,
        createSeller,
        settleSellerBalance,
        reloadData,
        sellerLedger,
        recentSlips,
        completePurchase,
        viewingSlip,
        setViewingSlip,
        isRatesModalOpen,
        setIsRatesModalOpen,
        isScaleModalOpen,
        setIsScaleModalOpen,
        isSellerPickerOpen,
        setIsSellerPickerOpen,
        isSyncModalOpen,
        setIsSyncModalOpen,
        scaleConnected,
        setScaleConnected,
        scaleGross,
        setScaleGross,
        scaleTare,
        setScaleTare,
        zeroTareScale,
        pendingSyncCount,
        processSyncQueue,
        activeNavTab,
        setActiveNavTab,
        yardNotices,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

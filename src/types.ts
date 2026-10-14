export * from './types/domain';

export type Screen = 'home' | 'material_selection' | 'weight_entry' | 'payment';

export type Language = 'en' | 'ml';

export type ScrapCategory = 'all' | 'fav' | 'recent' | 'metals' | 'paper' | 'plastic';

// Legacy UI compatibility aliases pointing to domain contracts
import {
  Material,
  MaterialAlias,
  MaterialRate,
  ResolvedMaterialView,
  PurchaseItem,
  Purchase,
  Seller,
  PaymentMode,
} from './types/domain';

export type { Material, MaterialAlias, MaterialRate, ResolvedMaterialView, PurchaseItem, Purchase, Seller };

// Convenience UI interfaces
export interface LegacyMaterialCompat {
  id: string;
  name: string;
  nameMl: string;
  gradeEn: string;
  standardB2BTerm: string;
  rate: number;
  category: 'metals' | 'paper' | 'plastic';
  isFavorite?: boolean;
  isRecent?: boolean;
  accentColor: 'primary' | 'secondary' | 'secondary-container' | 'tertiary';
  badge?: string;
  badgeType?: 'primary' | 'secondary' | 'tertiary';
  icon: string;
  defaultTare: number;
  keywords: string[];
  rawMaterial: Material;
  rawAlias: MaterialAlias;
  rawRate: MaterialRate;
}

export type TicketItem = PurchaseItem & {
  material: LegacyMaterialCompat;
  total: number;
};

export type PurchaseSlip = Purchase & {
  primaryMaterialName: string;
  primaryMaterialMl: string;
  totalWeight: number;
  ratePerKg: number;
  timestamp: string;
  date: string;
  vehicleNumber?: string;
  paymentMethod: PaymentMode;
  status: 'paid' | 'pending' | 'draft';
};

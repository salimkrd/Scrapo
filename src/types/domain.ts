// Core Domain Models for Scrapo Yard Management System

export type MasterCategory =
  | 'Iron/Steel'
  | 'Copper'
  | 'Brass/Bronze'
  | 'Paper'
  | 'Plastic'
  | 'Batteries'
  | 'Other';

export type WeightUnit = 'KG' | 'TON' | 'PCS';

export type WeightSource = 'MANUAL' | 'SIMULATED_SCALE' | 'BLUETOOTH_SCALE' | 'IOT_SCALE';

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT' | 'SPLIT';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'DRAFT';

export type MovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'LOSS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'LOT_CREATE_OUT'
  | 'LOT_CREATE_IN'
  | 'DISPATCH_OUT';


export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface User {
  id: string; // UUID
  yardId: string;
  name: string;
  role: 'OPERATOR' | 'SUPERVISOR' | 'YARD_MANAGER' | 'ADMIN';
  phone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Yard {
  id: string; // UUID
  code: string;
  name: string;
  nameMalayalam: string;
  district: string;
  location: string;
  scaleIdentifier: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialCategory {
  id: string;
  name: MasterCategory;
  nameMalayalam: string;
  displayOrder: number;
}

export interface Material {
  id: string; // UUID
  yardId: string;
  masterCategory: MasterCategory;
  standardName: string; // e.g., "Heavy Melting Scrap / TMT Rebar"
  standardCode: string; // e.g., "HMS-01"
  unit: WeightUnit;
  active: boolean;
  expectedSellingRate: number;
  icon: string;
  accentColor: 'primary' | 'secondary' | 'secondary-container' | 'tertiary';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MaterialAlias {
  id: string; // UUID
  materialId: string;
  yardId: string;
  displayNameEnglish: string; // Worker facing (e.g. "Irumbu", "Takaram", "Petti")
  displayNameMalayalam: string; // Worker facing (e.g. "ഇരുമ്പ്", "തകരം", "പെട്ടി")
  localSubtitle: string; // e.g. "ഇരുമ്പ് കമ്പി", "തകരം ഷീറ്റ്", "പിപി ക്രേറ്റ്സ്"
  district: string;
  isPrimary: boolean;
  defaultTare: number;
  badge?: string;
  badgeType?: 'primary' | 'secondary' | 'tertiary';
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRate {
  id: string; // UUID
  materialId: string;
  yardId: string;
  purchaseRate: number; // ₹/unit
  sellingRate: number; // ₹/unit
  effectiveFrom: string; // ISO date
  effectiveTo?: string; // ISO date or undefined if current
  version?: number;
  createdBy: string;
  createdAt: string;
}

// Combined view model for UI consumption
export interface ResolvedMaterialView {
  material: Material;
  primaryAlias: MaterialAlias;
  currentRate: MaterialRate;
  activePurchaseRate: number;
  stockBalanceKg: number;
}

export interface Seller {
  id: string; // UUID
  yardId: string;
  initials: string;
  name: string;
  nameMl: string;
  type: string;
  phone: string;
  badge: string;
  vehicleNumber?: string;
  upiId: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerLedgerSummary {
  sellerId: string;
  totalPurchaseValue: number;
  totalPaid: number;
  outstandingBalance: number;
  transactionsCount: number;
  lastTransactionAt?: string;
}

export interface PurchaseItem {
  id: string; // UUID
  purchaseId: string;
  materialId: string;
  materialAliasId: string;
  // Snapshots at time of weighment to preserve historical fidelity
  materialNameSnapshot: string;
  materialMlSnapshot: string;
  standardB2BTermSnapshot: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  ratePerKg: number; // Price snapshot - never recalculated
  lineAmount: number;
  weightSource: WeightSource;
  scaleDeviceId?: string;
  rawWeight?: number;
  tareActive: boolean;
  createdAt: string;
}

export interface Payment {
  id: string; // UUID
  purchaseId: string;
  yardId: string;
  sellerId: string;
  paymentMode: PaymentMode;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface Purchase {
  id: string; // Stable UUID generated on device (Idempotency Key)
  yardId: string;
  slipNumber: string; // e.g. #SC-8943
  sellerId: string;
  sellerSnapshot: Seller;
  totalGrossWeight: number;
  totalTareWeight: number;
  totalNetWeight: number;
  subtotalAmount: number;
  roundOff: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  primaryPaymentMode: PaymentMode;
  notes?: string;
  items: PurchaseItem[];
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface InventoryMovement {
  id: string; // UUID
  yardId: string;
  materialId: string;
  referenceType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  referenceId: string; // purchaseId or saleId
  movementType: MovementType;
  quantity: number; // positive for additions, negative for reductions
  unit: WeightUnit;
  unitCost: number;
  createdAt: string;
  createdBy: string;
}

export interface InventoryBalance {
  yardId: string;
  materialId: string;
  currentStock: number;
  lastMovementAt: string;
  updatedAt: string;
}

export interface SyncRecord {
  localId: string; // UUID
  yardId: string;
  entityType: 'PURCHASE' | 'PAYMENT' | 'INVENTORY_MOVEMENT' | 'RATE_UPDATE' | 'SELLER';
  entityId: string; // Stable UUID of the entity
  operation: SyncOperation;
  payload: any;
  status: SyncStatus;
  retryCount: number;
  lastAttemptAt?: string;
  createdAt: string;
  error?: string;
}

export interface AuditLog {
  id: string; // UUID
  yardId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  performedBy: string;
  createdAt: string;
}

// Phase 3 B2B Sales Cycle Domain Models

export interface Buyer {
  id: string; // UUID
  yardId: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstin?: string;
  billingAddress: string;
  shippingAddress: string;
  state: string;
  pincode: string;
  paymentTermsDays: number;
  creditLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

export interface BuyerLedgerTransaction {
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE';
  referenceId: string;
  referenceNumber: string;
  debit: number;
  credit: number;
  runningBalance: number;
  notes?: string;
}

export interface BuyerLedgerSummary {
  buyerId: string;
  companyName: string;
  creditLimit: number;
  totalSales: number;
  totalReceived: number;
  outstandingBalance: number;
  overdueAmount: number;
  transactionHistory: BuyerLedgerTransaction[];
}

export type LotStatus =
  | 'PREPARING'
  | 'READY'
  | 'RESERVED'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'CLOSED'
  | 'CANCELLED';

export interface Lot {
  id: string; // UUID
  yardId: string;
  lotNumber: string; // e.g. LOT-2026-0048
  materialId: string;
  standardB2BName: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  availableWeight: number;
  status: LotStatus;
  warehouseLocation: string; // e.g. Bay A3
  notes?: string;
  createdAt: string;
  createdBy: string;
  version: number;
}

export interface LotStockSummary {
  materialId: string;
  standardName: string;
  totalStock: number;
  looseStock: number;
  lotStock: number;
  reservedStock: number;
  availableStock: number;
}

export type SalesOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED';

export interface SalesItem {
  id: string; // UUID
  salesOrderId: string;
  materialId: string;
  lotId?: string;
  descriptionSnapshot: string;
  standardB2BNameSnapshot: string;
  hsnCodeSnapshot: string;
  weight: number;
  unit: WeightUnit;
  ratePerKg: number;
  lineAmount: number;
  taxRate: number;
}

export interface SalesOrder {
  id: string; // UUID
  yardId: string;
  orderNumber: string;
  buyerId: string;
  buyerSnapshot?: Buyer;
  orderDate: string;
  status: SalesOrderStatus;
  subtotal: number;
  transportCharge: number;
  loadingCharge: number;
  otherCharge: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: SalesItem[];
}

export type DispatchStatus =
  | 'PLANNED'
  | 'LOADING'
  | 'WEIGHED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Dispatch {
  id: string; // UUID
  yardId: string;
  dispatchNumber: string;
  salesOrderId: string;
  buyerId: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  transportCompany?: string;
  dispatchDate: string;
  grossVehicleWeight: number;
  tareVehicleWeight: number;
  netDispatchWeight: number;
  weighbridgeSlipNumber?: string;
  notes?: string;
  status: DispatchStatus;
  createdBy: string;
  createdAt: string;
}

export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface Invoice {
  id: string; // UUID
  yardId: string;
  invoiceNumber: string; // SCR/26-27/000148
  salesOrderId: string;
  buyerId: string;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  sellerProfileSnapshot: BusinessProfile;
  buyerSnapshot: Buyer;
  itemsSnapshot: SalesItem[];
  subtotal: number;
  loadingCharge: number;
  transportCharge: number;
  otherCharge: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BuyerPaymentMethod =
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CREDIT_ADJUSTMENT';

export interface BuyerPayment {
  id: string; // UUID
  yardId: string;
  buyerId: string;
  salesOrderId?: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: BuyerPaymentMethod;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string; // UUID
  yardId: string;
  legalName: string;
  tradeName: string;
  address: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  pan?: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  logoUrl: string;
  isGstRegistered: boolean;
  defaultTaxRate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesDashboardMetrics {
  todaySales: number;
  thisMonthSales: number;
  grossSalesValue: number;
  buyerReceivables: number;
  pendingDispatch: number;
  readyLots: number;
  topBuyer: string;
  topSellingMaterial: string;
}


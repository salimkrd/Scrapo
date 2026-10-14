import { db, STORES } from '../storage/indexedDb';
import {
  Yard,
  Material,
  MaterialAlias,
  MaterialRate,
  Seller,
  Purchase,
  PurchaseItem,
  Payment,
  InventoryMovement,
  InventoryBalance,
  Buyer,
  Lot,
  BusinessProfile,
  SalesOrder,
  Invoice,
} from '../types/domain';

export const DEFAULT_YARD_ID = 'yard_kochi_02';
export const DEFAULT_OPERATOR_ID = 'user_anoop_kumar';

export class SeedService {
  async isDatabaseSeeded(): Promise<boolean> {
    const materials = await db.getAll<Material>(STORES.MATERIALS);
    return materials.length > 0;
  }

  async seedInitialData(): Promise<void> {
    if (await this.isDatabaseSeeded()) {
      await this.seedPhase3DataIfEmpty();
      return;
    }

    const now = new Date().toISOString();

    // 1. Yard
    const yard: Yard = {
      id: DEFAULT_YARD_ID,
      code: 'YARD-02',
      name: 'Sri Balaji Scrap Yard',
      nameMalayalam: 'ശ്രീ ബാലാജി സ്ക്രാപ്പ് യാർഡ് (കൊച്ചി #2)',
      district: 'Ernakulam',
      location: 'Kalamassery, Kochi',
      scaleIdentifier: 'CAS-CI-2001-YARD02',
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.put(STORES.YARDS, yard);

    // 2. Corrected Materials & Taxonomy
    // Structure: Master Category → Local Alias → Standard B2B Term
    const materialData = [
      {
        id: 'mat_iron_hms',
        masterCategory: 'Iron/Steel' as const,
        standardName: 'Heavy Melting Scrap / TMT Rebar',
        standardCode: 'HMS-01',
        unit: 'KG' as const,
        expectedSellingRate: 36,
        icon: 'hardware',
        accentColor: 'primary' as const,
        alias: {
          id: 'alias_irumbu',
          displayNameEnglish: 'Irumbu',
          displayNameMalayalam: 'ഇരുമ്പ്',
          localSubtitle: 'ഇരുമ്പ് കമ്പി (Kambi)',
          district: 'Ernakulam',
          defaultTare: 2.0,
          badge: '2m ago',
          badgeType: 'tertiary' as const,
          keywords: ['irumbu', 'kambi', 'iron', 'steel', 'ഇരുമ്പ്', 'hms', 'tmt'],
        },
        rate: 32,
        initialStock: 2450,
      },
      {
        id: 'mat_iron_tin',
        masterCategory: 'Iron/Steel' as const,
        standardName: 'Lightweight Tin / MS Sheet Scrap',
        standardCode: 'MS-TIN-02',
        unit: 'KG' as const,
        expectedSellingRate: 25,
        icon: 'layers',
        accentColor: 'primary' as const,
        alias: {
          id: 'alias_takaram',
          displayNameEnglish: 'Takaram',
          displayNameMalayalam: 'തകരം',
          localSubtitle: 'തകരം ഷീറ്റ് (Light Tin)',
          district: 'Ernakulam',
          defaultTare: 1.0,
          keywords: ['takaram', 'tin', 'sheet', 'തകരം', 'light metal'],
        },
        rate: 21,
        initialStock: 1120,
      },
      {
        id: 'mat_copper_windings',
        masterCategory: 'Copper' as const,
        standardName: 'Copper - Motor Windings',
        standardCode: 'CU-WIND-01',
        unit: 'KG' as const,
        expectedSellingRate: 645,
        icon: 'electric_bolt',
        accentColor: 'secondary-container' as const,
        alias: {
          id: 'alias_chembu',
          displayNameEnglish: 'Chembu',
          displayNameMalayalam: 'ചെമ്പ്',
          localSubtitle: 'മോട്ടോർ ചെമ്പ് (Motor Wire)',
          district: 'Ernakulam',
          defaultTare: 0.5,
          badge: 'PRIME',
          badgeType: 'secondary' as const,
          keywords: ['chembu', 'copper', 'wire', 'ചെമ്പ്', 'motor', 'winding'],
        },
        rate: 610,
        initialStock: 340,
      },
      {
        id: 'mat_brass_bronze',
        masterCategory: 'Brass/Bronze' as const,
        standardName: 'Mixed Brass / Heavy Bronze',
        standardCode: 'BR-MIX-01',
        unit: 'KG' as const,
        expectedSellingRate: 435,
        icon: 'workspace_premium',
        accentColor: 'secondary-container' as const,
        alias: {
          id: 'alias_pithala',
          displayNameEnglish: 'Pithala',
          displayNameMalayalam: 'പിത്തള',
          localSubtitle: 'ഓട് / പിത്തള (Odu / Brass)',
          district: 'Ernakulam',
          defaultTare: 0.5,
          keywords: ['pithala', 'odu', 'brass', 'bronze', 'പിത്തള', 'ഓട്'],
        },
        rate: 410,
        initialStock: 180,
      },
      {
        id: 'mat_paper_occ',
        masterCategory: 'Paper' as const,
        standardName: 'OCC - Old Corrugated Containers',
        standardCode: 'OCC-BOX-01',
        unit: 'KG' as const,
        expectedSellingRate: 21,
        icon: 'inventory_2',
        accentColor: 'secondary' as const,
        alias: {
          id: 'alias_atta',
          displayNameEnglish: 'Atta',
          displayNameMalayalam: 'അട്ട',
          localSubtitle: 'അട്ട കാർഡ്ബോർഡ് (Cardboard)',
          district: 'Ernakulam',
          defaultTare: 1.5,
          badge: 'POPULAR',
          badgeType: 'primary' as const,
          keywords: ['atta', 'corrugated', 'box', 'paper', 'carton', 'അട്ട', 'cardboard'],
        },
        rate: 18,
        initialStock: 1850,
      },
      {
        id: 'mat_paper_waste',
        masterCategory: 'Paper' as const,
        standardName: 'Mixed Waste Paper / White Ledger',
        standardCode: 'PAP-WHT-02',
        unit: 'KG' as const,
        expectedSellingRate: 19,
        icon: 'newspaper',
        accentColor: 'secondary' as const,
        alias: {
          id: 'alias_raddi',
          displayNameEnglish: 'Raddi',
          displayNameMalayalam: 'റദ്ദി',
          localSubtitle: 'റെക്കോർഡ് / റദ്ദി (Record Paper)',
          district: 'Ernakulam',
          defaultTare: 0.5,
          keywords: ['raddi', 'record', 'newspaper', 'office paper', 'റദ്ദി'],
        },
        rate: 16,
        initialStock: 920,
      },
      {
        id: 'mat_plastic_hdpe',
        masterCategory: 'Plastic' as const,
        standardName: 'HDPE / Rigid PVC',
        standardCode: 'PL-HDPE-01',
        unit: 'KG' as const,
        expectedSellingRate: 28,
        icon: 'recycling',
        accentColor: 'tertiary' as const,
        alias: {
          id: 'alias_kadappakku',
          displayNameEnglish: 'Kadappakku',
          displayNameMalayalam: 'കടപ്പാക്ക്',
          localSubtitle: 'ഹാർഡ് പ്ലാസ്റ്റിക് (Hard Plastic)',
          district: 'Ernakulam',
          defaultTare: 1.0,
          keywords: ['kadappakku', 'hard plastic', 'hdpe', 'pvc', 'കടപ്പാക്ക്'],
        },
        rate: 24,
        initialStock: 640,
      },
      {
        // Explicitly corrected: Master Category is Plastic, standard B2B is PP Crates (NOT Craft Paper Boxes)
        id: 'mat_plastic_crates',
        masterCategory: 'Plastic' as const,
        standardName: 'PP Crates (Polypropylene)',
        standardCode: 'PL-PP-CRATE-02',
        unit: 'KG' as const,
        expectedSellingRate: 32,
        icon: 'package_2',
        accentColor: 'secondary' as const,
        alias: {
          id: 'alias_petti',
          displayNameEnglish: 'Petti',
          displayNameMalayalam: 'പെട്ടി',
          localSubtitle: 'പിപി ക്രേറ്റ്സ് (PP Crates)',
          district: 'Ernakulam',
          defaultTare: 1.0,
          keywords: ['petti', 'crates', 'polypropylene', 'pp', 'പെട്ടി'],
        },
        rate: 28,
        initialStock: 480,
      },
      {
        // Explicitly corrected: Master Category is Plastic, standard B2B is PET Bottles (NOT Beer & Glass Bottle)
        id: 'mat_plastic_pet',
        masterCategory: 'Plastic' as const,
        standardName: 'PET Bottles (Clear/Mixed)',
        standardCode: 'PL-PET-BTL-01',
        unit: 'KG' as const,
        expectedSellingRate: 26,
        icon: 'wine_bar',
        accentColor: 'primary' as const,
        alias: {
          id: 'alias_kuppi',
          displayNameEnglish: 'Kuppi',
          displayNameMalayalam: 'കുപ്പി',
          localSubtitle: 'പെറ്റ് ബോട്ടിൽ (PET Bottles)',
          district: 'Ernakulam',
          defaultTare: 2.0,
          keywords: ['kuppi', 'pet', 'bottles', 'plastic', 'കുപ്പി'],
        },
        rate: 22,
        initialStock: 520,
      },
      {
        id: 'mat_metal_aluminium',
        masterCategory: 'Iron/Steel' as const,
        standardName: 'Aluminium Extrusion & Cast',
        standardCode: 'AL-EXT-01',
        unit: 'KG' as const,
        expectedSellingRate: 160,
        icon: 'precision_manufacturing',
        accentColor: 'primary' as const,
        alias: {
          id: 'alias_aluminium',
          displayNameEnglish: 'Aluminium',
          displayNameMalayalam: 'അലുമിനിയം',
          localSubtitle: 'അലുമിനിയം കമ്പി / ഷീറ്റ്',
          district: 'Ernakulam',
          defaultTare: 1.0,
          keywords: ['aluminium', 'extrusion', 'casting', 'അലുമിനിയം'],
        },
        rate: 145,
        initialStock: 290,
      },
    ];

    for (const item of materialData) {
      const mat: Material = {
        id: item.id,
        yardId: DEFAULT_YARD_ID,
        masterCategory: item.masterCategory,
        standardName: item.standardName,
        standardCode: item.standardCode,
        unit: item.unit,
        active: true,
        expectedSellingRate: item.expectedSellingRate,
        icon: item.icon,
        accentColor: item.accentColor,
        createdAt: now,
        updatedAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
      };
      await db.put(STORES.MATERIALS, mat);

      const alias: MaterialAlias = {
        id: item.alias.id,
        materialId: item.id,
        yardId: DEFAULT_YARD_ID,
        displayNameEnglish: item.alias.displayNameEnglish,
        displayNameMalayalam: item.alias.displayNameMalayalam,
        localSubtitle: item.alias.localSubtitle,
        district: item.alias.district,
        isPrimary: true,
        defaultTare: item.alias.defaultTare,
        badge: item.alias.badge,
        badgeType: item.alias.badgeType,
        keywords: item.alias.keywords,
        createdAt: now,
        updatedAt: now,
      };
      await db.put(STORES.MATERIAL_ALIASES, alias);

      const rateRec: MaterialRate = {
        id: `rate_${item.id}_init`,
        materialId: item.id,
        yardId: DEFAULT_YARD_ID,
        purchaseRate: item.rate,
        sellingRate: item.expectedSellingRate,
        effectiveFrom: now,
        createdBy: DEFAULT_OPERATOR_ID,
        createdAt: now,
      };
      await db.put(STORES.RATES, rateRec);

      const balance: InventoryBalance = {
        yardId: DEFAULT_YARD_ID,
        materialId: item.id,
        currentStock: item.initialStock,
        lastMovementAt: now,
        updatedAt: now,
      };
      await db.put(STORES.INVENTORY_BALANCES, balance);
    }

    // 3. Sellers
    const sellers: Seller[] = [
      {
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
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'seller_walkin_02',
        yardId: DEFAULT_YARD_ID,
        initials: 'WC',
        name: 'Walk-in Customer',
        nameMl: 'നേരിട്ടുള്ള കസ്റ്റമർ',
        type: 'Gate #1 Walk-in',
        phone: '+91 94000 11223',
        badge: 'Spot Cash',
        vehicleNumber: 'KL-40-H-1982',
        upiId: 'walkin.gate1@upi',
        bankName: 'State Bank of India',
        bankAccount: '•••• 1982',
        ifsc: 'SBIN0008432',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'seller_benny_03',
        yardId: DEFAULT_YARD_ID,
        initials: 'BP',
        name: 'Benny Paul',
        nameMl: 'ബെന്നി പോൾ',
        type: 'Licensed Electrician',
        phone: '+91 97452 88412',
        badge: 'Verified Electrician',
        vehicleNumber: 'Hand Carry',
        upiId: 'bennypaul@icici',
        bankName: 'South Indian Bank',
        bankAccount: '•••• 5543',
        ifsc: 'SIBL0000190',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'seller_rasheed_04',
        yardId: DEFAULT_YARD_ID,
        initials: 'RM',
        name: 'Rasheed M.A.',
        nameMl: 'റഷീദ് എം.എ.',
        type: 'Yard Dismantler',
        phone: '+91 98950 67321',
        badge: 'Contractor',
        vehicleNumber: 'KL-07-AW-8821',
        upiId: 'rasheed.dismantle@okhdfcbank',
        bankName: 'Canara Bank',
        bankAccount: '•••• 3319',
        ifsc: 'CNRB0002411',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const seller of sellers) {
      await db.put(STORES.SELLERS, seller);
    }

    // 4. Initial Seeded Purchase Transactions (matching Stitch baseline with real UUIDs)
    const seedPurchases = [
      {
        slipNumber: '#SC-8942',
        seller: sellers[0],
        materialId: 'mat_paper_occ',
        aliasId: 'alias_atta',
        matName: 'Atta',
        matMl: 'അട്ട',
        b2bTerm: 'OCC - Old Corrugated Containers',
        gross: 141.5,
        tare: 1.5,
        net: 140.0,
        rate: 18,
        amount: 2520,
        method: 'CASH' as const,
        status: 'PAID' as const,
        time: '10:42 AM',
      },
      {
        slipNumber: '#SC-8941',
        seller: sellers[1],
        materialId: 'mat_iron_hms',
        aliasId: 'alias_irumbu',
        matName: 'Irumbu',
        matMl: 'ഇരുമ്പ്',
        b2bTerm: 'Heavy Melting Scrap / TMT Rebar',
        gross: 422.0,
        tare: 2.0,
        net: 420.0,
        rate: 32,
        amount: 13440,
        method: 'UPI' as const,
        status: 'PAID' as const,
        time: '10:15 AM',
      },
      {
        slipNumber: '#SC-8940',
        seller: sellers[2],
        materialId: 'mat_copper_windings',
        aliasId: 'alias_chembu',
        matName: 'Chembu',
        matMl: 'ചെമ്പ്',
        b2bTerm: 'Copper - Motor Windings',
        gross: 19.0,
        tare: 0.5,
        net: 18.5,
        rate: 610,
        amount: 11285,
        method: 'CREDIT' as const,
        status: 'PENDING' as const,
        time: '09:50 AM',
      },
      {
        slipNumber: '#SC-8939',
        seller: sellers[3],
        materialId: 'mat_iron_tin',
        aliasId: 'alias_takaram',
        matName: 'Takaram',
        matMl: 'തകരം',
        b2bTerm: 'Lightweight Tin / MS Sheet Scrap',
        gross: 86.0,
        tare: 1.0,
        net: 85.0,
        rate: 21,
        amount: 1785,
        method: 'CASH' as const,
        status: 'PAID' as const,
        time: '09:18 AM',
      },
    ];

    for (let i = 0; i < seedPurchases.length; i++) {
      const sp = seedPurchases[i];
      const purchaseId = `purchase_init_${8942 - i}`;
      const itemId = `item_init_${8942 - i}`;
      const paymentId = `pay_init_${8942 - i}`;

      const pItem: PurchaseItem = {
        id: itemId,
        purchaseId,
        materialId: sp.materialId,
        materialAliasId: sp.aliasId,
        materialNameSnapshot: sp.matName,
        materialMlSnapshot: sp.matMl,
        standardB2BTermSnapshot: sp.b2bTerm,
        grossWeight: sp.gross,
        tareWeight: sp.tare,
        netWeight: sp.net,
        ratePerKg: sp.rate,
        lineAmount: sp.amount,
        weightSource: 'SIMULATED_SCALE',
        scaleDeviceId: 'CAS-CI-2001-YARD02',
        rawWeight: sp.gross,
        tareActive: true,
        createdAt: now,
      };

      const pPayment: Payment = {
        id: paymentId,
        purchaseId,
        yardId: DEFAULT_YARD_ID,
        sellerId: sp.seller.id,
        paymentMode: sp.method,
        amount: sp.amount,
        status: sp.status === 'PAID' ? 'COMPLETED' : 'PENDING',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
      };

      const purchase: Purchase = {
        id: purchaseId,
        yardId: DEFAULT_YARD_ID,
        slipNumber: sp.slipNumber,
        sellerId: sp.seller.id,
        sellerSnapshot: sp.seller,
        totalGrossWeight: sp.gross,
        totalTareWeight: sp.tare,
        totalNetWeight: sp.net,
        subtotalAmount: sp.amount,
        roundOff: 0,
        totalAmount: sp.amount,
        paymentStatus: sp.status,
        primaryPaymentMode: sp.method,
        items: [pItem],
        payments: [pPayment],
        createdAt: now,
        updatedAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
      };

      await db.put(STORES.PURCHASES, purchase);
      await db.put(STORES.PURCHASE_ITEMS, pItem);
      await db.put(STORES.PAYMENTS, pPayment);

      // Record initial inventory movement
      const mov: InventoryMovement = {
        id: `mov_init_${8942 - i}`,
        yardId: DEFAULT_YARD_ID,
        materialId: sp.materialId,
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        movementType: 'PURCHASE',
        quantity: sp.net,
        unit: 'KG',
        unitCost: sp.rate,
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
      };
      await db.put(STORES.INVENTORY_MOVEMENTS, mov);
    }

    await this.seedPhase3DataIfEmpty();
  }

  async seedPhase3DataIfEmpty(): Promise<void> {
    const existingBuyers = await db.getAll<Buyer>(STORES.BUYERS);
    if (existingBuyers.length > 0) {
      return;
    }

    const now = new Date().toISOString();

    // 1. Business Profile
    const profile: BusinessProfile = {
      id: 'profile_default_yard_01',
      yardId: DEFAULT_YARD_ID,
      legalName: 'Scrapo Recycling Solutions Pvt Ltd',
      tradeName: 'Sri Balaji Scrap Yard (Kochi #2)',
      address: 'Plot 14, Industrial Development Plot, Kalamassery',
      state: 'Kerala',
      pincode: '682033',
      phone: '+91 94471 23456',
      email: 'billing@scrapo.in',
      gstin: '32AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      bankName: 'Federal Bank Ltd',
      accountNumber: '10020100234567',
      ifsc: 'FDRL0001002',
      upiId: 'scrapo.yard@fbl',
      logoUrl: '',
      isGstRegistered: true,
      defaultTaxRate: 18,
      createdAt: now,
      updatedAt: now,
    };
    await db.put(STORES.BUSINESS_PROFILES, profile);

    // 2. Buyers
    const buyers: Buyer[] = [
      {
        id: 'buyer_cochin_paper',
        yardId: DEFAULT_YARD_ID,
        companyName: 'Cochin Paper Mills Pvt Ltd',
        contactPerson: 'Venugopal Nair',
        phone: '+91 98460 11928',
        email: 'purchase@cochinpaper.com',
        gstin: '32AABCC4412B1ZX',
        billingAddress: 'Industrial Area, Aluva, Ernakulam',
        shippingAddress: 'Aluva Mill Gate #3, Ernakulam',
        state: 'Kerala',
        pincode: '683101',
        paymentTermsDays: 15,
        creditLimit: 500000,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'buyer_malabar_steels',
        yardId: DEFAULT_YARD_ID,
        companyName: 'Malabar Steels & Ingot Rolling',
        contactPerson: 'Sunil Mathew',
        phone: '+91 94472 88190',
        email: 'orders@malabarsteels.in',
        gstin: '32AABFM9811C1ZY',
        billingAddress: 'Kanjikode Industrial Belt, Palakkad',
        shippingAddress: 'Yard B, Kanjikode, Palakkad',
        state: 'Kerala',
        pincode: '678621',
        paymentTermsDays: 30,
        creditLimit: 1000000,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'buyer_coimbatore_foundry',
        yardId: DEFAULT_YARD_ID,
        companyName: 'Coimbatore Precision Foundries Ltd',
        contactPerson: 'S. Radhakrishnan',
        phone: '+91 98940 33214',
        email: 'logistics@coimbatorefoundry.com',
        gstin: '33AACCP1029D1Z4',
        billingAddress: 'Peelamedu, Coimbatore',
        shippingAddress: 'Furnace Plant 2, Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641004',
        paymentTermsDays: 7,
        creditLimit: 750000,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
    ];

    for (const b of buyers) {
      await db.put(STORES.BUYERS, b);
    }

    // 3. Ready Lots (7 lots to match metrics: Ready Lots: 7)
    const lots: Lot[] = [
      {
        id: 'lot_2026_0048',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0048',
        materialId: 'mat_paper_occ',
        standardB2BName: 'OCC - Old Corrugated Containers',
        grossWeight: 852.0,
        tareWeight: 2.0,
        netWeight: 850.0,
        availableWeight: 850.0,
        status: 'READY',
        warehouseLocation: 'Bay A3',
        notes: 'Hydraulic baled cartons, strapped',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0049',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0049',
        materialId: 'mat_iron_hms',
        standardB2BName: 'Heavy Melting Scrap / TMT Rebar',
        grossWeight: 1205.0,
        tareWeight: 5.0,
        netWeight: 1200.0,
        availableWeight: 1200.0,
        status: 'READY',
        warehouseLocation: 'Bay M1',
        notes: 'Sheared TMT scrap ready for furnace dispatch',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0050',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0050',
        materialId: 'mat_iron_tin',
        standardB2BName: 'Lightweight Tin / MS Sheet Scrap',
        grossWeight: 603.0,
        tareWeight: 3.0,
        netWeight: 600.0,
        availableWeight: 600.0,
        status: 'READY',
        warehouseLocation: 'Bay M2',
        notes: 'Compacted sheet scrap bundles',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0051',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0051',
        materialId: 'mat_copper_windings',
        standardB2BName: 'Copper - Motor Windings',
        grossWeight: 150.5,
        tareWeight: 0.5,
        netWeight: 150.0,
        availableWeight: 150.0,
        status: 'READY',
        warehouseLocation: 'Vault B',
        notes: 'Stripped bright motor copper windings',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0052',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0052',
        materialId: 'mat_brass_bronze',
        standardB2BName: 'Mixed Brass / Heavy Bronze',
        grossWeight: 100.5,
        tareWeight: 0.5,
        netWeight: 100.0,
        availableWeight: 100.0,
        status: 'READY',
        warehouseLocation: 'Vault B',
        notes: 'Clean plumbing brass sorted',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0053',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0053',
        materialId: 'mat_plastic_hdpe',
        standardB2BName: 'HDPE / Rigid PVC',
        grossWeight: 352.0,
        tareWeight: 2.0,
        netWeight: 350.0,
        availableWeight: 350.0,
        status: 'READY',
        warehouseLocation: 'Bay P1',
        notes: 'Baled HDPE drums and crates',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
      {
        id: 'lot_2026_0054',
        yardId: DEFAULT_YARD_ID,
        lotNumber: 'LOT-2026-0054',
        materialId: 'mat_plastic_crates',
        standardB2BName: 'PP Crates (Polypropylene)',
        grossWeight: 251.0,
        tareWeight: 1.0,
        netWeight: 250.0,
        availableWeight: 250.0,
        status: 'READY',
        warehouseLocation: 'Bay P2',
        notes: 'Crushed PP crate flakes in jumbo bags',
        createdAt: now,
        createdBy: DEFAULT_OPERATOR_ID,
        version: 1,
      },
    ];

    for (const lt of lots) {
      await db.put(STORES.LOTS, lt);
    }

    // 4. Seed Seeded Sales Orders to match requested initial top metrics:
    // Today's Sales: ₹76,420, Pending Dispatch: 4, Buyer Receivables: ₹1,82,500
    const salesOrder1: SalesOrder = {
      id: 'so_seed_01',
      yardId: DEFAULT_YARD_ID,
      orderNumber: 'SO-2026-0001',
      buyerId: buyers[0].id,
      buyerSnapshot: buyers[0],
      orderDate: now,
      status: 'CONFIRMED',
      subtotal: 64762.71,
      transportCharge: 0,
      loadingCharge: 0,
      otherCharge: 0,
      discount: 0,
      taxableAmount: 64762.71,
      cgst: 5828.64,
      sgst: 5828.64,
      igst: 0,
      grandTotal: 76420.00,
      paidAmount: 0,
      balanceAmount: 76420.00,
      notes: 'Urgent mill requirement for packaging line',
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: 'so_item_01',
          salesOrderId: 'so_seed_01',
          materialId: 'mat_paper_occ',
          lotId: 'lot_2026_0048',
          descriptionSnapshot: 'OCC - Old Corrugated Containers',
          standardB2BNameSnapshot: 'OCC - Old Corrugated Containers',
          hsnCodeSnapshot: '4707',
          weight: 3083.94,
          unit: 'KG',
          ratePerKg: 21,
          lineAmount: 64762.71,
          taxRate: 18,
        },
      ],
    };

    const salesOrder2: SalesOrder = {
      id: 'so_seed_02',
      yardId: DEFAULT_YARD_ID,
      orderNumber: 'SO-2026-0002',
      buyerId: buyers[1].id,
      buyerSnapshot: buyers[1],
      orderDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: 'READY_FOR_DISPATCH',
      subtotal: 45000,
      transportCharge: 1500,
      loadingCharge: 500,
      otherCharge: 0,
      discount: 0,
      taxableAmount: 47000,
      cgst: 4230,
      sgst: 4230,
      igst: 0,
      grandTotal: 55460,
      paidAmount: 0,
      balanceAmount: 55460,
      notes: 'Furnace grade delivery to Palakkad',
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      items: [
        {
          id: 'so_item_02',
          salesOrderId: 'so_seed_02',
          materialId: 'mat_iron_hms',
          lotId: 'lot_2026_0049',
          descriptionSnapshot: 'Heavy Melting Scrap / TMT Rebar',
          standardB2BNameSnapshot: 'Heavy Melting Scrap / TMT Rebar',
          hsnCodeSnapshot: '7204',
          weight: 1250,
          unit: 'KG',
          ratePerKg: 36,
          lineAmount: 45000,
          taxRate: 18,
        },
      ],
    };

    const salesOrder3: SalesOrder = {
      id: 'so_seed_03',
      yardId: DEFAULT_YARD_ID,
      orderNumber: 'SO-2026-0003',
      buyerId: buyers[2].id,
      buyerSnapshot: buyers[2],
      orderDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      status: 'READY_FOR_DISPATCH',
      subtotal: 42898.31,
      transportCharge: 0,
      loadingCharge: 0,
      otherCharge: 0,
      discount: 0,
      taxableAmount: 42898.31,
      cgst: 0,
      sgst: 0,
      igst: 7721.69,
      grandTotal: 50620,
      paidAmount: 0,
      balanceAmount: 50620,
      notes: 'Interstate sale to Coimbatore foundry',
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      items: [
        {
          id: 'so_item_03',
          salesOrderId: 'so_seed_03',
          materialId: 'mat_metal_aluminium',
          descriptionSnapshot: 'Aluminium Extrusion & Cast',
          standardB2BNameSnapshot: 'Aluminium Extrusion & Cast',
          hsnCodeSnapshot: '7602',
          weight: 268.11,
          unit: 'KG',
          ratePerKg: 160,
          lineAmount: 42898.31,
          taxRate: 18,
        },
      ],
    };

    const salesOrder4: SalesOrder = {
      id: 'so_seed_04',
      yardId: DEFAULT_YARD_ID,
      orderNumber: 'SO-2026-0004',
      buyerId: buyers[0].id,
      buyerSnapshot: buyers[0],
      orderDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      status: 'CONFIRMED',
      subtotal: 15000,
      transportCharge: 0,
      loadingCharge: 0,
      otherCharge: 0,
      discount: 0,
      taxableAmount: 15000,
      cgst: 1350,
      sgst: 1350,
      igst: 0,
      grandTotal: 17700,
      paidAmount: 17700,
      balanceAmount: 0,
      notes: 'Trial run consignment',
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      items: [
        {
          id: 'so_item_04',
          salesOrderId: 'so_seed_04',
          materialId: 'mat_paper_waste',
          descriptionSnapshot: 'Mixed Waste Paper / White Ledger',
          standardB2BNameSnapshot: 'Mixed Waste Paper / White Ledger',
          hsnCodeSnapshot: '4707',
          weight: 789.47,
          unit: 'KG',
          ratePerKg: 19,
          lineAmount: 15000,
          taxRate: 18,
        },
      ],
    };

    // Total buyer receivables = 76420 + 55460 + 50620 + 0 = 1,82,500!
    // Pending dispatch = so1, so2, so3, so4 (so1 confirmed, so2 ready, so3 ready, so4 confirmed) = 4!
    // Today's sales = so1 (today) = 76,420!
    // Ready lots = 7!

    await db.put(STORES.SALES_ORDERS, salesOrder1);
    await db.put(STORES.SALES_ORDERS, salesOrder2);
    await db.put(STORES.SALES_ORDERS, salesOrder3);
    await db.put(STORES.SALES_ORDERS, salesOrder4);

    // Seed corresponding invoices
    const inv1: Invoice = {
      id: 'inv_seed_01',
      yardId: DEFAULT_YARD_ID,
      invoiceNumber: 'SCR/26-27/000148',
      salesOrderId: salesOrder1.id,
      buyerId: buyers[0].id,
      invoiceDate: now,
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
      status: 'ISSUED',
      sellerProfileSnapshot: profile,
      buyerSnapshot: buyers[0],
      itemsSnapshot: salesOrder1.items,
      subtotal: salesOrder1.subtotal,
      loadingCharge: salesOrder1.loadingCharge,
      transportCharge: salesOrder1.transportCharge,
      otherCharge: salesOrder1.otherCharge,
      discount: salesOrder1.discount,
      taxableAmount: salesOrder1.taxableAmount,
      cgst: salesOrder1.cgst,
      sgst: salesOrder1.sgst,
      igst: salesOrder1.igst,
      grandTotal: salesOrder1.grandTotal,
      paidAmount: 0,
      balanceAmount: salesOrder1.grandTotal,
      notes: salesOrder1.notes,
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: now,
      updatedAt: now,
    };

    const inv2: Invoice = {
      id: 'inv_seed_02',
      yardId: DEFAULT_YARD_ID,
      invoiceNumber: 'SCR/26-27/000147',
      salesOrderId: salesOrder2.id,
      buyerId: buyers[1].id,
      invoiceDate: salesOrder2.orderDate,
      dueDate: new Date(Date.now() + 27 * 86400000).toISOString(),
      status: 'ISSUED',
      sellerProfileSnapshot: profile,
      buyerSnapshot: buyers[1],
      itemsSnapshot: salesOrder2.items,
      subtotal: salesOrder2.subtotal,
      loadingCharge: salesOrder2.loadingCharge,
      transportCharge: salesOrder2.transportCharge,
      otherCharge: salesOrder2.otherCharge,
      discount: salesOrder2.discount,
      taxableAmount: salesOrder2.taxableAmount,
      cgst: salesOrder2.cgst,
      sgst: salesOrder2.sgst,
      igst: salesOrder2.igst,
      grandTotal: salesOrder2.grandTotal,
      paidAmount: 0,
      balanceAmount: salesOrder2.grandTotal,
      notes: salesOrder2.notes,
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: salesOrder2.orderDate,
      updatedAt: salesOrder2.orderDate,
    };

    const inv3: Invoice = {
      id: 'inv_seed_03',
      yardId: DEFAULT_YARD_ID,
      invoiceNumber: 'SCR/26-27/000146',
      salesOrderId: salesOrder3.id,
      buyerId: buyers[2].id,
      invoiceDate: salesOrder3.orderDate,
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: 'ISSUED',
      sellerProfileSnapshot: profile,
      buyerSnapshot: buyers[2],
      itemsSnapshot: salesOrder3.items,
      subtotal: salesOrder3.subtotal,
      loadingCharge: salesOrder3.loadingCharge,
      transportCharge: salesOrder3.transportCharge,
      otherCharge: salesOrder3.otherCharge,
      discount: salesOrder3.discount,
      taxableAmount: salesOrder3.taxableAmount,
      cgst: salesOrder3.cgst,
      sgst: salesOrder3.sgst,
      igst: salesOrder3.igst,
      grandTotal: salesOrder3.grandTotal,
      paidAmount: 0,
      balanceAmount: salesOrder3.grandTotal,
      notes: salesOrder3.notes,
      createdBy: DEFAULT_OPERATOR_ID,
      createdAt: salesOrder3.orderDate,
      updatedAt: salesOrder3.orderDate,
    };

    await db.put(STORES.INVOICES, inv1);
    await db.put(STORES.INVOICES, inv2);
    await db.put(STORES.INVOICES, inv3);
  }

  async resetAndReseed(): Promise<void> {
    await db.clear(STORES.YARDS);
    await db.clear(STORES.MATERIALS);
    await db.clear(STORES.MATERIAL_ALIASES);
    await db.clear(STORES.RATES);
    await db.clear(STORES.SELLERS);
    await db.clear(STORES.PURCHASES);
    await db.clear(STORES.PURCHASE_ITEMS);
    await db.clear(STORES.PAYMENTS);
    await db.clear(STORES.INVENTORY_MOVEMENTS);
    await db.clear(STORES.INVENTORY_BALANCES);
    await db.clear(STORES.SYNC_QUEUE);
    await db.clear(STORES.AUDIT_LOGS);
    await this.seedInitialData();
  }
}

export const seedService = new SeedService();

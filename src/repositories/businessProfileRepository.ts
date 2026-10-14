import { db, STORES } from '../storage/indexedDb';
import { BusinessProfile } from '../types';

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  id: 'profile_default_yard_01',
  yardId: 'yard_kalamassery_01',
  legalName: 'Scrapo Recycling Solutions Pvt Ltd',
  tradeName: 'Scrapo Yard 02 — Kochi Industrial Cluster',
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export class BusinessProfileRepository {
  public async getProfile(yardId: string): Promise<BusinessProfile> {
    const all = await db.getAll<BusinessProfile>(STORES.BUSINESS_PROFILES);
    const existing = all.find((p) => p.yardId === yardId);
    if (existing) {
      return existing;
    }
    const defaultProfile = { ...DEFAULT_BUSINESS_PROFILE, yardId };
    await db.put<BusinessProfile>(STORES.BUSINESS_PROFILES, defaultProfile);
    return defaultProfile;
  }

  public async saveProfile(profile: BusinessProfile): Promise<BusinessProfile> {
    const updated: BusinessProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await db.put<BusinessProfile>(STORES.BUSINESS_PROFILES, updated);
    return updated;
  }
}

export const businessProfileRepository = new BusinessProfileRepository();

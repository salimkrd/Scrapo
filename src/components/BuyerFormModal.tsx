import React, { useState, useEffect } from 'react';
import { Buyer } from '../types';
import { DEFAULT_YARD_ID } from '../services/seedService';
import { buyerRepository } from '../repositories/buyerRepository';

interface BuyerFormModalProps {
  buyerToEdit?: Buyer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (buyer: Buyer) => void;
}

export const BuyerFormModal: React.FC<BuyerFormModalProps> = ({
  buyerToEdit,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [state, setState] = useState('Kerala');
  const [pincode, setPincode] = useState('682001');
  const [paymentTermsDays, setPaymentTermsDays] = useState(15);
  const [creditLimit, setCreditLimit] = useState(500000);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (buyerToEdit) {
      setCompanyName(buyerToEdit.companyName);
      setContactPerson(buyerToEdit.contactPerson);
      setPhone(buyerToEdit.phone);
      setEmail(buyerToEdit.email || '');
      setGstin(buyerToEdit.gstin || '');
      setBillingAddress(buyerToEdit.billingAddress);
      setShippingAddress(buyerToEdit.shippingAddress);
      setState(buyerToEdit.state);
      setPincode(buyerToEdit.pincode);
      setPaymentTermsDays(buyerToEdit.paymentTermsDays);
      setCreditLimit(buyerToEdit.creditLimit);
    } else {
      setCompanyName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setBillingAddress('');
      setShippingAddress('');
      setState('Kerala');
      setPincode('682001');
      setPaymentTermsDays(15);
      setCreditLimit(500000);
    }
    setError(null);
  }, [buyerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (!contactPerson.trim()) {
      setError('Contact person name is required');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const buyer: Buyer = {
        id: buyerToEdit ? buyerToEdit.id : `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        yardId: buyerToEdit ? buyerToEdit.yardId : DEFAULT_YARD_ID,
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        billingAddress: billingAddress.trim() || 'Factory Premises',
        shippingAddress: shippingAddress.trim() || (billingAddress.trim() || 'Factory Premises'),
        state: state.trim(),
        pincode: pincode.trim(),
        paymentTermsDays: Number(paymentTermsDays) || 15,
        creditLimit: Number(creditLimit) || 0,
        active: true,
        createdAt: buyerToEdit ? buyerToEdit.createdAt : now,
        updatedAt: now,
        createdBy: buyerToEdit ? buyerToEdit.createdBy : 'manager',
        version: buyerToEdit ? buyerToEdit.version + 1 : 1,
      };

      const saved = await buyerRepository.saveBuyer(buyer);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save buyer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface text-on-surface w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl border border-surface-container flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {buyerToEdit ? 'edit_business' : 'domain_add'}
            </span>
            <h3 className="font-bold text-base text-on-surface">
              {buyerToEdit ? 'Edit B2B Buyer' : 'Add New B2B Buyer'}
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Company / Mill Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cochin Paper Mills Pvt Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Contact Person *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Venugopal Nair"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 98460 11928"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                placeholder="purchase@buyer.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                GSTIN (Tax ID)
              </label>
              <input
                type="text"
                placeholder="e.g. 32AABCC4412B1ZX"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Billing Address
            </label>
            <input
              type="text"
              placeholder="Plot No / Street / Industrial Area"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Shipping / Unloading Address
            </label>
            <input
              type="text"
              placeholder="Leave blank to use billing address"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                State
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              >
                <option value="Kerala">Kerala (Intra-state CGST+SGST)</option>
                <option value="Tamil Nadu">Tamil Nadu (Inter-state IGST)</option>
                <option value="Karnataka">Karnataka (Inter-state IGST)</option>
                <option value="Maharashtra">Maharashtra (Inter-state IGST)</option>
                <option value="Other">Other State (IGST)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                PIN Code
              </label>
              <input
                type="text"
                placeholder="683101"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Payment Terms (Days)
              </label>
              <input
                type="number"
                min="0"
                max="180"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="10000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{saving ? 'Saving...' : buyerToEdit ? 'Update Buyer' : 'Add Buyer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

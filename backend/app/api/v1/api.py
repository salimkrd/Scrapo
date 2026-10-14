from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    auth,
    business_profiles,
    buyer_payments,
    buyers,
    dispatches,
    inventory,
    invoices,
    lots,
    materials,
    purchases,
    sales,
    sellers,
    sync,
    yards,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(yards.router, prefix="/yards", tags=["Yards"])
api_router.include_router(materials.router, prefix="/materials", tags=["Materials & Rates"])
api_router.include_router(sellers.router, prefix="/sellers", tags=["Sellers & Ledger"])
api_router.include_router(purchases.router, prefix="/purchases", tags=["Purchases"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sync.router, prefix="/sync", tags=["Offline Sync"])

# Phase 3 B2B Sales Cycle routes
api_router.include_router(buyers.router, prefix="/buyers", tags=["Buyers & Ledger"])
api_router.include_router(lots.router, prefix="/lots", tags=["Lot & Bale Management"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales Orders"])
api_router.include_router(dispatches.router, prefix="/dispatches", tags=["Dispatches"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(buyer_payments.router, prefix="/buyer-payments", tags=["Buyer Payments"])
api_router.include_router(business_profiles.router, prefix="/business-profile", tags=["Company Profile"])

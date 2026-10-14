from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.inventory import InventoryBalance
from backend.app.models.material import Material, MaterialAlias, MaterialRate
from backend.app.models.payment import Payment
from backend.app.models.purchase import Purchase
from backend.app.models.seller import Seller
from backend.app.schemas.inventory import InventoryBalanceResponse
from backend.app.schemas.material import MaterialAliasResponse, MaterialRateResponse, MaterialResponse
from backend.app.schemas.payment import PaymentResponse
from backend.app.schemas.purchase import PurchaseItemResponse, PurchaseResponse
from backend.app.schemas.seller import SellerResponse
from backend.app.schemas.sync import SyncPullRequest, SyncPullResponse


class PullSyncHandler:
    def __init__(self, db: Session):
        self.db = db

    def process_pull(self, request: SyncPullRequest) -> SyncPullResponse:
        yard_id = request.yard_id
        cursor_time: Optional[datetime] = None

        if request.last_sync_cursor:
            try:
                cursor_time = datetime.fromisoformat(request.last_sync_cursor)
            except Exception:
                cursor_time = None

        now = datetime.now(timezone.utc)

        # 1. Pull Materials
        mat_stmt = select(Material).where(Material.yard_id == yard_id)
        if cursor_time:
            mat_stmt = mat_stmt.where(Material.updated_at > cursor_time)
        materials_db = list(self.db.execute(mat_stmt).scalars().all())
        materials = [MaterialResponse.model_validate(m) for m in materials_db]

        # 2. Pull Aliases
        alias_stmt = select(MaterialAlias).where(MaterialAlias.yard_id == yard_id)
        if cursor_time:
            alias_stmt = alias_stmt.where(MaterialAlias.updated_at > cursor_time)
        aliases_db = list(self.db.execute(alias_stmt).scalars().all())
        aliases = [MaterialAliasResponse.model_validate(a) for a in aliases_db]

        # 3. Pull Rates
        rate_stmt = select(MaterialRate).where(MaterialRate.yard_id == yard_id)
        if cursor_time:
            rate_stmt = rate_stmt.where(MaterialRate.created_at > cursor_time)
        rates_db = list(self.db.execute(rate_stmt).scalars().all())
        rates = [MaterialRateResponse.model_validate(r) for r in rates_db]

        # 4. Pull Sellers
        seller_stmt = select(Seller).where(Seller.yard_id == yard_id)
        if cursor_time:
            seller_stmt = seller_stmt.where(Seller.updated_at > cursor_time)
        sellers_db = list(self.db.execute(seller_stmt).scalars().all())
        sellers = [SellerResponse.model_validate(s) for s in sellers_db]

        # 5. Pull Purchases
        purchase_stmt = select(Purchase).where(Purchase.yard_id == yard_id)
        if cursor_time:
            purchase_stmt = purchase_stmt.where(Purchase.updated_at > cursor_time)
        else:
            purchase_stmt = purchase_stmt.order_by(Purchase.created_at.desc()).limit(100)
        purchases_db = list(self.db.execute(purchase_stmt).scalars().all())

        purchases = []
        for p in purchases_db:
            items_resp = [PurchaseItemResponse.model_validate(it) for it in p.items]
            p_resp = PurchaseResponse.model_validate(p)
            p_resp.items = items_resp
            purchases.append(p_resp)

        # 6. Pull Payments
        pay_stmt = select(Payment).where(Payment.yard_id == yard_id)
        if cursor_time:
            pay_stmt = pay_stmt.where(Payment.created_at > cursor_time)
        else:
            pay_stmt = pay_stmt.order_by(Payment.created_at.desc()).limit(100)
        payments_db = list(self.db.execute(pay_stmt).scalars().all())
        payments = [PaymentResponse.model_validate(pay) for pay in payments_db]

        # 7. Pull Live Inventory Balances
        bal_stmt = select(InventoryBalance).where(InventoryBalance.yard_id == yard_id)
        if cursor_time:
            bal_stmt = bal_stmt.where(InventoryBalance.updated_at > cursor_time)
        balances_db = list(self.db.execute(bal_stmt).scalars().all())
        balances = [InventoryBalanceResponse.model_validate(b) for b in balances_db]

        return SyncPullResponse(
            next_sync_cursor=now.isoformat(),
            materials=materials,
            aliases=aliases,
            rates=rates,
            sellers=sellers,
            purchases=purchases,
            payments=payments,
            inventory_balances=balances,
        )

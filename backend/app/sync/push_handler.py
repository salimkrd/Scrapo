from decimal import Decimal
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from backend.app.core.errors import ConflictError, RateConflictError, ValidationError
from backend.app.models.seller import Seller
from backend.app.models.sync import SyncOperation
from backend.app.repositories.material_repo import MaterialRepository
from backend.app.repositories.purchase_repo import PurchaseRepository
from backend.app.repositories.rate_repo import RateRepository
from backend.app.repositories.seller_repo import SellerRepository
from backend.app.repositories.sync_repo import SyncRepository
from backend.app.schemas.purchase import PurchaseCreate, PurchaseItemCreate, SplitPaymentItem
from backend.app.schemas.sync import (
    SyncOperationItem,
    SyncOperationResult,
    SyncPushRequest,
    SyncPushResponse,
)
from backend.app.services.procurement_service import ProcurementService
from backend.app.services.seller_service import SellerService


class PushSyncHandler:
    def __init__(self, db: Session):
        self.db = db
        self.sync_repo = SyncRepository(db)
        self.procurement_service = ProcurementService(db)
        self.seller_service = SellerService(db)
        self.seller_repo = SellerRepository(db)
        self.rate_repo = RateRepository(db)
        self.material_repo = MaterialRepository(db)
        self.purchase_repo = PurchaseRepository(db)

    def process_push(self, request: SyncPushRequest, user_id: str) -> SyncPushResponse:
        results: List[SyncOperationResult] = []
        synced_count = 0
        duplicate_count = 0
        conflict_count = 0
        rejected_count = 0

        for op_item in request.operations:
            res = self._process_single_op(request.yard_id, request.device_id, op_item, user_id)
            results.append(res)
            if res.status == "SYNCED":
                synced_count += 1
            elif res.status == "DUPLICATE":
                duplicate_count += 1
            elif res.status == "CONFLICT":
                conflict_count += 1
            elif res.status == "REJECTED":
                rejected_count += 1

        return SyncPushResponse(
            synced_count=synced_count,
            duplicate_count=duplicate_count,
            conflict_count=conflict_count,
            rejected_count=rejected_count,
            results=results,
        )

    def _process_single_op(
        self,
        yard_id: str,
        device_id: str,
        op: SyncOperationItem,
        user_id: str,
    ) -> SyncOperationResult:
        # 1. Idempotency Check: Operation ID already processed?
        existing_op = self.sync_repo.get_by_operation_id(op.operation_id)
        if existing_op:
            return SyncOperationResult(
                operation_id=op.operation_id,
                entity_type=op.entity_type,
                entity_id=op.entity_id,
                status="DUPLICATE",
                message="Operation already processed on server",
                server_version=existing_op.server_version,
            )

        status_result = "SYNCED"
        message_result = "Successfully synced"
        server_ver = 1

        try:
            entity_type = op.entity_type.upper()
            payload = op.payload

            if entity_type == "PURCHASE":
                # Check if purchase UUID already exists (Idempotent replay)
                existing_purchase = self.purchase_repo.get_by_id(op.entity_id)
                if existing_purchase:
                    status_result = "DUPLICATE"
                    message_result = "Purchase transaction already recorded"
                    server_ver = existing_purchase.version
                else:
                    # Construct PurchaseCreate and execute atomic commit
                    items_raw = payload.get("items", [])
                    items: List[PurchaseItemCreate] = []
                    for it in items_raw:
                        items.append(
                            PurchaseItemCreate(
                                id=it.get("id"),
                                material_id=it["materialId"] if "materialId" in it else it.get("material_id"),
                                material_alias_id=it.get("materialAliasId") or it.get("material_alias_id"),
                                material_name_snapshot=it.get("materialNameSnapshot") or it.get("material_name_snapshot", ""),
                                material_ml_snapshot=it.get("materialMlSnapshot") or it.get("material_ml_snapshot", ""),
                                standard_b2b_term_snapshot=it.get("standardB2BTermSnapshot") or it.get("standard_b2b_term_snapshot", ""),
                                gross_weight=Decimal(str(it.get("grossWeight", it.get("gross_weight", 0)))),
                                tare_weight=Decimal(str(it.get("tareWeight", it.get("tare_weight", 0)))),
                                rate_per_kg=Decimal(str(it.get("ratePerKg", it.get("rate_per_kg", 0)))),
                                weight_source=it.get("weightSource", it.get("weight_source", "SIMULATED_SCALE")),
                                scale_device_id=it.get("scaleDeviceId", it.get("scale_device_id")),
                                tare_active=it.get("tareActive", it.get("tare_active", True)),
                            )
                        )

                    split_items = None
                    if payload.get("splitBreakdown") or payload.get("split_breakdown"):
                        raw_splits = payload.get("splitBreakdown") or payload.get("split_breakdown")
                        split_items = [
                            SplitPaymentItem(mode=s["mode"], amount=Decimal(str(s["amount"])))
                            for s in raw_splits
                        ]

                    purchase_data = PurchaseCreate(
                        id=op.entity_id,
                        yard_id=yard_id,
                        slip_number=payload.get("slipNumber") or payload.get("slip_number"),
                        seller_id=payload.get("sellerId") or payload.get("seller_id"),
                        seller_snapshot=payload.get("sellerSnapshot") or payload.get("seller_snapshot"),
                        items=items,
                        primary_payment_mode=(
                            payload.get("primary_payment_mode")
                            or payload.get("primaryPaymentMode")
                            or payload.get("payment_mode")
                            or payload.get("paymentMode")
                            or "CASH"
                        ),
                        split_breakdown=split_items,
                        is_draft=payload.get("isDraft", False),
                        notes=payload.get("notes"),
                    )

                    created_purchase = self.procurement_service.process_purchase(purchase_data, created_by=user_id)
                    server_ver = created_purchase.version

            elif entity_type == "SELLER":
                existing_seller = self.seller_repo.get_by_id(op.entity_id)
                if existing_seller:
                    if op.operation == "UPDATE":
                        updated = self.seller_repo.update(
                            seller_id=op.entity_id,
                            update_data=payload,
                            client_version=op.client_version,
                        )
                        server_ver = updated.version
                    else:
                        status_result = "DUPLICATE"
                        message_result = "Seller already exists"
                        server_ver = existing_seller.version
                else:
                    new_seller = Seller(
                        id=op.entity_id,
                        yard_id=yard_id,
                        initials=payload.get("initials", "SE"),
                        name=payload.get("name", ""),
                        name_ml=payload.get("nameMl", payload.get("name_ml", "")),
                        type=payload.get("type", "Local Collector"),
                        phone=payload.get("phone", ""),
                        badge=payload.get("badge", "New Seller"),
                        vehicle_number=payload.get("vehicleNumber", payload.get("vehicle_number")),
                        upi_id=payload.get("upiId", payload.get("upi_id", "")),
                        bank_name=payload.get("bankName", payload.get("bank_name", "Federal Bank")),
                        bank_account=payload.get("bankAccount", payload.get("bank_account", "•••• 0000")),
                        ifsc=payload.get("ifsc", "FDRL0001244"),
                        active=payload.get("active", True),
                        version=1,
                        created_by=user_id,
                    )
                    self.seller_repo.create(new_seller)

            elif entity_type == "RATE_UPDATE":
                material_id = payload.get("materialId") or payload.get("material_id")
                purchase_rate = Decimal(str(payload.get("purchaseRate") or payload.get("purchase_rate", 0)))
                selling_rate = Decimal(str(payload.get("sellingRate") or payload.get("selling_rate", 0))) if (payload.get("sellingRate") or payload.get("selling_rate")) else None
                rate_rec = self.rate_repo.set_new_rate(
                    material_id=material_id,
                    yard_id=yard_id,
                    purchase_rate=purchase_rate,
                    selling_rate=selling_rate,
                    created_by=user_id,
                    client_version=op.client_version,
                )
                server_ver = rate_rec.version

            elif entity_type == "ALIAS":
                alias_id = op.entity_id
                updated_alias = self.material_repo.update_alias(
                    alias_id=alias_id,
                    display_name_english=payload.get("displayNameEnglish") or payload.get("display_name_english"),
                    display_name_malayalam=payload.get("displayNameMalayalam") or payload.get("display_name_malayalam"),
                    local_subtitle=payload.get("localSubtitle") or payload.get("local_subtitle"),
                    version=op.client_version,
                )
                server_ver = updated_alias.version

            elif entity_type == "PAYMENT":
                # Standalone settlement payout
                settle_res = self.seller_service.record_settlement(
                    seller_id=payload.get("sellerId") or payload.get("seller_id"),
                    yard_id=yard_id,
                    amount=Decimal(str(payload.get("amount", 0))),
                    payment_mode=payload.get("paymentMode") or payload.get("payment_mode", "CASH"),
                    reference_number=payload.get("referenceNumber") or payload.get("reference_number"),
                    notes=payload.get("notes"),
                    created_by=user_id,
                )
                message_result = f"Settled ₹{settle_res['settled_amount']}"

            # Record sync operation
            sync_op_record = SyncOperation(
                operation_id=op.operation_id,
                yard_id=yard_id,
                entity_type=op.entity_type,
                entity_id=op.entity_id,
                operation=op.operation,
                payload=payload,
                status=status_result,
                device_id=device_id,
                client_version=op.client_version,
                server_version=server_ver,
                local_created_at=op.local_created_at,
            )
            self.sync_repo.record_operation(sync_op_record)

        except (RateConflictError, ConflictError) as ce:
            status_result = "CONFLICT"
            message_result = str(ce)
        except ValidationError as ve:
            status_result = "REJECTED"
            message_result = str(ve)
        except Exception as e:
            status_result = "REJECTED"
            message_result = f"Error: {str(e)}"

        return SyncOperationResult(
            operation_id=op.operation_id,
            entity_type=op.entity_type,
            entity_id=op.entity_id,
            status=status_result,  # type: ignore
            message=message_result,
            server_version=server_ver,
        )

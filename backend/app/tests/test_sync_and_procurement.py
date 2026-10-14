import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.app.models.inventory import InventoryBalance, InventoryMovement
from backend.app.models.payment import Payment
from backend.app.models.purchase import Purchase, PurchaseItem


def test_offline_purchase_upload_succeeds(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 5: Offline purchase upload succeeds via /api/v1/sync/push."""
    purchase_id = f"pur_offline_{uuid.uuid4().hex[:8]}"
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    op_id = f"op_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "slip_number": "SLIP-2026-0001",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_alias_id": "alias_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "material_ml_snapshot": "ഇരുമ്പ് / കമ്പി",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "50.000",
                "tare_weight": "0.000",
                "rate_per_kg": "32.00",
                "weight_source": "SIMULATED_SCALE",
            }
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200, resp.text
    res_data = resp.json()
    assert res_data["synced_count"] == 1
    assert res_data["duplicate_count"] == 0
    assert res_data["results"][0]["status"] == "SYNCED"

    # Verify directly in DB
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    assert purchase is not None
    assert purchase.seller_id == "seller_shaji_01"
    assert purchase.total_amount == Decimal("1600.00")
    assert purchase.payment_status in ["PAID", "COMPLETED"]


def test_duplicate_purchase_upload_idempotent(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 6: Duplicate purchase upload is idempotent without creating duplicates."""
    purchase_id = f"pur_idem_{uuid.uuid4().hex[:8]}"
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    op_id = f"op_idem_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "slip_number": "SLIP-IDEM-001",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "10.000",
                "tare_weight": "0.000",
                "rate_per_kg": "32.00",
            }
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    # First push -> SYNCED
    resp1 = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp1.status_code == 200
    assert resp1.json()["synced_count"] == 1

    # Second push with identical operation ID -> DUPLICATE
    resp2 = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp2.status_code == 200
    res_data2 = resp2.json()
    assert res_data2["duplicate_count"] == 1
    assert res_data2["synced_count"] == 0
    assert res_data2["results"][0]["status"] == "DUPLICATE"

    # Verify only 1 record exists in DB
    count = db.query(Purchase).filter(Purchase.id == purchase_id).count()
    assert count == 1


def test_atomic_procurement_sync(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 7: Atomic procurement sync - If validation fails (e.g. gross < tare), all records rollback."""
    purchase_id = f"pur_fail_{uuid.uuid4().hex[:8]}"
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    op_id = f"op_fail_{uuid.uuid4().hex[:8]}"

    # Invalid payload: gross_weight (5.000) < tare_weight (10.000)
    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "5.000",
                "tare_weight": "10.000",  # Illegal tare > gross
                "rate_per_kg": "32.00",
            }
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["rejected_count"] == 1
    assert res_data["results"][0]["status"] == "REJECTED"

    # Verify DB has zero records created for this purchase, its items, payments, or movements
    assert db.query(Purchase).filter(Purchase.id == purchase_id).first() is None
    assert db.query(PurchaseItem).filter(PurchaseItem.purchase_id == purchase_id).first() is None
    assert db.query(Payment).filter(Payment.purchase_id == purchase_id).first() is None
    assert db.query(InventoryMovement).filter(InventoryMovement.reference_id == purchase_id).first() is None


def test_multi_item_purchase_sync(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 8: Multi-item purchase sync with accurate recalculation of weights and line totals."""
    purchase_id = f"pur_multi_{uuid.uuid4().hex[:8]}"
    item1_id = f"item1_{uuid.uuid4().hex[:8]}"
    item2_id = f"item2_{uuid.uuid4().hex[:8]}"
    op_id = f"op_multi_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            # Item 1: Iron Rebar 60kg gross, 2kg tare = 58kg net @ ₹32.00 = ₹1856.00
            {
                "id": item1_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "60.000",
                "tare_weight": "2.000",
                "rate_per_kg": "32.00",
            },
            # Item 2: Copper Windings 5.5kg gross, 0.5kg tare = 5.0kg net @ ₹720.00 = ₹3600.00
            {
                "id": item2_id,
                "material_id": "mat_copper_windings",
                "material_name_snapshot": "Chembu",
                "standard_b2b_term_snapshot": "Copper - Motor Windings",
                "gross_weight": "5.500",
                "tare_weight": "0.500",
                "rate_per_kg": "720.00",
            },
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200
    assert resp.json()["synced_count"] == 1

    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    assert purchase is not None
    assert len(purchase.items) == 2
    # 58kg + 5kg = 63kg net
    assert purchase.total_net_weight == Decimal("63.000")
    # 1856 + 3600 = 5456.00
    assert purchase.total_amount == Decimal("5456.00")


def test_split_payment_persistence(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 9: Split payment persistence (Cash + UPI) accurately linked to purchase."""
    purchase_id = f"pur_split_{uuid.uuid4().hex[:8]}"
    item_id = f"item_split_{uuid.uuid4().hex[:8]}"
    op_id = f"op_split_{uuid.uuid4().hex[:8]}"

    # Net weight: 100kg @ ₹32.00 = ₹3200.00
    # Split: Cash ₹2000.00, UPI ₹1200.00
    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "SPLIT",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "100.000",
                "tare_weight": "0.000",
                "rate_per_kg": "32.00",
            }
        ],
        "split_breakdown": [
            {"mode": "CASH", "amount": "2000.00"},
            {"mode": "UPI", "amount": "1200.00"},
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200
    assert resp.json()["synced_count"] == 1

    payments = db.query(Payment).filter(Payment.purchase_id == purchase_id).all()
    assert len(payments) == 2
    cash_pay = next(p for p in payments if p.payment_mode == "CASH")
    upi_pay = next(p for p in payments if p.payment_mode == "UPI")
    assert cash_pay.amount == Decimal("2000.00")
    assert upi_pay.amount == Decimal("1200.00")
    assert cash_pay.status == "COMPLETED"
    assert upi_pay.status == "COMPLETED"


def test_inventory_movement_creation(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 14: Ingesting a purchase generates corresponding INVENTORY_MOVEMENT records of type PURCHASE."""
    purchase_id = f"pur_inv_{uuid.uuid4().hex[:8]}"
    item_id = f"item_inv_{uuid.uuid4().hex[:8]}"
    op_id = f"op_inv_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_copper_windings",
                "material_name_snapshot": "Chembu",
                "standard_b2b_term_snapshot": "Copper - Motor Windings",
                "gross_weight": "12.000",
                "tare_weight": "2.000",  # Net = 10.000 kg
                "rate_per_kg": "720.00",
            }
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200

    mov = db.query(InventoryMovement).filter(
        InventoryMovement.reference_id == purchase_id,
        InventoryMovement.material_id == "mat_copper_windings",
    ).first()
    assert mov is not None
    assert mov.movement_type == "PURCHASE"
    assert mov.reference_type == "PURCHASE"
    assert mov.quantity == Decimal("10.000")
    assert mov.unit_cost == Decimal("720.00")


def test_inventory_balance_reconciliation(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 15: Inventory balance stock reconciles and increases by the line item net weight."""
    # Check baseline balance for Petti (PP Crates): seeded at 20.000 kg in conftest
    initial_bal = db.query(InventoryBalance).filter(
        InventoryBalance.yard_id == "yard_kochi_02",
        InventoryBalance.material_id == "mat_plastic_petti",
    ).first()
    baseline_stock = initial_bal.current_stock  # 20.000

    purchase_id = f"pur_recon_{uuid.uuid4().hex[:8]}"
    item_id = f"item_recon_{uuid.uuid4().hex[:8]}"
    op_id = f"op_recon_{uuid.uuid4().hex[:8]}"

    # Add 15.000 kg net (15.400 gross - 0.400 tare)
    payload = {
        "id": purchase_id,
        "yard_id": "yard_kochi_02",
        "seller_id": "seller_shaji_01",
        "primary_payment_mode": "CASH",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_plastic_petti",
                "material_name_snapshot": "Petti",
                "standard_b2b_term_snapshot": "PP Crates (Polypropylene)",
                "gross_weight": "15.400",
                "tare_weight": "0.400",
                "rate_per_kg": "28.00",
            }
        ],
    }

    push_request = {
        "yard_id": "yard_kochi_02",
        "device_id": "SCRAPO-DEV-TEST-01",
        "operations": [
            {
                "operation_id": op_id,
                "entity_type": "PURCHASE",
                "entity_id": purchase_id,
                "operation": "INSERT",
                "payload": payload,
                "device_id": "SCRAPO-DEV-TEST-01",
            }
        ],
    }

    resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_request)
    assert resp.status_code == 200

    # Refresh DB session to get updated balance
    db.expire_all()
    updated_bal = db.query(InventoryBalance).filter(
        InventoryBalance.yard_id == "yard_kochi_02",
        InventoryBalance.material_id == "mat_plastic_petti",
    ).first()

    assert updated_bal.current_stock == baseline_stock + Decimal("15.000")

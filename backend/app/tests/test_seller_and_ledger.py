import uuid
from decimal import Decimal
from fastapi.testclient import TestClient


def test_credit_purchase_ledger_calculation(client: TestClient, worker_headers: dict, manager_headers: dict):
    """Scenario 10: Credit purchase reflects in seller ledger net outstanding calculation."""
    seller_id = "seller_shaji_01"
    yard_id = "yard_kochi_02"

    # Step 1: Initial ledger check
    init_resp = client.get(f"/api/v1/sellers/{seller_id}/ledger?yard_id={yard_id}", headers=worker_headers)
    assert init_resp.status_code == 200
    init_ledger = init_resp.json()
    init_outstanding = Decimal(str(init_ledger["outstanding_balance"]))

    # Step 2: Make a purchase with payment_mode = CREDIT
    # 50kg @ ₹32.00 = ₹1600.00
    purchase_id = f"pur_credit_{uuid.uuid4().hex[:8]}"
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    op_id = f"op_credit_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": yard_id,
        "seller_id": seller_id,
        "primary_payment_mode": "CREDIT",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "50.000",
                "tare_weight": "0.000",
                "rate_per_kg": "32.00",
            }
        ],
    }

    push_req = {
        "yard_id": yard_id,
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

    push_resp = client.post("/api/v1/sync/push", headers=worker_headers, json=push_req)
    assert push_resp.status_code == 200
    assert push_resp.json()["synced_count"] == 1

    # Step 3: Verify ledger shows ₹1600 added to outstanding balance
    updated_resp = client.get(f"/api/v1/sellers/{seller_id}/ledger?yard_id={yard_id}", headers=worker_headers)
    assert updated_resp.status_code == 200
    updated_ledger = updated_resp.json()
    new_outstanding = Decimal(str(updated_ledger["outstanding_balance"]))

    assert new_outstanding == init_outstanding + Decimal("1600.00")
    assert Decimal(str(updated_ledger["total_procured"])) >= Decimal("1600.00")


def test_seller_settlement(client: TestClient, worker_headers: dict, manager_headers: dict):
    """Scenario 11: Seller settlement reduces seller net outstanding balance."""
    seller_id = "seller_shaji_01"
    yard_id = "yard_kochi_02"

    # Step 1: Create a credit purchase of ₹2000 so there's an outstanding balance
    purchase_id = f"pur_settle_{uuid.uuid4().hex[:8]}"
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    op_id = f"op_settle_{uuid.uuid4().hex[:8]}"

    payload = {
        "id": purchase_id,
        "yard_id": yard_id,
        "seller_id": seller_id,
        "primary_payment_mode": "CREDIT",
        "items": [
            {
                "id": item_id,
                "material_id": "mat_iron_rebar",
                "material_name_snapshot": "Irumbu / Kambi",
                "standard_b2b_term_snapshot": "Heavy Melting Scrap / TMT Rebar",
                "gross_weight": "62.500",
                "tare_weight": "0.000",
                "rate_per_kg": "32.00",  # 62.5 * 32 = 2000.00
            }
        ],
    }

    client.post(
        "/api/v1/sync/push",
        headers=worker_headers,
        json={
            "yard_id": yard_id,
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
        },
    )

    # Check outstanding balance before settlement
    before_resp = client.get(f"/api/v1/sellers/{seller_id}/ledger?yard_id={yard_id}", headers=manager_headers)
    assert before_resp.status_code == 200
    before_outstanding = Decimal(str(before_resp.json()["outstanding_balance"]))
    assert before_outstanding >= Decimal("2000.00")

    # Step 2: Settle ₹1500 as Manager
    settle_resp = client.post(
        f"/api/v1/sellers/{seller_id}/settle",
        headers=manager_headers,
        json={
            "yard_id": yard_id,
            "amount": "1500.00",
            "payment_mode": "UPI",
            "reference_number": "UPI-SETTLE-8819",
            "notes": "Partial credit clearance",
        },
    )
    assert settle_resp.status_code == 200, settle_resp.text
    settle_data = settle_resp.json()
    assert Decimal(str(settle_data["settled_amount"])) == Decimal("1500.00")

    # Step 3: Check ledger after settlement - outstanding balance reduced by exactly ₹1500
    after_resp = client.get(f"/api/v1/sellers/{seller_id}/ledger?yard_id={yard_id}", headers=manager_headers)
    after_outstanding = Decimal(str(after_resp.json()["outstanding_balance"]))
    assert after_outstanding == before_outstanding - Decimal("1500.00")

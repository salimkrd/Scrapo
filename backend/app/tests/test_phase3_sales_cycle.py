from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_1_buyer_creation(client: TestClient, owner_headers: dict):
    payload = {
        "yard_id": "yard_kochi_02",
        "company_name": "Cochin Paper Mills Pvt Ltd",
        "contact_person": "Venu Gopal",
        "phone": "+919847123456",
        "email": "procurement@cochinpaper.com",
        "gstin": "32AABCC1234D1Z2",
        "billing_address": "Plot 14, Industrial Estate, Kalamassery",
        "shipping_address": "Plot 14, Industrial Estate, Kalamassery",
        "state": "Kerala",
        "pincode": "683104",
        "payment_terms_days": 30,
        "credit_limit": "250000.00",
        "active": True,
    }
    response = client.post("/api/v1/buyers", json=payload, headers=owner_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["company_name"] == "Cochin Paper Mills Pvt Ltd"
    assert data["gstin"] == "32AABCC1234D1Z2"
    assert Decimal(str(data["credit_limit"])) == Decimal("250000.00")
    assert data["yard_id"] == "yard_kochi_02"


def test_2_buyer_yard_isolation(client: TestClient, owner_headers: dict, manager_headers: dict):
    # Create buyer in Yard 1
    b1 = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Yard 1 Buyer",
            "phone": "+919847111111",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    # Create buyer in Yard 2
    b2 = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_alwaye_03",
            "company_name": "Yard 2 Buyer",
            "phone": "+919847222222",
            "state": "Kerala",
            "billing_address": "Aluva",
            "pincode": "683101",
        },
        headers=owner_headers,
    ).json()

    # Manager of Yard 1 querying Yard 1: should see b1, NOT b2
    res1 = client.get("/api/v1/buyers?yard_id=yard_kochi_02", headers=manager_headers)
    assert res1.status_code == 200
    ids_y1 = [b["id"] for b in res1.json()]
    assert b1["id"] in ids_y1
    assert b2["id"] not in ids_y1

    # Manager of Yard 1 attempting to access Yard 2: forbidden (403)
    res2 = client.get("/api/v1/buyers?yard_id=yard_alwaye_03", headers=manager_headers)
    assert res2.status_code == 403


def test_3_lot_creation_from_available_inventory(client: TestClient, manager_headers: dict):
    # Fetch initial balance
    balances = client.get("/api/v1/inventory/balances?yard_id=yard_kochi_02", headers=manager_headers).json()
    rebar_bal = next(b for b in balances if b["material_id"] == "mat_iron_rebar")
    initial_stock = Decimal(str(rebar_bal["current_stock"]))
    assert initial_stock == Decimal("100.000")

    lot_payload = {
        "yard_id": "yard_kochi_02",
        "lot_number": "LOT-2026-0048",
        "material_id": "mat_iron_rebar",
        "gross_weight": "62.000",
        "tare_weight": "2.000",
        "warehouse_location": "Bay A3",
        "notes": "Bundled TMT rods",
    }
    lot_res = client.post("/api/v1/lots", json=lot_payload, headers=manager_headers)
    assert lot_res.status_code == 201, lot_res.text
    lot = lot_res.json()
    assert lot["lot_number"] == "LOT-2026-0048"
    assert Decimal(str(lot["net_weight"])) == Decimal("60.000")
    assert Decimal(str(lot["available_weight"])) == Decimal("60.000")
    assert lot["status"] == "READY"
    assert lot["warehouse_location"] == "Bay A3"

    # Loose inventory must have decreased by exactly 60.000 KG (from 100 to 40 KG)
    after_balances = client.get("/api/v1/inventory/balances?yard_id=yard_kochi_02", headers=manager_headers).json()
    after_rebar = next(b for b in after_balances if b["material_id"] == "mat_iron_rebar")
    after_stock = Decimal(str(after_rebar["current_stock"]))
    assert after_stock == Decimal("40.000")

    # Decomposition summary check
    summary_res = client.get("/api/v1/lots/summary/stock?yard_id=yard_kochi_02&material_id=mat_iron_rebar", headers=manager_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert Decimal(str(summary["loose_stock"])) == Decimal("40.000")
    assert Decimal(str(summary["lot_stock"])) == Decimal("60.000")
    assert Decimal(str(summary["total_stock"])) == Decimal("100.000")


def test_4_lot_creation_prevents_over_allocation(client: TestClient, manager_headers: dict):
    # mat_iron_rebar has 100 KG loose stock. Attempting to create lot of 150 KG must fail with INSUFFICIENT_INVENTORY
    excess_lot = {
        "yard_id": "yard_kochi_02",
        "material_id": "mat_iron_rebar",
        "gross_weight": "150.000",
        "tare_weight": "0.000",
    }
    res = client.post("/api/v1/lots", json=excess_lot, headers=manager_headers)
    assert res.status_code == 400
    assert "INSUFFICIENT_INVENTORY" in res.json()["code"] or "INSUFFICIENT_INVENTORY" in res.text


def test_5_partial_lot_dispatch(client: TestClient, manager_headers: dict, owner_headers: dict):
    # 1. Create buyer
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Steel Rolling Mills",
            "phone": "+919847111222",
            "state": "Kerala",
            "billing_address": "Edappally",
            "pincode": "682024",
        },
        headers=owner_headers,
    ).json()

    # 2. Create Lot of 60 KG
    lot = client.post(
        "/api/v1/lots",
        json={
            "yard_id": "yard_kochi_02",
            "lot_number": "LOT-2026-0048",
            "material_id": "mat_iron_rebar",
            "gross_weight": "60.000",
            "tare_weight": "0.000",
            "warehouse_location": "Bay A3",
        },
        headers=manager_headers,
    ).json()

    # 3. Sale of 40 KG from lot (60 KG available)
    sales_res = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_iron_rebar",
                    "lot_id": lot["id"],
                    "weight": "40.000",
                    "rate_per_kg": "38.00",
                    "tax_rate": "18.00",
                }
            ],
        },
        headers=manager_headers,
    )
    assert sales_res.status_code == 201, sales_res.text
    order = sales_res.json()

    # 4. Create & confirm dispatch for 40 KG
    disp = client.post(
        "/api/v1/dispatches",
        json={
            "yard_id": "yard_kochi_02",
            "sales_order_id": order["id"],
            "vehicle_number": "KL-07-CB-9000",
            "driver_name": "Rajan",
            "driver_phone": "+919847555555",
            "net_dispatch_weight": "40.000",
        },
        headers=manager_headers,
    ).json()

    conf_res = client.post(f"/api/v1/dispatches/{disp['id']}/confirm", headers=manager_headers)
    assert conf_res.status_code == 200

    # 5. Lot should now have 20 KG available and status PARTIALLY_DISPATCHED
    updated_lot = client.get(f"/api/v1/lots/{lot['id']}", headers=manager_headers).json()
    assert Decimal(str(updated_lot["available_weight"])) == Decimal("20.000")
    assert updated_lot["status"] == "PARTIALLY_DISPATCHED"


def test_6_sales_order_creation(client: TestClient, manager_headers: dict, owner_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Apex Recyclers Ltd",
            "phone": "+919847333333",
            "state": "Kerala",
            "billing_address": "Willingdon Island",
            "pincode": "682003",
        },
        headers=owner_headers,
    ).json()

    # Create sale for copper (50 KG available in conftest)
    order_payload = {
        "yard_id": "yard_kochi_02",
        "buyer_id": buyer["id"],
        "transport_charge": "500.00",
        "loading_charge": "200.00",
        "discount": "100.00",
        "items": [
            {
                "material_id": "mat_copper_windings",
                "weight": "20.000",
                "rate_per_kg": "750.00",
                "tax_rate": "18.00",
            }
        ],
    }
    res = client.post("/api/v1/sales", json=order_payload, headers=manager_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "CONFIRMED"
    # Subtotal = 20 * 750 = 15,000.00
    assert Decimal(str(data["subtotal"])) == Decimal("15000.00")
    # Taxable = 15000 + 500 + 200 - 100 = 15,600.00
    assert Decimal(str(data["taxable_amount"])) == Decimal("15600.00")
    # Intra-state: CGST 9% = 1404.00, SGST 9% = 1404.00, IGST = 0.00
    assert Decimal(str(data["cgst"])) == Decimal("1404.00")
    assert Decimal(str(data["sgst"])) == Decimal("1404.00")
    assert Decimal(str(data["igst"])) == Decimal("0.00")
    # Grand Total = 15600 + 1404 + 1404 = 18,408.00
    assert Decimal(str(data["grand_total"])) == Decimal("18408.00")
    assert Decimal(str(data["balance_amount"])) == Decimal("18408.00")


def test_7_sale_blocks_insufficient_stock(client: TestClient, manager_headers: dict, owner_headers: dict):
    # mat_copper_windings has 50 KG total loose stock in conftest. Attempting to sell 100 KG must fail
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Test Copper Buyer",
            "phone": "+919847111444",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    payload = {
        "yard_id": "yard_kochi_02",
        "buyer_id": buyer["id"],
        "items": [
            {
                "material_id": "mat_copper_windings",
                "weight": "100.000",
                "rate_per_kg": "750.00",
            }
        ],
    }
    res = client.post("/api/v1/sales", json=payload, headers=manager_headers)
    assert res.status_code == 400
    assert "INSUFFICIENT_INVENTORY" in res.json()["code"] or "INSUFFICIENT_INVENTORY" in res.text


def test_8_sale_price_snapshot_immutability(client: TestClient, manager_headers: dict, owner_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Price Snapshot Buyer",
            "phone": "+919847111555",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_plastic_petti",
                    "weight": "10.000",
                    "rate_per_kg": "35.00",
                    "tax_rate": "18.00",
                }
            ],
        },
        headers=manager_headers,
    ).json()

    # Now edit active selling rate for plastic petti
    client.post(
        "/api/v1/materials/mat_plastic_petti/rates",
        json={
            "purchase_rate": "30.00",
            "selling_rate": "55.00",
            "yard_id": "yard_kochi_02",
        },
        headers=owner_headers,
    )

    # Fetch historical order: rate_per_kg must stay 35.00
    refetched = client.get(f"/api/v1/sales/{order['id']}", headers=manager_headers).json()
    item = refetched["items"][0]
    assert Decimal(str(item["rate_per_kg"])) == Decimal("35.00")
    assert Decimal(str(item["line_amount"])) == Decimal("350.00")


def test_9_b2b_description_snapshot_immutability(client: TestClient, manager_headers: dict, owner_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "B2B Terminology Buyer",
            "phone": "+919847111666",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_plastic_petti",
                    "weight": "5.000",
                    "rate_per_kg": "35.00",
                }
            ],
        },
        headers=manager_headers,
    ).json()

    # The snapshot must contain standard B2B name "PP Crates (Polypropylene)"
    item = order["items"][0]
    assert item["standard_b2b_name_snapshot"] == "PP Crates (Polypropylene)"
    assert item["hsn_code_snapshot"] == "3915"


def test_10_buyer_credit_sale(client: TestClient, manager_headers: dict, owner_headers: dict, accountant_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Credit Foundry Pvt Ltd",
            "phone": "+919847444111",
            "state": "Kerala",
            "billing_address": "Angamaly",
            "pincode": "683572",
            "credit_limit": "50000.00",
            "payment_terms_days": 15,
        },
        headers=owner_headers,
    ).json()

    # Sale on credit
    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_copper_windings",
                    "weight": "10.000",
                    "rate_per_kg": "700.00",
                    "tax_rate": "18.00",
                }
            ],
        },
        headers=manager_headers,
    ).json()

    # Generate invoice for credit sale
    inv_res = client.post("/api/v1/invoices", json={"sales_order_id": order["id"]}, headers=accountant_headers)
    assert inv_res.status_code == 201
    invoice = inv_res.json()
    assert invoice["status"] == "ISSUED"
    assert Decimal(str(invoice["balance_amount"])) == Decimal(str(invoice["grand_total"]))

    # Buyer ledger should reflect credit sale as outstanding
    ledger = client.get(f"/api/v1/buyers/{buyer['id']}/ledger", headers=accountant_headers).json()
    assert Decimal(str(ledger["outstanding_balance"])) == Decimal(str(invoice["grand_total"]))


def test_11_partial_buyer_payment(client: TestClient, accountant_headers: dict, manager_headers: dict, owner_headers: dict):
    # 1. Create buyer, sale and invoice
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Partial Pay Buyer",
            "phone": "+919847888111",
            "state": "Kerala",
            "billing_address": "Aluva",
            "pincode": "683101",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {"material_id": "mat_copper_windings", "weight": "10.000", "rate_per_kg": "700.00", "tax_rate": "18.00"}
            ],
        },
        headers=manager_headers,
    ).json()

    inv = client.post("/api/v1/invoices", json={"sales_order_id": order["id"]}, headers=accountant_headers).json()
    total = Decimal(str(inv["grand_total"]))
    part_amount = Decimal("3000.00")

    # 2. Pay ₹3,000 against invoice
    pay_res = client.post(
        "/api/v1/buyer-payments",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "invoice_id": inv["id"],
            "amount": str(part_amount),
            "payment_method": "BANK_TRANSFER",
            "reference_number": "NEFT12345678",
        },
        headers=accountant_headers,
    )
    assert pay_res.status_code == 201

    # 3. Verify invoice status is now PARTIALLY_PAID
    inv_updated = client.get(f"/api/v1/invoices/{inv['id']}", headers=accountant_headers).json()
    assert inv_updated["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_updated["paid_amount"])) == part_amount
    assert Decimal(str(inv_updated["balance_amount"])) == (total - part_amount)


def test_12_final_buyer_payment(client: TestClient, accountant_headers: dict, manager_headers: dict, owner_headers: dict):
    # 1. Setup buyer, sale and invoice
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Full Pay Buyer",
            "phone": "+919847888222",
            "state": "Kerala",
            "billing_address": "Aluva",
            "pincode": "683101",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {"material_id": "mat_plastic_petti", "weight": "10.000", "rate_per_kg": "30.00", "tax_rate": "18.00"}
            ],
        },
        headers=manager_headers,
    ).json()

    inv = client.post("/api/v1/invoices", json={"sales_order_id": order["id"]}, headers=accountant_headers).json()
    total = Decimal(str(inv["grand_total"]))

    # 2. Pay part 1
    client.post(
        "/api/v1/buyer-payments",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "invoice_id": inv["id"],
            "amount": "100.00",
            "payment_method": "CASH",
        },
        headers=accountant_headers,
    )

    # 3. Pay final remaining balance
    rem_balance = total - Decimal("100.00")
    pay_res = client.post(
        "/api/v1/buyer-payments",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "invoice_id": inv["id"],
            "amount": str(rem_balance),
            "payment_method": "UPI",
            "reference_number": "UPI987654321",
        },
        headers=accountant_headers,
    )
    assert pay_res.status_code == 201

    # 4. Invoice must now be PAID with 0 balance
    inv_paid = client.get(f"/api/v1/invoices/{inv['id']}", headers=accountant_headers).json()
    assert inv_paid["status"] == "PAID"
    assert Decimal(str(inv_paid["balance_amount"])) == Decimal("0.00")


def test_13_buyer_ledger_calculation(client: TestClient, accountant_headers: dict, owner_headers: dict, manager_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Ledger Audit Buyer",
            "phone": "+919847999888",
            "state": "Kerala",
            "billing_address": "Fort Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    # Initial ledger
    l0 = client.get(f"/api/v1/buyers/{buyer['id']}/ledger", headers=accountant_headers).json()
    assert Decimal(str(l0["total_sales"])) == Decimal("0.00")
    assert Decimal(str(l0["total_received"])) == Decimal("0.00")
    assert Decimal(str(l0["outstanding_balance"])) == Decimal("0.00")

    # Sale of 5 KG copper @ 700 = 3500 + 18% GST (630) = 4130
    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_copper_windings",
                    "weight": "5.000",
                    "rate_per_kg": "700.00",
                    "tax_rate": "18.00",
                }
            ],
        },
        headers=manager_headers,
    ).json()
    inv = client.post("/api/v1/invoices", json={"sales_order_id": order["id"]}, headers=accountant_headers).json()

    # Ledger after invoice
    l1 = client.get(f"/api/v1/buyers/{buyer['id']}/ledger", headers=accountant_headers).json()
    assert Decimal(str(l1["total_sales"])) == Decimal("4130.00")
    assert Decimal(str(l1["outstanding_balance"])) == Decimal("4130.00")
    assert len(l1["transaction_history"]) == 1
    assert l1["transaction_history"][0]["type"] == "INVOICE"
    assert Decimal(str(l1["transaction_history"][0]["debit"])) == Decimal("4130.00")

    # Payment of 2000
    client.post(
        "/api/v1/buyer-payments",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "invoice_id": inv["id"],
            "amount": "2000.00",
            "payment_method": "CASH",
        },
        headers=accountant_headers,
    )

    # Ledger after payment
    l2 = client.get(f"/api/v1/buyers/{buyer['id']}/ledger", headers=accountant_headers).json()
    assert Decimal(str(l2["total_received"])) == Decimal("2000.00")
    assert Decimal(str(l2["outstanding_balance"])) == Decimal("2130.00")
    assert len(l2["transaction_history"]) == 2
    assert Decimal(str(l2["transaction_history"][1]["running_balance"])) == Decimal("2130.00")


def test_14_inventory_decreases_on_dispatch(client: TestClient, manager_headers: dict, owner_headers: dict):
    # Check current loose balance of mat_plastic_petti
    balances = client.get("/api/v1/inventory/balances?yard_id=yard_kochi_02", headers=manager_headers).json()
    petti_bal = next(b for b in balances if b["material_id"] == "mat_plastic_petti")
    cur_stock = Decimal(str(petti_bal["current_stock"]))
    assert cur_stock >= Decimal("5.000")

    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Dispatch Inventory Buyer",
            "phone": "+919847111777",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    # Create loose sale of 5 KG
    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [
                {
                    "material_id": "mat_plastic_petti",
                    "weight": "5.000",
                    "rate_per_kg": "30.00",
                }
            ],
        },
        headers=manager_headers,
    ).json()

    # Create dispatch
    disp = client.post(
        "/api/v1/dispatches",
        json={
            "yard_id": "yard_kochi_02",
            "sales_order_id": order["id"],
            "vehicle_number": "KL-07-ZZ-1234",
            "net_dispatch_weight": "5.000",
        },
        headers=manager_headers,
    ).json()

    # Confirm dispatch
    client.post(f"/api/v1/dispatches/{disp['id']}/confirm", headers=manager_headers)

    # Inventory must decrease by exactly 5 KG
    after_balances = client.get("/api/v1/inventory/balances?yard_id=yard_kochi_02", headers=manager_headers).json()
    after_petti = next(b for b in after_balances if b["material_id"] == "mat_plastic_petti")
    after_stock = Decimal(str(after_petti["current_stock"]))
    assert (cur_stock - after_stock) == Decimal("5.000")


def test_15_dispatch_cannot_consume_stock_twice(client: TestClient, manager_headers: dict, owner_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Idempotent Dispatch Buyer",
            "phone": "+919847111888",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "2.000", "rate_per_kg": "30.00"}],
        },
        headers=manager_headers,
    ).json()

    disp = client.post(
        "/api/v1/dispatches",
        json={
            "yard_id": "yard_kochi_02",
            "sales_order_id": order["id"],
            "vehicle_number": "KL-07-AW-1111",
            "net_dispatch_weight": "2.000",
        },
        headers=manager_headers,
    ).json()

    # First confirmation succeeds
    res1 = client.post(f"/api/v1/dispatches/{disp['id']}/confirm", headers=manager_headers)
    assert res1.status_code == 200

    # Re-confirming must fail with conflict (409)
    retry_res = client.post(f"/api/v1/dispatches/{disp['id']}/confirm", headers=manager_headers)
    assert retry_res.status_code in [400, 409]
    assert "CONFLICT" in retry_res.text or "already" in retry_res.text.lower()


def test_16_invoice_numbering_uniqueness(client: TestClient, accountant_headers: dict, manager_headers: dict, owner_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Invoice Seq Buyer",
            "phone": "+919847111999",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    # Create 2 sales
    s1 = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "1.000", "rate_per_kg": "30.00"}],
        },
        headers=manager_headers,
    ).json()

    s2 = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "1.000", "rate_per_kg": "30.00"}],
        },
        headers=manager_headers,
    ).json()

    inv1 = client.post("/api/v1/invoices", json={"sales_order_id": s1["id"]}, headers=accountant_headers).json()
    inv2 = client.post("/api/v1/invoices", json={"sales_order_id": s2["id"]}, headers=accountant_headers).json()

    assert inv1["invoice_number"] != inv2["invoice_number"]
    assert inv1["invoice_number"].startswith("SCR/")
    assert inv2["invoice_number"].startswith("SCR/")
    # Sequential verification
    seq1 = int(inv1["invoice_number"].split("/")[-1])
    seq2 = int(inv2["invoice_number"].split("/")[-1])
    assert seq2 == seq1 + 1


def test_17_historical_invoice_snapshot_preservation(client: TestClient, accountant_headers: dict, owner_headers: dict, manager_headers: dict):
    buyer = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Original Alpha Mills",
            "phone": "+919847111000",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    order = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": buyer["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "1.000", "rate_per_kg": "30.00"}],
        },
        headers=manager_headers,
    ).json()

    inv = client.post("/api/v1/invoices", json={"sales_order_id": order["id"]}, headers=accountant_headers).json()
    original_buyer_name = inv["buyer_snapshot"]["company_name"]
    original_total = Decimal(str(inv["grand_total"]))

    # Now mutate the live buyer company name
    client.patch(
        f"/api/v1/buyers/{buyer['id']}",
        json={"company_name": "Totally Mutated Name Inc"},
        headers=owner_headers,
    )

    # Re-fetch invoice: frozen snapshot must remain untouched
    refetched_inv = client.get(f"/api/v1/invoices/{inv['id']}", headers=accountant_headers).json()
    assert refetched_inv["buyer_snapshot"]["company_name"] == "Original Alpha Mills"
    assert Decimal(str(refetched_inv["grand_total"])) == original_total


def test_18_gst_calculation_using_configured_rates(client: TestClient, manager_headers: dict, owner_headers: dict):
    # 1. Intra-state buyer (Kerala -> Kerala): CGST 9% + SGST 9%
    b_kerala = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Kerala Domestic Buyer",
            "phone": "+919847111333",
            "state": "Kerala",
            "billing_address": "Kochi",
            "pincode": "682001",
        },
        headers=owner_headers,
    ).json()

    s_intra = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": b_kerala["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "1.000", "rate_per_kg": "100.00", "tax_rate": "18.00"}],
        },
        headers=manager_headers,
    ).json()

    assert Decimal(str(s_intra["cgst"])) == Decimal("9.00")
    assert Decimal(str(s_intra["sgst"])) == Decimal("9.00")
    assert Decimal(str(s_intra["igst"])) == Decimal("0.00")
    assert Decimal(str(s_intra["grand_total"])) == Decimal("118.00")

    # 2. Inter-state buyer (Kerala -> Tamil Nadu): IGST 18%
    b_tn = client.post(
        "/api/v1/buyers",
        json={
            "yard_id": "yard_kochi_02",
            "company_name": "Coimbatore Paper & Metals",
            "phone": "+919443111222",
            "state": "Tamil Nadu",
            "billing_address": "Coimbatore",
            "pincode": "641001",
        },
        headers=owner_headers,
    ).json()

    s_inter = client.post(
        "/api/v1/sales",
        json={
            "yard_id": "yard_kochi_02",
            "buyer_id": b_tn["id"],
            "items": [{"material_id": "mat_plastic_petti", "weight": "1.000", "rate_per_kg": "100.00", "tax_rate": "18.00"}],
        },
        headers=manager_headers,
    ).json()

    assert Decimal(str(s_inter["cgst"])) == Decimal("0.00")
    assert Decimal(str(s_inter["sgst"])) == Decimal("0.00")
    assert Decimal(str(s_inter["igst"])) == Decimal("18.00")
    assert Decimal(str(s_inter["grand_total"])) == Decimal("118.00")


def test_19_unauthorized_worker_cannot_alter_invoice_values(client: TestClient, worker_headers: dict):
    # Worker attempting to generate or cancel invoice should get 403 Forbidden
    res_gen = client.post(
        "/api/v1/invoices",
        json={"sales_order_id": "some_order_id"},
        headers=worker_headers,
    )
    assert res_gen.status_code == 403

    # Worker attempting to edit buyer credit terms should get 403 Forbidden
    res_credit = client.patch(
        "/api/v1/buyers/any_id",
        json={"credit_limit": "999999.00"},
        headers=worker_headers,
    )
    assert res_credit.status_code == 403


def test_20_multi_yard_sales_isolation(client: TestClient, manager_headers: dict, owner_headers: dict):
    # Manager is in yard_kochi_02 only.
    # Manager querying sales for yard_alwaye_03 must receive 403 Forbidden
    res = client.get("/api/v1/sales?yard_id=yard_alwaye_03", headers=manager_headers)
    assert res.status_code == 403

    # Manager querying lots for yard_alwaye_03 must receive 403 Forbidden
    res_lots = client.get("/api/v1/lots?yard_id=yard_alwaye_03", headers=manager_headers)
    assert res_lots.status_code == 403

    # Manager querying dispatches for yard_alwaye_03 must receive 403 Forbidden
    res_disp = client.get("/api/v1/dispatches?yard_id=yard_alwaye_03", headers=manager_headers)
    assert res_disp.status_code == 403

    # Owner can access both
    res_owner_1 = client.get("/api/v1/sales?yard_id=yard_kochi_02", headers=owner_headers)
    res_owner_2 = client.get("/api/v1/sales?yard_id=yard_alwaye_03", headers=owner_headers)
    assert res_owner_1.status_code == 200
    assert res_owner_2.status_code == 200

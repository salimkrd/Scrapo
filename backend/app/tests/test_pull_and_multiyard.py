from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient


def test_incremental_pull_sync(client: TestClient, worker_headers: dict, manager_headers: dict):
    """Scenario 16: Incremental pull sync returns only changes after last_sync_cursor."""
    yard_id = "yard_kochi_02"

    # Full initial pull (no cursor)
    full_resp = client.post(
        "/api/v1/sync/pull",
        headers=worker_headers,
        json={"yard_id": yard_id, "device_id": "SCRAPO-DEV-TEST-01"},
    )
    assert full_resp.status_code == 200
    full_data = full_resp.json()
    assert len(full_data["materials"]) >= 3
    assert len(full_data["sellers"]) >= 1

    # Take current timestamp as sync cursor
    cursor = datetime.now(timezone.utc).isoformat()

    # Immediate pull with current cursor should return 0 new materials / rates
    incremental_resp1 = client.post(
        "/api/v1/sync/pull",
        headers=worker_headers,
        json={
            "yard_id": yard_id,
            "device_id": "SCRAPO-DEV-TEST-01",
            "last_sync_cursor": cursor,
        },
    )
    assert incremental_resp1.status_code == 200
    inc1_data = incremental_resp1.json()
    assert len(inc1_data["rates"]) == 0

    # Manager updates rate
    client.post(
        f"/api/v1/materials/mat_copper_windings/rates?yard_id={yard_id}",
        headers=manager_headers,
        json={"purchase_rate": "735.00", "selling_rate": "775.00", "version": 1},
    )

    # Incremental pull again with the same cursor now detects the new rate
    incremental_resp2 = client.post(
        "/api/v1/sync/pull",
        headers=worker_headers,
        json={
            "yard_id": yard_id,
            "device_id": "SCRAPO-DEV-TEST-01",
            "last_sync_cursor": cursor,
        },
    )
    assert incremental_resp2.status_code == 200
    inc2_data = incremental_resp2.json()
    assert len(inc2_data["rates"]) == 1
    assert Decimal(str(inc2_data["rates"][0]["purchase_rate"])) == Decimal("735.00")


def test_multi_yard_data_isolation(client: TestClient, worker_headers: dict, owner_headers: dict):
    """Scenario 17: Multi-yard data isolation - Worker of Yard 1 cannot access Yard 2 data, and Yard 1 queries do not return Yard 2 records."""
    yard1 = "yard_kochi_02"
    yard2 = "yard_alwaye_03"

    # 1. Floor worker (assigned only to Yard 1) is blocked with 403 when trying to access Yard 2
    resp_yard2_materials = client.get(f"/api/v1/materials?yard_id={yard2}", headers=worker_headers)
    assert resp_yard2_materials.status_code == 403
    assert resp_yard2_materials.json()["code"] == "PERMISSION_DENIED"

    resp_yard2_pull = client.post(
        "/api/v1/sync/pull",
        headers=worker_headers,
        json={"yard_id": yard2, "device_id": "SCRAPO-DEV-TEST-01"},
    )
    assert resp_yard2_pull.status_code == 403

    # 2. Querying Yard 1 as worker only returns Yard 1 materials, never Yard 2 items
    resp_yard1_materials = client.get(f"/api/v1/materials?yard_id={yard1}", headers=worker_headers)
    assert resp_yard1_materials.status_code == 200
    yard1_materials = resp_yard1_materials.json()
    yard1_mat_ids = [m["id"] for m in yard1_materials]
    assert "mat_yard2_secret" not in yard1_mat_ids

    # 3. Owner (who has multi-yard access) querying Yard 2 sees Yard 2 materials but not Yard 1
    resp_owner_yard2 = client.get(f"/api/v1/materials?yard_id={yard2}", headers=owner_headers)
    assert resp_owner_yard2.status_code == 200
    yard2_materials = resp_owner_yard2.json()
    yard2_mat_ids = [m["id"] for m in yard2_materials]
    assert "mat_yard2_secret" in yard2_mat_ids
    assert "mat_iron_rebar" not in yard2_mat_ids

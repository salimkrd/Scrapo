from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.app.models.material import Material, MaterialRate


def test_rate_history_preservation(client: TestClient, manager_headers: dict, db: Session):
    """Scenario 12: Updating a rate sets effective_to on the old rate and inserts a new version, preserving full history."""
    material_id = "mat_iron_rebar"
    yard_id = "yard_kochi_02"

    # Initial rate is seeded with version=1, rate=32.00
    # Update rate to 35.00 with version=1
    resp = client.post(
        f"/api/v1/materials/{material_id}/rates?yard_id={yard_id}",
        headers=manager_headers,
        json={"purchase_rate": "35.00", "selling_rate": "39.00", "version": 1},
    )
    assert resp.status_code == 200, resp.text
    new_rate_data = resp.json()
    assert Decimal(str(new_rate_data["purchase_rate"])) == Decimal("35.00")
    assert new_rate_data["version"] == 2

    # Query history via API
    hist_resp = client.get(
        f"/api/v1/materials/{material_id}/rates/history?yard_id={yard_id}",
        headers=manager_headers,
    )
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) >= 2

    # Old rate has effective_to set (not null)
    old_rate = next(r for r in history if r["version"] == 1)
    assert old_rate["effective_to"] is not None
    assert Decimal(str(old_rate["purchase_rate"])) == Decimal("32.00")

    # Current rate has effective_to as None
    current_rate = next(r for r in history if r["version"] == 2)
    assert current_rate["effective_to"] is None


def test_rate_conflict_detection(client: TestClient, manager_headers: dict):
    """Scenario 13: Updating a rate with an obsolete client version triggers RateConflictError (409)."""
    material_id = "mat_iron_rebar"
    yard_id = "yard_kochi_02"

    # Step 1: Update rate to version 2
    r1 = client.post(
        f"/api/v1/materials/{material_id}/rates?yard_id={yard_id}",
        headers=manager_headers,
        json={"purchase_rate": "33.00", "selling_rate": "37.00", "version": 1},
    )
    assert r1.status_code == 200
    assert r1.json()["version"] == 2

    # Step 2: Another client tries to update using outdated version=1
    r2 = client.post(
        f"/api/v1/materials/{material_id}/rates?yard_id={yard_id}",
        headers=manager_headers,
        json={"purchase_rate": "34.00", "selling_rate": "38.00", "version": 1},
    )
    assert r2.status_code == 409
    err = r2.json()
    assert err["code"] == "RATE_CONFLICT"
    assert "updated by another user" in err["message"]


def test_alias_updates_preserve_standard_b2b_category(client: TestClient, worker_headers: dict, db: Session):
    """Scenario 18: Alias updates preserve standard B2B category."""
    alias_id = "alias_iron_rebar"
    material_id = "mat_iron_rebar"

    # Get material before alias update
    mat_before = db.query(Material).filter(Material.id == material_id).first()
    orig_b2b_name = mat_before.standard_name
    orig_master_cat = mat_before.master_category

    # Update alias (local Malayalam / English names)
    update_resp = client.put(
        f"/api/v1/materials/aliases/{alias_id}",
        headers=worker_headers,
        json={
            "display_name_english": "Irumbu / Kambi - Grade A",
            "display_name_malayalam": "ഇരുമ്പ് / കമ്പി - ഗ്രേഡ് എ",
            "local_subtitle": "Reinforced heavy TMT rebar",
            "version": 1,
        },
    )
    assert update_resp.status_code == 200, update_resp.text
    alias_data = update_resp.json()
    assert alias_data["display_name_english"] == "Irumbu / Kambi - Grade A"

    # Verify underlying Material entity preserves B2B standard fields untouched
    db.expire_all()
    mat_after = db.query(Material).filter(Material.id == material_id).first()
    assert mat_after.standard_name == orig_b2b_name
    assert mat_after.master_category == orig_master_cat
    assert mat_after.standard_name == "Heavy Melting Scrap / TMT Rebar"
    assert mat_after.master_category == "iron_steel"

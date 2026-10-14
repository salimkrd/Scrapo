from decimal import Decimal
from fastapi.testclient import TestClient


def test_login_success(client: TestClient):
    """Scenario 1: Login success with valid credentials returns JWT tokens and profile."""
    # Test login with email
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": "owner@scrapo.in", "password": "Owner@1234"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "owner@scrapo.in"
    assert data["user"]["role"] == "OWNER"

    # Test login with phone
    resp_phone = client.post(
        "/api/v1/auth/login",
        json={"identifier": "+919847012345", "password": "Worker@1234"},
    )
    assert resp_phone.status_code == 200
    data_phone = resp_phone.json()
    assert data_phone["user"]["role"] == "FLOOR_WORKER"


def test_invalid_login_rejected(client: TestClient):
    """Scenario 2: Invalid login rejected with 401 AuthenticationError."""
    # Wrong password
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": "owner@scrapo.in", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401
    data = resp.json()
    assert data["code"] == "AUTH_ERROR"

    # Non-existent user
    resp_unknown = client.post(
        "/api/v1/auth/login",
        json={"identifier": "unknown@scrapo.in", "password": "Password@123"},
    )
    assert resp_unknown.status_code == 401
    assert resp_unknown.json()["code"] == "AUTH_ERROR"


def test_worker_permissions_enforced(client: TestClient, worker_headers: dict):
    """Scenario 3: Worker permissions enforced - Floor worker blocked from managerial actions."""
    # 1. Blocked from creating a yard
    resp_yard = client.post(
        "/api/v1/yards",
        headers=worker_headers,
        json={"name": "Hacked Yard", "code": "YARD-HACK", "district": "Ernakulam", "state": "Kerala"},
    )
    assert resp_yard.status_code == 403
    assert resp_yard.json()["code"] == "PERMISSION_DENIED"

    # 2. Blocked from modifying master rates
    resp_rate = client.post(
        "/api/v1/materials/mat_iron_rebar/rates?yard_id=yard_kochi_02",
        headers=worker_headers,
        json={"purchase_rate": "35.00", "selling_rate": "40.00", "version": 1},
    )
    assert resp_rate.status_code == 403
    assert resp_rate.json()["code"] == "PERMISSION_DENIED"

    # 3. Blocked from settling seller ledger balance
    resp_settle = client.post(
        "/api/v1/sellers/seller_shaji_01/settle",
        headers=worker_headers,
        json={
            "yard_id": "yard_kochi_02",
            "amount": "1000.00",
            "payment_mode": "CASH",
        },
    )
    assert resp_settle.status_code == 403
    assert resp_settle.json()["code"] == "PERMISSION_DENIED"


def test_owner_permissions_enforced(client: TestClient, owner_headers: dict):
    """Scenario 4: Owner permissions enforced - Owner allowed across managerial endpoints."""
    # 1. Allowed to create yard
    resp_yard = client.post(
        "/api/v1/yards",
        headers=owner_headers,
        json={
            "name": "New Calicut Yard",
            "code": "YARD-04",
            "district": "Kozhikode",
            "state": "Kerala",
        },
    )
    assert resp_yard.status_code == 200
    assert resp_yard.json()["code"] == "YARD-04"

    # 2. Allowed to update rate
    resp_rate = client.post(
        "/api/v1/materials/mat_iron_rebar/rates?yard_id=yard_kochi_02",
        headers=owner_headers,
        json={"purchase_rate": "34.00", "selling_rate": "38.00", "version": 1},
    )
    assert resp_rate.status_code == 200
    assert Decimal(str(resp_rate.json()["purchase_rate"])) == Decimal("34.00")

import os
import sys
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Setup python path
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(TEST_DIR)
BACKEND_DIR = os.path.dirname(APP_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
for path in [PROJECT_ROOT, BACKEND_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.app.core.security import create_access_token, hash_password
from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.main import app
from backend.app.models.inventory import InventoryBalance
from backend.app.models.material import (
    Material,
    MaterialAlias,
    MaterialCategory,
    MaterialRate,
)
from backend.app.models.seller import Seller
from backend.app.models.user import Role, User, UserYard
from backend.app.models.yard import Yard

# Test in-memory SQLite database
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Seed Base Data for Tests
    # 1. Roles
    roles = [
        Role(id="OWNER", name="Owner", description="Full control"),
        Role(id="MANAGER", name="Manager", description="Manager"),
        Role(id="FLOOR_WORKER", name="Floor Worker", description="Worker"),
        Role(id="ACCOUNTANT", name="Accountant", description="Accountant"),
    ]
    for r in roles:
        session.add(r)

    # 2. Yard 1 (Kochi) and Yard 2 (Alwaye)
    yard_1 = Yard(
        id="yard_kochi_02",
        name="Sri Balaji Scrap Yard",
        name_ml="ശ്രീ ബാലാജി സ്ക്രാപ്പ് യാർഡ്",
        code="YARD-02",
        address="Marine Drive, Kochi",
        district="Ernakulam",
        state="Kerala",
        active=True,
    )
    yard_2 = Yard(
        id="yard_alwaye_03",
        name="Alwaye Metal Traders",
        name_ml="ആലുവ മെറ്റൽ ട്രേഡേഴ്സ്",
        code="YARD-03",
        address="Aluva Railway Station Road",
        district="Ernakulam",
        state="Kerala",
        active=True,
    )
    session.add_all([yard_1, yard_2])
    session.flush()

    # 3. Users
    owner = User(
        id="usr_owner",
        name="Ramesh Owner",
        email="owner@scrapo.in",
        phone="+919847000001",
        password_hash=hash_password("Owner@1234"),
        role="OWNER",
        active=True,
    )
    manager = User(
        id="usr_manager",
        name="Praveen Manager",
        email="manager@scrapo.in",
        phone="+919847000002",
        password_hash=hash_password("Manager@1234"),
        role="MANAGER",
        active=True,
    )
    worker = User(
        id="usr_worker",
        name="Manoj Worker",
        email="worker@scrapo.in",
        phone="+919847012345",
        password_hash=hash_password("Worker@1234"),
        role="FLOOR_WORKER",
        active=True,
    )
    accountant = User(
        id="usr_accountant",
        name="Sunil Accountant",
        email="accountant@scrapo.in",
        phone="+919847000004",
        password_hash=hash_password("Accountant@1234"),
        role="ACCOUNTANT",
        active=True,
    )
    session.add_all([owner, manager, worker, accountant])
    session.flush()

    # User Yards:
    # Worker is ONLY in yard_kochi_02
    session.add(UserYard(user_id=worker.id, yard_id=yard_1.id, role_in_yard="FLOOR_WORKER"))
    session.add(UserYard(user_id=manager.id, yard_id=yard_1.id, role_in_yard="MANAGER"))
    session.add(UserYard(user_id=accountant.id, yard_id=yard_1.id, role_in_yard="ACCOUNTANT"))
    session.add(UserYard(user_id=owner.id, yard_id=yard_1.id, role_in_yard="OWNER"))
    session.add(UserYard(user_id=owner.id, yard_id=yard_2.id, role_in_yard="OWNER"))
    session.flush()

    # 4. Material Category
    cat_fe = MaterialCategory(id="iron_steel", name="Iron & Steel", name_ml="ഇരുമ്പ് & സ്റ്റീൽ", display_order=1)
    cat_cu = MaterialCategory(id="copper", name="Copper", name_ml="ചെമ്പ്", display_order=2)
    cat_pl = MaterialCategory(id="plastic", name="Plastic", name_ml="പ്ലാസ്റ്റിക്", display_order=3)
    session.add_all([cat_fe, cat_cu, cat_pl])
    session.flush()

    # 5. Materials for Yard 1
    # Mat 1: Iron Rebar
    mat_rebar = Material(
        id="mat_iron_rebar",
        yard_id=yard_1.id,
        master_category="iron_steel",
        standard_name="Heavy Melting Scrap / TMT Rebar",
        standard_code="FE-REBAR",
        unit="KG",
        expected_selling_rate=Decimal("36.00"),
        active=True,
    )
    alias_rebar = MaterialAlias(
        id="alias_iron_rebar",
        material_id=mat_rebar.id,
        yard_id=yard_1.id,
        display_name_english="Irumbu / Kambi",
        display_name_malayalam="ഇരുമ്പ് / കമ്പി",
        local_subtitle="Clean TMT bars",
        district="Ernakulam",
        is_primary=True,
        default_tare=Decimal("0.000"),
    )
    rate_rebar = MaterialRate(
        id="rate_rebar_v1",
        material_id=mat_rebar.id,
        yard_id=yard_1.id,
        purchase_rate=Decimal("32.00"),
        selling_rate=Decimal("36.00"),
        version=1,
        created_by="system",
    )
    bal_rebar = InventoryBalance(
        id=f"bal_{yard_1.id}_{mat_rebar.id}",
        yard_id=yard_1.id,
        material_id=mat_rebar.id,
        current_stock=Decimal("100.000"),
    )

    # Mat 2: Copper
    mat_copper = Material(
        id="mat_copper_windings",
        yard_id=yard_1.id,
        master_category="copper",
        standard_name="Copper - Motor Windings",
        standard_code="CU-WIND",
        unit="KG",
        expected_selling_rate=Decimal("760.00"),
        active=True,
    )
    alias_copper = MaterialAlias(
        id="alias_copper_windings",
        material_id=mat_copper.id,
        yard_id=yard_1.id,
        display_name_english="Chembu",
        display_name_malayalam="ചെമ്പ്",
        local_subtitle="Motor windings",
        district="Ernakulam",
        is_primary=True,
        default_tare=Decimal("0.000"),
    )
    rate_copper = MaterialRate(
        id="rate_copper_v1",
        material_id=mat_copper.id,
        yard_id=yard_1.id,
        purchase_rate=Decimal("720.00"),
        selling_rate=Decimal("760.00"),
        version=1,
        created_by="system",
    )
    bal_copper = InventoryBalance(
        id=f"bal_{yard_1.id}_{mat_copper.id}",
        yard_id=yard_1.id,
        material_id=mat_copper.id,
        current_stock=Decimal("50.000"),
    )

    # Mat 3: Plastic Petti (PP Crates)
    mat_petti = Material(
        id="mat_plastic_petti",
        yard_id=yard_1.id,
        master_category="plastic",
        standard_name="PP Crates (Polypropylene)",
        standard_code="PL-PETTI",
        unit="KG",
        expected_selling_rate=Decimal("33.00"),
        active=True,
    )
    alias_petti = MaterialAlias(
        id="alias_plastic_petti",
        material_id=mat_petti.id,
        yard_id=yard_1.id,
        display_name_english="Petti",
        display_name_malayalam="പെട്ടി",
        local_subtitle="PP Crates",
        district="Ernakulam",
        is_primary=True,
        default_tare=Decimal("0.400"),
    )
    rate_petti = MaterialRate(
        id="rate_petti_v1",
        material_id=mat_petti.id,
        yard_id=yard_1.id,
        purchase_rate=Decimal("28.00"),
        selling_rate=Decimal("33.00"),
        version=1,
        created_by="system",
    )
    bal_petti = InventoryBalance(
        id=f"bal_{yard_1.id}_{mat_petti.id}",
        yard_id=yard_1.id,
        material_id=mat_petti.id,
        current_stock=Decimal("20.000"),
    )

    # Material for Yard 2 (Alwaye) to test multi-yard isolation
    mat_yard2 = Material(
        id="mat_yard2_secret",
        yard_id=yard_2.id,
        master_category="iron_steel",
        standard_name="Yard 2 Only Metal",
        standard_code="FE-Y2",
        unit="KG",
        expected_selling_rate=Decimal("40.00"),
        active=True,
    )
    alias_yard2 = MaterialAlias(
        id="alias_yard2_secret",
        material_id=mat_yard2.id,
        yard_id=yard_2.id,
        display_name_english="Yard 2 Metal",
        display_name_malayalam="യാർഡ് 2 മെറ്റൽ",
        local_subtitle="Yard 2 only",
        district="Ernakulam",
        is_primary=True,
        default_tare=Decimal("0.000"),
    )

    session.add_all([
        mat_rebar, alias_rebar, rate_rebar, bal_rebar,
        mat_copper, alias_copper, rate_copper, bal_copper,
        mat_petti, alias_petti, rate_petti, bal_petti,
        mat_yard2, alias_yard2
    ])
    session.flush()

    # 6. Sellers
    seller_shaji = Seller(
        id="seller_shaji_01",
        yard_id=yard_1.id,
        name="Shaji",
        name_ml="ഷാജി",
        initials="SH",
        type="Local Collector",
        phone="+919847111001",
        badge="Regular Seller",
        vehicle_number="KL-07-AW-4819",
        upi_id="shaji@oksbi",
        active=True,
    )
    seller_yard2 = Seller(
        id="seller_yard2_only",
        yard_id=yard_2.id,
        name="Yard 2 Supplier",
        name_ml="യാർഡ് 2 വിതരണക്കാരൻ",
        initials="Y2",
        type="Contractor",
        phone="+919847222002",
        badge="VIP",
        active=True,
    )
    session.add_all([seller_shaji, seller_yard2])
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def owner_headers(db):
    token = create_access_token("usr_owner", "OWNER", ["yard_kochi_02", "yard_alwaye_03"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_headers(db):
    token = create_access_token("usr_manager", "MANAGER", ["yard_kochi_02"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def worker_headers(db):
    token = create_access_token("usr_worker", "FLOOR_WORKER", ["yard_kochi_02"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def accountant_headers(db):
    token = create_access_token("usr_accountant", "ACCOUNTANT", ["yard_kochi_02"])
    return {"Authorization": f"Bearer {token}"}

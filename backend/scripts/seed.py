import os
import sys
from decimal import Decimal
from datetime import datetime, timezone

# Ensure project root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
for path in [PROJECT_ROOT, BACKEND_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from backend.app.core.security import get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import engine, SessionLocal
from backend.app.models.user import User, Role, UserYard
from backend.app.models.yard import Yard
from backend.app.models.material import MaterialCategory, Material, MaterialAlias, MaterialRate
from backend.app.models.seller import Seller
from backend.app.models.inventory import InventoryBalance


def seed_database():
    print("🌱 Starting Scrapo Phase 2 Database Seeding...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Roles
        roles_data = [
            ("OWNER", "Owner", "Complete administrative control over all yards, rates, and users"),
            ("MANAGER", "Yard Manager", "Operational supervision, daily rate overrides, seller credit limit adjustments"),
            ("FLOOR_WORKER", "Floor Worker", "Fast field procurement, gross/tare weight entry, cash and UPI payouts"),
            ("ACCOUNTANT", "Accountant", "Audit access, ledger export, seller settlement management"),
        ]
        for role_id, name, desc in roles_data:
            existing_role = db.query(Role).filter(Role.id == role_id).first()
            if not existing_role:
                db.add(Role(id=role_id, name=name, description=desc))
        db.flush()
        print("  ✓ Roles seeded")

        # 2. Seed Yard
        yard_id = "yard_kochi_02"
        existing_yard = db.query(Yard).filter(Yard.id == yard_id).first()
        if not existing_yard:
            yard = Yard(
                id=yard_id,
                name="Sri Balaji Scrap Yard",
                name_ml="ശ്രീ ബാലാജി സ്ക്രാപ്പ് യാർഡ്",
                code="YARD-02",
                address="Near Goods Shed, Marine Drive Industrial Area, Kochi",
                district="Ernakulam",
                state="Kerala",
                timezone="Asia/Kolkata",
                scale_identifier="CAS-CI-2001-YARD02",
                active=True,
            )
            db.add(yard)
            db.flush()
            print("  ✓ Demo Yard seeded: Sri Balaji Scrap Yard (YARD-02)")
        else:
            yard = existing_yard

        # 3. Seed Users
        users_data = [
            {
                "id": "usr_owner_01",
                "name": "Ramesh Balaji",
                "email": "owner@scrapo.in",
                "phone": "+919847000001",
                "password": "Owner@1234",
                "role": "OWNER",
            },
            {
                "id": "usr_manager_01",
                "name": "Praveen Kumar",
                "email": "manager@scrapo.in",
                "phone": "+919847000002",
                "password": "Manager@1234",
                "role": "MANAGER",
            },
            {
                "id": "usr_worker_01",
                "name": "Manoj Kumar",
                "email": "worker@scrapo.in",
                "phone": "+919847012345",
                "password": "Worker@1234",
                "role": "FLOOR_WORKER",
            },
            {
                "id": "usr_accountant_01",
                "name": "Sunil Shenoy",
                "email": "accountant@scrapo.in",
                "phone": "+919847000004",
                "password": "Accountant@1234",
                "role": "ACCOUNTANT",
            },
        ]

        for u in users_data:
            existing_user = db.query(User).filter(User.phone == u["phone"]).first()
            if not existing_user:
                user = User(
                    id=u["id"],
                    name=u["name"],
                    email=u["email"],
                    phone=u["phone"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                    active=True,
                )
                db.add(user)
                db.flush()

                # Map user to yard
                db.add(UserYard(
                    user_id=user.id,
                    yard_id=yard.id,
                    role_in_yard=u["role"],
                ))
            else:
                user = existing_user
        db.flush()
        print("  ✓ Users seeded (Owner, Manager, Floor Worker, Accountant)")

        # 4. Seed Material Categories
        categories_data = [
            ("iron_steel", "Iron & Steel", "ഇരുമ്പ് & സ്റ്റീൽ", 1),
            ("copper", "Copper", "ചെമ്പ്", 2),
            ("brass_bronze", "Brass & Bronze", "പിത്തള & ഓട്", 3),
            ("paper", "Paper & Cardboard", "പേപ്പർ & അട്ട", 4),
            ("plastic", "Plastic", "പ്ലാസ്റ്റിക്", 5),
            ("other", "Other Metals", "മറ്റു ലോഹങ്ങൾ", 6),
        ]
        for cat_id, cat_name, cat_ml, order in categories_data:
            existing_cat = db.query(MaterialCategory).filter(MaterialCategory.id == cat_id).first()
            if not existing_cat:
                db.add(MaterialCategory(
                    id=cat_id,
                    name=cat_name,
                    name_ml=cat_ml,
                    display_order=order,
                ))
        db.flush()
        print("  ✓ Material Categories seeded")

        # 5. Seed 10 Materials with Corrected Local Aliases & B2B Standard Categories
        materials_data = [
            {
                "id": "mat_iron_rebar",
                "master_category": "iron_steel",
                "standard_name": "Heavy Melting Scrap / TMT Rebar",
                "standard_code": "FE-REBAR",
                "unit": "KG",
                "expected_selling_rate": Decimal("36.00"),
                "icon": "rebar",
                "accent_color": "slate",
                "alias_en": "Irumbu / Kambi",
                "alias_ml": "ഇരുമ്പ് / കമ്പി",
                "subtitle": "Clean TMT bars, angles, channels",
                "purchase_rate": Decimal("32.00"),
                "selling_rate": Decimal("36.00"),
                "initial_stock": Decimal("1250.000"),
                "tare": Decimal("0.000"),
            },
            {
                "id": "mat_iron_tin",
                "master_category": "iron_steel",
                "standard_name": "Lightweight Tin / MS Sheet Scrap",
                "standard_code": "FE-TIN",
                "unit": "KG",
                "expected_selling_rate": Decimal("22.00"),
                "icon": "tin",
                "accent_color": "slate",
                "alias_en": "Takaram",
                "alias_ml": "തകരം",
                "subtitle": "Light tin sheets, cans, roofing",
                "purchase_rate": Decimal("18.00"),
                "selling_rate": Decimal("22.00"),
                "initial_stock": Decimal("420.000"),
                "tare": Decimal("0.200"),
            },
            {
                "id": "mat_copper_windings",
                "master_category": "copper",
                "standard_name": "Copper - Motor Windings",
                "standard_code": "CU-WIND",
                "unit": "KG",
                "expected_selling_rate": Decimal("760.00"),
                "icon": "wire",
                "accent_color": "amber",
                "alias_en": "Chembu",
                "alias_ml": "ചെമ്പ്",
                "subtitle": "Armature, motor coil, heavy stripped wire",
                "purchase_rate": Decimal("720.00"),
                "selling_rate": Decimal("760.00"),
                "initial_stock": Decimal("85.500"),
                "tare": Decimal("0.000"),
            },
            {
                "id": "mat_brass_mixed",
                "master_category": "brass_bronze",
                "standard_name": "Mixed Brass / Heavy Bronze",
                "standard_code": "BR-MIX",
                "unit": "KG",
                "expected_selling_rate": Decimal("520.00"),
                "icon": "valve",
                "accent_color": "yellow",
                "alias_en": "Pithala / Odu",
                "alias_ml": "പിത്തള / ഓട്",
                "subtitle": "Valves, utensils, antique items",
                "purchase_rate": Decimal("480.00"),
                "selling_rate": Decimal("520.00"),
                "initial_stock": Decimal("64.000"),
                "tare": Decimal("0.000"),
            },
            {
                "id": "mat_paper_occ",
                "master_category": "paper",
                "standard_name": "OCC - Old Corrugated Containers",
                "standard_code": "PA-OCC",
                "unit": "KG",
                "expected_selling_rate": Decimal("15.00"),
                "icon": "carton",
                "accent_color": "orange",
                "alias_en": "Atta",
                "alias_ml": "അട്ട",
                "subtitle": "Brown packaging boxes, kraft carton bundles",
                "purchase_rate": Decimal("12.50"),
                "selling_rate": Decimal("15.00"),
                "initial_stock": Decimal("890.000"),
                "tare": Decimal("0.500"),
            },
            {
                "id": "mat_paper_raddi",
                "master_category": "paper",
                "standard_name": "Mixed Waste Paper / White Ledger",
                "standard_code": "PA-RADDI",
                "unit": "KG",
                "expected_selling_rate": Decimal("17.00"),
                "icon": "newspaper",
                "accent_color": "orange",
                "alias_en": "Raddi / Record",
                "alias_ml": "റദ്ദി / റെക്കോർഡ്",
                "subtitle": "Newspapers, books, office ledger papers",
                "purchase_rate": Decimal("14.00"),
                "selling_rate": Decimal("17.00"),
                "initial_stock": Decimal("340.000"),
                "tare": Decimal("0.000"),
            },
            {
                "id": "mat_plastic_hdpe",
                "master_category": "plastic",
                "standard_name": "HDPE / Rigid PVC",
                "standard_code": "PL-HDPE",
                "unit": "KG",
                "expected_selling_rate": Decimal("29.00"),
                "icon": "barrel",
                "accent_color": "blue",
                "alias_en": "Kadappakku / Hard Plastic",
                "alias_ml": "കടപ്പാക്ക് / ഹാർഡ് പ്ലാസ്റ്റിക്",
                "subtitle": "Buckets, drums, pipe cuttings",
                "purchase_rate": Decimal("24.00"),
                "selling_rate": Decimal("29.00"),
                "initial_stock": Decimal("510.000"),
                "tare": Decimal("0.300"),
            },
            {
                "id": "mat_plastic_petti",
                "master_category": "plastic",
                "standard_name": "PP Crates (Polypropylene)",
                "standard_code": "PL-PETTI",
                "unit": "KG",
                "expected_selling_rate": Decimal("33.00"),
                "icon": "crate",
                "accent_color": "blue",
                "alias_en": "Petti",
                "alias_ml": "പെട്ടി",
                "subtitle": "Vegetable, milk, and beverage crates",
                "purchase_rate": Decimal("28.00"),
                "selling_rate": Decimal("33.00"),
                "initial_stock": Decimal("260.000"),
                "tare": Decimal("0.400"),
            },
            {
                "id": "mat_plastic_kuppi",
                "master_category": "plastic",
                "standard_name": "PET Bottles (Clear/Mixed)",
                "standard_code": "PL-KUPPI",
                "unit": "KG",
                "expected_selling_rate": Decimal("20.00"),
                "icon": "bottle",
                "accent_color": "cyan",
                "alias_en": "Kuppi",
                "alias_ml": "കുപ്പി",
                "subtitle": "Mineral water & soft drink transparent bottles",
                "purchase_rate": Decimal("16.00"),
                "selling_rate": Decimal("20.00"),
                "initial_stock": Decimal("180.000"),
                "tare": Decimal("0.100"),
            },
            {
                "id": "mat_aluminium_mixed",
                "master_category": "other",
                "standard_name": "Aluminium - Extrusion / Cast Scrap",
                "standard_code": "AL-MIX",
                "unit": "KG",
                "expected_selling_rate": Decimal("150.00"),
                "icon": "extrusion",
                "accent_color": "emerald",
                "alias_en": "Aluminium",
                "alias_ml": "അലുമിനിയം",
                "subtitle": "Door frames, aircraft alloy, engine parts",
                "purchase_rate": Decimal("135.00"),
                "selling_rate": Decimal("150.00"),
                "initial_stock": Decimal("95.000"),
                "tare": Decimal("0.000"),
            },
        ]

        for m_data in materials_data:
            existing_mat = db.query(Material).filter(Material.id == m_data["id"]).first()
            if not existing_mat:
                mat = Material(
                    id=m_data["id"],
                    yard_id=yard.id,
                    master_category=m_data["master_category"],
                    standard_name=m_data["standard_name"],
                    standard_code=m_data["standard_code"],
                    unit=m_data["unit"],
                    expected_selling_rate=m_data["expected_selling_rate"],
                    icon=m_data["icon"],
                    accent_color=m_data["accent_color"],
                    active=True,
                )
                db.add(mat)
                db.flush()

                # Add Alias
                alias = MaterialAlias(
                    id=f"alias_{m_data['id']}",
                    material_id=mat.id,
                    yard_id=yard.id,
                    display_name_english=m_data["alias_en"],
                    display_name_malayalam=m_data["alias_ml"],
                    local_subtitle=m_data["subtitle"],
                    district="Ernakulam",
                    is_primary=True,
                    default_tare=m_data["tare"],
                )
                db.add(alias)

                # Add Rate
                rate = MaterialRate(
                    id=f"rate_{m_data['id']}_v1",
                    material_id=mat.id,
                    yard_id=yard.id,
                    purchase_rate=m_data["purchase_rate"],
                    selling_rate=m_data["selling_rate"],
                    version=1,
                    created_by="system_seed",
                )
                db.add(rate)

                # Add Inventory Balance
                balance = InventoryBalance(
                    id=f"bal_{yard.id}_{mat.id}",
                    yard_id=yard.id,
                    material_id=mat.id,
                    current_stock=m_data["initial_stock"],
                )
                db.add(balance)

        db.flush()
        print("  ✓ 10 Materials, Aliases, Rates, and Inventory balances seeded")

        # 6. Seed Sellers
        sellers_data = [
            {
                "id": "seller_shaji_01",
                "name": "Shaji",
                "name_ml": "ഷാജി",
                "initials": "SH",
                "type": "Local Collector",
                "phone": "+919847111001",
                "badge": "Regular Seller",
                "vehicle_number": "KL-07-AW-4819",
                "upi_id": "shaji@oksbi",
                "bank_name": "State Bank of India",
                "bank_account": "•••• 4819",
                "ifsc": "SBIN0000860",
            },
            {
                "id": "seller_benny_02",
                "name": "Benny",
                "name_ml": "ബെന്നി",
                "initials": "BE",
                "type": "Workshop Contractor",
                "phone": "+919847111002",
                "badge": "Contractor",
                "vehicle_number": "KL-07-BQ-1102",
                "upi_id": "benny@okaxis",
                "bank_name": "Axis Bank",
                "bank_account": "•••• 1102",
                "ifsc": "UTIB0000040",
            },
            {
                "id": "seller_sasi_03",
                "name": "Sasi",
                "name_ml": "ശശി",
                "initials": "SA",
                "type": "Daily Picker",
                "phone": "+919847111003",
                "badge": "Daily Picker",
                "vehicle_number": "KL-07-CC-8722",
                "upi_id": "sasi@paytm",
                "bank_name": "Canara Bank",
                "bank_account": "•••• 8722",
                "ifsc": "CNRB0000821",
            },
            {
                "id": "seller_hassan_04",
                "name": "Hassan",
                "name_ml": "ഹസൻ",
                "initials": "HA",
                "type": "Demolition Contractor",
                "phone": "+919847111004",
                "badge": "Demolition Wholesale",
                "vehicle_number": "KL-07-DH-5541",
                "upi_id": "hassan@federal",
                "bank_name": "Federal Bank",
                "bank_account": "•••• 5541",
                "ifsc": "FDRL0001244",
            },
        ]

        for s in sellers_data:
            existing_seller = db.query(Seller).filter(Seller.id == s["id"]).first()
            if not existing_seller:
                db.add(Seller(
                    id=s["id"],
                    yard_id=yard.id,
                    name=s["name"],
                    name_ml=s["name_ml"],
                    initials=s["initials"],
                    type=s["type"],
                    phone=s["phone"],
                    badge=s["badge"],
                    vehicle_number=s["vehicle_number"],
                    upi_id=s["upi_id"],
                    bank_name=s["bank_name"],
                    bank_account=s["bank_account"],
                    ifsc=s["ifsc"],
                    active=True,
                ))
        db.flush()
        print("  ✓ 4 Sellers seeded")

        db.commit()
        print("✅ Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

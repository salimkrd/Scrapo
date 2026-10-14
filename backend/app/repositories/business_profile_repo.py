import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.app.models.business_profile import BusinessProfile
from backend.app.models.yard import Yard
from backend.app.schemas.business_profile import BusinessProfileCreate, BusinessProfileUpdate


class BusinessProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_yard(self, yard_id: str) -> BusinessProfile:
        stmt = select(BusinessProfile).where(BusinessProfile.yard_id == yard_id)
        profile = self.db.execute(stmt).scalar_one_or_none()
        if not profile:
            # Create default billing profile seeded with Yard details
            yard = self.db.execute(select(Yard).where(Yard.id == yard_id)).scalar_one_or_none()
            yard_name = yard.name if yard else "Scrapo Yard Operations"
            yard_address = yard.address if yard and yard.address else "Marine Drive, Kochi"
            yard_state = yard.state if yard and yard.state else "Kerala"

            now = datetime.now(timezone.utc)
            profile = BusinessProfile(
                id=str(uuid.uuid4()),
                yard_id=yard_id,
                legal_name=f"{yard_name} Pvt Ltd",
                trade_name=yard_name,
                address=yard_address,
                state=yard_state,
                pincode="682031",
                phone="+91 98470 00001",
                email="billing@scrapo.in",
                gstin="32AAACS1234F1Z5",
                pan="AAACS1234F",
                bank_name="State Bank of India",
                account_number="389920194829",
                ifsc="SBIN0001234",
                upi_id="scrapo@sbi",
                logo_url="/assets/logo.png",
                is_gst_registered=True,
                default_tax_rate=Decimal("18.00"),
                created_at=now,
                updated_at=now,
            )
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
        return profile

    def update(self, yard_id: str, update_data: BusinessProfileUpdate) -> BusinessProfile:
        profile = self.get_by_yard(yard_id)
        for key, value in update_data.model_dump(exclude_unset=True).items():
            if hasattr(profile, key) and value is not None:
                if key == "default_tax_rate":
                    value = Decimal(str(value))
                setattr(profile, key, value)
        profile.updated_at = datetime.now(timezone.utc)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class MaterialAliasBase(BaseModel):
    display_name_english: str = Field(..., max_length=100)
    display_name_malayalam: str = Field(default="", max_length=100)
    local_subtitle: str = Field(default="", max_length=150)
    district: str = Field(default="Ernakulam", max_length=60)
    is_primary: bool = True
    default_tare: Decimal = Field(default=Decimal("0.000"))
    badge: Optional[str] = None
    badge_type: Optional[str] = None


class MaterialAliasUpdate(BaseModel):
    display_name_english: Optional[str] = None
    display_name_malayalam: Optional[str] = None
    local_subtitle: Optional[str] = None
    default_tare: Optional[Decimal] = None
    badge: Optional[str] = None
    badge_type: Optional[str] = None
    version: Optional[int] = None


class MaterialAliasResponse(MaterialAliasBase):
    id: str
    material_id: str
    yard_id: str
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialRateBase(BaseModel):
    purchase_rate: Decimal = Field(..., gt=0)
    selling_rate: Decimal = Field(..., gt=0)


class MaterialRateUpdate(BaseModel):
    purchase_rate: Decimal = Field(..., gt=0)
    selling_rate: Optional[Decimal] = None
    effective_from: Optional[datetime] = None
    version: Optional[int] = None  # for optimistic concurrency detection


class MaterialRateResponse(MaterialRateBase):
    id: str
    material_id: str
    yard_id: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    version: int
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialBase(BaseModel):
    master_category: str
    standard_name: str
    standard_code: str = ""
    unit: str = "KG"
    expected_selling_rate: Decimal = Decimal("0.00")
    icon: str = "recycling"
    accent_color: str = "primary"
    active: bool = True


class MaterialCreate(MaterialBase):
    id: Optional[str] = None
    yard_id: str
    primary_alias: Optional[MaterialAliasBase] = None
    initial_rate: Optional[MaterialRateBase] = None


class MaterialResponse(MaterialBase):
    id: str
    yard_id: str
    version: int
    created_at: datetime
    updated_at: datetime
    aliases: List[MaterialAliasResponse] = []
    current_rate: Optional[MaterialRateResponse] = None

    class Config:
        from_attributes = True

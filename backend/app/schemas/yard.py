from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class YardBase(BaseModel):
    name: str = Field(..., max_length=100)
    name_ml: str = Field(default="", max_length=100)
    code: str = Field(..., max_length=30)
    address: str = Field(default="", max_length=255)
    district: str = Field(default="Ernakulam", max_length=60)
    state: str = Field(default="Kerala", max_length=60)
    timezone: str = Field(default="Asia/Kolkata", max_length=50)
    scale_identifier: str = Field(default="CAS-CI-2001-YARD02", max_length=60)
    active: bool = True


class YardCreate(YardBase):
    id: Optional[str] = None


class YardResponse(YardBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

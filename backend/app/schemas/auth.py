from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    login: Optional[str] = None
    identifier: Optional[str] = None
    password: str = Field(..., min_length=4)
    yard_id: Optional[str] = None

    @model_validator(mode="after")
    def resolve_login(self):
        if not self.login and not self.identifier:
            raise ValueError("Either 'login' or 'identifier' is required")
        if not self.login and self.identifier:
            self.login = self.identifier
        return self


class UserProfile(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    role: str
    yard_ids: List[str] = []
    active: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserProfile


class RefreshTokenRequest(BaseModel):
    refresh_token: str

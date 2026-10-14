from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class ValidationError(AppError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid credentials or token expired", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="AUTH_ERROR",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class PermissionDeniedError(AppError):
    def __init__(self, message: str = "You do not have permission to perform this action", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="PERMISSION_DENIED",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="NOT_FOUND",
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ConflictError(AppError):
    def __init__(self, message: str, code: str = "CONFLICT", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code=code,
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class RateConflictError(ConflictError):
    def __init__(self, message: str = "Material rate has been updated by another user.", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="RATE_CONFLICT",
            message=message,
            details=details,
        )


class DuplicateRequestError(AppError):
    def __init__(self, message: str = "Duplicate operation detected", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="DUPLICATE_REQUEST",
            message=message,
            status_code=status.HTTP_200_OK,  # 200 with idempotent resolution
            details=details,
        )


class InsufficientInventoryError(AppError):
    def __init__(self, message: str = "Insufficient inventory available for this operation", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="INSUFFICIENT_INVENTORY",
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


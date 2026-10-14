from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from backend.app.api.v1.api import api_router
from backend.app.core.config import settings
from backend.app.core.errors import AppError
from backend.app.core.logging import logger, setup_logging
from backend.app.db.base import Base
from backend.app.db.session import engine

# Setup structured logging
setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    logger.info("Initializing Scrapo Cloud Backend Service...")
    # Ensure tables exist (safe for both PostgreSQL and SQLite development)
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized.")


# Global Custom AppError Handler
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    logger.warning(f"AppError [{exc.code}]: {exc.message} (Path: {request.url.path})")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


# Fallback Unhandled Exception Handler (Security: never expose raw stack traces)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred. Please try again later.",
            "details": {},
        },
    )


# Health Endpoint (Requirement 29)
@app.get("/health", tags=["Health"])
def health_check():
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB ping failed: {e}")
        db_status = "disconnected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
    }


# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

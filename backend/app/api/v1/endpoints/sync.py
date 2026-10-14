from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.auth.deps import get_current_user, verify_yard_access
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.schemas.sync import (
    SyncPullRequest,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncStatusResponse,
)
from backend.app.sync.pull_handler import PullSyncHandler
from backend.app.sync.push_handler import PushSyncHandler

router = APIRouter()


@router.post("/push", response_model=SyncPushResponse)
def sync_push(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(request.yard_id, current_user, db)

    handler = PushSyncHandler(db)
    return handler.process_push(request, user_id=current_user.id)


@router.post("/pull", response_model=SyncPullResponse)
def sync_pull(
    request: SyncPullRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(request.yard_id, current_user, db)

    handler = PullSyncHandler(db)
    return handler.process_pull(request)


@router.get("/status", response_model=SyncStatusResponse)
def sync_status(
    yard_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_yard_access(yard_id, current_user, db)

    from backend.app.models.sync import SyncOperation
    from sqlalchemy import func, select

    stmt = select(func.count(SyncOperation.id)).where(
        SyncOperation.yard_id == yard_id,
        SyncOperation.status == "PENDING",
    )
    pending_count = db.execute(stmt).scalar_one() or 0

    return SyncStatusResponse(
        yard_id=yard_id,
        server_time=datetime.now(timezone.utc),
        database_status="healthy",
        pending_sync_count=pending_count,
    )

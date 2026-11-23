from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_session
from app.models import User, UserSession
from app.schemas import (
    LoginIn,
    LoginOut,
    PasswordChangeIn,
    SessionOut,
    UserOut,
)
from app.security import (
    DUMMY_HASH,
    LoginRateLimiter,
    hash_password,
    new_session_token,
    password_needs_rehash,
    token_digest,
    utcnow,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
login_limiter = LoginRateLimiter(
    max_attempts=settings.login_max_attempts,
    window_seconds=settings.login_window_seconds,
)


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> LoginOut:
    username = body.username.strip().lower()
    client_host = request.client.host if request.client else "unknown"
    limiter_key = f"{client_host}:{username}"

    if login_limiter.is_limited(limiter_key):
        raise HTTPException(status_code=429, detail="too_many_attempts")

    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        # Spend time comparable to a real verification to reduce user probing.
        verify_password(DUMMY_HASH, body.password)
        login_limiter.record_failure(limiter_key)
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if not verify_password(user.password_hash, body.password):
        login_limiter.record_failure(limiter_key)
        raise HTTPException(status_code=401, detail="invalid_credentials")

    login_limiter.reset(limiter_key)

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    now = utcnow()
    token = new_session_token()
    session = UserSession(
        user_id=user.id,
        token_hash=token_digest(token),
        device_name=(body.device_name.strip() or "Unknown device")[:80],
        last_seen_at=now,
        expires_at=now + timedelta(days=settings.session_ttl_days),
    )
    db.add(session)
    db.commit()

    return LoginOut(
        token=token,
        expires_at=session.expires_at,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> None:
    session.revoked_at = utcnow()
    db.commit()


@router.get("/me", response_model=UserOut)
def me(session: UserSession = Depends(get_current_session)) -> UserOut:
    return UserOut.model_validate(session.user)


@router.post("/password", status_code=204)
def change_password(
    body: PasswordChangeIn,
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> None:
    user = session.user
    if not verify_password(user.password_hash, body.current_password):
        raise HTTPException(status_code=400, detail="current_password_incorrect")
    if verify_password(user.password_hash, body.new_password):
        raise HTTPException(status_code=400, detail="new_password_same_as_old")

    now = utcnow()
    user.password_hash = hash_password(body.new_password)
    user.password_changed_at = now
    db.execute(
        update(UserSession)
        .where(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    db.commit()


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> list[SessionOut]:
    rows = db.scalars(
        select(UserSession)
        .where(
            UserSession.user_id == session.user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > utcnow(),
        )
        .order_by(UserSession.created_at.desc())
    ).all()

    return [
        SessionOut(
            id=row.id,
            device_name=row.device_name or "Unknown device",
            created_at=row.created_at,
            last_seen_at=row.last_seen_at,
            expires_at=row.expires_at,
            current=row.id == session.id,
        )
        for row in rows
    ]


@router.delete("/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: UUID,
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> None:
    target = db.get(UserSession, session_id)
    if target is None or target.user_id != session.user_id:
        raise HTTPException(status_code=404, detail="session_not_found")

    target.revoked_at = utcnow()
    db.commit()

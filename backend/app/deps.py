from datetime import timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.db import get_db
from app.models import User, UserSession
from app.security import token_digest, utcnow

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="auth_required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> UserSession:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    session = db.scalar(
        select(UserSession)
        .options(joinedload(UserSession.user))
        .where(
            UserSession.token_hash == token_digest(credentials.credentials),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > utcnow(),
        )
    )
    if session is None:
        raise _unauthorized()

    now = utcnow()
    touch_after = now - timedelta(minutes=settings.session_touch_interval_minutes)
    if session.last_seen_at < touch_after:
        session.last_seen_at = now
        session.expires_at = now + timedelta(days=settings.session_ttl_days)
        db.commit()

    return session


def get_current_user(
    session: UserSession = Depends(get_current_session),
) -> User:
    return session.user

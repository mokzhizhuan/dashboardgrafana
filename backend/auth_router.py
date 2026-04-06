import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from passlib.context import CryptContext

import jwt
from jwt import InvalidTokenError, ExpiredSignatureError

from database import get_auth_db

router = APIRouter(prefix="/auth", tags=["auth"])

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "change-this-secret-in-env")
AUTH_ALGORITHM = "HS256"
AUTH_EXPIRE_HOURS = int(os.getenv("AUTH_EXPIRE_HOURS", "12"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    return parts[1].strip()


def _create_access_token(username: str, role: str, user_id: int) -> str:
    now = datetime.now(timezone.utc)
    expire_at = now + timedelta(hours=AUTH_EXPIRE_HOURS)

    payload = {
        "sub": username,
        "role": role,
        "user_id": user_id,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
    }

    return jwt.encode(payload, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)


def _decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            AUTH_SECRET_KEY,
            algorithms=[AUTH_ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_auth_db),
):
    token = _extract_bearer_token(authorization)
    payload = _decode_access_token(token)

    username = payload.get("sub")
    role = payload.get("role")
    user_id = payload.get("user_id")

    if not username or role not in {"admin", "viewer"} or not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    row = db.execute(
        text(
            """
            SELECT id, username, role, is_active
            FROM userinfo
            WHERE id = :user_id AND username = :username
            """
        ),
        {"user_id": user_id, "username": username},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="User no longer exists")

    if not row.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    return {
        "user_id": row.id,
        "username": row.username,
        "role": row.role,
    }


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_auth_db)):
    row = db.execute(
        text(
            """
            SELECT id, username, password_hash, role, is_active
            FROM userinfo
            WHERE username = :username
            """
        ),
        {"username": payload.username},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not row.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    if not verify_password(payload.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = _create_access_token(
        username=row.username,
        role=row.role,
        user_id=row.id,
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=row.role,
        username=row.username,
    )


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {"ok": True}
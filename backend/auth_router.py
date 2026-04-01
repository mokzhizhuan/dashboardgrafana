import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

import jwt
from jwt import InvalidTokenError, ExpiredSignatureError

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

VIEWER_USERNAME = os.getenv("VIEWER_USERNAME", "user")
VIEWER_PASSWORD = os.getenv("VIEWER_PASSWORD", "user")

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "change-this-secret-in-env")
AUTH_ALGORITHM = "HS256"
AUTH_EXPIRE_HOURS = int(os.getenv("AUTH_EXPIRE_HOURS", "12"))


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


def _create_access_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    expire_at = now + timedelta(hours=AUTH_EXPIRE_HOURS)

    payload = {
        "sub": username,
        "role": role,
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


def get_current_user(authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer_token(authorization)
    payload = _decode_access_token(token)

    username = payload.get("sub")
    role = payload.get("role")

    if not username or role not in {"admin", "viewer"}:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return {
        "username": username,
        "role": role,
    }


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    if payload.username == ADMIN_USERNAME and payload.password == ADMIN_PASSWORD:
        role = "admin"
    elif payload.username == VIEWER_USERNAME and payload.password == VIEWER_PASSWORD:
        role = "viewer"
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = _create_access_token(payload.username, role)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=role,
        username=payload.username,
    )


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {"ok": True}
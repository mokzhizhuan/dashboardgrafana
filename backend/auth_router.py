# auth_router.py
import os
import secrets
from typing import Optional, Dict

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple demo credentials
# Change these in your .env or system environment later
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

VIEWER_USERNAME = os.getenv("VIEWER_USERNAME", "user")
VIEWER_PASSWORD = os.getenv("VIEWER_PASSWORD", "user123")

# In-memory token store for dev/demo
TOKENS: Dict[str, dict] = {}


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


def get_current_user(authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer_token(authorization)
    user = TOKENS.get(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user


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

    token = secrets.token_urlsafe(32)
    TOKENS[token] = {
        "username": payload.username,
        "role": role,
    }

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
def logout(current_user: dict = Depends(get_current_user), authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer_token(authorization)
    TOKENS.pop(token, None)
    return {"ok": True}
import os
from typing import Any, Dict, List, Optional, Set

import jwt
from jwt import InvalidTokenError, PyJWKClient
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

# -------------------------------------------------------------------
# Keycloak configuration
# -------------------------------------------------------------------
# PUBLIC URL must match the token's `iss` claim exactly.
# INTERNAL URL is what the FastAPI container uses to fetch JWKS.
KEYCLOAK_PUBLIC_URL = os.getenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080").rstrip("/")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://keycloak:8080").rstrip("/")

KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "dashboard-auth")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "engineering-dashboard")
KEYCLOAK_VERIFY_AUDIENCE = os.getenv("KEYCLOAK_VERIFY_AUDIENCE", "false").lower() == "true"

KEYCLOAK_ISSUER = f"{KEYCLOAK_PUBLIC_URL}/realms/{KEYCLOAK_REALM}"
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

jwks_client = PyJWKClient(KEYCLOAK_JWKS_URL)


# -------------------------------------------------------------------
# Response models
# -------------------------------------------------------------------
class MeResponse(BaseModel):
    username: str
    user_id: Optional[str] = None
    roles: List[str]
    realm_roles: List[str]
    client_roles: List[str]
    is_admin: bool
    is_viewer: bool

def _decode_keycloak_token(token: str) -> Dict[str, Any]:
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        decode_kwargs: Dict[str, Any] = {
            "key": signing_key,
            "algorithms": ["RS256"],
            "issuer": KEYCLOAK_ISSUER,
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": KEYCLOAK_VERIFY_AUDIENCE,
            },
        }

        if KEYCLOAK_VERIFY_AUDIENCE:
            decode_kwargs["audience"] = KEYCLOAK_CLIENT_ID

        payload = jwt.decode(token, **decode_kwargs)
        return payload

    except InvalidTokenError as exc:
        print("FASTAPI TOKEN ERROR:", str(exc), flush=True)
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        print("FASTAPI TOKEN VALIDATION FAILED:", str(exc), flush=True)
        raise HTTPException(status_code=401, detail=f"Token validation failed: {exc}")

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    return token


def _decode_keycloak_token(token: str) -> Dict[str, Any]:
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        decode_kwargs: Dict[str, Any] = {
            "key": signing_key,
            "algorithms": ["RS256"],
            "issuer": KEYCLOAK_ISSUER,
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": KEYCLOAK_VERIFY_AUDIENCE,
            },
        }

        if KEYCLOAK_VERIFY_AUDIENCE:
            decode_kwargs["audience"] = KEYCLOAK_CLIENT_ID

        payload = jwt.decode(token, **decode_kwargs)
        return payload

    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {exc}")


def _extract_roles(payload: Dict[str, Any]) -> Dict[str, List[str]]:
    realm_roles = payload.get("realm_access", {}).get("roles", []) or []

    resource_access = payload.get("resource_access", {}) or {}
    client_roles = resource_access.get(KEYCLOAK_CLIENT_ID, {}).get("roles", []) or []

    # Optional fallback: merge all client roles from all clients if needed
    all_client_roles: Set[str] = set(client_roles)
    for _, access_info in resource_access.items():
        if isinstance(access_info, dict):
            for role in access_info.get("roles", []) or []:
                if isinstance(role, str):
                    all_client_roles.add(role)

    merged_roles = sorted(set(realm_roles) | all_client_roles)

    return {
        "realm_roles": sorted(set(str(r) for r in realm_roles if isinstance(r, str))),
        "client_roles": sorted(set(str(r) for r in client_roles if isinstance(r, str))),
        "roles": merged_roles,
    }


def _resolve_username(payload: Dict[str, Any]) -> str:
    username = (
        payload.get("preferred_username")
        or payload.get("username")
        or payload.get("email")
        or payload.get("sub")
    )
    if not username:
        raise HTTPException(status_code=401, detail="Token missing username/sub")
    return str(username)


def _build_user_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    roles_info = _extract_roles(payload)
    username = _resolve_username(payload)
    user_id = payload.get("sub")

    roles = roles_info["roles"]
    is_admin = "admin" in roles
    is_viewer = is_admin or "viewer" in roles

    return {
        "user_id": str(user_id) if user_id is not None else None,
        "username": username,
        "roles": roles,
        "realm_roles": roles_info["realm_roles"],
        "client_roles": roles_info["client_roles"],
        "role": "admin" if is_admin else ("viewer" if is_viewer else "unknown"),
        "is_admin": is_admin,
        "is_viewer": is_viewer,
        "token_payload": payload,
    }


# -------------------------------------------------------------------
# Dependencies
# -------------------------------------------------------------------
def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    token = _extract_bearer_token(authorization)
    payload = _decode_keycloak_token(token)
    user = _build_user_from_payload(payload)

    if not user["username"]:
        raise HTTPException(status_code=401, detail="Unable to resolve user identity")

    return user


def require_viewer(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not current_user["is_viewer"]:
        raise HTTPException(status_code=403, detail="Viewer or admin access required")
    return current_user


def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not current_user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------
@router.get("/me", response_model=MeResponse)
def me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return MeResponse(
        username=current_user["username"],
        user_id=current_user["user_id"],
        roles=current_user["roles"],
        realm_roles=current_user["realm_roles"],
        client_roles=current_user["client_roles"],
        is_admin=current_user["is_admin"],
        is_viewer=current_user["is_viewer"],
    )


@router.post("/logout")
def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    # Stateless bearer token validation on the backend.
    # Frontend should perform Keycloak logout via the Keycloak client/session.
    return {"ok": True, "message": "Logout should be handled by Keycloak on the frontend/client side."}


@router.post("/login")
def login_not_supported():
    # Keep this route only so old frontend calls fail clearly instead of silently.
    raise HTTPException(
        status_code=501,
        detail="Local login is disabled. Authenticate with Keycloak and send the Keycloak bearer token.",
    )
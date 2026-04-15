import csv
import json
import logging
import os
from functools import wraps
from typing import Any, Dict, List

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

from django.db import connections
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Keycloak configuration
# -------------------------------------------------------------------
# PUBLIC issuer must match the token's `iss` exactly.
# INTERNAL server URL is what Django container uses to reach Keycloak/JWKS.
KEYCLOAK_PUBLIC_URL = os.getenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080").rstrip("/")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://keycloak:8080").rstrip("/")

KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "dashboard-auth")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "engineering-dashboard")
KEYCLOAK_VERIFY_AUDIENCE = os.getenv("KEYCLOAK_VERIFY_AUDIENCE", "false").lower() == "true"

KEYCLOAK_ISSUER = f"{KEYCLOAK_PUBLIC_URL}/realms/{KEYCLOAK_REALM}"
KEYCLOAK_JWKS_URL = f"{KEYCLOAK_INTERNAL_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

jwks_client = PyJWKClient(KEYCLOAK_JWKS_URL)



# -------------------------------------------------------------------
# Auth helpers
# -------------------------------------------------------------------
def _extract_bearer_token(request) -> str:
    auth_header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION")
    if not auth_header:
        raise PermissionError("Missing Authorization header")

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise PermissionError("Invalid Authorization header")

    token = parts[1].strip()
    if not token:
        raise PermissionError("Missing bearer token")

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
        raise PermissionError(f"Invalid token: {exc}")
    except Exception as exc:
        raise PermissionError(f"Token validation failed: {exc}")


def _extract_roles(payload: Dict[str, Any]) -> Dict[str, List[str]]:
    realm_roles = payload.get("realm_access", {}).get("roles", []) or []

    resource_access = payload.get("resource_access", {}) or {}
    client_roles = resource_access.get(KEYCLOAK_CLIENT_ID, {}).get("roles", []) or []

    merged_roles = sorted(set(realm_roles) | set(client_roles))

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
        raise PermissionError("Token missing username/sub")
    return str(username)


def _build_current_user(request) -> Dict[str, Any]:
    token = _extract_bearer_token(request)
    payload = _decode_keycloak_token(token)
    roles_info = _extract_roles(payload)

    roles = roles_info["roles"]
    is_admin = "admin" in roles
    is_viewer = is_admin or "viewer" in roles

    user = {
        "user_id": str(payload.get("sub")) if payload.get("sub") is not None else None,
        "username": _resolve_username(payload),
        "roles": roles,
        "realm_roles": roles_info["realm_roles"],
        "client_roles": roles_info["client_roles"],
        "is_admin": is_admin,
        "is_viewer": is_viewer,
        "token_payload": payload,
    }
    return user


def require_viewer(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        try:
            current_user = _build_current_user(request)
        except PermissionError as exc:
            print("VIEWER AUTH FAILED:", str(exc))
            print("AUTH HEADER:", request.headers.get("Authorization"))
            return JsonResponse({"detail": str(exc)}, status=401)

        if not current_user["is_viewer"]:
            return JsonResponse({"detail": "Viewer or admin access required"}, status=403)

        request.current_user = current_user
        return view_func(request, *args, **kwargs)

    return wrapper


def require_admin(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        try:
            current_user = _build_current_user(request)
        except PermissionError as exc:
            print("ADMIN AUTH FAILED:", str(exc))
            print("AUTH HEADER:", request.headers.get("Authorization"))
            return JsonResponse({"detail": str(exc)}, status=401)

        if not current_user["is_admin"]:
            return JsonResponse({"detail": "Admin access required"}, status=403)

        request.current_user = current_user
        return view_func(request, *args, **kwargs)

    return wrapper


# -------------------------------------------------------------------
# Open endpoints
# -------------------------------------------------------------------
def health(request):
    return JsonResponse({"status": "ok"})


@require_viewer
def me_view(request):
    current_user = request.current_user
    return JsonResponse({
        "username": current_user["username"],
        "user_id": current_user["user_id"],
        "roles": current_user["roles"],
        "realm_roles": current_user["realm_roles"],
        "client_roles": current_user["client_roles"],
        "is_admin": current_user["is_admin"],
        "is_viewer": current_user["is_viewer"],
    })


# -------------------------------------------------------------------
# Viewer/admin read endpoints
# -------------------------------------------------------------------
@require_viewer
def main_dashboard_options(request):

    with connections["engineering"].cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT device_name
            FROM telemetry
            WHERE device_name IS NOT NULL
              AND TRIM(device_name) <> ''
            ORDER BY device_name
            """
        )
        telemetry_rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT sensor_name
            FROM (
                SELECT DISTINCT sensor_name
                FROM sensor_raw
                WHERE sensor_name IS NOT NULL
                  AND TRIM(sensor_name) <> ''
            ) AS distinct_sensors
            ORDER BY
                regexp_replace(sensor_name, '\d+$', '') ASC,
                COALESCE(NULLIF(substring(sensor_name FROM '(\d+)$'), ''), '0')::INTEGER ASC,
                sensor_name ASC
            """
        )
        sensor_rows = cursor.fetchall()

    data = {
        "telemetry_devices": [row[0] for row in telemetry_rows],
        "sensors": [row[0] for row in sensor_rows],
    }
    return JsonResponse(data)


@require_viewer
def get_telemetry(request):
    device = request.GET.get("device")
    limit_raw = request.GET.get("limit", "100")

    try:
        limit = int(limit_raw)
    except ValueError:
        return JsonResponse({"error": "limit must be an integer"}, status=400)

    if limit < 1 or limit > 5000:
        return JsonResponse({"error": "limit must be between 1 and 5000"}, status=400)


    with connections["engineering"].cursor() as cursor:
        if device:
            cursor.execute(
                """
                SELECT time, device_name, temperature, humidity
                FROM telemetry
                WHERE device_name = %s
                ORDER BY time DESC
                LIMIT %s
                """,
                [device, limit],
            )
        else:
            cursor.execute(
                """
                SELECT time, device_name, temperature, humidity
                FROM telemetry
                ORDER BY time DESC
                LIMIT %s
                """,
                [limit],
            )

        rows = cursor.fetchall()


    data = [
        {
            "time": row[0].isoformat(timespec="seconds") if row[0] else None,
            "device_name": row[1],
            "temperature": float(row[2]) if row[2] is not None else None,
            "humidity": float(row[3]) if row[3] is not None else None,
        }
        for row in rows
    ]

    return JsonResponse(data, safe=False)


@require_viewer
def export_dashboard_csv(request):
    device = request.GET.get("device")

    with connections["engineering"].cursor() as cursor:
        if device:
            cursor.execute(
                """
                SELECT time, device_name, temperature, humidity
                FROM telemetry
                WHERE device_name = %s
                ORDER BY time ASC
                """,
                [device],
            )
        else:
            cursor.execute(
                """
                SELECT time, device_name, temperature, humidity
                FROM telemetry
                ORDER BY time ASC
                """
            )

        rows = cursor.fetchall()

    response = HttpResponse(content_type="text/csv")
    filename = f"{device or 'all_devices'}_dashboard_export.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(["time", "device_name", "temperature", "humidity"])

    for row in rows:
        writer.writerow([
            row[0].isoformat(timespec="seconds") if row[0] else "",
            row[1],
            float(row[2]) if row[2] is not None else "",
            float(row[3]) if row[3] is not None else "",
        ])

    return response


# -------------------------------------------------------------------
# Admin-only write endpoint
# -------------------------------------------------------------------
@csrf_exempt
@require_admin
def add_telemetry(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        data = json.loads(request.body)

        device_name = str(data.get("device_name", "")).strip()
        temperature = data.get("temperature")
        humidity = data.get("humidity")

        if not device_name:
            return JsonResponse({"error": "device_name is required"}, status=400)

        if temperature is None:
            return JsonResponse({"error": "temperature is required"}, status=400)

        if humidity is None:
            return JsonResponse({"error": "humidity is required"}, status=400)

        try:
            temperature = float(temperature)
            humidity = float(humidity)
        except (TypeError, ValueError):
            return JsonResponse(
                {"error": "temperature and humidity must be numbers"},
                status=400,
            )

        with connections["engineering"].cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO telemetry (device_name, temperature, humidity)
                VALUES (%s, %s, %s)
                RETURNING time, device_name, temperature, humidity
                """,
                [device_name, temperature, humidity],
            )
            row = cursor.fetchone()

        return JsonResponse({
            "time": row[0].isoformat(timespec="seconds") if row[0] else None,
            "device_name": row[1],
            "temperature": float(row[2]) if row[2] is not None else None,
            "humidity": float(row[3]) if row[3] is not None else None,
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    except Exception as exc:
        logger.exception("add_telemetry failed")
        return JsonResponse({"error": str(exc)}, status=500)
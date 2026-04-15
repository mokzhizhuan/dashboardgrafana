import type { SimulatorStatus } from "./AdminTypes";
import keycloak from "../../keycloak";

const rawBase =
  import.meta.env.VITE_FASTAPI_API_BASE_URL ||
  import.meta.env.VITE_ADMIN_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

export const ADMIN_API_BASE = rawBase.replace(/\/+$/, "");

function buildUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_API_BASE}${normalizedPath}`;
}

async function getAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  await keycloak.updateToken(30);

  if (!keycloak.token) {
    throw new Error("Missing Keycloak token");
  }

  const headers = new Headers(extra || {});
  headers.set("Authorization", `Bearer ${keycloak.token}`);
  return headers;
}

function handleUnauthorized() {
  keycloak.logout({
    redirectUri: window.location.origin,
  });
}

async function ensureOk(res: Response) {
  if (res.status === 401 || res.status === 403) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res;
}

export async function fetchAdminWithAuth(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = await getAuthHeaders(init?.headers);

  const res = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  return ensureOk(res);
}

export async function fetchAdminJson<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(buildUrl(path), {
    ...init,
    headers,
  });

  await ensureOk(res);
  return res.json();
}

export function normalizeStatus(raw: any): SimulatorStatus {
  return {
    running: raw?.running ?? raw?.is_running ?? false,
    paused: raw?.paused ?? false,
    pausedAt: raw?.pausedAt ?? raw?.paused_at ?? null,
    csvFile: raw?.csvFile ?? raw?.csv_file ?? null,
    interval: raw?.interval ?? raw?.interval_seconds ?? 5,
    loop: raw?.loop ?? true,

    rowsInserted: raw?.rowsInserted ?? raw?.rows_inserted ?? 0,
    rowsSkipped: raw?.rowsSkipped ?? raw?.rows_skipped ?? 0,
    faultRowsApplied: raw?.faultRowsApplied ?? raw?.fault_rows_applied ?? 0,
    offlineEvents: raw?.offlineEvents ?? raw?.offline_events ?? 0,

    currentIndex: raw?.currentIndex ?? raw?.current_index ?? 0,
    totalRows: raw?.totalRows ?? raw?.total_rows ?? 0,

    startedAt: raw?.startedAt ?? raw?.started_at ?? null,
    stoppedAt: raw?.stoppedAt ?? raw?.stopped_at ?? null,
    lastInsertTime: raw?.lastInsertTime ?? raw?.last_insert_time ?? null,
    lastInsertedRow: raw?.lastInsertedRow ?? raw?.last_inserted_row ?? null,

    lastDevice: raw?.lastDevice ?? raw?.last_device ?? null,
    error: raw?.error ?? null,

    legacyHighTempMode:
      raw?.legacyHighTempMode ?? raw?.legacy_high_temp_mode ?? false,

    faultMode: raw?.faultMode ?? raw?.fault_mode ?? null,
    source: raw?.source ?? "csv",

    deviceLastSeen: raw?.deviceLastSeen ?? raw?.device_last_seen ?? {},
    deviceStatus: raw?.deviceStatus ?? raw?.device_status ?? {},
    deviceCount: raw?.deviceCount ?? raw?.device_count ?? 0,
  };
}

export async function readSimulatorStatus(): Promise<SimulatorStatus> {
  const data = await fetchAdminJson("/simulator/status");
  return normalizeStatus(data);
}

export async function readSimulatorDevices(): Promise<string[]> {
  const data = await fetchAdminJson("/simulator/devices");

  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any)?.devices)) return (data as any).devices;

  return [];
}

export async function postAdminAction<T = any>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return fetchAdminJson(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getTelemetryRowCount(): Promise<number> {
  const data = await fetchAdminJson("/simulator/admin/data/telemetry/count");
  return Number((data as any)?.count ?? 0);
}

export async function truncateTelemetry(): Promise<{ deletedCount?: number; message?: string }> {
  return fetchAdminJson("/simulator/admin/data/telemetry/truncate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function deleteTelemetryRows(
  ids: number[],
): Promise<{ deletedCount?: number; message?: string }> {
  return fetchAdminJson("/simulator/admin/data/telemetry/rows", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });
}
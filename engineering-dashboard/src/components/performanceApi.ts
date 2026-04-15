export type RuntimeModuleRow = {
  module: string;
  status?: string;
  loading: boolean;
  running: boolean;
  lastUpdated?: string | null;
  notes?: string;
  rowCount?: number;
  source?: string;
};

export type PerformanceSnapshot = {
  telemetryRows: number;
  rawRows: number;
  fftRows: number;
  autoRefresh: boolean;
  lastRefresh: string | null;
  latestStatus: string;
  apiStatus: "healthy" | "warning" | "error";
  uiStatus: "ready" | "loading" | "refreshing" | "error" | "warning";
  runtime: RuntimeModuleRow[];

  dataFreshness?: "fresh" | "aging" | "stale";
  dataAgeSeconds?: number | null;
  latestDataTimestamp?: string | null;
  apiResponseMs?: number | null;
  dbQueryMs?: number | null;
  cacheHit?: boolean;
};

type FetchPerformanceSnapshotOptions = {
  signal?: AbortSignal;
};

const API_BASE =
  (import.meta.env.VITE_FASTAPI_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed || null;
}

function looksLikeMissingTableMessage(value: string): boolean {
  const text = value.toLowerCase();
  return (
    text.includes("undefinedtable") ||
    text.includes('relation "') ||
    text.includes("does not exist") ||
    text.includes("sql:")
  );
}

function looksLikeBackendErrorMessage(value: string): boolean {
  const text = value.toLowerCase();
  return (
    text.includes("operationalerror") ||
    text.includes("connection refused") ||
    text.includes("failed to fetch") ||
    text.includes("backend unavailable")
  );
}

function normalizeStatusText(value: unknown, fallback = "Unknown"): string {
  const text = normalizeText(value, fallback);

  if (looksLikeMissingTableMessage(text)) {
    return "Data unavailable";
  }

  if (looksLikeBackendErrorMessage(text)) {
    return "Backend unavailable";
  }

  return text;
}

function normalizeApiStatus(value: unknown, latestStatus?: string): PerformanceSnapshot["apiStatus"] {
  if (value === "warning" || value === "error" || value === "healthy") {
    return value;
  }

  if (latestStatus) {
    if (looksLikeBackendErrorMessage(latestStatus)) return "error";
    if (looksLikeMissingTableMessage(latestStatus)) return "warning";
  }

  return "healthy";
}

function normalizeUiStatus(value: unknown, latestStatus?: string): PerformanceSnapshot["uiStatus"] {
  if (
    value === "loading" ||
    value === "refreshing" ||
    value === "error" ||
    value === "warning" ||
    value === "ready"
  ) {
    return value;
  }

  if (latestStatus) {
    if (looksLikeBackendErrorMessage(latestStatus)) return "error";
    if (looksLikeMissingTableMessage(latestStatus)) return "warning";
  }

  return "ready";
}

function normalizeRuntimeRow(row: Partial<RuntimeModuleRow> | null | undefined): RuntimeModuleRow {
  return {
    module: normalizeText(row?.module, "Unknown"),
    status: normalizeText(row?.status, "unknown"),
    loading: Boolean(row?.loading),
    running: Boolean(row?.running),
    lastUpdated: normalizeNullableString(row?.lastUpdated),
    notes: normalizeText(row?.notes, ""),
    rowCount: normalizeNumber(row?.rowCount, 0),
    source: normalizeText(row?.source, ""),
  };
}

function normalizeSnapshot(payload: Partial<PerformanceSnapshot> | null | undefined): PerformanceSnapshot {
  const latestStatus = normalizeStatusText(payload?.latestStatus, "Unknown");

  return {
    telemetryRows: normalizeNumber(payload?.telemetryRows, 0),
    rawRows: normalizeNumber(payload?.rawRows, 0),
    fftRows: normalizeNumber(payload?.fftRows, 0),
    autoRefresh: Boolean(payload?.autoRefresh),
    lastRefresh: normalizeNullableString(payload?.lastRefresh),
    latestStatus,
    apiStatus: normalizeApiStatus(payload?.apiStatus, latestStatus),
    uiStatus: normalizeUiStatus(payload?.uiStatus, latestStatus),
    runtime: Array.isArray(payload?.runtime) ? payload!.runtime.map(normalizeRuntimeRow) : [],

    dataFreshness:
      payload?.dataFreshness === "fresh" ||
      payload?.dataFreshness === "aging" ||
      payload?.dataFreshness === "stale"
        ? payload.dataFreshness
        : undefined,

    dataAgeSeconds: normalizeNullableNumber(payload?.dataAgeSeconds),
    latestDataTimestamp: normalizeNullableString(payload?.latestDataTimestamp),
    apiResponseMs: normalizeNullableNumber(payload?.apiResponseMs),
    dbQueryMs: normalizeNullableNumber(payload?.dbQueryMs),
    cacheHit: Boolean(payload?.cacheHit),
  };
}

async function readErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload && typeof payload === "object") {
        const detail =
          "detail" in payload
            ? payload.detail
            : "message" in payload
              ? payload.message
              : null;

        if (typeof detail === "string" && detail.trim()) {
          return detail.trim();
        }
      }
    }

    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // ignore parse failures and fall through
  }

  return `Request failed with status ${response.status}`;
}

export async function fetchPerformanceSnapshot(
  options: FetchPerformanceSnapshotOptions = {},
): Promise<PerformanceSnapshot> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/performance/snapshot`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("Unable to reach the performance snapshot endpoint.");
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Failed to fetch performance snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as Partial<PerformanceSnapshot>;
  return normalizeSnapshot(payload);
}
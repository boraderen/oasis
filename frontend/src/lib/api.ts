import { useUiStore } from "@/store/ui-store";
import { clearAuthToken, getAuthToken } from "@/lib/auth-token";
import { getApiUrl } from "@/lib/env";
const persistTimers = new Map<string, number>();
const pendingStates = new Map<string, unknown>();

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function readPayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = getApiUrl();
  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  if (!isAbsolute && !apiUrl && process.env.NODE_ENV !== "development") {
    throw new Error("Frontend deployment is missing NEXT_PUBLIC_API_URL.");
  }

  const target = isAbsolute ? path : `${apiUrl}${path}`;
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = headers.has("Authorization") ? null : getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      credentials: "include",
      mode: "cors",
      ...init,
      headers,
    });
  } catch (error) {
    const message =
      process.env.NODE_ENV !== "development"
        ? "Backend memory exceeded, I recommend local Docker-usage"
        : "Could not reach the backend.";
    throw new Error(message, { cause: error });
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "object" && payload && "message" in payload
          ? String(payload.message)
          : `Request failed with status ${response.status}`;
    if (response.status === 401) {
      clearAuthToken();
      useUiStore.getState().resetAll();
    }
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("upload", file);
  return apiRequest<T>(path, { method: "POST", body: formData });
}

export async function persistPageState(pageKey: string, state: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  pendingStates.set(pageKey, state);
  const existingTimer = persistTimers.get(pageKey);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(async () => {
    try {
      await apiRequest("/api/page-states/" + pageKey, {
        method: "PUT",
        body: JSON.stringify({ state: pendingStates.get(pageKey) }),
      });
    } catch (error) {
      console.error("Failed to persist page state", error);
    } finally {
      persistTimers.delete(pageKey);
    }
  }, 450);

  persistTimers.set(pageKey, timer);
}

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

export const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/, "");

export function getApiUrl() {
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return process.env.NODE_ENV === "development" ? "http://localhost:8000" : "";
}

export function withBasePath(path: string) {
  if (!path.startsWith("/")) {
    return `${basePath}/${path}`;
  }
  return `${basePath}${path}`;
}

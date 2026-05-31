const AUTH_TOKEN_KEY = "oasis_access_token";

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  birthYear: number;
};

type AuthPayload = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = "rush_auth_token";
const USER_KEY = "rush_auth_user";

export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
export const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:3001/ws";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuth(payload: AuthPayload) {
  localStorage.setItem(TOKEN_KEY, payload.token);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getAuthToken();
}

export function buildWsUrl() {
  const token = getAuthToken();
  if (!token) return null;
  return `${WS_BASE}?token=${encodeURIComponent(token)}`;
}

export async function authFetch(path: string, init?: RequestInit) {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent("rush:unauthorized"));
  }
  return res;
}

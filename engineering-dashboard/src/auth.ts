// src/auth.ts
export type UserRole = "admin" | "viewer";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  role: UserRole;
  username: string;
};

const TOKEN_KEY = "app_token";
const ROLE_KEY = "app_role";
const USERNAME_KEY = "app_username";

export function saveAuth(data: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(ROLE_KEY, data.role);
  localStorage.setItem(USERNAME_KEY, data.username);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): UserRole | null {
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "admin" || role === "viewer") return role;
  return null;
}

export function getUsername() {
  return localStorage.getItem(USERNAME_KEY);
}

export function isAdmin() {
  return getRole() === "admin";
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
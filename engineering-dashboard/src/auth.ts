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

function storage() {
  return sessionStorage;
}

export function saveAuth(data: LoginResponse) {
  storage().setItem(TOKEN_KEY, data.access_token);
  storage().setItem(ROLE_KEY, data.role);
  storage().setItem(USERNAME_KEY, data.username);
}

export function clearAuth() {
  storage().removeItem(TOKEN_KEY);
  storage().removeItem(ROLE_KEY);
  storage().removeItem(USERNAME_KEY);
}

export function getToken(): string | null {
  return storage().getItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  const token = getToken();
  return !!token;
}

export function getRole(): UserRole | null {
  const role = storage().getItem(ROLE_KEY);
  return role === "admin" || role === "viewer" ? role : null;
}

export function getUsername(): string | null {
  return storage().getItem(USERNAME_KEY);
}

export function isAdmin(): boolean {
  return isLoggedIn() && getRole() === "admin";
}

export function getAuthUser() {
  return {
    token: getToken(),
    role: getRole(),
    username: getUsername(),
  };
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
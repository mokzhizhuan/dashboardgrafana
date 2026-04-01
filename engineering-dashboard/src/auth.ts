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

export function getToken() {
  return storage().getItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

export function getRole(): UserRole | null {
  const role = storage().getItem(ROLE_KEY);
  if (role === "admin" || role === "viewer") return role;
  return null;
}

export function getUsername() {
  return storage().getItem(USERNAME_KEY);
}

export function isAdmin() {
  const token = getToken();
  const role = getRole();

  if (!token || role !== "admin") {
    return false;
  }

  return true;
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
import keycloak from "./keycloak";

export function isLoggedIn() {
  return !!keycloak.authenticated;
}

export function getUsername() {
  return (
    keycloak.tokenParsed?.preferred_username ||
    keycloak.tokenParsed?.email ||
    ""
  );
}

export function getRoles(): string[] {
  const realmRoles = keycloak.tokenParsed?.realm_access?.roles ?? [];
  const clientRoles =
    keycloak.tokenParsed?.resource_access?.["engineering-dashboard"]?.roles ?? [];

  return Array.from(new Set([...realmRoles, ...clientRoles]));
}

export function isAdmin() {
  return getRoles().includes("admin");
}

export function isViewer() {
  const roles = getRoles();
  return roles.includes("viewer") || roles.includes("admin");
}

export async function logout() {
  await keycloak.logout();
}
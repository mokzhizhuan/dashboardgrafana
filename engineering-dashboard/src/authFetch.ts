import keycloak from "./keycloak";

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!keycloak.authenticated) {
    throw new Error("Not authenticated with Keycloak");
  }

  await keycloak.updateToken(30);

  if (!keycloak.token) {
    throw new Error("Missing Keycloak token");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${keycloak.token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
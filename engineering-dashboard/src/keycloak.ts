import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8080",
  realm: "dashboard-auth",
  clientId: "engineering-frontend",
});

export default keycloak;
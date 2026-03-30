import React, { useState } from "react";
import { saveAuth } from "./auth";

type Props = {
  onLoginSuccess: () => void;
};

export default function LoginPage({ onLoginSuccess }: Props) {
  const API = "http://localhost:8000";

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      saveAuth(data);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || "Unable to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <div className="panel-card">
        <h2 style={{ marginBottom: 8 }}>Admin / Viewer Login</h2>
        <p style={{ marginBottom: 20, opacity: 0.8 }}>
          Sign in to access the monitoring workspace.
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Username</label>
            <input
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Password</label>
            <input
              type="password"
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          {error && <div style={{ color: "#d33", marginBottom: 12 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: 12 }}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
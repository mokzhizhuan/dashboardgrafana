import React, { useState } from "react";
import { saveAuth } from "./auth";

type Props = {
  onLoginSuccess: () => void;
  message?: string;
};

export default function LoginPage({ onLoginSuccess, message = "" }: Props) {
  const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
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
    <section className="login-form-wrap">
      <div className="panel-card login-panel-card">
        <div className="login-panel-header">
          <h2 className="login-panel-title">Admin / Viewer Login</h2>
          <p className="login-panel-subtitle">
            Sign in to access the monitoring workspace.
          </p>
        </div>

        {message ? <div className="login-message">{message}</div> : null}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button
            className="login-submit-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </section>
  );
}
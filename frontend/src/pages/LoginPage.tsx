import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // FastAPI OAuth2PasswordRequestForm expects x-www-form-urlencoded
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", username);
      body.set("password", password);

      const res = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data?.access_token as string;
      localStorage.setItem("access_token", token);

      nav("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Login failed. Please try again.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>SouthEastSociety</h1>
      <p style={{ color: "#666" }}>Internal Dashboard Login</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div style={{ color: "crimson", background: "#ffe8ea", padding: 10, borderRadius: 8 }}>
            {error}
          </div>
        )}

        <button disabled={loading} style={{ padding: 10, borderRadius: 8 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
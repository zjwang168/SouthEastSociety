import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type Me = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  can_edit_order_note: boolean;
  can_edit_order_amounts: boolean;
  created_at: string;
};

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", username);
      body.set("password", password);

      const res = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data?.access_token as string;
      localStorage.setItem("access_token", token);

      const meRes = await api.get<Me>("/auth/me");
      localStorage.setItem("user_role", meRes.data.role);

      nav("/dashboard");
    } catch (err: any) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "white",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <img
              src="/logo.png"
              alt="SouthEastSociety"
              style={{
                width: 54,
                height: 54,
                objectFit: "contain",
              }}
            />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: "#14253d",
            }}
          >
            SouthEastSociety
          </h1>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: "#667085",
              fontSize: 14,
            }}
          >
            Internal Dashboard Login
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }} autoComplete="off">
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelText}>Username</span>
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelText}>Password</span>
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              style={{
                color: "#b42318",
                background: "#fef3f2",
                border: "1px solid #fecdca",
                padding: 12,
                borderRadius: 12,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#344054",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #d0d5dd",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};
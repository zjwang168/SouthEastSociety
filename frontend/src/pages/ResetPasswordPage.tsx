import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetPasswordPage() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await api.post("/auth/reset-password", {
        username,
        new_password: newPassword,
      });

      setMsg(`Password reset successfully for ${res.data.username}.`);
      setUsername("");
      setNewPassword("");
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }

      const msg =
        e?.response?.data?.detail ??
        e?.message ??
        "Failed to reset password";

      setMsg(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Reset Staff Password</h2>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/dashboard">← Back to Dashboard</Link>
      </div>

      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. staff"
            style={input}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>New Temporary Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Set a temporary password"
            style={input}
          />
        </div>

        <button disabled={loading} style={btn}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>

      {msg && (
        <div style={msgBox}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 16, color: "#666", fontSize: 13 }}>
        Admin resets the password, then staff logs in with the temporary password and changes it from the dashboard.
      </div>
    </div>
  );
}

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#444",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 600,
};

const msgBox: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  background: "#eef6ff",
  color: "#0b3a74",
  borderRadius: 6,
};
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

export default function ChangePasswordPage() {
  const nav = useNavigate();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });

      setMsg("Password updated successfully.");

      setTimeout(() => {
        nav("/dashboard");
      }, 1500);

    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Failed to change password");
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 400, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
      <h2>Change Password</h2>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Old password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            style={input}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={input}
          />
        </div>

        <button disabled={loading} style={btn}>
          {loading ? "Saving..." : "Change Password"}
        </button>
      </form>

      {msg && (
        <div style={{ marginTop: 12, color: "#444" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link to="/dashboard">← Back</Link>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "white",
};
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

export default function ChangePasswordPage() {
  const nav = useNavigate();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setMsg("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMsg("New password and confirm password do not match.");
      return;
    }

    if (oldPassword === newPassword) {
      setMsg("New password must be different from the old password.");
      return;
    }

    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "60px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Change Password</h2>

      <form onSubmit={submit}>
        <div style={field}>
          <label style={label}>Current Password</label>
          <div style={passwordRow}>
            <input
              type={showOldPassword ? "text" : "password"}
              placeholder="Enter current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              style={passwordInput}
            />
            <button
              type="button"
              onClick={() => setShowOldPassword((v) => !v)}
              style={toggleBtn}
            >
              {showOldPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div style={field}>
          <label style={label}>New Password</label>
          <div style={passwordRow}>
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={passwordInput}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              style={toggleBtn}
            >
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div style={field}>
          <label style={label}>Confirm New Password</label>
          <div style={passwordRow}>
            <input
              type={showConfirmNewPassword ? "text" : "password"}
              placeholder="Enter new password again"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              style={passwordInput}
            />
            <button
              type="button"
              onClick={() => setShowConfirmNewPassword((v) => !v)}
              style={toggleBtn}
            >
              {showConfirmNewPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button disabled={loading} style={btn}>
          {loading ? "Saving..." : "Change Password"}
        </button>
      </form>

      {msg && (
        <div
          style={{
            marginTop: 12,
            color: msg.includes("successfully") ? "#166534" : "#b91c1c",
            background: msg.includes("successfully") ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${msg.includes("successfully") ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link to="/dashboard">← Back</Link>
      </div>
    </div>
  );
}

const field: React.CSSProperties = {
  marginBottom: 14,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  color: "#374151",
  fontWeight: 600,
};

const passwordRow: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 8,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const passwordInput: React.CSSProperties = {
  ...input,
  flex: 1,
};

const toggleBtn: React.CSSProperties = {
  minWidth: 72,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 600,
};

const btn: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};
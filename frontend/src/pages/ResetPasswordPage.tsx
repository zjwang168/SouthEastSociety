import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetPasswordPage() {
  const nav = useNavigate();

  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  async function submitCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!createUsername.trim()) {
      setMsg("Please enter a staff username.");
      return;
    }

    if (!createPassword.trim() || !createConfirmPassword.trim()) {
      setMsg("Please enter and confirm the temporary password.");
      return;
    }

    if (createPassword.length < 6) {
      setMsg("Temporary password must be at least 6 characters.");
      return;
    }

    if (createPassword !== createConfirmPassword) {
      setMsg("Create password and confirm password do not match.");
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/admin/create-staff", {
        username: createUsername.trim(),
        password: createPassword,
      });

      setMsg(res.data?.message ?? `Staff user '${createUsername}' created successfully.`);
      setCreateUsername("");
      setCreatePassword("");
      setCreateConfirmPassword("");
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
        "Failed to create staff account";

      setMsg(String(msg));
    } finally {
      setCreating(false);
    }
  }

  async function submitResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!resetUsername.trim()) {
      setMsg("Please enter the staff username.");
      return;
    }

    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setMsg("Please enter and confirm the new temporary password.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("Temporary password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMsg("New password and confirm password do not match.");
      return;
    }

    setResetting(true);
    try {
      const res = await api.post("/admin/reset-staff-password", {
        username: resetUsername.trim(),
        new_password: newPassword,
      });

      setMsg(res.data?.message ?? `Password reset successfully for ${resetUsername}.`);
      setResetUsername("");
      setNewPassword("");
      setConfirmNewPassword("");
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
      setResetting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Staff Management</h2>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/dashboard">← Back to Dashboard</Link>
      </div>

      {msg && <div style={msgBox}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginTop: 20 }}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Create Staff Account</h3>

          <form onSubmit={submitCreateStaff}>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Username</label>
              <input
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="e.g. staff"
                style={input}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>Temporary Password</label>
              <div style={passwordRow}>
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Set a temporary password"
                  style={passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((v) => !v)}
                  style={toggleBtn}
                >
                  {showCreatePassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>Confirm Temporary Password</label>
              <div style={passwordRow}>
                <input
                  type={showCreateConfirmPassword ? "text" : "password"}
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                  placeholder="Enter the password again"
                  style={passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmPassword((v) => !v)}
                  style={toggleBtn}
                >
                  {showCreateConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button disabled={creating} style={btn}>
              {creating ? "Creating..." : "Create Staff"}
            </button>
          </form>
        </div>

        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Reset Staff Password</h3>

          <form onSubmit={submitResetPassword}>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Username</label>
              <input
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="e.g. staff"
                style={input}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>New Temporary Password</label>
              <div style={passwordRow}>
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set a temporary password"
                  style={passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  style={toggleBtn}
                >
                  {showResetPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>Confirm New Temporary Password</label>
              <div style={passwordRow}>
                <input
                  type={showResetConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Enter the password again"
                  style={passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPassword((v) => !v)}
                  style={toggleBtn}
                >
                  {showResetConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button disabled={resetting} style={btn}>
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <div style={{ marginTop: 16, color: "#666", fontSize: 13 }}>
            Admin resets the password, then staff logs in with the temporary password and changes it from the dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 18,
  background: "#fff",
};

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

const passwordInput: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
};

const passwordRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "stretch",
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
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 600,
};

const msgBox: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  background: "#eef6ff",
  color: "#0b3a74",
  borderRadius: 8,
};
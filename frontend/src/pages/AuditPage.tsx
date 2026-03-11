import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatEasternTime } from "../utils/time";

type AuditRow = {
  id: number;
  actor_user_id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
};

type Me = {
  id: number;
  username: string;
  role: string;
};

export default function AuditPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMe() {
    const res = await api.get<Me>("/auth/me");
    setMe(res.data);
    if (res.data.role !== "admin") {
      nav("/dashboard");
    }
  }

  async function loadAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AuditRow[]>("/audit", {
        params: { limit: 200 },
      });
      setRows(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load audit logs";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  useEffect(() => {
    async function init() {
      try {
        await loadMe();
        await loadAudit();
      } catch (e: any) {
        if (e?.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_role");
          nav("/login");
          return;
        }
        const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load page";
        setError(String(msg));
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Audit Log</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 10, marginBottom: 18, display: "flex", gap: 12 }}>
        <Link to="/dashboard" style={linkStyle}>
          ← Back to Dashboard
        </Link>
        <button onClick={loadAudit} disabled={loading} style={secondaryBtn}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>Actor User ID</th>
              <th style={th}>Action</th>
              <th style={th}>Entity</th>
              <th style={th}>Before</th>
              <th style={th}>After</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: "#666" }}>
                  No audit logs yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee", verticalAlign: "top" }}>
                  <td style={td}>{formatEasternTime(r.created_at)}</td>
                  <td style={td}>{r.actor_user_id}</td>
                  <td style={td}>{r.action}</td>
                  <td style={td}>
                    {r.entity_type} #{r.entity_id}
                  </td>
                  <td style={{ ...td, maxWidth: 260, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {r.before_json ?? "-"}
                  </td>
                  <td style={{ ...td, maxWidth: 260, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {r.after_json ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  color: "#444",
};

const td: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
};

const linkStyle: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "white",
};

const errorBox: React.CSSProperties = {
  background: "#ffe8e8",
  color: "#b00020",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};
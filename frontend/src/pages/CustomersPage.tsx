import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { CustomerWithPhones } from "../types";
import { formatEasternTime } from "../utils/time";

export default function CustomersPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerWithPhones[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create customer
  const [newNickname, setNewNickname] = useState("");
  const [creating, setCreating] = useState(false);

  const canSearch = useMemo(() => q.trim().length > 0, [q]);

  async function fetchCustomers(query?: string) {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};

      // 兼容现在页面的单输入搜索：
      // 纯数字/像手机号 → 走 phone
      // 其他 → 走 nickname
      if (query && query.trim()) {
        const trimmed = query.trim();
        const digitsOnly = /^\d+$/.test(trimmed);
        if (digitsOnly) {
          params.phone = trimmed;
        } else {
          params.nickname = trimmed;
        }
      }

      const res = await api.get<CustomerWithPhones[]>("/customers", { params });
      setRows(res.data);
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
        "Failed to load customers";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function onCreateCustomer() {
    if (!newNickname.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.post("/customers", { nickname: newNickname.trim() });
      setNewNickname("");
      await fetchCustomers(q);
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
        "Failed to create customer";
      setError(String(msg));
    } finally {
      setCreating(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Link to="/dashboard" style={backLink}>
          ← Back to Dashboard
        </Link>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={logoutBtn}>
          Logout
        </button>
      </div>

      <h1 style={{ marginBottom: 6 }}>Customers</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Search customers by nickname or phone number.
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#444" }}>Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Jane or 240..."
            style={{ width: 280, padding: "10px 12px" }}
          />
        </div>

        <button
          onClick={() => fetchCustomers(q)}
          disabled={loading || !canSearch}
          style={{ padding: "10px 14px" }}
        >
          {loading ? "Searching..." : "Search"}
        </button>

        <button
          onClick={() => {
            setQ("");
            fetchCustomers();
          }}
          disabled={loading}
          style={{ padding: "10px 14px" }}
        >
          Clear
        </button>

        <div style={{ flex: 1 }} />

        {/* Create */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#444" }}>
              New customer nickname
            </label>
            <input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="e.g. Jane"
              style={{ width: 220, padding: "10px 12px" }}
            />
          </div>
          <button
            onClick={onCreateCustomer}
            disabled={creating || !newNickname.trim()}
            style={{ padding: "10px 14px" }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#ffe8e8",
            color: "#b00020",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Nickname</th>
              <th style={th}>Status</th>
              <th style={th}>Phones</th>
              <th style={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td style={{ padding: 16, color: "#666" }} colSpan={5}>
                  No customers found.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: "1px solid #eee",
                    cursor: "pointer",
                  }}
                  onClick={() => nav(`/customers/${c.id}`)}
                >
                  <td style={td}>{c.id}</td>
                  <td style={td}>{c.nickname ?? "-"}</td>
                  <td style={td}>{c.status}</td>
                  <td style={td}>{c.phones?.length ?? 0}</td>
                  <td style={td}>{formatEasternTime(c.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
        Tip: click a row to view details.
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

const backLink: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
  fontWeight: 500,
};

const logoutBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
};
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_BASE_URL } from "../api";

export default function ExportPage() {
  const nav = useNavigate();

  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  function buildStartIso(dateStr: string) {
    return `${dateStr}T00:00:00`;
  }

  function buildEndIso(dateStr: string) {
    return `${dateStr}T23:59:59`;
  }

  async function downloadCsv() {
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select both start date and end date.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");

      const res = await api.get("/orders/export", {
        params: {
          start: buildStartIso(startDate),
          end: buildEndIso(endDate),
        },
        responseType: "blob",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
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
        "Failed to export CSV.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  function setToday() {
    setStartDate(today);
    setEndDate(today);
  }

  function setThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const firstDay = `${year}-${month}-01`;

    const lastDayDate = new Date(year, now.getMonth() + 1, 0);
    const lastDay = lastDayDate.toISOString().slice(0, 10);

    setStartDate(firstDay);
    setEndDate(lastDay);
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Export CSV</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 10, marginBottom: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/dashboard" style={linkStyle}>
          ← Back to Dashboard
        </Link>

        <button onClick={setToday} style={secondaryBtn}>
          Today
        </button>

        <button onClick={setThisMonth} style={secondaryBtn}>
          This Month
        </button>
      </div>

      <div
        style={{
          background: "#f6f6f6",
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Export Orders by Date Range</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={input}
            />
          </div>
        </div>

        <button
          onClick={downloadCsv}
          disabled={loading}
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#111827",
            color: "white",
            border: "1px solid #111827",
          }}
        >
          {loading ? "Exporting..." : "Download CSV"}
        </button>
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

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>How this works</div>

        <div>
          • The system exports orders based on <code>created_at</code>, which is recorded automatically by the backend.
        </div>
        <div>
          • Order time is not manually editable, so daily/monthly CSV stays consistent for accounting and tax use.
        </div>
        <div>
          • API used: <code>/orders/export?start=...&end=...</code>
        </div>
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
  border: "1px solid #e5e7eb",
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
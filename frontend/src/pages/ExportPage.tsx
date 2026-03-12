import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

type PreviewRow = {
  created_at: string;
  order_id: number;
  customer_id: number;
  phone_number_used: string;
  amount: number;
  paid_amount: number;
  points_earned: number;
  operator_user_id: number;
  note: string | null;
};

export default function ExportPage() {
  const nav = useNavigate();

  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);

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

  function validateDates() {
    if (!startDate || !endDate) {
      setError("Please select both start date and end date.");
      return false;
    }

    if (startDate > endDate) {
      setError("Start date cannot be later than end date.");
      return false;
    }

    return true;
  }

  async function downloadCsv() {
    setError(null);

    if (!validateDates()) return;

    setLoading(true);

    try {
      const res = await api.get("/orders/export", {
        params: {
          start: buildStartIso(startDate),
          end: buildEndIso(endDate),
        },
        responseType: "blob",
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

      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to export CSV.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function viewPreview() {
    setError(null);

    if (!validateDates()) return;

    setViewLoading(true);
    setPreviewLoaded(false);

    try {
      const res = await api.get<PreviewRow[]>("/orders/preview", {
        params: {
          start: buildStartIso(startDate),
          end: buildEndIso(endDate),
          limit: 50,
        },
      });

      setPreviewRows(res.data);
      setPreviewLoaded(true);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }

      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load preview.";
      setError(String(msg));
    } finally {
      setViewLoading(false);
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
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
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

      <div style={{ background: "#f6f6f6", padding: 16, borderRadius: 12, marginBottom: 16 }}>
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

        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={viewPreview}
            disabled={viewLoading || loading}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "white",
              color: "#111827",
              border: "1px solid #e5e7eb",
            }}
          >
            {viewLoading ? "Loading Preview..." : "View"}
          </button>

          <button
            onClick={downloadCsv}
            disabled={loading || viewLoading}
            style={{
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
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {previewLoaded && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: 16, fontWeight: 700, background: "#fafafa", borderBottom: "1px solid #eee" }}>
            Preview (first 50 rows)
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={th}>Created</th>
                  <th style={th}>Order ID</th>
                  <th style={th}>Customer ID</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Paid</th>
                  <th style={th}>Points</th>
                  <th style={th}>Operator</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 16, color: "#666" }}>
                      No rows found for this date range.
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row, idx) => (
                    <tr key={`${row.order_id}-${idx}`} style={{ borderTop: "1px solid #eee" }}>
                      <td style={td}>{row.created_at}</td>
                      <td style={td}>{row.order_id}</td>
                      <td style={td}>{row.customer_id}</td>
                      <td style={td}>{row.phone_number_used}</td>
                      <td style={td}>${Number(row.amount).toFixed(2)}</td>
                      <td style={td}>${Number(row.paid_amount).toFixed(2)}</td>
                      <td style={td}>{row.points_earned}</td>
                      <td style={td}>{row.operator_user_id}</td>
                      <td style={td}>{row.note ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>How this works</div>
        <div>• The system exports orders based on <code>created_at</code>, which is recorded automatically by the backend.</div>
        <div>• Order time is not manually editable, so daily/monthly CSV stays consistent for accounting and tax use.</div>
        <div>• Admin export includes full phone number; Staff export masks phone number.</div>
        <div>• View shows a preview only; Download CSV exports the full file for the selected date range.</div>
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

const errorBox: React.CSSProperties = {
  background: "#ffe8e8",
  color: "#b00020",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  color: "#444",
};

const td: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
  verticalAlign: "top",
};
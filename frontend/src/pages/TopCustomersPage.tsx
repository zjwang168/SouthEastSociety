import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

type TopCustomerRow = {
  customer_id: number;
  name: string | null;
  total_spent: number;
};

type AnalyticsResponse = {
  payment_breakdown: Record<string, number>;
  top_customers: TopCustomerRow[];
};

export default function TopCustomersPage() {
  const nav = useNavigate();

  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [useAllTime, setUseAllTime] = useState(false);

  const [rows, setRows] = useState<TopCustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTopCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, useAllTime]);

  async function loadTopCustomers() {
    setLoading(true);
    setError(null);

    try {
      const params = useAllTime
        ? {}
        : {
            start: `${startDate}T00:00:00`,
            end: `${endDate}T23:59:59`,
          };

      const res = await api.get<AnalyticsResponse>("/dashboard/analytics", {
        params,
      });

      setRows(res.data.top_customers ?? []);
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
        "Failed to load top customers";
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

  function setTodayRange() {
    setUseAllTime(false);
    setStartDate(today);
    setEndDate(today);
  }

  function setThisMonthRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const firstDay = `${year}-${month}-01`;
    const lastDayDate = new Date(year, now.getMonth() + 1, 0);
    const lastDay = lastDayDate.toISOString().slice(0, 10);

    setUseAllTime(false);
    setStartDate(firstDay);
    setEndDate(lastDay);
  }

  function setAllTimeRange() {
    setUseAllTime(true);
  }

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Top Customers</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={headerBtn}>
          Logout
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          marginBottom: 18,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Link to="/dashboard" style={linkStyle}>
          ← Back to Dashboard
        </Link>
      </div>

      <div style={card}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 12,
            color: "#14253d",
          }}
        >
          Filter Range
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <div style={label}>Start Date</div>
            <input
              type="date"
              value={startDate}
              disabled={useAllTime}
              onChange={(e) => {
                setUseAllTime(false);
                setStartDate(e.target.value);
              }}
              style={input}
            />
          </div>

          <div>
            <div style={label}>End Date</div>
            <input
              type="date"
              value={endDate}
              disabled={useAllTime}
              onChange={(e) => {
                setUseAllTime(false);
                setEndDate(e.target.value);
              }}
              style={input}
            />
          </div>

          <button onClick={setTodayRange} style={filterBtn}>
            Today
          </button>

          <button onClick={setThisMonthRange} style={filterBtn}>
            This Month
          </button>

          <button onClick={setAllTimeRange} style={filterBtn}>
            All Time
          </button>
        </div>

        <div style={{ marginTop: 12, color: "#667085", fontSize: 13 }}>
          {useAllTime
            ? "Showing top customers for all time."
            : `Showing top customers from ${startDate} to ${endDate}.`}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ ...card, marginTop: 18 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 12,
            color: "#14253d",
          }}
        >
          Customer Ranking
        </div>

        <div style={{ border: "1px solid #eceff3", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>Rank</th>
                <th style={th}>Customer</th>
                <th style={th}>Total Spent</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: "#666" }}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: "#666" }}>
                    No customer data found for this range.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.customer_id}-${index}`} style={{ borderTop: "1px solid #eceff3" }}>
                    <td style={td}>{index + 1}</td>
                    <td style={td}>{row.name || `Customer #${row.customer_id}`}</td>
                    <td style={td}>${Number(row.total_spent).toFixed(2)}</td>
                    <td style={td}>
                      <button
                        onClick={() => nav(`/customers/${row.customer_id}`)}
                        style={secondaryBtn}
                      >
                        View Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eceff3",
  borderRadius: 14,
  padding: 16,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  marginBottom: 6,
  fontWeight: 600,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  fontSize: 14,
};

const filterBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 12,
  textDecoration: "none",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const headerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 14,
  textDecoration: "none",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
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
};

const errorBox: React.CSSProperties = {
  background: "#ffe8e8",
  color: "#b00020",
  padding: 12,
  borderRadius: 8,
  marginTop: 16,
};
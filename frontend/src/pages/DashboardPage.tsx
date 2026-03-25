import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

type DashboardStats = {
  total_revenue: number;
  total_credits_issued: number;
  total_credits_redeemed: number;
  total_customers: number;
  total_outstanding: number;
};

type DashboardAnalytics = {
  payment_breakdown: Record<string, number>;
  top_customers: Array<{
    name: string | null;
    total_spent: number;
  }>;
};

export default function DashboardPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [statsLoading, setStatsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    async function loadMe() {
      try {
        const meRes = await api.get("/auth/me");
        setMe(meRes.data);
        localStorage.setItem("user_role", meRes.data.role);
      } catch (err: any) {
        setError("Not logged in (or token expired).");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
      }
    }
    loadMe();
  }, [nav]);

  useEffect(() => {
    async function loadDashboardData() {
      if (!me || me.role !== "admin") return;

      setStatsLoading(true);
      setAnalyticsLoading(true);

      try {
        const [statsRes, analyticsRes] = await Promise.all([
          api.get("/dashboard/stats", {
            params: {
              start: `${startDate}T00:00:00`,
              end: `${endDate}T23:59:59`,
            },
          }),
          api.get("/dashboard/analytics", {
            params: {
              start: `${startDate}T00:00:00`,
              end: `${endDate}T23:59:59`,
            },
          }),
        ]);

        setStats(statsRes.data);
        setAnalytics(analyticsRes.data);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setStatsLoading(false);
        setAnalyticsLoading(false);
      }
    }

    loadDashboardData();
  }, [me, startDate, endDate]);

  const paymentSlices = useMemo(() => {
    const breakdown = analytics?.payment_breakdown ?? {};
    const entries = Object.entries(breakdown).filter(([, amount]) => Number(amount) > 0);
    const total = entries.reduce((sum, [, amount]) => sum + Number(amount), 0);

    if (total <= 0) return { total: 0, slices: [], background: "#e5e7eb" };

    const palette = [
      "#14253d",
      "#4f46e5",
      "#0f766e",
      "#b45309",
      "#7c3aed",
      "#be123c",
    ];

    let current = 0;
    const slices = entries.map(([method, amount], index) => {
      const value = Number(amount);
      const percent = (value / total) * 100;
      const start = current;
      const end = current + percent;
      current = end;

      return {
        method,
        value,
        percent,
        color: palette[index % palette.length],
        start,
        end,
      };
    });

    const background = `conic-gradient(${slices
      .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
      .join(", ")})`;

    return { total, slices, background };
  }, [analytics]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  function setTodayRange() {
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

    setStartDate(firstDay);
    setEndDate(lastDay);
  }

  if (error) return <div style={{ padding: 24 }}>{error}</div>;
  if (!me) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "white",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src="/logo.png"
              alt="SouthEastSociety"
              style={{
                width: 42,
                height: 42,
                objectFit: "contain",
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#667085",
                marginBottom: 4,
              }}
            >
              SouthEastSociety
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 54,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                fontWeight: 800,
                color: "#14253d",
              }}
            >
              Dashboard
            </h1>
            <div
              style={{
                marginTop: 10,
                fontSize: 15,
                color: "#667085",
              }}
            >
              Internal operations workspace
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/change-password" style={headerBtn}>
              Change Password
            </Link>

            <button onClick={logout} style={headerBtn}>
              Logout
            </button>
          </div>

          {me.role === "admin" && (
            <Link to="/reset-password" style={smallHeaderBtn}>
              Reset Staff Password
            </Link>
          )}
        </div>
      </div>

      {me.role === "admin" && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 12,
              color: "#14253d",
            }}
          >
            Admin Overview
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
              alignItems: "flex-end",
            }}
          >
            <div>
              <div style={filterLabel}>Start Date</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={filterInput}
              />
            </div>

            <div>
              <div style={filterLabel}>End Date</div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={filterInput}
              />
            </div>

            <button onClick={setTodayRange} style={filterBtn}>
              Today
            </button>

            <button onClick={setThisMonthRange} style={filterBtn}>
              This Month
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard
              title="Total Revenue"
              value={
                statsLoading
                  ? "Loading..."
                  : `$${Number(stats?.total_revenue ?? 0).toFixed(2)}`
              }
            />
            <StatCard
              title="Total Credits Issued"
              value={
                statsLoading
                  ? "Loading..."
                  : String(stats?.total_credits_issued ?? 0)
              }
            />
            <StatCard
              title="Total Redeemed Credits"
              value={
                statsLoading
                  ? "Loading..."
                  : String(stats?.total_credits_redeemed ?? 0)
              }
            />
            <StatCard
              title="Total Customers"
              value={
                statsLoading
                  ? "Loading..."
                  : String(stats?.total_customers ?? 0)
              }
            />
            <StatCard
              title="Outstanding Amount"
              value={
                statsLoading
                  ? "Loading..."
                  : `$${Number(stats?.total_outstanding ?? 0).toFixed(2)}`
              }
            />
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 22,
          background: "#f6f6f6",
          padding: 16,
          borderRadius: 14,
          border: "1px solid #eceff3",
        }}
      >
        <div style={infoRow}>
          <b>User:</b> {me.username}
        </div>
        <div style={infoRow}>
          <b>Role:</b> {me.role}
        </div>
        <div style={infoRow}>
          <b>Active:</b> {String(me.is_active)}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 12,
            color: "#14253d",
          }}
        >
          Quick Actions
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {me.role === "admin" && (
            <>
              <Link to="/orders/new" style={primaryBtn}>
                + Create Order
              </Link>

              <Link to="/customers" style={secondaryBtn}>
                Customers
              </Link>

              <Link to="/outstanding" style={secondaryBtn}>
                Outstanding
              </Link>

              <Link to="/top-customers" style={secondaryBtn}>
                Top Customers
              </Link>

              <Link to="/sms" style={secondaryBtn}>
                SMS Queue
              </Link>

              <Link to="/audit" style={secondaryBtn}>
                Audit Log
              </Link>
            </>
          )}

          <Link to="/export" style={secondaryBtn}>
            Export CSV
          </Link>
        </div>

        <div
          style={{
            marginTop: 12,
            color: "#667085",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {me.role === "admin"
            ? "Admin can manage orders, customers, outstanding balances, top customers, SMS queue, audit log, password reset, and exports."
            : "Staff account is for export and analysis only. Customer phone numbers are hidden."}
        </div>
      </div>

      {me.role === "admin" && (
        <div style={{ marginTop: 32 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 12,
              color: "#14253d",
            }}
          >
            Payment Breakdown
          </div>

          <div style={analyticsCard}>
            {analyticsLoading ? (
              <div style={analyticsMuted}>Loading...</div>
            ) : !analytics || paymentSlices.total <= 0 ? (
              <div style={analyticsMuted}>No payment data for this range.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 220,
                      height: 220,
                      borderRadius: "50%",
                      background: paymentSlices.background,
                      border: "1px solid #eceff3",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 38,
                        background: "white",
                        borderRadius: "50%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#667085", fontWeight: 600 }}>
                        Total Paid
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#14253d" }}>
                        ${paymentSlices.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paymentSlices.slices.map((slice) => (
                    <div key={slice.method} style={legendRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: slice.color,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ textTransform: "capitalize" }}>{slice.method}</span>
                      </div>

                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ color: "#667085", fontSize: 13 }}>
                          {slice.percent.toFixed(1)}%
                        </span>
                        <strong>${slice.value.toFixed(2)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eceff3",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#667085",
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#14253d",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const infoRow: React.CSSProperties = {
  fontSize: 14,
  color: "#243447",
  lineHeight: 1.9,
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

const smallHeaderBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 12,
  textDecoration: "none",
  background: "#fafafa",
  color: "#344054",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: 12,
  textDecoration: "none",
  background: "#111827",
  color: "white",
  border: "1px solid #111827",
  fontWeight: 700,
  fontSize: 15,
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: 12,
  textDecoration: "none",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
  fontSize: 15,
};

const filterLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  marginBottom: 6,
  fontWeight: 600,
};

const filterInput: React.CSSProperties = {
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

const analyticsCard: React.CSSProperties = {
  background: "#fafafa",
  border: "1px solid #eceff3",
  borderRadius: 14,
  padding: 20,
};

const analyticsMuted: React.CSSProperties = {
  fontSize: 14,
  color: "#667085",
};

const legendRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 10,
  borderBottom: "1px solid #eceff3",
};
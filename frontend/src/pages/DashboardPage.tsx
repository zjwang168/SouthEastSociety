import { useEffect, useState } from "react";
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

export default function DashboardPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);
        localStorage.setItem("user_role", res.data.role);
      } catch (err: any) {
        setError("Not logged in (or token expired).");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
      }
    }
    load();
  }, [nav]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  if (error) return <div style={{ padding: 24 }}>{error}</div>;
  if (!me) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      {/* Header */}
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

      {/* Account box */}
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

      {/* Quick Actions */}
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
            ? "Admin can manage orders, customers, outstanding balances, SMS queue, audit log, password reset, and exports."
            : "Staff account is for export and analysis only. Customer phone numbers are hidden."}
        </div>
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
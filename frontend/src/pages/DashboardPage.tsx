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
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ flex: 1 }} />

        <Link to="/change-password" style={secondaryBtn}>
          Change Password
        </Link>

        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 16, background: "#f6f6f6", padding: 16, borderRadius: 12 }}>
        <div><b>User:</b> {me.username}</div>
        <div><b>Role:</b> {me.role}</div>
        <div><b>Active:</b> {String(me.is_active)}</div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Quick Actions</div>

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

              <Link to="/reset-password" style={secondaryBtn}>
                Reset Staff Password
              </Link>
            </>
          )}

          <Link to="/export" style={secondaryBtn}>
            Export CSV
          </Link>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          {me.role === "admin"
            ? "Admin can manage orders, customers, outstanding balances, SMS queue, audit log, password reset, and exports."
            : "Staff account is for export and analysis only. Customer phone numbers are hidden."}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  textDecoration: "none",
  background: "#111827",
  color: "white",
  border: "1px solid #111827",
  fontWeight: 700,
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  textDecoration: "none",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 600,
};
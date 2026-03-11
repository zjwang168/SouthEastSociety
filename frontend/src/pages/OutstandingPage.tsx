import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { formatEasternTime } from "../utils/time";

type OutstandingRow = {
  customer_id: number;
  nickname: string | null;
  primary_phone: string | null;
  total_outstanding: number;
  last_order_at: string;
};

function buildDefaultReminder(nickname: string | null, amount: number) {
  const name = nickname?.trim() ? nickname.trim() : "there";
  return `Hi ${name}, this is a friendly reminder that your balance is $${Number(amount).toFixed(
    2
  )}. Thank you!`;
}

export default function OutstandingPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- SMS modal state ---
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<OutstandingRow | null>(null);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsCreating, setSmsCreating] = useState(false);

  const smsCanSubmit = useMemo(() => {
    return !!smsTarget && smsPhone.trim().length > 0 && smsMessage.trim().length > 0;
  }, [smsTarget, smsPhone, smsMessage]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<OutstandingRow[]>("/orders/outstanding/customers");
      setRows(res.data);
    } catch (e: any) {
      // token 失效 / 没登录
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load outstanding customers";
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openSms(r: OutstandingRow) {
    setSmsTarget(r);
    setSmsPhone(r.primary_phone ?? "");
    setSmsMessage(buildDefaultReminder(r.nickname, Number(r.total_outstanding)));
    setSmsOpen(true);
  }

  function closeSms() {
    setSmsOpen(false);
    setSmsTarget(null);
    setSmsPhone("");
    setSmsMessage("");
  }

  async function confirmCreateSms() {
    if (!smsTarget) return;
    setSmsCreating(true);
    setError(null);
    try {
      await api.post("/sms/queue", {
        customer_id: smsTarget.customer_id,
        phone_number: smsPhone.trim(),
        message: smsMessage.trim(),
      });
      closeSms();
      alert("✅ SMS queued for today.");
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to queue SMS";
      setError(String(msg));
    } finally {
      setSmsCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Outstanding</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 10, marginBottom: 18, display: "flex", gap: 12 }}>
        <Link to="/dashboard" style={{ color: "#3b82f6", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
        <Link to="/customers" style={{ color: "#3b82f6", textDecoration: "none" }}>
          Customers
        </Link>
        <button
          onClick={load}
          disabled={loading}
          style={{ marginLeft: "auto", padding: "10px 14px", borderRadius: 8 }}
        >
          {loading ? "Refreshing..." : "Refresh"}
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

      <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>Customer</th>
              <th style={th}>Primary Phone</th>
              <th style={th}>Total Outstanding</th>
              <th style={th}>Last Order</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                  No outstanding customers 🎉
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.customer_id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.nickname ?? "(no nickname)"}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>ID: {r.customer_id}</div>
                  </td>
                  <td style={td}>{r.primary_phone ?? "-"}</td>
                  <td style={td}>
                    <span style={{ fontWeight: 700 }}>${Number(r.total_outstanding).toFixed(2)}</span>
                  </td>
                  <td style={td}>{formatEasternTime(r.last_order_at)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link
                        to={`/customers/${r.customer_id}`}
                        style={{
                          display: "inline-block",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          textDecoration: "none",
                          color: "#111827",
                          background: "white",
                        }}
                      >
                        View Customer
                      </Link>

                      <button
                        onClick={() => openSms(r)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          background: "#111827",
                          color: "white",
                        }}
                      >
                        Create SMS Reminder
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
        Data source: <code>/orders/outstanding/customers</code>
      </div>

      {/* --- SMS Modal --- */}
      {smsOpen && smsTarget && (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Create SMS Reminder</h2>
              <div style={{ flex: 1 }} />
              <button onClick={closeSms} style={{ padding: "6px 10px", borderRadius: 8 }}>
                X
              </button>
            </div>

            <div style={{ marginTop: 10, color: "#555", fontSize: 14 }}>
              <div>
                Customer: <b>{smsTarget.nickname ?? `(ID ${smsTarget.customer_id})`}</b>
              </div>
              <div>
                Outstanding: <b>${Number(smsTarget.total_outstanding).toFixed(2)}</b>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Phone number</label>
              <input
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="e.g. 2406146786"
                style={input}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>Message (editable)</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={5}
                style={{ ...input, fontFamily: "inherit", width: "100%" }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
                Will be queued for <b>today</b> by default.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={closeSms} style={{ padding: "10px 14px", borderRadius: 8 }}>
                Cancel
              </button>
              <button
                onClick={confirmCreateSms}
                disabled={!smsCanSubmit || smsCreating}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#111827",
                  color: "white",
                  border: "1px solid #111827",
                }}
              >
                {smsCreating ? "Creating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
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

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  background: "white",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
};
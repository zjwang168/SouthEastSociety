import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

type SmsQueueRow = {
  id: number;
  customer_id: number;
  order_id: number | null;
  phone_number: string;
  message: string;
  scheduled_for: string; // "YYYY-MM-DD"
  status: string; // "pending" | "sent" | "failed"
};

type SendDueResult = {
  count: number;
  results: Array<{ queue_id: number; status: string; error?: string }>;
};

export default function SmsQueuePage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<SmsQueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendDueResult | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SmsQueueRow[]>("/sms/queue");
      setRows(res.data);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        nav("/login");
        return;
      }
      const msg =
        e?.response?.data?.detail ?? e?.message ?? "Failed to load sms queue";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function sendDue() {
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await api.post<SendDueResult>("/sms/send-due", {});
      setSendResult(res.data);
      await load();
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        nav("/login");
        return;
      }
      const msg =
        e?.response?.data?.detail ?? e?.message ?? "Failed to send due SMS";
      setError(String(msg));
    } finally {
      setSending(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    nav("/login");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>SMS Queue (Today)</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 10, marginBottom: 18, display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/dashboard" style={{ color: "#3b82f6", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
        <Link to="/outstanding" style={{ color: "#3b82f6", textDecoration: "none" }}>
          Outstanding
        </Link>
        <button
          onClick={load}
          disabled={loading}
          style={{ marginLeft: "auto", padding: "10px 14px", borderRadius: 8 }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button
          onClick={sendDue}
          disabled={sending || loading || rows.length === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: rows.length === 0 ? "#eee" : "#111827",
            color: rows.length === 0 ? "#666" : "white",
            border: "none",
          }}
        >
          {sending ? "Sending..." : "Send Due Today"}
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

      {sendResult && (
        <div
          style={{
            background: "#eef6ff",
            color: "#0b3a74",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Send result: {sendResult.count} attempted
          </div>
          <div style={{ fontSize: 12 }}>
            {sendResult.results.map((r) => (
              <div key={r.queue_id}>
                queue_id={r.queue_id} → {r.status}
                {r.error ? ` (error=${r.error})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>Queue ID</th>
              <th style={th}>Customer</th>
              <th style={th}>Phone</th>
              <th style={th}>Message</th>
              <th style={th}>Scheduled</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: "#666" }}>
                  No pending SMS for today 🎉
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.customer_id}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {r.order_id ? `Order: ${r.order_id}` : "Order: -"}
                    </div>
                  </td>
                  <td style={td}>{r.phone_number}</td>
                  <td style={{ ...td, maxWidth: 520 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{r.message}</div>
                  </td>
                  <td style={td}>{r.scheduled_for}</td>
                  <td style={td}>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
        Data source: <code>/sms/queue</code> and <code>/sms/send-due</code>
        <br />
        注意：你现在的 <code>send_sms</code> 是 stub，会在 backend 控制台 print <code>[SMS] ...</code>。
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
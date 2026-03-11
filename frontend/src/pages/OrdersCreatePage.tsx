import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { CustomerWithPhones } from "../types";
import { formatEasternTime } from "../utils/time";

type OrderOut = {
  id: number;
  customer_id: number;
  phone_number_used: string;
  amount: number;
  paid_amount: number;
  points_earned: number;
  points_used: number;
  operator_user_id: number;
  created_at: string;
  note: string | null;
};

export default function OrdersCreatePage() {
  const nav = useNavigate();

  // Form fields
  const [customerId, setCustomerId] = useState<string>("");
  const [phoneNumberUsed, setPhoneNumberUsed] = useState<string>("");
  const [amount, setAmount] = useState<string>(""); // keep as string for input
  const [paidAmount, setPaidAmount] = useState<string>(""); // optional; default to amount if empty
  const [note, setNote] = useState<string>("");

  // Customer preview
  const [customer, setCustomer] = useState<CustomerWithPhones | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrderOut | null>(null);

  const parsedCustomerId = useMemo(() => {
    const n = Number(customerId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [customerId]);

  const parsedAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) ? n : null;
  }, [amount]);

  const parsedPaidAmount = useMemo(() => {
    if (!paidAmount.trim()) return null; // means "use default"
    const n = Number(paidAmount);
    return Number.isFinite(n) ? n : null;
  }, [paidAmount]);

  async function loadCustomer(id: number) {
    setLoadingCustomer(true);
    setError(null);
    setCustomer(null);
    try {
      const res = await api.get<CustomerWithPhones>(`/customers/${id}`);
      setCustomer(res.data);

      // auto-fill phone if empty: pick primary else first
      if (!phoneNumberUsed.trim()) {
        const primary = res.data.phones?.find((p) => p.is_primary)?.phone_number;
        const first = res.data.phones?.[0]?.phone_number;
        const auto = primary ?? first ?? "";
        if (auto) setPhoneNumberUsed(auto);
      }
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load customer";
      setError(String(msg));
    } finally {
      setLoadingCustomer(false);
    }
  }

  // When customerId becomes valid, load customer
  useEffect(() => {
    if (parsedCustomerId) {
      loadCustomer(parsedCustomerId);
    } else {
      setCustomer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedCustomerId]);

  async function submit() {
    setError(null);
    setSuccess(null);

    if (!parsedCustomerId) {
      setError("Please enter a valid customer_id.");
      return;
    }
    if (parsedAmount === null || parsedAmount <= 0) {
      setError("Please enter a valid amount (> 0).");
      return;
    }
    if (!phoneNumberUsed.trim()) {
      setError("Please enter phone_number_used (or select from phones).");
      return;
    }
    if (parsedPaidAmount !== null && parsedPaidAmount < 0) {
      setError("paid_amount cannot be negative.");
      return;
    }

    const payload: any = {
      customer_id: parsedCustomerId,
      phone_number_used: phoneNumberUsed.trim(),
      amount: parsedAmount,
      note: note.trim() ? note.trim() : null,
    };
    // If user left paid_amount empty, backend will default it to amount
    if (parsedPaidAmount !== null) payload.paid_amount = parsedPaidAmount;

    setSubmitting(true);
    try {
      const res = await api.post<OrderOut>("/orders", payload);
      setSuccess(res.data);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        nav("/login");
        return;
      }
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to create order";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    nav("/login");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Create Order</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 8 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 10, marginBottom: 18, display: "flex", gap: 12 }}>
        <Link to="/dashboard" style={linkStyle}>
          ← Back to Dashboard
        </Link>
        <Link to="/customers" style={linkStyle}>
          Customers
        </Link>
        <Link to="/outstanding" style={linkStyle}>
          Outstanding
        </Link>
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

      {success && (
        <div
          style={{
            background: "#e9fff1",
            color: "#14532d",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Order created!</div>
          <div style={{ fontSize: 14 }}>
            Order #{success.id} — Amount ${Number(success.amount).toFixed(2)} — Paid $
            {Number(success.paid_amount).toFixed(2)} — Points {success.points_earned}
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Created at: {formatEasternTime(success.created_at)}
          </div>
          <div style={{ marginTop: 8 }}>
            <Link to={`/customers/${success.customer_id}`} style={linkStyle}>
              View Customer →
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left: form */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Order Info</div>

          <div style={field}>
            <label style={label}>Customer ID</label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="e.g. 4"
              style={input}
            />
            <div style={hint}>Tip: paste customer id from Customers list.</div>
          </div>

          <div style={field}>
            <label style={label}>Phone Number Used</label>
            <input
              value={phoneNumberUsed}
              onChange={(e) => setPhoneNumberUsed(e.target.value)}
              placeholder="e.g. 2406146786"
              style={input}
            />
            {customer?.phones?.length ? (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {customer.phones.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhoneNumberUsed(p.phone_number)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: p.phone_number === phoneNumberUsed ? "#111827" : "white",
                      color: p.phone_number === phoneNumberUsed ? "white" : "#111827",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    title={p.is_primary ? "Primary phone" : ""}
                  >
                    {p.phone_number}
                    {p.is_primary ? " (primary)" : ""}
                  </button>
                ))}
              </div>
            ) : (
              <div style={hint}>No phones loaded yet (enter customer id first).</div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={field}>
              <label style={label}>Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 100"
                style={input}
              />
              <div style={hint}>Total order amount.</div>
            </div>

            <div style={field}>
              <label style={label}>Paid Amount (optional)</label>
              <input
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="leave empty = same as amount"
                style={input}
              />
              <div style={hint}>Leave empty to auto set paid_amount = amount.</div>
            </div>
          </div>

          <div style={field}>
            <label style={label}>Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "Paid $80, owes $20"'
              style={{ ...input, height: 90, resize: "vertical" }}
            />
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              width: "100%",
              marginTop: 8,
            }}
          >
            {submitting ? "Creating..." : "Create Order"}
          </button>

          <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
            API: <code>POST /orders</code>
          </div>
        </div>

        {/* Right: customer preview */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Customer Preview</div>

          {!parsedCustomerId ? (
            <div style={{ color: "#666" }}>Enter a valid Customer ID to preview.</div>
          ) : loadingCustomer ? (
            <div style={{ color: "#666" }}>Loading customer...</div>
          ) : customer ? (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {customer.nickname ?? "(no nickname)"}
              </div>
              <div style={{ color: "#666", marginTop: 4 }}>
                ID: {customer.id} • Status: {customer.status}
              </div>

              <div style={{ marginTop: 14, fontWeight: 700 }}>Phones</div>
              <div style={{ marginTop: 8 }}>
                {customer.phones.length === 0 ? (
                  <div style={{ color: "#666" }}>No phones</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {customer.phones.map((p) => (
                      <li key={p.id} style={{ marginBottom: 6 }}>
                        <code>{p.phone_number}</code>{" "}
                        {p.is_primary ? <b>(primary)</b> : null}{" "}
                        {!p.sms_enabled ? <span style={{ color: "#b00020" }}>(sms off)</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <Link to={`/customers/${customer.id}`} style={linkStyle}>
                  Open Customer Detail →
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ color: "#666" }}>
              Customer not loaded (check id / token).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 12,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#444",
};

const hint: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  outline: "none",
};
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatEasternTime } from "../utils/time";

type OrderOut = {
  id: number;
  customer_id: number;
  phone_number_used: string;
  amount: number;
  paid_amount: number;
  payment_method: string | null;
  points_earned: number;
  points_used: number;
  tier_rate: number | null;
  cash_value: number | null;
  is_manual_tier: boolean;
  operator_user_id: number;
  created_at: string;
  note: string | null;
};

export default function OrdersCreatePage() {
  const nav = useNavigate();

  const [phoneNumberUsed, setPhoneNumberUsed] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [manualCredits, setManualCredits] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrderOut | null>(null);

  const parsedAmount = Number(amount);
  const parsedPaidAmount =
    paidAmount.trim() === "" ? null : Number(paidAmount);
  const parsedManualCredits =
    manualCredits.trim() === "" ? null : Number(manualCredits);

  async function submit() {
    setError(null);
    setSuccess(null);

    if (!phoneNumberUsed.trim()) {
      setError("Please enter a phone number.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount (> 0).");
      return;
    }

    if (
      parsedPaidAmount !== null &&
      (!Number.isFinite(parsedPaidAmount) || parsedPaidAmount < 0)
    ) {
      setError("paid_amount cannot be negative.");
      return;
    }

    if (parsedAmount > 5000) {
      if (
        parsedManualCredits === null ||
        !Number.isFinite(parsedManualCredits) ||
        parsedManualCredits < 0
      ) {
        setError("Manual credits are required for donation amounts above 5000.");
        return;
      }
    }

    const payload: any = {
      phone_number_used: phoneNumberUsed.trim(),
      amount: parsedAmount,
      payment_method: paymentMethod,
      note: note.trim() ? note.trim() : null,
    };

    if (nickname.trim()) {
      payload.nickname = nickname.trim();
    }

    if (parsedPaidAmount !== null) {
      payload.paid_amount = parsedPaidAmount;
    }

    if (parsedAmount > 5000) {
      payload.manual_credits = parsedManualCredits;
    }

    setSubmitting(true);
    try {
      const res = await api.post<OrderOut>("/orders", payload);
      setSuccess(res.data);

      setNickname("");
      setAmount("");
      setPaidAmount("");
      setManualCredits("");
      setNote("");
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
        "Failed to create order";
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
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Create Order</h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={logout}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
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
        }}
      >
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
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            ✅ Order created!
          </div>
          <div style={{ fontSize: 14 }}>
            Order #{success.id} — Donation $
            {Number(success.amount).toFixed(2)} — Paid $
            {Number(success.paid_amount).toFixed(2)} — Credits{" "}
            {success.points_earned}
            {success.is_manual_tier ? " (manual)" : ""}
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Created at: {formatEasternTime(success.created_at)}
          </div>
          <div style={{ marginTop: 8 }}>
            <Link
              to={`/customers/${success.customer_id}`}
              style={linkStyle}
            >
              View Customer →
            </Link>
          </div>
        </div>
      )}

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Order Info</div>

        <div style={field}>
          <label style={label}>Phone Number</label>
          <input
            value={phoneNumberUsed}
            onChange={(e) => setPhoneNumberUsed(e.target.value)}
            placeholder="e.g. 2406146786"
            style={input}
          />
          <div style={hint}>
            The system will use this phone number to identify an existing
            customer. If not found, it will automatically create a new
            customer.
          </div>
        </div>

        <div style={field}>
          <label style={label}>Nickname (optional)</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Jane"
            style={input}
          />
          <div style={hint}>
            Used only when this phone number is a new customer.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div style={field}>
            <label style={label}>Donation Amount</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100"
              style={input}
            />
            <div style={hint}>Total donation amount.</div>
          </div>

          <div style={field}>
            <label style={label}>Paid Amount (optional)</label>
            <input
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="leave empty = same as amount"
              style={input}
            />
            <div style={hint}>
              Leave empty to auto set paid_amount = amount.
            </div>
          </div>
        </div>

        <div style={field}>
          <label style={label}>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ ...input, height: 42 }}
          >
            <option value="cash">Cash</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
          </select>
        </div>

        {parsedAmount > 5000 && (
          <div style={field}>
            <label style={label}>Manual Credits</label>
            <input
              value={manualCredits}
              onChange={(e) => setManualCredits(e.target.value)}
              placeholder="e.g. 200"
              style={input}
            />
            <div style={hint}>
              Required for donation amounts above 5000.
            </div>
          </div>
        )}

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
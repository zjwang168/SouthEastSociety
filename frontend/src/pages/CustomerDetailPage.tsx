import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { CustomerWithPhones, PhoneOut, OrderOut } from "../types";

export default function CustomerDetailPage() {
  const nav = useNavigate();
  const params = useParams();
  const customerId = Number(params.id);

  const [customer, setCustomer] = useState<CustomerWithPhones | null>(null);
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add phone
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [addingPhone, setAddingPhone] = useState(false);

  // Create order
  const [orderPhone, setOrderPhone] = useState("");
  const [amount, setAmount] = useState<string>("100");
  const [paidAmount, setPaidAmount] = useState<string>("80");
  const [note, setNote] = useState<string>("OWE $20");
  const [creatingOrder, setCreatingOrder] = useState(false);

  const phones: PhoneOut[] = customer?.phones ?? [];

  const primaryPhone = useMemo(() => {
    const p = phones.find((x) => x.is_primary);
    return p?.phone_number ?? "";
  }, [phones]);

  useEffect(() => {
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setError("Invalid customer id.");
      setLoading(false);
      return;
    }

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const cRes = await api.get<CustomerWithPhones>(`/customers/${customerId}`);
        setCustomer(cRes.data);

        const oRes = await api.get<OrderOut[]>("/orders", {
          params: { customer_id: customerId, limit: 200 },
        });
        setOrders(oRes.data);

        // 默认订单手机号：优先用 primary phone
        if (!orderPhone) {
          setOrderPhone(primaryPhone || cRes.data.phones?.[0]?.phone_number || "");
        }
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load customer";
        setError(String(msg));

        // token 失效就踢回登录
        if (e?.response?.status === 401) {
          localStorage.removeItem("access_token");
          nav("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, nav]);

  function logout() {
    localStorage.removeItem("access_token");
    nav("/login");
  }

  async function refreshCustomer() {
    const cRes = await api.get<CustomerWithPhones>(`/customers/${customerId}`);
    setCustomer(cRes.data);
  }

  async function refreshOrders() {
    const oRes = await api.get<OrderOut[]>("/orders", {
      params: { customer_id: customerId, limit: 200 },
    });
    setOrders(oRes.data);
  }

  async function onAddPhone() {
    if (!phoneNumber.trim()) return;
    setAddingPhone(true);
    setError(null);
    try {
      await api.post(`/customers/${customerId}/phones`, {
        phone_number: phoneNumber.trim(),
        is_primary: isPrimary,
        sms_enabled: smsEnabled,
      });
      setPhoneNumber("");
      setIsPrimary(false);
      setSmsEnabled(true);
      await refreshCustomer();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to add phone";
      setError(String(msg));
    } finally {
      setAddingPhone(false);
    }
  }

  async function onDeletePhone(phoneId: number) {
    if (!confirm("Delete this phone?")) return;
    setError(null);
    try {
      // ⚠️ 这里假设你的后端有这个 endpoint（你现在 UI 上 delete 已经能用，说明你那边应该就是类似路径）
      await api.delete(`/customers/${customerId}/phones/${phoneId}`);
      await refreshCustomer();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to delete phone";
      setError(String(msg));
    }
  }

  async function onCreateOrder() {
    if (!orderPhone.trim()) {
      setError("Please choose a phone number for the order.");
      return;
    }

    const a = Number(amount);
    const p = paidAmount.trim() === "" ? undefined : Number(paidAmount);

    if (!Number.isFinite(a) || a <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (p !== undefined && (!Number.isFinite(p) || p < 0)) {
      setError("Paid amount must be >= 0.");
      return;
    }

    setCreatingOrder(true);
    setError(null);
    try {
      await api.post("/orders", {
        customer_id: customerId,
        phone_number_used: orderPhone.trim(),
        amount: a,
        paid_amount: p, // 允许 undefined，让后端默认 paid=amount
        note: note.trim() ? note.trim() : null,
      });

      // 刷新 outstanding/sms 之类（你后端应该会在创建 order 时生成 sms queue）
      await refreshOrders();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to create order";
      setError(String(msg));
    } finally {
      setCreatingOrder(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24, color: "#b00020" }}>{error}</div>;
  if (!customer) return <div style={{ padding: 24 }}>Not found.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 56 }}>Customer Detail</h1>
        <button onClick={logout} style={btn}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <Link to="/customers" style={{ textDecoration: "none" }}>
          ← Back to Customers
        </Link>
      </div>

      {error && (
        <div style={{ background: "#ffe8e8", color: "#b00020", padding: 12, borderRadius: 8, marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* Customer summary */}
      <div style={{ marginTop: 16, background: "#f6f6f6", padding: 16, borderRadius: 12 }}>
        <div style={row}><b>ID:</b> {customer.id}</div>
        <div style={row}><b>Nickname:</b> {customer.nickname ?? "-"}</div>
        <div style={row}><b>Status:</b> {customer.status}</div>
        <div style={{ color: "#666", marginTop: 6 }}>
          Created: {new Date(customer.created_at).toLocaleString()} · Updated: {new Date(customer.updated_at).toLocaleString()}
        </div>
      </div>

      {/* Add phone */}
      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 42 }}>Add Phone</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 420 }}>
            <div style={label}>Phone number</div>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 2406146786"
              style={input}
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18 }}>
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            Primary
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18 }}>
            <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} />
            SMS enabled
          </label>

          <button onClick={onAddPhone} disabled={addingPhone || !phoneNumber.trim()} style={btn}>
            {addingPhone ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Phones table */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 42, marginBottom: 8 }}>Phones</h2>
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>Phone</th>
                <th style={th}>Primary</th>
                <th style={th}>SMS Enabled</th>
                <th style={th}>Created</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {phones.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                    No phones yet.
                  </td>
                </tr>
              ) : (
                phones.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>{p.phone_number}</td>
                    <td style={td}>{p.is_primary ? <span style={pillGreen}>Primary</span> : "-"}</td>
                    <td style={td}>{p.sms_enabled ? "On" : "Off"}</td>
                    <td style={td}>{new Date(p.created_at).toLocaleString()}</td>
                    <td style={td}>
                      <button onClick={() => onDeletePhone(p.id)} style={btnSecondary}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders */}
      <div style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 42, marginBottom: 8 }}>Orders</h2>

        {/* Create order */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Create Order</h3>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 260 }}>
              <div style={label}>Phone used</div>
              <select
                value={orderPhone}
                onChange={(e) => setOrderPhone(e.target.value)}
                style={{ ...input, height: 42 }}
              >
                <option value="">-- select --</option>
                {phones.map((p) => (
                  <option key={p.id} value={p.phone_number}>
                    {p.phone_number}{p.is_primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ width: 160 }}>
              <div style={label}>Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
            </div>

            <div style={{ width: 160 }}>
              <div style={label}>Paid amount</div>
              <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={input} />
            </div>

            <div style={{ minWidth: 300, flex: 1 }}>
              <div style={label}>Note</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} style={input} />
            </div>

            <button onClick={onCreateOrder} disabled={creatingOrder} style={btn}>
              {creatingOrder ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Orders table */}
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Phone</th>
                <th style={th}>Amount</th>
                <th style={th}>Paid</th>
                <th style={th}>Outstanding</th>
                <th style={th}>Points</th>
                <th style={th}>Created</th>
                <th style={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: "#666" }}>
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const outstanding = Math.max(0, o.amount - o.paid_amount);
                  return (
                    <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={td}>{o.id}</td>
                      <td style={td}>{o.phone_number_used}</td>
                      <td style={td}>${o.amount.toFixed(2)}</td>
                      <td style={td}>${o.paid_amount.toFixed(2)}</td>
                      <td style={td}>{outstanding > 0 ? <b>${outstanding.toFixed(2)}</b> : "$0.00"}</td>
                      <td style={td}>{o.points_earned}</td>
                      <td style={td}>{new Date(o.created_at).toLocaleString()}</td>
                      <td style={td}>{o.note ?? "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const row: React.CSSProperties = { marginTop: 6 };

const label: React.CSSProperties = { fontSize: 12, color: "#444", marginBottom: 6 };

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  outline: "none",
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
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

const pillGreen: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eaffea",
  color: "#1b6b1b",
  fontWeight: 600,
  fontSize: 12,
};
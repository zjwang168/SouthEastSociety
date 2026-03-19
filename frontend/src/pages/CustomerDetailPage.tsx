import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatEasternTime } from "../utils/time";

type PhoneOut = {
  id: number;
  customer_id: number;
  phone_number: string;
  is_primary: boolean;
  sms_enabled: boolean;
  created_at: string;
};

type CustomerWithPhones = {
  id: number;
  nickname: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  phones: PhoneOut[];
};

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

type CreditsSummary = {
  customer_id: number;
  total_points_earned: number;
  total_points_redeemed: number;
  available_points: number;
};

type PointsRedemptionOut = {
  id: number;
  customer_id: number;
  points_used: number;
  gift_name: string | null;
  note: string | null;
  operator_user_id: number;
  created_at: string;
};

export default function CustomerDetailPage() {
  const nav = useNavigate();
  const params = useParams();
  const customerId = Number(params.id);

  const [customer, setCustomer] = useState<CustomerWithPhones | null>(null);
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [creditsSummary, setCreditsSummary] = useState<CreditsSummary | null>(null);
  const [redemptions, setRedemptions] = useState<PointsRedemptionOut[]>([]);
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
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [manualCredits, setManualCredits] = useState<string>("");
  const [note, setNote] = useState<string>("OWE $20");
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Redeem credits
  const [redeemCredits, setRedeemCredits] = useState<string>("");
  const [giftName, setGiftName] = useState<string>("");
  const [redeemNote, setRedeemNote] = useState<string>("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<PointsRedemptionOut | null>(null);

  const phones: PhoneOut[] = customer?.phones ?? [];

  const primaryPhone = useMemo(() => {
    const p = phones.find((x) => x.is_primary);
    return p?.phone_number ?? "";
  }, [phones]);

  const totalSpent = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.amount, 0);
  }, [orders]);

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
        const [cRes, oRes, pRes, rRes] = await Promise.all([
          api.get<CustomerWithPhones>(`/customers/${customerId}`),
          api.get<OrderOut[]>("/orders", {
            params: { customer_id: customerId, limit: 200 },
          }),
          api.get<CreditsSummary>(`/customers/${customerId}/points-summary`),
          api.get<PointsRedemptionOut[]>(`/customers/${customerId}/redemptions`),
        ]);

        setCustomer(cRes.data);
        setOrders(oRes.data);
        setCreditsSummary(pRes.data);
        setRedemptions(rRes.data);

        if (!orderPhone) {
          const primary = cRes.data.phones?.find((p) => p.is_primary)?.phone_number;
          const first = cRes.data.phones?.[0]?.phone_number;
          setOrderPhone(primary || first || "");
        }
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to load customer";
        setError(String(msg));

        if (e?.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_role");
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
    localStorage.removeItem("user_role");
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

  async function refreshCreditsSummary() {
    const pRes = await api.get<CreditsSummary>(`/customers/${customerId}/points-summary`);
    setCreditsSummary(pRes.data);
  }

  async function refreshRedemptions() {
    const rRes = await api.get<PointsRedemptionOut[]>(`/customers/${customerId}/redemptions`);
    setRedemptions(rRes.data);
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
    const manualCreditsValue =
      manualCredits.trim() === "" ? undefined : Number(manualCredits);

    if (!Number.isFinite(a) || a <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (p !== undefined && (!Number.isFinite(p) || p < 0)) {
      setError("Paid amount must be >= 0.");
      return;
    }
    if (a > 5000) {
      if (
        manualCreditsValue === undefined ||
        !Number.isFinite(manualCreditsValue) ||
        manualCreditsValue < 0
      ) {
        setError("Manual credits are required for donation amounts above 5000.");
        return;
      }
    }

    setCreatingOrder(true);
    setError(null);
    try {
      await api.post("/orders", {
        phone_number_used: orderPhone.trim(),
        amount: a,
        paid_amount: p,
        payment_method: paymentMethod,
        manual_credits: a > 5000 ? manualCreditsValue : null,
        note: note.trim() ? note.trim() : null,
      });

      await refreshOrders();
      await refreshCreditsSummary();
      setManualCredits("");
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to create order";
      setError(String(msg));
    } finally {
      setCreatingOrder(false);
    }
  }

  async function onRedeemCredits() {
    setError(null);
    setRedeemSuccess(null);

    const credits = Number(redeemCredits);
    if (!Number.isFinite(credits) || credits <= 0) {
      setError("Credits to redeem must be a positive number.");
      return;
    }

    setRedeeming(true);
    try {
      const res = await api.post<PointsRedemptionOut>(
        `/customers/${customerId}/redeem-points`,
        {
          points_used: credits,
          gift_name: giftName.trim() ? giftName.trim() : null,
          note: redeemNote.trim() ? redeemNote.trim() : null,
        }
      );

      setRedeemSuccess(res.data);
      setRedeemCredits("");
      setGiftName("");
      setRedeemNote("");

      await refreshCreditsSummary();
      await refreshRedemptions();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "Failed to redeem credits";
      setError(String(msg));
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error && !customer) return <div style={{ padding: 24, color: "#b00020" }}>{error}</div>;
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

      <div style={{ marginTop: 16, background: "#f6f6f6", padding: 16, borderRadius: 12 }}>
        <div style={row}><b>ID:</b> {customer.id}</div>
        <div style={row}><b>Nickname:</b> {customer.nickname ?? "-"}</div>
        <div style={row}><b>Status:</b> {customer.status}</div>
        <div style={row}><b>Primary Phone:</b> {primaryPhone || "-"}</div>
        <div style={{ color: "#666", marginTop: 6 }}>
          Created: {formatEasternTime(customer.created_at)} · Updated: {formatEasternTime(customer.updated_at)}
        </div>
      </div>

      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 42 }}>Credits Summary</h2>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={summaryCard}>
            <div style={summaryLabel}>Total Spent</div>
            <div style={summaryValue}>${totalSpent.toFixed(2)}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Total Earned Credits</div>
            <div style={summaryValue}>{creditsSummary?.total_points_earned ?? 0}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Total Redeemed Credits</div>
            <div style={summaryValue}>{creditsSummary?.total_points_redeemed ?? 0}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Available Credits</div>
            <div style={summaryValue}>{creditsSummary?.available_points ?? 0}</div>
          </div>
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Redeem Credits</h3>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ width: 160 }}>
              <div style={label}>Credits to use</div>
              <input
                value={redeemCredits}
                onChange={(e) => setRedeemCredits(e.target.value)}
                placeholder="e.g. 200"
                style={input}
              />
            </div>

            <div style={{ minWidth: 260 }}>
              <div style={label}>Gift name (optional)</div>
              <input
                value={giftName}
                onChange={(e) => setGiftName(e.target.value)}
                placeholder="e.g. Tea Gift Box"
                style={input}
              />
            </div>

            <div style={{ minWidth: 320, flex: 1 }}>
              <div style={label}>Note (optional)</div>
              <input
                value={redeemNote}
                onChange={(e) => setRedeemNote(e.target.value)}
                placeholder="e.g. Redeemed in store"
                style={input}
              />
            </div>

            <button onClick={onRedeemCredits} disabled={redeeming} style={btn}>
              {redeeming ? "Redeeming..." : "Redeem"}
            </button>
          </div>

          {redeemSuccess && (
            <div
              style={{
                marginTop: 12,
                background: "#e9fff1",
                color: "#14532d",
                padding: 12,
                borderRadius: 8,
              }}
            >
              ✅ Redeemed {redeemSuccess.points_used} credits
              {redeemSuccess.gift_name ? ` for ${redeemSuccess.gift_name}` : ""}.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 42, marginBottom: 8 }}>Redemption History</h2>
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Credits Used</th>
                <th style={th}>Gift</th>
                <th style={th}>Note</th>
                <th style={th}>Operator</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "#666" }}>
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                redemptions.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>{formatEasternTime(r.created_at)}</td>
                    <td style={td}>{r.points_used}</td>
                    <td style={td}>{r.gift_name ?? "-"}</td>
                    <td style={td}>{r.note ?? "-"}</td>
                    <td style={td}>{r.operator_user_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    <td style={td}>{formatEasternTime(p.created_at)}</td>
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

      <div style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 42, marginBottom: 8 }}>Orders</h2>

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
              <div style={label}>Donation Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} style={input} />
            </div>

            <div style={{ width: 160 }}>
              <div style={label}>Paid amount</div>
              <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} style={input} />
            </div>

            <div style={{ width: 160 }}>
              <div style={label}>Payment Method</div>
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

            {Number(amount) > 5000 && (
              <div style={{ width: 160 }}>
                <div style={label}>Manual Credits</div>
                <input
                  value={manualCredits}
                  onChange={(e) => setManualCredits(e.target.value)}
                  placeholder="e.g. 200"
                  style={input}
                />
              </div>
            )}

            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={label}>Note</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} style={input} />
            </div>

            <button onClick={onCreateOrder} disabled={creatingOrder} style={btn}>
              {creatingOrder ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Phone</th>
                <th style={th}>Donation</th>
                <th style={th}>Paid</th>
                <th style={th}>Outstanding</th>
                <th style={th}>Method</th>
                <th style={th}>Credits Earned</th>
                <th style={th}>Created</th>
                <th style={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 16, color: "#666" }}>
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
                      <td style={td}>{o.payment_method ?? "-"}</td>
                      <td style={td}>
                        {o.points_earned}
                        {o.is_manual_tier && (
                          <span style={{ marginLeft: 6, color: "#888", fontSize: 12 }}>
                            (manual)
                          </span>
                        )}
                      </td>
                      <td style={td}>{formatEasternTime(o.created_at)}</td>
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

const summaryCard: React.CSSProperties = {
  minWidth: 180,
  padding: 14,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginBottom: 6,
};

const summaryValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
};
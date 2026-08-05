"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
type Counts = { orders: number; pendingOrders: number; successfulPayments: number; openRefunds: number };
type Order = { order_number: number; status: string; total: number | string; balance_due: number | string; created_at: string };
type Payment = { id: string; provider: string; status: string; amount: number | string; received_at: string | null; created_at: string };
type Refund = { id: string; status: string; amount: number | string; reason: string; check_number: string | null; quickbooks_reference: string | null; created_at: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function amount(value: number | string) {
  return money.format(Number(value));
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`finance-status finance-status-${value.replaceAll("_", "-")}`}>{label(value)}</span>;
}

export function FinanceOverview() {
  const [view, setView] = useState<ViewState>("loading");
  const [counts, setCounts] = useState<Counts>({ orders: 0, pendingOrders: 0, successfulPayments: 0, openRefunds: 0 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFinance() {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setView("signed-out");
        return;
      }

      const user = sessionData.session?.user;
      if (!user) {
        setView("signed-out");
        return;
      }

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        setError(aalError.message);
        setView("denied");
        return;
      }
      if (aal.currentLevel !== "aal2") {
        setView("mfa-required");
        return;
      }

      const { data: staffAccount, error: staffError } = await supabase
        .from("staff_accounts")
        .select("status")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (staffError || staffAccount?.status !== "active") {
        setError(staffError?.message ?? "An active staff account is required.");
        setView("denied");
        return;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("auth_user_id", user.id)
        .is("revoked_at", null);
      if (roleError) {
        setError(roleError.message);
        setView("denied");
        return;
      }

      const roles = roleRows?.map((row) => row.role) ?? [];
      if (roles.length === 0) {
        setView("denied");
        return;
      }

      const { data: permissionRows, error: permissionError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roles);
      if (permissionError || !permissionRows?.some((row) => row.permission === "finance.view")) {
        setError(permissionError?.message ?? "The Finance View permission is required.");
        setView("denied");
        return;
      }

      const [
        allOrders,
        pendingOrders,
        successfulPayments,
        openRefunds,
        recentOrders,
        recentPayments,
        recentRefunds,
      ] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "partially_paid"]),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded"),
        supabase.from("refund_adjustments").select("id", { count: "exact", head: true }).in("status", ["requested", "approved", "check_issued"]),
        supabase.from("orders").select("order_number,status,total,balance_due,created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("id,provider,status,amount,received_at,created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("refund_adjustments").select("id,status,amount,reason,check_number,quickbooks_reference,created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      if (!active) return;
      const firstError = [allOrders, pendingOrders, successfulPayments, openRefunds, recentOrders, recentPayments, recentRefunds].find((result) => result.error)?.error;
      if (firstError) {
        setError(firstError.message);
        setView("denied");
        return;
      }

      setCounts({
        orders: allOrders.count ?? 0,
        pendingOrders: pendingOrders.count ?? 0,
        successfulPayments: successfulPayments.count ?? 0,
        openRefunds: openRefunds.count ?? 0,
      });
      setOrders((recentOrders.data ?? []) as Order[]);
      setPayments((recentPayments.data ?? []) as Payment[]);
      setRefunds((recentRefunds.data ?? []) as Refund[]);
      setView("ready");
    }

    void loadFinance();
    return () => { active = false; };
  }, []);

  if (view === "loading") {
    return <div className="finance-panel finance-loading" aria-live="polite">Loading protected finance records…</div>;
  }

  if (view === "signed-out" || view === "mfa-required") {
    return (
      <section className="finance-panel finance-gate">
        <p className="eyebrow">Secure session required</p>
        <h2>{view === "mfa-required" ? "Complete staff MFA" : "Sign in through the staff portal"}</h2>
        <p>Finance data opens only after staff authentication and authenticator-app verification.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Link className="dark-button" href="/staff">Go to Staff Portal</Link>
      </section>
    );
  }

  if (view === "denied") {
    return (
      <section className="finance-panel finance-gate finance-denied">
        <p className="eyebrow">Access unavailable</p>
        <h2>Finance permission required</h2>
        <p>This account does not have active permission to view organization-wide financial records.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Link className="text-button" href="/staff">Return to Staff Portal</Link>
      </section>
    );
  }

  return (
    <div className="finance-workspace">
      <div className="finance-toolbar">
        <div>
          <p className="eyebrow">Protected by MFA and role permissions</p>
          <h2>Finance activity</h2>
        </div>
        <Link className="text-button" href="/staff">Back to Staff Portal</Link>
      </div>

      <aside className="finance-readonly-note">
        <strong>Read-only launch view.</strong> Payment, refund, void, and reconciliation actions remain disabled until staging and QuickBooks controls are approved.
      </aside>

      <section className="finance-metrics" aria-label="Finance record counts">
        <article><span>All orders</span><strong>{counts.orders}</strong></article>
        <article><span>Pending balances</span><strong>{counts.pendingOrders}</strong></article>
        <article><span>Successful payments</span><strong>{counts.successfulPayments}</strong></article>
        <article><span>Open check refunds</span><strong>{counts.openRefunds}</strong></article>
      </section>

      <FinanceTable title="Recent orders" empty="No orders have been recorded yet." headers={["Order", "Status", "Total", "Balance", "Created"]}>
        {orders.map((order) => (
          <tr key={order.order_number}>
            <td><strong>#{order.order_number}</strong></td>
            <td><StatusBadge value={order.status} /></td>
            <td>{amount(order.total)}</td>
            <td>{amount(order.balance_due)}</td>
            <td>{date.format(new Date(order.created_at))}</td>
          </tr>
        ))}
      </FinanceTable>

      <FinanceTable title="Recent payments" empty="No payments have been recorded yet." headers={["Provider", "Status", "Amount", "Received"]}>
        {payments.map((payment) => (
          <tr key={payment.id}>
            <td>{label(payment.provider)}</td>
            <td><StatusBadge value={payment.status} /></td>
            <td>{amount(payment.amount)}</td>
            <td>{date.format(new Date(payment.received_at ?? payment.created_at))}</td>
          </tr>
        ))}
      </FinanceTable>

      <FinanceTable title="Paper-check refunds" empty="No refund adjustments have been recorded yet." headers={["Status", "Amount", "Reason", "Check", "QuickBooks"]}>
        {refunds.map((refund) => (
          <tr key={refund.id}>
            <td><StatusBadge value={refund.status} /></td>
            <td>{amount(refund.amount)}</td>
            <td>{refund.reason}</td>
            <td>{refund.check_number ?? "—"}</td>
            <td>{refund.quickbooks_reference ?? "—"}</td>
          </tr>
        ))}
      </FinanceTable>
    </div>
  );
}

function FinanceTable({ title, empty, headers, children }: { title: string; empty: string; headers: string[]; children: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="finance-panel finance-table-card">
      <h3>{title}</h3>
      {hasRows ? (
        <div className="finance-table-scroll">
          <table>
            <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      ) : <p className="finance-empty">{empty}</p>}
    </section>
  );
}

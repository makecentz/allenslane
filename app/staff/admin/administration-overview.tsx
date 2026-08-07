"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { IntegrationSettings } from "./integration-settings";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
type StaffAccessRecord = {
  auth_user_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  status: string;
  mfa_required: boolean;
  last_reviewed_at: string | null;
  updated_at: string;
  active_roles: string[];
};
type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  reason: string | null;
};

const roleOptions = [
  "front_desk",
  "registrar",
  "instructor",
  "events_manager",
  "content_editor",
  "content_publisher",
  "development",
  "finance",
  "finance_approver",
  "reports_user",
  "support_admin",
  "system_admin",
] as const;

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "The access change could not be completed.";
}

async function fetchProtectedRecords(staffManagement: boolean, auditAccess: boolean) {
  const supabase = getSupabaseBrowserClient();
  const [staffResult, auditResult] = await Promise.all([
    staffManagement
      ? supabase.rpc("get_staff_access_register")
      : Promise.resolve({ data: [], error: null }),
    auditAccess
      ? supabase
          .from("audit_events")
          .select("id,occurred_at,actor_user_id,action,entity_table,entity_id,reason")
          .order("occurred_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = staffResult.error ?? auditResult.error;
  if (firstError) throw firstError;

  return {
    staff: (staffResult.data ?? []) as StaffAccessRecord[],
    audit: (auditResult.data ?? []) as AuditEvent[],
  };
}

export function AdministrationOverview() {
  const [view, setView] = useState<ViewState>("loading");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [staffAccounts, setStaffAccounts] = useState<StaffAccessRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [canManageIntegrations, setCanManageIntegrations] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [activationEmail, setActivationEmail] = useState("");
  const [activationRole, setActivationRole] = useState<string>("registrar");
  const [activationReason, setActivationReason] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("registrar");
  const [inviteReason, setInviteReason] = useState("");
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({});
  const [statusSelections, setStatusSelections] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadAdministration() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) {
        setError(userError?.message ?? "Sign in through the staff portal to continue.");
        setView("signed-out");
        return;
      }

      setCurrentUserId(userData.user.id);
      setCurrentUserEmail(userData.user.email ?? "");

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

      const { data: account, error: accountError } = await supabase
        .from("staff_accounts")
        .select("status")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (accountError || account?.status !== "active") {
        setError(accountError?.message ?? "An active staff account is required.");
        setView("denied");
        return;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("auth_user_id", userData.user.id)
        .is("revoked_at", null);
      if (roleError) {
        setError(roleError.message);
        setView("denied");
        return;
      }

      const roleNames = roleRows?.map((row) => row.role) ?? [];
      const { data: permissionRows, error: permissionError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roleNames);
      if (permissionError) {
        setError(permissionError.message);
        setView("denied");
        return;
      }

      const permissions = new Set(permissionRows?.map((row) => row.permission) ?? []);
      const staffManagement = permissions.has("staff.manage");
      const auditAccess = permissions.has("audit.view");
      const integrationManagement = permissions.has("integrations.manage");
      if (!staffManagement && !auditAccess && !integrationManagement) {
        setError("Staff Management, Audit View, or Integration Management permission is required.");
        setView("denied");
        return;
      }

      setCanManageStaff(staffManagement);
      setCanViewAudit(auditAccess);
      setCanManageIntegrations(integrationManagement);

      try {
        const records = await fetchProtectedRecords(staffManagement, auditAccess);
        if (!active) return;
        setStaffAccounts(records.staff);
        setAuditEvents(records.audit);
        setView("ready");
      } catch (recordsError) {
        setError(errorMessage(recordsError));
        setView("denied");
      }
    }

    void loadAdministration();
    return () => {
      active = false;
    };
  }, []);

  async function refreshRecords() {
    const records = await fetchProtectedRecords(canManageStaff, canViewAudit);
    setStaffAccounts(records.staff);
    setAuditEvents(records.audit);
  }

  async function runAction(actionKey: string, rpcName: string, args: Record<string, unknown>, successMessage: string) {
    setBusyAction(actionKey);
    setActionError("");
    setActionNotice("");
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc(rpcName, args);
      if (rpcError) throw rpcError;
      await refreshRecords();
      setActionNotice(successMessage);
      return true;
    } catch (rpcError) {
      setActionError(errorMessage(rpcError));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function activateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const succeeded = await runAction(
      "activate",
      "activate_existing_staff",
      { target_email: activationEmail, requested_role: activationRole, change_reason: activationReason },
      `${activationEmail} is now active staff with the ${label(activationRole)} role.`,
    );
    if (succeeded) {
      setActivationEmail("");
      setActivationReason("");
    }
  }

  async function inviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("invite");
    setActionError("");
    setActionNotice("");
    try {
      const { data, error: inviteError } = await getSupabaseBrowserClient().functions.invoke("invite-staff", {
        body: {
          firstName: inviteFirstName,
          lastName: inviteLastName,
          email: inviteEmail,
          role: inviteRole,
          reason: inviteReason,
        },
      });
      if (inviteError) {
        const context = (inviteError as { context?: Response }).context;
        if (context) {
          const payload = await context.clone().json().catch(() => null) as { error?: string } | null;
          if (payload?.error) throw new Error(payload.error);
        }
        throw inviteError;
      }
      await refreshRecords();
      setActionNotice(typeof data?.message === "string" ? data.message : `Invitation sent to ${inviteEmail}.`);
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInviteReason("");
    } catch (inviteError) {
      setActionError(errorMessage(inviteError));
    } finally {
      setBusyAction("");
    }
  }

  async function changeRole(authUserId: string, role: string, grantRole: boolean) {
    const reason = reasons[authUserId] ?? "";
    await runAction(
      `${grantRole ? "grant" : "revoke"}-${authUserId}-${role}`,
      "manage_staff_role",
      { target_auth_user_id: authUserId, requested_role: role, grant_role: grantRole, change_reason: reason },
      `${label(role)} was ${grantRole ? "granted" : "revoked"}.`,
    );
  }

  async function changeStatus(authUserId: string) {
    const status = statusSelections[authUserId] ?? "active";
    const reason = reasons[authUserId] ?? "";
    await runAction(
      `status-${authUserId}`,
      "set_staff_account_status",
      { target_auth_user_id: authUserId, new_status: status, change_reason: reason },
      `Staff status was changed to ${label(status)}.`,
    );
  }

  if (view === "loading") {
    return <div className="admin-panel admin-loading" aria-live="polite">Loading protected administration records…</div>;
  }

  if (view !== "ready") {
    const messages = {
      "signed-out": ["Staff sign-in required", "Sign in through the staff portal before opening administration records."],
      "mfa-required": ["Authenticator verification required", "Complete the second verification step in the staff portal, then return here."],
      denied: ["Administration overview unavailable", error || "Your current staff role does not include administration access."],
    } as const;
    const [title, message] = messages[view];
    return (
      <section className={`admin-panel admin-gate${view === "denied" ? " admin-denied" : ""}`}>
        <p className="eyebrow">Protected records</p>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="dark-button" href="/staff">Return to staff portal</Link>
      </section>
    );
  }

  const activeStaff = staffAccounts.filter((account) => account.status === "active").length;
  const suspendedStaff = staffAccounts.filter((account) => account.status === "suspended" || account.status === "disabled").length;
  const activeRoleCount = staffAccounts.reduce((total, account) => total + account.active_roles.length, 0);

  return (
    <div className="admin-workspace">
      <section className="admin-panel admin-toolbar">
        <div>
          <p className="eyebrow">MFA verified / Least privilege</p>
          <h2>Access, integrations, and audit administration</h2>
        </div>
        <Link className="text-button" href="/staff">Back to staff portal</Link>
      </section>

      <p className="admin-readonly-note"><strong>Controlled access:</strong> Every staff-access change requires an audit reason. Finance roles require Finance Approver authority, and recovery-critical access cannot be removed from the last active System Administrator.</p>

      {actionError && <p className="form-error admin-action-message" role="alert">{actionError}</p>}
      {actionNotice && <p className="form-notice admin-action-message" role="status">{actionNotice}</p>}

      <section className="admin-metrics" aria-label="Administration summary">
        <article><span>Staff accounts</span><strong>{staffAccounts.length}</strong></article>
        <article><span>Active staff</span><strong>{activeStaff}</strong></article>
        <article><span>Suspended / disabled</span><strong>{suspendedStaff}</strong></article>
        <article><span>Active role grants</span><strong>{activeRoleCount}</strong></article>
      </section>

      {canManageIntegrations ? <IntegrationSettings /> : null}

      {canManageStaff && (
        <section className="admin-panel admin-activation-card">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Transactional Email</p><h3>Invite a new staff member</h3></div>
            <span>Invitation + initial access</span>
          </div>
          <p className="admin-helper">The recipient will choose a password from the invitation link and must enroll an authenticator app before opening staff tools.</p>
          <form className="admin-invitation-form" onSubmit={inviteStaff}>
            <label>First name<input required value={inviteFirstName} onChange={(event) => setInviteFirstName(event.target.value)} /></label>
            <label>Last name<input required value={inviteLastName} onChange={(event) => setInviteLastName(event.target.value)} /></label>
            <label>Email address<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@allenslane.org" /></label>
            <label>Initial role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{roleOptions.map((role) => <option key={role} value={role}>{label(role)}</option>)}</select></label>
            <label className="admin-reason-field">Audit reason<input required minLength={10} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} placeholder="At least 10 characters" /></label>
            <button className="dark-button" type="submit" disabled={busyAction !== ""}>{busyAction === "invite" ? "Sending…" : "Send staff invitation"}</button>
          </form>
        </section>
      )}

      {canManageStaff && (
        <section className="admin-panel admin-activation-card">
          <div className="admin-section-heading">
            <div><p className="eyebrow">Staff Management</p><h3>Activate an existing account</h3></div>
            <span>Account must already be registered</span>
          </div>
          <p className="admin-helper">Use this when the person already has an Allens Lane customer account and does not need a new invitation.</p>
          <form className="admin-activation-form" onSubmit={activateStaff}>
            <label>Email address<input type="email" required value={activationEmail} onChange={(event) => setActivationEmail(event.target.value)} placeholder="name@allenslane.org" /></label>
            <label>Initial role<select value={activationRole} onChange={(event) => setActivationRole(event.target.value)}>{roleOptions.map((role) => <option key={role} value={role}>{label(role)}</option>)}</select></label>
            <label className="admin-reason-field">Audit reason<input required minLength={10} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} placeholder="At least 10 characters" /></label>
            <button className="dark-button" type="submit" disabled={busyAction !== ""}>{busyAction === "activate" ? "Activating…" : "Activate staff account"}</button>
          </form>
        </section>
      )}

      {canManageStaff && (
        <section className="admin-panel admin-table-card">
          <div className="admin-section-heading"><div><p className="eyebrow">Staff Management</p><h3>Staff access register</h3></div><span>{staffAccounts.length} accounts</span></div>
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>Staff account</th><th>Status</th><th>Assigned roles</th><th>MFA</th><th>Last review</th><th>Access controls</th></tr></thead>
              <tbody>
                {staffAccounts.map((account) => {
                  const name = `${account.preferred_name || account.first_name} ${account.last_name}`;
                  const selectedRole = roleSelections[account.auth_user_id] ?? "registrar";
                  const selectedStatus = statusSelections[account.auth_user_id] ?? account.status;
                  const reason = reasons[account.auth_user_id] ?? "";
                  return (
                    <tr key={account.auth_user_id}>
                      <td><strong>{name}</strong><small>{account.email || (account.auth_user_id === currentUserId ? currentUserEmail : shortId(account.auth_user_id))}</small>{account.auth_user_id === currentUserId && <small>Current account</small>}</td>
                      <td><span className={`admin-status admin-status-${account.status}`}>{label(account.status)}</span></td>
                      <td><div className="admin-role-list">{account.active_roles.map((role) => <span key={role}>{label(role)}</span>)}</div></td>
                      <td><span className="admin-security-state">{account.mfa_required ? "Required" : "Not required"}</span></td>
                      <td>{account.last_reviewed_at ? dateTime.format(new Date(account.last_reviewed_at)) : <span className="admin-muted">Not recorded</span>}</td>
                      <td>
                        <details className="admin-access-controls">
                          <summary>Manage access</summary>
                          <label>Audit reason<input required minLength={10} value={reason} onChange={(event) => setReasons((current) => ({ ...current, [account.auth_user_id]: event.target.value }))} placeholder="At least 10 characters" /></label>
                          <div className="admin-control-row">
                            <select aria-label={`Role for ${name}`} value={selectedRole} onChange={(event) => setRoleSelections((current) => ({ ...current, [account.auth_user_id]: event.target.value }))}>{roleOptions.map((role) => <option key={role} value={role}>{label(role)}</option>)}</select>
                            <button type="button" disabled={busyAction !== "" || reason.trim().length < 10 || account.active_roles.includes(selectedRole)} onClick={() => void changeRole(account.auth_user_id, selectedRole, true)}>Grant</button>
                          </div>
                          {account.active_roles.length > 0 && <div className="admin-revoke-list">{account.active_roles.map((role) => <button type="button" key={role} disabled={busyAction !== "" || reason.trim().length < 10} onClick={() => void changeRole(account.auth_user_id, role, false)}>Revoke {label(role)}</button>)}</div>}
                          <div className="admin-control-row">
                            <select aria-label={`Status for ${name}`} value={selectedStatus} onChange={(event) => setStatusSelections((current) => ({ ...current, [account.auth_user_id]: event.target.value }))}><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select>
                            <button type="button" disabled={busyAction !== "" || reason.trim().length < 10 || selectedStatus === account.status} onClick={() => void changeStatus(account.auth_user_id)}>Update status</button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {staffAccounts.length === 0 && <p className="admin-empty">No staff accounts are visible to this role.</p>}
        </section>
      )}

      {canViewAudit && (
        <section className="admin-panel admin-table-card">
          <div className="admin-section-heading"><div><p className="eyebrow">Audit View</p><h3>Recent privileged activity</h3></div><span>Latest {auditEvents.length}</span></div>
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>When</th><th>Action</th><th>Record</th><th>Actor</th><th>Reason</th></tr></thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{dateTime.format(new Date(event.occurred_at))}</td>
                    <td><strong>{label(event.action)}</strong></td>
                    <td>{label(event.entity_table)}{event.entity_id && <small>{shortId(event.entity_id)}</small>}</td>
                    <td>{event.actor_user_id ? event.actor_user_id === currentUserId ? "Current account" : shortId(event.actor_user_id) : "System"}</td>
                    <td>{event.reason || <span className="admin-muted">Not supplied</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditEvents.length === 0 && <p className="admin-empty">No privileged audit events have been recorded yet.</p>}
        </section>
      )}
    </div>
  );
}

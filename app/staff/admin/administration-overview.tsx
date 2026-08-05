"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
type StaffAccount = {
  auth_user_id: string;
  person_id: string;
  status: string;
  mfa_required: boolean;
  last_reviewed_at: string | null;
  updated_at: string;
};
type RoleAssignment = {
  auth_user_id: string;
  role: string;
  granted_at: string;
  revoked_at: string | null;
  reason: string;
};
type Person = { auth_user_id: string | null; first_name: string; last_name: string; preferred_name: string | null; email: string | null };
type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  reason: string | null;
};

const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function AdministrationOverview() {
  const [view, setView] = useState<ViewState>("loading");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [error, setError] = useState("");

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
      if (!staffManagement && !auditAccess) {
        setError("Staff Management or Audit View permission is required.");
        setView("denied");
        return;
      }
      setCanManageStaff(staffManagement);
      setCanViewAudit(auditAccess);

      const [staffResult, assignmentsResult, auditResult] = await Promise.all([
        staffManagement
          ? supabase.from("staff_accounts").select("auth_user_id,person_id,status,mfa_required,last_reviewed_at,updated_at").order("updated_at", { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
        staffManagement
          ? supabase.from("user_roles").select("auth_user_id,role,granted_at,revoked_at,reason").order("granted_at", { ascending: false }).limit(300)
          : Promise.resolve({ data: [], error: null }),
        auditAccess
          ? supabase.from("audit_events").select("id,occurred_at,actor_user_id,action,entity_table,entity_id,reason").order("occurred_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = [staffResult, assignmentsResult, auditResult].find((result) => result.error)?.error;
      if (firstError) {
        setError(firstError.message);
        setView("denied");
        return;
      }

      const staffRows = (staffResult.data ?? []) as StaffAccount[];
      let personRows: Person[] = [];
      if (staffRows.length > 0) {
        const { data, error: peopleError } = await supabase
          .from("people")
          .select("auth_user_id,first_name,last_name,preferred_name,email")
          .in("auth_user_id", staffRows.map((item) => item.auth_user_id));
        if (peopleError) {
          setError(peopleError.message);
          setView("denied");
          return;
        }
        personRows = (data ?? []) as Person[];
      }

      if (!active) return;
      setStaffAccounts(staffRows);
      setRoles((assignmentsResult.data ?? []) as RoleAssignment[]);
      setPeople(personRows);
      setAuditEvents((auditResult.data ?? []) as AuditEvent[]);
      setView("ready");
    }

    void loadAdministration();
    return () => { active = false; };
  }, []);

  const activeRolesByUser = useMemo(() => {
    const result = new Map<string, RoleAssignment[]>();
    for (const role of roles.filter((assignment) => !assignment.revoked_at)) {
      const current = result.get(role.auth_user_id) ?? [];
      current.push(role);
      result.set(role.auth_user_id, current);
    }
    return result;
  }, [roles]);

  const peopleByAuthId = useMemo(() => new Map(people.filter((person) => person.auth_user_id).map((person) => [person.auth_user_id as string, person])), [people]);

  if (view === "loading") return <div className="admin-panel admin-loading" aria-live="polite">Loading protected administration records…</div>;

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
  const pendingStaff = staffAccounts.filter((account) => account.status === "invited").length;
  const activeRoleCount = roles.filter((role) => !role.revoked_at).length;

  return (
    <div className="admin-workspace">
      <section className="admin-panel admin-toolbar">
        <div>
          <p className="eyebrow">MFA verified / Least privilege</p>
          <h2>Access and audit overview</h2>
        </div>
        <Link className="text-button" href="/staff">Back to staff portal</Link>
      </section>

      <p className="admin-readonly-note"><strong>Review mode:</strong> This release does not change staff access. Invitations, role grants, suspensions, and financial-role changes remain controlled administration procedures.</p>

      <section className="admin-metrics" aria-label="Administration summary">
        <article><span>Staff accounts</span><strong>{staffAccounts.length}</strong></article>
        <article><span>Active staff</span><strong>{activeStaff}</strong></article>
        <article><span>Invited staff</span><strong>{pendingStaff}</strong></article>
        <article><span>Active role grants</span><strong>{activeRoleCount}</strong></article>
      </section>

      {canManageStaff && (
        <section className="admin-panel admin-table-card">
          <div className="admin-section-heading"><div><p className="eyebrow">Staff Management</p><h3>Staff access register</h3></div><span>{staffAccounts.length} accounts</span></div>
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>Staff account</th><th>Status</th><th>Assigned roles</th><th>MFA</th><th>Last review</th></tr></thead>
              <tbody>
                {staffAccounts.map((account) => {
                  const person = peopleByAuthId.get(account.auth_user_id);
                  const name = person ? `${person.preferred_name || person.first_name} ${person.last_name}` : account.auth_user_id === currentUserId ? currentUserEmail : `Staff ${shortId(account.auth_user_id)}`;
                  return (
                    <tr key={account.auth_user_id}>
                      <td><strong>{name}</strong><small>{account.auth_user_id === currentUserId ? "Current account" : shortId(account.auth_user_id)}</small></td>
                      <td><span className={`admin-status admin-status-${account.status}`}>{label(account.status)}</span></td>
                      <td><div className="admin-role-list">{(activeRolesByUser.get(account.auth_user_id) ?? []).map((assignment) => <span key={assignment.role}>{label(assignment.role)}</span>)}</div></td>
                      <td><span className="admin-security-state">{account.mfa_required ? "Required" : "Not required"}</span></td>
                      <td>{account.last_reviewed_at ? dateTime.format(new Date(account.last_reviewed_at)) : <span className="admin-muted">Not recorded</span>}</td>
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

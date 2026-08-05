"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

type PortalStage = "loading" | "signed-out" | "checking" | "denied" | "enroll" | "challenge" | "ready";
type Enrollment = { factorId: string; qrCode: string; secret: string };
type StaffAccount = { status: string };
type RoleRow = { role: string };
type PermissionRow = { permission: string };

const modules = [
  { name: "People & households", description: "Customer profiles, relationships, and support records.", prefixes: ["people.", "minors."], href: "/staff/people", linkLabel: "Open people directory" },
  { name: "Programs & registration", description: "Catalog, classes, rosters, registrations, and waitlists.", prefixes: ["catalog.", "registrations.", "rosters."] },
  { name: "Content & events", description: "Public content, publishing, events, and retained ticketing links.", prefixes: ["content.", "events."] },
  { name: "Finance & development", description: "Payments, reconciliation, memberships, gifts, and reporting.", prefixes: ["finance.", "development.", "reports.", "commerce."], href: "/staff/finance", linkLabel: "Open finance overview" },
  { name: "Administration", description: "Staff access, audit history, and controlled migration tools.", prefixes: ["staff.", "audit.", "migration."] },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StaffPortal() {
  const [stage, setStage] = useState<PortalStage>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [staffStatus, setStaffStatus] = useState("");
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadAccess = useCallback(async (currentUser: User) => {
    const supabase = getSupabaseBrowserClient();
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("auth_user_id", currentUser.id)
      .is("revoked_at", null);

    if (roleError) throw roleError;

    const roleNames = (roleData as RoleRow[] | null)?.map((row) => row.role) ?? [];
    if (roleNames.length === 0) {
      setStaffStatus("no active role");
      setStage("denied");
      return;
    }

    const { data: permissionData, error: permissionError } = await supabase
      .from("role_permissions")
      .select("permission")
      .in("role", roleNames);

    if (permissionError) throw permissionError;

    setRoles(roleNames);
    setPermissions(Array.from(new Set((permissionData as PermissionRow[] | null)?.map((row) => row.permission) ?? [])).sort());
    setStage("ready");
  }, []);

  const evaluateStaff = useCallback(async (currentUser: User) => {
    const supabase = getSupabaseBrowserClient();
    setStage("checking");
    setError("");

    try {
      const { data: staffData, error: staffError } = await supabase
        .from("staff_accounts")
        .select("status")
        .eq("auth_user_id", currentUser.id)
        .maybeSingle();

      if (staffError) throw staffError;
      const account = staffData as StaffAccount | null;

      if (!account) {
        setStaffStatus("not authorized");
        setStage("denied");
        return;
      }

      if (account.status !== "active") {
        setStaffStatus(account.status);
        setStage("denied");
        return;
      }

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      if (aal.currentLevel === "aal2") {
        await loadAccess(currentUser);
        return;
      }

      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const verifiedFactor = factorData.totp.find((factor) => factor.status === "verified");

      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setStage("challenge");
      } else {
        setStage("enroll");
      }
    } catch (staffError) {
      setError(errorMessage(staffError));
      setStage("denied");
    }
  }, [loadAccess]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setStage("signed-out");
        return;
      }

      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) void evaluateStaff(sessionUser);
      else setStage("signed-out");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRoles([]);
        setPermissions([]);
        setEnrollment(null);
        setStage("signed-out");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [evaluateStaff]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const { data, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("The sign-in session could not be created.");
      setUser(data.user);
      await evaluateStaff(data.user);
    } catch (signInError) {
      setError(errorMessage(signInError));
      setStage("signed-out");
    } finally {
      setSubmitting(false);
    }
  }

  async function beginEnrollment() {
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      for (const factor of factors.totp.filter((item) => item.status === "unverified")) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }

      const { data, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Allens Lane staff",
      });
      if (enrollmentError) throw enrollmentError;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (enrollmentError) {
      setError(errorMessage(enrollmentError));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyFactor(event: FormEvent<HTMLFormElement>, enrollmentFactor = false) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const selectedFactor = enrollmentFactor ? enrollment?.factorId : factorId;
    if (!selectedFactor) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: selectedFactor, code });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      setNotice("Authenticator verified. Secure staff access is active.");
      setEnrollment(null);
      if (user) await evaluateStaff(user);
    } catch (verifyError) {
      setError(errorMessage(verifyError));
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    setError("");
    const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
    if (signOutError) setError(signOutError.message);
    setSubmitting(false);
  }

  if (stage === "loading" || stage === "checking") {
    return <div className="staff-card staff-loading" aria-live="polite">Checking secure staff access…</div>;
  }

  if (stage === "signed-out") {
    return (
      <section className="staff-card">
        <p className="eyebrow">Authorized staff only</p>
        <form className="auth-form" onSubmit={signIn}>
          <h2>Sign in to staff tools</h2>
          <p>Use the email and password connected to your approved staff account.</p>
          <label>Email address<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Continue securely"}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    );
  }

  if (stage === "denied") {
    return (
      <section className="staff-card staff-denied">
        <p className="eyebrow">Access unavailable</p>
        <h2>This account cannot open staff tools</h2>
        <p>Account status: <strong>{formatLabel(staffStatus || "verification failed")}</strong></p>
        <p>Staff access must be activated and assigned an approved role by an administrator.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="text-button" type="button" onClick={signOut} disabled={submitting}>Sign out</button>
      </section>
    );
  }

  if (stage === "enroll") {
    return (
      <section className="staff-card mfa-card">
        <p className="eyebrow">Required security setup</p>
        <h2>Connect an authenticator app</h2>
        <p>All staff members must use a time-based code from an authenticator app before opening staff records.</p>
        {!enrollment ? (
          <button className="dark-button staff-primary-action" type="button" onClick={beginEnrollment} disabled={submitting}>
            {submitting ? "Preparing setup…" : "Start authenticator setup"}
          </button>
        ) : (
          <div className="mfa-enrollment">
            <Image className="mfa-qr" src={enrollment.qrCode} alt="Authenticator setup QR code" width={280} height={280} unoptimized />
            <div>
              <h3>1. Scan the code</h3>
              <p>Use Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP app.</p>
              <details>
                <summary>Can’t scan the QR code?</summary>
                <p>Enter this setup key manually:</p>
                <code>{enrollment.secret}</code>
              </details>
              <form className="auth-form mfa-code-form" onSubmit={(event) => verifyFactor(event, true)}>
                <h3>2. Verify the six-digit code</h3>
                <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
                <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Enable staff MFA"}</button>
              </form>
            </div>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="text-button" type="button" onClick={signOut} disabled={submitting}>Sign out</button>
      </section>
    );
  }

  if (stage === "challenge") {
    return (
      <section className="staff-card mfa-card">
        <p className="eyebrow">Second verification step</p>
        <form className="auth-form" onSubmit={(event) => verifyFactor(event)}>
          <h2>Enter your authenticator code</h2>
          <p>Open your authenticator app and enter the current six-digit code for Allens Lane staff.</p>
          <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Verify and open portal"}</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="text-button" type="button" onClick={signOut} disabled={submitting}>Sign out</button>
      </section>
    );
  }

  const availableModules = modules.filter((module) => module.prefixes.some((prefix) => permissions.some((permission) => permission.startsWith(prefix))));

  return (
    <section className="staff-card staff-dashboard">
      <div className="staff-dashboard-header">
        <div>
          <p className="eyebrow">MFA verified</p>
          <h2>Welcome to staff operations</h2>
          <p>{user?.email}</p>
        </div>
        <button className="text-button" type="button" onClick={signOut} disabled={submitting}>Sign out</button>
      </div>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="staff-access-summary">
        <div><span>Security</span><strong>AAL2 verified</strong></div>
        <div><span>Active roles</span><strong>{roles.length}</strong></div>
        <div><span>Permissions</span><strong>{permissions.length}</strong></div>
      </div>
      <div className="staff-role-list">
        <h3>Your assigned roles</h3>
        <div>{roles.map((role) => <span key={role}>{formatLabel(role)}</span>)}</div>
      </div>
      <div className="staff-module-grid">
        {availableModules.map((module) => (
          <article key={module.name}>
            <span className="module-status">Permission enabled</span>
            <h3>{module.name}</h3>
            <p>{module.description}</p>
            {module.href ? <Link className="module-link" href={module.href}>{module.linkLabel}</Link> : <small>Operational screens will be activated module by module.</small>}
          </article>
        ))}
      </div>
      {availableModules.length === 0 && <p className="staff-empty">Your role is active, but it does not yet map to a staff module in this release.</p>}
      <details className="permission-details">
        <summary>View permission details</summary>
        <ul>{permissions.map((permission) => <li key={permission}><code>{permission}</code></li>)}</ul>
      </details>
    </section>
  );
}

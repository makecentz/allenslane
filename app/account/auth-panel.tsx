"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { HouseholdManager } from "./household-manager";

type Mode = "sign-in" | "sign-up" | "forgot" | "recovery" | "invite";
type Profile = { first_name: string; last_name: string; preferred_name: string | null };

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const initializedUserId = useRef<string | null>(null);
  const authUserId = user?.id ?? null;
  const firstName = user?.user_metadata?.first_name ? String(user.user_metadata.first_name) : "";
  const lastName = user?.user_metadata?.last_name ? String(user.user_metadata.last_name) : "";
  const preferredName = user?.user_metadata?.preferred_name ? String(user.user_metadata.preferred_name) : "";
  const phone = user?.user_metadata?.phone ? String(user.user_metadata.phone) : "";
  const householdName = user?.user_metadata?.household_name ? String(user.user_metadata.household_name) : "";

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const parameters = new URLSearchParams(window.location.search);
      if (parameters.has("invite")) setMode("invite");
      else if (parameters.has("recovery")) setMode("recovery");
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
      if (event === "SIGNED_OUT") {
        initializedUserId.current = null;
        setProfile(null);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUserId || initializedUserId.current === authUserId) return;
    initializedUserId.current = authUserId;

    const supabase = getSupabaseBrowserClient();

    async function initializeAndLoadProfile() {
      if (firstName && lastName) {
        const { error: onboardingError } = await supabase.rpc("complete_customer_onboarding", {
          first_name: firstName,
          last_name: lastName,
          preferred_name: preferredName || null,
          phone: phone || null,
          household_name: householdName || null,
        });

        if (onboardingError) {
          setError("You are signed in, but we could not finish setting up your household. Please contact the Art Center.");
        } else if (preferredName || phone || householdName) {
          await supabase.auth.updateUser({
            data: {
              first_name: firstName,
              last_name: lastName,
              preferred_name: null,
              phone: null,
              household_name: null,
            },
          });
        }
      }

      const { data, error: profileError } = await supabase
        .from("people")
        .select("first_name,last_name,preferred_name")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!profileError && data) setProfile(data as Profile);
    }

    void initializeAndLoadProfile();
  }, [authUserId, firstName, lastName, preferredName, phone, householdName]);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setNotice("");
    setError("");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setNotice("");

    const { data, error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    if (signInError) setError(signInError.message);
    else {
      setUser(data.user);
      setNotice("Welcome back. Your account is ready.");
    }
    setSubmitting(false);
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");

    setError("");
    setNotice("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    const firstName = String(form.get("first_name") ?? "").trim();
    const lastName = String(form.get("last_name") ?? "").trim();
    const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
      email: String(form.get("email") ?? "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/account?confirmed=1`,
        data: {
          first_name: firstName,
          last_name: lastName,
          preferred_name: String(form.get("preferred_name") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          household_name: String(form.get("household_name") ?? "").trim() || `${lastName} Household`,
        },
      },
    });

    if (signUpError) setError(signUpError.message);
    else if (data.session) {
      setUser(data.user);
      setNotice("Your account has been created.");
    } else {
      setNotice("Check your email for a confirmation link, then return here to sign in.");
      setMode("sign-in");
    }
    setSubmitting(false);
  }

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setNotice("");

    const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
      String(form.get("email") ?? "").trim(),
      { redirectTo: `${window.location.origin}/account?recovery=1` },
    );

    if (resetError) setError(resetError.message);
    else setNotice("If an account exists for that email, a password-reset link is on the way.");
    setSubmitting(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");

    setError("");
    setNotice("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setNotice(mode === "invite" ? "Your staff password is ready. Continue to the staff portal to enroll your authenticator app." : "Your password has been updated.");
      setMode("sign-in");
    }
    setSubmitting(false);
  }

  async function signOut() {
    setSubmitting(true);
    setError("");
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      setNotice("You have been signed out.");
    } catch (signOutError) {
      setError(messageFrom(signOutError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="auth-card auth-loading" aria-live="polite">Loading your account…</div>;
  }

  if (user && mode !== "recovery" && mode !== "invite") {
    const displayName = profile?.preferred_name || profile?.first_name || user.email?.split("@")[0] || "there";
    return (
      <section className="auth-card account-summary">
        <p className="eyebrow">Signed in</p>
        <h2>Welcome, {displayName}</h2>
        <p className="account-email">{user.email}</p>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <HouseholdManager userId={user.id} />
        <button className="text-button" type="button" onClick={signOut} disabled={submitting}>Sign out</button>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs" aria-label="Account options">
        <button type="button" className={mode === "sign-in" ? "active" : ""} onClick={() => selectMode("sign-in")}>Sign in</button>
        <button type="button" className={mode === "sign-up" ? "active" : ""} onClick={() => selectMode("sign-up")}>Create account</button>
      </div>

      {mode === "sign-in" && (
        <form className="auth-form" onSubmit={signIn}>
          <h2>Welcome back</h2>
          <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
          <button className="text-button" type="button" onClick={() => selectMode("forgot")}>Forgot your password?</button>
        </form>
      )}

      {mode === "sign-up" && (
        <form className="auth-form" onSubmit={signUp}>
          <h2>Create your account</h2>
          <div className="form-row">
            <label>First name<input name="first_name" autoComplete="given-name" required /></label>
            <label>Last name<input name="last_name" autoComplete="family-name" required /></label>
          </div>
          <div className="form-row">
            <label>Preferred name <span>(optional)</span><input name="preferred_name" autoComplete="nickname" /></label>
            <label>Phone <span>(optional)</span><input type="tel" name="phone" autoComplete="tel" /></label>
          </div>
          <label>Household name <span>(optional)</span><input name="household_name" /></label>
          <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
          <label>Password<input type="password" name="password" autoComplete="new-password" minLength={12} required /><small>Use at least 12 characters.</small></label>
          <label>Confirm password<input type="password" name="password_confirmation" autoComplete="new-password" minLength={12} required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
        </form>
      )}

      {mode === "forgot" && (
        <form className="auth-form" onSubmit={requestReset}>
          <h2>Reset your password</h2>
          <p>Enter your email and we’ll send a secure reset link.</p>
          <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</button>
          <button className="text-button" type="button" onClick={() => selectMode("sign-in")}>Back to sign in</button>
        </form>
      )}

      {mode === "recovery" && (
        <form className="auth-form" onSubmit={updatePassword}>
          <h2>Choose a new password</h2>
          <label>New password<input type="password" name="password" autoComplete="new-password" minLength={12} required /></label>
          <label>Confirm new password<input type="password" name="password_confirmation" autoComplete="new-password" minLength={12} required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
        </form>
      )}

      {mode === "invite" && (
        <form className="auth-form" onSubmit={updatePassword}>
          <h2>Create your staff password</h2>
          <p>Choose a secure password to accept your invitation. Staff access will also require an authenticator app.</p>
          <label>New password<input type="password" name="password" autoComplete="new-password" minLength={12} required /></label>
          <label>Confirm new password<input type="password" name="password_confirmation" autoComplete="new-password" minLength={12} required /></label>
          <button className="dark-button" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Create password"}</button>
        </form>
      )}

      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

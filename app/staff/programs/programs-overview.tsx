"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { CatalogEditor } from "./catalog-editor";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
export type Program = { id: string; parent_id: string | null; code: string; name: string; description: string | null; audience: string | null; status: string; display_order: number };
export type Term = { id: string; code: string; name: string; starts_on: string; ends_on: string; registration_opens_at: string | null; registration_closes_at: string | null; status: string };
export type Facility = { id: string; code: string; name: string; address_text: string | null; capacity: number | null; status: string };
export type ClassRow = {
  id: string;
  program_id: string;
  term_id: string;
  facility_id: string | null;
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  level: string | null;
  age_min: number | string | null;
  age_max: number | string | null;
  status: string;
  capacity: number;
  minimum_enrollment: number;
  price: number | string;
  member_price: number | string | null;
  fee: number | string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  image_path: string | null;
  image_alt: string | null;
  gl_account_code: string | null;
  checkout_mode: "internal" | "external";
  external_registration_url: string | null;
  instructor_display_text: string | null;
  source_schedule_text: string | null;
  source_location_text: string | null;
  source_registration_status: "open" | "waitlist" | "full" | "closed" | null;
  updated_at: string;
};
type Registration = { class_id: string; status: string };
type WaitlistEntry = { class_id: string; status: string };
type ClassSummary = ClassRow & {
  programName: string;
  termName: string;
  facilityName: string;
  enrolled: number;
  waiting: number;
};

const allowedPermissions = new Set([
  "catalog.manage",
  "catalog.publish",
  "registrations.manage",
  "rosters.view",
  "rosters.assigned",
]);

const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function countByClass<T extends { class_id: string; status: string }>(rows: T[], activeStatuses: Set<string>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!activeStatuses.has(row.status)) continue;
    counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
  }
  return counts;
}

export function ProgramsOverview() {
  const [view, setView] = useState<ViewState>("loading");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPrograms() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) {
        setError(userError?.message ?? "Sign in through the staff portal to continue.");
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
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();
      if (staffError || staffAccount?.status !== "active") {
        setError(staffError?.message ?? "An active staff account is required.");
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

      const roles = roleRows?.map((row) => row.role) ?? [];
      if (roles.length === 0) {
        setError("A Programs, Registration, or Roster permission is required.");
        setView("denied");
        return;
      }

      const { data: permissionRows, error: permissionError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roles);
      const canViewPrograms = permissionRows?.some((row) => allowedPermissions.has(row.permission));
      if (permissionError || !canViewPrograms) {
        setError(permissionError?.message ?? "A Programs, Registration, or Roster permission is required.");
        setView("denied");
        return;
      }
      setPermissions(permissionRows?.map((row) => row.permission) ?? []);

      const [programResult, termResult, facilityResult, classResult, registrationResult, waitlistResult] = await Promise.all([
        supabase.from("programs").select("id,parent_id,code,name,description,audience,status,display_order").order("name").limit(250),
        supabase.from("terms").select("id,code,name,starts_on,ends_on,registration_opens_at,registration_closes_at,status").order("starts_on", { ascending: false }).limit(100),
        supabase.from("facilities").select("id,code,name,address_text,capacity,status").order("name").limit(100),
        supabase.from("classes").select("id,program_id,term_id,facility_id,code,slug,title,summary,description,level,age_min,age_max,status,capacity,minimum_enrollment,price,member_price,fee,registration_opens_at,registration_closes_at,starts_at,ends_at,timezone,image_path,image_alt,gl_account_code,checkout_mode,external_registration_url,instructor_display_text,source_schedule_text,source_location_text,source_registration_status,updated_at").order("updated_at", { ascending: false }).limit(250),
        supabase.from("registrations").select("class_id,status").limit(5000),
        supabase.from("waitlist_entries").select("class_id,status").limit(5000),
      ]);

      if (!active) return;
      const firstError = [programResult, termResult, facilityResult, classResult, registrationResult, waitlistResult]
        .find((result) => result.error)?.error;
      if (firstError) {
        setError(firstError.message);
        setView("denied");
        return;
      }

      setPrograms((programResult.data ?? []) as Program[]);
      setTerms((termResult.data ?? []) as Term[]);
      setFacilities((facilityResult.data ?? []) as Facility[]);
      setClasses((classResult.data ?? []) as ClassRow[]);
      setRegistrations((registrationResult.data ?? []) as Registration[]);
      setWaitlist((waitlistResult.data ?? []) as WaitlistEntry[]);
      setView("ready");
    }

    void loadPrograms();
    return () => { active = false; };
  }, [refreshKey]);

  const summaries = useMemo(() => {
    const programById = new Map(programs.map((program) => [program.id, program.name]));
    const termById = new Map(terms.map((term) => [term.id, term.name]));
    const facilityById = new Map(facilities.map((facility) => [facility.id, facility.name]));
    const enrolledByClass = countByClass(registrations, new Set(["pending", "registered"]));
    const waitingByClass = countByClass(waitlist, new Set(["waiting", "offered"]));

    return classes.map((classRow): ClassSummary => ({
      ...classRow,
      programName: programById.get(classRow.program_id) ?? "Program unavailable",
      termName: termById.get(classRow.term_id) ?? "Term unavailable",
      facilityName: classRow.facility_id ? facilityById.get(classRow.facility_id) ?? "Facility unavailable" : "Not assigned",
      enrolled: enrolledByClass.get(classRow.id) ?? 0,
      waiting: waitingByClass.get(classRow.id) ?? 0,
    }));
  }, [classes, facilities, programs, registrations, terms, waitlist]);

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return summaries.filter((classRow) => {
      const matchesStatus = status === "all" || classRow.status === status;
      const matchesQuery = !normalized || [
        classRow.code,
        classRow.title,
        classRow.programName,
        classRow.termName,
        classRow.facilityName,
        classRow.instructor_display_text ?? "",
      ].some((value) => value.toLowerCase().includes(normalized));
      return matchesStatus && matchesQuery;
    });
  }, [query, status, summaries]);

  if (view === "loading") return <div className="programs-panel programs-loading" aria-live="polite">Loading protected program records…</div>;

  if (view !== "ready") {
    const messages = {
      "signed-out": ["Staff sign-in required", "Sign in through the staff portal before opening program records."],
      "mfa-required": ["Authenticator verification required", "Complete the second verification step in the staff portal, then return here."],
      denied: ["Programs workspace unavailable", error || "Your current staff role does not include Programs, Registration, or Roster access."],
    } as const;
    const [title, message] = messages[view];
    return (
      <section className={`programs-panel programs-gate${view === "denied" ? " programs-denied" : ""}`}>
        <p className="eyebrow">Protected operations</p>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="dark-button" href="/staff">Return to staff portal</Link>
      </section>
    );
  }

  const openTerms = terms.filter((term) => term.status === "open").length;
  const activeClasses = summaries.filter((classRow) => ["published", "open", "waitlist"].includes(classRow.status)).length;
  const enrolled = summaries.reduce((total, classRow) => total + classRow.enrolled, 0);
  const waiting = summaries.reduce((total, classRow) => total + classRow.waiting, 0);

  return (
    <div className="programs-workspace">
      <section className="programs-panel programs-toolbar">
        <div>
          <p className="eyebrow">MFA verified / Role-scoped records</p>
          <h2>Catalog and enrollment overview</h2>
        </div>
        <Link className="text-button" href="/staff">Back to staff portal</Link>
      </section>

      <aside className="programs-readonly-note">
        <strong>Audited catalog editing is active.</strong> Every save requires an operational reason. Catalog Managers prepare programs, terms, facilities, and classes; Catalog Publishers release public programs and classes. Registration, transfer, and waitlist actions remain disabled.
      </aside>

      <CatalogEditor
        programs={programs}
        terms={terms}
        facilities={facilities}
        classes={classes}
        permissions={permissions}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />

      <section className="programs-metrics" aria-label="Programs and registration summary">
        <article><span>Programs</span><strong>{programs.length}</strong></article>
        <article><span>Open terms</span><strong>{openTerms}</strong></article>
        <article><span>Active classes</span><strong>{activeClasses}</strong></article>
        <article><span>Enrollment / waitlist</span><strong>{enrolled} / {waiting}</strong></article>
      </section>

      <section className="programs-panel programs-term-card">
        <div>
          <p className="eyebrow">Session calendar</p>
          <h3>Terms</h3>
        </div>
        {terms.length > 0 ? (
          <div className="programs-term-list">
            {terms.slice(0, 6).map((term) => (
              <article key={term.id}>
                <div><strong>{term.name}</strong><small>{term.code}</small></div>
                <span>{date.format(new Date(`${term.starts_on}T12:00:00`))} – {date.format(new Date(`${term.ends_on}T12:00:00`))}</span>
                <span className={`programs-status programs-status-${term.status}`}>{label(term.status)}</span>
              </article>
            ))}
          </div>
        ) : <p className="programs-empty">No terms have been loaded yet.</p>}
      </section>

      <section className="programs-panel programs-class-card">
        <div className="programs-filter-row">
          <div>
            <p className="eyebrow">Class operations</p>
            <h3>Classes, capacity, and waitlists</h3>
            <p>{filteredClasses.length} of {summaries.length} classes shown</p>
          </div>
          <div className="programs-filter-controls">
            <label>
              <span>Search classes</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, title, program, term, or room" />
            </label>
            <label>
              <span>Class status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All statuses</option>
                {["draft", "published", "open", "waitlist", "closed", "canceled", "completed", "archived"].map((value) => <option value={value} key={value}>{label(value)}</option>)}
              </select>
            </label>
          </div>
        </div>

        {filteredClasses.length > 0 ? (
          <div className="programs-table-scroll">
            <table>
              <thead><tr><th>Class</th><th>Program / Term</th><th>Schedule</th><th>Status</th><th>Enrollment</th><th>Waitlist</th><th>Price</th></tr></thead>
              <tbody>
                {filteredClasses.map((classRow) => (
                  <tr key={classRow.id}>
                    <td><strong>{classRow.title}</strong><small>{classRow.code}{classRow.instructor_display_text ? ` · ${classRow.instructor_display_text === "TBD TBD" ? "Instructor TBA" : classRow.instructor_display_text}` : ""}</small></td>
                    <td>{classRow.programName}<small>{classRow.termName}</small></td>
                    <td>{classRow.source_schedule_text?.replace(" | ", " · ") || (classRow.starts_at ? dateTime.format(new Date(classRow.starts_at)) : "Not scheduled")}<small>{classRow.source_location_text || classRow.facilityName}</small></td>
                    <td><span className={`programs-status programs-status-${classRow.source_registration_status || classRow.status}`}>{classRow.checkout_mode === "external" ? `Canvas ${label(classRow.source_registration_status || "closed")}` : label(classRow.status)}</span></td>
                    <td>{classRow.checkout_mode === "external" ? <><strong>Canvas managed</strong><small>Capacity imports after export</small></> : <><strong>{classRow.enrolled} / {classRow.capacity}</strong><small>Minimum {classRow.minimum_enrollment}</small></>}</td>
                    <td>{classRow.waiting}</td>
                    <td>{currency.format(Number(classRow.price))}{classRow.member_price !== null && <small>Member {currency.format(Number(classRow.member_price))}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="programs-empty">{summaries.length === 0 ? "No classes have been loaded yet." : "No classes match these filters."}</p>}
        {summaries.length === 250 && <p className="programs-limit-note">Showing the 250 most recently updated classes. Server-side search and pagination will be added before catalog migration.</p>}
      </section>
    </div>
  );
}

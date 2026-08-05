"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
type Person = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  email_marketing_status: string;
  created_at: string;
};
type Membership = { person_id: string; household_id: string; relationship: string; is_primary: boolean; status: string };
type Household = { id: string; name: string; status: string };
type DirectoryRow = Person & { households: Array<{ id: string; name: string; relationship: string; isPrimary: boolean }> };

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayName(person: Person) {
  const firstName = person.preferred_name?.trim() || person.first_name;
  return `${firstName} ${person.last_name}`;
}

export function PeopleDirectory() {
  const [view, setView] = useState<ViewState>("loading");
  const [people, setPeople] = useState<DirectoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDirectory() {
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
        setError("The People View permission is required.");
        setView("denied");
        return;
      }

      const { data: permissionRows, error: permissionError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roles);
      if (permissionError || !permissionRows?.some((row) => row.permission === "people.view")) {
        setError(permissionError?.message ?? "The People View permission is required.");
        setView("denied");
        return;
      }

      const { data: personRows, error: peopleError } = await supabase
        .from("people")
        .select("id,first_name,last_name,preferred_name,email,phone,status,email_marketing_status,created_at")
        .neq("status", "merged")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })
        .limit(250);
      if (peopleError) {
        setError(peopleError.message);
        setView("denied");
        return;
      }

      const personIds = (personRows ?? []).map((person) => person.id);
      let memberships: Membership[] = [];
      let households: Household[] = [];

      if (personIds.length > 0) {
        const { data: membershipRows, error: membershipError } = await supabase
          .from("household_members")
          .select("person_id,household_id,relationship,is_primary,status")
          .in("person_id", personIds)
          .eq("status", "active");
        if (membershipError) {
          setError(membershipError.message);
          setView("denied");
          return;
        }
        memberships = (membershipRows ?? []) as Membership[];

        const householdIds = Array.from(new Set(memberships.map((membership) => membership.household_id)));
        if (householdIds.length > 0) {
          const { data: householdRows, error: householdError } = await supabase
            .from("households")
            .select("id,name,status")
            .in("id", householdIds)
            .neq("status", "merged");
          if (householdError) {
            setError(householdError.message);
            setView("denied");
            return;
          }
          households = (householdRows ?? []) as Household[];
        }
      }

      const householdById = new Map(households.map((household) => [household.id, household]));
      const membershipsByPerson = new Map<string, DirectoryRow["households"]>();
      for (const membership of memberships) {
        const household = householdById.get(membership.household_id);
        if (!household) continue;
        const current = membershipsByPerson.get(membership.person_id) ?? [];
        current.push({ id: household.id, name: household.name, relationship: membership.relationship, isPrimary: membership.is_primary });
        membershipsByPerson.set(membership.person_id, current);
      }

      if (!active) return;
      setPeople(((personRows ?? []) as Person[]).map((person) => ({ ...person, households: membershipsByPerson.get(person.id) ?? [] })));
      setView("ready");
    }

    void loadDirectory();
    return () => { active = false; };
  }, []);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;
    return people.filter((person) => [
      displayName(person),
      person.email ?? "",
      person.phone ?? "",
      ...person.households.map((household) => household.name),
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [people, query]);

  if (view === "loading") return <div className="people-panel people-loading" aria-live="polite">Loading protected people records…</div>;

  if (view !== "ready") {
    const messages = {
      "signed-out": ["Staff sign-in required", "Sign in through the staff portal before opening protected customer records."],
      "mfa-required": ["Authenticator verification required", "Complete the second verification step in the staff portal, then return here."],
      denied: ["People directory unavailable", error || "Your current staff role does not include access to people records."],
    } as const;
    const [title, message] = messages[view];
    return (
      <section className={`people-panel people-gate${view === "denied" ? " people-denied" : ""}`}>
        <p className="eyebrow">Protected records</p>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="dark-button" href="/staff">Return to staff portal</Link>
      </section>
    );
  }

  const linkedHouseholds = new Set(people.flatMap((person) => person.households.map((household) => household.id))).size;
  const activePeople = people.filter((person) => person.status === "active").length;
  const subscribed = people.filter((person) => person.email_marketing_status === "subscribed").length;

  return (
    <div className="people-workspace">
      <section className="people-panel people-toolbar">
        <div>
          <p className="eyebrow">MFA verified / People View</p>
          <h2>Customer directory</h2>
        </div>
        <Link className="text-button" href="/staff">Back to staff portal</Link>
      </section>

      <p className="people-privacy-note"><strong>Privacy boundary:</strong> This directory shows contact and household relationship data only. Birth dates, medical notes, emergency contacts, and other sensitive participant details are not loaded.</p>

      <section className="people-metrics" aria-label="Directory summary">
        <article><span>People loaded</span><strong>{people.length}</strong></article>
        <article><span>Active people</span><strong>{activePeople}</strong></article>
        <article><span>Households linked</span><strong>{linkedHouseholds}</strong></article>
        <article><span>Email subscribers</span><strong>{subscribed}</strong></article>
      </section>

      <section className="people-panel people-directory-card">
        <div className="people-search-row">
          <div>
            <h3>People and household relationships</h3>
            <p>{filteredPeople.length} of {people.length} records shown</p>
          </div>
          <label>
            <span>Search directory</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Name, email, phone, or household" />
          </label>
        </div>
        <div className="people-table-scroll">
          <table>
            <thead><tr><th>Person</th><th>Contact</th><th>Household</th><th>Status</th><th>Email</th></tr></thead>
            <tbody>
              {filteredPeople.map((person) => (
                <tr key={person.id}>
                  <td><strong>{displayName(person)}</strong>{person.preferred_name && <small>Legal first name: {person.first_name}</small>}</td>
                  <td>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : <span className="people-muted">No email</span>}{person.phone && <small>{person.phone}</small>}</td>
                  <td>{person.households.length > 0 ? person.households.map((household) => <span className="people-household" key={household.id}>{household.name}<small>{label(household.relationship)}{household.isPrimary ? " · Primary" : ""}</small></span>) : <span className="people-muted">Not linked</span>}</td>
                  <td><span className={`people-status people-status-${person.status}`}>{label(person.status)}</span></td>
                  <td><span className={`people-status people-status-${person.email_marketing_status}`}>{label(person.email_marketing_status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPeople.length === 0 && <p className="people-empty">No records match this search.</p>}
        {people.length === 250 && <p className="people-limit-note">Showing the first 250 records. Search and pagination across the full directory will be added before migration traffic is enabled.</p>}
      </section>
    </div>
  );
}

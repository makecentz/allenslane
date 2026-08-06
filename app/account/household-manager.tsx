"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

type Person = {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
};
type Household = { id: string; name: string; primary_person_id: string | null };
type Member = {
  household_id: string;
  person_id: string;
  relationship: string;
  is_primary: boolean;
  is_guardian: boolean;
  can_manage_household: boolean;
};
type Address = {
  id: string;
  household_id: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country_code: string;
  is_primary: boolean;
};
type HouseholdData = {
  profile: Person;
  household: Household;
  address: Address | null;
  members: Array<Member & { person: Person; editable: boolean }>;
};
type ParticipantForm = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  relationship: string;
  birthDate: string;
  email: string;
  phone: string;
};

const emptyParticipant: ParticipantForm = {
  id: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  relationship: "child",
  birthDate: "",
  email: "",
  phone: "",
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Something went wrong. Please try again.";
}

function relationshipLabel(value: string) {
  return value === "spouse" ? "Spouse" : value === "partner" ? "Partner" : value === "dependent" ? "Dependent" : value === "child" ? "Child" : "Other";
}

function birthDateLabel(value: string | null) {
  if (!value) return "Birth date not added";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

async function fetchHouseholdData(userId: string): Promise<HouseholdData> {
  const supabase = getSupabaseBrowserClient();
  const [peopleResult, householdResult, memberResult, addressResult] = await Promise.all([
    supabase.from("people").select("id,auth_user_id,first_name,last_name,preferred_name,email,phone,birth_date").eq("status", "active").limit(100),
    supabase.from("households").select("id,name,primary_person_id").eq("status", "active").limit(20),
    supabase.from("household_members").select("household_id,person_id,relationship,is_primary,is_guardian,can_manage_household").eq("status", "active").limit(100),
    supabase.from("addresses").select("id,household_id,line1,line2,city,region,postal_code,country_code,is_primary").eq("address_type", "home").limit(20),
  ]);

  const firstError = [peopleResult, householdResult, memberResult, addressResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const people = (peopleResult.data ?? []) as Person[];
  const households = (householdResult.data ?? []) as Household[];
  const members = (memberResult.data ?? []) as Member[];
  const addresses = (addressResult.data ?? []) as Address[];
  const profile = people.find((person) => person.auth_user_id === userId);
  const membership = profile ? members.find((member) => member.person_id === profile.id) : null;
  const household = membership ? households.find((item) => item.id === membership.household_id) : null;

  if (!profile || !membership || !household) throw new Error("Your household setup is incomplete. Please contact the Art Center.");

  const personById = new Map(people.map((person) => [person.id, person]));
  const householdMembers = members
    .filter((member) => member.household_id === household.id)
    .map((member) => ({ ...member, person: personById.get(member.person_id), editable: false }))
    .filter((member): member is Member & { person: Person; editable: boolean } => Boolean(member.person))
    .map((member) => ({ ...member, editable: member.person.auth_user_id === null }))
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.person.first_name.localeCompare(right.person.first_name));

  return {
    profile,
    household,
    address: addresses.find((item) => item.household_id === household.id && item.is_primary) ?? addresses.find((item) => item.household_id === household.id) ?? null,
    members: householdMembers,
  };
}

export function HouseholdManager({ userId }: { userId: string }) {
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [participantOpen, setParticipantOpen] = useState(false);
  const [participantForm, setParticipantForm] = useState<ParticipantForm>(emptyParticipant);

  const loadHousehold = useCallback(async () => {
    try {
      setData(await fetchHouseholdData(userId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    void fetchHouseholdData(userId)
      .then((nextData) => { if (active) setData(nextData); })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const participantCount = useMemo(() => data?.members.filter((member) => !member.is_primary).length ?? 0, [data]);

  async function saveHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const { error: saveError } = await getSupabaseBrowserClient().rpc("save_customer_household", {
        p_first_name: String(form.get("first_name") ?? "").trim(),
        p_last_name: String(form.get("last_name") ?? "").trim(),
        p_preferred_name: String(form.get("preferred_name") ?? "").trim() || null,
        p_phone: String(form.get("phone") ?? "").trim() || null,
        p_household_name: String(form.get("household_name") ?? "").trim(),
        p_address_id: data.address?.id ?? null,
        p_line1: String(form.get("line1") ?? "").trim() || null,
        p_line2: String(form.get("line2") ?? "").trim() || null,
        p_city: String(form.get("city") ?? "").trim() || null,
        p_region: String(form.get("region") ?? "").trim() || null,
        p_postal_code: String(form.get("postal_code") ?? "").trim() || null,
        p_country_code: "US",
      });
      if (saveError) throw saveError;
      setNotice("Your household profile has been saved.");
      await loadHousehold();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const { error: saveError } = await getSupabaseBrowserClient().rpc("save_household_participant", {
        p_household_id: data.household.id,
        p_person_id: participantForm.id || null,
        p_first_name: participantForm.firstName.trim(),
        p_last_name: participantForm.lastName.trim(),
        p_preferred_name: participantForm.preferredName.trim() || null,
        p_relationship: participantForm.relationship,
        p_birth_date: participantForm.birthDate || null,
        p_email: participantForm.email.trim() || null,
        p_phone: participantForm.phone.trim() || null,
      });
      if (saveError) throw saveError;
      setNotice(participantForm.id ? "Participant details have been updated." : "Participant added to your household.");
      setParticipantForm(emptyParticipant);
      setParticipantOpen(false);
      await loadHousehold();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function editParticipant(member: HouseholdData["members"][number]) {
    setParticipantForm({
      id: member.person.id,
      firstName: member.person.first_name,
      lastName: member.person.last_name,
      preferredName: member.person.preferred_name ?? "",
      relationship: member.relationship,
      birthDate: member.person.birth_date ?? "",
      email: member.person.email ?? "",
      phone: member.person.phone ?? "",
    });
    setParticipantOpen(true);
    setNotice("");
    setError("");
  }

  function addParticipant() {
    setParticipantForm(emptyParticipant);
    setParticipantOpen(true);
    setNotice("");
    setError("");
  }

  if (loading && !data) return <div className="household-loading" aria-live="polite">Loading your household…</div>;
  if (!data) return error ? <p className="form-error" role="alert">{error}</p> : null;

  return (
    <div className="household-manager">
      <div className="account-placeholder-grid" aria-label="Account readiness">
        <div><strong>Household</strong><span>Profile connected</span></div>
        <div><strong>Participants</strong><span>{participantCount} added</span></div>
        <div><strong>Registrations</strong><span>Next release</span></div>
        <div><strong>Payments</strong><span>Stripe setup follows registration</span></div>
      </div>

      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="household-section" aria-labelledby="household-profile-heading">
        <div className="household-section-heading">
          <div><p className="eyebrow">Account details</p><h3 id="household-profile-heading">Household Profile</h3></div>
          <span>Required before registration</span>
        </div>
        <form className="household-form" onSubmit={saveHousehold}>
          <div className="form-row">
            <label>First name<input name="first_name" defaultValue={data.profile.first_name} autoComplete="given-name" maxLength={100} required /></label>
            <label>Last name<input name="last_name" defaultValue={data.profile.last_name} autoComplete="family-name" maxLength={100} required /></label>
          </div>
          <div className="form-row">
            <label>Preferred name <span>(optional)</span><input name="preferred_name" defaultValue={data.profile.preferred_name ?? ""} autoComplete="nickname" maxLength={100} /></label>
            <label>Phone <span>(optional)</span><input type="tel" name="phone" defaultValue={data.profile.phone ?? ""} autoComplete="tel" maxLength={50} /></label>
          </div>
          <label>Household name<input name="household_name" defaultValue={data.household.name} maxLength={150} required /></label>

          <fieldset>
            <legend>Home address <span>(optional until registration)</span></legend>
            <label>Street address<input name="line1" defaultValue={data.address?.line1 ?? ""} autoComplete="street-address" maxLength={200} /></label>
            <label>Apartment, suite, or unit <span>(optional)</span><input name="line2" defaultValue={data.address?.line2 ?? ""} maxLength={200} /></label>
            <div className="household-address-row">
              <label>City<input name="city" defaultValue={data.address?.city ?? ""} autoComplete="address-level2" maxLength={100} /></label>
              <label>State<input name="region" defaultValue={data.address?.region ?? "PA"} autoComplete="address-level1" maxLength={100} /></label>
              <label>ZIP code<input name="postal_code" defaultValue={data.address?.postal_code ?? ""} autoComplete="postal-code" maxLength={20} /></label>
            </div>
          </fieldset>
          <button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save household profile"}</button>
        </form>
      </section>

      <section className="household-section" aria-labelledby="participants-heading">
        <div className="household-section-heading">
          <div><p className="eyebrow">Who can register</p><h3 id="participants-heading">Household Participants</h3></div>
          <button className="dark-button" type="button" onClick={addParticipant}>Add participant</button>
        </div>

        <div className="participant-list">
          {data.members.map((member) => (
            <article className="participant-card" key={member.person.id}>
              <div>
                <strong>{member.person.preferred_name || member.person.first_name} {member.person.last_name}</strong>
                <span>{member.is_primary ? "Primary account holder" : relationshipLabel(member.relationship)} · {birthDateLabel(member.person.birth_date)}</span>
              </div>
              {member.editable ? <button className="text-button" type="button" onClick={() => editParticipant(member)}>Edit</button> : <span className="participant-connected">Connected account</span>}
            </article>
          ))}
        </div>

        {participantOpen ? (
          <form className="household-form participant-form" onSubmit={saveParticipant}>
            <h4>{participantForm.id ? "Edit participant" : "Add a participant"}</h4>
            <div className="form-row">
              <label>First name<input value={participantForm.firstName} onChange={(event) => setParticipantForm((form) => ({ ...form, firstName: event.target.value }))} maxLength={100} required /></label>
              <label>Last name<input value={participantForm.lastName} onChange={(event) => setParticipantForm((form) => ({ ...form, lastName: event.target.value }))} maxLength={100} required /></label>
            </div>
            <div className="form-row">
              <label>Preferred name <span>(optional)</span><input value={participantForm.preferredName} onChange={(event) => setParticipantForm((form) => ({ ...form, preferredName: event.target.value }))} maxLength={100} /></label>
              <label>Relationship<select value={participantForm.relationship} onChange={(event) => setParticipantForm((form) => ({ ...form, relationship: event.target.value }))}><option value="child">Child</option><option value="spouse">Spouse</option><option value="partner">Partner</option><option value="dependent">Dependent</option><option value="other">Other</option></select></label>
            </div>
            <div className="form-row">
              <label>Birth date <span>(recommended)</span><input type="date" value={participantForm.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setParticipantForm((form) => ({ ...form, birthDate: event.target.value }))} /></label>
              <label>Phone <span>(optional)</span><input type="tel" value={participantForm.phone} onChange={(event) => setParticipantForm((form) => ({ ...form, phone: event.target.value }))} maxLength={50} /></label>
            </div>
            <label>Email <span>(optional)</span><input type="email" value={participantForm.email} onChange={(event) => setParticipantForm((form) => ({ ...form, email: event.target.value }))} maxLength={320} /></label>
            <div className="household-form-actions">
              <button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving…" : participantForm.id ? "Save participant" : "Add participant"}</button>
              <button className="text-button" type="button" onClick={() => { setParticipantOpen(false); setParticipantForm(emptyParticipant); }}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

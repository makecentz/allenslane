"use client";
/* eslint-disable @next/next/no-img-element -- Catalog images may be local or staff-managed external URLs. */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

type Program = { id: string; name: string; audience: string | null };
type Term = { id: string; name: string; starts_on: string; ends_on: string };
type Facility = { id: string; name: string };
type ClassRow = {
  id: string;
  program_id: string;
  term_id: string;
  facility_id: string | null;
  code: string;
  title: string;
  summary: string | null;
  description: string | null;
  level: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number;
  price: number;
  member_price: number | null;
  fee: number;
  starts_at: string | null;
  ends_at: string | null;
  image_path: string | null;
  image_alt: string | null;
  status: "published" | "open" | "waitlist" | "closed";
  checkout_mode: "internal" | "external";
  external_registration_url: string | null;
  instructor_display_text: string | null;
  source_schedule_text: string | null;
  source_location_text: string | null;
  source_category: string | null;
  delivery_mode: string | null;
  fee_label: string | null;
  source_registration_status: "open" | "waitlist" | "full" | "closed" | null;
};

type CatalogClass = ClassRow & {
  programName: string;
  audience: string | null;
  termName: string;
  facilityName: string | null;
};
type ParticipantOption = {
  id: string;
  label: string;
  birthDate: string | null;
};
type RegistrationResult = {
  action: "registration_hold" | "waitlisted" | "already_registered";
  hold_id?: string;
  expires_at?: string;
  total_amount?: number;
  waitlist_entry_id?: string;
  position?: number;
  registration_id?: string;
};

const publicStatuses = ["published", "open", "waitlist", "closed"];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function imageSource(path: string | null) {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("https://")) return path;
  return null;
}

function ageLabel(ageMin: number | null, ageMax: number | null) {
  if (ageMin === null && ageMax === null) return null;
  if (ageMin !== null && ageMax !== null) return `Ages ${ageMin}–${ageMax}`;
  if (ageMin !== null) return `Ages ${ageMin}+`;
  return `Up to age ${ageMax}`;
}

function registrationLabel(status: ClassRow["status"]) {
  if (status === "open") return "Register now";
  if (status === "waitlist") return "Join the waitlist";
  if (status === "closed") return "Registration closed";
  return "Registration coming soon";
}

function externalRegistrationLabel(status: ClassRow["source_registration_status"]) {
  if (status === "waitlist") return "Join the Canvas waitlist";
  if (status === "full") return "View full class";
  if (status === "closed") return "View closed class";
  return "Register in Canvas";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Something went wrong. Please try again.";
}

export function PublicClassCatalog({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [classes, setClasses] = useState<CatalogClass[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [program, setProgram] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [participantLoading, setParticipantLoading] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const supabase = getSupabaseBrowserClient();
        const [classResult, programResult, termResult, facilityResult] = await Promise.all([
          supabase.from("classes").select("id,program_id,term_id,facility_id,code,title,summary,description,level,age_min,age_max,capacity,price,member_price,fee,starts_at,ends_at,image_path,image_alt,status,checkout_mode,external_registration_url,instructor_display_text,source_schedule_text,source_location_text,source_category,delivery_mode,fee_label,source_registration_status").in("status", publicStatuses).order("starts_at", { ascending: true, nullsFirst: false }).limit(250),
          supabase.from("programs").select("id,name,audience").eq("status", "published").order("display_order").limit(250),
          supabase.from("terms").select("id,name,starts_on,ends_on").in("status", ["open", "closed"]).order("starts_on", { ascending: false }).limit(100),
          supabase.from("facilities").select("id,name").eq("status", "active").order("name").limit(100),
        ]);

        if (!active || classResult.error || programResult.error || termResult.error || facilityResult.error) return;

        const programs = (programResult.data ?? []) as Program[];
        const terms = (termResult.data ?? []) as Term[];
        const facilities = (facilityResult.data ?? []) as Facility[];
        const programById = new Map(programs.map((item) => [item.id, item]));
        const termById = new Map(terms.map((item) => [item.id, item]));
        const facilityById = new Map(facilities.map((item) => [item.id, item]));

        const publicClasses = ((classResult.data ?? []) as ClassRow[])
          .filter((item) => programById.has(item.program_id) && termById.has(item.term_id))
          .map((item) => ({
            ...item,
            programName: programById.get(item.program_id)?.name ?? "Allens Lane class",
            audience: programById.get(item.program_id)?.audience ?? null,
            termName: termById.get(item.term_id)?.name ?? "Current session",
            facilityName: item.facility_id ? facilityById.get(item.facility_id)?.name ?? null : null,
          }));

        setClasses(publicClasses);
      } catch {
        // The cloned page remains visible when public catalog configuration is unavailable.
      }
    }

    void loadCatalog();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setParticipants([]);
        setSelectedParticipantId("");
        setActiveClassId(null);
        setRegistrationNotice("");
        setRegistrationError("");
      }
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadParticipants(currentUserId: string) {
    setParticipantLoading(true);
    setRegistrationError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const [peopleResult, memberResult] = await Promise.all([
        supabase.from("people").select("id,auth_user_id,first_name,last_name,preferred_name,birth_date").eq("status", "active").limit(250),
        supabase.from("household_members").select("household_id,person_id,is_primary,is_guardian,can_manage_household").eq("status", "active").limit(250),
      ]);
      if (peopleResult.error) throw peopleResult.error;
      if (memberResult.error) throw memberResult.error;

      const people = (peopleResult.data ?? []) as Array<{ id: string; auth_user_id: string | null; first_name: string; last_name: string; preferred_name: string | null; birth_date: string | null }>;
      const memberships = (memberResult.data ?? []) as Array<{ household_id: string; person_id: string; is_primary: boolean; is_guardian: boolean; can_manage_household: boolean }>;
      const profile = people.find((person) => person.auth_user_id === currentUserId);
      const manageableHouseholds = new Set(
        memberships
          .filter((member) => member.person_id === profile?.id && (member.is_primary || member.is_guardian || member.can_manage_household))
          .map((member) => member.household_id),
      );
      const participantIds = new Set(memberships.filter((member) => manageableHouseholds.has(member.household_id)).map((member) => member.person_id));
      const options = people
        .filter((person) => participantIds.has(person.id))
        .map((person) => ({
          id: person.id,
          label: `${person.preferred_name || person.first_name} ${person.last_name}${person.id === profile?.id ? " (you)" : ""}`,
          birthDate: person.birth_date,
        }))
        .sort((left, right) => left.label.localeCompare(right.label));

      if (options.length === 0) throw new Error("Add your household profile and participants before registering.");
      setParticipants(options);
      setSelectedParticipantId((current) => current || profile?.id || options[0].id);
    } catch (loadError) {
      setRegistrationError(errorMessage(loadError));
    } finally {
      setParticipantLoading(false);
    }
  }

  async function openRegistration(classId: string) {
    setRegistrationNotice("");
    setRegistrationError("");
    if (!userId) {
      router.push("/account");
      return;
    }
    setActiveClassId((current) => current === classId ? null : classId);
    if (participants.length === 0) await loadParticipants(userId);
  }

  async function prepareRegistration(classId: string) {
    if (!selectedParticipantId) return;
    setRegistrationSaving(true);
    setRegistrationNotice("");
    setRegistrationError("");
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("prepare_class_registration", {
        p_class_id: classId,
        p_participant_person_id: selectedParticipantId,
      });
      if (error) throw error;
      const result = data as RegistrationResult;
      if (result.action === "registration_hold") {
        if (!result.hold_id) throw new Error("Registration hold was not returned.");
        setRegistrationNotice(`Your ${currency.format(Number(result.total_amount ?? 0))} registration is reserved. Opening secure Stripe Checkout…`);
        const { data: checkoutData, error: checkoutError } = await getSupabaseBrowserClient().functions.invoke("create-registration-checkout", {
          body: { holdId: result.hold_id },
        });
        if (checkoutError) throw checkoutError;
        const checkoutUrl = checkoutData && typeof checkoutData.url === "string" ? checkoutData.url : "";
        if (!checkoutUrl) throw new Error(checkoutData?.error || "Stripe Checkout did not return a payment link.");
        const redirect = new URL(checkoutUrl, window.location.origin);
        if (redirect.origin !== "https://checkout.stripe.com" && redirect.origin !== window.location.origin) {
          throw new Error("Stripe Checkout returned an unexpected payment address.");
        }
        window.location.assign(redirect.toString());
      } else if (result.action === "waitlisted") {
        setRegistrationNotice(`This participant is on the waitlist at position ${result.position ?? 1}. No payment is due.`);
      } else {
        setRegistrationNotice("This participant already has an active registration for the class.");
      }
    } catch (saveError) {
      setRegistrationError(errorMessage(saveError));
    } finally {
      setRegistrationSaving(false);
    }
  }

  const programOptions = useMemo(() => [...new Set(classes.map((item) => item.programName))].sort(), [classes]);
  const filteredClasses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return classes.filter((item) => {
      const matchesProgram = program === "all" || item.programName === program;
      const searchable = [item.title, item.code, item.programName, item.termName, item.summary, item.level, item.audience, item.instructor_display_text, item.source_category, item.source_location_text].filter(Boolean).join(" ").toLowerCase();
      return matchesProgram && (!needle || searchable.includes(needle));
    });
  }, [classes, program, query]);

  if (classes.length === 0) return null;

  return (
    <section className="public-catalog" aria-labelledby="current-classes-heading">
      <div className="public-catalog-heading">
        <p className="eyebrow">Live class catalog</p>
        <h2 id="current-classes-heading">Current Classes</h2>
        <p>Browse published classes from the Allens Lane registration system. Canvas remains active for imported classes while new-system classes use secure Stripe Checkout.</p>
      </div>

      <div className="public-catalog-filters" aria-label="Filter current classes">
        <label>
          <span>Search classes</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, medium, age, or level" />
        </label>
        <label>
          <span>Program</span>
          <select value={program} onChange={(event) => setProgram(event.target.value)}>
            <option value="all">All programs</option>
            {programOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {filteredClasses.length > 0 ? (
        <div className="public-catalog-grid">
          {filteredClasses.map((item) => {
            const image = imageSource(item.image_path);
            const ages = ageLabel(item.age_min, item.age_max);
            const isExternal = item.checkout_mode === "external";
            const registrationClosed = !isExternal && (item.status === "closed" || item.status === "published");
            const displayStatus = isExternal ? item.source_registration_status ?? "closed" : item.status;
            return (
              <article className="public-class-card" key={item.id}>
                {image ? <img src={image} alt={item.image_alt ?? ""} /> : <div className="public-class-placeholder" aria-hidden="true"><span>Allens Lane</span></div>}
                <div className="public-class-body">
                  <div className="public-class-kicker"><span>{item.source_category || item.programName}{item.delivery_mode ? ` · ${item.delivery_mode}` : ""}</span><span className={`public-class-status public-class-status-${displayStatus}`}>{displayStatus}</span></div>
                  <h3>{item.title}</h3>
                  <p className="public-class-code">{item.code} · {item.termName}</p>
                  {item.summary && <p>{item.summary}</p>}
                  <dl className="public-class-details">
                    {item.instructor_display_text && <div><dt>Instructor</dt><dd>{item.instructor_display_text === "TBD TBD" ? "To be announced" : item.instructor_display_text}</dd></div>}
                    {item.source_schedule_text ? <div><dt>Schedule</dt><dd>{item.source_schedule_text.replace(" | ", " · ")}</dd></div> : <>
                      {item.starts_at && <div><dt>Starts</dt><dd>{dateTime.format(new Date(item.starts_at))}</dd></div>}
                      {item.ends_at && <div><dt>Ends</dt><dd>{date.format(new Date(item.ends_at))}</dd></div>}
                    </>}
                    {(item.source_location_text || item.facilityName) && <div><dt>Location</dt><dd>{item.source_location_text?.replace("None Specified", "To be announced").replace("None Selected", "To be announced") || item.facilityName}</dd></div>}
                    {(ages || item.level) && <div><dt>For</dt><dd>{[ages, item.level].filter(Boolean).join(" · ")}</dd></div>}
                    <div><dt>Price</dt><dd>{currency.format(Number(item.price))}{item.member_price !== null ? ` · Members ${currency.format(Number(item.member_price))}` : ""}{Number(item.fee) > 0 ? ` + ${currency.format(Number(item.fee))} ${item.fee_label || "fee"}` : ""}</dd></div>
                  </dl>
                  {isExternal ? <a className="dark-button public-class-button" href={item.external_registration_url ?? "https://canvas.allenslane.org/classes"}>{externalRegistrationLabel(item.source_registration_status)}</a> : registrationClosed ? <span className="dark-button public-class-button is-disabled" aria-disabled="true">{registrationLabel(item.status)}</span> : (
                    <div className="public-class-actions">
                      <button className="dark-button public-class-button" type="button" aria-expanded={activeClassId === item.id} onClick={() => void openRegistration(item.id)}>{registrationLabel(item.status)}</button>
                    </div>
                  )}
                  {!isExternal && activeClassId === item.id ? (
                    <div className="public-registration-panel">
                      <p><strong>Register securely</strong> Choose a household participant. An available class reserves a place while you pay through Stripe; a full class adds the participant to the waitlist.</p>
                      {participantLoading ? <p role="status">Loading household participantsâ€¦</p> : (
                        <>
                          <label>
                            <span>Participant</span>
                            <select value={selectedParticipantId} onChange={(event) => setSelectedParticipantId(event.target.value)}>
                              {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.label}{participant.birthDate ? "" : " â€” birth date needed for age-limited classes"}</option>)}
                            </select>
                          </label>
                          <button className="dark-button" type="button" disabled={registrationSaving || !selectedParticipantId} onClick={() => void prepareRegistration(item.id)}>
                            {registrationSaving ? "Preparing secure checkout…" : item.status === "waitlist" ? "Join waitlist" : "Continue to payment"}
                          </button>
                        </>
                      )}
                      <p className="public-registration-note">Payment is handled on Stripe&apos;s secure checkout page. Enrollment is confirmed only after Stripe verifies the payment.</p>
                      {registrationNotice ? <p className="form-notice" role="status">{registrationNotice}</p> : null}
                      {registrationError ? <p className="form-error" role="alert">{registrationError}</p> : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="public-catalog-empty">No classes match those filters. Try a broader search.</p>}
    </section>
  );
}

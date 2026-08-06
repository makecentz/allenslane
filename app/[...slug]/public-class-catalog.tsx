"use client";
/* eslint-disable @next/next/no-img-element -- Catalog images may be local or staff-managed external URLs. */

import { useEffect, useMemo, useState } from "react";
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
};

type CatalogClass = ClassRow & {
  programName: string;
  audience: string | null;
  termName: string;
  facilityName: string | null;
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
  if (status === "open") return "Register in Canvas";
  if (status === "waitlist") return "Join the waitlist";
  if (status === "closed") return "Registration closed";
  return "Registration coming soon";
}

export function PublicClassCatalog() {
  const [classes, setClasses] = useState<CatalogClass[]>([]);
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("all");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const supabase = getSupabaseBrowserClient();
        const [classResult, programResult, termResult, facilityResult] = await Promise.all([
          supabase.from("classes").select("id,program_id,term_id,facility_id,code,title,summary,description,level,age_min,age_max,capacity,price,member_price,fee,starts_at,ends_at,image_path,image_alt,status").in("status", publicStatuses).order("starts_at", { ascending: true, nullsFirst: false }).limit(250),
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

  const programOptions = useMemo(() => [...new Set(classes.map((item) => item.programName))].sort(), [classes]);
  const filteredClasses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return classes.filter((item) => {
      const matchesProgram = program === "all" || item.programName === program;
      const searchable = [item.title, item.code, item.programName, item.termName, item.summary, item.level, item.audience].filter(Boolean).join(" ").toLowerCase();
      return matchesProgram && (!needle || searchable.includes(needle));
    });
  }, [classes, program, query]);

  if (classes.length === 0) return null;

  return (
    <section className="public-catalog" aria-labelledby="current-classes-heading">
      <div className="public-catalog-heading">
        <p className="eyebrow">Live class catalog</p>
        <h2 id="current-classes-heading">Current Classes</h2>
        <p>Browse published classes from the Allens Lane registration system. Checkout remains in Canvas during the transition.</p>
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
            const registrationClosed = item.status === "closed" || item.status === "published";
            return (
              <article className="public-class-card" key={item.id}>
                {image ? <img src={image} alt={item.image_alt ?? ""} /> : <div className="public-class-placeholder" aria-hidden="true"><span>Allens Lane</span></div>}
                <div className="public-class-body">
                  <div className="public-class-kicker"><span>{item.programName}</span><span className={`public-class-status public-class-status-${item.status}`}>{item.status}</span></div>
                  <h3>{item.title}</h3>
                  <p className="public-class-code">{item.code} · {item.termName}</p>
                  {item.summary && <p>{item.summary}</p>}
                  <dl className="public-class-details">
                    {item.starts_at && <div><dt>Starts</dt><dd>{dateTime.format(new Date(item.starts_at))}</dd></div>}
                    {item.ends_at && <div><dt>Ends</dt><dd>{date.format(new Date(item.ends_at))}</dd></div>}
                    {item.facilityName && <div><dt>Location</dt><dd>{item.facilityName}</dd></div>}
                    {(ages || item.level) && <div><dt>For</dt><dd>{[ages, item.level].filter(Boolean).join(" · ")}</dd></div>}
                    <div><dt>Price</dt><dd>{currency.format(Number(item.price))}{item.member_price !== null ? ` · Members ${currency.format(Number(item.member_price))}` : ""}{Number(item.fee) > 0 ? ` + ${currency.format(Number(item.fee))} fee` : ""}</dd></div>
                  </dl>
                  {registrationClosed ? <span className="dark-button public-class-button is-disabled" aria-disabled="true">{registrationLabel(item.status)}</span> : <a className="dark-button public-class-button" href="https://canvas.allenslane.org/">{registrationLabel(item.status)}</a>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="public-catalog-empty">No classes match those filters. Try a broader search.</p>}
    </section>
  );
}

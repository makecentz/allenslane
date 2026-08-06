"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { ContentEventEditor } from "./content-event-editor";

type ViewState = "loading" | "signed-out" | "mfa-required" | "denied" | "ready";
export type ContentItem = {
  id: string;
  content_type: string;
  slug: string;
  title: string;
  summary: string | null;
  body: Record<string, unknown>;
  status: string;
  hero_image_path: string | null;
  hero_image_alt: string | null;
  published_at: string | null;
  updated_at: string;
};
export type EventRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  facility_id: string | null;
  external_ticket_url: string | null;
  capacity: number | null;
  image_path: string | null;
  image_alt: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
};
export type Facility = { id: string; name: string };
type EventSummary = EventRow & { facilityName: string };

const allowedPermissions = new Set(["content.edit", "content.publish", "events.manage"]);
const contentTypes = ["page", "article", "profile", "production", "exhibition", "sponsor"];
const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function ContentEventsOverview() {
  const [referenceTime] = useState(() => Date.now());
  const [view, setView] = useState<ViewState>("loading");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [query, setQuery] = useState("");
  const [contentType, setContentType] = useState("all");
  const [contentStatus, setContentStatus] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadContentAndEvents() {
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
        setError("A Content or Events permission is required.");
        setView("denied");
        return;
      }

      const { data: permissionRows, error: permissionError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", roles);
      const canView = permissionRows?.some((row) => allowedPermissions.has(row.permission));
      if (permissionError || !canView) {
        setError(permissionError?.message ?? "A Content or Events permission is required.");
        setView("denied");
        return;
      }
      setPermissions(permissionRows?.map((row) => row.permission) ?? []);

      const [contentResult, eventResult, facilityResult] = await Promise.all([
        supabase.from("content_items").select("id,content_type,slug,title,summary,body,status,hero_image_path,hero_image_alt,published_at,updated_at").order("updated_at", { ascending: false }).limit(250),
        supabase.from("events").select("id,slug,title,summary,description,starts_at,ends_at,facility_id,external_ticket_url,capacity,image_path,image_alt,status,published_at,updated_at").order("starts_at", { ascending: true }).limit(250),
        supabase.from("facilities").select("id,name").order("name").limit(100),
      ]);

      if (!active) return;
      const firstError = [contentResult, eventResult, facilityResult].find((result) => result.error)?.error;
      if (firstError) {
        setError(firstError.message);
        setView("denied");
        return;
      }

      setContent((contentResult.data ?? []) as ContentItem[]);
      setEvents((eventResult.data ?? []) as EventRow[]);
      setFacilities((facilityResult.data ?? []) as Facility[]);
      setView("ready");
    }

    void loadContentAndEvents();
    return () => { active = false; };
  }, [refreshKey]);

  const eventSummaries = useMemo(() => {
    const facilityById = new Map(facilities.map((facility) => [facility.id, facility.name]));
    return events.map((event): EventSummary => ({
      ...event,
      facilityName: event.facility_id ? facilityById.get(event.facility_id) ?? "Facility unavailable" : "Location not assigned",
    }));
  }, [events, facilities]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredContent = useMemo(() => content.filter((item) => {
    const matchesQuery = !normalizedQuery || [item.title, item.slug, item.summary ?? "", item.content_type]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesQuery && (contentType === "all" || item.content_type === contentType) && (contentStatus === "all" || item.status === contentStatus);
  }), [content, contentStatus, contentType, normalizedQuery]);

  const filteredEvents = useMemo(() => eventSummaries.filter((event) => {
    const matchesQuery = !normalizedQuery || [event.title, event.slug, event.summary ?? "", event.facilityName]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesQuery && (eventStatus === "all" || event.status === eventStatus);
  }), [eventStatus, eventSummaries, normalizedQuery]);

  if (view === "loading") return <div className="content-ops-panel content-ops-loading" aria-live="polite">Loading protected content and event records…</div>;

  if (view !== "ready") {
    const messages = {
      "signed-out": ["Staff sign-in required", "Sign in through the staff portal before opening editorial and event records."],
      "mfa-required": ["Authenticator verification required", "Complete the second verification step in the staff portal, then return here."],
      denied: ["Content workspace unavailable", error || "Your current staff role does not include Content or Events access."],
    } as const;
    const [title, message] = messages[view];
    return (
      <section className={`content-ops-panel content-ops-gate${view === "denied" ? " content-ops-denied" : ""}`}>
        <p className="eyebrow">Protected publishing operations</p>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link className="dark-button" href="/staff">Return to staff portal</Link>
      </section>
    );
  }

  const publishedContent = content.filter((item) => item.status === "published").length;
  const awaitingReview = content.filter((item) => item.status === "review").length;
  const upcomingEvents = eventSummaries.filter((event) => new Date(event.starts_at).getTime() >= referenceTime && !["canceled", "archived"].includes(event.status)).length;
  const ticketLinks = eventSummaries.filter((event) => validExternalUrl(event.external_ticket_url)).length;

  return (
    <div className="content-ops-workspace">
      <section className="content-ops-panel content-ops-toolbar">
        <div>
          <p className="eyebrow">MFA verified / Role-scoped records</p>
          <h2>Publishing and event overview</h2>
        </div>
        <Link className="text-button" href="/staff">Back to staff portal</Link>
      </section>

      <aside className="content-ops-readonly-note">
        <strong>Audited publishing is active.</strong> Every saved change requires an operational reason. Editors can prepare drafts and submit reviews; publishing and archiving remain restricted to Content Publishers, while Event Managers control event status.
      </aside>

      <ContentEventEditor
        content={content}
        events={events}
        facilities={facilities}
        permissions={permissions}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />

      <section className="content-ops-metrics" aria-label="Content and events summary">
        <article><span>Published items</span><strong>{publishedContent}</strong></article>
        <article><span>Awaiting review</span><strong>{awaitingReview}</strong></article>
        <article><span>Upcoming events</span><strong>{upcomingEvents}</strong></article>
        <article><span>External ticket links</span><strong>{ticketLinks}</strong></article>
      </section>

      <section className="content-ops-panel content-ops-pipeline">
        <div>
          <p className="eyebrow">Editorial inventory</p>
          <h3>Content pipeline by type</h3>
        </div>
        <div className="content-ops-type-grid">
          {contentTypes.map((type) => {
            const items = content.filter((item) => item.content_type === type);
            return <article key={type}><span>{label(type)}</span><strong>{items.length}</strong><small>{items.filter((item) => item.status === "published").length} published</small></article>;
          })}
        </div>
      </section>

      <section className="content-ops-panel content-ops-records">
        <div className="content-ops-filter-row">
          <div>
            <p className="eyebrow">Editorial records</p>
            <h3>Pages, stories, profiles, and archives</h3>
            <p>{filteredContent.length} of {content.length} items shown</p>
          </div>
          <div className="content-ops-filter-controls">
            <label><span>Search records</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, slug, summary, or location" /></label>
            <label><span>Content type</span><select value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="all">All types</option>{contentTypes.map((type) => <option value={type} key={type}>{label(type)}</option>)}</select></label>
            <label><span>Publication status</span><select value={contentStatus} onChange={(event) => setContentStatus(event.target.value)}><option value="all">All statuses</option>{["draft", "review", "published", "archived"].map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label>
          </div>
        </div>
        {filteredContent.length > 0 ? (
          <div className="content-ops-table-scroll"><table><thead><tr><th scope="col">Content</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Hero media</th><th scope="col">Published</th><th scope="col">Updated</th></tr></thead><tbody>
            {filteredContent.map((item) => <tr key={item.id}>
              <td><strong>{item.title}</strong><small>/{item.slug}</small>{item.summary && <small>{item.summary}</small>}</td>
              <td>{label(item.content_type)}</td>
              <td><span className={`content-ops-status content-ops-status-${item.status}`}>{label(item.status)}</span></td>
              <td>{item.hero_image_path ? <span className="content-ops-media-state">Ready<small>{item.hero_image_alt ? "Alt text supplied" : "Alt text missing"}</small></span> : "Not assigned"}</td>
              <td>{item.published_at ? dateTime.format(new Date(item.published_at)) : "—"}</td>
              <td>{dateTime.format(new Date(item.updated_at))}</td>
            </tr>)}
          </tbody></table></div>
        ) : <p className="content-ops-empty">{content.length === 0 ? "No editorial content has been loaded yet." : "No editorial content matches these filters."}</p>}
      </section>

      <section className="content-ops-panel content-ops-records">
        <div className="content-ops-filter-row content-ops-event-filter">
          <div>
            <p className="eyebrow">Event calendar</p>
            <h3>Events and retained ticketing links</h3>
            <p>{filteredEvents.length} of {eventSummaries.length} events shown</p>
          </div>
          <div className="content-ops-filter-controls content-ops-event-controls">
            <label><span>Event status</span><select value={eventStatus} onChange={(event) => setEventStatus(event.target.value)}><option value="all">All statuses</option>{["draft", "published", "canceled", "completed", "archived"].map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label>
          </div>
        </div>
        {filteredEvents.length > 0 ? (
          <div className="content-ops-table-scroll"><table><thead><tr><th scope="col">Event</th><th scope="col">Schedule</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Capacity</th><th scope="col">Tickets</th></tr></thead><tbody>
            {filteredEvents.map((event) => {
              const ticketUrl = validExternalUrl(event.external_ticket_url);
              return <tr key={event.id}>
                <td><strong>{event.title}</strong><small>/{event.slug}</small>{event.summary && <small>{event.summary}</small>}</td>
                <td>{dateTime.format(new Date(event.starts_at))}{event.ends_at && <small>Ends {dateTime.format(new Date(event.ends_at))}</small>}</td>
                <td>{event.facilityName}</td>
                <td><span className={`content-ops-status content-ops-status-${event.status}`}>{label(event.status)}</span></td>
                <td>{event.capacity ?? "Not set"}</td>
                <td>{ticketUrl ? <a href={ticketUrl} target="_blank" rel="noreferrer">Open ticketing ↗</a> : "Not linked"}</td>
              </tr>;
            })}
          </tbody></table></div>
        ) : <p className="content-ops-empty">{eventSummaries.length === 0 ? "No events have been loaded yet." : "No events match these filters."}</p>}
        {(content.length === 250 || events.length === 250) && <p className="content-ops-limit-note">Showing up to 250 records per area. Server-side search and pagination will be added before content migration.</p>}
      </section>
    </div>
  );
}

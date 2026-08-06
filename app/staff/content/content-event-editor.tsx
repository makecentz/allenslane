"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { ContentItem, EventRow, Facility } from "./content-events-overview";

type EditorMode = "content" | "event";
type ContentForm = {
  id: string;
  contentType: string;
  slug: string;
  title: string;
  summary: string;
  bodyText: string;
  heroImagePath: string;
  heroImageAlt: string;
  status: string;
  reason: string;
};
type EventForm = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  facilityId: string;
  ticketUrl: string;
  capacity: string;
  imagePath: string;
  imageAlt: string;
  status: string;
  reason: string;
};

const contentTypes = ["page", "article", "profile", "production", "exhibition", "sponsor"];
const allContentStatuses = ["draft", "review", "published", "archived"];
const eventStatuses = ["draft", "published", "canceled", "completed", "archived"];

function emptyContentForm(): ContentForm {
  return {
    id: "",
    contentType: "page",
    slug: "",
    title: "",
    summary: "",
    bodyText: "",
    heroImagePath: "",
    heroImageAlt: "",
    status: "draft",
    reason: "",
  };
}

function emptyEventForm(): EventForm {
  return {
    id: "",
    slug: "",
    title: "",
    summary: "",
    description: "",
    startsAt: "",
    endsAt: "",
    timezone: "America/New_York",
    facilityId: "",
    ticketUrl: "",
    capacity: "",
    imagePath: "",
    imageAlt: "",
    status: "draft",
    reason: "",
  };
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function bodyText(item: ContentItem) {
  return typeof item.body.text === "string" ? item.body.text : JSON.stringify(item.body, null, 2);
}

export function ContentEventEditor({
  content,
  events,
  facilities,
  permissions,
  onSaved,
}: {
  content: ContentItem[];
  events: EventRow[];
  facilities: Facility[];
  permissions: string[];
  onSaved: () => void;
}) {
  const canEditContent = permissions.includes("content.edit") || permissions.includes("content.publish");
  const canPublish = permissions.includes("content.publish");
  const canManageEvents = permissions.includes("events.manage");
  const [mode, setMode] = useState<EditorMode>(canEditContent ? "content" : "event");
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContentForm);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEventForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const selectedContent = content.find((item) => item.id === contentForm.id);
  const contentLocked = Boolean(selectedContent && !canPublish && ["published", "archived"].includes(selectedContent.status));
  const contentStatuses = canPublish ? allContentStatuses : ["draft", "review"];

  function chooseContent(id: string) {
    const item = content.find((record) => record.id === id);
    if (!item) {
      setContentForm(emptyContentForm());
      setMessage("");
      return;
    }
    setContentForm({
      id: item.id,
      contentType: item.content_type,
      slug: item.slug,
      title: item.title,
      summary: item.summary ?? "",
      bodyText: bodyText(item),
      heroImagePath: item.hero_image_path ?? "",
      heroImageAlt: item.hero_image_alt ?? "",
      status: item.status,
      reason: "",
    });
    setMessage("");
  }

  function chooseEvent(id: string) {
    const item = events.find((record) => record.id === id);
    if (!item) {
      setEventForm(emptyEventForm());
      setMessage("");
      return;
    }
    setEventForm({
      id: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.summary ?? "",
      description: item.description ?? "",
      startsAt: toLocalInput(item.starts_at),
      endsAt: toLocalInput(item.ends_at),
      timezone: "America/New_York",
      facilityId: item.facility_id ?? "",
      ticketUrl: item.external_ticket_url ?? "",
      capacity: item.capacity?.toString() ?? "",
      imagePath: item.image_path ?? "",
      imageAlt: item.image_alt ?? "",
      status: item.status,
      reason: "",
    });
    setMessage("");
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("save_content_item", {
      p_item_id: contentForm.id || null,
      p_content_type: contentForm.contentType,
      p_slug: contentForm.slug,
      p_title: contentForm.title,
      p_summary: contentForm.summary,
      p_body: { text: contentForm.bodyText },
      p_hero_image_path: contentForm.heroImagePath,
      p_hero_image_alt: contentForm.heroImageAlt,
      p_status: contentForm.status,
      p_change_reason: contentForm.reason,
    });
    setSaving(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    setMessage(contentForm.id ? "Content changes saved and audited." : "Content item created and audited.");
    setContentForm(emptyContentForm());
    onSaved();
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("save_event", {
      p_event_id: eventForm.id || null,
      p_slug: eventForm.slug,
      p_title: eventForm.title,
      p_summary: eventForm.summary,
      p_description: eventForm.description,
      p_starts_at: toIso(eventForm.startsAt),
      p_ends_at: toIso(eventForm.endsAt),
      p_timezone: eventForm.timezone,
      p_facility_id: eventForm.facilityId || null,
      p_external_ticket_url: eventForm.ticketUrl,
      p_capacity: eventForm.capacity === "" ? null : Number(eventForm.capacity),
      p_image_path: eventForm.imagePath,
      p_image_alt: eventForm.imageAlt,
      p_status: eventForm.status,
      p_change_reason: eventForm.reason,
    });
    setSaving(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    setMessage(eventForm.id ? "Event changes saved and audited." : "Event created and audited.");
    setEventForm(emptyEventForm());
    onSaved();
  }

  if (!canEditContent && !canManageEvents) return null;

  return (
    <section className="content-ops-panel content-editor-panel">
      <div className="content-editor-heading">
        <div>
          <p className="eyebrow">Guarded write workflow</p>
          <h3>Audited publishing workspace</h3>
          <p>Create a new record or select an existing one. Every save is permission-checked in the database and recorded in the audit trail.</p>
        </div>
        <div className="content-editor-tabs" role="tablist" aria-label="Publishing record type">
          {canEditContent && <button type="button" role="tab" aria-selected={mode === "content"} onClick={() => { setMode("content"); setMessage(""); }}>Content</button>}
          {canManageEvents && <button type="button" role="tab" aria-selected={mode === "event"} onClick={() => { setMode("event"); setMessage(""); }}>Events</button>}
        </div>
      </div>

      {mode === "content" && canEditContent ? (
        <form className="content-editor-form" onSubmit={saveContent}>
          <label className="content-editor-wide"><span>Record</span><select value={contentForm.id} onChange={(event) => chooseContent(event.target.value)}><option value="">Create new content</option>{content.map((item) => <option value={item.id} key={item.id}>{item.title} · {label(item.status)}</option>)}</select></label>
          <label><span>Content type</span><select value={contentForm.contentType} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, contentType: event.target.value }))}>{contentTypes.map((type) => <option value={type} key={type}>{label(type)}</option>)}</select></label>
          <label><span>Status</span><select value={contentForm.status} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, status: event.target.value }))}>{!contentStatuses.includes(contentForm.status) && <option value={contentForm.status}>{label(contentForm.status)} · Publisher required</option>}{contentStatuses.map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label>
          <label className="content-editor-wide"><span>Title</span><input required value={contentForm.title} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, title: event.target.value, slug: form.slug || slugify(event.target.value) }))} /></label>
          <label className="content-editor-wide"><span>Slug</span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={contentForm.slug} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, slug: slugify(event.target.value) }))} /></label>
          <label className="content-editor-wide"><span>Summary</span><textarea rows={3} value={contentForm.summary} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, summary: event.target.value }))} /></label>
          <label className="content-editor-wide"><span>Body</span><textarea rows={8} value={contentForm.bodyText} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, bodyText: event.target.value }))} /></label>
          <label><span>Hero image path</span><input value={contentForm.heroImagePath} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, heroImagePath: event.target.value }))} /></label>
          <label><span>Hero image alt text</span><input value={contentForm.heroImageAlt} disabled={contentLocked} onChange={(event) => setContentForm((form) => ({ ...form, heroImageAlt: event.target.value }))} /></label>
          {contentLocked ? <p className="content-editor-lock content-editor-wide">This record is published or archived. A Content Publisher must make further changes.</p> : <label className="content-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={contentForm.reason} onChange={(event) => setContentForm((form) => ({ ...form, reason: event.target.value }))} placeholder="Explain why this change is being made (minimum 10 characters)" /></label>}
          {!contentLocked && <div className="content-editor-actions content-editor-wide"><button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving..." : contentForm.id ? "Save content changes" : "Create content item"}</button><button className="text-button" type="button" onClick={() => { setContentForm(emptyContentForm()); setMessage(""); }}>Clear form</button></div>}
        </form>
      ) : canManageEvents ? (
        <form className="content-editor-form" onSubmit={saveEvent}>
          <label className="content-editor-wide"><span>Record</span><select value={eventForm.id} onChange={(event) => chooseEvent(event.target.value)}><option value="">Create new event</option>{events.map((item) => <option value={item.id} key={item.id}>{item.title} · {label(item.status)}</option>)}</select></label>
          <label className="content-editor-wide"><span>Title</span><input required value={eventForm.title} onChange={(event) => setEventForm((form) => ({ ...form, title: event.target.value, slug: form.slug || slugify(event.target.value) }))} /></label>
          <label><span>Slug</span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={eventForm.slug} onChange={(event) => setEventForm((form) => ({ ...form, slug: slugify(event.target.value) }))} /></label>
          <label><span>Status</span><select value={eventForm.status} onChange={(event) => setEventForm((form) => ({ ...form, status: event.target.value }))}>{eventStatuses.map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label>
          <label className="content-editor-wide"><span>Summary</span><textarea rows={3} value={eventForm.summary} onChange={(event) => setEventForm((form) => ({ ...form, summary: event.target.value }))} /></label>
          <label className="content-editor-wide"><span>Description</span><textarea rows={6} value={eventForm.description} onChange={(event) => setEventForm((form) => ({ ...form, description: event.target.value }))} /></label>
          <label><span>Starts</span><input required type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm((form) => ({ ...form, startsAt: event.target.value }))} /></label>
          <label><span>Ends</span><input type="datetime-local" value={eventForm.endsAt} onChange={(event) => setEventForm((form) => ({ ...form, endsAt: event.target.value }))} /></label>
          <label><span>Timezone</span><select value={eventForm.timezone} onChange={(event) => setEventForm((form) => ({ ...form, timezone: event.target.value }))}><option value="America/New_York">Eastern Time · America/New_York</option></select></label>
          <label><span>Facility</span><select value={eventForm.facilityId} onChange={(event) => setEventForm((form) => ({ ...form, facilityId: event.target.value }))}><option value="">Location not assigned</option>{facilities.map((facility) => <option value={facility.id} key={facility.id}>{facility.name}</option>)}</select></label>
          <label><span>Capacity</span><input type="number" min="0" step="1" value={eventForm.capacity} onChange={(event) => setEventForm((form) => ({ ...form, capacity: event.target.value }))} /></label>
          <label><span>External ticket URL</span><input type="url" pattern="https://.*" placeholder="https://" value={eventForm.ticketUrl} onChange={(event) => setEventForm((form) => ({ ...form, ticketUrl: event.target.value }))} /></label>
          <label><span>Image path</span><input value={eventForm.imagePath} onChange={(event) => setEventForm((form) => ({ ...form, imagePath: event.target.value }))} /></label>
          <label><span>Image alt text</span><input value={eventForm.imageAlt} onChange={(event) => setEventForm((form) => ({ ...form, imageAlt: event.target.value }))} /></label>
          <label className="content-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={eventForm.reason} onChange={(event) => setEventForm((form) => ({ ...form, reason: event.target.value }))} placeholder="Explain why this change is being made (minimum 10 characters)" /></label>
          <div className="content-editor-actions content-editor-wide"><button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving..." : eventForm.id ? "Save event changes" : "Create event"}</button><button className="text-button" type="button" onClick={() => { setEventForm(emptyEventForm()); setMessage(""); }}>Clear form</button></div>
        </form>
      ) : null}

      {message && <p className={`content-editor-message${isError ? " content-editor-error" : ""}`} role={isError ? "alert" : "status"}>{message}</p>}
    </section>
  );
}

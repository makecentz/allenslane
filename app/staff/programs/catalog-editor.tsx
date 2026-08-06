"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { ClassRow, Facility, Program, Term } from "./programs-overview";

type Mode = "program" | "term" | "facility" | "class";

const emptyProgram = { id: "", parentId: "", code: "", name: "", description: "", audience: "", status: "draft", displayOrder: "0", reason: "" };
const emptyTerm = { id: "", code: "", name: "", startsOn: "", endsOn: "", registrationOpensAt: "", registrationClosesAt: "", status: "draft", reason: "" };
const emptyFacility = { id: "", code: "", name: "", addressText: "", capacity: "", status: "active", reason: "" };
const emptyClass = {
  id: "", programId: "", termId: "", facilityId: "", code: "", slug: "", title: "", summary: "", description: "", level: "",
  ageMin: "", ageMax: "", capacity: "0", minimumEnrollment: "0", price: "0", memberPrice: "", fee: "0",
  registrationOpensAt: "", registrationClosesAt: "", startsAt: "", endsAt: "", timezone: "America/New_York",
  imagePath: "", imageAlt: "", status: "draft", glAccountCode: "", reason: "",
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}

export function CatalogEditor({
  programs,
  terms,
  facilities,
  classes,
  permissions,
  onSaved,
}: {
  programs: Program[];
  terms: Term[];
  facilities: Facility[];
  classes: ClassRow[];
  permissions: string[];
  onSaved: () => void;
}) {
  const canManage = permissions.includes("catalog.manage");
  const canPublish = permissions.includes("catalog.publish");
  const [mode, setMode] = useState<Mode>(canManage ? "program" : "class");
  const [programForm, setProgramForm] = useState(emptyProgram);
  const [termForm, setTermForm] = useState(emptyTerm);
  const [facilityForm, setFacilityForm] = useState(emptyFacility);
  const [classForm, setClassForm] = useState(emptyClass);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const selectedProgram = programs.find((item) => item.id === programForm.id);
  const programLocked = Boolean(selectedProgram && !canPublish && ["published", "archived"].includes(selectedProgram.status));
  const selectedClass = classes.find((item) => item.id === classForm.id);
  const classLocked = Boolean(selectedClass && !canPublish && selectedClass.status === "archived");
  const classStatuses = canPublish
    ? ["draft", "published", "open", "waitlist", "closed", "canceled", "completed", "archived"]
    : selectedClass && selectedClass.status !== "draft"
      ? ["published", "open", "waitlist", "closed", "canceled", "completed"]
      : ["draft", "canceled", "completed"];

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
  }

  function chooseProgram(id: string) {
    const item = programs.find((record) => record.id === id);
    setMessage("");
    if (!item) return setProgramForm(emptyProgram);
    setProgramForm({
      id: item.id, parentId: item.parent_id ?? "", code: item.code, name: item.name,
      description: item.description ?? "", audience: item.audience ?? "", status: item.status,
      displayOrder: item.display_order.toString(), reason: "",
    });
  }

  function chooseTerm(id: string) {
    const item = terms.find((record) => record.id === id);
    setMessage("");
    if (!item) return setTermForm(emptyTerm);
    setTermForm({
      id: item.id, code: item.code, name: item.name, startsOn: item.starts_on, endsOn: item.ends_on,
      registrationOpensAt: toLocalInput(item.registration_opens_at), registrationClosesAt: toLocalInput(item.registration_closes_at),
      status: item.status, reason: "",
    });
  }

  function chooseFacility(id: string) {
    const item = facilities.find((record) => record.id === id);
    setMessage("");
    if (!item) return setFacilityForm(emptyFacility);
    setFacilityForm({
      id: item.id, code: item.code, name: item.name, addressText: item.address_text ?? "",
      capacity: item.capacity?.toString() ?? "", status: item.status, reason: "",
    });
  }

  function chooseClass(id: string) {
    const item = classes.find((record) => record.id === id);
    setMessage("");
    if (!item) return setClassForm(emptyClass);
    setClassForm({
      id: item.id, programId: item.program_id, termId: item.term_id, facilityId: item.facility_id ?? "",
      code: item.code, slug: item.slug, title: item.title, summary: item.summary ?? "", description: item.description ?? "",
      level: item.level ?? "", ageMin: item.age_min?.toString() ?? "", ageMax: item.age_max?.toString() ?? "",
      capacity: item.capacity.toString(), minimumEnrollment: item.minimum_enrollment.toString(), price: item.price.toString(),
      memberPrice: item.member_price?.toString() ?? "", fee: item.fee.toString(),
      registrationOpensAt: toLocalInput(item.registration_opens_at), registrationClosesAt: toLocalInput(item.registration_closes_at),
      startsAt: toLocalInput(item.starts_at), endsAt: toLocalInput(item.ends_at), timezone: item.timezone,
      imagePath: item.image_path ?? "", imageAlt: item.image_alt ?? "", status: item.status,
      glAccountCode: item.gl_account_code ?? "", reason: "",
    });
  }

  async function finishSave(error: { message: string } | null, successMessage: string, reset: () => void) {
    setSaving(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    setIsError(false);
    setMessage(successMessage);
    reset();
    onSaved();
  }

  async function saveProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("save_program", {
      p_program_id: programForm.id || null, p_parent_id: programForm.parentId || null,
      p_code: programForm.code, p_name: programForm.name, p_description: programForm.description,
      p_audience: programForm.audience, p_status: programForm.status,
      p_display_order: Number(programForm.displayOrder), p_change_reason: programForm.reason,
    });
    await finishSave(error, programForm.id ? "Program changes saved and audited." : "Program created and audited.", () => setProgramForm(emptyProgram));
  }

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("save_term", {
      p_term_id: termForm.id || null, p_code: termForm.code, p_name: termForm.name,
      p_starts_on: termForm.startsOn, p_ends_on: termForm.endsOn,
      p_registration_opens_at: toIso(termForm.registrationOpensAt), p_registration_closes_at: toIso(termForm.registrationClosesAt),
      p_status: termForm.status, p_change_reason: termForm.reason,
    });
    await finishSave(error, termForm.id ? "Term changes saved and audited." : "Term created and audited.", () => setTermForm(emptyTerm));
  }

  async function saveFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("save_facility", {
      p_facility_id: facilityForm.id || null, p_code: facilityForm.code, p_name: facilityForm.name,
      p_address_text: facilityForm.addressText, p_capacity: numberOrNull(facilityForm.capacity),
      p_status: facilityForm.status, p_change_reason: facilityForm.reason,
    });
    await finishSave(error, facilityForm.id ? "Facility changes saved and audited." : "Facility created and audited.", () => setFacilityForm(emptyFacility));
  }

  async function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("save_class", {
      p_class_id: classForm.id || null, p_program_id: classForm.programId, p_term_id: classForm.termId,
      p_facility_id: classForm.facilityId || null, p_code: classForm.code, p_slug: classForm.slug,
      p_title: classForm.title, p_summary: classForm.summary, p_description: classForm.description, p_level: classForm.level,
      p_age_min: numberOrNull(classForm.ageMin), p_age_max: numberOrNull(classForm.ageMax),
      p_capacity: Number(classForm.capacity), p_minimum_enrollment: Number(classForm.minimumEnrollment),
      p_price: Number(classForm.price), p_member_price: numberOrNull(classForm.memberPrice), p_fee: Number(classForm.fee),
      p_registration_opens_at: toIso(classForm.registrationOpensAt), p_registration_closes_at: toIso(classForm.registrationClosesAt),
      p_starts_at: toIso(classForm.startsAt), p_ends_at: toIso(classForm.endsAt), p_timezone: classForm.timezone,
      p_image_path: classForm.imagePath, p_image_alt: classForm.imageAlt, p_status: classForm.status,
      p_gl_account_code: classForm.glAccountCode, p_change_reason: classForm.reason,
    });
    await finishSave(error, classForm.id ? "Class changes saved and audited." : "Class created and audited.", () => setClassForm(emptyClass));
  }

  if (!canManage && !canPublish) return null;

  return (
    <section className="programs-panel catalog-editor-panel">
      <div className="catalog-editor-heading">
        <div><p className="eyebrow">Guarded catalog workflow</p><h3>Audited catalog workspace</h3><p>Create or select a record. Every save is permission-checked in the database and written to the audit trail.</p></div>
        <div className="catalog-editor-tabs" role="tablist" aria-label="Catalog record type">
          <button type="button" role="tab" aria-selected={mode === "program"} onClick={() => selectMode("program")}>Programs</button>
          {canManage && <button type="button" role="tab" aria-selected={mode === "term"} onClick={() => selectMode("term")}>Terms</button>}
          {canManage && <button type="button" role="tab" aria-selected={mode === "facility"} onClick={() => selectMode("facility")}>Facilities</button>}
          <button type="button" role="tab" aria-selected={mode === "class"} onClick={() => selectMode("class")}>Classes</button>
        </div>
      </div>

      {mode === "program" ? <form className="catalog-editor-form" onSubmit={saveProgram}>
        <label className="catalog-editor-wide"><span>Record</span><select value={programForm.id} onChange={(event) => chooseProgram(event.target.value)}><option value="">Create new program</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.name} · {label(item.status)}</option>)}</select></label>
        <label><span>Code</span><input required pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" disabled={programLocked} value={programForm.code} onChange={(event) => setProgramForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} /></label>
        <label><span>Status</span><select disabled={programLocked} value={programForm.status} onChange={(event) => setProgramForm((form) => ({ ...form, status: event.target.value }))}>{!canPublish && !["draft"].includes(programForm.status) && <option value={programForm.status}>{label(programForm.status)} · Publisher required</option>}{(canPublish ? ["draft", "published", "archived"] : ["draft"]).map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="catalog-editor-wide"><span>Name</span><input required disabled={programLocked} value={programForm.name} onChange={(event) => setProgramForm((form) => ({ ...form, name: event.target.value }))} /></label>
        <label><span>Parent program</span><select disabled={programLocked} value={programForm.parentId} onChange={(event) => setProgramForm((form) => ({ ...form, parentId: event.target.value }))}><option value="">No parent</option>{programs.filter((item) => item.id !== programForm.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Display order</span><input type="number" step="1" disabled={programLocked} value={programForm.displayOrder} onChange={(event) => setProgramForm((form) => ({ ...form, displayOrder: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Audience</span><input disabled={programLocked} value={programForm.audience} onChange={(event) => setProgramForm((form) => ({ ...form, audience: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Description</span><textarea rows={5} disabled={programLocked} value={programForm.description} onChange={(event) => setProgramForm((form) => ({ ...form, description: event.target.value }))} /></label>
        {programLocked ? <p className="catalog-editor-lock catalog-editor-wide">A Catalog Publisher must change this published or archived program.</p> : <label className="catalog-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={programForm.reason} onChange={(event) => setProgramForm((form) => ({ ...form, reason: event.target.value }))} /></label>}
        {!programLocked && <div className="catalog-editor-actions catalog-editor-wide"><button className="dark-button" disabled={saving}>{saving ? "Saving..." : programForm.id ? "Save program" : "Create program"}</button><button className="text-button" type="button" onClick={() => setProgramForm(emptyProgram)}>Clear</button></div>}
      </form> : null}

      {mode === "term" && canManage ? <form className="catalog-editor-form" onSubmit={saveTerm}>
        <label className="catalog-editor-wide"><span>Record</span><select value={termForm.id} onChange={(event) => chooseTerm(event.target.value)}><option value="">Create new term</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.name} · {label(item.status)}</option>)}</select></label>
        <label><span>Code</span><input required value={termForm.code} onChange={(event) => setTermForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} /></label>
        <label><span>Status</span><select value={termForm.status} onChange={(event) => setTermForm((form) => ({ ...form, status: event.target.value }))}>{["draft", "open", "closed", "archived"].map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="catalog-editor-wide"><span>Name</span><input required value={termForm.name} onChange={(event) => setTermForm((form) => ({ ...form, name: event.target.value }))} /></label>
        <label><span>Starts</span><input required type="date" value={termForm.startsOn} onChange={(event) => setTermForm((form) => ({ ...form, startsOn: event.target.value }))} /></label>
        <label><span>Ends</span><input required type="date" value={termForm.endsOn} onChange={(event) => setTermForm((form) => ({ ...form, endsOn: event.target.value }))} /></label>
        <label><span>Registration opens</span><input type="datetime-local" value={termForm.registrationOpensAt} onChange={(event) => setTermForm((form) => ({ ...form, registrationOpensAt: event.target.value }))} /></label>
        <label><span>Registration closes</span><input type="datetime-local" value={termForm.registrationClosesAt} onChange={(event) => setTermForm((form) => ({ ...form, registrationClosesAt: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={termForm.reason} onChange={(event) => setTermForm((form) => ({ ...form, reason: event.target.value }))} /></label>
        <div className="catalog-editor-actions catalog-editor-wide"><button className="dark-button" disabled={saving}>{saving ? "Saving..." : termForm.id ? "Save term" : "Create term"}</button><button className="text-button" type="button" onClick={() => setTermForm(emptyTerm)}>Clear</button></div>
      </form> : null}

      {mode === "facility" && canManage ? <form className="catalog-editor-form" onSubmit={saveFacility}>
        <label className="catalog-editor-wide"><span>Record</span><select value={facilityForm.id} onChange={(event) => chooseFacility(event.target.value)}><option value="">Create new facility</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name} · {label(item.status)}</option>)}</select></label>
        <label><span>Code</span><input required value={facilityForm.code} onChange={(event) => setFacilityForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} /></label>
        <label><span>Status</span><select value={facilityForm.status} onChange={(event) => setFacilityForm((form) => ({ ...form, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="catalog-editor-wide"><span>Name</span><input required value={facilityForm.name} onChange={(event) => setFacilityForm((form) => ({ ...form, name: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Address or room details</span><textarea rows={3} value={facilityForm.addressText} onChange={(event) => setFacilityForm((form) => ({ ...form, addressText: event.target.value }))} /></label>
        <label><span>Capacity</span><input type="number" min="0" step="1" value={facilityForm.capacity} onChange={(event) => setFacilityForm((form) => ({ ...form, capacity: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={facilityForm.reason} onChange={(event) => setFacilityForm((form) => ({ ...form, reason: event.target.value }))} /></label>
        <div className="catalog-editor-actions catalog-editor-wide"><button className="dark-button" disabled={saving}>{saving ? "Saving..." : facilityForm.id ? "Save facility" : "Create facility"}</button><button className="text-button" type="button" onClick={() => setFacilityForm(emptyFacility)}>Clear</button></div>
      </form> : null}

      {mode === "class" ? <form className="catalog-editor-form" onSubmit={saveClass}>
        <label className="catalog-editor-wide"><span>Record</span><select value={classForm.id} onChange={(event) => chooseClass(event.target.value)}><option value="">Create new class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title} · {label(item.status)}</option>)}</select></label>
        {programs.length === 0 || terms.length === 0 ? <p className="catalog-editor-lock catalog-editor-wide">Create at least one program and term before creating a class.</p> : null}
        <label><span>Program</span><select required disabled={classLocked} value={classForm.programId} onChange={(event) => setClassForm((form) => ({ ...form, programId: event.target.value }))}><option value="">Select program</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Term</span><select required disabled={classLocked} value={classForm.termId} onChange={(event) => setClassForm((form) => ({ ...form, termId: event.target.value }))}><option value="">Select term</option>{terms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Code</span><input required disabled={classLocked} value={classForm.code} onChange={(event) => setClassForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))} /></label>
        <label><span>Status</span><select disabled={classLocked} value={classForm.status} onChange={(event) => setClassForm((form) => ({ ...form, status: event.target.value }))}>{classStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="catalog-editor-wide"><span>Title</span><input required disabled={classLocked} value={classForm.title} onChange={(event) => setClassForm((form) => ({ ...form, title: event.target.value, slug: form.slug || slugify(event.target.value) }))} /></label>
        <label className="catalog-editor-wide"><span>Slug</span><input required disabled={classLocked} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={classForm.slug} onChange={(event) => setClassForm((form) => ({ ...form, slug: slugify(event.target.value) }))} /></label>
        <label className="catalog-editor-wide"><span>Summary</span><textarea rows={3} disabled={classLocked} value={classForm.summary} onChange={(event) => setClassForm((form) => ({ ...form, summary: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Description</span><textarea rows={5} disabled={classLocked} value={classForm.description} onChange={(event) => setClassForm((form) => ({ ...form, description: event.target.value }))} /></label>
        <label><span>Level</span><input disabled={classLocked} value={classForm.level} onChange={(event) => setClassForm((form) => ({ ...form, level: event.target.value }))} /></label>
        <label><span>Facility</span><select disabled={classLocked} value={classForm.facilityId} onChange={(event) => setClassForm((form) => ({ ...form, facilityId: event.target.value }))}><option value="">Not assigned</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Minimum age</span><input type="number" min="0" step="0.5" disabled={classLocked} value={classForm.ageMin} onChange={(event) => setClassForm((form) => ({ ...form, ageMin: event.target.value }))} /></label>
        <label><span>Maximum age</span><input type="number" min="0" step="0.5" disabled={classLocked} value={classForm.ageMax} onChange={(event) => setClassForm((form) => ({ ...form, ageMax: event.target.value }))} /></label>
        <label><span>Capacity</span><input required type="number" min="0" step="1" disabled={classLocked} value={classForm.capacity} onChange={(event) => setClassForm((form) => ({ ...form, capacity: event.target.value }))} /></label>
        <label><span>Minimum enrollment</span><input required type="number" min="0" step="1" disabled={classLocked} value={classForm.minimumEnrollment} onChange={(event) => setClassForm((form) => ({ ...form, minimumEnrollment: event.target.value }))} /></label>
        <label><span>Price</span><input required type="number" min="0" step="0.01" disabled={classLocked} value={classForm.price} onChange={(event) => setClassForm((form) => ({ ...form, price: event.target.value }))} /></label>
        <label><span>Member price</span><input type="number" min="0" step="0.01" disabled={classLocked} value={classForm.memberPrice} onChange={(event) => setClassForm((form) => ({ ...form, memberPrice: event.target.value }))} /></label>
        <label><span>Additional fee</span><input required type="number" min="0" step="0.01" disabled={classLocked} value={classForm.fee} onChange={(event) => setClassForm((form) => ({ ...form, fee: event.target.value }))} /></label>
        <label><span>GL account code</span><input disabled={classLocked} value={classForm.glAccountCode} onChange={(event) => setClassForm((form) => ({ ...form, glAccountCode: event.target.value }))} /></label>
        <label><span>Registration opens</span><input type="datetime-local" disabled={classLocked} value={classForm.registrationOpensAt} onChange={(event) => setClassForm((form) => ({ ...form, registrationOpensAt: event.target.value }))} /></label>
        <label><span>Registration closes</span><input type="datetime-local" disabled={classLocked} value={classForm.registrationClosesAt} onChange={(event) => setClassForm((form) => ({ ...form, registrationClosesAt: event.target.value }))} /></label>
        <label><span>Class starts</span><input type="datetime-local" disabled={classLocked} value={classForm.startsAt} onChange={(event) => setClassForm((form) => ({ ...form, startsAt: event.target.value }))} /></label>
        <label><span>Class ends</span><input type="datetime-local" disabled={classLocked} value={classForm.endsAt} onChange={(event) => setClassForm((form) => ({ ...form, endsAt: event.target.value }))} /></label>
        <label><span>Timezone</span><select disabled={classLocked} value={classForm.timezone} onChange={(event) => setClassForm((form) => ({ ...form, timezone: event.target.value }))}><option value="America/New_York">Eastern Time · America/New_York</option></select></label>
        <label><span>Image path</span><input disabled={classLocked} value={classForm.imagePath} onChange={(event) => setClassForm((form) => ({ ...form, imagePath: event.target.value }))} /></label>
        <label className="catalog-editor-wide"><span>Image alt text</span><input disabled={classLocked} value={classForm.imageAlt} onChange={(event) => setClassForm((form) => ({ ...form, imageAlt: event.target.value }))} /></label>
        {classLocked ? <p className="catalog-editor-lock catalog-editor-wide">A Catalog Publisher must change this archived class.</p> : <label className="catalog-editor-wide"><span>Operational reason</span><textarea required minLength={10} rows={2} value={classForm.reason} onChange={(event) => setClassForm((form) => ({ ...form, reason: event.target.value }))} /></label>}
        {!classLocked && <div className="catalog-editor-actions catalog-editor-wide"><button className="dark-button" disabled={saving || programs.length === 0 || terms.length === 0}>{saving ? "Saving..." : classForm.id ? "Save class" : "Create class"}</button><button className="text-button" type="button" onClick={() => setClassForm(emptyClass)}>Clear</button></div>}
      </form> : null}

      {message && <p className={`catalog-editor-message${isError ? " catalog-editor-error" : ""}`} role={isError ? "alert" : "status"}>{message}</p>}
    </section>
  );
}

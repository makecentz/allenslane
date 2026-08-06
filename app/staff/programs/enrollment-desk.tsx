"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type EnrollmentRecordType = "hold" | "registration" | "waitlist";
type EnrollmentRecord = {
  id: string;
  record_type: EnrollmentRecordType;
  class_id: string;
  class_code: string;
  class_title: string;
  checkout_mode: "internal" | "external";
  participant_person_id: string;
  participant_name: string;
  household_id: string;
  household_name: string;
  status: string;
  amount: number | string | null;
  occurred_at: string;
  expires_at: string | null;
  reason: string | null;
};

type EnrollmentAction = "cancel" | "offer" | "remove" | "return_to_waiting";
type ActionOption = { value: EnrollmentAction; label: string };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "The enrollment action could not be completed.";
}

function actionsFor(record: EnrollmentRecord): ActionOption[] {
  if (record.checkout_mode === "external") return [];
  if (record.record_type === "hold" && record.status === "active") {
    return [{ value: "cancel", label: "Release hold" }];
  }
  if (record.record_type === "registration" && ["pending", "registered", "transferred"].includes(record.status)) {
    return [{ value: "cancel", label: "Cancel registration" }];
  }
  if (record.record_type === "waitlist" && record.status === "waiting") {
    return [
      { value: "offer", label: "Offer available seat" },
      { value: "remove", label: "Remove from waitlist" },
    ];
  }
  if (record.record_type === "waitlist" && record.status === "offered") {
    return [
      { value: "return_to_waiting", label: "Return to waiting" },
      { value: "remove", label: "Remove from waitlist" },
    ];
  }
  if (record.record_type === "waitlist" && record.status === "expired") {
    return [{ value: "return_to_waiting", label: "Return to waiting" }];
  }
  return [];
}

export function EnrollmentDesk({ enabled }: { enabled: boolean }) {
  const [records, setRecords] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [recordType, setRecordType] = useState("active");
  const [selected, setSelected] = useState<EnrollmentRecord | null>(null);
  const [action, setAction] = useState<EnrollmentAction | "">("");
  const [reason, setReason] = useState("");
  const [offerHours, setOfferHours] = useState("48");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function loadRecords() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await getSupabaseBrowserClient()
        .from("enrollment_desk_entries")
        .select("id,record_type,class_id,class_code,class_title,checkout_mode,participant_person_id,participant_name,household_id,household_name,status,amount,occurred_at,expires_at,reason")
        .order("occurred_at", { ascending: false })
        .limit(1000);

      if (!active) return;
      if (loadError) {
        setError(loadError.message);
        setRecords([]);
      } else {
        setRecords((data ?? []) as EnrollmentRecord[]);
      }
      setLoading(false);
    }

    void loadRecords();
    return () => { active = false; };
  }, [enabled, refreshKey]);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const isActive = record.status === "active" || record.status === "waiting" || record.status === "offered" || record.status === "pending" || record.status === "registered" || record.status === "transferred";
      const matchesType = recordType === "all" || (recordType === "active" ? isActive : record.record_type === recordType);
      const matchesSearch = !needle || [record.class_code, record.class_title, record.participant_name, record.household_name, record.status]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesType && matchesSearch;
    });
  }, [query, recordType, records]);

  const activeHolds = records.filter((record) => record.record_type === "hold" && record.status === "active" && (!record.expires_at || new Date(record.expires_at) > new Date())).length;
  const activeRegistrations = records.filter((record) => record.record_type === "registration" && ["pending", "registered", "transferred"].includes(record.status)).length;
  const waiting = records.filter((record) => record.record_type === "waitlist" && record.status === "waiting").length;
  const offered = records.filter((record) => record.record_type === "waitlist" && record.status === "offered" && (!record.expires_at || new Date(record.expires_at) > new Date())).length;
  const selectedActions = selected ? actionsFor(selected) : [];

  function chooseRecord(record: EnrollmentRecord, nextAction?: EnrollmentAction) {
    const options = actionsFor(record);
    setSelected(record);
    setAction(nextAction ?? options[0]?.value ?? "");
    setReason("");
    setOfferHours("48");
    setError("");
    setNotice("");
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !action) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: actionError } = await getSupabaseBrowserClient().rpc("manage_enrollment_record", {
        p_record_type: selected.record_type,
        p_record_id: selected.id,
        p_action: action,
        p_reason: reason,
        p_offer_hours: Number(offerHours),
      });
      if (actionError) throw actionError;
      setNotice(`${label(selected.record_type)} updated successfully. The reason was saved in the audit log.`);
      setSelected(null);
      setAction("");
      setReason("");
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) return null;

  return (
    <section className="programs-panel enrollment-desk" aria-labelledby="enrollment-desk-heading">
      <div className="programs-filter-row">
        <div>
          <p className="eyebrow">Native enrollment operations</p>
          <h3 id="enrollment-desk-heading">Enrollment Desk</h3>
          <p>Review holds, registrations, and waitlists. Canvas-managed classes remain read-only.</p>
        </div>
        <div className="programs-filter-controls">
          <label>
            <span>Search enrollment</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Class, participant, or household" />
          </label>
          <label>
            <span>Record type</span>
            <select value={recordType} onChange={(event) => setRecordType(event.target.value)}>
              <option value="active">Active activity</option>
              <option value="all">All activity</option>
              <option value="hold">Holds</option>
              <option value="registration">Registrations</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </label>
        </div>
      </div>

      <div className="enrollment-metrics" aria-label="Enrollment operations summary">
        <div><span>Active holds</span><strong>{activeHolds}</strong></div>
        <div><span>Registrations</span><strong>{activeRegistrations}</strong></div>
        <div><span>Waiting</span><strong>{waiting}</strong></div>
        <div><span>Offers out</span><strong>{offered}</strong></div>
      </div>

      {notice ? <p className="form-notice" role="status">{notice}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {loading ? <p className="programs-empty" role="status">Loading enrollment activity…</p> : visibleRecords.length > 0 ? (
        <div className="programs-table-scroll">
          <table>
            <thead><tr><th>Participant</th><th>Class</th><th>Record</th><th>Timing</th><th>Action</th></tr></thead>
            <tbody>
              {visibleRecords.map((record) => {
                const options = actionsFor(record);
                return (
                  <tr key={`${record.record_type}-${record.id}`}>
                    <td><strong>{record.participant_name}</strong><small>{record.household_name}</small></td>
                    <td><strong>{record.class_title}</strong><small>{record.class_code}</small></td>
                    <td><span className={`programs-status programs-status-${record.status}`}>{label(record.status)}</span><small>{label(record.record_type)}{record.amount !== null ? ` · ${currency.format(Number(record.amount))}` : ""}</small></td>
                    <td>{dateTime.format(new Date(record.occurred_at))}<small>{record.expires_at ? `Expires ${dateTime.format(new Date(record.expires_at))}` : record.reason || "No deadline"}</small></td>
                    <td>{options.length > 0 ? (
                      <button className="text-button" type="button" onClick={() => chooseRecord(record)}>Manage</button>
                    ) : <small>{record.checkout_mode === "external" ? "Canvas managed" : "No action available"}</small>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="programs-empty">No native enrollment activity matches this view. Canvas registrations continue in Canvas until cutover.</p>}

      {selected ? (
        <form className="enrollment-action-form" onSubmit={submitAction}>
          <div>
            <p className="eyebrow">Audited staff action</p>
            <h4>{selected.participant_name} · {selected.class_title}</h4>
          </div>
          <label>
            <span>Action</span>
            <select value={action} onChange={(event) => setAction(event.target.value as EnrollmentAction)} required>
              {selectedActions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          {action === "offer" ? (
            <label>
              <span>Offer window</span>
              <select value={offerHours} onChange={(event) => setOfferHours(event.target.value)}>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">7 days</option>
              </select>
            </label>
          ) : null}
          <label className="enrollment-reason-field">
            <span>Operational reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required placeholder="Explain why this enrollment record is changing." />
          </label>
          <div className="household-form-actions">
            <button className="dark-button" type="submit" disabled={saving || reason.trim().length < 10}>{saving ? "Saving…" : "Confirm action"}</button>
            <button className="text-button" type="button" onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("data/imports/canvas-classes-2026-08-06.json");
const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error("Pass the migration SQL output path as the first argument.");
}

const sourceRows = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const months = new Map([
  ["January", "01"], ["February", "02"], ["March", "03"], ["April", "04"],
  ["May", "05"], ["June", "06"], ["July", "07"], ["August", "08"],
  ["September", "09"], ["October", "10"], ["November", "11"], ["December", "12"],
]);

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function money(value) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid money value: ${value}`);
  return parsed;
}

function localDate(month, day, year) {
  const monthNumber = months.get(month);
  if (!monthNumber) throw new Error(`Unknown month: ${month}`);
  return `${year}-${monthNumber}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(value) {
  const cleaned = value
    .replace(/^[A-Za-z]+s?,\s*/, "")
    .replace(/\s*\(\d+ sessions?\)\s*$/, "")
    .trim();

  let match = cleaned.match(/^([A-Za-z]+) (\d{1,2}) - ([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (match) {
    return {
      startsOn: localDate(match[1], Number(match[2]), Number(match[5])),
      endsOn: localDate(match[3], Number(match[4]), Number(match[5])),
    };
  }

  match = cleaned.match(/^([A-Za-z]+) (\d{1,2}) - (\d{1,2}), (\d{4})$/);
  if (match) {
    return {
      startsOn: localDate(match[1], Number(match[2]), Number(match[4])),
      endsOn: localDate(match[1], Number(match[3]), Number(match[4])),
    };
  }

  match = cleaned.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (match) {
    const date = localDate(match[1], Number(match[2]), Number(match[3]));
    return { startsOn: date, endsOn: date };
  }

  throw new Error(`Unsupported date range: ${value}`);
}

function parseClock(value) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) throw new Error(`Unsupported time: ${value}`);
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2] || "00"}:00`;
}

function parseTimeRange(value) {
  const parts = value.split(/\s+[–-]\s+/);
  if (parts.length !== 2) throw new Error(`Unsupported time range: ${value}`);
  return { startsAt: parseClock(parts[0]), endsAt: parseClock(parts[1]) };
}

function parseAge(value) {
  const range = value.match(/Ages\s+(\d+)\s+year-(\d+)\s+year/i);
  if (range) return { ageMin: Number(range[1]), ageMax: Number(range[2]) };
  const minimum = value.match(/Ages\s+(\d+)\s+year\+/i);
  if (minimum) return { ageMin: Number(minimum[1]), ageMax: null };
  return { ageMin: null, ageMax: null };
}

function facilityCode(value) {
  return new Map([
    ["Ceramics Handbuilding", "CER-HANDBUILDING"],
    ["Ceramics Wheel", "CER-WHEEL"],
    ["Studio 1", "STUDIO-1"],
    ["Studio 2", "STUDIO-2"],
    ["Theater", "THEATER"],
  ]).get(value) ?? null;
}

function programCode(row) {
  if (row.code.startsWith("26U-SC-")) return "SUMMER-CAMP";
  if (row.code.startsWith("26F-5-")) return "YOUTH-ART";
  return "ADULT-ART";
}

function sourceStatus(row) {
  if (row.waitlist_only || /waitlist/i.test(row.action)) return "waitlist";
  if (row.is_full) return "full";
  return "open";
}

const normalized = sourceRows.map((row) => {
  const dates = parseDateRange(row.schedule[0]);
  const times = parseTimeRange(row.schedule[1]);
  const ages = parseAge(row.level_age);
  const feeText = row.fees[0] || "";
  const feeLabel = feeText.match(/\(([^)]+)\)/)?.[1] ?? null;
  const imageUrl = [row.detail_image_url, row.image_url]
    .find((value) => value && !value.startsWith("data:")) ?? null;

  return {
    legacy_id: row.canvas_id,
    program_code: programCode(row),
    term_code: row.code.startsWith("26F-") ? "2026-FALL" : "2026-SUMMER",
    facility_code: facilityCode(row.location),
    code: row.code,
    slug: `${slugify(row.title)}-${row.canvas_id}`,
    title: row.title,
    level: row.level_age.split(",")[0]?.trim() || null,
    age_min: ages.ageMin,
    age_max: ages.ageMax,
    price: money(row.price_text),
    member_price: money(row.member_price_text),
    fee: money(feeText) ?? 0,
    fee_label: feeLabel,
    starts_local: `${dates.startsOn} ${times.startsAt}`,
    ends_local: `${dates.endsOn} ${times.endsAt}`,
    image_path: imageUrl,
    image_alt: imageUrl ? row.title : null,
    external_registration_url: row.detail_url,
    instructor_display_text: row.instructor,
    source_schedule_text: row.schedule.join(" | "),
    source_location_text: row.location,
    source_category: row.category || null,
    delivery_mode: row.delivery || null,
    source_registration_status: sourceStatus(row),
    source_metadata: {
      canvas_id: row.canvas_id,
      category: row.category || null,
      delivery: row.delivery || null,
      instructor: row.instructor,
      schedule: row.schedule,
      location: row.location,
      level_age: row.level_age,
      price: row.price_text,
      member_price: row.member_price_text,
      fees: row.fees,
      action: row.action,
      is_full: row.is_full,
      waitlist_only: row.waitlist_only,
      detail_url: row.detail_url,
      image_url: imageUrl,
    },
  };
});

if (normalized.length !== 56) throw new Error(`Expected 56 classes, found ${normalized.length}.`);
if (new Set(normalized.map((row) => row.legacy_id)).size !== normalized.length) throw new Error("Duplicate Canvas IDs found.");
if (new Set(normalized.map((row) => row.code)).size !== normalized.length) throw new Error("Duplicate class codes found.");

const json = JSON.stringify(normalized, null, 2);
const sql = `begin;

alter table public.classes
  add column checkout_mode text not null default 'internal',
  add column external_registration_url text,
  add column instructor_display_text text,
  add column source_schedule_text text,
  add column source_location_text text,
  add column source_category text,
  add column delivery_mode text,
  add column fee_label text,
  add column source_capacity_known boolean not null default true,
  add column source_registration_status text,
  add column source_metadata jsonb not null default '{}'::jsonb,
  add column source_synced_at timestamptz;

alter table public.classes
  add constraint classes_checkout_mode_check
    check (checkout_mode in ('internal', 'external')),
  add constraint classes_external_registration_url_check
    check (external_registration_url is null or external_registration_url ~ '^https://'),
  add constraint classes_external_checkout_url_required
    check (checkout_mode = 'internal' or external_registration_url is not null),
  add constraint classes_external_checkout_status_check
    check (checkout_mode = 'internal' or status not in ('open', 'waitlist')),
  add constraint classes_source_registration_status_check
    check (source_registration_status is null or source_registration_status in ('open', 'waitlist', 'full', 'closed'));

insert into public.programs (code, name, description, audience, status, display_order, legacy_source, legacy_id)
values
  ('ADULT-ART', 'Adult Art Classes', 'Ceramics, drawing, painting, printmaking, and mixed-media classes for adults.', 'Adults ages 18+', 'published', 10, 'art_center_canvas', 'adult-programs'),
  ('YOUTH-ART', 'Youth Art Classes', 'After-school and school-day-off art classes for young artists.', 'Youth ages 6-18', 'published', 20, 'art_center_canvas', 'youth-programs'),
  ('SUMMER-CAMP', 'Summer Art Camp', 'Weeklong summer art camp programs for children and teens.', 'Youth ages 5-16', 'published', 30, 'art_center_canvas', 'summer-camps')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  audience = excluded.audience,
  status = excluded.status,
  display_order = excluded.display_order,
  legacy_source = excluded.legacy_source,
  legacy_id = excluded.legacy_id,
  updated_at = now();

insert into public.terms (code, name, starts_on, ends_on, status)
values
  ('2026-SUMMER', 'Summer 2026', '2026-06-18', '2026-08-10', 'open'),
  ('2026-FALL', 'Fall 2026', '2026-09-08', '2026-11-15', 'open')
on conflict (code) do update set
  name = excluded.name,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  updated_at = now();

insert into public.facilities (code, name, address_text, status)
values
  ('CER-HANDBUILDING', 'Ceramics Handbuilding', 'Allens Lane Art Center ceramics studio', 'active'),
  ('CER-WHEEL', 'Ceramics Wheel', 'Allens Lane Art Center ceramics studio', 'active'),
  ('STUDIO-1', 'Studio 1', 'Allens Lane Art Center', 'active'),
  ('STUDIO-2', 'Studio 2', 'Allens Lane Art Center', 'active'),
  ('THEATER', 'Theater', 'Allens Lane Art Center', 'active')
on conflict (code) do update set
  name = excluded.name,
  address_text = excluded.address_text,
  status = excluded.status,
  updated_at = now();

with source_rows as (
  select *
  from jsonb_to_recordset($canvas_catalog$
${json}
$canvas_catalog$::jsonb) as row_data (
    legacy_id text,
    program_code text,
    term_code text,
    facility_code text,
    code text,
    slug text,
    title text,
    level text,
    age_min numeric,
    age_max numeric,
    price numeric,
    member_price numeric,
    fee numeric,
    fee_label text,
    starts_local text,
    ends_local text,
    image_path text,
    image_alt text,
    external_registration_url text,
    instructor_display_text text,
    source_schedule_text text,
    source_location_text text,
    source_category text,
    delivery_mode text,
    source_registration_status text,
    source_metadata jsonb
  )
)
insert into public.classes (
  program_id, term_id, facility_id, code, slug, title, level,
  age_min, age_max, capacity, minimum_enrollment, price, member_price, fee,
  starts_at, ends_at, timezone, image_path, image_alt, status, published_at,
  legacy_source, legacy_id, checkout_mode, external_registration_url,
  instructor_display_text, source_schedule_text, source_location_text,
  source_category, delivery_mode, fee_label, source_capacity_known,
  source_registration_status, source_metadata, source_synced_at
)
select
  (select p.id from public.programs p where p.code = source_rows.program_code),
  (select t.id from public.terms t where t.code = source_rows.term_code),
  (select f.id from public.facilities f where f.code = source_rows.facility_code),
  source_rows.code,
  source_rows.slug,
  source_rows.title,
  source_rows.level,
  source_rows.age_min,
  source_rows.age_max,
  0,
  0,
  source_rows.price,
  source_rows.member_price,
  source_rows.fee,
  timezone('America/New_York', source_rows.starts_local::timestamp),
  timezone('America/New_York', source_rows.ends_local::timestamp),
  'America/New_York',
  source_rows.image_path,
  source_rows.image_alt,
  'published',
  now(),
  'art_center_canvas',
  source_rows.legacy_id,
  'external',
  source_rows.external_registration_url,
  source_rows.instructor_display_text,
  source_rows.source_schedule_text,
  source_rows.source_location_text,
  source_rows.source_category,
  source_rows.delivery_mode,
  source_rows.fee_label,
  false,
  source_rows.source_registration_status,
  source_rows.source_metadata,
  '2026-08-06 20:45:00+00'::timestamptz
from source_rows
on conflict (legacy_source, legacy_id)
where legacy_source is not null and legacy_id is not null
do update set
  program_id = excluded.program_id,
  term_id = excluded.term_id,
  facility_id = excluded.facility_id,
  code = excluded.code,
  slug = excluded.slug,
  title = excluded.title,
  level = excluded.level,
  age_min = excluded.age_min,
  age_max = excluded.age_max,
  capacity = excluded.capacity,
  minimum_enrollment = excluded.minimum_enrollment,
  price = excluded.price,
  member_price = excluded.member_price,
  fee = excluded.fee,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  timezone = excluded.timezone,
  image_path = excluded.image_path,
  image_alt = excluded.image_alt,
  status = excluded.status,
  published_at = coalesce(public.classes.published_at, excluded.published_at),
  checkout_mode = excluded.checkout_mode,
  external_registration_url = excluded.external_registration_url,
  instructor_display_text = excluded.instructor_display_text,
  source_schedule_text = excluded.source_schedule_text,
  source_location_text = excluded.source_location_text,
  source_category = excluded.source_category,
  delivery_mode = excluded.delivery_mode,
  fee_label = excluded.fee_label,
  source_capacity_known = excluded.source_capacity_known,
  source_registration_status = excluded.source_registration_status,
  source_metadata = excluded.source_metadata,
  source_synced_at = excluded.source_synced_at,
  updated_at = now();

notify pgrst, 'reload schema';

commit;
`;

fs.writeFileSync(path.resolve(outputPath), sql);
console.log(`Generated ${normalized.length} Canvas class rows at ${outputPath}`);

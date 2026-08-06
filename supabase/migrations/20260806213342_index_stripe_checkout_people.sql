begin;

create index payment_checkout_sessions_participant_idx
  on public.payment_checkout_sessions (participant_person_id);

create index payment_checkout_sessions_purchaser_idx
  on public.payment_checkout_sessions (purchaser_person_id);

commit;

-- LOOP OUT Stage 3: authorize authenticated players in the two mode channels.
-- Private channels are named loopout:open_world and loopout:small_arena.
-- This only adds policies; it does not modify existing application tables or policies.

drop policy if exists "LOOP OUT authenticated room read" on realtime.messages;
create policy "LOOP OUT authenticated room read"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) in ('loopout:open_world', 'loopout:small_arena')
  and extension in ('broadcast', 'presence')
);

drop policy if exists "LOOP OUT authenticated room write" on realtime.messages;
create policy "LOOP OUT authenticated room write"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) in ('loopout:open_world', 'loopout:small_arena')
  and extension in ('broadcast', 'presence')
);

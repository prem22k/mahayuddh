-- Step 27 — gate board and squad picker (follow-up to 20261003000029).
--
-- 00029 defined one function per §58 gate so each could be reasoned about and
-- tested on its own. Something still has to read them together, and doing that
-- with five round-trips from the browser would mean five chances for the page to
-- show a half-filled board — four gates rendered and one missing, which reads
-- as a finding. So the board is assembled server-side in one call.
--
-- The qualitative gate is absent here by design. It has no row, and the page
-- carries it as explicitly unmeasurable rather than letting its absence imply it
-- was counted and lost.

create or replace function public.validation_gate_board(p_squad_id uuid default null)
returns table (gate text, passed boolean, measured text, detail text)
language sql stable security definer set search_path = public as $$
  select * from public.gate_activation(p_squad_id)
  union all select * from public.gate_social(p_squad_id)
  union all select * from public.gate_learning(p_squad_id)
  union all select * from public.gate_retention(p_squad_id)
  union all select * from public.gate_organic(p_squad_id)
$$;

-- Squads worth reviewing: at least one member. An empty squad has no gate
-- verdicts, and listing it in a picker would only ever offer a blank row.
create or replace function public.validation_squads()
returns table (squad_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name
  from public.squads s
  where exists (select 1 from public.squad_members m where m.squad_id = s.id)
  order by s.name
$$;

comment on function public.validation_gate_board(uuid) is
  'All §58 gates in one call. Omits the qualitative gate, which has no automated answer; the page carries it as unmeasurable.';

grant execute on function public.validation_gate_board(uuid) to anon, authenticated;
grant execute on function public.validation_squads() to anon, authenticated;

-- Season objective measurement (honest-data gaps).
--
-- squad_seasons.objective is free text ("41 of 40 graph problems"), which the
-- squad page used to render as a confident claim with no measurement behind
-- it. These two columns make the objective measurable when the squad sets it:
-- objective_target is the number to hit, objective_pattern optionally scopes
-- the count to one pattern (matched against the problems catalog topics).
-- Both nullable: existing seasons and text-only objectives keep rendering as
-- before, and a "N ... problems" parse of the free text is only ever a
-- labeled fallback, never a measurement.

alter table public.squad_seasons
  add column if not exists objective_target int
    check (objective_target is null or objective_target > 0);
alter table public.squad_seasons
  add column if not exists objective_pattern text
    check (objective_pattern is null or char_length(objective_pattern) between 1 and 80);

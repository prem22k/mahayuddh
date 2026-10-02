-- Close the §24 logging loop.
--
-- Two problems with recommendation_log as first written.
--
-- 1. Accounting. logRecommendationShown inserted a row with decision 'shown'
--    and logRecommendationDecision inserted ANOTHER row with decision
--    'accepted'. One accepted recommendation therefore counted twice, so three
--    shown and one accepted read as 1/4 = 25% when the true rate is 1/3.
--    A metric that is wrong by construction cannot validate a weight, which was
--    the entire reason for logging.
--
-- 2. Why_json stored prose. §24 says the point is "to validate signal weights",
--    but a bullet like "prereq met: Arrays, Hash Table." cannot be attributed
--    to a signal. The signal ids are stored alongside now, so the readout can
--    answer which reasons actually lead to somebody starting a battle.
--
-- signal_ids is additive; the prose stays because it is what a human debugging
--    a bad recommendation needs to read.

alter table public.recommendation_log add column if not exists signal_ids text[];

comment on column public.recommendation_log.signal_ids is
  '§24: the RecommendationSignal ids behind this suggestion, so accept rate can be attributed per signal. Why_json holds the same reasons as prose for human debugging.';

-- Backfill nothing: the pre-existing rows predate signal_ids and guessing their
-- signal ids from prose would be exactly the kind of invented attribution this
-- project keeps refusing.
-- Fix public.discussion_is_actionable.
--
-- Two defects, found by probing the live function rather than reading it.
--
-- 1. The connective was wrong. The expression was
--        (action word) OR (low-quality phrase)
--    so matching a phrase from §51's low-quality list made a post ACTIONABLE.
--    The intent is the opposite: has an action, AND is not one of the shapes
--    §51 names as low quality.
--
-- 2. The low-quality clause never fired at all. Every low-quality phrase the
--    probe tried came back rejected, which looked like the clause working — it
--    was working by accident, because those phrases also contain no action word
--    and clause one was doing all the rejecting. A post that mixed both, like
--    "Try this, but check this out", was accepted.
--
-- So the previous behaviour was right for the wrong reason on the cases the
-- integration test happened to use, and wrong for the mixed cases it did not.
-- The integration test now covers the mixed case.

create or replace function public.discussion_is_actionable(p_body text)
returns boolean language sql immutable as $$
  select
    -- A question, or something the reader could be told to do.
    (
      p_body ~* '\?'
      or p_body ~* '(try|attempt|start|read|look at|compare|sketch|draw|write|explain|watch|notice|give up|revisit|practice)'
    )
    -- And none of the shapes §51 calls low quality: generic "I solved #100"
    -- posts, engagement bait, referral spam.
    and p_body !~* '(i solved|solved it|solved that|solved the problem|check this out|follow me|dm me|help me win|referral|boost|pls|plz)'
$$;

comment on function public.discussion_is_actionable(text) is
  '§51 actionability: has a question or an action for the reader, and is not one of the low-quality shapes the section names. Conjunction is deliberate — matching a low-quality phrase must REJECT, not accept.';
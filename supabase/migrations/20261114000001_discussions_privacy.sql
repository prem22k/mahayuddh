-- Squad-only discussions were readable by everyone: the select policy was just
-- `deleted_at is null`, so a thread posted with visibility = 'squad' showed up
-- in every squad's feed and in Global. Replies inherited the same leak.
--
-- Now a discussion is readable when it is global, when you wrote it, or when
-- you are in its squad. A reply is readable when its discussion is.

drop policy if exists "Discussions publicly readable" on public.discussions;
drop policy if exists "Discussions readable by visibility" on public.discussions;
create policy "Discussions readable by visibility" on public.discussions for select
  using (
    deleted_at is null
    and (
      visibility = 'global'
      or (select auth.uid()) = author_id
      or (
        squad_id is not null
        and exists (
          select 1 from public.squad_members m
          where m.squad_id = discussions.squad_id
            and m.user_id = (select auth.uid())
        )
      )
    )
  );

-- The subquery runs under the reader's RLS, so it sees exactly the
-- discussions the policy above lets them see.
drop policy if exists "Replies publicly readable" on public.discussion_replies;
drop policy if exists "Replies readable with their discussion" on public.discussion_replies;
create policy "Replies readable with their discussion" on public.discussion_replies for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.discussions d
      where d.id = discussion_replies.discussion_id
    )
  );

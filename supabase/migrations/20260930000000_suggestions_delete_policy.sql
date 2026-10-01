-- Phase 0 Step 1: suggestions sender-delete policy.
-- Missing DELETE coverage: either party could UPDATE but nobody could DELETE,
-- leaving stale pending challenges undeletable. Sender may delete own pending
-- rows; completed/dismissed history is append-only (no delete).
drop policy if exists "Users can delete own sent suggestions" on public.suggestions;
create policy "Users can delete own sent suggestions"
  on public.suggestions for delete
  using ((select auth.uid()) = from_user and status = 'pending');

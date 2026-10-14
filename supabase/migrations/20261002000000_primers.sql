-- Phase 2 Step 12: primers, the "learn before battle" layer (Bible §14, §15).
-- Primer = BEFORE solving. Skimmable, one concept, immediately usable.

create table if not exists public.primers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  pattern text not null,
  title text not null check (char_length(title) between 1 and 120),
  recognize_when text[] default '{}' not null,
  mental_model text,
  template_md text,
  complexity text,
  mistakes text[] default '{}' not null,
  starter_slugs text[] default '{}' not null,
  author_id uuid references public.profiles(id) on delete set null,
  visibility text check (visibility in ('squad', 'public')) default 'public' not null,
  squad_id uuid references public.squads(id) on delete set null,
  created_at timestamp with time zone default now()
);
create index if not exists primers_pattern_idx on public.primers (pattern);

alter table public.primers enable row level security;

-- Same sharing shape as approaches: public readable, squad visible to members.
create policy "Public primers readable" on public.primers for select using (visibility = 'public');
create policy "Squad primers readable" on public.primers for select
  using (
    visibility = 'squad' and squad_id is not null and exists (
      select 1 from public.squad_members
      where squad_members.squad_id = primers.squad_id
      and squad_members.user_id = (select auth.uid())
    )
  );
create policy "Owners see own primers" on public.primers for select
  using ((select auth.uid()) = author_id);
create policy "Users can create primers" on public.primers for insert
  with check ((select auth.uid()) = author_id);
create policy "Owners can manage primers" on public.primers for update
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "Owners can delete primers" on public.primers for delete
  using ((select auth.uid()) = author_id);

-- Seed: 5 hand-written primers (no AI filler, Bible §45). Public, authorless.
insert into public.primers (slug, pattern, title, recognize_when, mental_model, template_md, complexity, mistakes, starter_slugs, visibility) values
('sliding-window', 'Sliding Window', 'Sliding Window in 8 minutes',
 ARRAY['The problem works over a contiguous subarray or substring',
       'A left and right boundary both move, never backwards',
       'You maintain a constraint or property over the current window'],
 'left → [ current window ] ← right

Expand right to include. Shrink left while the constraint is violated. Every index enters and leaves once: O(n).',
 'Decide: fixed size or variable size. Fixed: move both ends together, compare each window. Variable: expand right, then shrink left until valid again, track the best valid window. Keep a frequency map or running sum for the window contents.',
 'Time O(n), space O(k) for the window state (often O(1) or O(26)/O(128)).',
 ARRAY['Shrinking left with if instead of while — most windows need a loop',
       'Forgetting to remove the left element from the running state when shrinking',
       'Off-by-one on window length: it is right - left + 1'],
 ARRAY['longest-substring-without-repeating-characters', 'minimum-window-substring', 'sliding-window-maximum'],
 'public'),
('two-pointers', 'Two Pointers', 'Two Pointers in 8 minutes',
 ARRAY['The input is sorted, or can be sorted without breaking the question',
       'You compare or combine elements from two positions',
       'A decision at one end lets you discard that end safely'],
 'lo → [ ............ ] ← hi

Move the pointer that cannot be part of a better answer. Sorted order is what makes discarding safe.',
 'Opposite ends: while lo < hi, check the pair, then move the side the logic eliminates. Same direction (fast/slow): advance fast, move slow only when the condition holds — used for removal and cycle detection.',
 'Time O(n) after sort, space O(1) extra.',
 ARRAY['Using two pointers on unsorted data where order matters for the answer',
       'Moving the wrong pointer in container/2sum variants — re-derive the discard rule',
       'Missing duplicates handling in 3Sum-style enumeration'],
 ARRAY['valid-palindrome', '3sum', 'container-with-most-water'],
 'public'),
('stack', 'Stack', 'Stack in 8 minutes',
 ARRAY['The most recent unmatched item decides what happens next',
       'You need to undo, backtrack, or match nested pairs',
       'Phrases like next greater, valid parentheses, or evaluate appear'],
 'push → [ top ] → pop

The top of the stack is always the nearest unresolved past. Push candidates, pop when they resolve.',
 'Iterate once. Push onto the stack when you see an opener or candidate. When you see a closer or trigger, pop and process. A monotonic stack keeps elements in increasing or decreasing order by popping violators first.',
 'Time O(n), space O(n) worst case.',
 ARRAY['Popping from an empty stack — always guard before peeking',
       'Pushing the wrong thing in monotonic problems (push values when you need indices)',
       'Forgetting leftover stack contents after the loop ends'],
 ARRAY['valid-parentheses', 'evaluate-reverse-polish-notation', 'generate-parentheses'],
 'public'),
('graphs-bfs', 'Graphs', 'Graph BFS in 8 minutes',
 ARRAY['Entities plus relationships: grids, maps, networks, prerequisites',
       'Shortest path in unweighted steps, or level-by-level spread',
       'Words like islands, connected, clone, schedule, or word ladder'],
 'queue: [ start ] → visit → enqueue unseen neighbors → repeat

BFS expands in rings. The first time you reach a node, it is via the shortest path. A visited set stops infinite loops.',
 'Start from the source, push into a queue, mark visited immediately on enqueue (not on dequeue). Pop, process, enqueue all unvisited neighbors. For grids, the neighbor loop is the four directions with bounds checks.',
 'Time O(V + E), space O(V) for queue plus visited set.',
 ARRAY['Marking visited on dequeue instead of enqueue — nodes get queued many times',
       'Forgetting bounds checks on grid neighbors',
       'Using DFS when the question asks for shortest path or minimum steps'],
 ARRAY['number-of-islands', 'clone-graph', 'course-schedule'],
 'public'),
('dp-1d', 'Dynamic Programming', '1D DP in 8 minutes',
 ARRAY['The problem asks for optimal count, min, max, or ways',
       'The answer for position i depends only on earlier positions',
       'Brute force recurses with massive repeated subproblems'],
 'dp[i] = best answer for prefix ending at i

Define the state in words first. Find the recurrence. Decide the iteration order so dependencies are already computed.',
 'State: what dp[i] means, in one sentence. Recurrence: dp[i] from dp[i-1], dp[i-2], or a min/max over earlier j. Base cases: dp[0] and dp[1] by hand. Optimize space when you only need the last one or two values.',
 'Time O(n) or O(n·k), space O(n) — often O(1) with rolling variables.',
 ARRAY['Writing the recurrence before defining what dp[i] means',
       'Wrong iteration order — dependencies must be computed first',
       'Forgetting base cases, or initializing them off by one'],
 ARRAY['climbing-stairs', 'house-robber', 'coin-change'],
 'public')
on conflict (slug) do nothing;

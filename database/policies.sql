-- =====================================================================
-- My Expense Tracker - Row Level Security (RLS) policies
-- Run this SECOND (after schema.sql) in the Supabase SQL Editor.
-- =====================================================================
-- With RLS on, the database itself refuses to show or change any row
-- unless a policy allows it. Each policy below says:
-- "you may only touch rows where user_id equals YOUR logged-in id".

alter table public.transactions enable row level security;
alter table public.transactions force row level security;

-- Remove old versions so this file can be run again safely.
drop policy if exists "Users can read own transactions"   on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

create policy "Users can read own transactions"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Visitors who are not logged in get no access at all.
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;

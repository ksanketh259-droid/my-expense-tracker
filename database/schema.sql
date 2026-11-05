-- =====================================================================
-- My Expense Tracker - database schema
-- Run this FIRST in: Supabase dashboard -> SQL Editor -> New query
-- =====================================================================

create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),

  -- Owner of the row. Defaults to the logged-in user's id and is deleted
  -- automatically if that user account is deleted.
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,

  type             text not null check (type in ('income', 'expense')),
  amount           numeric(12, 2) not null check (amount > 0),
  category         text not null check (category in
                     ('Food', 'Transport', 'Education', 'Shopping',
                      'Healthcare', 'Bills', 'Entertainment', 'Other')),
  description      text not null check (char_length(description) between 1 and 120),
  transaction_date date not null default current_date,
  payment_method   text not null default 'Cash' check (payment_method in
                     ('Cash', 'UPI', 'Card', 'Net Banking', 'Other')),
  notes            text check (notes is null or char_length(notes) <= 500),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes make the common queries fast.
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);
create index if not exists transactions_user_type_idx
  on public.transactions (user_id, type);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category);

-- Keep updated_at correct whenever a row is edited.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create table if not exists public.garcom_carrinhos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id text not null,
  canal text not null default 'whatsapp',
  cliente_nome text,
  cliente_telefone text,
  itens jsonb not null default '[]'::jsonb,
  tipo_atendimento text,
  endereco text,
  forma_pagamento text,
  status text not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists garcom_carrinhos_aberto_unique
  on public.garcom_carrinhos(company_id, conversation_id, status)
  where status = 'aberto';

create index if not exists idx_garcom_carrinhos_company_conversation
  on public.garcom_carrinhos(company_id, conversation_id);

alter table public.garcom_carrinhos enable row level security;

drop policy if exists "Garcom carrinhos: gerenciar por empresa" on public.garcom_carrinhos;
create policy "Garcom carrinhos: gerenciar por empresa"
on public.garcom_carrinhos
for all
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop trigger if exists update_garcom_carrinhos_updated_at on public.garcom_carrinhos;
create trigger update_garcom_carrinhos_updated_at
before update on public.garcom_carrinhos
for each row
execute function public.update_updated_at_column();

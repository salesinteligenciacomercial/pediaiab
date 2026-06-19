create table if not exists public.entregadores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  telefone text,
  foto_url text,
  veiculo text default 'moto',
  status text default 'ativo',
  pct_comissao numeric(5,2) default 10.00,
  pix_chave text,
  avaliacao_media numeric(3,2) default 5.00,
  online boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pedidos
  add column if not exists entregador_id uuid references public.entregadores(id) on delete set null,
  add column if not exists valor_comissao numeric(10,2),
  add column if not exists aceito_entregador_em timestamptz,
  add column if not exists entregue_em timestamptz;

create table if not exists public.entregador_candidaturas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  entregador_id uuid not null references public.entregadores(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text default 'pendente',
  ofertado_em timestamptz default now(),
  aceito_em timestamptz,
  expira_em timestamptz default (now() + interval '60 seconds')
);

create table if not exists public.entregador_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  entregador_id uuid not null references public.entregadores(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  nota integer check (nota between 1 and 5),
  comentario text,
  avaliado_por text default 'restaurante',
  created_at timestamptz default now()
);

create table if not exists public.entregador_pagamentos (
  id uuid primary key default gen_random_uuid(),
  entregador_id uuid not null references public.entregadores(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  periodo_inicio date,
  periodo_fim date,
  total_entregas integer default 0,
  valor_bruto numeric(10,2) default 0,
  valor_pago numeric(10,2) default 0,
  pago_em timestamptz,
  status text default 'pendente',
  created_at timestamptz default now()
);

alter table public.entregadores enable row level security;
alter table public.entregador_candidaturas enable row level security;
alter table public.entregador_avaliacoes enable row level security;
alter table public.entregador_pagamentos enable row level security;

create index if not exists idx_entregadores_company on public.entregadores(company_id);
create index if not exists idx_entregadores_status_online on public.entregadores(status, online);
create index if not exists idx_entregador_candidaturas_pedido on public.entregador_candidaturas(pedido_id);
create index if not exists idx_entregador_candidaturas_entregador_status on public.entregador_candidaturas(entregador_id, status);
create index if not exists idx_entregador_pagamentos_entregador_status on public.entregador_pagamentos(entregador_id, status);
create index if not exists idx_pedidos_entregador on public.pedidos(entregador_id) where entregador_id is not null;

drop trigger if exists update_entregadores_updated_at on public.entregadores;
create trigger update_entregadores_updated_at
before update on public.entregadores
for each row
execute function public.update_updated_at_column();

create policy "Usuarios podem gerenciar entregadores da empresa"
on public.entregadores
for all
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create policy "Usuarios podem gerenciar candidaturas da empresa"
on public.entregador_candidaturas
for all
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create policy "Usuarios podem gerenciar avaliacoes da empresa"
on public.entregador_avaliacoes
for all
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create policy "Usuarios podem gerenciar pagamentos da empresa"
on public.entregador_pagamentos
for all
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create policy "Entregadores podem ver proprio cadastro"
on public.entregadores
for select
using (user_id = auth.uid());

create policy "Entregadores podem atualizar proprio status"
on public.entregadores
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Entregadores podem ver pedidos atribuidos"
on public.pedidos
for select
using (
  exists (
    select 1
    from public.entregadores e
    where e.id = pedidos.entregador_id
      and e.user_id = auth.uid()
  )
);

create policy "Entregadores podem concluir pedidos atribuidos"
on public.pedidos
for update
using (
  exists (
    select 1
    from public.entregadores e
    where e.id = pedidos.entregador_id
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.entregadores e
    where e.id = pedidos.entregador_id
      and e.user_id = auth.uid()
  )
);

create policy "Entregadores podem ver itens dos pedidos atribuidos"
on public.pedido_itens
for select
using (
  exists (
    select 1
    from public.pedidos p
    join public.entregadores e on e.id = p.entregador_id
    where p.id = pedido_itens.pedido_id
      and e.user_id = auth.uid()
  )
);

create policy "Entregadores podem ver enderecos dos pedidos atribuidos"
on public.pedido_enderecos
for select
using (
  exists (
    select 1
    from public.pedidos p
    join public.entregadores e on e.id = p.entregador_id
    where p.id = pedido_enderecos.pedido_id
      and e.user_id = auth.uid()
  )
);

create or replace function public.link_entregador_by_phone(p_phone text)
returns public.entregadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_match text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11);
  v_entregador public.entregadores;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_entregador
  from public.entregadores
  where user_id = auth.uid()
    and status = 'ativo'
    and (
      regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_clean
      or right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_match
    )
  order by created_at desc
  limit 1;

  if v_entregador.id is not null then
    return v_entregador;
  end if;

  update public.entregadores
  set user_id = auth.uid(),
      updated_at = now()
  where id = (
    select id
    from public.entregadores
    where user_id is null
      and (
        regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_clean
        or right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_match
      )
      and status = 'ativo'
    order by created_at desc
    limit 1
  )
  returning * into v_entregador;

  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;

  return v_entregador;
end;
$$;

grant execute on function public.link_entregador_by_phone(text) to authenticated;

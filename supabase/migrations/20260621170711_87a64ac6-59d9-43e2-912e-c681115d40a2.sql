
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregadores TO authenticated;
GRANT SELECT, UPDATE ON public.entregadores TO anon;
GRANT ALL ON public.entregadores TO service_role;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregador_candidaturas TO authenticated;
GRANT ALL ON public.entregador_candidaturas TO service_role;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregador_avaliacoes TO authenticated;
GRANT ALL ON public.entregador_avaliacoes TO service_role;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregador_pagamentos TO authenticated;
GRANT ALL ON public.entregador_pagamentos TO service_role;

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

drop policy if exists "Usuarios podem gerenciar entregadores da empresa" on public.entregadores;
create policy "Usuarios podem gerenciar entregadores da empresa"
on public.entregadores
for all
to authenticated
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem gerenciar candidaturas da empresa" on public.entregador_candidaturas;
create policy "Usuarios podem gerenciar candidaturas da empresa"
on public.entregador_candidaturas
for all
to authenticated
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem gerenciar avaliacoes da empresa" on public.entregador_avaliacoes;
create policy "Usuarios podem gerenciar avaliacoes da empresa"
on public.entregador_avaliacoes
for all
to authenticated
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem gerenciar pagamentos da empresa" on public.entregador_pagamentos;
create policy "Usuarios podem gerenciar pagamentos da empresa"
on public.entregador_pagamentos
for all
to authenticated
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()))
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Entregadores podem ver proprio cadastro" on public.entregadores;
create policy "Entregadores podem ver proprio cadastro"
on public.entregadores
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Entregadores podem atualizar proprio status" on public.entregadores;
create policy "Entregadores podem atualizar proprio status"
on public.entregadores
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Tracking table
create table if not exists public.entregador_localizacoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entregador_id uuid not null references public.entregadores(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy numeric(10,2),
  heading numeric(10,2),
  speed numeric(10,2),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.entregador_localizacoes TO authenticated;
GRANT ALL ON public.entregador_localizacoes TO service_role;

create index if not exists idx_entregador_localizacoes_pedido on public.entregador_localizacoes(pedido_id, created_at desc);
create index if not exists idx_entregador_localizacoes_entregador on public.entregador_localizacoes(entregador_id, created_at desc);

alter table public.entregador_localizacoes enable row level security;

drop policy if exists "Usuarios podem ver localizacoes da empresa" on public.entregador_localizacoes;
create policy "Usuarios podem ver localizacoes da empresa"
on public.entregador_localizacoes
for select
to authenticated
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir localizacoes da empresa" on public.entregador_localizacoes;
create policy "Usuarios podem inserir localizacoes da empresa"
on public.entregador_localizacoes
for insert
to authenticated
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

-- Funções públicas usadas pelo app do entregador
create or replace function public.link_entregador_by_phone_public(p_phone text)
returns public.entregadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_match_11 text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 11);
  v_match_10 text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_entregador public.entregadores;
begin
  select *
  into v_entregador
  from public.entregadores
  where status = 'ativo'
    and (
      regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_clean
      or right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 11) = v_match_11
      or right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 10) = v_match_10
    )
  order by created_at desc
  limit 1;

  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;

  return v_entregador;
end;
$$;
grant execute on function public.link_entregador_by_phone_public(text) to anon, authenticated;

create or replace function public.entregador_app_toggle_online(p_entregador_id uuid, p_online boolean)
returns public.entregadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entregador public.entregadores;
begin
  update public.entregadores
  set online = p_online, updated_at = now()
  where id = p_entregador_id and status = 'ativo'
  returning * into v_entregador;
  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;
  return v_entregador;
end;
$$;
grant execute on function public.entregador_app_toggle_online(uuid, boolean) to anon, authenticated;

create or replace function public.entregador_app_pegar_pedido(p_entregador_id uuid, p_pedido_id uuid)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entregador public.entregadores;
  v_pedido public.pedidos;
  v_comissao numeric(10,2);
begin
  select * into v_entregador from public.entregadores
   where id = p_entregador_id and status = 'ativo' and online = true;
  if v_entregador.id is null then
    raise exception 'entregador_offline_or_not_found';
  end if;
  select (total * (coalesce(v_entregador.pct_comissao, 10) / 100.0))::numeric(10,2)
    into v_comissao
    from public.pedidos
   where id = p_pedido_id and company_id = v_entregador.company_id
     and status = 'pronto' and entregador_id is null;
  if v_comissao is null then
    raise exception 'pedido_not_available';
  end if;
  update public.pedidos
     set entregador_id = v_entregador.id, status = 'saiu_entrega',
         valor_comissao = v_comissao, aceito_entregador_em = now()
   where id = p_pedido_id and company_id = v_entregador.company_id
     and status = 'pronto' and entregador_id is null
  returning * into v_pedido;
  insert into public.pedido_eventos (pedido_id, company_id, status, descricao)
  values (v_pedido.id, v_pedido.company_id, 'entregador_pegou_pedido',
          'Entregador ' || v_entregador.nome || ' pegou o pedido #' || v_pedido.codigo_pedido);
  return v_pedido;
end;
$$;
grant execute on function public.entregador_app_pegar_pedido(uuid, uuid) to anon, authenticated;

create or replace function public.entregador_app_concluir_pedido(p_entregador_id uuid, p_pedido_id uuid)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos;
begin
  update public.pedidos
     set status = 'entregue', entregue_em = now()
   where id = p_pedido_id and entregador_id = p_entregador_id and status = 'saiu_entrega'
  returning * into v_pedido;
  if v_pedido.id is null then
    raise exception 'pedido_not_found';
  end if;
  insert into public.pedido_eventos (pedido_id, company_id, status, descricao)
  values (v_pedido.id, v_pedido.company_id, 'entrega_concluida',
          'Entregador confirmou entrega do pedido #' || v_pedido.codigo_pedido);
  return v_pedido;
end;
$$;
grant execute on function public.entregador_app_concluir_pedido(uuid, uuid) to anon, authenticated;

create or replace function public.entregador_app_get_entregador(p_entregador_id uuid)
returns public.entregadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entregador public.entregadores;
begin
  select * into v_entregador from public.entregadores
   where id = p_entregador_id and status = 'ativo';
  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;
  return v_entregador;
end;
$$;
grant execute on function public.entregador_app_get_entregador(uuid) to anon, authenticated;

create or replace function public.entregador_app_get_data(p_entregador_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entregador public.entregadores;
  v_pedido_ids uuid[];
begin
  select * into v_entregador from public.entregadores
   where id = p_entregador_id and status = 'ativo';
  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;
  select coalesce(array_agg(id), array[]::uuid[]) into v_pedido_ids
    from public.pedidos
   where (entregador_id = v_entregador.id and status in ('saiu_entrega','entregue'))
      or (company_id = v_entregador.company_id and status = 'pronto' and entregador_id is null);
  return jsonb_build_object(
    'entregador', to_jsonb(v_entregador),
    'pedidos', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc)
                         from public.pedidos p
                         where p.entregador_id = v_entregador.id
                           and p.status in ('saiu_entrega','entregue')), '[]'::jsonb),
    'disponiveis', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at asc)
                             from public.pedidos p
                             where p.company_id = v_entregador.company_id
                               and p.status = 'pronto' and p.entregador_id is null), '[]'::jsonb),
    'itens', coalesce((select jsonb_agg(to_jsonb(i))
                       from public.pedido_itens i
                       where i.pedido_id = any(v_pedido_ids)), '[]'::jsonb),
    'enderecos', coalesce((select jsonb_agg(to_jsonb(e))
                           from public.pedido_enderecos e
                           where e.pedido_id = any(v_pedido_ids)), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.entregador_app_get_data(uuid) to anon, authenticated;

create or replace function public.entregador_app_update_location(
  p_entregador_id uuid, p_pedido_id uuid, p_latitude numeric, p_longitude numeric,
  p_accuracy numeric default null, p_heading numeric default null, p_speed numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_entregador public.entregadores;
  v_pedido public.pedidos;
  v_localizacao public.entregador_localizacoes;
begin
  select * into v_entregador from public.entregadores where id = p_entregador_id and status = 'ativo';
  if v_entregador.id is null then raise exception 'entregador_not_found'; end if;
  select * into v_pedido from public.pedidos
   where id = p_pedido_id and company_id = v_entregador.company_id
     and entregador_id = v_entregador.id and status = 'saiu_entrega';
  if v_pedido.id is null then raise exception 'pedido_not_tracking'; end if;
  insert into public.entregador_localizacoes (company_id, entregador_id, pedido_id, latitude, longitude, accuracy, heading, speed)
  values (v_entregador.company_id, v_entregador.id, v_pedido.id, p_latitude, p_longitude, p_accuracy, p_heading, p_speed)
  returning * into v_localizacao;
  return to_jsonb(v_localizacao);
end;
$$;
grant execute on function public.entregador_app_update_location(uuid, uuid, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;

create or replace function public.get_pedido_tracking_public(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_payload jsonb;
begin
  select jsonb_build_object(
    'pedido', jsonb_build_object('id', p.id, 'codigo_pedido', p.codigo_pedido, 'status', p.status,
      'cliente_nome', p.cliente_nome, 'created_at', p.created_at,
      'aceito_entregador_em', p.aceito_entregador_em, 'entregue_em', p.entregue_em),
    'entregador', case when e.id is null then null else jsonb_build_object(
      'nome', e.nome, 'veiculo', e.veiculo, 'avaliacao_media', e.avaliacao_media) end,
    'endereco', case when pe.id is null then null else jsonb_build_object(
      'bairro', pe.bairro, 'cidade', pe.cidade, 'referencia', pe.referencia) end,
    'localizacao', case when loc.id is null then null else jsonb_build_object(
      'latitude', loc.latitude, 'longitude', loc.longitude, 'accuracy', loc.accuracy,
      'heading', loc.heading, 'speed', loc.speed, 'created_at', loc.created_at) end
  ) into v_payload
  from public.pedidos p
  left join public.entregadores e on e.id = p.entregador_id
  left join public.pedido_enderecos pe on pe.pedido_id = p.id
  left join lateral (select * from public.entregador_localizacoes l
                     where l.pedido_id = p.id order by l.created_at desc limit 1) loc on true
  where p.id = p_pedido_id and p.status in ('saiu_entrega','entregue');
  if v_payload is null then raise exception 'pedido_tracking_not_found'; end if;
  return v_payload;
end;
$$;
grant execute on function public.get_pedido_tracking_public(uuid) to anon, authenticated;

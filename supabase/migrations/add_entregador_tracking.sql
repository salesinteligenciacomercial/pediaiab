-- ================================
-- Rastreamento do entregador
-- ================================

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

create index if not exists idx_entregador_localizacoes_pedido
on public.entregador_localizacoes(pedido_id, created_at desc);

create index if not exists idx_entregador_localizacoes_entregador
on public.entregador_localizacoes(entregador_id, created_at desc);

alter table public.entregador_localizacoes enable row level security;

drop policy if exists "Usuarios podem ver localizacoes da empresa" on public.entregador_localizacoes;
create policy "Usuarios podem ver localizacoes da empresa"
on public.entregador_localizacoes
for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir localizacoes da empresa" on public.entregador_localizacoes;
create policy "Usuarios podem inserir localizacoes da empresa"
on public.entregador_localizacoes
for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create or replace function public.entregador_app_update_location(
  p_entregador_id uuid,
  p_pedido_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy numeric default null,
  p_heading numeric default null,
  p_speed numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entregador public.entregadores;
  v_pedido public.pedidos;
  v_localizacao public.entregador_localizacoes;
begin
  select *
  into v_entregador
  from public.entregadores
  where id = p_entregador_id
    and status = 'ativo';

  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;

  select *
  into v_pedido
  from public.pedidos
  where id = p_pedido_id
    and company_id = v_entregador.company_id
    and entregador_id = v_entregador.id
    and status = 'saiu_entrega';

  if v_pedido.id is null then
    raise exception 'pedido_not_tracking';
  end if;

  insert into public.entregador_localizacoes (
    company_id,
    entregador_id,
    pedido_id,
    latitude,
    longitude,
    accuracy,
    heading,
    speed
  )
  values (
    v_entregador.company_id,
    v_entregador.id,
    v_pedido.id,
    p_latitude,
    p_longitude,
    p_accuracy,
    p_heading,
    p_speed
  )
  returning * into v_localizacao;

  return to_jsonb(v_localizacao);
end;
$$;

grant execute on function public.entregador_app_update_location(uuid, uuid, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;

create or replace function public.get_pedido_tracking_public(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'pedido', jsonb_build_object(
      'id', p.id,
      'codigo_pedido', p.codigo_pedido,
      'status', p.status,
      'cliente_nome', p.cliente_nome,
      'created_at', p.created_at,
      'aceito_entregador_em', p.aceito_entregador_em,
      'entregue_em', p.entregue_em
    ),
    'entregador', case when e.id is null then null else jsonb_build_object(
      'nome', e.nome,
      'veiculo', e.veiculo,
      'avaliacao_media', e.avaliacao_media
    ) end,
    'endereco', case when pe.id is null then null else jsonb_build_object(
      'bairro', pe.bairro,
      'cidade', pe.cidade,
      'referencia', pe.referencia
    ) end,
    'localizacao', case when loc.id is null then null else jsonb_build_object(
      'latitude', loc.latitude,
      'longitude', loc.longitude,
      'accuracy', loc.accuracy,
      'heading', loc.heading,
      'speed', loc.speed,
      'created_at', loc.created_at
    ) end
  )
  into v_payload
  from public.pedidos p
  left join public.entregadores e on e.id = p.entregador_id
  left join public.pedido_enderecos pe on pe.pedido_id = p.id
  left join lateral (
    select *
    from public.entregador_localizacoes l
    where l.pedido_id = p.id
    order by l.created_at desc
    limit 1
  ) loc on true
  where p.id = p_pedido_id
    and p.status in ('saiu_entrega', 'entregue');

  if v_payload is null then
    raise exception 'pedido_tracking_not_found';
  end if;

  return v_payload;
end;
$$;

grant execute on function public.get_pedido_tracking_public(uuid) to anon, authenticated;

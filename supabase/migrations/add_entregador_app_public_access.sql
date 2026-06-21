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
  set online = p_online,
      updated_at = now()
  where id = p_entregador_id
    and status = 'ativo'
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
  select *
  into v_entregador
  from public.entregadores
  where id = p_entregador_id
    and status = 'ativo'
    and online = true;

  if v_entregador.id is null then
    raise exception 'entregador_offline_or_not_found';
  end if;

  select (total * (coalesce(v_entregador.pct_comissao, 10) / 100.0))::numeric(10,2)
  into v_comissao
  from public.pedidos
  where id = p_pedido_id
    and company_id = v_entregador.company_id
    and status = 'pronto'
    and entregador_id is null;

  if v_comissao is null then
    raise exception 'pedido_not_available';
  end if;

  update public.pedidos
  set entregador_id = v_entregador.id,
      status = 'saiu_entrega',
      valor_comissao = v_comissao,
      aceito_entregador_em = now()
  where id = p_pedido_id
    and company_id = v_entregador.company_id
    and status = 'pronto'
    and entregador_id is null
  returning * into v_pedido;

  insert into public.pedido_eventos (pedido_id, company_id, status, descricao)
  values (
    v_pedido.id,
    v_pedido.company_id,
    'entregador_pegou_pedido',
    'Entregador ' || v_entregador.nome || ' pegou o pedido #' || v_pedido.codigo_pedido
  );

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
  set status = 'entregue',
      entregue_em = now()
  where id = p_pedido_id
    and entregador_id = p_entregador_id
    and status = 'saiu_entrega'
  returning * into v_pedido;

  if v_pedido.id is null then
    raise exception 'pedido_not_found';
  end if;

  insert into public.pedido_eventos (pedido_id, company_id, status, descricao)
  values (
    v_pedido.id,
    v_pedido.company_id,
    'entrega_concluida',
    'Entregador confirmou entrega do pedido #' || v_pedido.codigo_pedido
  );

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
  select *
  into v_entregador
  from public.entregadores
  where id = p_entregador_id
    and status = 'ativo';

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
  select *
  into v_entregador
  from public.entregadores
  where id = p_entregador_id
    and status = 'ativo';

  if v_entregador.id is null then
    raise exception 'entregador_not_found';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into v_pedido_ids
  from public.pedidos
  where (
      entregador_id = v_entregador.id
      and status in ('saiu_entrega', 'entregue')
    )
    or (
      company_id = v_entregador.company_id
      and status = 'pronto'
      and entregador_id is null
    );

  return jsonb_build_object(
    'entregador', to_jsonb(v_entregador),
    'pedidos', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from public.pedidos p
      where p.entregador_id = v_entregador.id
        and p.status in ('saiu_entrega', 'entregue')
    ), '[]'::jsonb),
    'disponiveis', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at asc)
      from public.pedidos p
      where p.company_id = v_entregador.company_id
        and p.status = 'pronto'
        and p.entregador_id is null
    ), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(i))
      from public.pedido_itens i
      where i.pedido_id = any(v_pedido_ids)
    ), '[]'::jsonb),
    'enderecos', coalesce((
      select jsonb_agg(to_jsonb(e))
      from public.pedido_enderecos e
      where e.pedido_id = any(v_pedido_ids)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.entregador_app_get_data(uuid) to anon, authenticated;

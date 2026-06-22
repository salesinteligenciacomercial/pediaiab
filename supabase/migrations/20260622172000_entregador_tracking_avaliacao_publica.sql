create unique index if not exists idx_entregador_avaliacoes_pedido_unique
on public.entregador_avaliacoes(pedido_id);

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
      'foto_url', e.foto_url,
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

create or replace function public.avaliar_entregador_public(
  p_pedido_id uuid,
  p_nota integer,
  p_comentario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos;
  v_media numeric(3,2);
begin
  if p_nota < 1 or p_nota > 5 then
    raise exception 'nota_invalida';
  end if;

  select *
  into v_pedido
  from public.pedidos
  where id = p_pedido_id
    and status = 'entregue'
    and entregador_id is not null;

  if v_pedido.id is null then
    raise exception 'pedido_nao_avaliavel';
  end if;

  insert into public.entregador_avaliacoes (
    pedido_id,
    entregador_id,
    company_id,
    nota,
    comentario,
    avaliado_por
  )
  values (
    v_pedido.id,
    v_pedido.entregador_id,
    v_pedido.company_id,
    p_nota,
    nullif(trim(coalesce(p_comentario, '')), ''),
    'cliente'
  )
  on conflict (pedido_id) do update
    set nota = excluded.nota,
        comentario = excluded.comentario,
        avaliado_por = 'cliente',
        created_at = now();

  select coalesce(avg(nota), 5)::numeric(3,2)
  into v_media
  from public.entregador_avaliacoes
  where entregador_id = v_pedido.entregador_id;

  update public.entregadores
  set avaliacao_media = v_media
  where id = v_pedido.entregador_id;

  return jsonb_build_object('ok', true, 'avaliacao_media', v_media);
end;
$$;

grant execute on function public.avaliar_entregador_public(uuid, integer, text) to anon, authenticated;

create table if not exists public.categoria_margens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  categoria text not null,
  margem_padrao_pct numeric(5,2) not null default 50.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id, categoria)
);

alter table public.pedido_itens
  add column if not exists custo_unitario_momento numeric(10,2) default null,
  add column if not exists custo_total_momento numeric(10,2) default null,
  add column if not exists lucro_item numeric(10,2) default null,
  add column if not exists margem_real_pct numeric(5,2) default null;

create or replace function public.calcular_custo_produto(p_produto_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_custo_direto numeric;
  v_custo_receita numeric;
  v_tem_composicao boolean;
begin
  select custo_unitario
    into v_custo_direto
  from public.produtos_servicos
  where id = p_produto_id;

  select exists(
    select 1
    from public.produto_composicoes
    where produto_id = p_produto_id
  ) into v_tem_composicao;

  if v_tem_composicao then
    select coalesce(sum(pc.quantidade * coalesce(ins.custo_unitario, 0)), 0)
      into v_custo_receita
    from public.produto_composicoes pc
    join public.produtos_servicos ins on ins.id = pc.insumo_id
    where pc.produto_id = p_produto_id;

    return v_custo_receita;
  end if;

  return coalesce(v_custo_direto, 0);
end;
$$;

create or replace function public.registrar_item_pedido_com_custo(
  p_pedido_id uuid,
  p_company_id uuid,
  p_produto_id uuid,
  p_produto_nome text,
  p_quantidade numeric,
  p_valor_unitario numeric,
  p_observacoes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_custo_unit numeric;
  v_custo_total numeric;
  v_valor_total numeric;
  v_lucro numeric;
  v_margem_real numeric;
begin
  v_valor_total := coalesce(p_valor_unitario, 0) * coalesce(p_quantidade, 0);

  if p_produto_id is not null then
    v_custo_unit := public.calcular_custo_produto(p_produto_id);
  else
    v_custo_unit := 0;
  end if;

  v_custo_total := coalesce(v_custo_unit, 0) * coalesce(p_quantidade, 0);
  v_lucro := v_valor_total - v_custo_total;
  v_margem_real := case when v_valor_total > 0 then (v_lucro / v_valor_total) * 100 else 0 end;

  insert into public.pedido_itens (
    pedido_id,
    company_id,
    produto_id,
    produto_nome,
    quantidade,
    valor_unitario,
    valor_total,
    observacoes,
    custo_unitario_momento,
    custo_total_momento,
    lucro_item,
    margem_real_pct
  ) values (
    p_pedido_id,
    p_company_id,
    p_produto_id,
    p_produto_nome,
    coalesce(p_quantidade, 0),
    coalesce(p_valor_unitario, 0),
    v_valor_total,
    p_observacoes,
    v_custo_unit,
    v_custo_total,
    v_lucro,
    v_margem_real
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create index if not exists idx_categoria_margens_company on public.categoria_margens(company_id);
create index if not exists idx_pedido_itens_lucro on public.pedido_itens(company_id, lucro_item) where lucro_item is not null;

alter table public.categoria_margens enable row level security;

drop policy if exists "categoria_margens_select_company" on public.categoria_margens;
create policy "categoria_margens_select_company"
on public.categoria_margens
for select
using (company_id = get_my_company_id());

drop policy if exists "categoria_margens_insert_company" on public.categoria_margens;
create policy "categoria_margens_insert_company"
on public.categoria_margens
for insert
with check (company_id = get_my_company_id());

drop policy if exists "categoria_margens_update_company" on public.categoria_margens;
create policy "categoria_margens_update_company"
on public.categoria_margens
for update
using (company_id = get_my_company_id())
with check (company_id = get_my_company_id());

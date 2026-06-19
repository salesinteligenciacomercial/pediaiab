-- Controle de estoque para produtos/insumos da pizzaria.

alter table public.produtos_servicos
  add column if not exists estoque_atual numeric(12,3) default null,
  add column if not exists estoque_minimo numeric(12,3) default null,
  add column if not exists estoque_maximo numeric(12,3) default null,
  add column if not exists unidade_medida text default 'un',
  add column if not exists controla_estoque boolean default false,
  add column if not exists custo_unitario numeric(10,2) default null,
  add column if not exists fornecedor_nome text default null,
  add column if not exists fornecedor_contato text default null,
  add column if not exists codigo_interno text default null;

create table if not exists public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  produto_id uuid not null references public.produtos_servicos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste', 'perda', 'producao')),
  quantidade numeric(12,3) not null,
  quantidade_anterior numeric(12,3),
  quantidade_posterior numeric(12,3),
  motivo text,
  pedido_id uuid default null references public.pedidos(id) on delete set null,
  custo_unitario numeric(10,2) default null,
  valor_total numeric(10,2) default null,
  observacao text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.produto_composicoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  produto_id uuid not null references public.produtos_servicos(id) on delete cascade,
  insumo_id uuid not null references public.produtos_servicos(id) on delete cascade,
  quantidade numeric(12,3) not null,
  unidade_medida text default 'un',
  created_at timestamptz default now(),
  unique(produto_id, insumo_id)
);

create table if not exists public.estoque_alertas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  produto_id uuid not null references public.produtos_servicos(id) on delete cascade,
  tipo text not null check (tipo in ('abaixo_minimo', 'zerado', 'acima_maximo')),
  resolvido boolean default false,
  resolvido_em timestamptz,
  created_at timestamptz default now(),
  unique(produto_id, tipo)
);

alter table public.estoque_movimentacoes enable row level security;
alter table public.produto_composicoes enable row level security;
alter table public.estoque_alertas enable row level security;

create index if not exists idx_mov_company on public.estoque_movimentacoes(company_id, created_at desc);
create index if not exists idx_mov_produto on public.estoque_movimentacoes(produto_id, created_at desc);
create index if not exists idx_comp_produto on public.produto_composicoes(produto_id);
create index if not exists idx_alertas_open on public.estoque_alertas(company_id, resolvido) where not resolvido;

drop policy if exists "Usuarios podem ver movimentacoes de estoque da empresa" on public.estoque_movimentacoes;
create policy "Usuarios podem ver movimentacoes de estoque da empresa"
on public.estoque_movimentacoes for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir movimentacoes de estoque da empresa" on public.estoque_movimentacoes;
create policy "Usuarios podem inserir movimentacoes de estoque da empresa"
on public.estoque_movimentacoes for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem ver composicoes da empresa" on public.produto_composicoes;
create policy "Usuarios podem ver composicoes da empresa"
on public.produto_composicoes for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir composicoes da empresa" on public.produto_composicoes;
create policy "Usuarios podem inserir composicoes da empresa"
on public.produto_composicoes for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem atualizar composicoes da empresa" on public.produto_composicoes;
create policy "Usuarios podem atualizar composicoes da empresa"
on public.produto_composicoes for update
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem excluir composicoes da empresa" on public.produto_composicoes;
create policy "Usuarios podem excluir composicoes da empresa"
on public.produto_composicoes for delete
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem ver alertas de estoque da empresa" on public.estoque_alertas;
create policy "Usuarios podem ver alertas de estoque da empresa"
on public.estoque_alertas for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir alertas de estoque da empresa" on public.estoque_alertas;
create policy "Usuarios podem inserir alertas de estoque da empresa"
on public.estoque_alertas for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem atualizar alertas de estoque da empresa" on public.estoque_alertas;
create policy "Usuarios podem atualizar alertas de estoque da empresa"
on public.estoque_alertas for update
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

create or replace function public.registrar_movimentacao_estoque(
  p_company_id uuid,
  p_produto_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_motivo text default null,
  p_pedido_id uuid default null,
  p_custo numeric default null,
  p_observacao text default null,
  p_criado_por uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior numeric;
  v_posterior numeric;
  v_mov_id uuid;
begin
  select estoque_atual
    into v_anterior
  from public.produtos_servicos
  where id = p_produto_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado para a empresa informada';
  end if;

  if p_tipo in ('entrada', 'ajuste') then
    v_posterior := coalesce(v_anterior, 0) + p_quantidade;
  else
    v_posterior := coalesce(v_anterior, 0) - p_quantidade;
  end if;

  update public.produtos_servicos
  set estoque_atual = v_posterior,
      updated_at = now()
  where id = p_produto_id
    and company_id = p_company_id;

  insert into public.estoque_movimentacoes (
    company_id, produto_id, tipo, quantidade, quantidade_anterior,
    quantidade_posterior, motivo, pedido_id, custo_unitario, valor_total,
    observacao, criado_por
  ) values (
    p_company_id, p_produto_id, p_tipo, p_quantidade, v_anterior,
    v_posterior, p_motivo, p_pedido_id, p_custo,
    case when p_custo is not null then p_custo * p_quantidade end,
    p_observacao, p_criado_por
  )
  returning id into v_mov_id;

  return v_mov_id;
end;
$$;

grant execute on function public.registrar_movimentacao_estoque(uuid, uuid, text, numeric, text, uuid, numeric, text, uuid) to authenticated;

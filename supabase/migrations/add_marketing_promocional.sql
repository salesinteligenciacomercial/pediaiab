-- ================================
-- Marketing promocional
-- ================================

create table if not exists public.marketing_cupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  codigo text not null,
  descricao text,
  tipo text not null default 'percentual'
    check (tipo in ('percentual', 'valor_fixo', 'frete_gratis')),
  valor numeric(12,2) not null default 0,
  pedido_minimo numeric(12,2) not null default 0,
  limite_uso integer,
  usos integer not null default 0,
  inicio date,
  fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, codigo)
);

create table if not exists public.marketing_datas_especiais (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  categoria text not null default 'comemorativa',
  data_base date,
  mes integer check (mes between 1 and 12),
  dia integer check (dia between 1 and 31),
  regra text,
  sugestao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_automacoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  gatilho text not null
    check (gatilho in ('carrinho_abandonado', 'cliente_inativo', 'data_especial', 'cliente_vip', 'pos_compra')),
  atraso_minutos integer not null default 60,
  mensagem text not null,
  cupom_id uuid references public.marketing_cupons(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_cupons_company on public.marketing_cupons(company_id, ativo);
create index if not exists idx_marketing_datas_company on public.marketing_datas_especiais(company_id, ativo);
create index if not exists idx_marketing_automacoes_company on public.marketing_automacoes(company_id, ativo);

alter table public.marketing_cupons enable row level security;
alter table public.marketing_datas_especiais enable row level security;
alter table public.marketing_automacoes enable row level security;

drop policy if exists "Usuarios podem ver cupons da empresa" on public.marketing_cupons;
create policy "Usuarios podem ver cupons da empresa"
on public.marketing_cupons for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir cupons da empresa" on public.marketing_cupons;
create policy "Usuarios podem inserir cupons da empresa"
on public.marketing_cupons for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem atualizar cupons da empresa" on public.marketing_cupons;
create policy "Usuarios podem atualizar cupons da empresa"
on public.marketing_cupons for update
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem excluir cupons da empresa" on public.marketing_cupons;
create policy "Usuarios podem excluir cupons da empresa"
on public.marketing_cupons for delete
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem ver datas da empresa" on public.marketing_datas_especiais;
create policy "Usuarios podem ver datas da empresa"
on public.marketing_datas_especiais for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir datas da empresa" on public.marketing_datas_especiais;
create policy "Usuarios podem inserir datas da empresa"
on public.marketing_datas_especiais for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem atualizar datas da empresa" on public.marketing_datas_especiais;
create policy "Usuarios podem atualizar datas da empresa"
on public.marketing_datas_especiais for update
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem excluir datas da empresa" on public.marketing_datas_especiais;
create policy "Usuarios podem excluir datas da empresa"
on public.marketing_datas_especiais for delete
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem ver automacoes da empresa" on public.marketing_automacoes;
create policy "Usuarios podem ver automacoes da empresa"
on public.marketing_automacoes for select
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem inserir automacoes da empresa" on public.marketing_automacoes;
create policy "Usuarios podem inserir automacoes da empresa"
on public.marketing_automacoes for insert
with check (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem atualizar automacoes da empresa" on public.marketing_automacoes;
create policy "Usuarios podem atualizar automacoes da empresa"
on public.marketing_automacoes for update
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop policy if exists "Usuarios podem excluir automacoes da empresa" on public.marketing_automacoes;
create policy "Usuarios podem excluir automacoes da empresa"
on public.marketing_automacoes for delete
using (company_id in (select company_id from public.user_roles where user_id = auth.uid()));

drop trigger if exists update_marketing_cupons_updated_at on public.marketing_cupons;
create trigger update_marketing_cupons_updated_at
before update on public.marketing_cupons
for each row execute function public.update_updated_at_column();

drop trigger if exists update_marketing_datas_updated_at on public.marketing_datas_especiais;
create trigger update_marketing_datas_updated_at
before update on public.marketing_datas_especiais
for each row execute function public.update_updated_at_column();

drop trigger if exists update_marketing_automacoes_updated_at on public.marketing_automacoes;
create trigger update_marketing_automacoes_updated_at
before update on public.marketing_automacoes
for each row execute function public.update_updated_at_column();

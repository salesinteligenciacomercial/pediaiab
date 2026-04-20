
CREATE TABLE IF NOT EXISTS public.pizza_tamanhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  multiplicador NUMERIC(6,3) NOT NULL DEFAULT 1,
  max_sabores INTEGER NOT NULL DEFAULT 1,
  fatias INTEGER NOT NULL DEFAULT 4,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE public.pizza_tamanhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver tamanhos da empresa" ON public.pizza_tamanhos FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Criar tamanhos da empresa" ON public.pizza_tamanhos FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Atualizar tamanhos da empresa" ON public.pizza_tamanhos FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Excluir tamanhos da empresa" ON public.pizza_tamanhos FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Tamanhos visiveis publicamente" ON public.pizza_tamanhos FOR SELECT
  USING (ativo = true);

CREATE INDEX IF NOT EXISTS idx_pizza_tamanhos_company ON public.pizza_tamanhos(company_id);

INSERT INTO public.pizza_tamanhos (company_id, nome, slug, multiplicador, max_sabores, fatias, descricao, ordem)
SELECT DISTINCT ps.company_id, t.nome, t.slug, t.mult, t.sab, t.fat, t.descricao, t.ord
FROM public.produtos_servicos ps
CROSS JOIN (VALUES
  ('Brotinho', 'brotinho', 0.625::numeric, 1, 1, 'Pizza com 1 sabor e 1 fatia', 1),
  ('Pequena', 'pequena', 1.000::numeric, 2, 4, 'Pizza com até 2 sabores e 4 fatias', 2),
  ('Média', 'media', 1.343::numeric, 2, 6, 'Pizza com até 2 sabores e 6 fatias', 3),
  ('Grande', 'grande', 1.500::numeric, 3, 8, 'Pizza com até 3 sabores e 8 fatias', 4),
  ('Gigante', 'gigante', 1.875::numeric, 3, 12, 'Pizza com até 3 sabores e 12 fatias', 5)
) AS t(nome, slug, mult, sab, fat, descricao, ord)
WHERE ps.permite_meio_a_meio = true
ON CONFLICT (company_id, slug) DO NOTHING;

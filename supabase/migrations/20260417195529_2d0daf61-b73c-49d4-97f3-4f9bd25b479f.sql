
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS permite_meio_a_meio BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_produtos_servicos_categoria ON public.produtos_servicos(company_id, categoria, ordem_exibicao);

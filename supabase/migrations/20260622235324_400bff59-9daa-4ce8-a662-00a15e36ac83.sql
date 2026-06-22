
CREATE TABLE public.pizza_meio_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_meio_categorias TO authenticated;
GRANT ALL ON public.pizza_meio_categorias TO service_role;
GRANT SELECT ON public.pizza_meio_categorias TO anon;

ALTER TABLE public.pizza_meio_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their company pizza meio categorias"
  ON public.pizza_meio_categorias FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "Anon can view active pizza meio categorias"
  ON public.pizza_meio_categorias FOR SELECT
  TO anon
  USING (ativo = true);

CREATE POLICY "Users manage their company pizza meio categorias"
  ON public.pizza_meio_categorias FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE TRIGGER trg_pizza_meio_categorias_updated_at
  BEFORE UPDATE ON public.pizza_meio_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS pizza_meio_categoria_id UUID REFERENCES public.pizza_meio_categorias(id) ON DELETE SET NULL;

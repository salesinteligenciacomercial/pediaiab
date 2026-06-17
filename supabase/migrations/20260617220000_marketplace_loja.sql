-- Marketplace: exibir restaurantes no hub público tipo iFood
ALTER TABLE public.loja_configuracoes
  ADD COLUMN IF NOT EXISTS visivel_marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS categoria_marketplace TEXT NOT NULL DEFAULT 'restaurante';

COMMENT ON COLUMN public.loja_configuracoes.visivel_marketplace IS 'Exibir restaurante no marketplace público';
COMMENT ON COLUMN public.loja_configuracoes.categoria_marketplace IS 'Categoria no marketplace: pizzaria, hamburguer, lanches, doces, restaurante';

CREATE INDEX IF NOT EXISTS idx_loja_configuracoes_marketplace
  ON public.loja_configuracoes (visivel_marketplace)
  WHERE slug IS NOT NULL AND visivel_marketplace = true;

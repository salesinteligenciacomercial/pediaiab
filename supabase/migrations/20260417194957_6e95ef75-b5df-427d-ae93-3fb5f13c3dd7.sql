
ALTER TABLE public.produtos_servicos
  ADD COLUMN IF NOT EXISTS imagem_url TEXT,
  ADD COLUMN IF NOT EXISTS ativo_cardapio BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS destaque_cardapio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_observacao BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem_exibicao INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_produto TEXT DEFAULT 'produto';

DROP POLICY IF EXISTS "Public can read active menu products" ON public.produtos_servicos;
CREATE POLICY "Public can read active menu products"
ON public.produtos_servicos
FOR SELECT
TO anon, authenticated
USING (ativo = true AND ativo_cardapio = true AND tipo_produto <> 'insumo');


ALTER TABLE public.loja_configuracoes
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS descricao_loja TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#ea580c',
  ADD COLUMN IF NOT EXISTS cor_secundaria TEXT DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS telefone_loja TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_loja TEXT,
  ADD COLUMN IF NOT EXISTS endereco_loja TEXT,
  ADD COLUMN IF NOT EXISTS aceita_retirada BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS aceita_entrega BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mensagem_loja TEXT,
  ADD COLUMN IF NOT EXISTS impressao_automatica BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_bridge_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS loja_configuracoes_slug_unique ON public.loja_configuracoes (slug) WHERE slug IS NOT NULL;

-- Permitir leitura pública por slug (cardápio é público)
DROP POLICY IF EXISTS "Public can read store by slug" ON public.loja_configuracoes;
CREATE POLICY "Public can read store by slug"
ON public.loja_configuracoes
FOR SELECT
TO anon, authenticated
USING (slug IS NOT NULL);

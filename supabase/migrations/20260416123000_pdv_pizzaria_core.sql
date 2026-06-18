-- ================================
-- PDV / PIZZARIA CORE
-- ================================

-- Expansão do cadastro de produtos
ALTER TABLE public.produtos_servicos
ADD COLUMN IF NOT EXISTS tipo_produto TEXT NOT NULL DEFAULT 'produto'
  CHECK (tipo_produto IN ('produto', 'insumo', 'combo', 'adicional')),
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS imagem_url TEXT,
ADD COLUMN IF NOT EXISTS peso_gramas NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS tempo_preparo_min INTEGER,
ADD COLUMN IF NOT EXISTS descricao_curta TEXT,
ADD COLUMN IF NOT EXISTS descricao_completa TEXT,
ADD COLUMN IF NOT EXISTS ativo_cardapio BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ordem_exibicao INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS permite_observacao BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS controla_estoque BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS estoque_atual NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS estoque_minimo NUMERIC(12,3),
ADD COLUMN IF NOT EXISTS unidade_medida TEXT,
ADD COLUMN IF NOT EXISTS destaque_cardapio BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS combo_min_selecoes INTEGER,
ADD COLUMN IF NOT EXISTS combo_max_selecoes INTEGER,
ADD COLUMN IF NOT EXISTS promocao_ativa BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS promocao_preco NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS promocao_inicio DATE,
ADD COLUMN IF NOT EXISTS promocao_fim DATE,
ADD COLUMN IF NOT EXISTS promocao_flash BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS promocao_nota TEXT;

CREATE INDEX IF NOT EXISTS idx_produtos_servicos_tipo ON public.produtos_servicos(tipo_produto);
CREATE INDEX IF NOT EXISTS idx_produtos_servicos_cardapio ON public.produtos_servicos(company_id, ativo_cardapio, ativo, ordem_exibicao);

-- Galeria de imagens do produto
CREATE TABLE IF NOT EXISTS public.produto_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver imagens de produtos da empresa"
ON public.produto_imagens
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir imagens de produtos da empresa"
ON public.produto_imagens
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar imagens de produtos da empresa"
ON public.produto_imagens
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir imagens de produtos da empresa"
ON public.produto_imagens
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_produto_imagens_updated_at ON public.produto_imagens;
CREATE TRIGGER update_produto_imagens_updated_at
BEFORE UPDATE ON public.produto_imagens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grupos de opções do produto (tamanho, massa, borda, adicionais)
CREATE TABLE IF NOT EXISTS public.produto_grupos_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_grupo TEXT NOT NULL DEFAULT 'opcional'
    CHECK (tipo_grupo IN ('tamanho', 'massa', 'borda', 'adicional', 'opcional')),
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  minimo_escolhas INTEGER NOT NULL DEFAULT 0,
  maximo_escolhas INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_grupos_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver grupos de opcoes da empresa"
ON public.produto_grupos_opcoes
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir grupos de opcoes da empresa"
ON public.produto_grupos_opcoes
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar grupos de opcoes da empresa"
ON public.produto_grupos_opcoes
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir grupos de opcoes da empresa"
ON public.produto_grupos_opcoes
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_produto_grupos_opcoes_updated_at ON public.produto_grupos_opcoes;
CREATE TRIGGER update_produto_grupos_opcoes_updated_at
BEFORE UPDATE ON public.produto_grupos_opcoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.produto_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES public.produto_grupos_opcoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_adicional NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver opcoes da empresa"
ON public.produto_opcoes
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir opcoes da empresa"
ON public.produto_opcoes
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar opcoes da empresa"
ON public.produto_opcoes
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir opcoes da empresa"
ON public.produto_opcoes
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_produto_opcoes_updated_at ON public.produto_opcoes;
CREATE TRIGGER update_produto_opcoes_updated_at
BEFORE UPDATE ON public.produto_opcoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ficha técnica / insumos
CREATE TABLE IF NOT EXISTS public.produto_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  unidade_medida TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver ficha tecnica da empresa"
ON public.produto_insumos
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir ficha tecnica da empresa"
ON public.produto_insumos
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar ficha tecnica da empresa"
ON public.produto_insumos
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir ficha tecnica da empresa"
ON public.produto_insumos
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_produto_insumos_updated_at ON public.produto_insumos;
CREATE TRIGGER update_produto_insumos_updated_at
BEFORE UPDATE ON public.produto_insumos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração da loja / cardápio digital
CREATE TABLE IF NOT EXISTS public.loja_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  nome_loja TEXT,
  descricao_loja TEXT,
  logo_url TEXT,
  banner_url TEXT,
  cor_primaria TEXT DEFAULT '#ea580c',
  cor_secundaria TEXT DEFAULT '#111827',
  telefone_loja TEXT,
  whatsapp_loja TEXT,
  endereco_loja TEXT,
  pedido_minimo NUMERIC(12,2) DEFAULT 0,
  taxa_entrega NUMERIC(12,2) DEFAULT 0,
  aceita_retirada BOOLEAN NOT NULL DEFAULT true,
  aceita_entrega BOOLEAN NOT NULL DEFAULT true,
  horario_funcionamento JSONB DEFAULT '{}'::jsonb,
  mensagem_loja TEXT,
  impressao_automatica BOOLEAN NOT NULL DEFAULT false,
  print_bridge_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver configuracao da loja da empresa"
ON public.loja_configuracoes
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir configuracao da loja da empresa"
ON public.loja_configuracoes
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar configuracao da loja da empresa"
ON public.loja_configuracoes
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_loja_configuracoes_updated_at ON public.loja_configuracoes;
CREATE TRIGGER update_loja_configuracoes_updated_at
BEFORE UPDATE ON public.loja_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Pedidos estruturados
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  codigo_pedido TEXT NOT NULL UNIQUE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_email TEXT,
  canal TEXT NOT NULL DEFAULT 'cardapio'
    CHECK (canal IN ('cardapio', 'whatsapp', 'balcao', 'telefone', 'interno')),
  tipo_atendimento TEXT NOT NULL DEFAULT 'entrega'
    CHECK (tipo_atendimento IN ('retirada', 'entrega', 'mesa', 'balcao')),
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'aceito', 'em_producao', 'pronto', 'saiu_entrega', 'entregue', 'cancelado')),
  status_pagamento TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente', 'pago', 'estornado', 'cancelado')),
  forma_pagamento TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  origem_publica JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver pedidos da empresa"
ON public.pedidos
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir pedidos da empresa"
ON public.pedidos
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar pedidos da empresa"
ON public.pedidos
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir pedidos da empresa"
ON public.pedidos
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_pedidos_updated_at ON public.pedidos;
CREATE TRIGGER update_pedidos_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pedido_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL UNIQUE REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_contato TEXT,
  telefone_contato TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_enderecos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver enderecos de pedidos da empresa"
ON public.pedido_enderecos
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir enderecos de pedidos da empresa"
ON public.pedido_enderecos
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar enderecos de pedidos da empresa"
ON public.pedido_enderecos
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir enderecos de pedidos da empresa"
ON public.pedido_enderecos
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_pedido_enderecos_updated_at ON public.pedido_enderecos;
CREATE TRIGGER update_pedido_enderecos_updated_at
BEFORE UPDATE ON public.pedido_enderecos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos_servicos(id) ON DELETE SET NULL,
  produto_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  opcoes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver itens de pedidos da empresa"
ON public.pedido_itens
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir itens de pedidos da empresa"
ON public.pedido_itens
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar itens de pedidos da empresa"
ON public.pedido_itens
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem excluir itens de pedidos da empresa"
ON public.pedido_itens
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_pedido_itens_updated_at ON public.pedido_itens;
CREATE TRIGGER update_pedido_itens_updated_at
BEFORE UPDATE ON public.pedido_itens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pedido_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT,
  descricao TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver eventos de pedidos da empresa"
ON public.pedido_eventos
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir eventos de pedidos da empresa"
ON public.pedido_eventos
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.pedido_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  forma_pagamento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado', 'estornado')),
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  transaction_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver pagamentos da empresa"
ON public.pedido_pagamentos
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem inserir pagamentos da empresa"
ON public.pedido_pagamentos
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios podem atualizar pagamentos da empresa"
ON public.pedido_pagamentos
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

DROP TRIGGER IF EXISTS update_pedido_pagamentos_updated_at ON public.pedido_pagamentos;
CREATE TRIGGER update_pedido_pagamentos_updated_at
BEFORE UPDATE ON public.pedido_pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pedidos_company_status ON public.pedidos(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_eventos_pedido ON public.pedido_eventos(pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loja_configuracoes_slug ON public.loja_configuracoes(slug);

-- Bucket de imagens dos produtos
INSERT INTO storage.buckets (id, name, public)
SELECT 'product-images', 'product-images', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'product-images'
);

CREATE POLICY "Public can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated can upload product images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated can update product images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated can delete product images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);

-- Função de código amigável do pedido
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  code := 'PZ-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 9999) + 1)::TEXT, 4, '0');
  RETURN code;
END;
$$;

-- Trigger para preencher código automaticamente
CREATE OR REPLACE FUNCTION public.set_default_order_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo_pedido IS NULL OR NEW.codigo_pedido = '' THEN
    NEW.codigo_pedido := public.generate_order_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_default_order_code_trigger ON public.pedidos;
CREATE TRIGGER set_default_order_code_trigger
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_default_order_code();

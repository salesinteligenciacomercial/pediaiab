-- ===========================
-- Código de pedido com contador diário
-- ===========================
CREATE TABLE IF NOT EXISTS public.pedidos_codigo_diario (
  dia date PRIMARY KEY,
  contador integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.generate_pedido_codigo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoje date := current_date;
  seq integer;
BEGIN
  LOOP
    UPDATE public.pedidos_codigo_diario
      SET contador = contador + 1
      WHERE dia = hoje
      RETURNING contador INTO seq;

    IF FOUND THEN
      EXIT;
    END IF;

    BEGIN
      INSERT INTO public.pedidos_codigo_diario(dia, contador)
      VALUES (hoje, 1);
      seq := 1;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- outro processo já criou a linha no mesmo dia; tentar novamente
    END;
  END LOOP;

  RETURN 'PED-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq::text, 2, '0');
END;
$$;

-- ===========================
-- Tabela: mesas
-- ===========================
CREATE TABLE IF NOT EXISTS public.mesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  nome TEXT,
  capacidade INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'livre',
  localizacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, numero)
);

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mesas: select por empresa" ON public.mesas FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Mesas: insert por empresa" ON public.mesas FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Mesas: update por empresa" ON public.mesas FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Mesas: delete por empresa" ON public.mesas FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_mesas_updated_at
  BEFORE UPDATE ON public.mesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- Tabela: pedidos
-- ===========================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  codigo_pedido TEXT NOT NULL DEFAULT public.generate_pedido_codigo(),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'interno', -- cardapio | whatsapp | instagram | atendimento | interno
  tipo_atendimento TEXT NOT NULL DEFAULT 'entrega', -- entrega | retirada | balcao | mesa
  status TEXT NOT NULL DEFAULT 'novo', -- novo | aceito | em_producao | pronto | saiu_entrega | entregue | cancelado
  status_pagamento TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago | parcial | reembolsado
  forma_pagamento TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  origem_publica JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_company ON public.pedidos(company_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_lead ON public.pedidos(lead_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa ON public.pedidos(mesa_id) WHERE mesa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_codigo ON public.pedidos(codigo_pedido);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedidos: select por empresa" ON public.pedidos FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedidos: insert por empresa" ON public.pedidos FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedidos: update por empresa" ON public.pedidos FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedidos: delete por empresa" ON public.pedidos FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Permitir INSERT público para pedidos vindos do cardápio digital (sem auth)
CREATE POLICY "Pedidos: insert público pelo cardápio" ON public.pedidos FOR INSERT
  WITH CHECK (canal = 'cardapio');

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- Tabela: pedido_itens
-- ===========================
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  produto_id UUID,
  produto_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_company ON public.pedido_itens(company_id);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedido itens: select por empresa" ON public.pedido_itens FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido itens: insert por empresa" ON public.pedido_itens FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido itens: insert público cardápio" ON public.pedido_itens FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND p.canal = 'cardapio'));
CREATE POLICY "Pedido itens: update por empresa" ON public.pedido_itens FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido itens: delete por empresa" ON public.pedido_itens FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ===========================
-- Tabela: pedido_eventos
-- ===========================
CREATE TABLE IF NOT EXISTS public.pedido_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  descricao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_eventos_pedido ON public.pedido_eventos(pedido_id);

ALTER TABLE public.pedido_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedido eventos: select por empresa" ON public.pedido_eventos FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido eventos: insert por empresa" ON public.pedido_eventos FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido eventos: insert público cardápio" ON public.pedido_eventos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND p.canal = 'cardapio'));

-- ===========================
-- Tabela: pedido_enderecos
-- ===========================
CREATE TABLE IF NOT EXISTS public.pedido_enderecos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_contato TEXT,
  telefone_contato TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedido_enderecos_pedido ON public.pedido_enderecos(pedido_id);

ALTER TABLE public.pedido_enderecos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedido enderecos: select por empresa" ON public.pedido_enderecos FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido enderecos: insert por empresa" ON public.pedido_enderecos FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Pedido enderecos: insert público cardápio" ON public.pedido_enderecos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND p.canal = 'cardapio'));
CREATE POLICY "Pedido enderecos: update por empresa" ON public.pedido_enderecos FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ===========================
-- Tabela: loja_configuracoes
-- ===========================
CREATE TABLE IF NOT EXISTS public.loja_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_loja TEXT,
  taxa_entrega NUMERIC(10,2) DEFAULT 0,
  pedido_minimo NUMERIC(10,2) DEFAULT 0,
  tempo_preparo_min INTEGER DEFAULT 30,
  aceita_pedidos BOOLEAN NOT NULL DEFAULT true,
  horario_funcionamento JSONB,
  formas_pagamento JSONB DEFAULT '["pix","dinheiro","cartao_credito","cartao_debito"]'::jsonb,
  mensagem_boas_vindas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loja config: select por empresa" ON public.loja_configuracoes FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Loja config: select público" ON public.loja_configuracoes FOR SELECT
  USING (true);
CREATE POLICY "Loja config: insert por empresa" ON public.loja_configuracoes FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Loja config: update por empresa" ON public.loja_configuracoes FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_loja_configuracoes_updated_at
  BEFORE UPDATE ON public.loja_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================
-- Realtime
-- ===========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
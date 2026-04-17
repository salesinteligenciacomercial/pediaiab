
-- Tabela de configuração do programa de fidelidade (1 por empresa)
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  selos_para_premio INTEGER NOT NULL DEFAULT 10,
  nome_premio TEXT NOT NULL DEFAULT '1 Pizza Grátis',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_settings_select_company" ON public.loyalty_settings
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_settings_insert_company" ON public.loyalty_settings
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_settings_update_company" ON public.loyalty_settings
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_settings_delete_company" ON public.loyalty_settings
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Tabela de cartões fidelidade (1 por cliente/empresa)
CREATE TABLE IF NOT EXISTS public.loyalty_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  selos_atuais INTEGER NOT NULL DEFAULT 0,
  total_premios_resgatados INTEGER NOT NULL DEFAULT 0,
  ultimo_selo_em TIMESTAMPTZ,
  ultimo_resgate_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, lead_id)
);

ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_cards_select_company" ON public.loyalty_cards
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_cards_insert_company" ON public.loyalty_cards
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_cards_update_company" ON public.loyalty_cards
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "loyalty_cards_delete_company" ON public.loyalty_cards
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_lead ON public.loyalty_cards(lead_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_company ON public.loyalty_cards(company_id);

CREATE TRIGGER update_loyalty_settings_updated_at
  BEFORE UPDATE ON public.loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_cards_updated_at
  BEFORE UPDATE ON public.loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

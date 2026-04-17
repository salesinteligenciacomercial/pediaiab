
CREATE OR REPLACE FUNCTION public.add_loyalty_stamp_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings_active BOOLEAN;
BEGIN
  -- Verificar se o programa está ativo para esta empresa
  SELECT ativo INTO v_settings_active
  FROM public.loyalty_settings
  WHERE company_id = NEW.company_id
  LIMIT 1;

  -- Se não tem configuração ou não está ativo, ignorar
  IF v_settings_active IS NULL OR v_settings_active = false THEN
    RETURN NEW;
  END IF;

  -- Apenas para vendas concluídas/ganhas
  IF COALESCE(NEW.status, 'ativa') NOT IN ('ativa', 'ganho', 'concluida', 'paga') THEN
    RETURN NEW;
  END IF;

  -- Upsert no cartão fidelidade (1 selo por venda)
  INSERT INTO public.loyalty_cards (
    company_id, lead_id, selos_atuais, ultimo_selo_em
  ) VALUES (
    NEW.company_id, NEW.lead_id, 1, NOW()
  )
  ON CONFLICT (company_id, lead_id) DO UPDATE SET
    selos_atuais = loyalty_cards.selos_atuais + 1,
    ultimo_selo_em = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_add_loyalty_stamp ON public.customer_sales;
CREATE TRIGGER trigger_add_loyalty_stamp
  AFTER INSERT ON public.customer_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.add_loyalty_stamp_on_sale();

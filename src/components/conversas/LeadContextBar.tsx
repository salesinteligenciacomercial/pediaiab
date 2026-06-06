import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  leadId?: string | null;
  companyId?: string | null;
  endereco?: string | null;
}

export function LeadContextBar({ leadId, companyId, endereco }: Props) {
  const [ltv, setLtv] = useState<{ total_gasto: number; total_compras: number } | null>(null);
  const [selos, setSelos] = useState<{ atual: number; meta: number } | null>(null);

  useEffect(() => {
    if (!leadId) {
      setLtv(null);
      setSelos(null);
      return;
    }
    (async () => {
      const [{ data: l }, { data: s }, { data: cfg }] = await Promise.all([
        supabase.from("customer_ltv_cache").select("total_gasto,total_compras").eq("lead_id", leadId).maybeSingle(),
        supabase.from("loyalty_cards").select("selos_atuais").eq("lead_id", leadId).maybeSingle(),
        companyId
          ? supabase.from("loyalty_settings").select("selos_necessarios").eq("company_id", companyId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setLtv((l as any) || { total_gasto: 0, total_compras: 0 });
      setSelos({
        atual: (s as any)?.selos_atuais || 0,
        meta: (cfg as any)?.selos_necessarios || 10,
      });
    })();
  }, [leadId, companyId]);

  if (!leadId) return null;

  const recorrente = (ltv?.total_compras || 0) >= 3;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[11px] bg-card/40 border-b border-border">
      {recorrente && (
        <span className="flex items-center gap-1">
          🎯 <strong className="text-amber-500">Cliente recorrente</strong>
        </span>
      )}
      <span className="flex items-center gap-1">
        💰 <strong className="text-green-500">
          LTV R$ {Number(ltv?.total_gasto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </strong>
      </span>
      <span className="flex items-center gap-1">
        🍕 <strong className="text-foreground">{ltv?.total_compras || 0} pedidos</strong>
      </span>
      {selos && (
        <span className="flex items-center gap-1">
          ⭐ <strong style={{ color: "#D4A853" }}>{selos.atual}/{selos.meta} selos</strong>
        </span>
      )}
      {endereco && (
        <span className="flex items-center gap-1 truncate max-w-[40%]">
          📍 <span className="text-muted-foreground truncate">{endereco}</span>
        </span>
      )}
    </div>
  );
}

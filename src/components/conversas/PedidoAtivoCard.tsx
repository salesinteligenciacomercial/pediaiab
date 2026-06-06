import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  leadId?: string | null;
}

interface Pedido {
  id: string;
  codigo_pedido: string | null;
  status: string | null;
  total: number | null;
  created_at: string;
}

const STEPS = [
  { key: "novo", label: "Novo", emoji: "🆕" },
  { key: "producao", label: "Produção", emoji: "🔥" },
  { key: "entrega", label: "Entrega", emoji: "🛵" },
  { key: "concluido", label: "Entregue", emoji: "✅" },
];

function statusIndex(status: string | null): number {
  const s = (status || "").toLowerCase();
  if (/(conclu|entreg)/.test(s) && !/em.entrega|saiu/.test(s)) return 3;
  if (/(saiu|entrega|caminho)/.test(s)) return 2;
  if (/(produ|forno|prepara)/.test(s)) return 1;
  return 0;
}

export function PedidoAtivoCard({ leadId }: Props) {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    if (!leadId) {
      setPedido(null);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id,codigo_pedido,status,total,created_at")
        .eq("lead_id", leadId)
        .not("status", "in", '("cancelado","concluido","entregue")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancel) setPedido((data as any) || null);
    })();
    return () => {
      cancel = true;
    };
  }, [leadId]);

  if (!pedido) return null;
  const idx = statusIndex(pedido.status);

  return (
    <div className="mx-3 my-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🛒</span>
          <div>
            <div className="text-xs font-semibold">
              Pedido {pedido.codigo_pedido || `#${pedido.id.slice(0, 6).toUpperCase()}`}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Status: <strong className="text-primary">{pedido.status || "novo"}</strong>
            </div>
          </div>
        </div>
        <div className="text-sm font-bold text-primary">
          R$ {Number(pedido.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex-1 flex items-center gap-1">
            <div
              className={`flex-1 h-1.5 rounded-full ${
                i <= idx ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px]">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={i <= idx ? "text-primary font-medium" : "text-muted-foreground"}
          >
            {s.emoji} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

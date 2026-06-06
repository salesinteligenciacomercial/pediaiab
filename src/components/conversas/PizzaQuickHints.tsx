import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  leadId?: string | null;
  contactName?: string;
  onInsert: (text: string) => void;
}

const HINTS = [
  { label: "👋 Boas-vindas", text: "Olá! Que delícia ver você por aqui 🍕 Como posso te ajudar hoje?" },
  { label: "🔥 Saiu do forno", text: "Seu pedido já saiu do forno! 🔥 Chega em uns 30 minutinhos!" },
  { label: "🛵 Entrega a caminho", text: "Boa notícia! Seu pedido está a caminho 🛵 Já já chega aí!" },
  { label: "🎁 Cupom de fidelidade", text: "Você está pertinho de ganhar uma pizza grátis 🎁 Faltam poucos selos no seu cartão fidelidade!" },
  { label: "📋 Cardápio", text: "Aqui está nosso cardápio do dia 🍕 Confira nossas pizzas, bordas e combos!" },
];

export function PizzaQuickHints({ leadId, contactName, onInsert }: Props) {
  const [favorito, setFavorito] = useState<string | null>(null);
  const [diasUltima, setDiasUltima] = useState<number | null>(null);

  useEffect(() => {
    if (!leadId) {
      setFavorito(null);
      setDiasUltima(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("customer_ltv_cache")
        .select("produtos_favoritos,ultima_compra")
        .eq("lead_id", leadId)
        .maybeSingle();
      const arr = (data as any)?.produtos_favoritos;
      const fav = Array.isArray(arr) && arr.length > 0 ? arr[0]?.produto_nome : null;
      setFavorito(fav);
      const u = (data as any)?.ultima_compra;
      if (u) {
        const days = Math.floor((Date.now() - new Date(u).getTime()) / 86400000);
        setDiasUltima(days);
      }
    })();
  }, [leadId]);

  const primeiroNome = (contactName || "").split(" ")[0] || "Cliente";

  return (
    <div className="mb-2 space-y-1.5">
      {favorito && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-[11px] bg-amber-500/10 border border-amber-500/30">
          <div className="truncate">
            💡 <strong>{primeiroNome}</strong> costuma pedir <strong>{favorito}</strong>
            {diasUltima !== null && diasUltima > 0 && (
              <> — última vez há {diasUltima} {diasUltima === 1 ? "dia" : "dias"}</>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              onInsert(
                `Oi ${primeiroNome}! Já faz um tempinho 😋 Que tal pedir sua ${favorito} de hoje? Posso anotar pra você?`
              )
            }
            className="text-[11px] font-semibold text-amber-500 hover:text-amber-400 whitespace-nowrap"
          >
            Sugerir agora →
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {HINTS.map((h) => (
          <button
            key={h.label}
            type="button"
            onClick={() => onInsert(h.text)}
            className="px-2.5 py-1 rounded-full text-[11px] bg-muted hover:bg-muted/70 border border-border text-foreground transition"
          >
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClienteLTVFidelidadePanel } from "./ClienteLTVFidelidadePanel";
import {
  ShoppingCart,
  FileText,
  Gift,
  UserPlus,
  Phone,
  MapPin,
  Clock,
  TrendingUp,
  Pizza,
  Tag as TagIcon,
} from "lucide-react";

interface PainelPizzariaProps {
  contactName: string;
  contactPhone?: string;
  avatarUrl?: string;
  channel?: string;
  leadVinculado: any;
  companyId: string | null;
  mostrarBotaoCriarLead?: boolean;
  onNovoPedido: () => void;
  onCriarLead: () => void;
  onEnviarMensagem?: (msg: string) => void;
  onEditarLead?: () => void;
}

interface Sale {
  id: string;
  produto_nome: string | null;
  valor_final: number | null;
  quantidade: number | null;
  created_at: string;
}

interface LTV {
  total_gasto: number;
  total_compras: number;
  ticket_medio: number;
  ultima_compra: string | null;
  produtos_favoritos: any;
}

function timeAgo(d: string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) {
    const hrs = Math.floor(diff / 3600000);
    if (hrs <= 0) return "agora";
    return `há ${hrs}h`;
  }
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function initials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function PainelPizzaria({
  contactName,
  contactPhone,
  avatarUrl,
  channel,
  leadVinculado,
  companyId,
  mostrarBotaoCriarLead,
  onNovoPedido,
  onCriarLead,
  onEnviarMensagem,
  onEditarLead,
}: PainelPizzariaProps) {
  const [ltv, setLtv] = useState<LTV | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cardapioSlug, setCardapioSlug] = useState<string | null>(null);
  const [cardapioLoading, setCardapioLoading] = useState(true);
  const leadId = leadVinculado?.id || null;

  useEffect(() => {
    if (!companyId) {
      setCardapioSlug("loja");
      setCardapioLoading(false);
      return;
    }

    const loadCardapioSlug = async () => {
      try {
        const { data, error } = await supabase
          .from("loja_configuracoes" as any)
          .select("slug")
          .eq("company_id", companyId)
          .maybeSingle();

        if (!error && data?.slug) {
          setCardapioSlug(String(data.slug));
        } else {
          setCardapioSlug("loja");
        }
      } catch (err) {
        console.error("Erro ao carregar slug do cardápio:", err);
        setCardapioSlug("loja");
      } finally {
        setCardapioLoading(false);
      }
    };

    loadCardapioSlug();
  }, [companyId]);

  const load = useCallback(async () => {
    if (!leadId) {
      setLtv(null);
      setSales([]);
      return;
    }
    const [ltvRes, salesRes] = await Promise.all([
      supabase
        .from("customer_ltv_cache")
        .select("total_gasto,total_compras,ticket_medio,ultima_compra,produtos_favoritos")
        .eq("lead_id", leadId)
        .maybeSingle(),
      supabase
        .from("customer_sales")
        .select("id,produto_nome,valor_final,quantidade,created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setLtv((ltvRes.data as any) || null);
    setSales((salesRes.data as any) || []);
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const phone = contactPhone || leadVinculado?.phone || leadVinculado?.telefone || "";
  const endereco =
    leadVinculado?.endereco ||
    leadVinculado?.address ||
    leadVinculado?.notes?.match?.(/endere[çc]o:?\s*([^\n]+)/i)?.[1] ||
    null;

  const produtoFav = (() => {
    try {
      const arr = ltv?.produtos_favoritos;
      if (Array.isArray(arr) && arr.length > 0) return arr[0]?.produto_nome;
    } catch {}
    return null;
  })();

  const tags: string[] = Array.isArray(leadVinculado?.tags) ? leadVinculado.tags : [];

  const tagColor = (t: string) => {
    const k = t.toLowerCase();
    if (/(fiel|vip|ouro|gold)/.test(k)) return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    if (/(novo|new)/.test(k)) return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    if (/(ativo|verde)/.test(k)) return "bg-green-500/10 text-green-500 border-green-500/30";
    if (/(reclama|alerta|atra)/.test(k)) return "bg-red-500/10 text-red-500 border-red-500/30";
    if (/(pizza|cala|marg|calabresa)/.test(k)) return "bg-primary/10 text-primary border-primary/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="p-4 space-y-5">
      {/* Avatar + nome */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="w-16 h-16 rounded-full bg-muted border-2 border-primary/40 flex items-center justify-center text-xl font-bold overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={contactName} className="w-full h-full object-cover" />
          ) : (
            <span>{initials(contactName)}</span>
          )}
        </div>
        <div className="text-center">
          <div className="text-base font-semibold">{contactName}</div>
          {phone && <div className="text-xs text-muted-foreground">{phone}</div>}
        </div>
        {onEditarLead && leadVinculado && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEditarLead}>
            Editar dados
          </Button>
        )}
        {mostrarBotaoCriarLead && !leadVinculado && (
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={onCriarLead}>
            <UserPlus className="h-3 w-3 mr-1" /> Criar lead
          </Button>
        )}
      </div>

      {/* Dados */}
      <div>
        <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
          Dados
        </div>
        <div className="rounded-lg border border-border bg-card divide-y divide-border text-xs">
          <div className="flex justify-between p-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> {channel || "Canal"}
            </span>
            <span className="font-medium">{phone || "—"}</span>
          </div>
          <div className="flex justify-between p-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Endereço
            </span>
            <span className="font-medium text-right truncate ml-2 max-w-[55%]">
              {endereco || "Não informado"}
            </span>
          </div>
          <div className="flex justify-between p-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Último pedido
            </span>
            <span className="font-medium">{timeAgo(ltv?.ultima_compra || null)}</span>
          </div>
        </div>
      </div>

      {/* LTV */}
      {leadId && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Valor do cliente
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-base font-bold text-foreground">
                  R$ {Number(ltv?.total_gasto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground">LTV Total</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-base font-bold text-foreground">{ltv?.total_compras || 0}</div>
                <div className="text-[10px] text-muted-foreground">Pedidos</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-base font-bold text-foreground">
                  R$ {Number(ltv?.ticket_medio || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-muted-foreground">Ticket médio</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-base font-bold text-foreground">{timeAgo(ltv?.ultima_compra || null)}</div>
                <div className="text-[10px] text-muted-foreground">Recência</div>
              </div>
            </div>
            {produtoFav && (
              <div className="text-xs bg-primary/10 text-primary rounded-md px-2 py-1.5 flex items-center gap-1.5">
                <Pizza className="h-3 w-3" /> Favorito: <strong>{produtoFav}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fidelidade (componente já existente) */}
      <div>
        <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
          ⭐ Fidelidade
        </div>
        <ClienteLTVFidelidadePanel leadId={leadId} companyId={companyId} />
      </div>

      {/* Histórico de pedidos */}
      {leadId && sales.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
            🛒 Histórico de pedidos
          </div>
          <div className="space-y-1.5">
            {sales.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card text-xs hover:bg-muted/40 transition"
              >
                <div className="font-mono text-[10px] text-muted-foreground">
                  #{s.id.slice(0, 4).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {(s.quantidade || 1) > 1 ? `${s.quantidade}× ` : ""}
                    {s.produto_nome || "Pedido"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{timeAgo(s.created_at)}</div>
                </div>
                <div className="font-semibold text-primary">
                  R$ {Number(s.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider flex items-center gap-1.5">
            <TagIcon className="h-3 w-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <Badge key={i} variant="outline" className={`text-[10px] ${tagColor(t)}`}>
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div>
        <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
          ⚡ Ações rápidas
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onNovoPedido}
            className="h-auto flex-col py-3 gap-1 bg-primary hover:bg-primary/90"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-[11px]">Novo pedido</span>
          </Button>
          <Button
            variant="outline"
            disabled={cardapioLoading}
            onClick={() => {
              if (cardapioLoading) {
                toast.error("Aguarde o link do cardápio digital");
                return;
              }
              onEnviarMensagem?.(
                `Olá! Aqui está nosso cardápio digital 🍕 Confira nosso menu completo: ${window.location.origin}/cardapio/${cardapioSlug || "loja"}`
              );
            }}
            className="h-auto flex-col py-3 gap-1"
          >
            <FileText className="h-4 w-4" />
            <span className="text-[11px]">Enviar cardápio</span>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              onEnviarMensagem?.(
                "🎁 Promoção especial pra você hoje! Peça uma pizza grande e ganhe um refri 2L grátis 🥤"
              )
            }
            className="h-auto flex-col py-3 gap-1"
          >
            <Gift className="h-4 w-4" />
            <span className="text-[11px]">Enviar promoção</span>
          </Button>
          <Button
            variant="outline"
            onClick={onCriarLead}
            disabled={!mostrarBotaoCriarLead && !!leadVinculado}
            className="h-auto flex-col py-3 gap-1"
          >
            <UserPlus className="h-4 w-4" />
            <span className="text-[11px]">{leadVinculado ? "Lead criado" : "Criar lead"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

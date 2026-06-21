import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import MesasView from "@/components/pedidos/MesasView";
import EntregadoresView from "@/components/pedidos/EntregadoresView";
import { PedidoChatModal } from "@/components/conversas/PedidoChatModal";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone?: string | null;
  canal: string;
  tipo_atendimento: string;
  mesa_id: string | null;
  status: PedidoStatus;
  total: number;
  observacoes: string | null;
  created_at: string;
  entregador_id?: string | null;
  valor_comissao?: number | null;
  aceito_entregador_em?: string | null;
  entregue_em?: string | null;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  observacoes: string | null;
};

type Entregador = {
  id: string;
  company_id: string;
  nome: string;
  telefone: string | null;
  veiculo: string;
  status: string;
  pct_comissao: number;
  pix_chave: string | null;
  avaliacao_media: number;
  online: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const KDS_STATUSES: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto", "saiu_entrega", "entregue"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  novo:        { label: "Novos",       color: "#4A9EFF", bg: "#071025", border: "#213647", glow: "rgba(74,158,255,0.14)" },
  aceito:      { label: "Aceitos",     color: "#F5A623", bg: "#1C1500", border: "#78430A", glow: "rgba(245,166,35,0.18)" },
  em_producao: { label: "Em Produção", color: "#FF5C00", bg: "#1A0A00", border: "#7C2D12", glow: "rgba(255,92,0,0.20)" },
  pronto:      { label: "Prontos",     color: "#2ECC8F", bg: "#001A08", border: "#14532D", glow: "rgba(46,204,143,0.18)" },
  saiu_entrega: { label: "Em Entrega", color: "#B980FF", bg: "#12071A", border: "#3B2544", glow: "rgba(185,128,255,0.12)" },
  entregue:    { label: "Entregues",   color: "#7A798A", bg: "#0F0F11", border: "#1F1F23", glow: "rgba(122,121,138,0.06)" },
};

const CANAL_LABEL: Record<string, string> = {
  cardapio:    "📱 Cardápio",
  whatsapp:    "💬 WhatsApp",
  instagram:   "📸 Instagram",
  atendimento: "🖥️ Chat",
  interno:     "🏠 Balcão",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getElapsed(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

function getUrgency(createdAt: string, status: PedidoStatus): "normal" | "warning" | "urgent" {
  const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (status === "aceito" && minutes > 5) return "urgent";
  if (status === "em_producao" && minutes > 20) return "urgent";
  if (status === "em_producao" && minutes > 15) return "warning";
  if (status === "aceito" && minutes > 3) return "warning";
  return "normal";
}

// ─── PedidoCard Component ─────────────────────────────────────────────────────

async function darBaixaEstoquePedido(pedidoId: string, companyId: string) {
  const { data: itens } = await (supabase.from("pedido_itens" as any) as any)
    .select("produto_id, produto_nome, quantidade")
    .eq("pedido_id", pedidoId);

  for (const item of (itens || [])) {
    let produtoId = item.produto_id as string | null;
    let controlaEstoque = false;

    if (produtoId) {
      const { data: produto } = await (supabase.from("produtos_servicos" as any) as any)
        .select("id, controla_estoque")
        .eq("company_id", companyId)
        .eq("id", produtoId)
        .maybeSingle();
      controlaEstoque = !!produto?.controla_estoque;
    } else {
      const { data: produtos } = await (supabase.from("produtos_servicos" as any) as any)
        .select("id, controla_estoque")
        .eq("company_id", companyId)
        .ilike("nome", item.produto_nome)
        .limit(1);
      produtoId = produtos?.[0]?.id ?? null;
      controlaEstoque = !!produtos?.[0]?.controla_estoque;
    }

    if (!produtoId || !controlaEstoque) continue;

    const { data: composicoes } = await (supabase.from("produto_composicoes" as any) as any)
      .select("insumo_id, quantidade")
      .eq("produto_id", produtoId);

    if (composicoes?.length) {
      for (const comp of composicoes) {
        await supabase.rpc("registrar_movimentacao_estoque" as any, {
          p_company_id: companyId,
          p_produto_id: comp.insumo_id,
          p_tipo: "saida",
          p_quantidade: Number(comp.quantidade || 0) * Number(item.quantidade || 1),
          p_motivo: "venda",
          p_pedido_id: pedidoId,
          p_observacao: `Baixa automatica do pedido ${pedidoId}`,
        });
      }
    } else {
      await supabase.rpc("registrar_movimentacao_estoque" as any, {
        p_company_id: companyId,
        p_produto_id: produtoId,
        p_tipo: "saida",
        p_quantidade: Number(item.quantidade || 1),
        p_motivo: "venda",
        p_pedido_id: pedidoId,
        p_observacao: `Baixa automatica do pedido ${pedidoId}`,
      });
    }
  }
}

function PedidoCard({
  pedido,
  itensByPedido,
  onAdvance,
  isNew,
  entregadoresList,
}: {
  pedido: Pedido;
  itensByPedido: Record<string, PedidoItem[]>;
  onAdvance: (pedido: Pedido) => void;
  isNew: boolean;
  entregadoresList: Entregador[];
}) {
  const itens = itensByPedido[pedido.id] || [];
  const cfg = STATUS_CONFIG[pedido.status];
  const urgency = getUrgency(pedido.created_at, pedido.status);
  const [elapsed, setElapsed] = useState(getElapsed(pedido.created_at));

  useEffect(() => {
    const t = setInterval(() => setElapsed(getElapsed(pedido.created_at)), 10000);
    return () => clearInterval(t);
  }, [pedido.created_at]);

  const nextLabel: Record<PedidoStatus, string> = {
    novo:        "✓ Aceitar Pedido",
    aceito:      "▶ Iniciar Produção",
    em_producao: "✓ Pronto",
    pronto:      "✓ Entregue",
    saiu_entrega: "", entregue: "", cancelado: "",
  };

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1.5px solid ${urgency === "urgent" ? "#EF4444" : urgency === "warning" ? "#F59E0B" : cfg.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: urgency === "urgent"
          ? "0 0 20px rgba(239,68,68,0.3), inset 0 0 30px rgba(239,68,68,0.05)"
          : `0 0 16px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
        animation: isNew ? "cardPop 0.4s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
        transition: "box-shadow 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top glow strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: urgency === "urgent"
          ? "linear-gradient(90deg, transparent, #EF4444, transparent)"
          : `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
        opacity: urgency === "urgent" ? 1 : 0.7,
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 18,
              fontWeight: 700,
              color: cfg.color,
              letterSpacing: "-0.5px",
            }}>
              #{pedido.codigo_pedido}
            </span>
            {urgency === "urgent" && (
              <span style={{
                background: "#EF4444",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                letterSpacing: "0.5px",
                animation: "urgentPulse 1s ease-in-out infinite",
              }}>
                URGENTE
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            {pedido.cliente_nome}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20,
            fontWeight: 700,
            color: urgency === "urgent" ? "#EF4444" : urgency === "warning" ? "#F59E0B" : "#6B7280",
            lineHeight: 1,
          }}>
            {elapsed}
          </div>
          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>tempo</div>
        </div>
      </div>

      {/* Canal + tipo */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20,
          background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}>
          {CANAL_LABEL[pedido.canal] || pedido.canal}
        </span>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20,
          background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}>
          {pedido.tipo_atendimento === "mesa" ? `🪑 Mesa` :
           pedido.tipo_atendimento === "entrega" ? "🛵 Delivery" :
           pedido.tipo_atendimento === "retirada" ? "🏃 Retirada" : pedido.tipo_atendimento}
        </span>
      </div>

      {/* Itens */}
      <div style={{
        background: "rgba(0,0,0,0.3)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        {itens.length === 0 ? (
          <span style={{ fontSize: 12, color: "#6B7280" }}>Carregando itens...</span>
        ) : itens.map((item) => (
          <div key={item.id}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                fontWeight: 700,
                color: cfg.color,
                minWidth: 24,
              }}>
                {item.quantidade}×
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#E5E7EB" }}>
                {item.produto_nome}
              </span>
            </div>
            {item.observacoes && (
              <div style={{
                marginLeft: 32, fontSize: 11, color: "#F59E0B",
                fontStyle: "italic", marginTop: 2,
              }}>
                ⚠ {item.observacoes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Observações do pedido */}
      {pedido.observacoes && (
        <div style={{
          fontSize: 11, color: "#F59E0B", fontStyle: "italic",
          background: "rgba(245,158,11,0.08)",
          border: "0.5px solid rgba(245,158,11,0.2)",
          borderRadius: 6, padding: "5px 8px",
        }}>
          📝 {pedido.observacoes}
        </div>
      )}

      {pedido.status === "saiu_entrega" && pedido.entregador_id && (() => {
        const ent = entregadoresList.find((e) => e.id === pedido.entregador_id);
        return ent ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#1e0a2e", borderRadius: 6, padding: "5px 8px",
          }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#B980FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#12071A", fontWeight: 700 }}>
              {ent.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <span style={{ color: "#B980FF", fontSize: 9 }}>{ent.nome}</span>
          </div>
        ) : null;
      })()}

      {/* Action button */}
      {pedido.status === "pronto" && pedido.tipo_atendimento === "entrega" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            background: "#0d2012", border: "0.5px solid #14532d",
            borderRadius: 6, padding: "4px 8px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "#4ade80", fontSize: 8 }}>Aguarda entregador</span>
          </div>
          <button onClick={() => onAdvance(pedido)} style={{
            background: "#2ECC8F", color: "#001A08",
            border: "none", borderRadius: 8, padding: "8px",
            fontSize: 11, fontWeight: 600, cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            Atribuir entregador
          </button>
        </div>
      ) : nextLabel[pedido.status] && (
        <button
          onClick={() => onAdvance(pedido)}
          style={{
            marginTop: 2,
            padding: "9px 0",
            background: pedido.status === "pronto"
              ? "rgba(34,197,94,0.15)"
              : pedido.status === "em_producao"
              ? "rgba(249,115,22,0.15)"
              : "rgba(245,158,11,0.15)",
            border: `1px solid ${cfg.color}`,
            borderRadius: 8,
            color: cfg.color,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.3px",
            transition: "background 0.15s, transform 0.1s",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(255,255,255,0.1)`)}
          onMouseLeave={(e) => (e.currentTarget.style.background =
            pedido.status === "pronto" ? "rgba(34,197,94,0.15)"
            : pedido.status === "em_producao" ? "rgba(249,115,22,0.15)"
            : "rgba(245,158,11,0.15)"
          )}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {nextLabel[pedido.status]}
        </button>
      )}
    </div>
  );
}

// ─── Column Component ──────────────────────────────────────────────────────────

function KDSColumn({
  status,
  pedidos,
  itensByPedido,
  newIds,
  onAdvance,
  entregadoresList,
}: {
  status: PedidoStatus;
  pedidos: Pedido[];
  itensByPedido: Record<string, PedidoItem[]>;
  newIds: Set<string>;
  onAdvance: (pedido: Pedido) => void;
  entregadoresList: Entregador[];
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 0,
      minWidth: 0,
      flex: 1,
    }}>
      {/* Column header */}
      <div style={{
        padding: "10px 16px",
        marginBottom: 12,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${cfg.bg}, rgba(0,0,0,0.5))`,
        border: `1px solid ${cfg.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: cfg.color,
            boxShadow: `0 0 8px ${cfg.color}`,
          }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: cfg.color,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}>
            {cfg.label}
          </span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 16,
          fontWeight: 700,
          color: cfg.color,
          background: `rgba(0,0,0,0.4)`,
          padding: "2px 10px",
          borderRadius: 6,
          border: `0.5px solid ${cfg.border}`,
        }}>
          {pedidos.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
        flex: 1,
        paddingRight: 4,
      }}>
        {pedidos.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px 16px",
            color: "#374151",
            fontSize: 13,
            border: "1px dashed #1F2937",
            borderRadius: 12,
          }}>
            Nenhum pedido
          </div>
        ) : (
          pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              itensByPedido={itensByPedido}
              onAdvance={onAdvance}
              isNew={newIds.has(p.id)}
              entregadoresList={entregadoresList}
            />
          ))
        )}

      </div>
    </div>
  );
}

// ─── Main KDS Component ───────────────────────────────────────────────────────

export default function KDS() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itensByPedido, setItensByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"delivery" | "mesas" | "entregadores">("delivery");
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [pedidoParaAtribuir, setPedidoParaAtribuir] = useState<Pedido | null>(null);
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<string | null>(null);
  const [atribuindo, setAtribuindo] = useState(false);
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("kds_sound_enabled") !== "false";
  });
  const audioRef = useRef<AudioContext | null>(null);

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Play beep sound when new pedido arrives
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      // double-beep for stronger alert
      [0, 0.18].forEach((offset) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(1000, ctx.currentTime + offset);
        oscillator.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + offset + 0.15);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime + offset);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.4);
        oscillator.start(ctx.currentTime + offset);
        oscillator.stop(ctx.currentTime + offset + 0.4);
      });
    } catch {
      // AudioContext blocked until user interaction — fine
    }
  }, [soundEnabled]);

  // Persist sound preference
  useEffect(() => {
    try { localStorage.setItem("kds_sound_enabled", String(soundEnabled)); } catch {}
  }, [soundEnabled]);

  // Load data
  const load = useCallback(async (cid: string) => {
    const [pedidosRes, itensRes] = await Promise.all([
      (supabase.from("pedidos" as any) as any)
        .select("*")
        .eq("company_id", cid)
        .in("status", KDS_STATUSES)
        .order("created_at", { ascending: true }),
      (supabase.from("pedido_itens" as any) as any)
        .select("*")
        .eq("company_id", cid),
    ]);

    if (!pedidosRes.error) {
      const incoming: Pedido[] = pedidosRes.data || [];
      setPedidos((prev) => {
        const prevIds = new Set(prev.map((p: Pedido) => p.id));
        const fresh = incoming.filter((p: Pedido) => !prevIds.has(p.id));
        if (fresh.length > 0) {
          playBeep();
          setNewIds((ids) => {
            const next = new Set(ids);
            fresh.forEach((p: Pedido) => next.add(p.id));
            setTimeout(() => setNewIds((s) => {
              const n = new Set(s);
              fresh.forEach((p: Pedido) => n.delete(p.id));
              return n;
            }), 1000);
            return next;
          });
        }
        return incoming;
      });
    }

    if (!itensRes.error) {
      const grouped: Record<string, PedidoItem[]> = {};
      for (const item of (itensRes.data || [])) {
        if (!grouped[item.pedido_id]) grouped[item.pedido_id] = [];
        grouped[item.pedido_id].push(item);
      }
      setItensByPedido(grouped);
    }
  }, [playBeep]);

  const loadEntregadores = useCallback(async (cid: string) => {
    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("*")
      .eq("company_id", cid)
      .eq("status", "ativo")
      .order("nome");

    if (error) {
      console.error("[KDS] erro ao carregar entregadores", error);
      return;
    }

    if (data) setEntregadores(data);
  }, []);

  // Bootstrap
  useEffect(() => {
    (async () => {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      if (!cid) return;
      setCompanyId(cid);
      await load(cid);
      await loadEntregadores(cid);
      setLoading(false);
    })();
  }, [load, loadEntregadores]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`kds-pedidos-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` },
        () => load(companyId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_itens" },
        () => load(companyId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entregadores", filter: `company_id=eq.${companyId}` },
        () => loadEntregadores(companyId)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, load, loadEntregadores]);

  const handleAtribuirEntregador = useCallback(async () => {
    if (!pedidoParaAtribuir || !entregadorSelecionado || !companyId) return;
    setAtribuindo(true);

    const entregador = entregadores.find((e) => e.id === entregadorSelecionado);
    const valorComissao = pedidoParaAtribuir.total * ((entregador?.pct_comissao ?? 10) / 100);

    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({
        entregador_id: entregadorSelecionado,
        status: "saiu_entrega",
        valor_comissao: valorComissao,
        aceito_entregador_em: new Date().toISOString(),
      })
      .eq("id", pedidoParaAtribuir.id);

    if (error) {
      toast.error("Erro ao atribuir entregador");
      setAtribuindo(false);
      return;
    }

    await (supabase.from("pedido_eventos" as any) as any).insert({
      pedido_id: pedidoParaAtribuir.id,
      company_id: companyId,
      tipo: "entregador_atribuido",
      descricao: `Entregador ${entregador?.nome} atribuido. Comissao: R$${valorComissao.toFixed(2)}`,
    });

    const telLimpo = String(pedidoParaAtribuir.cliente_telefone || "").replace(/\D/g, "");
    if (telLimpo.length >= 10) {
      await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          company_id: companyId,
          numero: telLimpo,
          mensagem: `*Saiu para entrega!*\n\nOla ${pedidoParaAtribuir.cliente_nome}, seu pedido *${pedidoParaAtribuir.codigo_pedido}* saiu para entrega com ${entregador?.nome}. Logo chegara ate voce!`,
          origem: "kds-entregador",
        },
      });
    }

    toast.success(`${entregador?.nome} atribuido ao pedido #${pedidoParaAtribuir.codigo_pedido}`);
    setPedidoParaAtribuir(null);
    setEntregadorSelecionado(null);
    setAtribuindo(false);
    await load(companyId);
  }, [pedidoParaAtribuir, entregadorSelecionado, entregadores, companyId, load]);

  // Advance status
  const handleAdvance = useCallback(async (pedido: Pedido) => {
    if (pedido.status === "pronto" && pedido.tipo_atendimento === "entrega") {
      setPedidoParaAtribuir(pedido);
      setEntregadorSelecionado(null);
      return;
    }

    const flow: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto", "entregue"];
    const idx = flow.indexOf(pedido.status);
    if (idx < 0 || idx >= flow.length - 1) return;
    const nextStatus = flow[idx + 1];

    // Optimistic update
    setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, status: nextStatus } : p)));

    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({ status: nextStatus })
      .eq("id", pedido.id);

    if (error) {
      console.error("[KDS] erro ao avançar pedido", error);
      toast.error(`Erro ao avançar: ${error.message}`);
      // Revert
      setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, status: pedido.status } : p)));
      return;
    }

    await (supabase.from("pedido_eventos" as any) as any).insert({
      pedido_id: pedido.id,
      company_id: pedido.company_id,
      tipo: "status_changed",
      descricao: `KDS: status alterado para ${nextStatus}`,
    });

    // 📲 Notificar cliente via WhatsApp sobre avanço de status
    if (nextStatus === "entregue") {
      try {
        await darBaixaEstoquePedido(pedido.id, pedido.company_id);
      } catch (stockErr) {
        console.error("[KDS] erro ao dar baixa no estoque", stockErr);
        toast.error("Pedido entregue, mas houve erro na baixa de estoque");
      }
    }

    try {
      const telLimpo = String(pedido.cliente_telefone || "").replace(/\D/g, "");
      if (telLimpo.length >= 10) {
        const statusMsg: Record<PedidoStatus, string> = {
          novo: "",
          aceito: `✅ *Pedido aceito!*\n\nOlá ${pedido.cliente_nome}, seu pedido *${pedido.codigo_pedido}* foi aceito e entrará na fila de produção em breve. 🍕`,
          em_producao: `👨‍🍳 *Pedido em produção!*\n\nOlá ${pedido.cliente_nome}, seu pedido *${pedido.codigo_pedido}* já está sendo preparado com carinho. 🔥`,
          pronto: pedido.tipo_atendimento === "entrega"
            ? `📦 *Pedido pronto!*\n\nOlá ${pedido.cliente_nome}, seu pedido *${pedido.codigo_pedido}* está pronto e logo sairá para entrega. 🛵`
            : `📦 *Pedido pronto!*\n\nOlá ${pedido.cliente_nome}, seu pedido *${pedido.codigo_pedido}* está pronto para retirada. 🏠`,
          saiu_entrega: `🛵 *Saiu para entrega!*\n\nOlá ${pedido.cliente_nome}, seu pedido *${pedido.codigo_pedido}* saiu para entrega e logo chegará até você. 🚀`,
          entregue: `🎉 *Pedido entregue!*\n\nOlá ${pedido.cliente_nome}, esperamos que aproveite seu pedido *${pedido.codigo_pedido}*. Obrigado pela preferência! 🧡`,
          cancelado: "",
        };
        const mensagem = statusMsg[nextStatus];
        if (mensagem) {
          await supabase.functions.invoke("enviar-whatsapp", {
            body: {
              company_id: pedido.company_id,
              numero: telLimpo,
              mensagem,
              origem: "kds-status",
            },
          });
        }
      }
    } catch (msgErr) {
      console.error("[KDS] erro ao notificar cliente:", msgErr);
    }
  }, []);

  const pedidosByStatus = KDS_STATUSES.reduce((acc, s) => {
    acc[s] = pedidos.filter((p) => p.status === s);
    return acc;
  }, {} as Record<PedidoStatus, Pedido[]>);

  const totalAtivos = pedidos.length;
  const novosCount = pedidosByStatus["novo"]?.length || 0;

  // Repeat alert beep every 6s while there are pending "novo" pedidos
  useEffect(() => {
    if (!soundEnabled || novosCount === 0) return;
    const id = setInterval(() => playBeep(), 6000);
    return () => clearInterval(id);
  }, [soundEnabled, novosCount, playBeep]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { box-sizing: border-box; }

        body, html { margin: 0; padding: 0; }

        .kds-root {
          min-height: 100vh;
          background: #0A0A0A;
          color: #E5E7EB;
          font-family: ui-sans-serif, system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .kds-columns {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          padding: 0 16px 16px;
          overflow: hidden;
        }

        /* Tabs & filters */
        .kds-tabs { display:flex; gap:8px; padding:14px 16px; align-items:center }
        .kds-tab { padding:8px 12px; border-radius:10px; background:transparent; color:#9CA3AF; border:1px solid transparent; cursor:pointer }
        .kds-tab.active { background:#0f1724; border-color:#1F2937; color:#E5E7EB }
        .kds-filterbar { display:flex; justify-content:space-between; align-items:center; padding:0 16px 12px }
        .kds-chips { display:flex; gap:8px; flex-wrap:wrap }
        .kds-chip { padding:6px 12px; border-radius:20px; background:#0f1113; border:1px solid #1F2937; color:#9CA3AF; cursor:pointer }
        .kds-chip.active { background: rgba(255,92,0,0.12); border-color: rgba(255,92,0,0.35); color: #FF8C42 }

        @keyframes cardPop {
          0%   { transform: scale(0.85); opacity: 0; }
          70%  { transform: scale(1.04); }
          100% { transform: scale(1);    opacity: 1; }
        }

        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }

        @keyframes kdsBellPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(249,115,22,0.45); }
          50%      { transform: scale(1.08); box-shadow: 0 0 26px rgba(249,115,22,0.85); }
        }


        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        .kds-scanline {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(180deg, transparent, rgba(249,115,22,0.06), transparent);
          pointer-events: none;
          animation: scanline 8s linear infinite;
          z-index: 999;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 2px; }
      `}</style>

      <div className="kds-root">
        <div className="kds-scanline" />

        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid #111827",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(10px)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #F97316, #EF4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              🍕
            </div>
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15, fontWeight: 700, color: "#F97316",
                letterSpacing: "1px",
              }}>
                ROSH PIZZARIA
              </div>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "2px", textTransform: "uppercase" }}>
                Kitchen Display System
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {activeTab === "mesas" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 110, padding: "5px 14px", borderRadius: 8, background: "#131618", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#FF8C42", lineHeight: 1 }}>{totalAtivos}</span>
                  <span style={{ fontSize: 9, color: "#5f6368", textTransform: "uppercase", letterSpacing: ".07em", marginTop: 2 }}>Pedidos abertos</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 110, padding: "5px 14px", borderRadius: 8, background: "#131618", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#2ECC8F", lineHeight: 1 }}>Tempo real</span>
                  <span style={{ fontSize: 9, color: "#5f6368", textTransform: "uppercase", letterSpacing: ".07em", marginTop: 2 }}>Mesas sincronizadas</span>
                </div>
              </div>
            )}
            {/* Sino de novos pedidos */}
            <button
              onClick={() => {
                setSoundEnabled((s) => !s);
                // garante que o AudioContext seja desbloqueado pelo gesto do usuário
                try {
                  if (!audioRef.current) audioRef.current = new AudioContext();
                  audioRef.current.resume?.();
                } catch {}
              }}
              title={soundEnabled ? "Som ativado — clique para silenciar" : "Som silenciado — clique para ativar"}
              style={{
                position: "relative",
                width: 40, height: 40, borderRadius: 10,
                border: `1px solid ${novosCount > 0 ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.08)"}`,
                background: novosCount > 0
                  ? "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(239,68,68,0.25))"
                  : "#111827",
                color: novosCount > 0 ? "#FDBA74" : (soundEnabled ? "#E5E7EB" : "#6B7280"),
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                animation: novosCount > 0 ? "kdsBellPulse 1.1s ease-in-out infinite" : undefined,
                boxShadow: novosCount > 0 ? "0 0 18px rgba(249,115,22,0.45)" : "none",
                transition: "background .2s, color .2s, border-color .2s",
              }}
            >
              {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              {novosCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6, right: -6,
                  minWidth: 18, height: 18, padding: "0 5px",
                  borderRadius: 999,
                  background: "#EF4444",
                  color: "#fff",
                  fontSize: 10, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  border: "2px solid #0b0b0d",
                }}>
                  {novosCount > 99 ? "99+" : novosCount}
                </span>
              )}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: companyId && !loading ? "#22C55E" : "#6B7280",
                boxShadow: companyId && !loading ? "0 0 8px #22C55E" : "none",
              }} />
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                {loading ? "conectando..." : "tempo real"}
              </span>
            </div>

            {activeTab === "delivery" && <div style={{
              background: "#111827",
              border: "0.5px solid #1F2937",
              borderRadius: 8,
              padding: "4px 12px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 11, color: "#6B7280" }}>em fila</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 18, fontWeight: 700,
                color: totalAtivos > 0 ? "#F97316" : "#4B5563",
              }}>
                {totalAtivos}
              </span>
            </div>}

            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 20, fontWeight: 700,
              color: "#E5E7EB",
              letterSpacing: "1px",
              minWidth: 80, textAlign: "right",
            }}>
              {clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Tabs / Filters */}
        <div style={{display:'flex', flexDirection: 'column'}}>
          <div className="kds-tabs" style={{ justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className={`kds-tab ${activeTab === "delivery" ? "active" : ""}`}
              onClick={() => setActiveTab("delivery")}
            >
              🛵 Delivery / Balcão <span style={{marginLeft:8, background:'#0b0b0d', padding:'2px 8px', borderRadius:8}}>{totalAtivos}</span>
            </button>
            <button
              className={`kds-tab ${activeTab === "mesas" ? "active" : ""}`}
              onClick={() => setActiveTab("mesas")}
            >
              🪑 Mesas
            </button>
            <button
              className={`kds-tab ${activeTab === "entregadores" ? "active" : ""}`}
              onClick={() => setActiveTab("entregadores")}
              style={{ color: activeTab === "entregadores" ? "#B980FF" : undefined }}
            >
              Entregadores
              <span style={{ marginLeft: 8, background: "#0b0b0d", padding: "2px 8px", borderRadius: 8, color: "#B980FF" }}>
                {entregadores.filter((e) => e.online).length}
              </span>
            </button>
            </div>
            <button
              onClick={() => setNovoPedidoOpen(true)}
              style={{
                border: "1px solid rgba(249,115,22,0.42)",
                background: "linear-gradient(135deg, #F97316, #EF4444)",
                color: "#fff",
                borderRadius: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: ".02em",
                cursor: "pointer",
                boxShadow: "0 10px 26px rgba(249,115,22,0.22)",
                whiteSpace: "nowrap",
              }}
            >
              + Novo Pedido
            </button>
          </div>
          {activeTab === "delivery" && (
            <div className="kds-filterbar">
              <div className="kds-chips">
                <div className="kds-chip active">Todos os canais</div>
                <div className="kds-chip">Cardápio Digital</div>
                <div className="kds-chip">WhatsApp</div>
                <div className="kds-chip">Instagram</div>
                <div className="kds-chip">Chat</div>
                <div className="kds-chip">Manual / Balcão</div>
              </div>
              <div style={{color:'#6B7280', fontSize:12}}>Exibindo: 6 colunas</div>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "2px solid #1F2937",
              borderTopColor: "#F97316",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ fontSize: 13, color: "#6B7280" }}>Carregando pedidos...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : activeTab === "mesas" ? (
          companyId ? <MesasView companyId={companyId} /> : null
        ) : activeTab === "entregadores" ? (
          companyId ? (
            <EntregadoresView
              entregadores={entregadores}
              pedidos={pedidos}
              companyId={companyId}
              onReload={() => loadEntregadores(companyId)}
            />
          ) : null
        ) : (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div className="kds-columns" style={{ flex: 1 }}>
              {KDS_STATUSES.map((status) => (
                <KDSColumn
                  key={status}
                  status={status}
                  pedidos={pedidosByStatus[status]}
                  itensByPedido={itensByPedido}
                  newIds={newIds}
                  onAdvance={handleAdvance}
                  entregadoresList={entregadores}
                />
              ))}
            </div>

            <div style={{
              width: 200, flexShrink: 0,
              borderLeft: "1px solid #111827",
              background: "#0a0a0f",
              display: "flex", flexDirection: "column",
              overflowY: "auto",
            }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #111827" }}>
                <div style={{ color: "#B980FF", fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                  Entregadores
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: "#0d2012", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ color: "#4ade80", fontSize: 14, fontWeight: 600 }}>
                      {entregadores.filter((e) => e.online && !pedidos.some((p) => p.entregador_id === e.id && p.status === "saiu_entrega")).length}
                    </div>
                    <div style={{ color: "#444", fontSize: 8 }}>livres</div>
                  </div>
                  <div style={{ flex: 1, background: "#12071A", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ color: "#B980FF", fontSize: 14, fontWeight: 600 }}>
                      {pedidos.filter((p) => p.status === "saiu_entrega").length}
                    </div>
                    <div style={{ color: "#444", fontSize: 8 }}>em rota</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                {entregadores.filter((e) => e.online).map((ent) => {
                  const emRota = pedidos.find((p) => p.entregador_id === ent.id && p.status === "saiu_entrega");
                  return (
                    <div key={ent.id} style={{
                      background: "#111118",
                      border: `0.5px solid ${emRota ? "#3B2544" : "#14532d"}`,
                      borderRadius: 10, padding: "8px 10px",
                      display: "flex", alignItems: "center", gap: 8,
                      opacity: emRota ? 0.75 : 1,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: emRota ? "#1e0a2e" : "#0d2012",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600,
                        color: emRota ? "#B980FF" : "#4ade80",
                        flexShrink: 0,
                      }}>
                        {ent.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e5e5e5", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ent.nome.split(" ")[0]}
                        </div>
                        <div style={{ color: "#555", fontSize: 8, marginTop: 1 }}>
                          {emRota ? `em rota - #${emRota.codigo_pedido}` : "disponivel"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 20,
                        background: emRota ? "#12071A" : "#0d2012",
                        color: emRota ? "#B980FF" : "#4ade80",
                        border: `0.5px solid ${emRota ? "#3B2544" : "#14532d"}`,
                        whiteSpace: "nowrap",
                      }}>
                        {emRota ? "rota" : "livre"}
                      </span>
                    </div>
                  );
                })}

                {entregadores.filter((e) => !e.online).map((ent) => (
                  <div key={ent.id} style={{
                    background: "#0d0d0d", border: "0.5px solid #1a1a1a",
                    borderRadius: 10, padding: "7px 10px",
                    display: "flex", alignItems: "center", gap: 8, opacity: 0.4,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#333", fontWeight: 600, flexShrink: 0 }}>
                      {ent.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#444", fontSize: 10, fontWeight: 500 }}>{ent.nome.split(" ")[0]}</div>
                      <div style={{ color: "#333", fontSize: 8 }}>offline</div>
                    </div>
                    <span style={{ fontSize: 8, color: "#333" }}>off</span>
                  </div>
                ))}

                {entregadores.length === 0 && (
                  <div style={{ color: "#333", fontSize: 10, textAlign: "center", padding: "16px 0" }}>
                    Nenhum entregador cadastrado
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {pedidoParaAtribuir && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}>
            <div style={{
              background: "#111118", borderRadius: 16,
              border: "1px solid #2ECC8F",
              width: "100%", maxWidth: 400,
              boxShadow: "0 0 40px rgba(46,204,143,0.15)",
              overflow: "hidden",
            }}>
              <div style={{ background: "#001A08", borderBottom: "0.5px solid #14532d", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#2ECC8F", fontSize: 13, fontWeight: 500 }}>Atribuir entregador</span>
                <button onClick={() => setPedidoParaAtribuir(null)} style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>x</button>
              </div>

              <div style={{ padding: "12px 18px", borderBottom: "0.5px solid #1a1a22" }}>
                <div style={{ color: "#555", fontSize: 10, marginBottom: 2 }}>#{pedidoParaAtribuir.codigo_pedido}</div>
                <div style={{ color: "#e5e5e5", fontSize: 14, fontWeight: 500 }}>{pedidoParaAtribuir.cliente_nome}</div>
                <div style={{ color: "#2ECC8F", fontSize: 11, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  R${pedidoParaAtribuir.total.toFixed(2)} - comissao aprox. R${(pedidoParaAtribuir.total * ((entregadores.find((e) => e.id === entregadorSelecionado)?.pct_comissao ?? 10) / 100)).toFixed(2)}
                </div>
              </div>

              <div style={{ padding: "10px 18px 4px" }}>
                <div style={{ color: "#555", fontSize: 9, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
                  Entregadores disponiveis
                </div>
              </div>

              <div style={{ padding: "0 18px 10px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {entregadores.filter((e) => e.online).map((ent) => {
                  const emRota = pedidos.some((p) => p.entregador_id === ent.id && p.status === "saiu_entrega");
                  const isSelected = entregadorSelecionado === ent.id;
                  return (
                    <div
                      key={ent.id}
                      onClick={() => !emRota && setEntregadorSelecionado(ent.id)}
                      style={{
                        background: isSelected ? "#001A08" : "#0d0d16",
                        border: `1px solid ${isSelected ? "#2ECC8F" : "#1e1e28"}`,
                        borderRadius: 10, padding: "10px 12px",
                        display: "flex", alignItems: "center", gap: 10,
                        cursor: emRota ? "not-allowed" : "pointer",
                        opacity: emRota ? 0.45 : 1,
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: isSelected ? "#0d2012" : "#1a1a2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 600,
                        color: isSelected ? "#4ade80" : "#6B7280",
                        flexShrink: 0,
                      }}>
                        {ent.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#e5e5e5", fontSize: 12, fontWeight: 500 }}>{ent.nome}</div>
                        <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>
                          {emRota ? "em rota" : "disponivel"} - {ent.veiculo}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#F5A623", fontSize: 10 }}>Nota {Number(ent.avaliacao_media || 0).toFixed(1)}</div>
                        <div style={{ color: "#2ECC8F", fontSize: 10, marginTop: 2 }}>{Number(ent.pct_comissao || 0)}%</div>
                      </div>
                    </div>
                  );
                })}

                {entregadores.filter((e) => e.online).length === 0 && (
                  <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                    Nenhum entregador online no momento
                  </div>
                )}
              </div>

              <div style={{ padding: "10px 18px 16px", display: "flex", gap: 8, borderTop: "0.5px solid #1a1a22" }}>
                <button
                  onClick={() => setPedidoParaAtribuir(null)}
                  style={{ flex: 1, background: "#1a1a2e", color: "#555", border: "0.5px solid #2a2a3e", borderRadius: 10, padding: 10, fontSize: 11, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAtribuirEntregador}
                  disabled={!entregadorSelecionado || atribuindo}
                  style={{
                    flex: 2, background: entregadorSelecionado ? "#2ECC8F" : "#0a2a18",
                    color: entregadorSelecionado ? "#001A08" : "#333",
                    border: "none", borderRadius: 10, padding: 10,
                    fontSize: 11, fontWeight: 600, cursor: entregadorSelecionado ? "pointer" : "not-allowed",
                  }}
                >
                  {atribuindo ? "Atribuindo..." : entregadorSelecionado
                    ? `Atribuir ${entregadores.find((e) => e.id === entregadorSelecionado)?.nome.split(" ")[0]}`
                    : "Selecione um entregador"}
                </button>
              </div>
            </div>
          </div>
        )}
        {companyId && (
          <PedidoChatModal
            open={novoPedidoOpen}
            onOpenChange={async (open) => {
              setNovoPedidoOpen(open);
              if (!open) await load(companyId);
            }}
            companyId={companyId}
            clienteNome=""
            clienteTelefone=""
          />
        )}
      </div>
    </>
  );
}

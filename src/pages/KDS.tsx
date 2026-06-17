import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import MesasView from "@/components/pedidos/MesasView";

// ─── Types ────────────────────────────────────────────────────────────────────

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  canal: string;
  tipo_atendimento: string;
  mesa_id: string | null;
  status: PedidoStatus;
  total: number;
  observacoes: string | null;
  created_at: string;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  observacoes: string | null;
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

function PedidoCard({
  pedido,
  itensByPedido,
  onAdvance,
  isNew,
}: {
  pedido: Pedido;
  itensByPedido: Record<string, PedidoItem[]>;
  onAdvance: (pedido: Pedido) => void;
  isNew: boolean;
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

      {/* Action button */}
      {nextLabel[pedido.status] && (
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
}: {
  status: PedidoStatus;
  pedidos: Pedido[];
  itensByPedido: Record<string, PedidoItem[]>;
  newIds: Set<string>;
  onAdvance: (pedido: Pedido) => void;
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
  const [activeTab, setActiveTab] = useState<"delivery" | "mesas">("delivery");
  const audioRef = useRef<AudioContext | null>(null);

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Play beep sound when new pedido arrives
  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {
      // AudioContext blocked until user interaction — fine
    }
  }, []);

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

  // Bootstrap
  useEffect(() => {
    (async () => {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      if (!cid) return;
      setCompanyId(cid);
      await load(cid);
      setLoading(false);
    })();
  }, [load]);

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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, load]);

  // Advance status
  const handleAdvance = useCallback(async (pedido: Pedido) => {
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
  }, []);

  const pedidosByStatus = KDS_STATUSES.reduce((acc, s) => {
    acc[s] = pedidos.filter((p) => p.status === s);
    return acc;
  }, {} as Record<PedidoStatus, Pedido[]>);

  const totalAtivos = pedidos.length;

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
          <div className="kds-tabs">
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
        ) : (
          <div className="kds-columns">
            {KDS_STATUSES.map((status) => (
              <KDSColumn
                key={status}
                status={status}
                pedidos={pedidosByStatus[status]}
                itensByPedido={itensByPedido}
                newIds={newIds}
                onAdvance={handleAdvance}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

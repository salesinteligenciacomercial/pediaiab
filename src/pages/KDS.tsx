import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MesasView from "@/components/pedidos/MesasView";
import RelatorioPedidosView from "@/components/pedidos/RelatorioPedidosView";
import { PedidoChatModal } from "@/components/conversas/PedidoChatModal";
import { toast } from "sonner";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";
type ActiveTab = "delivery" | "mesas" | "relatorios";
type CanalFiltro = "todos" | "cardapio" | "whatsapp" | "instagram" | "atendimento" | "manual";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone?: string | null;
  canal: string | null;
  tipo_atendimento: string | null;
  mesa_id: string | null;
  status: PedidoStatus;
  subtotal?: number | null;
  total: number | null;
  desconto?: number | null;
  taxa_entrega?: number | null;
  forma_pagamento?: string | null;
  status_pagamento?: string | null;
  observacoes: string | null;
  created_at: string;
  entregador_id?: string | null;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  valor_total?: number | null;
  observacoes: string | null;
};

const KDS_STATUSES: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto", "saiu_entrega", "entregue"];
const PAGE_SIZE = 1000;

const CANAL_FILTERS: Array<{ value: CanalFiltro; label: string; matches?: string[] }> = [
  { value: "todos", label: "Todos os canais" },
  { value: "cardapio", label: "Cardapio Digital", matches: ["cardapio"] },
  { value: "whatsapp", label: "WhatsApp", matches: ["whatsapp"] },
  { value: "instagram", label: "Instagram", matches: ["instagram"] },
  { value: "atendimento", label: "Chat", matches: ["atendimento", "chat"] },
  { value: "manual", label: "Manual / Balcao", matches: ["interno", "balcao", "manual", "telefone"] },
];

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bg: string; border: string }> = {
  novo: { label: "Novos", color: "#4A9EFF", bg: "#071025", border: "#213647" },
  aceito: { label: "Aceitos", color: "#F5A623", bg: "#1C1500", border: "#78430A" },
  em_producao: { label: "Em producao", color: "#FF5C00", bg: "#1A0A00", border: "#7C2D12" },
  pronto: { label: "Prontos", color: "#2ECC8F", bg: "#001A08", border: "#14532D" },
  saiu_entrega: { label: "Em entrega", color: "#B980FF", bg: "#12071A", border: "#3B2544" },
  entregue: { label: "Entregues", color: "#7A798A", bg: "#0F0F11", border: "#1F1F23" },
  cancelado: { label: "Cancelados", color: "#EF4444", bg: "#1A0B0B", border: "#7F1D1D" },
};

type Entregador = {
  id: string;
  nome: string;
  telefone?: string | null;
  veiculo?: string | null;
  online?: boolean;
  avaliacao_media?: number | null;
  status?: string | null;
  pct_comissao?: number | null;
};

const CANAL_LABEL: Record<string, string> = {
  cardapio: "Cardapio",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  atendimento: "Chat",
  interno: "Balcao",
  balcao: "Balcao",
  telefone: "Telefone",
};

function brl(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function elapsedLabel(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function minutesSince(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

function getUrgency(createdAt: string, status: PedidoStatus): "normal" | "warning" | "urgent" {
  const minutes = minutesSince(createdAt);
  if (status === "novo" && minutes >= 10) return "urgent";
  if (status === "aceito" && minutes >= 12) return "urgent";
  if (status === "em_producao" && minutes >= 25) return "urgent";
  if (status === "pronto" && minutes >= 35) return "urgent";
  if (status === "novo" && minutes >= 6) return "warning";
  if (status === "aceito" && minutes >= 8) return "warning";
  if (status === "em_producao" && minutes >= 18) return "warning";
  return "normal";
}

function atendimentoLabel(pedido: Pedido) {
  const value = (pedido.tipo_atendimento || "").toLowerCase();
  if (value.includes("retirada")) return "Retirada";
  if (value.includes("balcao") || value.includes("balc")) return "Balcao";
  if (value.includes("delivery") || value.includes("entrega")) return "Delivery";
  return pedido.mesa_id ? "Mesa" : "Delivery";
}

const NEXT_STATUS: Partial<Record<PedidoStatus, { status: PedidoStatus; label: string }>> = {
  novo: { status: "aceito", label: "Aceitar pedido" },
  aceito: { status: "em_producao", label: "Iniciar preparo" },
  em_producao: { status: "pronto", label: "Marcar pronto" },
  pronto: { status: "entregue", label: "Finalizar" },
  saiu_entrega: { status: "entregue", label: "Concluir entrega" },
};

export default function KDS() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("delivery");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itensByPedido, setItensByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [savingPedidoId, setSavingPedidoId] = useState<string | null>(null);
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [editClienteNome, setEditClienteNome] = useState("");
  const [editClienteTelefone, setEditClienteTelefone] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");
  const [canalFiltro, setCanalFiltro] = useState<CanalFiltro>("todos");

  // Entregadores / Atribuir entrega
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [pedidoToAssign, setPedidoToAssign] = useState<Pedido | null>(null);
  const [selectedEntregadorId, setSelectedEntregadorId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadEntregadores = useCallback(async (cid?: string) => {
    const company = cid || companyId;
    if (!company) return;
    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("id, nome, telefone, online, avaliacao_media")
      .eq("company_id", company)
      .eq("status", "ativo")
      .order("nome");
    if (error) {
      console.error("[KDS] erro ao carregar entregadores", error);
      return;
    }
    setEntregadores(data || []);
  }, [companyId]);

  const loadPedidos = useCallback(async (cid: string) => {
    const all: Pedido[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await (supabase.from("pedidos" as any) as any)
        .select("id, company_id, codigo_pedido, cliente_nome, cliente_telefone, canal, tipo_atendimento, mesa_id, status, entregador_id, subtotal, total, desconto, taxa_entrega, forma_pagamento, status_pagamento, observacoes, created_at")
        .eq("company_id", cid)
        .in("status", KDS_STATUSES)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      all.push(...((data || []) as Pedido[]));
      if (!data || data.length < PAGE_SIZE) break;
    }

    setPedidos(all);

    const ids = all.map((pedido) => pedido.id);
    if (!ids.length) {
      setItensByPedido({});
      return;
    }

    const itens: PedidoItem[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await (supabase.from("pedido_itens" as any) as any)
        .select("id, pedido_id, produto_nome, quantidade, valor_total, observacoes")
        .in("pedido_id", ids.slice(i, i + 100))
        .order("created_at", { ascending: true });

      if (error) throw error;
      itens.push(...((data || []) as PedidoItem[]));
    }

    setItensByPedido(
      itens.reduce<Record<string, PedidoItem[]>>((acc, item) => {
        if (!acc[item.pedido_id]) acc[item.pedido_id] = [];
        acc[item.pedido_id].push(item);
        return acc;
      }, {})
    );
  }, []);

  function openAssignModal(pedido: Pedido) {
    setPedidoToAssign(pedido);
    setSelectedEntregadorId(null);
    loadEntregadores(pedido.company_id);
    setAssignModalOpen(true);
  }

  const handleAssignEntregador = useCallback(async () => {
    if (!pedidoToAssign || !selectedEntregadorId) return;
    if (!companyId) return;
    setAssigning(true);
    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({ entregador_id: selectedEntregadorId, aceito_entregador_em: new Date().toISOString() })
      .eq("id", pedidoToAssign.id);
    if (error) {
      console.error("[KDS] erro ao atribuir entregador", error);
      toast.error("Erro ao atribuir entregador");
      setAssigning(false);
      return;
    }
    setAssignModalOpen(false);
    setPedidoToAssign(null);
    setAssigning(false);
    await loadPedidos(companyId);
    toast.success("Entregador atribuído");
  }, [pedidoToAssign, selectedEntregadorId, companyId, loadPedidos]);

  const deliveryPedidos = useMemo(
    () => pedidos.filter((pedido) => !pedido.mesa_id && KDS_STATUSES.includes(pedido.status)),
    [pedidos]
  );

  const deliveryPedidosFiltrados = useMemo(() => {
    if (canalFiltro === "todos") return deliveryPedidos;
    const filtro = CANAL_FILTERS.find((item) => item.value === canalFiltro);
    const matches = filtro?.matches || [];
    return deliveryPedidos.filter((pedido) => matches.includes((pedido.canal || "").toLowerCase()));
  }, [canalFiltro, deliveryPedidos]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: cid, error } = await supabase.rpc("get_my_company_id");
      if (error) throw error;
      if (!cid) {
        setCompanyId(null);
        setPedidos([]);
        return;
      }
      setCompanyId(cid as string);
      await loadPedidos(cid as string);
    } catch (error) {
      console.error("[KDS] erro ao carregar pedidos", error);
      toast.error("Nao foi possivel carregar a gestao de pedidos.");
    } finally {
      setLoading(false);
    }
  }, [loadPedidos]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (companyId) loadEntregadores(companyId);
  }, [companyId, loadEntregadores]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`kds-pedidos-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` }, () => loadPedidos(companyId))
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens", filter: `company_id=eq.${companyId}` }, () => loadPedidos(companyId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadPedidos]);

  const atualizarStatusPedido = async (pedido: Pedido, nextStatus: PedidoStatus) => {
    try {
      setSavingPedidoId(pedido.id);
      const patch: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "entregue") patch.status_pagamento = pedido.status_pagamento || "pago";

      const { error } = await (supabase.from("pedidos" as any) as any)
        .update(patch)
        .eq("id", pedido.id)
        .eq("company_id", pedido.company_id);

      if (error) throw error;
      toast.success(`Pedido #${pedido.codigo_pedido} atualizado`);
      if (companyId) await loadPedidos(companyId);
    } catch (error) {
      console.error("[KDS] erro ao atualizar pedido", error);
      toast.error("Nao foi possivel atualizar o pedido.");
    } finally {
      setSavingPedidoId(null);
    }
  };

  const cancelarPedido = async (pedido: Pedido) => {
    if (!window.confirm(`Cancelar o pedido #${pedido.codigo_pedido}?`)) return;
    await atualizarStatusPedido(pedido, "cancelado");
  };

  const abrirEdicaoPedido = (pedido: Pedido) => {
    setEditPedido(pedido);
    setEditClienteNome(pedido.cliente_nome || "");
    setEditClienteTelefone(pedido.cliente_telefone || "");
    setEditObservacoes(pedido.observacoes || "");
  };

  const salvarEdicaoPedido = async () => {
    if (!editPedido) return;
    try {
      setSavingPedidoId(editPedido.id);
      const { error } = await (supabase.from("pedidos" as any) as any)
        .update({
          cliente_nome: editClienteNome.trim() || "Cliente sem nome",
          cliente_telefone: editClienteTelefone.trim(),
          observacoes: editObservacoes.trim() || null,
        })
        .eq("id", editPedido.id)
        .eq("company_id", editPedido.company_id);

      if (error) throw error;
      toast.success(`Pedido #${editPedido.codigo_pedido} editado`);
      setEditPedido(null);
      if (companyId) await loadPedidos(companyId);
    } catch (error) {
      console.error("[KDS] erro ao editar pedido", error);
      toast.error("Nao foi possivel editar o pedido.");
    } finally {
      setSavingPedidoId(null);
    }
  };

  const renderDelivery = () => {
    if (loading) return <div className="kds-empty">Carregando pedidos...</div>;
    if (!deliveryPedidos.length) {
      return (
        <div className="kds-empty">
          <strong>Nenhum pedido de delivery ou balcao em andamento</strong>
          <span>Novos pedidos aparecem aqui automaticamente.</span>
        </div>
      );
    }

    return (
      <>
        <div className="kds-channel-filters">
          {CANAL_FILTERS.map((filtro) => {
            const count = filtro.value === "todos"
              ? deliveryPedidos.length
              : deliveryPedidos.filter((pedido) => (filtro.matches || []).includes((pedido.canal || "").toLowerCase())).length;

            return (
              <button
                key={filtro.value}
                className={`kds-channel-filter ${canalFiltro === filtro.value ? "active" : ""}`}
                onClick={() => setCanalFiltro(filtro.value)}
              >
                {filtro.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="kds-board">
          {KDS_STATUSES.map((status) => {
            const config = STATUS_CONFIG[status];
            const pedidosStatus = deliveryPedidosFiltrados.filter((pedido) => pedido.status === status);

            return (
              <section className="kds-column" key={status}>
                <div className="kds-column-head" style={{ background: config.bg, borderColor: config.border }}>
                  <div className="kds-column-head-title">
                    <span className="kds-column-dot" style={{ background: config.color, boxShadow: `0 0 6px ${config.color}` }} />
                    <span style={{ color: config.color }}>{config.label}</span>
                  </div>
                  <strong style={{ color: config.color, background: `${config.color}1F`, border: `0.5px solid ${config.color}4D` }}>{pedidosStatus.length}</strong>
                </div>
                <div className="kds-column-body">
                  {pedidosStatus.map((pedido) => {
                    const itens = itensByPedido[pedido.id] || [];
                    const urgency = getUrgency(pedido.created_at, pedido.status);
                    const cardConfig = urgency === "urgent"
                      ? { ...config, color: "#EF4444", bg: "#1A0B0B", border: "#EF4444" }
                      : config;
                    const next = NEXT_STATUS[pedido.status];
                    const isSaving = savingPedidoId === pedido.id;
                    return (
                      <article className={`kds-card ${urgency === "urgent" ? "urgent" : ""}`} style={{ background: cardConfig.bg, borderColor: cardConfig.border }} key={pedido.id}>
                      <div className="kds-card-stripe" style={{ background: `linear-gradient(90deg, transparent, ${cardConfig.color}, transparent)` }} />
                      <div className="kds-card-header">
                        <div className="kds-card-title">
                          <div className="kds-card-code-row">
                            <span className="kds-card-code" style={{ color: cardConfig.color }}>#{pedido.codigo_pedido}</span>
                            {urgency === "urgent" && <span className="kds-urgent-badge">URGENTE</span>}
                          </div>
                          <div className="kds-client">{pedido.cliente_nome || "Cliente sem nome"}</div>
                        </div>
                        <div className="kds-card-timer">
                          <strong style={{ color: urgency === "normal" ? "#6B7280" : cardConfig.color }}>{elapsedLabel(pedido.created_at)}</strong>
                          <span>espera</span>
                        </div>
                      </div>

                      <div className="kds-chips">
                        <span className="kds-chip">{CANAL_LABEL[pedido.canal || ""] || pedido.canal || "Balcao"}</span>
                        <span className="kds-chip">{atendimentoLabel(pedido)}</span>
                        <span className="kds-chip">{formatDate(pedido.created_at)}</span>
                      </div>

                      <div className="kds-items-box">
                        {itens.slice(0, 3).map((item) => (
                          <div key={item.id}>
                            <div className="kds-item-row">
                              <span className="kds-item-qty" style={{ color: cardConfig.color }}>{Number(item.quantidade || 0)}x</span>
                              <span className="kds-item-name">{item.produto_nome}</span>
                            </div>
                            {item.observacoes && <div className="kds-item-obs">{item.observacoes}</div>}
                          </div>
                        ))}
                        {itens.length > 3 && <small>+{itens.length - 3} item(ns)</small>}
                      </div>

                      {pedido.observacoes && <div className="kds-card-obs">{pedido.observacoes}</div>}

                      <div className="kds-card-footer">
                        <b>{brl(pedido.total)}</b>
                        <span className="kds-status" style={{ color: cardConfig.color, borderColor: cardConfig.border }}>
                          {config.label}
                        </span>
                      </div>

                      <div className="kds-card-actions">
                        <button className="kds-btn-sm kds-btn-soft" disabled={isSaving} onClick={() => abrirEdicaoPedido(pedido)}>
                          Editar
                        </button>
                        <button className="kds-btn-sm kds-btn-danger" disabled={isSaving} onClick={() => cancelarPedido(pedido)}>
                          Excluir
                        </button>
                      </div>

                      {/* Atribuir entregador quando pedido estiver pronto e sem entregador */}
                      {pedido.status === "pronto" && !pedido.entregador_id && (
                        <div style={{ marginTop: 6 }}>
                          <button className="kds-btn-sm kds-btn-soft" onClick={() => openAssignModal(pedido)}>Atribuir entregador</button>
                        </div>
                      )}

                      {next && (
                        <button
                          className="kds-btn-advance"
                          disabled={isSaving}
                          style={{ color: cardConfig.color, borderColor: cardConfig.color, background: `${cardConfig.color}1F` }}
                          onClick={() => atualizarStatusPedido(pedido, next.status)}
                        >
                          {isSaving ? "Salvando..." : next.label}
                        </button>
                      )}
                      </article>
                    );
                  })}
                  {!pedidosStatus.length && <div className="kds-column-empty">Sem pedidos</div>}
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="kds-root">
      <style>{`
        .kds-root{min-height:100%;display:flex;flex-direction:column;background:#05060a;color:#e5e7eb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .kds-tabs{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid #1f2937;background:#070809}
        .kds-tabs-left{display:flex;gap:10px;flex-wrap:wrap}
        .kds-tab{padding:8px 12px;border-radius:10px;background:transparent;color:#9ca3af;border:1px solid transparent;cursor:pointer;font-size:13px;font-family:inherit}
        .kds-tab.active{background:#0f1724;border-color:#1f2937;color:#e5e7eb}
        .kds-tab-count{margin-left:8px;background:#0b0b0d;padding:2px 8px;border-radius:8px;font-family:ui-monospace,monospace;font-size:12px}
        .new-pedido-btn{border:1px solid rgba(249,115,22,.42);background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:800;letter-spacing:.02em;cursor:pointer;box-shadow:0 10px 26px rgba(249,115,22,.22);white-space:nowrap;font-family:inherit}
        .kds-content{flex:1;min-height:0;overflow:hidden}
        .kds-channel-filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 16px 0}
        .kds-channel-filter{display:inline-flex;align-items:center;gap:8px;border:1px solid #1f2937;background:#080d14;color:#cbd5e1;border-radius:999px;padding:8px 13px;font-size:13px;font-family:inherit;cursor:pointer}
        .kds-channel-filter span{font-family:ui-monospace,monospace;font-size:11px;color:#64748b}
        .kds-channel-filter.active{background:#2a1003;border-color:#f97316;color:#fb923c}
        .kds-channel-filter.active span{color:#fdba74}
        .kds-board{display:grid;grid-template-columns:repeat(6,minmax(220px,1fr));gap:12px;padding:12px 16px 16px;overflow:auto;height:calc(100vh - 220px)}
        .kds-column{min-width:220px;display:flex;flex-direction:column;min-height:240px}
        .kds-column-head{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid #1f2937;border-radius:8px;margin-bottom:10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;background:#0d0e12}
        .kds-column-head-title{display:flex;align-items:center;gap:7px}
        .kds-column-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
        .kds-column-head strong{font-family:ui-monospace,monospace;font-size:11px;padding:2px 7px;border-radius:5px}
        .kds-column-body{display:flex;flex-direction:column;gap:10px;padding:10px;overflow:auto}
        .kds-card{border:1px solid;border-radius:10px;padding:10px 11px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}
        .kds-card.urgent{box-shadow:0 0 16px rgba(239,68,68,.25)}
        .kds-card-stripe{position:absolute;top:0;left:0;right:0;height:2px;opacity:.75}
        .kds-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
        .kds-card-title{min-width:0}
        .kds-card-code-row{display:flex;align-items:center;gap:6px}
        .kds-card-code{font-family:ui-monospace,monospace;font-size:14px;font-weight:800;line-height:1}
        .kds-client{font-size:11px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;color:#6b7280}
        .kds-card-timer{text-align:right;font-family:ui-monospace,monospace;line-height:1}
        .kds-card-timer strong{display:block;font-size:15px}
        .kds-card-timer span{display:block;font-size:9px;margin-top:2px;color:#4b5563}
        .kds-urgent-badge{font-size:8px;font-weight:800;padding:2px 5px;border-radius:3px;background:#ef4444;color:#fff;letter-spacing:.4px;animation:kdsUrgPulse 1s ease-in-out infinite}
        .kds-chips{display:flex;gap:5px;flex-wrap:wrap}
        .kds-chip{font-size:10px;padding:2px 7px;border-radius:12px;background:rgba(255,255,255,.05);color:#9ca3af;border:.5px solid rgba(255,255,255,.09)}
        .kds-items-box{background:rgba(0,0,0,.28);border:.5px solid rgba(255,255,255,.06);border-radius:7px;padding:7px 9px;display:flex;flex-direction:column;gap:5px}
        .kds-items-box small{color:#9ca3af;font-size:10px}
        .kds-item-row{display:flex;align-items:baseline;gap:6px}
        .kds-item-qty{font-family:ui-monospace,monospace;font-size:12px;font-weight:800;min-width:18px}
        .kds-item-name{font-size:11px;color:#d1d5db;line-height:1.35;flex:1}
        .kds-item-obs{font-size:10px;color:#fbbf24;font-style:italic;margin-top:1px;padding-left:24px}
        .kds-card-obs{font-size:10px;font-style:italic;padding:4px 8px;border-radius:5px;background:rgba(245,158,11,.07);border:.5px solid rgba(245,158,11,.2);color:#fcd34d}
        .kds-card-footer,.kds-card-actions{display:flex;align-items:center;justify-content:space-between;gap:6px}
        .kds-card-footer b{font-family:ui-monospace,monospace;color:#e5e7eb;font-size:12px}
        .kds-status{display:inline-flex;border:1px solid;border-radius:999px;padding:3px 8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;background:rgba(0,0,0,.16)}
        .kds-card-actions{display:grid;grid-template-columns:1fr 1fr}
        .kds-btn-sm,.kds-btn-advance{border:1px solid;border-radius:7px;font-family:inherit;cursor:pointer}
        .kds-btn-sm{padding:6px 0;font-size:10px;font-weight:700;letter-spacing:.2px}
        .kds-btn-soft{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:#9ca3af}
        .kds-btn-danger{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.25);color:#f87171}
        .kds-btn-advance{padding:8px 0;font-size:11px;font-weight:800;width:100%;letter-spacing:.3px}
        .kds-btn-sm:disabled,.kds-btn-advance:disabled{opacity:.55;cursor:not-allowed}
        .kds-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:1300;padding:16px}
        .kds-modal{width:min(480px,100%);background:#0f1117;border:1px solid #263244;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.58);overflow:hidden}
        .kds-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #1f2937}
        .kds-modal-head strong{display:block;color:#f8fafc;font-size:14px}
        .kds-modal-head span{display:block;color:#f97316;font-family:ui-monospace,monospace;font-size:12px;margin-top:3px}
        .kds-modal-head button{background:transparent;border:0;color:#6b7280;font-size:20px;line-height:1;cursor:pointer}
        .kds-modal-body{display:grid;gap:12px;padding:16px 18px}
        .kds-modal-body label{display:flex;flex-direction:column;gap:6px;color:#9ca3af;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .kds-modal-body input,.kds-modal-body textarea{width:100%;border-radius:9px;border:1px solid #263244;background:#05060a;color:#e5e7eb;padding:10px 12px;font-family:inherit;font-size:13px;outline:none}
        .kds-modal-body input:focus,.kds-modal-body textarea:focus{border-color:#f97316}
        .kds-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid #1f2937}
        .kds-modal-actions button{border-radius:9px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid}
        .kds-modal-cancel{background:#111827;color:#9ca3af;border-color:#263244}
        .kds-modal-save{background:#f97316;color:#fff;border-color:#f97316}
        .kds-modal-save:disabled{opacity:.6;cursor:not-allowed}
        .kds-empty,.kds-column-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#6b7280;padding:48px 20px;text-align:center}
        .kds-column-empty{padding:24px 8px;font-size:12px}
        @keyframes kdsUrgPulse{0%,100%{opacity:1}50%{opacity:.5}}
        @media(max-width:1100px){.kds-board{grid-template-columns:repeat(3,minmax(220px,1fr));height:auto}.kds-content{overflow:auto}}
        @media(max-width:760px){.kds-board{grid-template-columns:1fr}.kds-tabs{align-items:stretch}.kds-tabs-left,.new-pedido-btn{width:100%}.kds-tab{flex:1}}
      `}</style>

      <div className="kds-tabs">
        <div className="kds-tabs-left">
          <button className={`kds-tab ${activeTab === "delivery" ? "active" : ""}`} onClick={() => setActiveTab("delivery")}>
            Delivery / Balcao <span className="kds-tab-count">{deliveryPedidos.length}</span>
          </button>
          <button className={`kds-tab ${activeTab === "mesas" ? "active" : ""}`} onClick={() => setActiveTab("mesas")}>
            Mesas
          </button>
          <button className={`kds-tab ${activeTab === "relatorios" ? "active" : ""}`} onClick={() => setActiveTab("relatorios")}>
            Relatorios
          </button>
        </div>
        <button className="new-pedido-btn" onClick={() => setNovoPedidoOpen(true)}>
          + Novo Pedido
        </button>
      </div>

      <div className="kds-content">
        {activeTab === "delivery" && renderDelivery()}
        {activeTab === "mesas" && companyId && <MesasView companyId={companyId} />}
        {activeTab === "relatorios" && companyId && <RelatorioPedidosView companyId={companyId} />}
      </div>

      {companyId && (
        <PedidoChatModal
          open={novoPedidoOpen}
          onOpenChange={(open) => {
            setNovoPedidoOpen(open);
            if (!open) load();
          }}
          companyId={companyId}
          clienteNome=""
          clienteTelefone=""
        />
      )}

      {editPedido && (
        <div className="kds-modal-overlay" onClick={(event) => event.currentTarget === event.target && setEditPedido(null)}>
          <div className="kds-modal">
            <div className="kds-modal-head">
              <div>
                <strong>Editar pedido</strong>
                <span>#{editPedido.codigo_pedido}</span>
              </div>
              <button onClick={() => setEditPedido(null)}>x</button>
            </div>
            <div className="kds-modal-body">
              <label>
                Cliente
                <input value={editClienteNome} onChange={(event) => setEditClienteNome(event.target.value)} />
              </label>
              <label>
                Telefone
                <input value={editClienteTelefone} onChange={(event) => setEditClienteTelefone(event.target.value)} />
              </label>
              <label>
                Observacoes
                <textarea rows={4} value={editObservacoes} onChange={(event) => setEditObservacoes(event.target.value)} />
              </label>
            </div>
            <div className="kds-modal-actions">
              <button className="kds-modal-cancel" onClick={() => setEditPedido(null)}>Cancelar</button>
              <button className="kds-modal-save" disabled={savingPedidoId === editPedido.id} onClick={salvarEdicaoPedido}>
                {savingPedidoId === editPedido.id ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de atribuir entregador */}
      {assignModalOpen && pedidoToAssign && (
        <div className="kds-modal-overlay" onClick={(e) => e.currentTarget === e.target && setAssignModalOpen(false)}>
          <div className="kds-modal">
            <div className="kds-modal-head">
              <div>
                <strong>Atribuir entregador</strong>
                <span>#{pedidoToAssign.codigo_pedido}</span>
              </div>
              <button onClick={() => setAssignModalOpen(false)}>x</button>
            </div>
            <div className="kds-modal-body">
              <div style={{ display: "grid", gap: 8 }}>
                {entregadores.length === 0 && <div>Nenhum entregador disponível</div>}
                {entregadores.map((e) => (
                  <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, border: selectedEntregadorId === e.id ? `1px solid #10B981` : '1px solid #263244', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                    <input type="radio" name="entregador" checked={selectedEntregadorId === e.id} onChange={() => setSelectedEntregadorId(e.id)} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{e.nome}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{e.telefone || ''}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="kds-modal-actions">
              <button className="kds-modal-cancel" onClick={() => setAssignModalOpen(false)}>Cancelar</button>
              <button className="kds-modal-save" disabled={assigning || !selectedEntregadorId} onClick={handleAssignEntregador}>{assigning ? 'Atribuindo...' : 'Atribuir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";
type TipoFiltro = "todos" | "delivery" | "mesa";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  canal: string | null;
  tipo_atendimento: string | null;
  mesa_id: string | null;
  status: PedidoStatus;
  forma_pagamento: string | null;
  status_pagamento: string | null;
  subtotal: number | null;
  taxa_entrega: number | null;
  desconto: number | null;
  total: number | null;
  observacoes: string | null;
  created_at: string;
  entregador_id?: string | null;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  valor_total: number | null;
  observacoes: string | null;
};

type PedidoEndereco = {
  pedido_id: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  nome_contato: string | null;
  telefone_contato: string | null;
};

type Entregador = {
  id: string;
  nome: string;
  telefone?: string | null;
};

type Mesa = {
  id: string;
  numero: string;
  nome: string | null;
};

type Props = {
  companyId: string;
};

const PAGE_SIZE = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_OPTIONS: Array<{ value: "todos" | PedidoStatus; label: string }> = [
  { value: "todos", label: "Todos status" },
  { value: "novo", label: "Novo" },
  { value: "aceito", label: "Aceito" },
  { value: "em_producao", label: "Em producao" },
  { value: "pronto", label: "Pronto" },
  { value: "saiu_entrega", label: "Em entrega" },
  { value: "entregue", label: "Entregue / Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_CONFIG: Record<PedidoStatus, { label: string; color: string; bg: string; border: string }> = {
  novo: { label: "Novo", color: "#4A9EFF", bg: "rgba(74,158,255,0.10)", border: "rgba(74,158,255,0.30)" },
  aceito: { label: "Aceito", color: "#F5A623", bg: "rgba(245,166,35,0.10)", border: "rgba(245,166,35,0.30)" },
  em_producao: { label: "Em producao", color: "#FF5C00", bg: "rgba(255,92,0,0.10)", border: "rgba(255,92,0,0.30)" },
  pronto: { label: "Pronto", color: "#2ECC8F", bg: "rgba(46,204,143,0.10)", border: "rgba(46,204,143,0.30)" },
  saiu_entrega: { label: "Em entrega", color: "#B980FF", bg: "rgba(185,128,255,0.10)", border: "rgba(185,128,255,0.30)" },
  entregue: { label: "Entregue / Finalizado", color: "#22C55E", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)" },
  cancelado: { label: "Cancelado", color: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)" },
};

const CANAL_LABEL: Record<string, string> = {
  cardapio: "Cardapio Digital",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  atendimento: "Chat",
  interno: "Balcao / Manual",
  balcao: "Balcao",
  telefone: "Telefone",
};

function brl(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfDayIso(value: string) {
  const date = new Date(`${value}T23:59:59.999`);
  return date.toISOString();
}

function startOfDayIso(value: string) {
  const date = new Date(`${value}T00:00:00.000`);
  return date.toISOString();
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isMesaPedido(pedido: Pedido) {
  return !!pedido.mesa_id || pedido.tipo_atendimento === "mesa";
}

export default function RelatorioPedidosView({ companyId }: Props) {
  const today = useMemo(() => new Date(), []);
  const sevenDaysAgo = useMemo(() => new Date(today.getTime() - 7 * MS_PER_DAY), [today]);
  const [dataInicio, setDataInicio] = useState(dateInputValue(sevenDaysAgo));
  const [dataFim, setDataFim] = useState(dateInputValue(today));
  const [periodoRapido, setPeriodoRapido] = useState<0 | 7 | 30>(7);
  const [tipo, setTipo] = useState<TipoFiltro>("todos");
  const [status, setStatus] = useState<"todos" | PedidoStatus>("todos");
  const [busca, setBusca] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itensByPedido, setItensByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [enderecosByPedido, setEnderecosByPedido] = useState<Record<string, PedidoEndereco>>({});
  const [entregadoresById, setEntregadoresById] = useState<Record<string, Entregador>>({});
  const [mesasById, setMesasById] = useState<Record<string, Mesa>>({});
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all: Pedido[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await (supabase.from("pedidos" as any) as any)
          .select("id, company_id, codigo_pedido, cliente_nome, cliente_telefone, canal, tipo_atendimento, mesa_id, status, forma_pagamento, status_pagamento, subtotal, taxa_entrega, desconto, total, observacoes, created_at, entregador_id")
          .eq("company_id", companyId)
          .gte("created_at", startOfDayIso(dataInicio))
          .lte("created_at", endOfDayIso(dataFim))
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        all.push(...((data || []) as Pedido[]));
        if (!data || data.length < PAGE_SIZE) break;
      }

      setPedidos(all);

      const pedidoIds = all.map((pedido) => pedido.id);
      if (pedidoIds.length) {
        const itens: PedidoItem[] = [];
        for (let i = 0; i < pedidoIds.length; i += 100) {
          const { data, error } = await (supabase.from("pedido_itens" as any) as any)
            .select("id, pedido_id, produto_nome, quantidade, valor_total, observacoes")
            .in("pedido_id", pedidoIds.slice(i, i + 100))
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

        const enderecos: PedidoEndereco[] = [];
        for (let i = 0; i < pedidoIds.length; i += 100) {
          const { data, error } = await (supabase.from("pedido_enderecos" as any) as any)
            .select("pedido_id, logradouro, numero, complemento, bairro, cidade, estado, cep, nome_contato, telefone_contato, created_at")
            .in("pedido_id", pedidoIds.slice(i, i + 100))
            .order("created_at", { ascending: false });

          if (error) throw error;
          enderecos.push(...((data || []) as PedidoEndereco[]));
        }

        setEnderecosByPedido(
          enderecos.reduce<Record<string, PedidoEndereco>>((acc, endereco) => {
            if (!acc[endereco.pedido_id]) acc[endereco.pedido_id] = endereco;
            return acc;
          }, {})
        );

        const entregadorIds = Array.from(new Set(all.map((pedido) => pedido.entregador_id).filter(Boolean))) as string[];
        if (entregadorIds.length) {
          const { data, error } = await (supabase.from("entregadores" as any) as any)
            .select("id, nome, telefone")
            .in("id", entregadorIds);
          if (error) throw error;
          setEntregadoresById(
            ((data || []) as Entregador[]).reduce<Record<string, Entregador>>((acc, entregador) => {
              acc[entregador.id] = entregador;
              return acc;
            }, {})
          );
        } else {
          setEntregadoresById({});
        }
      } else {
        setItensByPedido({});
        setEnderecosByPedido({});
        setEntregadoresById({});
      }

      const mesaIds = Array.from(new Set(all.map((pedido) => pedido.mesa_id).filter(Boolean))) as string[];
      if (mesaIds.length) {
        const { data, error } = await (supabase.from("mesas" as any) as any)
          .select("id, numero, nome")
          .in("id", mesaIds);
        if (error) throw error;
        setMesasById(
          ((data || []) as Mesa[]).reduce<Record<string, Mesa>>((acc, mesa) => {
            acc[mesa.id] = mesa;
            return acc;
          }, {})
        );
      } else {
        setMesasById({});
      }
    } catch (error) {
      console.error("[RelatorioPedidosView] erro ao carregar relatorio", error);
      toast.error("Nao foi possivel carregar o relatorio de pedidos.");
    } finally {
      setLoading(false);
    }
  }, [companyId, dataFim, dataInicio]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`relatorio-pedidos-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens", filter: `company_id=eq.${companyId}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, load]);

  const filteredPedidos = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      if (status !== "todos" && pedido.status !== status) return false;
      if (tipo === "delivery" && isMesaPedido(pedido)) return false;
      if (tipo === "mesa" && !isMesaPedido(pedido)) return false;
      if (!needle) return true;
      const haystack = [pedido.codigo_pedido, pedido.cliente_nome, pedido.cliente_telefone || ""].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [busca, pedidos, status, tipo]);

  const summary = useMemo(() => {
    const finalizados = filteredPedidos.filter((pedido) => pedido.status === "entregue");
    const cancelados = filteredPedidos.filter((pedido) => pedido.status === "cancelado");
    const emAndamento = filteredPedidos.filter((pedido) => pedido.status !== "entregue" && pedido.status !== "cancelado");
    const faturamento = finalizados.reduce((sum, pedido) => sum + Number(pedido.total || 0), 0);
    return { finalizados, cancelados, emAndamento, faturamento };
  }, [filteredPedidos]);

  const setQuickPeriod = (days: 0 | 7 | 30) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * MS_PER_DAY);
    setPeriodoRapido(days);
    setDataInicio(dateInputValue(start));
    setDataFim(dateInputValue(end));
  };

  const getTipoLabel = (pedido: Pedido) => {
    if (!isMesaPedido(pedido)) return "Delivery/Balcao";
    const mesa = pedido.mesa_id ? mesasById[pedido.mesa_id] : null;
    return mesa ? `Mesa ${mesa.numero}${mesa.nome ? ` - ${mesa.nome}` : ""}` : "Mesa";
  };

  const getItensLabel = (pedido: Pedido) => {
    const itens = itensByPedido[pedido.id] || [];
    if (!itens.length) return "-";
    if (itens.length === 1) return `${Number(itens[0].quantidade || 0)}x ${itens[0].produto_nome}`;
    return `${itens.length} itens`;
  };

  const getEnderecoLabel = (pedido: Pedido) => {
    if (isMesaPedido(pedido)) return "Mesa";
    const endereco = enderecosByPedido[pedido.id];
    if (!endereco || !endereco.logradouro) return "-";
    const enderecoParts = [
      `${endereco.logradouro}${endereco.numero ? `, ${endereco.numero}` : ""}`,
      endereco.complemento,
      [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(", "),
      endereco.cep ? `CEP ${endereco.cep}` : null,
    ].filter(Boolean);
    return enderecoParts.join(" · ");
  };

  const getEntregadorLabel = (pedido: Pedido) => {
    if (!pedido.entregador_id) return "-";
    return entregadoresById[pedido.entregador_id]?.nome || "-";
  };

  return (
    <div className="rp-root">
      <style>{`
        .rp-root{display:flex;flex-direction:column;min-height:0;height:calc(100vh - 126px);overflow:hidden;background:#05060a;color:#e5e7eb}
        .rp-filters{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-bottom:1px solid #1f2937;flex-shrink:0}
        .rp-filters-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
        .rp-field{display:flex;flex-direction:column;gap:4px}
        .rp-field label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:700}
        .rp-field input{background:#0f1113;border:1px solid #1f2937;color:#e5e7eb;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}
        .rp-field input:focus{outline:none;border-color:#f97316}
        .rp-search{flex:1;min-width:220px}.rp-search input{width:100%}
        .rp-quick-periods,.rp-chips{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .rp-quick-periods button,.rp-chip{background:#0f1113;border:1px solid #1f2937;color:#9ca3af;border-radius:8px;padding:8px 10px;font-size:12px;cursor:pointer;font-family:inherit}
        .rp-chip{border-radius:20px;padding:6px 12px}
        .rp-quick-periods button.active,.rp-chip.active{background:rgba(255,92,0,.12);border-color:rgba(255,92,0,.35);color:#ff8c42}
        .rp-summary{display:flex;gap:10px;padding:14px 16px;flex-wrap:wrap;flex-shrink:0}
        .rp-summary-card{flex:1;min-width:140px;background:#0d0e12;border:1px solid #1f2937;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
        .rp-summary-card.green{border-color:rgba(34,197,94,.25)}.rp-summary-card.green .rp-summary-val{color:#22c55e}
        .rp-summary-card.red{border-color:rgba(239,68,68,.25)}.rp-summary-card.red .rp-summary-val{color:#ef4444}
        .rp-summary-card.amber{border-color:rgba(245,166,35,.25)}.rp-summary-card.amber .rp-summary-val{color:#f5a623}
        .rp-summary-card.fire{border-color:rgba(249,115,22,.3)}.rp-summary-card.fire .rp-summary-val{color:#f97316}
        .rp-summary-val{font-family:ui-monospace,monospace;font-size:20px;font-weight:800}
        .rp-summary-lbl{font-size:11px;color:#6b7280}
        .rp-table-wrap{flex:1;overflow:auto;padding:0 16px 16px}
        .rp-table{width:100%;border-collapse:collapse;font-size:13px}
        .rp-table thead th{position:sticky;top:0;background:#05060a;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #1f2937}
        .rp-row{cursor:pointer;transition:background .12s}.rp-row:hover{background:#0d0e12}
        .rp-row td{padding:10px 12px;border-bottom:1px solid #14151a;vertical-align:top}
        .rp-codigo{font-family:ui-monospace,monospace;color:#f97316;font-weight:700}
        .rp-cliente-nome{font-weight:600;color:#e5e7eb}.rp-cliente-tel,.rp-muted-sm{font-size:11px;color:#6b7280}
        .rp-muted{color:#9ca3af}.rp-itens-cell{color:#d1d5db;max-width:240px}
        .rp-status-badge{display:inline-block;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
        .rp-total{font-family:ui-monospace,monospace;font-weight:800;color:#f97316;text-align:right;white-space:nowrap}
        .rp-loading,.rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:#6b7280;gap:8px;text-align:center}
        .rp-empty-title{font-size:14px;font-weight:700;color:#9ca3af}
        .rp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:1200;padding:16px}
        .rp-modal{width:min(560px,100%);max-height:86vh;overflow:auto;background:#0d0e12;border:1px solid #1f2937;border-radius:16px}
        .rp-modal-head{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #1f2937}
        .rp-modal-title{font-family:ui-monospace,monospace;font-size:16px;font-weight:800;color:#f97316}
        .rp-modal-close{background:none;border:none;color:#6b7280;font-size:24px;cursor:pointer;line-height:1}
        .rp-modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:16px}
        .rp-modal-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700;margin-bottom:6px}
        .rp-modal-info-box,.rp-modal-item-row{background:#15161c;border:1px solid #1f2937;border-radius:10px;padding:12px;font-size:13px}
        .rp-modal-itens{display:flex;flex-direction:column;gap:6px}
        .rp-modal-item-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px}
        .rp-modal-item-qty{font-family:ui-monospace,monospace;font-weight:800;color:#f97316;min-width:30px}
        .rp-modal-item-info{flex:1}.rp-modal-item-info small{color:#f5a623;font-style:italic}
        .rp-modal-item-price{font-family:ui-monospace,monospace;color:#9ca3af}
        .rp-ct-row,.rp-ct-total{display:flex;justify-content:space-between;gap:12px}
        .rp-ct-row{font-size:12px;color:#9ca3af;padding:3px 0}
        .rp-ct-total{font-size:15px;font-weight:800;padding-top:10px;margin-top:6px;border-top:1px solid #1f2937;color:#f97316;font-family:ui-monospace,monospace}
        @media(max-width:860px){.rp-root{height:auto}.rp-table thead{display:none}.rp-table,.rp-table tbody,.rp-table tr,.rp-table td{display:block;width:100%}.rp-row{border:1px solid #1f2937;border-radius:10px;margin-bottom:10px;padding:6px}.rp-row td{border-bottom:none;padding:6px 8px}.rp-total{text-align:left}}
      `}</style>

      <div className="rp-filters">
        <div className="rp-filters-row">
          <div className="rp-field">
            <label>De</label>
            <input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
          </div>
          <div className="rp-field">
            <label>Ate</label>
            <input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} />
          </div>
          <div className="rp-quick-periods">
            {[0, 7, 30].map((days) => (
              <button key={days} className={periodoRapido === days ? "active" : ""} onClick={() => setQuickPeriod(days as 0 | 7 | 30)}>
                {days === 0 ? "Hoje" : `${days} dias`}
              </button>
            ))}
          </div>
          <div className="rp-field rp-search">
            <label>Buscar</label>
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Cliente, telefone ou codigo do pedido" />
          </div>
        </div>

        <div className="rp-filters-row">
          <div className="rp-chips">
            {[
              ["todos", "Todos"],
              ["delivery", "Delivery/Balcao"],
              ["mesa", "Mesas"],
            ].map(([value, label]) => (
              <button key={value} className={`rp-chip ${tipo === value ? "active" : ""}`} onClick={() => setTipo(value as TipoFiltro)}>
                {label}
              </button>
            ))}
          </div>
          <div className="rp-chips">
            {STATUS_OPTIONS.map((option) => (
              <button key={option.value} className={`rp-chip ${status === option.value ? "active" : ""}`} onClick={() => setStatus(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rp-summary">
        <div className="rp-summary-card">
          <span className="rp-summary-val">{filteredPedidos.length}</span>
          <span className="rp-summary-lbl">Pedidos no periodo</span>
        </div>
        <div className="rp-summary-card green">
          <span className="rp-summary-val">{summary.finalizados.length}</span>
          <span className="rp-summary-lbl">Finalizados</span>
        </div>
        <div className="rp-summary-card red">
          <span className="rp-summary-val">{summary.cancelados.length}</span>
          <span className="rp-summary-lbl">Cancelados</span>
        </div>
        <div className="rp-summary-card amber">
          <span className="rp-summary-val">{summary.emAndamento.length}</span>
          <span className="rp-summary-lbl">Em andamento</span>
        </div>
        <div className="rp-summary-card fire">
          <span className="rp-summary-val">{brl(summary.faturamento)}</span>
          <span className="rp-summary-lbl">Faturamento finalizado</span>
        </div>
      </div>

      <div className="rp-table-wrap">
        {loading ? (
          <div className="rp-loading">Carregando relatorio...</div>
        ) : filteredPedidos.length === 0 ? (
          <div className="rp-empty">
            <div className="rp-empty-title">Nenhum pedido encontrado</div>
            <span>Ajuste o periodo ou os filtros para ver os resultados.</span>
          </div>
        ) : (
          <table className="rp-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data/Hora</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Canal</th>
                <th>Endereco</th>
                <th>Entregador</th>
                <th>Itens</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map((pedido) => {
                const cfg = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.novo;
                return (
                  <tr className="rp-row" key={pedido.id} onClick={() => setSelectedPedido(pedido)}>
                    <td className="rp-codigo">#{pedido.codigo_pedido}</td>
                    <td className="rp-muted">{formatDateTime(pedido.created_at)}</td>
                    <td>
                      <div className="rp-cliente-nome">{pedido.cliente_nome}</div>
                      {pedido.cliente_telefone && <div className="rp-cliente-tel">{pedido.cliente_telefone}</div>}
                    </td>
                    <td>{getTipoLabel(pedido)}</td>
                    <td className="rp-muted">{CANAL_LABEL[pedido.canal || ""] || pedido.canal || "-"}</td>
                    <td>{getEnderecoLabel(pedido)}</td>
                    <td>{getEntregadorLabel(pedido)}</td>
                    <td className="rp-itens-cell">{getItensLabel(pedido)}</td>
                    <td>
                      <span className="rp-status-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="rp-muted">
                      {pedido.forma_pagamento || "-"}
                      {pedido.status_pagamento && <div className="rp-muted-sm">{pedido.status_pagamento}</div>}
                    </td>
                    <td className="rp-total">{brl(pedido.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedPedido && (
        <div className="rp-overlay" onClick={(event) => event.currentTarget === event.target && setSelectedPedido(null)}>
          <div className="rp-modal">
            <div className="rp-modal-head">
              <div>
                <div className="rp-modal-title">#{selectedPedido.codigo_pedido}</div>
                <div className="rp-muted-sm">{formatDateTime(selectedPedido.created_at)}</div>
              </div>
              <button className="rp-modal-close" onClick={() => setSelectedPedido(null)}>
                x
              </button>
            </div>
            <div className="rp-modal-body">
              <div>
                <div className="rp-modal-label">Cliente</div>
                <div className="rp-modal-info-box">
                  <div><strong>{selectedPedido.cliente_nome}</strong></div>
                  {selectedPedido.cliente_telefone && <div className="rp-muted-sm">{selectedPedido.cliente_telefone}</div>}
                  <div className="rp-muted-sm">{getTipoLabel(selectedPedido)}</div>
                </div>
              </div>
              <div>
                <div className="rp-modal-label">Endereco</div>
                <div className="rp-modal-info-box">
                  {getEnderecoLabel(selectedPedido)}
                  {enderecosByPedido[selectedPedido.id]?.nome_contato && (
                    <div className="rp-muted-sm">Contato: {enderecosByPedido[selectedPedido.id]?.nome_contato}</div>
                  )}
                  {enderecosByPedido[selectedPedido.id]?.telefone_contato && (
                    <div className="rp-muted-sm">{enderecosByPedido[selectedPedido.id]?.telefone_contato}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="rp-modal-label">Entregador</div>
                <div className="rp-modal-info-box">{getEntregadorLabel(selectedPedido)}</div>
              </div>
              <div>
                <div className="rp-modal-label">Itens</div>
                <div className="rp-modal-itens">
                  {(itensByPedido[selectedPedido.id] || []).map((item) => (
                    <div className="rp-modal-item-row" key={item.id}>
                      <span className="rp-modal-item-qty">{Number(item.quantidade || 0)}x</span>
                      <div className="rp-modal-item-info">
                        <div>{item.produto_nome}</div>
                        {item.observacoes && <small>{item.observacoes}</small>}
                      </div>
                      <span className="rp-modal-item-price">{brl(item.valor_total)}</span>
                    </div>
                  ))}
                  {!(itensByPedido[selectedPedido.id] || []).length && <div className="rp-modal-info-box">Nenhum item encontrado.</div>}
                </div>
              </div>
              <div>
                <div className="rp-modal-label">Resumo</div>
                <div className="rp-modal-info-box">
                  <div className="rp-ct-row"><span>Subtotal</span><span>{brl(selectedPedido.subtotal)}</span></div>
                  {Number(selectedPedido.taxa_entrega || 0) > 0 && <div className="rp-ct-row"><span>Taxa de entrega</span><span>{brl(selectedPedido.taxa_entrega)}</span></div>}
                  {Number(selectedPedido.desconto || 0) > 0 && <div className="rp-ct-row"><span>Desconto</span><span>-{brl(selectedPedido.desconto)}</span></div>}
                  <div className="rp-ct-total"><span>Total</span><span>{brl(selectedPedido.total)}</span></div>
                  <div className="rp-muted-sm" style={{ marginTop: 6 }}>
                    Pagamento: {selectedPedido.forma_pagamento || "-"} ({selectedPedido.status_pagamento || "-"})
                  </div>
                </div>
              </div>
              {selectedPedido.observacoes && (
                <div>
                  <div className="rp-modal-label">Observacoes</div>
                  <div className="rp-modal-info-box">{selectedPedido.observacoes}</div>
                </div>
              )}
              <div>
                <div className="rp-modal-label">Status</div>
                <span className="rp-status-badge" style={{ color: STATUS_CONFIG[selectedPedido.status].color, background: STATUS_CONFIG[selectedPedido.status].bg, borderColor: STATUS_CONFIG[selectedPedido.status].border }}>
                  {STATUS_CONFIG[selectedPedido.status].label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

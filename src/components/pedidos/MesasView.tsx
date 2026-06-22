import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { APP_NAME } from "@/config/branding";

type Mesa = {
  id: string;
  company_id: string;
  numero: string;
  nome: string | null;
  capacidade: number;
  status: string;
  localizacao: string | null;
  observacoes: string | null;
};

type PedidoStatus =
  | "novo"
  | "aceito"
  | "em_producao"
  | "pronto"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  mesa_id: string | null;
  codigo_pedido: string;
  cliente_nome: string;
  canal: string | null;
  tipo_atendimento: string | null;
  status: PedidoStatus;
  status_pagamento: string;
  forma_pagamento?: string | null;
  subtotal: number;
  total: number;
  observacoes: string | null;
  created_at: string;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacoes: string | null;
};

type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  preco_sugerido: number | null;
  descricao?: string | null;
  imagem_url?: string | null;
  permite_meio_a_meio?: boolean | null;
};

type PizzaSize = { id: string; nome: string; slug: string; multiplicador: number; max_sabores: number; fatias: number; descricao?: string | null };
type PizzaBorda = { id: string; nome: string; descricao?: string | null };
type PizzaBordaPreco = { borda_id: string; tamanho_id: string; preco: number };

type DerivedStatus = "livre" | "ocupada" | "pronto" | "alerta";
type FiltroMesa = "todos" | DerivedStatus;
type ViewMode = "mapa" | "lista";
type ModalItem = { id: string; nome: string; categoria: string | null; preco_sugerido: number | null; quantidade: number; observacoes?: string; baseProductId?: string };
type ItemComStatus = PedidoItem & { pedidoStatus: PedidoStatus };

const OPEN_STATUSES: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto"];
const PAGE_SIZE = 1000;

const brl = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const shortBrl = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const fmtTempo = (m: number) => (m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);

const parsePessoas = (pedido?: Pedido, mesa?: Mesa) => {
  const match = pedido?.observacoes?.match(/(\d+)\s*pessoa/i);
  return match ? Number(match[1]) : mesa?.capacidade || 2;
};

const labelPedidoStatus: Record<PedidoStatus, string> = {
  novo: "Novo",
  aceito: "Aceito",
  em_producao: "Em producao",
  pronto: "Pronto",
  saiu_entrega: "Saiu entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function deriveMesaStatus(pedidos: Pedido[]) {
  const open = pedidos.filter((p) => OPEN_STATUSES.includes(p.status));
  if (!open.length) return { status: "livre" as DerivedStatus, tempo: 0 };

  const tempo = Math.min(...open.map((p) => minutesSince(p.created_at)));
  if (open.some((p) => p.status === "pronto")) return { status: "pronto" as DerivedStatus, tempo };
  if (tempo > 60) return { status: "alerta" as DerivedStatus, tempo };
  return { status: "ocupada" as DerivedStatus, tempo };
}

function statusClass(status: DerivedStatus) {
  if (status === "livre") return "badge-livre";
  if (status === "pronto") return "badge-pronto";
  if (status === "alerta") return "badge-alerta";
  return "badge-ocupada";
}

function statusLabel(status: DerivedStatus) {
  if (status === "livre") return "LIVRE";
  if (status === "pronto") return "PRONTO";
  if (status === "alerta") return "ALERTA";
  return "OCUPADA";
}

function itemDotClass(status: PedidoStatus) {
  if (status === "pronto" || status === "entregue") return "ist-pronto";
  if (status === "em_producao") return "ist-prod";
  return "ist-novo";
}

function itemBadgeClass(status: PedidoStatus) {
  if (status === "pronto") return "b-pronto";
  if (status === "em_producao") return "b-prod";
  if (status === "entregue") return "b-entregue";
  return "b-novo";
}

type MesaComputed = {
  mesa: Mesa;
  pedidos: Pedido[];
  items: ItemComStatus[];
  total: number;
  service: number;
  finalTotal: number;
  status: DerivedStatus;
  tempo: number;
  pessoas: number;
  identificacao: string;
};

export default function MesasView({ companyId }: { companyId: string }) {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaBordas, setPizzaBordas] = useState<PizzaBorda[]>([]);
  const [pizzaBordaPrecos, setPizzaBordaPrecos] = useState<PizzaBordaPreco[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FiltroMesa>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("mapa");
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [showNovaMesa, setShowNovaMesa] = useState(false);
  const [showComandaMesa, setShowComandaMesa] = useState<Mesa | null>(null);
  const [showAddItemMesa, setShowAddItemMesa] = useState<Mesa | null>(null);
  const [showFecharMesa, setShowFecharMesa] = useState<Mesa | null>(null);
  const [showTransferMesa, setShowTransferMesa] = useState<Mesa | null>(null);
  const [, setTick] = useState(0);

  const fetchMesas = useCallback(async () => {
    const all: Mesa[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from("mesas")
        .select("*")
        .eq("company_id", companyId)
        .order("numero")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...((data || []) as Mesa[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return all.sort((a, b) => {
      const na = Number(a.numero);
      const nb = Number(b.numero);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
    });
  }, [companyId]);

  const fetchPedidos = useCallback(async () => {
    const all: Pedido[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from("pedidos")
        .select("*")
        .eq("company_id", companyId)
        .eq("tipo_atendimento", "mesa")
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...((data || []) as Pedido[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return all;
  }, [companyId]);

  const fetchItens = useCallback(async (pedidoIds: string[]) => {
    if (!pedidoIds.length) return [] as PedidoItem[];
    const all: PedidoItem[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from("pedido_itens")
        .select("*")
        .eq("company_id", companyId)
        .in("pedido_id", pedidoIds)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...((data || []) as PedidoItem[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return all;
  }, [companyId]);

  const fetchProdutos = useCallback(async () => {
    const all: Produto[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase.from("produtos_servicos")
        .select("id,nome,categoria,preco_sugerido,descricao,imagem_url,permite_meio_a_meio")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .neq("tipo_produto", "insumo")
        .order("nome")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      all.push(...((data || []) as Produto[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return all;
  }, [companyId]);

  const fetchPizzaData = useCallback(async () => {
    const [sizesRes, bordasRes] = await Promise.all([
      supabase.from("pizza_tamanhos").select("id,nome,slug,multiplicador,max_sabores,fatias,descricao,ordem").eq("company_id", companyId).eq("ativo", true).order("ordem"),
      supabase.from("pizza_bordas").select("id,nome,descricao,ordem").eq("company_id", companyId).eq("ativo", true).order("ordem"),
    ]);
    const sizes = (sizesRes.data || []) as PizzaSize[];
    const bordas = (bordasRes.data || []) as PizzaBorda[];
    const bordaIds = bordas.map((b) => b.id);
    let precos: PizzaBordaPreco[] = [];
    if (bordaIds.length) {
      const { data } = await supabase.from("pizza_borda_precos").select("borda_id,tamanho_id,preco").in("borda_id", bordaIds);
      precos = (data || []) as PizzaBordaPreco[];
    }
    return { sizes, bordas, precos };
  }, [companyId]);

  const load = useCallback(async () => {
    try {
      const [mesasData, pedidosData, produtosData, pizzaData] = await Promise.all([fetchMesas(), fetchPedidos(), fetchProdutos(), fetchPizzaData()]);
      const itensData = await fetchItens(pedidosData.map((p) => p.id));
      setMesas(mesasData);
      setPedidos(pedidosData);
      setItens(itensData);
      setProdutos(produtosData);
      setPizzaSizes(pizzaData.sizes);
      setPizzaBordas(pizzaData.bordas);
      setPizzaBordaPrecos(pizzaData.precos);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "tente novamente";
      toast.error(`Erro ao carregar mesas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchItens, fetchMesas, fetchPedidos, fetchProdutos, fetchPizzaData]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`mesas-modelo-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas", filter: `company_id=eq.${companyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens", filter: `company_id=eq.${companyId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, load]);

  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const mesaPedidos = useMemo(() => {
    const map: Record<string, Pedido[]> = {};
    pedidos.forEach((pedido) => {
      if (!pedido.mesa_id) return;
      (map[pedido.mesa_id] ||= []).push(pedido);
    });
    return map;
  }, [pedidos]);

  const pedidoItens = useMemo(() => {
    const map: Record<string, PedidoItem[]> = {};
    itens.forEach((item) => {
      (map[item.pedido_id] ||= []).push(item);
    });
    return map;
  }, [itens]);

  const mesasComputed = useMemo<MesaComputed[]>(() => {
    return mesas.map((mesa) => {
      const ps = (mesaPedidos[mesa.id] || []).filter((p) => OPEN_STATUSES.includes(p.status));
      const items = ps.flatMap((pedido) => (pedidoItens[pedido.id] || []).map((item) => ({ ...item, pedidoStatus: pedido.status })));
      const total = items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
      const service = total * 0.1;
      const { status, tempo } = deriveMesaStatus(ps);
      const first = ps[0];
      const defaultName = `Mesa ${mesa.numero}`;
      return {
        mesa,
        pedidos: ps,
        items,
        total,
        service,
        finalTotal: total + service,
        status,
        tempo,
        pessoas: parsePessoas(first, mesa),
        identificacao: first?.cliente_nome && first.cliente_nome !== defaultName ? first.cliente_nome : "",
      };
    });
  }, [mesas, mesaPedidos, pedidoItens]);

  const selectedInfo = useMemo(() => mesasComputed.find((info) => info.mesa.id === selectedMesaId) || null, [mesasComputed, selectedMesaId]);

  const filteredMesas = useMemo(() => {
    if (filter === "todos") return mesasComputed;
    return mesasComputed.filter((info) => info.status === filter);
  }, [filter, mesasComputed]);

  const stats = useMemo(() => {
    const ocupadas = mesasComputed.filter((m) => m.status !== "livre").length;
    const pedidosAbertos = mesasComputed.reduce((sum, m) => sum + m.pedidos.length, 0);
    const faturamento = mesasComputed.reduce((sum, m) => sum + m.finalTotal, 0);
    return { ocupadas, pedidosAbertos, faturamento };
  }, [mesasComputed]);

  const criarMesa = async (numero: string, capacidade: number) => {
    if (!numero.trim()) return toast.error("Informe o numero da mesa");
    const { error } = await supabase.from("mesas").insert({
      company_id: companyId,
      numero: numero.trim(),
      capacidade,
      status: "livre",
    });
    if (error) return toast.error(`Erro ao criar mesa: ${error.message}`);
    toast.success("Mesa criada");
    setShowNovaMesa(false);
    load();
  };

  const registrarItensPedido = async (pedidoId: string, modalItems: ModalItem[]) => {
    for (const item of modalItems) {
      const valorUnitario = Number(item.preco_sugerido || 0);
      const { error } = await supabase.rpc("registrar_item_pedido_com_custo" as any, {
        p_pedido_id: pedidoId,
        p_company_id: companyId,
        p_produto_id: item.baseProductId || item.id,
        p_produto_nome: item.nome,
        p_quantidade: item.quantidade,
        p_valor_unitario: valorUnitario,
        p_observacoes: item.observacoes || null,
      });
      if (error) {
        const msg = String(error.message || "");
        const rpcNaoExiste = error.code === "PGRST202" || msg.includes("registrar_item_pedido_com_custo") || msg.includes("Could not find the function");
        if (!rpcNaoExiste) return error;

        const { error: insertError } = await supabase.from("pedido_itens").insert({
          pedido_id: pedidoId,
          company_id: companyId,
          produto_id: item.baseProductId || item.id,
          produto_nome: item.nome,
          quantidade: item.quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorUnitario * item.quantidade,
          observacoes: item.observacoes || null,
        });
        if (insertError) return insertError;
      }
    }
    return null;
  };

  const atualizarTotalPedido = async (pedidoId: string, extraItems: ModalItem[] = []) => {
    const existingTotal = (pedidoItens[pedidoId] || []).reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
    const extraTotal = extraItems.reduce((sum, item) => sum + Number(item.preco_sugerido || 0) * item.quantidade, 0);
    await supabase.from("pedidos")
      .update({ subtotal: existingTotal + extraTotal, total: existingTotal + extraTotal })
      .eq("id", pedidoId);
  };

  const abrirComanda = async (mesa: Mesa, pessoas: number, nome: string, modalItems: ModalItem[]) => {
    const total = modalItems.reduce((sum, item) => sum + Number(item.preco_sugerido || 0) * item.quantidade, 0);
    const { data, error } = await supabase.from("pedidos")
      .insert({
        company_id: companyId,
        mesa_id: mesa.id,
        cliente_nome: nome.trim() || `Mesa ${mesa.numero}`,
        cliente_telefone: "",
        canal: "interno",
        tipo_atendimento: "mesa",
        status: "aceito",
        status_pagamento: "pendente",
        subtotal: total,
        total,
        observacoes: `${pessoas || mesa.capacidade || 2} pessoa(s)`,
      })
      .select("id")
      .single();

    if (error || !data) return toast.error(`Erro ao abrir comanda: ${error?.message || "sem retorno"}`);

    if (modalItems.length) {
      const itemError = await registrarItensPedido(data.id, modalItems);
      if (itemError) return toast.error(`Comanda aberta, mas os itens falharam: ${itemError.message}`);
    }

    await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesa.id);
    toast.success(`Mesa ${mesa.numero} aberta com ${modalItems.length} item(ns)`);
    setShowComandaMesa(null);
    setSelectedMesaId(mesa.id);
    load();
  };

  const adicionarItens = async (mesa: Mesa, modalItems: ModalItem[]) => {
    if (!modalItems.length) return toast.error("Adicione pelo menos um item");
    const openPedido = (mesaPedidos[mesa.id] || []).find((p) => OPEN_STATUSES.includes(p.status));
    let pedidoId = openPedido?.id;

    if (!pedidoId) {
      const { data, error } = await supabase.from("pedidos")
        .insert({
          company_id: companyId,
          mesa_id: mesa.id,
          cliente_nome: `Mesa ${mesa.numero}`,
          cliente_telefone: "",
          canal: "interno",
          tipo_atendimento: "mesa",
          status: "aceito",
          status_pagamento: "pendente",
          subtotal: 0,
          total: 0,
          observacoes: `${mesa.capacidade || 2} pessoa(s)`,
        })
        .select("id")
        .single();
      if (error || !data) return toast.error(`Erro ao abrir comanda: ${error?.message || "sem retorno"}`);
      pedidoId = data.id;
    }

    const error = await registrarItensPedido(pedidoId, modalItems);
    if (error) return toast.error(`Erro ao adicionar item: ${error.message}`);
    await atualizarTotalPedido(pedidoId, modalItems);
    await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesa.id);
    toast.success("Itens adicionados a comanda");
    setShowAddItemMesa(null);
    setSelectedMesaId(mesa.id);
    load();
  };

  const fecharMesa = async (mesa: Mesa, formaPagamento: string) => {
    const open = (mesaPedidos[mesa.id] || []).filter((p) => OPEN_STATUSES.includes(p.status));
    if (!open.length) return toast.error("Nenhuma comanda aberta nesta mesa");
    const { error } = await supabase.from("pedidos")
      .update({ status: "entregue", status_pagamento: "pago", forma_pagamento: formaPagamento })
      .in("id", open.map((p) => p.id));
    if (error) return toast.error(`Erro ao fechar conta: ${error.message}`);

    await supabase.from("mesas").update({ status: "livre" }).eq("id", mesa.id);
    toast.success(`Conta da Mesa ${mesa.numero} fechada`);
    setShowFecharMesa(null);
    setSelectedMesaId(null);
    load();
  };

  const cancelarMesa = async (mesa: Mesa) => {
    const open = (mesaPedidos[mesa.id] || []).filter((p) => OPEN_STATUSES.includes(p.status));
    if (!open.length) return;
    if (!confirm(`Cancelar a comanda da Mesa ${mesa.numero}?`)) return;
    const { error } = await supabase.from("pedidos")
      .update({ status: "cancelado", status_pagamento: "cancelado" })
      .in("id", open.map((p) => p.id));
    if (error) return toast.error(`Erro ao cancelar: ${error.message}`);
    await supabase.from("mesas").update({ status: "livre" }).eq("id", mesa.id);
    toast.success("Mesa cancelada");
    setSelectedMesaId(null);
    load();
  };

  const transferirMesa = async (origem: Mesa, destinoId: string) => {
    if (!destinoId) return toast.error("Selecione a mesa de destino");
    const open = (mesaPedidos[origem.id] || []).filter((p) => OPEN_STATUSES.includes(p.status));
    if (!open.length) return toast.error("Mesa sem comanda aberta");
    const { error } = await supabase.from("pedidos")
      .update({ mesa_id: destinoId })
      .in("id", open.map((p) => p.id));
    if (error) return toast.error(`Erro ao transferir: ${error.message}`);
    await Promise.all([
      supabase.from("mesas").update({ status: "livre" }).eq("id", origem.id),
      supabase.from("mesas").update({ status: "ocupada" }).eq("id", destinoId),
    ]);
    toast.success("Comanda transferida");
    setShowTransferMesa(null);
    setSelectedMesaId(destinoId);
    load();
  };

  const imprimirComanda = (info: MesaComputed) => {
    const html = `
      <html><head><title>Mesa ${info.mesa.numero}</title><style>
      body{font-family:Arial,sans-serif;padding:24px} h1{font-size:20px} table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}.total{font-size:18px;font-weight:700;text-align:right;margin-top:16px}
      </style></head><body><h1>${APP_NAME} - Mesa ${info.mesa.numero}</h1><p>${info.pessoas} pessoa(s) - ${fmtTempo(info.tempo)}</p><table>${info.items
        .map((item) => `<tr><td>${item.quantidade}x ${item.produto_nome}</td><td style="text-align:right">${brl(Number(item.valor_total || 0))}</td></tr>`)
        .join("")}</table><div class="total">Total: ${brl(info.finalTotal)}</div><script>window.print();window.close();</script></body></html>`;
    const printWindow = window.open("", "_blank", "width=420,height=640");
    if (!printWindow) return toast.error("Permita pop-ups para imprimir");
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="mesas-modelo-root mesas-empty-loading">
        <MesasStyles />
        <span>Carregando mesas...</span>
      </div>
    );
  }

  return (
    <div className="mesas-modelo-root">
      <MesasStyles />

      <div className="mesas-toolbar">
        <div className="chips">
          {([
            ["todos", "Todas"],
            ["ocupada", "Ocupadas"],
            ["pronto", "Com pedido pronto"],
            ["alerta", "Aguardando muito"],
            ["livre", "Livres"],
          ] as [FiltroMesa, string][]).map(([key, label]) => (
            <button key={key} className={`chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <button className={`view-btn ${viewMode === "mapa" ? "active" : ""}`} onClick={() => setViewMode("mapa")}>
            Mapa
          </button>
          <button className={`view-btn ${viewMode === "lista" ? "active" : ""}`} onClick={() => setViewMode("lista")}>
            Lista
          </button>
          <button className="new-table-btn" onClick={() => setShowNovaMesa(true)}>
            + Nova Mesa
          </button>
          <span className="toolbar-count">
            {mesas.length} mesas - {stats.ocupadas} ocupadas
          </span>
        </div>
      </div>

      <div className="mobile-stats-row">
        <HeaderStat value={stats.ocupadas} label="Mesas ativas" tone="fire" />
        <HeaderStat value={stats.pedidosAbertos} label="Pedidos abertos" tone="amber" />
        <HeaderStat value={shortBrl(stats.faturamento)} label="Faturamento" tone="green" />
      </div>

      <div className="mesas-content">
        <div className="mesas-panel">
          {filteredMesas.length === 0 ? (
            <div className="empty-section">
              <div className="empty-icon">Mesa</div>
              <div className="empty-title">Nenhuma mesa encontrada</div>
              <div className="empty-sub">Mude o filtro ou abra uma nova mesa</div>
            </div>
          ) : viewMode === "mapa" ? (
            <div className="mesas-grid">
              {filteredMesas.map((info) => (
                <MesaCard
                  key={info.mesa.id}
                  info={info}
                  selected={selectedMesaId === info.mesa.id}
                  onSelect={() => (info.status === "livre" ? setShowComandaMesa(info.mesa) : setSelectedMesaId(info.mesa.id))}
                  onAdd={() => setShowAddItemMesa(info.mesa)}
                  onCloseAccount={() => setShowFecharMesa(info.mesa)}
                />
              ))}
            </div>
          ) : (
            <div className="mesa-list">
              {filteredMesas.map((info) => (
                <button key={info.mesa.id} className="mesa-list-row" onClick={() => (info.status === "livre" ? setShowComandaMesa(info.mesa) : setSelectedMesaId(info.mesa.id))}>
                  <span className="mesa-list-main">Mesa {info.mesa.numero}</span>
                  <span className={`mesa-status-badge ${statusClass(info.status)}`}>{statusLabel(info.status)}</span>
                  <span>{info.items.length} itens</span>
                  <strong>{brl(info.finalTotal)}</strong>
                  <span>Tempo {fmtTempo(info.tempo)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <MesaDetailPanel
          info={selectedInfo}
          onClose={() => setSelectedMesaId(null)}
          onAddItem={(mesa) => setShowAddItemMesa(mesa)}
          onFechar={(mesa) => setShowFecharMesa(mesa)}
          onTransfer={(mesa) => setShowTransferMesa(mesa)}
          onCancel={cancelarMesa}
          onPrint={imprimirComanda}
        />
      </div>

      {showNovaMesa && <NovaMesaModal onClose={() => setShowNovaMesa(false)} onConfirm={criarMesa} />}
      {showComandaMesa && (
        <ComandaItemsModal
          title={`Nova Comanda - Mesa ${showComandaMesa.numero}`}
          mesa={showComandaMesa}
          produtos={produtos}
          pizzaSizes={pizzaSizes}
          pizzaBordas={pizzaBordas}
          pizzaBordaPrecos={pizzaBordaPrecos}
          showMesaFields
          confirmLabel="Abrir Comanda"
          onClose={() => setShowComandaMesa(null)}
          onConfirm={(items, pessoas, nome) => abrirComanda(showComandaMesa, pessoas, nome, items)}
        />
      )}
      {showAddItemMesa && (
        <ComandaItemsModal
          title={`Adicionar itens - Mesa ${showAddItemMesa.numero}`}
          mesa={showAddItemMesa}
          produtos={produtos}
          pizzaSizes={pizzaSizes}
          pizzaBordas={pizzaBordas}
          pizzaBordaPrecos={pizzaBordaPrecos}
          confirmLabel="Adicionar itens"
          onClose={() => setShowAddItemMesa(null)}
          onConfirm={(items) => adicionarItens(showAddItemMesa, items)}
        />
      )}
      {showFecharMesa && (
        <FecharContaModal
          info={mesasComputed.find((info) => info.mesa.id === showFecharMesa.id)}
          onClose={() => setShowFecharMesa(null)}
          onConfirm={(forma) => fecharMesa(showFecharMesa, forma)}
        />
      )}
      {showTransferMesa && (
        <TransferirMesaModal
          origem={showTransferMesa}
          mesasLivres={mesasComputed.filter((info) => info.status === "livre" && info.mesa.id !== showTransferMesa.id).map((info) => info.mesa)}
          onClose={() => setShowTransferMesa(null)}
          onConfirm={(destinoId) => transferirMesa(showTransferMesa, destinoId)}
        />
      )}
    </div>
  );
}

function HeaderStat({ value, label, tone }: { value: ReactNode; label: string; tone: "fire" | "amber" | "green" }) {
  return (
    <div className="hstat">
      <div className={`hstat-val ${tone}`}>{value}</div>
      <div className="hstat-lbl">{label}</div>
    </div>
  );
}

function MesaCard({ info, selected, onSelect, onAdd, onCloseAccount }: { info: MesaComputed; selected: boolean; onSelect: () => void; onAdd: () => void; onCloseAccount: () => void }) {
  const { mesa, status, items, finalTotal, tempo, pessoas, identificacao } = info;
  const livre = status === "livre";

  return (
    <div className={`mesa-card ${status} ${selected ? "selected pop" : ""}`} onClick={onSelect}>
      <div className="mesa-top-strip" />
      <div className="mesa-body">
        <div className="mesa-header">
          <div className="mesa-num">Mesa {mesa.numero}</div>
          <span className={`mesa-status-badge ${statusClass(status)}`}>{statusLabel(status)}</span>
        </div>

        {livre ? (
          <div className="mesa-livre-body">
            <div className="mesa-livre-icon">Mesa</div>
            <div className="mesa-livre-text">Mesa disponivel</div>
            <button className="mesa-open-btn" onClick={(event) => { event.stopPropagation(); onSelect(); }}>
              + Abrir Mesa
            </button>
          </div>
        ) : (
          <>
            <div className="mesa-pessoas">
              <span>Pessoas</span>
              <span>{pessoas} pessoa{pessoas > 1 ? "s" : ""}</span>
              {identificacao && <span className="mesa-ident">- {identificacao}</span>}
            </div>

            <div className="mesa-resumo">
              {items.slice(0, 3).map((item) => (
                <div className="mesa-item-row" key={item.id}>
                  <span className="mesa-item-qty">{item.quantidade}x</span>
                  <span className="mesa-item-name">{item.produto_nome}</span>
                  <span className={`mesa-item-status ${itemDotClass(item.pedidoStatus)}`} />
                </div>
              ))}
              {items.length > 3 && <div className="mesa-more">+{items.length - 3} itens</div>}
              {!items.length && <div className="mesa-more">Sem itens ainda</div>}
            </div>

            <div className="mesa-footer">
              <div className="mesa-total">{brl(finalTotal)}</div>
              <div className={`mesa-tempo ${tempo > 60 ? "danger" : tempo > 30 ? "warning" : ""}`}>Tempo {fmtTempo(tempo)}</div>
            </div>

            <div className="mesa-actions">
              <button className="mact-btn primary" onClick={(event) => { event.stopPropagation(); onAdd(); }}>+ Item</button>
              <button className="mact-btn success" onClick={(event) => { event.stopPropagation(); onCloseAccount(); }}>Fechar</button>
              <button className="mact-btn" onClick={(event) => { event.stopPropagation(); onSelect(); }} title="Ver comanda">Ver</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MesaDetailPanel({ info, onClose, onAddItem, onFechar, onTransfer, onCancel, onPrint }: { info: MesaComputed | null; onClose: () => void; onAddItem: (mesa: Mesa) => void; onFechar: (mesa: Mesa) => void; onTransfer: (mesa: Mesa) => void; onCancel: (mesa: Mesa) => void; onPrint: (info: MesaComputed) => void }) {
  return (
    <aside className={`detail-panel ${info ? "" : "closed"}`}>
      {info && (
        <>
          <div className="dp-header">
            <div className="dp-title">Mesa {info.mesa.numero}</div>
            <div className="dp-title-actions">
              <span className={`mesa-status-badge ${statusClass(info.status)}`}>{statusLabel(info.status)}</span>
              <button className="dp-close" onClick={onClose}>x</button>
            </div>
          </div>

          <div className="dp-body">
            <div>
              <div className="dp-section-label">Informacoes</div>
              <div className="info-box">
                <div><div className="info-muted">Mesa</div><strong>{info.mesa.numero}</strong></div>
                <div><div className="info-muted">Pessoas</div><strong>{info.pessoas}</strong></div>
                <div><div className="info-muted">Aberta ha</div><strong>{fmtTempo(info.tempo)}</strong></div>
                {info.identificacao && <div><div className="info-muted">Identificacao</div><strong className="amber-text">{info.identificacao}</strong></div>}
              </div>
            </div>

            <div>
              <div className="dp-section-label">Comanda ({info.items.length} itens)</div>
              <div className="comanda-list">
                {info.items.map((item) => (
                  <div className="comanda-item" key={item.id}>
                    <div className="ci-qty">{item.quantidade}x</div>
                    <div className="ci-info">
                      <div className="ci-name">{item.produto_nome}</div>
                      {item.observacoes && <div className="ci-obs">Obs: {item.observacoes}</div>}
                    </div>
                    <div className="ci-status">
                      <span className={`ci-badge ${itemBadgeClass(item.pedidoStatus)}`}>{labelPedidoStatus[item.pedidoStatus]}</span>
                      <span className="ci-price">{brl(Number(item.valor_total || 0))}</span>
                    </div>
                  </div>
                ))}
                {!info.items.length && <div className="empty-comanda">Nenhum item adicionado</div>}
              </div>
            </div>

            <TotalBox total={info.total} service={info.service} finalTotal={info.finalTotal} totalTone="fire" />
          </div>

          <div className="dp-actions">
            <button className="dp-btn primary" onClick={() => onAddItem(info.mesa)}>+ Adicionar item a comanda</button>
            <div className="dp-btn-row">
              <button className="dp-btn success" onClick={() => onFechar(info.mesa)}>Fechar conta</button>
              <button className="dp-btn" onClick={() => onPrint(info)}>Imprimir</button>
            </div>
            <div className="dp-btn-row">
              <button className="dp-btn" onClick={() => onTransfer(info.mesa)}>Transferir</button>
              <button className="dp-btn danger" onClick={() => onCancel(info.mesa)}>Cancelar mesa</button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function TotalBox({ total, service, finalTotal, totalTone }: { total: number; service: number; finalTotal: number; totalTone: "fire" | "green" }) {
  return (
    <div className="comanda-total-box">
      <div className="ct-row"><span>Subtotal</span><span>{brl(total)}</span></div>
      <div className="ct-row"><span>Servico (10%)</span><span>{brl(service)}</span></div>
      <div className="ct-total"><span>Total</span><span className={`ct-total-val ${totalTone}`}>{brl(finalTotal)}</span></div>
    </div>
  );
}

function ModalShell({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay open" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">{footer}</div>
      </div>
    </div>
  );
}

function NovaMesaModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (numero: string, capacidade: number) => void }) {
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState(4);
  return (
    <ModalShell
      title="Nova Mesa"
      onClose={onClose}
      footer={<><button className="mf-btn" onClick={onClose}>Cancelar</button><button className="mf-btn primary" onClick={() => onConfirm(numero, capacidade)}>Criar Mesa</button></>}
    >
      <div className="form-row">
        <FormField label="Mesa"><input className="form-input" autoFocus value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 1, 2, Varanda" /></FormField>
        <FormField label="Pessoas"><input className="form-input" type="number" min={1} max={50} value={capacidade} onChange={(e) => setCapacidade(Number(e.target.value) || 1)} /></FormField>
      </div>
    </ModalShell>
  );
}

function ComandaItemsModal({
  title, mesa, produtos, pizzaSizes, pizzaBordas, pizzaBordaPrecos,
  showMesaFields = false, confirmLabel, onClose, onConfirm,
}: {
  title: string; mesa: Mesa; produtos: Produto[];
  pizzaSizes: PizzaSize[]; pizzaBordas: PizzaBorda[]; pizzaBordaPrecos: PizzaBordaPreco[];
  showMesaFields?: boolean; confirmLabel: string; onClose: () => void;
  onConfirm: (items: ModalItem[], pessoas: number, nome: string) => void;
}) {
  const [pessoas, setPessoas] = useState(mesa.capacidade || 2);
  const [nome, setNome] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ModalItem[]>([]);
  const [configProduto, setConfigProduto] = useState<Produto | null>(null);
  const [activeCategory, setActiveCategory] = useState("todos");

  const isPizza = (p?: Produto | null) => {
    if (!p) return false;
    const n = (p.nome || "").toLowerCase();
    const c = (p.categoria || "").toLowerCase();
    return !!p.permite_meio_a_meio || n.includes("pizza") || c.includes("pizza");
  };

  const categorias = useMemo(() => {
    const map = new Map<string, Produto[]>();
    produtos.forEach((p) => {
      const cat = p.categoria || "Outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries());
  }, [produtos]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = activeCategory === "todos"
      ? produtos
      : produtos.filter((p) => (p.categoria || "Outros") === activeCategory);
    if (!s) return base;
    return base.filter((p) => p.nome.toLowerCase().includes(s) || (p.categoria || "").toLowerCase().includes(s));
  }, [activeCategory, produtos, search]);

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantidade, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.preco_sugerido || 0) * item.quantidade, 0), [items]);

  const addModalItem = (item: ModalItem) => {
    setItems((cur) => {
      const existing = cur.find((it) => it.id === item.id && (it.observacoes || "") === (item.observacoes || ""));
      if (existing) return cur.map((it) => it === existing ? { ...it, quantidade: it.quantidade + item.quantidade } : it);
      return [...cur, item];
    });
  };

  const handleProductClick = (produto: Produto) => {
    if (isPizza(produto) || produto.descricao) {
      setConfigProduto(produto);
      return;
    }
    addModalItem({ id: produto.id, nome: produto.nome, categoria: produto.categoria, preco_sugerido: produto.preco_sugerido, quantidade: 1 });
  };

  const changeQty = (key: string, delta: number) => {
    setItems((cur) => cur.flatMap((it) => {
      if ((it.id + "::" + (it.observacoes || "")) !== key) return [it];
      const next = it.quantidade + delta;
      return next <= 0 ? [] : [{ ...it, quantidade: next }];
    }));
  };

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={<><button className="mf-btn" onClick={onClose}>Cancelar</button><button className="mf-btn primary" disabled={!items.length} onClick={() => onConfirm(items, pessoas, nome)}>{confirmLabel} · {brl(subtotal)}</button></>}
      wide
    >
      <div className="mesa-order-root">
        <section className="mesa-order-menu">
          {showMesaFields && (
            <div className="mesa-order-fields">
              <div className="form-row">
                <FormField label="Mesa"><input className="form-input" value={`Mesa ${mesa.numero}`} readOnly /></FormField>
                <FormField label="Pessoas"><input className="form-input" type="number" min={1} max={50} value={pessoas} onChange={(e) => setPessoas(Number(e.target.value) || 1)} /></FormField>
              </div>
              <FormField label="Nome / identificacao (opcional)"><input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Familia Silva, Aniversario Joao..." /></FormField>
            </div>
          )}

          <div className="mesa-order-search">
            <span className="prod-search-icon">??</span>
            <input className="form-input prod-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pizza, bebida, combo..." />
          </div>

          <div className="mesa-order-cats">
            <button type="button" className={`mesa-order-cat ${activeCategory === "todos" ? "active" : ""}`} onClick={() => setActiveCategory("todos")}>Todos <span>{produtos.length}</span></button>
            {categorias.map(([cat, prods]) => (
              <button key={cat} type="button" className={`mesa-order-cat ${activeCategory === cat ? "active" : ""}`} onClick={() => setActiveCategory(cat)}>{cat} <span>{prods.length}</span></button>
            ))}
          </div>

          <div className="mesa-order-products">
            <div className="mesa-order-section-title">
              {activeCategory === "todos" ? "Cardapio da mesa" : activeCategory}
              <small>{filtered.length} {filtered.length === 1 ? "item" : "itens"}</small>
            </div>
            {filtered.map((produto) => (
              <button className="mesa-product-card" key={produto.id} onClick={() => handleProductClick(produto)}>
                <div className="mesa-product-info">
                  <strong>{produto.nome}</strong>
                  <span>{produto.descricao || produto.categoria || "Produto"}</span>
                  <div className="mesa-product-price"><small>A partir de</small><b>{brl(Number(produto.preco_sugerido || 0))}</b></div>
                </div>
                <div className="mesa-product-thumb">
                  {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} /> : <span>{(produto.categoria || produto.nome).toLowerCase().includes("bebida") ? "??" : "??"}</span>}
                  <i>+</i>
                </div>
              </button>
            ))}
            {!filtered.length && <div className="empty-comanda" style={{ padding: 28 }}>Nenhum item encontrado.</div>}
          </div>
        </section>

        <aside className="mesa-order-cart">
          <div className="mesa-cart-head"><div><strong>Pedido da mesa</strong><span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span></div><b>{brl(subtotal)}</b></div>
          <div className="mesa-cart-body">
            {!items.length ? (
              <div className="mesa-cart-empty"><div>??</div><span>Adicione itens do cardapio para montar a comanda.</span></div>
            ) : (
              items.map((item) => {
                const key = item.id + "::" + (item.observacoes || "");
                return (
                  <div className="mesa-cart-item" key={key}>
                    <div className="mesa-cart-item-top"><strong>{item.nome}</strong><button className="mi-del" onClick={() => changeQty(key, -999)}>×</button></div>
                    {item.observacoes && <small>{item.observacoes}</small>}
                    <div className="mesa-cart-item-bottom">
                      <div className="mi-qty-ctrl"><button className="mi-btn" onClick={() => changeQty(key, -1)}>-</button><span className="mi-qty">{item.quantidade}</span><button className="mi-btn" onClick={() => changeQty(key, 1)}>+</button></div>
                      <b>{brl(Number(item.preco_sugerido || 0) * item.quantidade)}</b>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mesa-cart-foot"><div className="ct-row"><span>Subtotal</span><span>{brl(subtotal)}</span></div><div className="ct-total"><span>Total</span><span className="ct-total-val fire">{brl(subtotal)}</span></div></div>
        </aside>
      </div>

      {configProduto && (
        <ProductConfigDialog
          produto={configProduto}
          produtos={produtos}
          pizzaSizes={pizzaSizes}
          pizzaBordas={pizzaBordas}
          pizzaBordaPrecos={pizzaBordaPrecos}
          isPizza={isPizza(configProduto)}
          onClose={() => setConfigProduto(null)}
          onAdd={(item) => { addModalItem(item); setConfigProduto(null); }}
        />
      )}
    </ModalShell>
  );
}
function ProductConfigDialog({
  produto, produtos, pizzaSizes, pizzaBordas, pizzaBordaPrecos, isPizza,
  onClose, onAdd,
}: {
  produto: Produto; produtos: Produto[];
  pizzaSizes: PizzaSize[]; pizzaBordas: PizzaBorda[]; pizzaBordaPrecos: PizzaBordaPreco[];
  isPizza: boolean;
  onClose: () => void;
  onAdd: (item: ModalItem) => void;
}) {
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");
  const [sizeId, setSizeId] = useState<string>("");
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [bordaId, setBordaId] = useState<string>("");
  const [flavorSearch, setFlavorSearch] = useState("");

  const SIZE_OPTIONS = useMemo(() => pizzaSizes.map((s) => ({
    id: s.slug || s.id, tamanhoId: s.id, label: s.nome,
    multiplier: Number(s.multiplicador) || 1,
    maxFlavors: s.max_sabores || 1, slices: s.fatias || 1,
    descricao: s.descricao || "",
  })), [pizzaSizes]);

  const selectedSize = sizeId ? SIZE_OPTIONS.find((s) => s.id === sizeId) : undefined;
  const maxExtras = selectedSize ? Math.max(0, selectedSize.maxFlavors - 1) : 0;
  const selectedExtraIds = extraFlavors.filter(Boolean).slice(0, maxExtras);

  const flavorCandidates = useMemo(() => produtos.filter((p) => {
    if (p.id === produto.id) return false;
    const n = (p.nome || "").toLowerCase();
    const c = (p.categoria || "").toLowerCase();
    return !!p.permite_meio_a_meio || n.includes("pizza") || c.includes("pizza");
  }), [produtos, produto.id]);

  const visibleFlavors = useMemo(() => {
    const q = flavorSearch.trim().toLowerCase();
    if (!q) return flavorCandidates.slice(0, 30);
    return flavorCandidates.filter((p) => p.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [flavorCandidates, flavorSearch]);

  const getBordaPrice = (bid: string, tid: string) => Number(pizzaBordaPrecos.find((x) => x.borda_id === bid && x.tamanho_id === tid)?.preco || 0);
  const selectedBorda = pizzaBordas.find((b) => b.id === bordaId);

  const computePizzaPrice = () => {
    if (!selectedSize) return Number(produto.preco_sugerido || 0);
    const prices = [Number(produto.preco_sugerido || 0)];
    selectedExtraIds.forEach((id) => {
      const f = produtos.find((p) => p.id === id);
      if (f) prices.push(Number(f.preco_sugerido || 0));
    });
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const base = avg * selectedSize.multiplier;
    const bp = selectedBorda && selectedSize.tamanhoId ? getBordaPrice(selectedBorda.id, selectedSize.tamanhoId) : 0;
    return Math.round((base + bp) * 100) / 100;
  };

  const finalPrice = isPizza ? computePizzaPrice() : Number(produto.preco_sugerido || 0);

  const toggleFlavor = (id: string) => {
    setExtraFlavors((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxExtras) return prev;
      return [...prev, id];
    });
  };

  const handleAdd = () => {
    if (isPizza && !selectedSize) { toast.error("Selecione o tamanho da pizza"); return; }
    let composedName = produto.nome;
    let composedObs = obs;
    let composedId = produto.id;

    if (isPizza && selectedSize) {
      const flavorObjs = selectedExtraIds.map((id) => produtos.find((p) => p.id === id)).filter((p): p is Produto => !!p);
      const allNames = [produto.nome, ...flavorObjs.map((f) => f.nome)];
      const total = allNames.length;
      const fraction = total === 2 ? "1/2" : total === 3 ? "1/3" : total === 4 ? "1/4" : "";
      const baseName = total === 1
        ? `${produto.nome} (${selectedSize.label})`
        : `${allNames.map((n) => `${fraction} ${n}`).join(" / ")} (${selectedSize.label})`;
      composedName = selectedBorda ? `${baseName} - Borda ${selectedBorda.nome}` : baseName;
      composedId = `${produto.id}__${selectedSize.id}__${selectedExtraIds.join("_")}__${selectedBorda?.id || "noborda"}`;
      const parts: string[] = [];
      if (total > 1) parts.push(`${total} sabores`);
      if (selectedBorda) parts.push(`Borda ${selectedBorda.nome}`);
      if (obs) parts.push(obs);
      composedObs = parts.join(". ");
    }

    onAdd({
      id: composedId,
      baseProductId: produto.id,
      nome: composedName,
      categoria: produto.categoria,
      preco_sugerido: finalPrice,
      quantidade: qty,
      observacoes: composedObs || undefined,
    });
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}
    >
      <div style={{ background: "hsl(var(--s2))", color: "hsl(var(--text))", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid hsl(var(--line)/.14)", boxShadow: "0 24px 80px rgba(0,0,0,.72)", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid hsl(var(--line)/.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 16 }}>{produto.nome}</strong>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "inherit", fontSize: 20, cursor: "pointer" }}>x</button>
        </div>
        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          {produto.descricao && <div style={{ fontSize: 12, color: "var(--text3, #999)", marginBottom: 12 }}>{produto.descricao}</div>}
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fire2, #ff8c1a)", marginBottom: 12 }}>{brl(finalPrice)}</div>

          {isPizza && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Escolha o tamanho</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 6, marginBottom: 14 }}>
                {SIZE_OPTIONS.map((s) => (
                  <button key={s.id} onClick={() => { setSizeId(s.id); setExtraFlavors((prev) => prev.slice(0, s.maxFlavors - 1)); }}
                    style={{ padding: 8, borderRadius: 8, border: sizeId === s.id ? "2px solid var(--fire, #ff6b1a)" : "1.5px solid var(--border, #333)", background: sizeId === s.id ? "rgba(255,69,0,.1)" : "transparent", cursor: "pointer", color: "inherit" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text3, #999)" }}>{s.maxFlavors} sab - {s.slices} fat</div>
                  </button>
                ))}
              </div>

              {selectedSize && selectedSize.maxFlavors > 1 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Sabores adicionais <span style={{ fontSize: 11, color: "var(--text3, #999)" }}>(ate {maxExtras} - {selectedExtraIds.length} selecionado{selectedExtraIds.length !== 1 ? "s" : ""})</span>
                  </div>
                  <input className="form-input" placeholder="Pesquisar sabor..." value={flavorSearch} onChange={(e) => setFlavorSearch(e.target.value)} style={{ marginBottom: 6 }} />
                  <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 14, border: "1px solid var(--border, #333)", borderRadius: 8 }}>
                    {visibleFlavors.map((f) => {
                      const sel = selectedExtraIds.includes(f.id);
                      return (
                        <button key={f.id} onClick={() => toggleFlavor(f.id)}
                          style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: 8, background: sel ? "rgba(255,69,0,.1)" : "transparent", border: 0, borderBottom: "1px solid var(--border, #333)", cursor: "pointer", color: "inherit", textAlign: "left" }}>
                          <span style={{ width: 18, height: 18, border: "1.5px solid var(--fire, #ff6b1a)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{sel ? "x" : ""}</span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{f.nome}</span>
                          <small style={{ fontSize: 11, color: "var(--text3, #999)" }}>{brl(Number(f.preco_sugerido || 0))}</small>
                        </button>
                      );
                    })}
                    {!visibleFlavors.length && <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "var(--text3, #999)" }}>Nenhum sabor disponivel.</div>}
                  </div>
                </>
              )}

              {selectedSize && pizzaBordas.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Borda recheada <span style={{ fontSize: 11, color: "var(--text3, #999)" }}>(opcional)</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 6, marginBottom: 14 }}>
                    <button onClick={() => setBordaId("")} style={{ padding: 8, borderRadius: 8, border: !bordaId ? "2px solid var(--fire, #ff6b1a)" : "1.5px solid var(--border, #333)", background: !bordaId ? "rgba(255,69,0,.1)" : "transparent", cursor: "pointer", color: "inherit" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Sem borda</div>
                      <div style={{ fontSize: 10, color: "var(--fire2, #ff8c1a)" }}>Gratis</div>
                    </button>
                    {pizzaBordas.map((b) => {
                      const price = selectedSize.tamanhoId ? getBordaPrice(b.id, selectedSize.tamanhoId) : 0;
                      return (
                        <button key={b.id} onClick={() => setBordaId(b.id)} style={{ padding: 8, borderRadius: 8, border: bordaId === b.id ? "2px solid var(--fire, #ff6b1a)" : "1.5px solid var(--border, #333)", background: bordaId === b.id ? "rgba(255,69,0,.1)" : "transparent", cursor: "pointer", color: "inherit" }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{b.nome}</div>
                          <div style={{ fontSize: 10, color: "var(--fire2, #ff8c1a)" }}>+ {brl(price)}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Observacoes <span style={{ fontSize: 11, color: "var(--text3, #999)" }}>(opcional)</span></div>
          <textarea className="form-input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: sem cebola, bem assada..." />
        </div>
        <div style={{ padding: 12, borderTop: "1px solid var(--border, #333)", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border, #333)", borderRadius: 8, padding: "4px 8px" }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ background: "transparent", border: 0, color: "inherit", fontSize: 16, cursor: "pointer" }}>-</button>
            <span style={{ minWidth: 20, textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} style={{ background: "transparent", border: 0, color: "inherit", fontSize: 16, cursor: "pointer" }}>+</button>
          </div>
          <button className="mf-btn primary" style={{ flex: 1 }} onClick={handleAdd} disabled={isPizza && !selectedSize}>
            Adicionar {brl(finalPrice * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}


function FecharContaModal({ info, onClose, onConfirm }: { info?: MesaComputed; onClose: () => void; onConfirm: (forma: string) => void }) {
  const [forma, setForma] = useState("pix");
  const [dividir, setDividir] = useState(2);
  if (!info) return null;
  const methods = [
    ["pix", "", "Pix"], ["credito", "", "Credito"], ["debito", "", "Debito"],
    ["dinheiro", "", "Dinheiro"], ["misto", "", "Misto"], ["dividir", "", "Dividir"],
  ];
  return (
    <ModalShell
      title={`Fechar Conta - Mesa ${info.mesa.numero}`}
      onClose={onClose}
      footer={<><button className="mf-btn" onClick={onClose}>Cancelar</button><button className="mf-btn primary" onClick={() => onConfirm(forma)}>Confirmar Pagamento</button></>}
      wide
    >
      <FormField label="Forma de pagamento">
        <div className="pag-methods">
          {methods.map(([value, icon, label]) => (
            <button key={value} className={`pag-btn ${forma === value ? "active" : ""}`} onClick={() => setForma(value)}>
              <span className="pag-icon">{icon}</span><span className="pag-label">{label}</span>
            </button>
          ))}
        </div>
      </FormField>
      {forma === "dividir" && (
        <div className="divisao-row"><span>Dividir entre</span><input className="form-input div-input" type="number" min={2} max={20} value={dividir} onChange={(e) => setDividir(Number(e.target.value) || 2)} /><span>pessoas</span><strong>{brl(info.finalTotal / dividir)}</strong><small>por pessoa</small></div>
      )}
      <div className="pag-summary"><TotalBox total={info.total} service={info.service} finalTotal={info.finalTotal} totalTone="green" /></div>
    </ModalShell>
  );
}

function TransferirMesaModal({ origem, mesasLivres, onClose, onConfirm }: { origem: Mesa; mesasLivres: Mesa[]; onClose: () => void; onConfirm: (destinoId: string) => void }) {
  const [destino, setDestino] = useState(mesasLivres[0]?.id || "");
  return (
    <ModalShell
      title={`Transferir - Mesa ${origem.numero}`}
      onClose={onClose}
      footer={<><button className="mf-btn" onClick={onClose}>Cancelar</button><button className="mf-btn primary" onClick={() => onConfirm(destino)}>Transferir</button></>}
    >
      <FormField label="Mesa de destino">
        <select className="form-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
          {mesasLivres.map((mesa) => <option key={mesa.id} value={mesa.id}>Mesa {mesa.numero}</option>)}
        </select>
        {!mesasLivres.length && <div className="empty-comanda">Nao ha mesas livres para transferir.</div>}
      </FormField>
    </ModalShell>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-group"><span className="form-label">{label}</span>{children}</label>;
}

function MesasStyles() {
  return (
    <style>{`
      .mesas-modelo-root{--bg:0 0% 3%;--s1:180 7% 6%;--s2:210 12% 8%;--s3:210 12% 11%;--s4:210 12% 15%;--line:0 0% 100%;--text:210 14% 92%;--text2:218 9% 63%;--text3:213 5% 39%;--fire:22 100% 50%;--fire2:25 100% 63%;--amber:38 91% 55%;--green:158 60% 49%;--blue:211 100% 65%;--red:0 84% 60%;--mono:'JetBrains Mono',ui-monospace,monospace;display:flex;flex-direction:column;flex:1;min-height:0;background:hsl(var(--bg));color:hsl(var(--text));font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:13px;overflow:hidden}.mesas-empty-loading{align-items:center;justify-content:center;color:hsl(var(--text3))}.mesas-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid hsl(var(--line)/.07);gap:12px;flex-shrink:0}.chips{display:flex;gap:6px;flex-wrap:wrap}.chip,.view-btn{padding:5px 12px;border-radius:20px;border:1px solid hsl(var(--line)/.07);background:transparent;color:hsl(var(--text3));font:500 11px Inter,system-ui;cursor:pointer;transition:all .15s}.chip:hover,.view-btn:hover{border-color:hsl(var(--line)/.12);color:hsl(var(--text2))}.chip.active{background:hsl(var(--fire)/.12);border-color:hsl(var(--fire)/.35);color:hsl(var(--fire2));font-weight:700}.toolbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.view-btn{border-radius:8px}.view-btn.active{background:hsl(var(--s3));color:hsl(var(--text));border-color:hsl(var(--line)/.12)}.new-table-btn{padding:6px 14px;border-radius:8px;border:1px solid hsl(var(--fire)/.35);background:hsl(var(--fire)/.1);color:hsl(var(--fire2));font:700 12px Inter;cursor:pointer}.toolbar-count{font-size:11px;color:hsl(var(--text3));order:5;width:100%;text-align:right}.mobile-stats-row{display:none;gap:8px;padding:10px 16px;border-bottom:1px solid hsl(var(--line)/.07)}.hstat{display:flex;flex-direction:column;align-items:center;min-width:110px;padding:5px 14px;border-radius:8px;background:hsl(var(--s2));border:1px solid hsl(var(--line)/.07)}.hstat-val{font-family:var(--mono);font-size:18px;font-weight:800;line-height:1}.hstat-val.fire{color:hsl(var(--fire2))}.hstat-val.amber{color:hsl(var(--amber))}.hstat-val.green{color:hsl(var(--green))}.hstat-lbl{font-size:9px;color:hsl(var(--text3));text-transform:uppercase;letter-spacing:.07em;margin-top:2px}.mesas-content{display:flex;flex:1;min-height:0;overflow:hidden}.mesas-panel{flex:1;overflow:auto;padding:16px;scrollbar-width:thin}.mesas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.mesa-card{background:hsl(var(--s1));border:1.5px solid hsl(var(--line)/.07);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .2s;position:relative;min-height:214px}.mesa-card:hover{transform:translateY(-3px);border-color:hsl(var(--line)/.12);box-shadow:0 8px 28px hsl(0 0% 0%/.5)}.mesa-card.ocupada,.mesa-card.pronto{border-color:hsl(var(--fire)/.3)}.mesa-card.alerta{border-color:hsl(var(--red)/.35)}.mesa-card.livre{opacity:.7}.mesa-card.selected{border-color:hsl(var(--fire));box-shadow:0 0 0 2px hsl(var(--fire)/.2)}.mesa-top-strip{height:3px;background:hsl(var(--s3))}.mesa-card.ocupada .mesa-top-strip{background:linear-gradient(90deg,hsl(var(--fire)),hsl(var(--fire2)))}.mesa-card.pronto .mesa-top-strip{background:linear-gradient(90deg,hsl(var(--green)),hsl(158 70% 62%))}.mesa-card.alerta .mesa-top-strip{background:linear-gradient(90deg,hsl(var(--red)),hsl(0 100% 71%));animation:stripPulse 1s ease-in-out infinite}@keyframes stripPulse{0%,100%{opacity:1}50%{opacity:.45}}.mesa-body{padding:14px;display:flex;flex-direction:column;gap:10px}.mesa-header{display:flex;align-items:center;justify-content:space-between;gap:8px}.mesa-num{font-family:var(--mono);font-size:22px;font-weight:800;letter-spacing:0;color:hsl(var(--fire2))}.mesa-card.livre .mesa-num{color:hsl(var(--text3))}.mesa-status-badge{font-size:9px;font-weight:800;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}.badge-livre{background:hsl(var(--line)/.05);color:hsl(var(--text3));border:1px solid hsl(var(--line)/.07)}.badge-ocupada{background:hsl(var(--fire)/.12);color:hsl(var(--fire2));border:1px solid hsl(var(--fire)/.3)}.badge-alerta{background:hsl(var(--red)/.15);color:hsl(var(--red));border:1px solid hsl(var(--red)/.3);animation:badgePulse 1s infinite}.badge-pronto{background:hsl(var(--green)/.12);color:hsl(var(--green));border:1px solid hsl(var(--green)/.3)}@keyframes badgePulse{0%,100%{opacity:1}50%{opacity:.55}}.mesa-pessoas{display:flex;align-items:center;gap:5px;font-size:11px;color:hsl(var(--text3));min-height:14px}.mesa-ident{color:hsl(var(--amber));margin-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mesa-resumo{background:hsl(var(--s2));border-radius:8px;padding:10px;border:1px solid hsl(var(--line)/.07);display:flex;flex-direction:column;gap:6px;min-height:74px}.mesa-item-row{display:flex;align-items:center;gap:6px;font-size:11px;color:hsl(var(--text2))}.mesa-item-qty{font-family:var(--mono);font-weight:800;color:hsl(var(--fire2));min-width:18px}.mesa-item-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mesa-item-status{width:6px;height:6px;border-radius:50%;flex-shrink:0}.ist-novo{background:hsl(var(--blue))}.ist-prod{background:hsl(var(--amber))}.ist-pronto{background:hsl(var(--green))}.mesa-more{font-size:10px;color:hsl(var(--text3));margin-top:2px}.mesa-footer{display:flex;align-items:center;justify-content:space-between}.mesa-total{font-family:var(--mono);font-size:15px;font-weight:800;color:hsl(var(--fire2))}.mesa-tempo{font:700 11px var(--mono);color:hsl(var(--text3))}.mesa-tempo.warning{color:hsl(var(--amber))}.mesa-tempo.danger{color:hsl(var(--red))}.mesa-actions{display:flex;gap:6px;margin-top:2px}.mact-btn{flex:1;padding:7px 0;border-radius:8px;border:1px solid hsl(var(--line)/.07);background:transparent;color:hsl(var(--text2));font:700 11px Inter;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}.mact-btn.primary{background:hsl(var(--fire)/.12);border-color:hsl(var(--fire)/.35);color:hsl(var(--fire2))}.mact-btn.success{background:hsl(var(--green)/.1);border-color:hsl(var(--green)/.3);color:hsl(var(--green))}.mesa-livre-body{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 14px;gap:8px}.mesa-livre-icon{font-size:28px;opacity:.3}.mesa-livre-text{font-size:11px;color:hsl(var(--text3));text-align:center}.mesa-open-btn{width:100%;padding:8px;border-radius:8px;border:1px dashed hsl(var(--fire)/.3);background:transparent;color:hsl(var(--fire2));font:700 12px Inter;cursor:pointer}.detail-panel{width:360px;flex-shrink:0;border-left:1px solid hsl(var(--line)/.07);background:hsl(var(--s1));display:flex;flex-direction:column;overflow:hidden;transition:width .2s}.detail-panel.closed{width:0;border-left:0}.dp-header{padding:14px 16px;border-bottom:1px solid hsl(var(--line)/.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}.dp-title{font-family:var(--mono);font-size:16px;font-weight:800;color:hsl(var(--fire2))}.dp-title-actions{display:flex;align-items:center;gap:8px}.dp-close,.modal-close{width:28px;height:28px;border-radius:8px;border:1px solid hsl(var(--line)/.07);background:transparent;color:hsl(var(--text3));cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}.dp-close:hover,.modal-close:hover{background:hsl(var(--s3));color:hsl(var(--text))}.dp-body{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}.dp-section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:hsl(var(--text3));margin-bottom:6px;display:flex;align-items:center;gap:6px}.dp-section-label:after{content:'';flex:1;height:1px;background:hsl(var(--line)/.07)}.info-box{background:hsl(var(--s2));border:1px solid hsl(var(--line)/.07);border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px}.info-muted{color:hsl(var(--text3));margin-bottom:2px}.amber-text{color:hsl(var(--amber))}.comanda-list{display:flex;flex-direction:column;gap:6px}.comanda-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:10px;background:hsl(var(--s2));border:1px solid hsl(var(--line)/.07)}.ci-qty{font:800 16px var(--mono);color:hsl(var(--fire2));min-width:24px;line-height:1.3}.ci-info{flex:1;min-width:0}.ci-name{font-size:13px;font-weight:800;color:hsl(var(--text));margin-bottom:2px}.ci-obs{font-size:11px;color:hsl(var(--amber));font-style:italic}.ci-status{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px}.ci-badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}.ci-price{font:500 12px var(--mono);color:hsl(var(--text3))}.b-novo{background:hsl(var(--blue)/.12);color:hsl(var(--blue));border:1px solid hsl(var(--blue)/.25)}.b-prod{background:hsl(var(--amber)/.12);color:hsl(var(--amber));border:1px solid hsl(var(--amber)/.25)}.b-pronto{background:hsl(var(--green)/.12);color:hsl(var(--green));border:1px solid hsl(var(--green)/.25)}.b-entregue{background:hsl(var(--line)/.05);color:hsl(var(--text3));border:1px solid hsl(var(--line)/.07)}.comanda-total-box{background:hsl(var(--s2));border:1px solid hsl(var(--line)/.07);border-radius:10px;padding:12px}.ct-row{display:flex;justify-content:space-between;font-size:12px;color:hsl(var(--text2));padding:3px 0}.ct-total{display:flex;justify-content:space-between;font-size:16px;font-weight:800;padding-top:10px;margin-top:6px;border-top:1px solid hsl(var(--line)/.07)}.ct-total-val{font-family:var(--mono)}.ct-total-val.fire{color:hsl(var(--fire2))}.ct-total-val.green{color:hsl(var(--green))}.dp-actions{padding:12px 14px;border-top:1px solid hsl(var(--line)/.07);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.dp-btn,.mf-btn{width:100%;padding:11px;border-radius:10px;border:1px solid hsl(var(--line)/.07);background:transparent;color:hsl(var(--text2));font:700 13px Inter;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}.dp-btn:hover,.mf-btn:hover:not(.primary){background:hsl(var(--s3));color:hsl(var(--text))}.dp-btn.primary,.mf-btn.primary{background:linear-gradient(135deg,hsl(var(--fire)),hsl(18 100% 39%));border:0;color:hsl(0 0% 100%);box-shadow:0 4px 16px hsl(var(--fire)/.3)}.mf-btn:disabled{opacity:.45;cursor:not-allowed}.dp-btn.success{background:hsl(var(--green)/.12);border-color:hsl(var(--green)/.3);color:hsl(var(--green))}.dp-btn.danger{background:hsl(var(--red)/.08);border-color:hsl(var(--red)/.25);color:hsl(var(--red))}.dp-btn-row{display:flex;gap:8px}.overlay{position:fixed;inset:0;z-index:1000;background:hsl(0 0% 0%/.75);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px}.modal{background:hsl(var(--s2));border:1px solid hsl(var(--line)/.12);border-radius:16px;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 80px hsl(0 0% 0%/.65)}.modal.wide{max-width:min(1120px,96vw);height:min(88vh,820px)}.modal-head{padding:16px 18px;border-bottom:1px solid hsl(var(--line)/.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}.modal-title{font-family:var(--mono);font-size:15px;font-weight:800;color:hsl(var(--fire2))}.modal-body{flex:1;overflow:hidden;padding:0;display:flex;flex-direction:column;gap:0}.modal-foot{padding:12px 16px;border-top:1px solid hsl(var(--line)/.07);display:flex;gap:8px;flex-shrink:0}.form-group{display:flex;flex-direction:column;gap:6px}.form-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:hsl(var(--text3))}.form-input{background:hsl(var(--s3));border:1.5px solid hsl(var(--line)/.07);border-radius:8px;color:hsl(var(--text));font:13px Inter;width:100%;padding:9px 12px;outline:0}.form-input:focus{border-color:hsl(var(--fire2))}.form-input::placeholder{color:hsl(var(--text3))}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.modal-divider{border-top:1px solid hsl(var(--line)/.07)}.prod-search-wrap{position:relative}.prod-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;color:hsl(var(--text3));z-index:1}.prod-search-input{padding-left:32px}.prod-results{background:hsl(var(--s3));border:1px solid hsl(var(--line)/.12);border-radius:10px;overflow:hidden;margin-top:6px}.prod-result-item{width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:0;border-bottom:1px solid hsl(var(--line)/.07);background:transparent;color:hsl(var(--text));cursor:pointer;text-align:left}.prod-result-item:hover{background:hsl(var(--s4))}.prod-result-item span{display:flex;flex-direction:column;gap:2px}.prod-result-item small{color:hsl(var(--text3));font-size:11px}.prod-result-item b{font:800 14px var(--mono);color:hsl(var(--fire2))}.modal-items{display:flex;flex-direction:column;gap:6px}.modal-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:hsl(var(--s3));border-radius:8px;border:1px solid hsl(var(--line)/.07)}.mi-qty-ctrl{display:flex;align-items:center;gap:6px}.mi-btn{width:24px;height:24px;border-radius:6px;border:1px solid hsl(var(--line)/.12);background:transparent;color:hsl(var(--text2));cursor:pointer}.mi-qty{font:800 13px var(--mono);min-width:18px;text-align:center}.mi-name{flex:1;font-size:13px;font-weight:700}.mi-price{font:700 13px var(--mono);color:hsl(var(--fire2))}.mi-del{width:22px;height:22px;border-radius:6px;border:0;background:hsl(var(--red)/.1);color:hsl(var(--red));cursor:pointer;flex-shrink:0}.mesa-order-root{display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:0;height:100%;overflow:hidden}.mesa-order-menu{display:flex;flex-direction:column;min-width:0;min-height:0}.mesa-order-fields{padding:14px 16px;border-bottom:1px solid hsl(var(--line)/.07);display:flex;flex-direction:column;gap:10px}.mesa-order-search{position:relative;padding:14px 16px 8px}.mesa-order-cats{display:flex;gap:8px;overflow-x:auto;padding:0 16px 12px;scrollbar-width:thin}.mesa-order-cat{border:1px solid hsl(var(--line)/.08);background:hsl(var(--s3));color:hsl(var(--text2));border-radius:999px;padding:8px 12px;font:800 12px Inter;white-space:nowrap;cursor:pointer}.mesa-order-cat span{margin-left:6px;color:hsl(var(--text3));font-family:var(--mono)}.mesa-order-cat.active{background:hsl(var(--fire)/.14);border-color:hsl(var(--fire)/.35);color:hsl(var(--fire2))}.mesa-order-products{flex:1;overflow-y:auto;padding:0 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;align-content:start}.mesa-order-section-title{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;color:hsl(var(--text));font-size:16px;font-weight:900;margin:4px 0}.mesa-order-section-title small{font-size:11px;color:hsl(var(--text3));font-weight:700}.mesa-product-card{display:flex;align-items:stretch;justify-content:space-between;gap:12px;min-height:118px;background:hsl(var(--s3));border:1px solid hsl(var(--line)/.08);border-radius:14px;padding:12px;color:hsl(var(--text));text-align:left;cursor:pointer;transition:all .16s}.mesa-product-card:hover{border-color:hsl(var(--fire)/.35);background:hsl(var(--s4));transform:translateY(-1px)}.mesa-product-info{min-width:0;display:flex;flex-direction:column;gap:5px;flex:1}.mesa-product-info strong{font-size:14px;line-height:1.2}.mesa-product-info span{font-size:11px;color:hsl(var(--text3));line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mesa-product-price{margin-top:auto}.mesa-product-price small{display:block;color:hsl(var(--text3));font-size:10px}.mesa-product-price b{font:900 16px var(--mono);color:hsl(var(--fire2))}.mesa-product-thumb{width:86px;min-width:86px;border-radius:12px;background:hsl(var(--s1));display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}.mesa-product-thumb img{width:100%;height:100%;object-fit:cover}.mesa-product-thumb span{font-size:30px}.mesa-product-thumb i{position:absolute;right:7px;bottom:7px;width:24px;height:24px;border-radius:50%;background:hsl(var(--fire));color:white;font-style:normal;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px hsl(var(--fire)/.35)}.mesa-order-cart{border-left:1px solid hsl(var(--line)/.07);background:hsl(var(--s1));display:flex;flex-direction:column;min-height:0}.mesa-cart-head{padding:16px;border-bottom:1px solid hsl(var(--line)/.07);display:flex;align-items:center;justify-content:space-between;gap:12px}.mesa-cart-head div{display:flex;flex-direction:column;gap:2px}.mesa-cart-head strong{font-size:16px}.mesa-cart-head span{font-size:11px;color:hsl(var(--text3))}.mesa-cart-head b{font:900 18px var(--mono);color:hsl(var(--fire2))}.mesa-cart-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}.mesa-cart-empty{height:100%;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:hsl(var(--text3));gap:10px}.mesa-cart-empty div{font-size:34px;opacity:.65}.mesa-cart-item{background:hsl(var(--s2));border:1px solid hsl(var(--line)/.07);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.mesa-cart-item-top,.mesa-cart-item-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px}.mesa-cart-item-top strong{font-size:13px;line-height:1.25}.mesa-cart-item small{font-size:11px;color:hsl(var(--amber));line-height:1.35}.mesa-cart-item-bottom b{font:900 13px var(--mono);color:hsl(var(--fire2))}.mesa-cart-foot{padding:14px 16px;border-top:1px solid hsl(var(--line)/.07);background:hsl(var(--s1))}.pag-methods{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pag-btn{padding:14px 10px;border-radius:10px;border:1.5px solid hsl(var(--line)/.07);background:transparent;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px}.pag-btn:hover{border-color:hsl(var(--line)/.12);background:hsl(var(--s3))}.pag-btn.active{border-color:hsl(var(--fire));background:hsl(var(--fire)/.1)}.pag-icon{font-size:22px}.pag-label{font-size:12px;font-weight:800;color:hsl(var(--text2))}.pag-btn.active .pag-label{color:hsl(var(--fire2))}.divisao-row{display:flex;align-items:center;gap:10px;color:hsl(var(--text2));font-size:12px}.div-input{width:68px;text-align:center;font-family:var(--mono)}.divisao-row strong{color:hsl(var(--fire2));font-family:var(--mono);font-size:13px}.pag-summary>.comanda-total-box{background:hsl(var(--s3))}.empty-section{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;border:1px dashed hsl(var(--line)/.07);border-radius:14px}.empty-icon{font-size:48px;opacity:.2}.empty-title{font-size:16px;font-weight:800;color:hsl(var(--text2))}.empty-sub,.empty-comanda{font-size:13px;color:hsl(var(--text3));text-align:center}.mesa-list{display:flex;flex-direction:column;gap:8px}.mesa-list-row{display:grid;grid-template-columns:1fr auto auto auto auto;gap:16px;align-items:center;background:hsl(var(--s1));border:1px solid hsl(var(--line)/.07);border-radius:10px;color:hsl(var(--text2));padding:12px;text-align:left;cursor:pointer}.mesa-list-main{font:800 15px var(--mono);color:hsl(var(--fire2))}@keyframes pop{0%{transform:scale(.8);opacity:0}80%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}.pop{animation:pop .3s cubic-bezier(.34,1.56,.64,1) both}.mesas-modelo-root ::-webkit-scrollbar{width:4px;height:4px}.mesas-modelo-root ::-webkit-scrollbar-track{background:transparent}.mesas-modelo-root ::-webkit-scrollbar-thumb{background:hsl(var(--s4));border-radius:2px}@media(max-width:900px){.mesas-toolbar{align-items:flex-start;flex-direction:column}.toolbar-right{width:100%;justify-content:flex-start}.toolbar-count{text-align:left}.mobile-stats-row{display:flex;overflow:auto}.mesas-content{position:relative}.detail-panel{position:absolute;right:0;top:0;bottom:0;width:min(360px,100%);z-index:20;box-shadow:-18px 0 40px hsl(0 0% 0%/.5)}.detail-panel.closed{width:0}.form-row{grid-template-columns:1fr}.pag-methods{grid-template-columns:repeat(2,1fr)}.mesa-list-row{grid-template-columns:1fr auto}.mesa-list-row span:nth-child(n+3),.mesa-list-row strong{display:none}.modal.wide{height:94vh}.mesa-order-root{grid-template-columns:1fr}.mesa-order-cart{border-left:0;border-top:1px solid hsl(var(--line)/.07);max-height:40vh}.mesa-order-products{grid-template-columns:1fr}.mesa-product-card{min-height:104px}.mesa-product-thumb{width:74px;min-width:74px}.modal-foot{padding-bottom:max(12px,env(safe-area-inset-bottom))}}`}</style>
  );
}



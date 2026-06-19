import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Pizza, DollarSign, ShoppingBag, TrendingUp, Bike, Store, 
  Smartphone, CreditCard, Clock, Package, Award, Loader2 
} from "lucide-react";

interface Props {
  companyId: string | null;
  period: string; // 'today' | 'week' | 'month' | 'all'
}

interface PedidoRow {
  id: string;
  status: string;
  status_pagamento?: string;
  canal?: string | null;
  tipo_atendimento?: string | null;
  forma_pagamento?: string | null;
  subtotal?: number;
  taxa_entrega?: number;
  desconto?: number;
  total: number;
  created_at: string;
}

interface ItemRow {
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  valor_total: number;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getStartDate(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

export function PizzariaAnalytics({ companyId, period }: Props) {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [itens, setItens] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!companyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, period]);

  const load = async () => {
    setLoading(true);
    try {
      const startDate = getStartDate(period);
      let q = supabase
        .from("pedidos" as any)
        .select("id, status, status_pagamento, canal, tipo_atendimento, forma_pagamento, subtotal, taxa_entrega, desconto, total, created_at")
        .eq("company_id", companyId);
      if (startDate) q = q.gte("created_at", startDate.toISOString());
      const { data: pData } = await q.order("created_at", { ascending: false });
      const peds = (pData || []) as unknown as PedidoRow[];
      setPedidos(peds);

      if (peds.length > 0) {
        const ids = peds.map((p) => p.id);
        const { data: iData } = await supabase
          .from("pedido_itens" as any)
          .select("pedido_id, produto_nome, quantidade, valor_total")
          .in("pedido_id", ids);
        setItens(((iData || []) as unknown) as ItemRow[]);
      } else {
        setItens([]);
      }
    } catch (e) {
      console.error("[PizzariaAnalytics] erro:", e);
      setPedidos([]);
      setItens([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const validos = pedidos.filter((p) => p.status !== "cancelado");
  const faturamento = validos.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalPedidos = validos.length;
  const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0;
  const cancelados = pedidos.filter((p) => p.status === "cancelado").length;
  const emAndamento = validos.filter((p) =>
    ["novo", "aceito", "em_producao", "pronto", "saiu_entrega"].includes(p.status)
  ).length;
  const entregues = validos.filter((p) => p.status === "entregue").length;

  // Por tipo de atendimento
  const porTipo: Record<string, { qtd: number; valor: number; label: string; icon: any }> = {
    entrega: { qtd: 0, valor: 0, label: "Delivery", icon: Bike },
    balcao: { qtd: 0, valor: 0, label: "Balcão / Retirada", icon: Store },
    mesa: { qtd: 0, valor: 0, label: "Consumo Local (Mesa)", icon: Pizza },
    outro: { qtd: 0, valor: 0, label: "Outros", icon: Package },
  };
  validos.forEach((p) => {
    const k = (p.tipo_atendimento || "outro").toLowerCase();
    const slot = porTipo[k] || porTipo.outro;
    slot.qtd += 1;
    slot.valor += Number(p.total || 0);
  });

  // Por canal
  const porCanal: Record<string, { qtd: number; valor: number }> = {};
  validos.forEach((p) => {
    const k = (p.canal || "PDV").toString();
    if (!porCanal[k]) porCanal[k] = { qtd: 0, valor: 0 };
    porCanal[k].qtd += 1;
    porCanal[k].valor += Number(p.total || 0);
  });

  // Forma de pagamento
  const porPagto: Record<string, { qtd: number; valor: number }> = {};
  validos.forEach((p) => {
    const k = (p.forma_pagamento || "—").toString();
    if (!porPagto[k]) porPagto[k] = { qtd: 0, valor: 0 };
    porPagto[k].qtd += 1;
    porPagto[k].valor += Number(p.total || 0);
  });

  // Top produtos
  const idsValidos = new Set(validos.map((p) => p.id));
  const itensValidos = itens.filter((i) => idsValidos.has(i.pedido_id));
  const produtoMap: Record<string, { qtd: number; valor: number }> = {};
  itensValidos.forEach((i) => {
    if (!produtoMap[i.produto_nome]) produtoMap[i.produto_nome] = { qtd: 0, valor: 0 };
    produtoMap[i.produto_nome].qtd += Number(i.quantidade || 0);
    produtoMap[i.produto_nome].valor += Number(i.valor_total || 0);
  });
  const topProdutos = Object.entries(produtoMap)
    .map(([nome, d]) => ({ nome, ...d }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 10);

  // Pedidos por hora (mapa de pico)
  const porHora: number[] = Array(24).fill(0);
  validos.forEach((p) => {
    const h = new Date(p.created_at).getHours();
    porHora[h] += 1;
  });
  const maxHora = Math.max(...porHora, 1);
  const horaPico = porHora.indexOf(Math.max(...porHora));

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Faturamento"
          value={fmtBRL(faturamento)}
          icon={DollarSign}
          subtitle={`${totalPedidos} pedidos válidos`}
        />
        <KpiCard
          title="Ticket Médio"
          value={fmtBRL(ticketMedio)}
          icon={TrendingUp}
          subtitle="Por pedido"
        />
        <KpiCard
          title="Pedidos em Andamento"
          value={String(emAndamento)}
          icon={Clock}
          subtitle="Novos, em produção, prontos"
        />
        <KpiCard
          title="Pedidos Entregues"
          value={String(entregues)}
          icon={ShoppingBag}
          subtitle={`${cancelados} cancelados`}
        />
      </div>

      {/* Por tipo de atendimento */}
      <Card className="border-white/10 bg-[#0d0d0f] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
              <Pizza className="h-5 w-5" />
            </span>
            Vendas por Tipo de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(porTipo)
              .filter(([k]) => k !== "outro" || porTipo.outro.qtd > 0)
              .map(([key, data]) => {
                const Icon = data.icon;
                const pct = totalPedidos > 0 ? (data.qtd / totalPedidos) * 100 : 0;
                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#171719] to-[#101012] p-5 space-y-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-500/35 hover:shadow-[0_16px_35px_rgba(0,0,0,0.25)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-medium text-foreground">{data.label}</span>
                      </div>
                      <Badge className="bg-orange-500/15 text-orange-200 border-orange-500/20">{pct.toFixed(0)}%</Badge>
                    </div>
                    <div className="text-3xl font-semibold text-foreground">{data.qtd}</div>
                    <div className="text-sm text-muted-foreground">{fmtBRL(data.valor)}</div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Canal e Pagamento */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-[#0d0d0f] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-orange-300" />
              Origem dos Pedidos (Canal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(porCanal).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido no período</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(porCanal)
                  .sort(([, a], [, b]) => b.qtd - a.qtd)
                  .map(([canal, d]) => {
                    const pct = totalPedidos > 0 ? (d.qtd / totalPedidos) * 100 : 0;
                    return (
                      <div key={canal} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium">{canal}</span>
                          <span className="text-muted-foreground">
                            {d.qtd} • {fmtBRL(d.valor)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-blue-400 transition-all"
                            style={{ width: `${Math.max(pct, 6)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0d0d0f] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-orange-300" />
              Formas de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(porPagto).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(porPagto)
                  .sort(([, a], [, b]) => b.valor - a.valor)
                  .map(([forma, d]) => {
                    const pct = faturamento > 0 ? (d.valor / faturamento) * 100 : 0;
                    return (
                      <div key={forma} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="uppercase font-medium">{forma}</span>
                          <span className="text-muted-foreground">
                            {d.qtd} • {fmtBRL(d.valor)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-orange-500 transition-all"
                            style={{ width: `${Math.max(pct, 6)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top produtos */}
      <Card className="border-white/10 bg-[#0d0d0f] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-orange-300" />
            Pizzas e Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProdutos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum item vendido no período
            </p>
          ) : (
            <div className="space-y-2">
              {topProdutos.map((p, idx) => (
                <div
                  key={p.nome}
                  className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-500/10 text-orange-300 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-foreground">{p.nome}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{p.qtd}x vendidos</span>
                    <span className="font-semibold text-orange-300">{fmtBRL(p.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Horário de pico */}
      <Card className="border-white/10 bg-[#0d0d0f] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-300" />
            Horários de Movimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalPedidos === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem pedidos no período
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Horário de pico: <strong>{horaPico}h</strong> com {porHora[horaPico]} pedidos
              </p>
              <div className="grid grid-cols-12 gap-1 items-end h-32">
                {porHora.map((q, h) => (
                  <div key={h} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-orange-500 to-emerald-400 rounded-t transition-all"
                      style={{ height: `${(q / maxHora) * 100}%`, minHeight: q > 0 ? "4px" : "0" }}
                      title={`${h}h: ${q} pedidos`}
                    />
                    <span className="text-[10px] text-muted-foreground">{h}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-[#0d0d0f] shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-orange-500/35 hover:shadow-[0_16px_35px_rgba(0,0,0,0.22)]">
      <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-emerald-400" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

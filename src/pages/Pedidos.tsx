import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2, Plus, Printer, Bike, CookingPot, MessageCircle, Instagram,
  ShoppingBag, Store, Utensils, Users, Trash2, CheckCircle2,
} from "lucide-react";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone: string;
  canal: string;
  tipo_atendimento: string;
  mesa_id: string | null;
  status: PedidoStatus;
  status_pagamento: string;
  forma_pagamento: string | null;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  total: number;
  observacoes: string | null;
  created_at: string;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  valor_total: number;
  observacoes: string | null;
};

type Mesa = {
  id: string;
  company_id: string;
  numero: string;
  nome: string | null;
  capacidade: number;
  status: "livre" | "ocupada" | "reservada" | "manutencao";
  localizacao: string | null;
  observacoes: string | null;
};

const STATUS_LABELS: Record<PedidoStatus, string> = {
  novo: "Novos",
  aceito: "Aceitos",
  em_producao: "Em Produção",
  pronto: "Prontos",
  saiu_entrega: "Saiu para Entrega",
  entregue: "Entregues",
  cancelado: "Cancelados",
};

const STATUS_FLOW: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto", "saiu_entrega", "entregue"];

const CANAL_INFO: Record<string, { label: string; icon: any; color: string }> = {
  cardapio: { label: "Cardápio Digital", icon: ShoppingBag, color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "bg-green-500/10 text-green-700 border-green-300" },
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-500/10 text-pink-700 border-pink-300" },
  atendimento: { label: "Atendimento Chat", icon: MessageCircle, color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  interno: { label: "Manual / Balcão", icon: Store, color: "bg-orange-500/10 text-orange-700 border-orange-300" },
};

export default function Pedidos() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mesaDialogOpen, setMesaDialogOpen] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    tipo_atendimento: "entrega",
    forma_pagamento: "pix",
    observacoes: "",
    produto_id: "",
    quantidade: "1",
  });

  const [mesaForm, setMesaForm] = useState({
    numero: "",
    nome: "",
    capacidade: "4",
    localizacao: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;

      const [pedidosRes, itensRes, produtosRes, mesasRes] = await Promise.all([
        (supabase.from("pedidos" as any) as any).select("*").eq("company_id", cid).order("created_at", { ascending: false }),
        (supabase.from("pedido_itens" as any) as any).select("*").eq("company_id", cid),
        (supabase.from("produtos_servicos") as any).select("id, nome, preco_sugerido").eq("company_id", cid).eq("ativo", true),
        (supabase.from("mesas" as any) as any).select("*").eq("company_id", cid).order("numero"),
      ]);

      if (pedidosRes.error) throw pedidosRes.error;
      if (itensRes.error) throw itensRes.error;
      if (produtosRes.error) throw produtosRes.error;
      if (mesasRes.error) throw mesasRes.error;

      setPedidos((pedidosRes.data || []) as Pedido[]);
      setItens((itensRes.data || []) as PedidoItem[]);
      setProdutos((produtosRes.data || []) as any);
      setMesas((mesasRes.data || []) as Mesa[]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`pedidos-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas", filter: `company_id=eq.${companyId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, load]);

  // Filtra pedidos: apenas delivery/balcão/retirada (não-mesa) na aba principal
  const pedidosNaoMesa = useMemo(
    () => pedidos.filter((p) => p.tipo_atendimento !== "mesa" && (filtroCanal === "todos" || p.canal === filtroCanal)),
    [pedidos, filtroCanal]
  );

  const grouped = useMemo(() => {
    return STATUS_FLOW.reduce((acc, status) => {
      acc[status] = pedidosNaoMesa.filter((p) => p.status === status);
      return acc;
    }, {} as Record<PedidoStatus, Pedido[]>);
  }, [pedidosNaoMesa]);

  const getItems = (pedidoId: string) => itens.filter((i) => i.pedido_id === pedidoId);

  // Pedidos abertos por mesa
  const pedidosPorMesa = useMemo(() => {
    const map: Record<string, Pedido[]> = {};
    pedidos.forEach((p) => {
      if (p.mesa_id && p.status !== "entregue" && p.status !== "cancelado") {
        if (!map[p.mesa_id]) map[p.mesa_id] = [];
        map[p.mesa_id].push(p);
      }
    });
    return map;
  }, [pedidos]);

  const totalMesa = (mesaId: string) =>
    (pedidosPorMesa[mesaId] || []).reduce((s, p) => s + Number(p.total || 0), 0);

  const advanceStatus = async (pedido: Pedido) => {
    const idx = STATUS_FLOW.indexOf(pedido.status);
    const nextStatus = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    if (nextStatus === pedido.status) return;
    try {
      const { error } = await supabase.from("pedidos" as any).update({ status: nextStatus }).eq("id", pedido.id);
      if (error) throw error;
      await supabase.from("pedido_eventos" as any).insert({
        company_id: pedido.company_id,
        pedido_id: pedido.id,
        status: nextStatus,
        descricao: `Status alterado para ${STATUS_LABELS[nextStatus]}`,
      });
      toast.success(`Pedido movido para ${STATUS_LABELS[nextStatus]}`);
      await load();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const cancelOrder = async (pedido: Pedido) => {
    try {
      const { error } = await supabase.from("pedidos" as any).update({ status: "cancelado" }).eq("id", pedido.id);
      if (error) throw error;
      await load();
    } catch {
      toast.error("Erro ao cancelar pedido");
    }
  };

  const printOrder = async (pedidoId: string) => {
    try {
      const { error } = await supabase.functions.invoke("print-pedido", { body: { pedidoId } });
      if (error) throw error;
      toast.success("Pedido enviado para impressão");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar impressão");
    }
  };

  const createPedido = async () => {
    if (!companyId) return;
    const produto = produtos.find((p) => p.id === form.produto_id);
    if (!produto || !form.cliente_nome.trim() || !form.cliente_telefone.trim()) {
      toast.error("Preencha cliente, telefone e produto");
      return;
    }

    setSaving(true);
    try {
      const quantidade = Number(form.quantidade || 1);
      const subtotal = Number(produto.preco_sugerido || 0) * quantidade;

      const { data: pedido, error } = await (supabase.from("pedidos" as any) as any)
        .insert({
          company_id: companyId,
          cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone.trim(),
          canal: "interno",
          tipo_atendimento: form.tipo_atendimento,
          forma_pagamento: form.forma_pagamento,
          subtotal,
          total: subtotal,
          observacoes: form.observacoes.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      const pedidoData = pedido as any;

      await (supabase.from("pedido_itens" as any) as any).insert({
        pedido_id: pedidoData.id,
        company_id: companyId,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade,
        valor_unitario: Number(produto.preco_sugerido || 0),
        valor_total: subtotal,
      });

      await (supabase.from("pedido_eventos" as any) as any).insert({
        company_id: companyId,
        pedido_id: pedidoData.id,
        status: "novo",
        descricao: "Pedido criado manualmente no painel",
      });

      toast.success("Pedido criado");
      setDialogOpen(false);
      setForm({ cliente_nome: "", cliente_telefone: "", tipo_atendimento: "entrega", forma_pagamento: "pix", observacoes: "", produto_id: "", quantidade: "1" });
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar pedido");
    } finally {
      setSaving(false);
    }
  };

  // ========= MESAS =========
  const createMesa = async () => {
    if (!companyId) return;
    if (!mesaForm.numero.trim()) return toast.error("Informe o número da mesa");
    setSaving(true);
    try {
      const { error } = await (supabase.from("mesas" as any) as any).insert({
        company_id: companyId,
        numero: mesaForm.numero.trim(),
        nome: mesaForm.nome.trim() || null,
        capacidade: Number(mesaForm.capacidade) || 4,
        localizacao: mesaForm.localizacao.trim() || null,
      });
      if (error) throw error;
      toast.success("Mesa cadastrada");
      setMesaDialogOpen(false);
      setMesaForm({ numero: "", nome: "", capacidade: "4", localizacao: "" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar mesa");
    } finally {
      setSaving(false);
    }
  };

  const toggleMesaStatus = async (mesa: Mesa, novoStatus: Mesa["status"]) => {
    try {
      const { error } = await (supabase.from("mesas" as any) as any).update({ status: novoStatus }).eq("id", mesa.id);
      if (error) throw error;
      toast.success(`Mesa ${mesa.numero} ${novoStatus === "livre" ? "liberada" : "atualizada"}`);
      await load();
    } catch {
      toast.error("Erro ao atualizar mesa");
    }
  };

  const fecharContaMesa = async (mesa: Mesa) => {
    const pedidosAbertos = pedidosPorMesa[mesa.id] || [];
    if (!pedidosAbertos.length) {
      await toggleMesaStatus(mesa, "livre");
      return;
    }
    try {
      for (const p of pedidosAbertos) {
        await supabase.from("pedidos" as any).update({ status: "entregue", status_pagamento: "pago" }).eq("id", p.id);
      }
      await toggleMesaStatus(mesa, "livre");
      toast.success(`Conta fechada — Mesa ${mesa.numero}`);
      await load();
    } catch {
      toast.error("Erro ao fechar conta");
    }
  };

  const deleteMesa = async (mesa: Mesa) => {
    if (!confirm(`Excluir a mesa ${mesa.numero}?`)) return;
    try {
      const { error } = await (supabase.from("mesas" as any) as any).delete().eq("id", mesa.id);
      if (error) throw error;
      toast.success("Mesa excluída");
      await load();
    } catch {
      toast.error("Erro ao excluir mesa");
    }
  };

  // ========== UI ==========
  const renderCanalBadge = (canal: string) => {
    const info = CANAL_INFO[canal] || CANAL_INFO.interno;
    const Icon = info.icon;
    return (
      <Badge variant="outline" className={`${info.color} text-xs gap-1`}>
        <Icon className="h-3 w-3" />
        {info.label}
      </Badge>
    );
  };

  const mesaStatusColor: Record<Mesa["status"], string> = {
    livre: "border-green-500 bg-green-500/5",
    ocupada: "border-orange-500 bg-orange-500/10",
    reservada: "border-blue-500 bg-blue-500/5",
    manutencao: "border-muted bg-muted/30",
  };

  const mesaStatusLabel: Record<Mesa["status"], string> = {
    livre: "Livre",
    ocupada: "Ocupada",
    reservada: "Reservada",
    manutencao: "Manutenção",
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Pedidos</h1>
          <p className="text-muted-foreground">
            Pedidos do cardápio digital, WhatsApp, Instagram e mesas — tudo em um único painel.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pedidos" className="gap-2">
            <Bike className="h-4 w-4" /> Delivery / Balcão
          </TabsTrigger>
          <TabsTrigger value="mesas" className="gap-2">
            <Utensils className="h-4 w-4" /> Mesas
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA: DELIVERY / BALCÃO ============ */}
        <TabsContent value="pedidos" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {["todos", "cardapio", "whatsapp", "instagram", "atendimento", "interno"].map((c) => (
                <Badge
                  key={c}
                  variant={filtroCanal === c ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => setFiltroCanal(c)}
                >
                  {c === "todos" ? "Todos os canais" : CANAL_INFO[c]?.label || c}
                </Badge>
              ))}
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Pedido
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar pedido manual</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Cliente</Label><Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input value={form.cliente_telefone} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Atendimento</Label>
                      <Select value={form.tipo_atendimento} onValueChange={(v) => setForm({ ...form, tipo_atendimento: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrega">Entrega</SelectItem>
                          <SelectItem value="retirada">Retirada</SelectItem>
                          <SelectItem value="balcao">Balcão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pagamento</Label>
                      <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Produto</Label>
                      <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Quantidade</Label><Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={createPedido} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {STATUS_FLOW.map((status) => (
              <Card key={status} className="min-h-[320px]">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{STATUS_LABELS[status]}</span>
                    <Badge>{grouped[status]?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[480px]">
                    <div className="space-y-3 pr-4">
                      {(grouped[status] || []).map((pedido) => (
                        <Card key={pedido.id} className="border-dashed">
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold">{pedido.codigo_pedido}</div>
                                <div className="text-sm text-muted-foreground">{pedido.cliente_nome}</div>
                              </div>
                              <Badge variant="outline">{pedido.tipo_atendimento}</Badge>
                            </div>

                            {renderCanalBadge(pedido.canal)}

                            <div className="text-sm text-muted-foreground">{pedido.cliente_telefone}</div>
                            <div className="space-y-1">
                              {getItems(pedido.id).map((item) => (
                                <div key={item.id} className="text-sm flex justify-between gap-2">
                                  <span>{item.quantidade}x {item.produto_nome}</span>
                                  <span>{Number(item.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                </div>
                              ))}
                            </div>

                            {pedido.observacoes && (
                              <div className="text-xs rounded-md bg-muted p-2">{pedido.observacoes}</div>
                            )}

                            <div className="text-sm font-semibold">
                              Total: {Number(pedido.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {pedido.status !== "entregue" && pedido.status !== "cancelado" && (
                                <Button size="sm" onClick={() => advanceStatus(pedido)}>
                                  {pedido.status === "pronto" ? <Bike className="h-4 w-4 mr-1" /> : <CookingPot className="h-4 w-4 mr-1" />}
                                  Avançar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => printOrder(pedido.id)}>
                                <Printer className="h-4 w-4 mr-1" />
                                Imprimir
                              </Button>
                              {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
                                <Button size="sm" variant="destructive" onClick={() => cancelOrder(pedido)}>
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============ ABA: MESAS ============ */}
        <TabsContent value="mesas" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3 text-sm">
              <Badge variant="outline" className="border-green-500 bg-green-500/5">
                Livres: {mesas.filter((m) => m.status === "livre").length}
              </Badge>
              <Badge variant="outline" className="border-orange-500 bg-orange-500/10">
                Ocupadas: {mesas.filter((m) => m.status === "ocupada").length}
              </Badge>
              <Badge variant="outline" className="border-blue-500 bg-blue-500/5">
                Reservadas: {mesas.filter((m) => m.status === "reservada").length}
              </Badge>
            </div>
            <Dialog open={mesaDialogOpen} onOpenChange={setMesaDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar Mesa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Mesa</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Número da mesa *</Label>
                    <Input value={mesaForm.numero} onChange={(e) => setMesaForm({ ...mesaForm, numero: e.target.value })} placeholder="Ex: 01, 02, VIP-1..." />
                  </div>
                  <div className="space-y-1">
                    <Label>Nome (opcional)</Label>
                    <Input value={mesaForm.nome} onChange={(e) => setMesaForm({ ...mesaForm, nome: e.target.value })} placeholder="Ex: Mesa da janela" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Capacidade</Label>
                      <Input type="number" value={mesaForm.capacidade} onChange={(e) => setMesaForm({ ...mesaForm, capacidade: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Localização</Label>
                      <Input value={mesaForm.localizacao} onChange={(e) => setMesaForm({ ...mesaForm, localizacao: e.target.value })} placeholder="Salão / Varanda..." />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setMesaDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={createMesa} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Cadastrar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {mesas.length === 0 ? (
            <Card className="p-12 text-center">
              <Utensils className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-1">Nenhuma mesa cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cadastre as mesas do seu estabelecimento para começar a gerenciar pedidos no salão.
              </p>
              <Button onClick={() => setMesaDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar primeira mesa
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {mesas.map((mesa) => {
                const pedidosMesa = pedidosPorMesa[mesa.id] || [];
                const total = totalMesa(mesa.id);
                const status = pedidosMesa.length > 0 ? "ocupada" : mesa.status;
                return (
                  <Card key={mesa.id} className={`border-2 ${mesaStatusColor[status]} transition`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Mesa {mesa.numero}</CardTitle>
                          {mesa.nome && <p className="text-xs text-muted-foreground">{mesa.nome}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {mesaStatusLabel[status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {mesa.capacidade}</span>
                        {mesa.localizacao && <span>📍 {mesa.localizacao}</span>}
                      </div>

                      {pedidosMesa.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">
                            {pedidosMesa.length} pedido(s) aberto(s)
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {pedidosMesa.map((p) => (
                              <div key={p.id} className="text-xs bg-background/60 rounded p-2">
                                <div className="font-medium">{p.codigo_pedido}</div>
                                {getItems(p.id).slice(0, 3).map((it) => (
                                  <div key={it.id} className="text-muted-foreground">
                                    {it.quantidade}x {it.produto_nome}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          <div className="border-t pt-2 flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Total da conta</span>
                            <span className="font-bold text-primary">
                              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                          <Button size="sm" className="w-full" onClick={() => fecharContaMesa(mesa)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Fechar Conta
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-center text-muted-foreground py-2">
                            Sem pedidos abertos
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {mesa.status !== "livre" && (
                              <Button size="sm" variant="outline" onClick={() => toggleMesaStatus(mesa, "livre")}>
                                Liberar
                              </Button>
                            )}
                            {mesa.status !== "reservada" && (
                              <Button size="sm" variant="outline" onClick={() => toggleMesaStatus(mesa, "reservada")}>
                                Reservar
                              </Button>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => deleteMesa(mesa)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Excluir mesa
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

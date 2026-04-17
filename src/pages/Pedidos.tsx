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
import { toast } from "sonner";
import { Loader2, Plus, Printer, Bike, CookingPot } from "lucide-react";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone: string;
  canal: string;
  tipo_atendimento: string;
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

export default function Pedidos() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    tipo_atendimento: "entrega",
    forma_pagamento: "pix",
    observacoes: "",
    produto_id: "",
    quantidade: "1",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;

      const [pedidosRes, itensRes, produtosRes] = await Promise.all([
        (supabase.from("pedidos" as any) as any).select("*").eq("company_id", cid).order("created_at", { ascending: false }),
        (supabase.from("pedido_itens" as any) as any).select("*").eq("company_id", cid),
        (supabase.from("produtos_servicos") as any).select("id, nome, preco_sugerido").eq("company_id", cid).eq("ativo", true),
      ]);

      if (pedidosRes.error) throw pedidosRes.error;
      if (itensRes.error) throw itensRes.error;
      if (produtosRes.error) throw produtosRes.error;

      setPedidos((pedidosRes.data || []) as Pedido[]);
      setItens((itensRes.data || []) as PedidoItem[]);
      setProdutos((produtosRes.data || []) as any);
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

  const grouped = useMemo(() => {
    return STATUS_FLOW.reduce((acc, status) => {
      acc[status] = pedidos.filter((p) => p.status === status);
      return acc;
    }, {} as Record<PedidoStatus, Pedido[]>);
  }, [pedidos]);

  const getItems = (pedidoId: string) => itens.filter((i) => i.pedido_id === pedidoId);

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

      const { data: pedido, error } = await (supabase
        .from("pedidos" as any) as any)
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

      const { error: itemError } = await (supabase.from("pedido_itens" as any) as any).insert({
        pedido_id: pedidoData.id,
        company_id: companyId,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade,
        valor_unitario: Number(produto.preco_sugerido || 0),
        valor_total: subtotal,
      });
      if (itemError) throw itemError;

      await (supabase.from("pedido_eventos" as any) as any).insert({
        company_id: companyId,
        pedido_id: pedidoData.id,
        status: "novo",
        descricao: "Pedido criado manualmente no painel",
      });

      toast.success("Pedido criado");
      setDialogOpen(false);
      setForm({
        cliente_nome: "",
        cliente_telefone: "",
        tipo_atendimento: "entrega",
        forma_pagamento: "pix",
        observacoes: "",
        produto_id: "",
        quantidade: "1",
      });
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Pedidos</h1>
          <p className="text-muted-foreground">Acompanhe pedidos da pizzaria em tempo real por status operacional.</p>
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

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
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
      )}
    </div>
  );
}

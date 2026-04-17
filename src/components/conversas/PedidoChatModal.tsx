import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Minus, ShoppingCart, Search, Pizza, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  nome: string;
  descricao_curta?: string | null;
  descricao?: string | null;
  preco_sugerido: number;
  categoria?: string | null;
  imagem_url?: string | null;
  destaque_cardapio?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
  observations: string;
};

interface PedidoChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  leadId?: string | null;
  clienteNome: string;
  clienteTelefone: string;
}

export function PedidoChatModal({
  open,
  onOpenChange,
  companyId,
  leadId,
  clienteNome,
  clienteTelefone,
}: PedidoChatModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [step, setStep] = useState<"cardapio" | "checkout">("cardapio");

  const [customer, setCustomer] = useState({
    nome: clienteNome || "",
    telefone: clienteTelefone || "",
    tipo_atendimento: "entrega",
    forma_pagamento: "pix",
    observacoes: "",
    endereco: "",
    endereco_numero: "",
    endereco_complemento: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
    endereco_cep: "",
    troco_para: "",
  });
  const [enderecoSalvo, setEnderecoSalvo] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomer((prev) => ({
        ...prev,
        nome: clienteNome || prev.nome,
        telefone: clienteTelefone || prev.telefone,
      }));
      loadData();
    } else {
      setCart([]);
      setStep("cardapio");
      setSearch("");
      setActiveCategory("Todos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, cfgRes, leadRes] = await Promise.all([
        (supabase
          .from("produtos_servicos") as any)
          .select("id, nome, descricao, preco_sugerido, categoria")
          .eq("company_id", companyId)
          .eq("ativo", true)
          .order("categoria")
          .order("nome"),
        (supabase
          .from("loja_configuracoes" as any) as any)
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle(),
        leadId
          ? (supabase.from("leads") as any)
              .select("endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
              .eq("id", leadId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (prodRes.error) throw prodRes.error;
      setProducts((prodRes.data || []) as Product[]);
      setStoreConfig(cfgRes.data || {});

      const leadEnd = leadRes?.data;
      if (leadEnd && leadEnd.endereco_logradouro) {
        setCustomer((prev) => ({
          ...prev,
          endereco: leadEnd.endereco_logradouro || "",
          endereco_numero: leadEnd.endereco_numero || "",
          endereco_complemento: leadEnd.endereco_complemento || "",
          endereco_bairro: leadEnd.endereco_bairro || "",
          endereco_cidade: leadEnd.endereco_cidade || "",
          endereco_estado: leadEnd.endereco_estado || "",
          endereco_cep: leadEnd.endereco_cep || "",
        }));
        setEnderecoSalvo(true);
      } else {
        setEnderecoSalvo(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.categoria || "Geral")));
    return ["Todos", ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = activeCategory === "Todos" || (p.categoria || "Geral") === activeCategory;
      const matchSearch = !term || p.nome.toLowerCase().includes(term) || (p.descricao_curta || "").toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [products, search, activeCategory]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + Number(i.product.preco_sugerido || 0) * i.quantity, 0),
    [cart]
  );
  const deliveryFee = customer.tipo_atendimento === "entrega" ? Number(storeConfig?.taxa_entrega || 0) : 0;
  const total = subtotal + deliveryFee;

  const addProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && !i.observations);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1, observations: "" }];
    });
    toast.success(`${product.nome} adicionado`);
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i, k) => (k === idx ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const updateObs = (idx: number, obs: string) => {
    setCart((prev) => prev.map((i, k) => (k === idx ? { ...i, observations: obs } : i)));
  };

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, k) => k !== idx));

  const submitOrder = async () => {
    if (!cart.length) return toast.error("Adicione itens ao pedido");
    if (!customer.nome.trim() || !customer.telefone.trim()) return toast.error("Informe nome e telefone");
    if (customer.tipo_atendimento === "entrega" && !customer.endereco.trim())
      return toast.error("Informe o endereço de entrega");

    const minimo = Number(storeConfig?.pedido_minimo || 0);
    if (total < minimo) return toast.error(`Pedido abaixo do mínimo (${minimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`);

    setSubmitting(true);
    try {
      const obsCompleta = [
        customer.observacoes,
        customer.forma_pagamento === "dinheiro" && customer.troco_para
          ? `Troco para ${Number(customer.troco_para).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const { data: pedido, error: pErr } = await supabase
        .from("pedidos" as any)
        .insert({
          company_id: companyId,
          lead_id: leadId || null,
          cliente_nome: customer.nome.trim(),
          cliente_telefone: customer.telefone.trim(),
          canal: "atendimento",
          tipo_atendimento: customer.tipo_atendimento,
          forma_pagamento: customer.forma_pagamento,
          status: "aceito",
          subtotal,
          taxa_entrega: deliveryFee,
          total,
          observacoes: obsCompleta || null,
          origem_publica: { origem: "chat-conversa", endereco: customer.endereco || null },
        })
        .select("*")
        .single();

      if (pErr) throw pErr;
      const pedidoData = pedido as any;

      const itensPayload = cart.map((i) => ({
        pedido_id: pedidoData.id,
        company_id: companyId,
        produto_id: i.product.id,
        produto_nome: i.product.nome,
        quantidade: i.quantity,
        valor_unitario: Number(i.product.preco_sugerido || 0),
        valor_total: Number(i.product.preco_sugerido || 0) * i.quantity,
        observacoes: i.observations || null,
      }));

      const { error: iErr } = await supabase.from("pedido_itens" as any).insert(itensPayload);
      if (iErr) throw iErr;

      if (customer.endereco && customer.tipo_atendimento === "entrega") {
        await supabase.from("pedido_enderecos" as any).insert({
          pedido_id: pedidoData.id,
          company_id: companyId,
          nome_contato: customer.nome.trim(),
          telefone_contato: customer.telefone.trim(),
          logradouro: customer.endereco,
          numero: customer.endereco_numero || null,
          complemento: customer.endereco_complemento || null,
          bairro: customer.endereco_bairro || null,
          cidade: customer.endereco_cidade || null,
          estado: customer.endereco_estado || null,
          cep: customer.endereco_cep || null,
        });

        // Salvar/atualizar endereço no contato (lead) para próximos pedidos
        if (leadId) {
          await (supabase.from("leads") as any)
            .update({
              endereco_logradouro: customer.endereco,
              endereco_numero: customer.endereco_numero || null,
              endereco_complemento: customer.endereco_complemento || null,
              endereco_bairro: customer.endereco_bairro || null,
              endereco_cidade: customer.endereco_cidade || null,
              endereco_estado: customer.endereco_estado || null,
              endereco_cep: customer.endereco_cep || null,
            })
            .eq("id", leadId);
        }
      }

      await supabase.from("pedido_eventos" as any).insert({
        pedido_id: pedidoData.id,
        company_id: companyId,
        status: "aceito",
        descricao: "Pedido criado pelo atendente via chat",
      });

      toast.success(`Pedido ${pedidoData.codigo_pedido || ""} criado e enviado para Gestão de Pedidos!`);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pizza className="h-5 w-5 text-primary" />
            Novo Pedido — {clienteNome || "Cliente"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : step === "cardapio" ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
            {/* Cardápio */}
            <div className="md:col-span-2 flex flex-col border-r overflow-hidden">
              <div className="p-4 space-y-3 border-b bg-muted/30">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pizza, bebida, produto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={activeCategory === cat ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-12">
                      Nenhum produto encontrado.
                    </div>
                  )}
                  {filteredProducts.map((p) => (
                    <Card key={p.id} className="overflow-hidden hover:shadow-md transition">
                      <div className="flex">
                        {p.imagem_url ? (
                          <img src={p.imagem_url} alt={p.nome} className="h-24 w-24 object-cover" />
                        ) : (
                          <div className="h-24 w-24 bg-muted flex items-center justify-center">
                            <Pizza className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <CardContent className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-semibold text-sm leading-tight">{p.nome}</div>
                            {p.descricao_curta && (
                              <div className="text-xs text-muted-foreground line-clamp-2">{p.descricao_curta}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="font-bold text-primary text-sm">
                              {Number(p.preco_sugerido || 0).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </div>
                            <Button size="sm" onClick={() => addProduct(p)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Carrinho */}
            <div className="flex flex-col bg-muted/20 overflow-hidden">
              <div className="p-4 border-b font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Carrinho ({cart.reduce((s, i) => s + i.quantity, 0)})
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {cart.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Carrinho vazio.<br />Adicione itens do cardápio.
                    </div>
                  )}
                  {cart.map((item, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium leading-tight">{item.product.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {Number(item.product.preco_sugerido || 0).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Obs: sem cebola..."
                          value={item.observations}
                          onChange={(e) => updateObs(idx, e.target.value)}
                          className="h-7 text-xs"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-sm font-semibold">
                            {(Number(item.product.preco_sugerido || 0) * item.quantity).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-background space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">
                    {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <Button className="w-full" disabled={!cart.length} onClick={() => setStep("checkout")}>
                  Continuar →
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Checkout
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-4 max-w-2xl mx-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome do cliente</Label>
                    <Input value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input
                      value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo de atendimento</Label>
                    <Select
                      value={customer.tipo_atendimento}
                      onValueChange={(v) => setCustomer({ ...customer, tipo_atendimento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrega">🛵 Delivery</SelectItem>
                        <SelectItem value="retirada">🏃 Retirada no balcão</SelectItem>
                        <SelectItem value="mesa">🍽️ Mesa / Local</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Forma de pagamento</Label>
                    <Select
                      value={customer.forma_pagamento}
                      onValueChange={(v) => setCustomer({ ...customer, forma_pagamento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {customer.forma_pagamento === "dinheiro" && (
                  <div className="space-y-1">
                    <Label>Troco para (opcional)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 100"
                      value={customer.troco_para}
                      onChange={(e) => setCustomer({ ...customer, troco_para: e.target.value })}
                    />
                  </div>
                )}

                {customer.tipo_atendimento === "entrega" && (
                  <div className="space-y-3 p-3 rounded-md border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">📍 Endereço de entrega</Label>
                      {enderecoSalvo && (
                        <Badge variant="secondary" className="text-xs">Endereço salvo do cliente</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Rua / Logradouro</Label>
                        <Input
                          placeholder="Av. Brasil"
                          value={customer.endereco}
                          onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Número</Label>
                        <Input
                          placeholder="123"
                          value={customer.endereco_numero}
                          onChange={(e) => setCustomer({ ...customer, endereco_numero: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Bairro</Label>
                        <Input
                          placeholder="Centro"
                          value={customer.endereco_bairro}
                          onChange={(e) => setCustomer({ ...customer, endereco_bairro: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Complemento / Referência</Label>
                        <Input
                          placeholder="Apto 12, próximo ao mercado"
                          value={customer.endereco_complemento}
                          onChange={(e) => setCustomer({ ...customer, endereco_complemento: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          placeholder="São Paulo"
                          value={customer.endereco_cidade}
                          onChange={(e) => setCustomer({ ...customer, endereco_cidade: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">UF</Label>
                        <Input
                          placeholder="SP"
                          maxLength={2}
                          value={customer.endereco_estado}
                          onChange={(e) => setCustomer({ ...customer, endereco_estado: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CEP</Label>
                        <Input
                          placeholder="00000-000"
                          value={customer.endereco_cep}
                          onChange={(e) => setCustomer({ ...customer, endereco_cep: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Observações do pedido</Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex: tirar a cebola da pizza, entregar até as 20h..."
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
                  />
                </div>

                <Card className="bg-muted/40">
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-semibold mb-2">Resumo do pedido</div>
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.product.nome}
                        </span>
                        <span>
                          {(Number(item.product.preco_sugerido || 0) * item.quantity).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Taxa de entrega</span>
                        <span>{deliveryFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base text-primary">
                        <span>TOTAL</span>
                        <span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-background flex gap-2">
              <Button variant="outline" onClick={() => setStep("cardapio")} className="flex-1">
                ← Voltar ao cardápio
              </Button>
              <Button onClick={submitOrder} disabled={submitting} className="flex-1">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar pedido
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

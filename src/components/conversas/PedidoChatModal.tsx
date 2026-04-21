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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Minus, ShoppingCart, Search, Pizza, Trash2, X, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  nome: string;
  descricao_curta?: string | null;
  descricao_completa?: string | null;
  descricao?: string | null;
  preco_sugerido: number;
  categoria?: string | null;
  imagem_url?: string | null;
  destaque_cardapio?: boolean;
  permite_meio_a_meio?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
  observations: string;
};

type PizzaSize = {
  id: string;
  nome: string;
  slug: string;
  multiplicador: number;
  max_sabores: number;
  fatias: number;
  descricao?: string | null;
};

type PizzaBorda = { id: string; nome: string; descricao?: string | null; ordem?: number };
type PizzaBordaPreco = { borda_id: string; tamanho_id: string; preco: number };

interface PedidoChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  leadId?: string | null;
  clienteNome: string;
  clienteTelefone: string;
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_SIZES: Array<{ id: string; tamanhoId: string; label: string; multiplier: number; maxFlavors: number; slices: number; descricao: string }> = [
  { id: "brotinho", tamanhoId: "", label: "Brotinho", multiplier: 0.625, maxFlavors: 1, slices: 1, descricao: "Pizza com 1 sabor" },
  { id: "pequena", tamanhoId: "", label: "Pequena", multiplier: 1, maxFlavors: 2, slices: 4, descricao: "Pizza com até 2 sabores" },
  { id: "media", tamanhoId: "", label: "Média", multiplier: 1.343, maxFlavors: 2, slices: 6, descricao: "Pizza com até 2 sabores" },
  { id: "grande", tamanhoId: "", label: "Grande", multiplier: 1.5, maxFlavors: 3, slices: 8, descricao: "Pizza com até 3 sabores" },
  { id: "gigante", tamanhoId: "", label: "Gigante", multiplier: 1.875, maxFlavors: 3, slices: 12, descricao: "Pizza com até 3 sabores" },
];

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
  const [pizzaSizes, setPizzaSizes] = useState<PizzaSize[]>([]);
  const [pizzaBordas, setPizzaBordas] = useState<PizzaBorda[]>([]);
  const [pizzaBordaPrecos, setPizzaBordaPrecos] = useState<PizzaBordaPreco[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [step, setStep] = useState<"cardapio" | "checkout">("cardapio");

  // Pizza configurator
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [selectedBordaId, setSelectedBordaId] = useState<string>("");
  const [openFlavorPicker, setOpenFlavorPicker] = useState<number | null>(null);

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
      resetSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetSelection = () => {
    setSelectedProduct(null);
    setSelectedObs("");
    setSelectedQty(1);
    setSelectedSize("");
    setExtraFlavors([]);
    setSelectedBordaId("");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, cfgRes, leadRes, sizesRes, bordasRes] = await Promise.all([
        (supabase.from("produtos_servicos") as any)
          .select("id, nome, descricao, preco_sugerido, categoria, imagem_url, destaque_cardapio, permite_meio_a_meio")
          .eq("company_id", companyId)
          .eq("ativo", true)
          .order("categoria")
          .order("nome"),
        (supabase.from("loja_configuracoes" as any) as any)
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle(),
        leadId
          ? (supabase.from("leads") as any)
              .select("endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
              .eq("id", leadId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        (supabase.from("pizza_tamanhos" as any) as any)
          .select("id, nome, slug, multiplicador, max_sabores, fatias, descricao, ordem")
          .eq("company_id", companyId)
          .eq("ativo", true)
          .order("ordem"),
        (supabase.from("pizza_bordas" as any) as any)
          .select("id, nome, descricao, ordem")
          .eq("company_id", companyId)
          .eq("ativo", true)
          .order("ordem"),
      ]);

      if (prodRes.error) throw prodRes.error;
      setProducts((prodRes.data || []) as Product[]);
      setStoreConfig(cfgRes.data || {});
      setPizzaSizes((sizesRes?.data || []) as PizzaSize[]);
      const bordas = (bordasRes?.data || []) as PizzaBorda[];
      setPizzaBordas(bordas);

      if (bordas.length) {
        const { data: precos } = await (supabase.from("pizza_borda_precos" as any) as any)
          .select("borda_id, tamanho_id, preco")
          .in("borda_id", bordas.map((b) => b.id));
        setPizzaBordaPrecos((precos || []) as PizzaBordaPreco[]);
      } else {
        setPizzaBordaPrecos([]);
      }

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

  const SIZE_OPTIONS = useMemo(() => {
    if (pizzaSizes.length > 0) {
      return pizzaSizes.map((s) => ({
        id: s.slug,
        tamanhoId: s.id,
        label: s.nome,
        multiplier: Number(s.multiplicador) || 1,
        maxFlavors: s.max_sabores || 1,
        slices: s.fatias || 1,
        descricao: s.descricao || "",
      }));
    }
    return DEFAULT_SIZES;
  }, [pizzaSizes]);

  const isPizzaProduct = (product?: Product | null) => {
    if (!product) return false;
    const nome = (product.nome || "").toLowerCase();
    const categoria = (product.categoria || "").toLowerCase();
    return !!product.permite_meio_a_meio || nome.includes("pizza") || categoria.includes("pizza");
  };

  const selectedPizzaSize = selectedSize
    ? SIZE_OPTIONS.find((s) => s.id === selectedSize)
    : undefined;

  const getBordaPriceForSize = (bordaId: string, tamanhoId: string) => {
    const p = pizzaBordaPrecos.find((x) => x.borda_id === bordaId && x.tamanho_id === tamanhoId);
    return Number(p?.preco || 0);
  };

  const selectedBorda = pizzaBordas.find((b) => b.id === selectedBordaId);

  const computePizzaPrice = (mainProduct: Product, extraIds: string[], sizeMultiplier: number) => {
    const basePrices = [Number(mainProduct.preco_sugerido || 0)];
    extraIds.forEach((id) => {
      const flavor = products.find((p) => p.id === id);
      if (flavor) basePrices.push(Number(flavor.preco_sugerido || 0));
    });
    const avg = basePrices.reduce((a, b) => a + b, 0) / basePrices.length;
    return Math.round(avg * sizeMultiplier * 100) / 100;
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.categoria || "Geral")));
    return ["Todos", ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = activeCategory === "Todos" || (p.categoria || "Geral") === activeCategory;
      const matchSearch =
        !term ||
        p.nome.toLowerCase().includes(term) ||
        (p.descricao_curta || "").toLowerCase().includes(term) ||
        (p.descricao || "").toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [products, search, activeCategory]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + Number(i.product.preco_sugerido || 0) * i.quantity, 0),
    [cart]
  );
  const deliveryFee = customer.tipo_atendimento === "entrega" ? Number(storeConfig?.taxa_entrega || 0) : 0;
  const total = subtotal + deliveryFee;

  const openProduct = (product: Product) => {
    if (isPizzaProduct(product)) {
      setSelectedProduct(product);
      setSelectedObs("");
      setSelectedQty(1);
      setSelectedSize("");
      setExtraFlavors([]);
      setSelectedBordaId("");
      return;
    }
    // Não-pizza: adiciona direto
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && !i.observations);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1, observations: "" }];
    });
    toast.success(`${product.nome} adicionado`);
  };

  const addPizzaToCart = () => {
    if (!selectedProduct) return;
    const isPizza = isPizzaProduct(selectedProduct);
    if (isPizza && !selectedPizzaSize) {
      toast.error("Selecione o tamanho da pizza");
      return;
    }

    let productToAdd: Product = selectedProduct;
    let obs = selectedObs;

    if (isPizza && selectedPizzaSize) {
      const validExtras = extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1);
      const flavorObjs = validExtras
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p);
      const basePrice = computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier);
      const bordaPrice =
        selectedBorda && selectedPizzaSize.tamanhoId
          ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId)
          : 0;
      const finalPrice = Math.round((basePrice + bordaPrice) * 100) / 100;
      const allNames = [selectedProduct.nome, ...flavorObjs.map((f) => f.nome)];
      const totalFlavors = allNames.length;
      const fraction = totalFlavors === 2 ? "½" : totalFlavors === 3 ? "⅓" : "";
      const baseName =
        totalFlavors === 1
          ? `${selectedProduct.nome} (${selectedPizzaSize.label})`
          : `${allNames.map((n) => `${fraction} ${n}`).join(" / ")} (${selectedPizzaSize.label})`;
      const composedName = selectedBorda ? `${baseName} • Borda ${selectedBorda.nome}` : baseName;

      productToAdd = {
        ...selectedProduct,
        id: `${selectedProduct.id}__${selectedPizzaSize.id}__${validExtras.join("_")}__${selectedBorda?.id || "noborda"}`,
        nome: composedName,
        preco_sugerido: finalPrice,
      };
      if (totalFlavors > 1) {
        obs = obs ? `${totalFlavors} sabores. ${obs}` : `${totalFlavors} sabores`;
      }
      if (selectedBorda) {
        obs = obs ? `Borda ${selectedBorda.nome}. ${obs}` : `Borda ${selectedBorda.nome}`;
      }
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === productToAdd.id && item.observations === obs
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + selectedQty } : item
        );
      }
      return [...prev, { product: productToAdd, quantity: selectedQty, observations: obs.trim() }];
    });
    toast.success("Pizza adicionada ao carrinho");
    resetSelection();
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
    if (total < minimo)
      return toast.error(`Pedido abaixo do mínimo (${formatBRL(minimo)})`);

    setSubmitting(true);
    try {
      const obsCompleta = [
        customer.observacoes,
        customer.forma_pagamento === "dinheiro" && customer.troco_para
          ? `Troco para ${formatBRL(Number(customer.troco_para))}`
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
        produto_id: String(i.product.id).split("__")[0], // extrai UUID base de pizzas compostas
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
                  {filteredProducts.map((p) => {
                    const isPizza = isPizzaProduct(p);
                    return (
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
                              {(p.descricao_curta || p.descricao) && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {p.descricao || p.descricao_curta}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="font-bold text-primary text-sm">
                                {formatBRL(Number(p.preco_sugerido || 0))}
                                {isPizza && <span className="text-[10px] text-muted-foreground ml-1">a partir</span>}
                              </div>
                              <Button size="sm" onClick={() => openProduct(p)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
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
                              {formatBRL(Number(item.product.preco_sugerido || 0))}
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
                            {formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}
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
                  <span className="font-semibold">{formatBRL(subtotal)}</span>
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
                        <span>{formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatBRL(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Taxa de entrega</span>
                        <span>{formatBRL(deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base text-primary">
                        <span>TOTAL</span>
                        <span>{formatBRL(total)}</span>
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

        {/* Pizza Configurator Dialog */}
        <Dialog open={!!selectedProduct} onOpenChange={(o) => !o && resetSelection()}>
          <DialogContent className="p-0 overflow-hidden max-w-md max-h-[90vh] flex flex-col">
            <div className="relative h-48 bg-muted shrink-0">
              {selectedProduct?.imagem_url ? (
                <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Pizza className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={resetSelection}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/90 hover:bg-background shadow flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                <DialogHeader className="text-left p-0 space-y-1">
                  <DialogTitle className="text-xl">{selectedProduct?.nome}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct?.descricao || selectedProduct?.descricao_curta || "Sem descrição."}
                  </p>
                </DialogHeader>

                {(() => {
                  if (!selectedProduct) return null;
                  const isPizza = isPizzaProduct(selectedProduct);
                  const validExtras =
                    isPizza && selectedPizzaSize
                      ? extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1)
                      : [];
                  const basePrice =
                    isPizza && selectedPizzaSize
                      ? computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier)
                      : Number(selectedProduct.preco_sugerido || 0);
                  const bordaPrice =
                    selectedBorda && selectedPizzaSize?.tamanhoId
                      ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId)
                      : 0;
                  const finalPrice = Math.round((basePrice + bordaPrice) * 100) / 100;
                  return (
                    <div className="text-lg font-bold text-primary">{formatBRL(finalPrice)}</div>
                  );
                })()}

                {isPizzaProduct(selectedProduct) && (
                  <>
                    {/* Tamanho */}
                    <div className="space-y-2 rounded-lg border border-dashed border-primary p-3">
                      <Label className="font-semibold text-primary">📏 Escolha primeiro o tamanho da pizza</Label>
                      <div
                        className="grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${Math.min(SIZE_OPTIONS.length, 5)}, minmax(0, 1fr))` }}
                      >
                        {SIZE_OPTIONS.map((size) => {
                          const price = selectedProduct
                            ? computePizzaPrice(selectedProduct, [], size.multiplier)
                            : 0;
                          const active = selectedSize === size.id;
                          return (
                            <button
                              key={size.id}
                              type="button"
                              onClick={() => {
                                setSelectedSize(size.id);
                                setExtraFlavors((prev) => prev.slice(0, size.maxFlavors - 1));
                                setSelectedBordaId("");
                              }}
                              className={`rounded-lg border-2 px-1 py-2 text-center transition ${
                                active
                                  ? "border-primary bg-primary/10 shadow-md"
                                  : "border-border hover:border-muted-foreground"
                              }`}
                              title={size.descricao || ""}
                            >
                              <div className="text-[11px] font-bold leading-tight">{size.label}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {size.maxFlavors} sabor{size.maxFlavors > 1 ? "es" : ""} · {size.slices} fat.
                              </div>
                              <div className="text-[11px] font-semibold mt-0.5 text-primary">
                                {formatBRL(price)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!selectedPizzaSize && (
                      <p className="text-xs text-muted-foreground">
                        Depois de escolher o tamanho, você poderá selecionar os sabores.
                      </p>
                    )}

                    {/* Sabores adicionais */}
                    {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                      <div className="space-y-2 rounded-lg border border-dashed border-primary p-3">
                        <Label className="font-semibold text-primary">
                          🍕 Sabores adicionais (até {selectedPizzaSize.maxFlavors - 1})
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          O preço final é a média dos sabores escolhidos.
                        </p>
                        {Array.from({ length: selectedPizzaSize.maxFlavors - 1 }).map((_, idx) => {
                          const selectedFlavorId = extraFlavors[idx] || "";
                          const selectedFlavor = products.find((p) => p.id === selectedFlavorId);
                          const availableFlavors = products.filter(
                            (p) =>
                              isPizzaProduct(p) &&
                              p.id !== selectedProduct?.id &&
                              !extraFlavors.filter((_, i) => i !== idx).includes(p.id)
                          );

                          return (
                            <div key={idx} className="space-y-1.5">
                              <Popover
                                open={openFlavorPicker === idx}
                                onOpenChange={(open) => setOpenFlavorPicker(open ? idx : null)}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openFlavorPicker === idx}
                                    className="w-full justify-between font-normal"
                                  >
                                    <span className="truncate text-left">
                                      {selectedFlavor ? selectedFlavor.nome : `Pesquisar sabor ${idx + 2}`}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-[var(--radix-popover-trigger-width)] p-0"
                                  align="start"
                                >
                                  <Command>
                                    <CommandInput placeholder={`Pesquisar sabor ${idx + 2}...`} />
                                    <CommandList>
                                      <CommandEmpty>Nenhum sabor encontrado.</CommandEmpty>
                                      <CommandGroup>
                                        <CommandItem
                                          value={`none-${idx}`}
                                          onSelect={() => {
                                            setExtraFlavors((prev) => {
                                              const next = [...prev];
                                              next[idx] = "";
                                              return next;
                                            });
                                            setOpenFlavorPicker(null);
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${!selectedFlavorId ? "opacity-100" : "opacity-0"}`}
                                          />
                                          <div className="min-w-0">
                                            <div className="font-medium">— Sem este sabor —</div>
                                          </div>
                                        </CommandItem>
                                        {availableFlavors.map((p) => (
                                          <CommandItem
                                            key={p.id}
                                            value={`${p.nome} ${p.descricao || p.descricao_curta || ""}`}
                                            onSelect={() => {
                                              setExtraFlavors((prev) => {
                                                const next = [...prev];
                                                next[idx] = p.id;
                                                return next;
                                              });
                                              setOpenFlavorPicker(null);
                                            }}
                                          >
                                            <Check
                                              className={`mr-2 h-4 w-4 ${
                                                selectedFlavorId === p.id ? "opacity-100" : "opacity-0"
                                              }`}
                                            />
                                            <div className="min-w-0">
                                              <div className="font-medium leading-tight">{p.nome}</div>
                                              <div className="text-xs text-muted-foreground line-clamp-2">
                                                {p.descricao || p.descricao_curta || "Sem descrição."}
                                              </div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {selectedFlavor && (
                                <p className="text-xs text-muted-foreground">
                                  {selectedFlavor.descricao || selectedFlavor.descricao_curta || "Sem descrição."}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Borda */}
                    {selectedPizzaSize && pizzaBordas.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-dashed border-primary p-3">
                        <Label className="font-semibold text-primary">🥨 Borda (opcional)</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedBordaId("")}
                            className={`rounded-lg border-2 p-2 text-left transition ${
                              !selectedBordaId
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <div className="text-xs font-bold">Sem borda</div>
                            <div className="text-[10px] text-muted-foreground">Borda tradicional</div>
                          </button>
                          {pizzaBordas.map((borda) => {
                            const price = selectedPizzaSize.tamanhoId
                              ? getBordaPriceForSize(borda.id, selectedPizzaSize.tamanhoId)
                              : 0;
                            const active = selectedBordaId === borda.id;
                            return (
                              <button
                                key={borda.id}
                                type="button"
                                onClick={() => setSelectedBordaId(borda.id)}
                                className={`rounded-lg border-2 p-2 text-left transition ${
                                  active
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-muted-foreground"
                                }`}
                              >
                                <div className="text-xs font-bold leading-tight">{borda.nome}</div>
                                {borda.descricao && (
                                  <div className="text-[10px] text-muted-foreground line-clamp-1">
                                    {borda.descricao}
                                  </div>
                                )}
                                <div className="text-[11px] font-semibold mt-0.5 text-primary">
                                  + {formatBRL(price)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={selectedObs}
                    onChange={(e) => setSelectedObs(e.target.value)}
                    placeholder="Ex: sem cebola, bem assada..."
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{selectedQty}</span>
                    <Button variant="outline" size="icon" onClick={() => setSelectedQty((q) => q + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {(() => {
                    if (!selectedProduct) return null;
                    const isPizza = isPizzaProduct(selectedProduct);
                    const validExtras =
                      isPizza && selectedPizzaSize
                        ? extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1)
                        : [];
                    const basePrice =
                      isPizza && selectedPizzaSize
                        ? computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier)
                        : Number(selectedProduct.preco_sugerido || 0);
                    const bordaPrice =
                      selectedBorda && selectedPizzaSize?.tamanhoId
                        ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId)
                        : 0;
                    const finalPrice = Math.round((basePrice + bordaPrice) * 100) / 100;
                    return (
                      <Button
                        className="font-semibold"
                        onClick={addPizzaToCart}
                        disabled={isPizza && !selectedPizzaSize}
                      >
                        Adicionar {formatBRL(finalPrice * selectedQty)}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

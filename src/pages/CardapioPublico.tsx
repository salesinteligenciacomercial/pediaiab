import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Minus, Search, Share2, Home, ClipboardList, ShoppingCart, UtensilsCrossed, X, Instagram, MapPin, MessageCircle } from "lucide-react";
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
  permite_observacao?: boolean;
  permite_meio_a_meio?: boolean;
};

type StoreConfig = {
  nome_loja?: string | null;
  descricao_loja?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  telefone_loja?: string | null;
  endereco_loja?: string | null;
  pedido_minimo?: number | null;
  taxa_entrega?: number | null;
  aceita_retirada?: boolean;
  aceita_entrega?: boolean;
  mensagem_loja?: string | null;
  horario_funcionamento?: Record<string, string>;
  horario_abertura?: string | null;
  aberto?: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
  observations: string;
};

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CardapioPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [config, setConfig] = useState<StoreConfig>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [secondFlavor, setSecondFlavor] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [customer, setCustomer] = useState({
    nome: "",
    telefone: "",
    tipo_atendimento: "entrega",
    forma_pagamento: "pix",
    observacoes: "",
    endereco: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "menu", slug },
        });
        if (error) throw error;
        if (!data?.success) {
          setNotFound(true);
          return;
        }
        setConfig(data.store || {});
        setProducts(data.products || []);
      } catch (error) {
        console.error(error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const primary = config.cor_primaria || "#1aa3ff";

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.descricao_curta || "").toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const categories = useMemo(
    () => Array.from(new Set(filteredProducts.map((p) => p.categoria || "Outros"))),
    [filteredProducts]
  );

  const destaques = useMemo(
    () => products.filter((p) => p.destaque_cardapio).slice(0, 8),
    [products]
  );
  const topShown = destaques.length > 0 ? destaques : products.slice(0, 8);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.preco_sugerido || 0) * item.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const deliveryFee = customer.tipo_atendimento === "entrega" ? Number(config.taxa_entrega || 0) : 0;
  const total = subtotal + deliveryFee;

  const addToCart = () => {
    if (!selectedProduct) return;

    let productToAdd: Product = selectedProduct;
    let obs = selectedObs;

    // Pizza meio a meio: combina nome dos dois sabores e usa o maior preço
    if (selectedProduct.permite_meio_a_meio && secondFlavor) {
      const second = products.find((p) => p.id === secondFlavor);
      if (second) {
        const maxPrice = Math.max(
          Number(selectedProduct.preco_sugerido || 0),
          Number(second.preco_sugerido || 0)
        );
        productToAdd = {
          ...selectedProduct,
          id: `${selectedProduct.id}__${second.id}`,
          nome: `½ ${selectedProduct.nome} / ½ ${second.nome}`,
          preco_sugerido: maxPrice,
        };
        obs = obs ? `Meio a meio. ${obs}` : "Meio a meio";
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
    setSelectedProduct(null);
    setSelectedObs("");
    setSelectedQty(1);
    setSecondFlavor("");
    toast.success("Item adicionado ao carrinho");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) => (i === index ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const submitOrder = async () => {
    if (!cart.length) {
      toast.error("Adicione itens ao carrinho");
      return;
    }
    if (!customer.nome.trim() || !customer.telefone.trim()) {
      toast.error("Informe nome e telefone");
      return;
    }
    if (customer.tipo_atendimento === "entrega" && !customer.endereco.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (total < Number(config.pedido_minimo || 0)) {
      toast.error("Pedido abaixo do mínimo da loja");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
        body: {
          action: "create",
          slug,
          customer,
          items: cart.map((item) => ({
            produto_id: item.product.id,
            produto_nome: item.product.nome,
            quantidade: item.quantity,
            valor_unitario: item.product.preco_sugerido,
            observacoes: item.observations,
          })),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao criar pedido");
      toast.success(`Pedido enviado com sucesso! Código ${data.codigo_pedido}`);
      setCart([]);
      setCartOpen(false);
      setCustomer({
        nome: "",
        telefone: "",
        tipo_atendimento: "entrega",
        forma_pagamento: "pix",
        observacoes: "",
        endereco: "",
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const shareStore = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: config.nome_loja || "Cardápio", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      /* noop */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6 bg-white">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Cardápio não encontrado</h1>
          <p className="text-neutral-500">Verifique o link da loja.</p>
        </div>
      </div>
    );
  }

  const fallbackImg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect fill='#f3f4f6' width='120' height='120'/><g fill='#cbd5e1'><path d='M30 40h10v40H30zM50 40h10v40H50zM70 40h10v40H70zM30 85h60v6H30z'/></g></svg>`
    );

  const ProductImage = ({ src, alt, className }: { src?: string | null; alt: string; className?: string }) => (
    <img
      src={src || fallbackImg}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => ((e.currentTarget as HTMLImageElement).src = fallbackImg)}
    />
  );

  return (
    <div className="min-h-screen bg-white text-neutral-800 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: primary }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-2 text-white">
          <h1 className="font-bold text-lg sm:text-xl truncate flex-1">
            {config.nome_loja || "Cardápio Digital"}
          </h1>
          <a
            href="https://www.instagram.com/roshpizzaria/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href="https://maps.app.goo.gl/c1MTAgZpNjRQSVKCA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Localização no Google Maps"
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition"
          >
            <MapPin className="h-5 w-5" />
          </a>
          <button
            aria-label="Buscar"
            onClick={() => setSearchOpen((v) => !v)}
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            aria-label="Compartilhar"
            onClick={shareStore}
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        {searchOpen && (
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                autoFocus
                placeholder="Buscar no cardápio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-0 h-10"
              />
            </div>
          </div>
        )}
      </header>

      {/* Subheader info */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {config.horario_abertura
                ? `Abre hoje às ${config.horario_abertura}`
                : config.aberto === false
                ? "Loja fechada"
                : "Aberto agora"}
            </span>
            <span className="text-neutral-300">•</span>
            <span>
              {Number(config.pedido_minimo || 0) > 0
                ? `Pedido mínimo ${formatBRL(Number(config.pedido_minimo))}`
                : "Sem pedido mínimo"}
            </span>
          </div>
          <button
            className="font-semibold hover:underline"
            style={{ color: primary }}
            onClick={() =>
              toast.message(config.nome_loja || "Loja", {
                description: `${config.descricao_loja || ""}${
                  config.endereco_loja ? `\n${config.endereco_loja}` : ""
                }${config.telefone_loja ? `\nTel: ${config.telefone_loja}` : ""}`,
              })
            }
          >
            Perfil da loja
          </button>
        </div>

        {config.aberto === false && (
          <div className="mt-3 border border-red-200 bg-red-50 text-red-600 text-sm rounded-md py-2 text-center">
            Loja fechada{config.horario_abertura ? `, abre hoje às ${config.horario_abertura}` : ""}
          </div>
        )}

        {config.mensagem_loja && (
          <div className="mt-3 text-sm text-neutral-600 border-l-4 pl-3" style={{ borderColor: primary }}>
            {config.mensagem_loja}
          </div>
        )}
      </div>

      {/* Category nav */}
      {categories.length > 0 && (
        <nav className="sticky top-16 z-30 bg-white border-b border-neutral-200 mt-4">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-thin">
              {topShown.length > 0 && (
                <button
                  onClick={() => document.getElementById('section-destaques')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border border-neutral-200 hover:border-neutral-400 transition whitespace-nowrap"
                >
                  ⭐ Mais pedidos
                </button>
              )}
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => document.getElementById(`section-${cat.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border border-neutral-200 hover:border-neutral-400 transition whitespace-nowrap"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-10">
        {/* Os mais pedidos */}
        {topShown.length > 0 && (
          <section id="section-destaques" className="scroll-mt-32">
            <h2 className="font-bold text-neutral-900 mb-4">Os mais pedidos</h2>
            <div className="flex gap-5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
              {topShown.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="flex-shrink-0 w-24 sm:w-28 text-left group"
                >
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-neutral-100 ring-1 ring-neutral-200 group-hover:ring-2 transition" style={{ ['--tw-ring-color' as any]: primary }}>
                    <ProductImage src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900 truncate">{p.nome}</div>
                  <div className="text-xs text-neutral-500">
                    A partir de <span className="font-semibold text-neutral-700">{formatBRL(p.preco_sugerido)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Categorias */}
        {categories.map((category) => {
          const items = filteredProducts.filter((p) => (p.categoria || "Outros") === category);
          if (!items.length) return null;
          return (
            <section key={category} id={`section-${category.replace(/\s+/g, '-')}`} className="scroll-mt-32">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">{category}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="text-left flex items-stretch gap-3 border border-neutral-200 rounded-lg p-3 hover:border-neutral-300 hover:shadow-sm transition bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900">{product.nome}</div>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                        {product.descricao || product.descricao_curta || product.descricao_completa || ""}
                      </p>
                      <div className="mt-3 text-xs text-neutral-500">A partir de</div>
                      <div className="font-bold text-neutral-900">{formatBRL(product.preco_sugerido)}</div>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                      <ProductImage
                        src={product.imagem_url}
                        alt={product.nome}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-12">Nenhum item encontrado.</div>
        )}
      </main>

      {/* WhatsApp floating button */}
      <a
        href="https://api.whatsapp.com/send/?phone=558798247745&text&type=phone_number&app_absent=0&utm_source=ig"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105"
      >
        <MessageCircle className="h-7 w-7" fill="currentColor" />
      </a>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200">
        <div className="max-w-5xl mx-auto grid grid-cols-3 h-16">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex flex-col items-center justify-center gap-0.5"
            style={{ color: primary }}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Início</span>
            <span className="block h-0.5 w-8 rounded-full -mb-1" style={{ backgroundColor: primary }} />
          </button>
          <button
            onClick={() =>
              toast.info("Acompanhamento de pedidos em breve", {
                description: "Você receberá atualizações no WhatsApp.",
              })
            }
            className="flex flex-col items-center justify-center gap-0.5 text-neutral-500"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs">Pedidos</span>
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-neutral-500 relative"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: primary }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-xs">Carrinho</span>
          </button>
        </div>
      </nav>

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Seu pedido</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {cart.length === 0 && (
              <div className="text-sm text-neutral-500 py-8 text-center">
                <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-neutral-300" />
                Seu carrinho está vazio.
              </div>
            )}
            {cart.map((item, index) => (
              <div key={`${item.product.id}-${index}`} className="flex gap-3 border-b pb-4">
                <div className="flex-1">
                  <div className="font-medium text-neutral-900">{item.product.nome}</div>
                  {item.observations && (
                    <div className="text-xs text-neutral-500 mt-0.5">{item.observations}</div>
                  )}
                  <div className="text-sm mt-1 font-semibold">{formatBRL(item.product.preco_sugerido)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => updateQuantity(index, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" onClick={() => updateQuantity(index, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Atendimento</Label>
                    <Select
                      value={customer.tipo_atendimento}
                      onValueChange={(v) => setCustomer({ ...customer, tipo_atendimento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!!config.aceita_entrega && <SelectItem value="entrega">Entrega</SelectItem>}
                        {!!config.aceita_retirada && <SelectItem value="retirada">Retirada</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pagamento</Label>
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
                        <SelectItem value="cartao">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {customer.tipo_atendimento === "entrega" && (
                  <div className="space-y-1.5">
                    <Label>Endereço</Label>
                    <Textarea
                      rows={3}
                      value={customer.endereco}
                      onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Observações do pedido</Label>
                  <Textarea
                    rows={2}
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
                  />
                </div>

                <div className="text-sm space-y-1 border-t pt-3">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatBRL(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa de entrega</span>
                    <span>{formatBRL(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-1">
                    <span>Total</span>
                    <span>{formatBRL(total)}</span>
                  </div>
                </div>
                <Button
                  className="w-full h-12 text-base font-semibold text-white"
                  style={{ backgroundColor: primary }}
                  onClick={submitOrder}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar pedido
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Product Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="p-0 overflow-hidden max-w-md">
          <div className="relative h-56 bg-neutral-100">
            <ProductImage
              src={selectedProduct?.imagem_url}
              alt={selectedProduct?.nome || ""}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <DialogHeader className="text-left p-0 space-y-1">
              <DialogTitle className="text-xl">{selectedProduct?.nome}</DialogTitle>
              <p className="text-sm text-neutral-500">
                {selectedProduct?.descricao || selectedProduct?.descricao_completa || selectedProduct?.descricao_curta || "Sem descrição."}
              </p>
            </DialogHeader>

            {(() => {
              const second = secondFlavor ? products.find((p) => p.id === secondFlavor) : null;
              const finalPrice = second
                ? Math.max(Number(selectedProduct?.preco_sugerido || 0), Number(second.preco_sugerido || 0))
                : Number(selectedProduct?.preco_sugerido || 0);
              return (
                <div className="text-lg font-bold" style={{ color: primary }}>
                  {formatBRL(finalPrice)}
                </div>
              );
            })()}

            {selectedProduct?.permite_meio_a_meio && (
              <div className="space-y-1.5 rounded-lg border border-dashed p-3" style={{ borderColor: primary }}>
                <Label className="font-semibold" style={{ color: primary }}>
                  🍕 Pizza meio a meio (opcional)
                </Label>
                <p className="text-xs text-neutral-500">
                  Escolha um segundo sabor. O valor cobrado será o do sabor mais caro.
                </p>
                <Select value={secondFlavor || "none"} onValueChange={(v) => setSecondFlavor(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar 2º sabor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Pizza inteira —</SelectItem>
                    {products
                      .filter(
                        (p) =>
                          p.permite_meio_a_meio &&
                          p.id !== selectedProduct.id &&
                          (p.categoria || "") === (selectedProduct.categoria || "")
                      )
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — {formatBRL(p.preco_sugerido)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={3}
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
                const second = secondFlavor ? products.find((p) => p.id === secondFlavor) : null;
                const finalPrice = second
                  ? Math.max(Number(selectedProduct?.preco_sugerido || 0), Number(second.preco_sugerido || 0))
                  : Number(selectedProduct?.preco_sugerido || 0);
                return (
                  <Button
                    className="text-white font-semibold"
                    style={{ backgroundColor: primary }}
                    onClick={addToCart}
                  >
                    Adicionar {formatBRL(finalPrice * selectedQty)}
                  </Button>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

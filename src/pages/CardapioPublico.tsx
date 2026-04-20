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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Minus, Search, Share2, Home, ClipboardList, ShoppingCart, UtensilsCrossed, X, Instagram, MapPin, MessageCircle, ChevronDown, ChevronUp, Check, ChevronsUpDown } from "lucide-react";
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
  const [pizzaSizes, setPizzaSizes] = useState<Array<{ id: string; nome: string; slug: string; multiplicador: number; max_sabores: number; fatias: number; descricao?: string | null }>>([]);
  const [pizzaBordas, setPizzaBordas] = useState<Array<{ id: string; nome: string; descricao?: string | null; ordem?: number }>>([]);
  const [pizzaBordaPrecos, setPizzaBordaPrecos] = useState<Array<{ borda_id: string; tamanho_id: string; preco: number }>>([]);
  const [selectedBordaId, setSelectedBordaId] = useState<string>("");
  const [drinkSuggestionOpen, setDrinkSuggestionOpen] = useState(false);
  const [skipDrinkPromptAtCheckout, setSkipDrinkPromptAtCheckout] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [openFlavorPicker, setOpenFlavorPicker] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const PREVIEW_LIMIT = 4;
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
        setPizzaSizes(data.pizzaSizes || []);
        setPizzaBordas(data.pizzaBordas || []);
        setPizzaBordaPrecos(data.pizzaBordaPrecos || []);
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

  const isPizzaProduct = (product?: Product | null) => {
    if (!product) return false;
    const nome = (product.nome || "").toLowerCase();
    const categoria = (product.categoria || "").toLowerCase();
    return !!product.permite_meio_a_meio || nome.includes("pizza") || categoria.includes("pizza");
  };

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

  // Tamanhos vindos do banco; fallback para defaults se a empresa não cadastrou nenhum
  const DEFAULT_SIZES = [
    { id: "brotinho", label: "Brotinho", multiplier: 0.625, maxFlavors: 1, slices: 1, descricao: "Pizza com 1 sabor e 1 fatia" },
    { id: "pequena", label: "Pequena", multiplier: 1, maxFlavors: 2, slices: 4, descricao: "Pizza com até 2 sabores e 4 fatias" },
    { id: "media", label: "Média", multiplier: 1.343, maxFlavors: 2, slices: 6, descricao: "Pizza com até 2 sabores e 6 fatias" },
    { id: "grande", label: "Grande", multiplier: 1.5, maxFlavors: 3, slices: 8, descricao: "Pizza com até 3 sabores e 8 fatias" },
    { id: "gigante", label: "Gigante", multiplier: 1.875, maxFlavors: 3, slices: 12, descricao: "Pizza com até 3 sabores e 12 fatias" },
  ];

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
    return DEFAULT_SIZES.map((d) => ({ ...d, tamanhoId: "" }));
  }, [pizzaSizes]);

  useEffect(() => {
    if (!selectedProduct) return;

    if (isPizzaProduct(selectedProduct)) {
      setSelectedSize("");
      setExtraFlavors([]);
      setSelectedBordaId("");
      return;
    }

    if (SIZE_OPTIONS.length > 0 && !SIZE_OPTIONS.find((s) => s.id === selectedSize)) {
      setSelectedSize(SIZE_OPTIONS[Math.min(1, SIZE_OPTIONS.length - 1)].id);
    }
  }, [SIZE_OPTIONS, selectedProduct]);

  const currentSize = useMemo(
    () => SIZE_OPTIONS.find((s) => s.id === selectedSize) || SIZE_OPTIONS[0],
    [SIZE_OPTIONS, selectedSize]
  );

  const selectedPizzaSize = selectedSize
    ? SIZE_OPTIONS.find((s) => s.id === selectedSize)
    : undefined;

  const getBordaPriceForSize = (bordaId: string, tamanhoId: string) => {
    const p = pizzaBordaPrecos.find((x) => x.borda_id === bordaId && x.tamanho_id === tamanhoId);
    return Number(p?.preco || 0);
  };

  const selectedBorda = pizzaBordas.find((b) => b.id === selectedBordaId);
  const selectedBordaPrice = selectedBorda && selectedPizzaSize?.tamanhoId
    ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId)
    : 0;

  // Lista de bebidas disponíveis (categoria contém "bebida" ou "bebidas")
  const drinkProducts = useMemo(
    () => products.filter((p) => {
      const cat = (p.categoria || "").toLowerCase();
      return cat.includes("bebida");
    }),
    [products]
  );

  // Determina se o carrinho contém bebida
  const cartHasDrink = useMemo(
    () => cart.some((item) => {
      const cat = (item.product.categoria || "").toLowerCase();
      return cat.includes("bebida");
    }),
    [cart]
  );

  // Calcula o preço final de uma pizza considerando tamanho e múltiplos sabores (média)
  const computePizzaPrice = (mainProduct: Product, extraIds: string[], sizeMultiplier: number) => {
    const basePrices = [Number(mainProduct.preco_sugerido || 0)];
    extraIds.forEach((id) => {
      const flavor = products.find((p) => p.id === id);
      if (flavor) basePrices.push(Number(flavor.preco_sugerido || 0));
    });
    const avg = basePrices.reduce((a, b) => a + b, 0) / basePrices.length;
    return Math.round(avg * sizeMultiplier * 100) / 100;
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    let productToAdd: Product = selectedProduct;
    let obs = selectedObs;
    const isPizza = isPizzaProduct(selectedProduct);

    if (isPizza && !selectedPizzaSize) {
      toast.error("Selecione o tamanho da pizza");
      return;
    }

    if (isPizza && selectedPizzaSize) {
      const validExtras = extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1);
      const flavorObjs = validExtras
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p);
      const basePrice = computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier);
      const bordaPrice = selectedBorda && selectedPizzaSize.tamanhoId
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
    const wasPizza = isPizzaProduct(selectedProduct);
    setSelectedProduct(null);
    setSelectedObs("");
    setSelectedQty(1);
    setExtraFlavors([]);
    setSelectedSize("");
    setSelectedBordaId("");
    toast.success("Item adicionado ao carrinho");
    // Sugerir bebida quando adicionar pizza e ainda não há bebida no carrinho
    if (wasPizza && drinkProducts.length > 0 && !cartHasDrink) {
      setTimeout(() => setDrinkSuggestionOpen(true), 300);
    }
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
            produto_id: String(item.product.id).split("__")[0],
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
    <div className="min-h-screen bg-neutral-50 text-neutral-800 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: primary }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-2 text-white">
          <h1 className="font-bold text-lg sm:text-xl truncate flex-1 tracking-tight">
            {config.nome_loja || "Cardápio Digital"}
          </h1>
          <a
            href="https://www.instagram.com/roshpizzaria/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition hover-scale"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href="https://maps.app.goo.gl/c1MTAgZpNjRQSVKCA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Localização no Google Maps"
            className="h-9 w-9 rounded-full hover:bg-white/15 flex items-center justify-center transition hover-scale"
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
          <div className="max-w-5xl mx-auto px-4 pb-3 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                autoFocus
                placeholder="Buscar pizza, bebida..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-0 h-11 rounded-full shadow-md"
              />
            </div>
          </div>
        )}
      </header>

      {/* Hero banner */}
      <div className="relative h-44 sm:h-56 overflow-hidden">
        <img
          src={config.banner_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&q=80"}
          alt="Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold drop-shadow-lg">
            {config.nome_loja || "Sabor que conquista 🍕"}
          </h2>
          <p className="text-sm sm:text-base text-white/90 mt-1 drop-shadow">
            {config.descricao_loja || "Massa artesanal, ingredientes frescos e entrega rapidinha"}
          </p>
        </div>
      </div>

      {/* Subheader info */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {config.aberto === false ? "Fechado" : "Aberto agora"}
            </span>
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-600">
              {Number(config.pedido_minimo || 0) > 0
                ? `Mín ${formatBRL(Number(config.pedido_minimo))}`
                : "Sem pedido mínimo"}
            </span>
            {Number(config.taxa_entrega || 0) > 0 && (
              <>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-600">Entrega {formatBRL(Number(config.taxa_entrega))}</span>
              </>
            )}
          </div>
          <button
            className="text-sm font-semibold hover:underline"
            style={{ color: primary }}
            onClick={() =>
              toast.message(config.nome_loja || "Loja", {
                description: `${config.descricao_loja || ""}${
                  config.endereco_loja ? `\n${config.endereco_loja}` : ""
                }${config.telefone_loja ? `\nTel: ${config.telefone_loja}` : ""}`,
              })
            }
          >
            Sobre a loja →
          </button>
        </div>

        {config.aberto === false && (
          <div className="mt-3 border border-red-200 bg-red-50 text-red-600 text-sm rounded-md py-2 text-center">
            Loja fechada{config.horario_abertura ? `, abre hoje às ${config.horario_abertura}` : ""}
          </div>
        )}

        {config.mensagem_loja && (
          <div className="mt-3 text-sm text-neutral-600 border-l-4 pl-3 bg-amber-50/50 py-2 rounded-r" style={{ borderColor: primary }}>
            {config.mensagem_loja}
          </div>
        )}
      </div>

      {/* Category nav */}
      {categories.length > 0 && (
        <nav className="sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-neutral-200 mt-4 shadow-sm">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-thin">
              {topShown.length > 0 && (
                <button
                  onClick={() => document.getElementById('section-destaques')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border border-neutral-200 hover:border-neutral-400 transition whitespace-nowrap hover-scale"
                >
                  ⭐ Mais pedidos
                </button>
              )}
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => document.getElementById(`section-${cat.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border border-neutral-200 hover:border-neutral-400 transition whitespace-nowrap hover-scale"
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
          <section id="section-destaques" className="scroll-mt-32 animate-fade-in">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">🔥 Os mais pedidos</h2>
              <span className="text-xs text-neutral-500">campeões de venda</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
              {topShown.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="flex-shrink-0 w-36 sm:w-40 text-left group bg-white rounded-2xl shadow-sm hover:shadow-lg border border-neutral-100 overflow-hidden transition-all hover-scale"
                >
                  <div className="relative w-full h-28 bg-neutral-100 overflow-hidden">
                    <ProductImage src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-amber-600 shadow">
                      ⭐ POPULAR
                    </span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-sm font-bold text-neutral-900 line-clamp-1">{p.nome}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">A partir de</div>
                    <div className="text-sm font-extrabold" style={{ color: primary }}>{formatBRL(p.preco_sugerido)}</div>
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
          const isExpanded = !!expandedCategories[category] || !!search.trim();
          const visibleItems = isExpanded ? items : items.slice(0, PREVIEW_LIMIT);
          const hiddenCount = items.length - visibleItems.length;
          return (
            <section key={category} id={`section-${category.replace(/\s+/g, '-')}`} className="scroll-mt-32 animate-fade-in">
              <button
                type="button"
                onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }))}
                className="w-full flex items-center justify-between mb-4 group"
              >
                <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                  {category}
                  <span className="text-xs font-medium text-neutral-400">({items.length})</span>
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 group-hover:border-neutral-400 transition"
                  style={{ color: primary }}
                >
                  {isExpanded ? (
                    <>
                      Recolher <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Ver tudo <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </span>
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleItems.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="text-left flex items-stretch gap-3 bg-white border border-neutral-100 rounded-2xl p-3 hover:shadow-lg hover:border-neutral-200 transition-all group relative overflow-hidden"
                  >
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start gap-2">
                        <div className="font-bold text-neutral-900 leading-tight flex-1">{product.nome}</div>
                        {product.destaque_cardapio && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                            ⭐
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-1 flex-1">
                        {product.descricao || product.descricao_curta || product.descricao_completa || ""}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-neutral-400 uppercase tracking-wide">A partir de</div>
                          <div className="text-base font-extrabold" style={{ color: primary }}>{formatBRL(product.preco_sugerido)}</div>
                        </div>
                        {isPizzaProduct(product) && (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                            ½ + ½
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                      <ProductImage
                        src={product.imagem_url}
                        alt={product.nome}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-white shadow-md flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 transition" style={{ color: primary }}>
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: true }))}
                  className="mt-4 w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold hover:bg-neutral-50 transition flex items-center justify-center gap-2"
                  style={{ borderColor: primary, color: primary }}
                >
                  Ver mais {hiddenCount} {hiddenCount === 1 ? "item" : "itens"}
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
              {isExpanded && items.length > PREVIEW_LIMIT && !search.trim() && (
                <button
                  type="button"
                  onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: false }))}
                  className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-neutral-500 hover:text-neutral-700 transition flex items-center justify-center gap-2"
                >
                  Recolher categoria <ChevronUp className="h-4 w-4" />
                </button>
              )}
            </section>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="text-center text-sm text-neutral-500 py-12">Nenhum item encontrado.</div>
        )}
      </main>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-40 px-4 pb-2 animate-fade-in">
          <button
            onClick={() => setCartOpen(true)}
            className="max-w-5xl mx-auto w-full h-14 rounded-2xl shadow-2xl text-white flex items-center justify-between px-5 font-semibold hover:opacity-95 transition"
            style={{ backgroundColor: primary }}
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full h-7 w-7 flex items-center justify-center text-sm font-bold">
                {cartCount}
              </span>
              Ver carrinho
            </span>
            <span className="text-base">{formatBRL(subtotal)}</span>
          </button>
        </div>
      )}
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
              if (!selectedProduct) return null;
              const isPizza = isPizzaProduct(selectedProduct);
              const validExtras = isPizza && selectedPizzaSize
                ? extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1)
                : [];
              const finalPrice = isPizza && selectedPizzaSize
                ? computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier)
                : Number(selectedProduct.preco_sugerido || 0);
              return (
                <div className="text-lg font-bold" style={{ color: primary }}>
                  {formatBRL(finalPrice)}
                </div>
              );
            })()}

            {isPizzaProduct(selectedProduct) && (
              <>
                <div className="space-y-1.5 rounded-lg border border-dashed p-3" style={{ borderColor: primary }}>
                  <Label className="font-semibold" style={{ color: primary }}>
                    📏 Escolha primeiro o tamanho da pizza
                  </Label>
                  <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${Math.min(SIZE_OPTIONS.length, 5)}, minmax(0, 1fr))` }}>
                    {SIZE_OPTIONS.map((size) => {
                      const price = computePizzaPrice(selectedProduct, [], size.multiplier);
                      const active = selectedSize === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => {
                            setSelectedSize(size.id);
                            setExtraFlavors((prev) => prev.slice(0, size.maxFlavors - 1));
                          }}
                          className={`rounded-lg border-2 px-1 py-2 text-center transition ${
                            active ? "shadow-md" : "border-neutral-200 hover:border-neutral-300"
                          }`}
                          style={active ? { borderColor: primary, backgroundColor: `${primary}15` } : {}}
                          title={size.descricao || ""}
                        >
                          <div className="text-[11px] font-bold leading-tight">{size.label}</div>
                          <div className="text-[10px] text-neutral-500">
                            {size.maxFlavors} sabor{size.maxFlavors > 1 ? "es" : ""} · {size.slices} fat.
                          </div>
                          <div className="text-[11px] font-semibold mt-0.5" style={{ color: primary }}>
                            {formatBRL(price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!selectedPizzaSize && (
                  <p className="text-xs text-neutral-500">
                    Depois de escolher o tamanho, você poderá selecionar os sabores da pizza.
                  </p>
                )}

                {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                  <div className="space-y-2 rounded-lg border border-dashed p-3" style={{ borderColor: primary }}>
                    <Label className="font-semibold" style={{ color: primary }}>
                      🍕 Sabores adicionais (até {selectedPizzaSize.maxFlavors - 1})
                    </Label>
                    <p className="text-xs text-neutral-500">
                      O preço final é a média dos sabores escolhidos.
                    </p>
                    {Array.from({ length: selectedPizzaSize.maxFlavors - 1 }).map((_, idx) => {
                      const selectedFlavorId = extraFlavors[idx] || "";
                      const selectedFlavor = products.find((p) => p.id === selectedFlavorId);
                      const availableFlavors = products.filter(
                        (p) =>
                          isPizzaProduct(p) &&
                          p.id !== selectedProduct.id &&
                          !extraFlavors.filter((_, i) => i !== idx).includes(p.id)
                      );

                      return (
                        <div key={idx} className="space-y-1.5">
                          <Popover open={openFlavorPicker === idx} onOpenChange={(open) => setOpenFlavorPicker(open ? idx : null)}>
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
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
                                      <Check className={`mr-2 h-4 w-4 ${!selectedFlavorId ? 'opacity-100' : 'opacity-0'}`} />
                                      <div className="min-w-0">
                                        <div className="font-medium">— Sem este sabor —</div>
                                      </div>
                                    </CommandItem>
                                    {availableFlavors.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.nome} ${(p.descricao || p.descricao_curta || p.descricao_completa || "")}`}
                                        onSelect={() => {
                                          setExtraFlavors((prev) => {
                                            const next = [...prev];
                                            next[idx] = p.id;
                                            return next;
                                          });
                                          setOpenFlavorPicker(null);
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${selectedFlavorId === p.id ? 'opacity-100' : 'opacity-0'}`} />
                                        <div className="min-w-0">
                                          <div className="font-medium leading-tight">{p.nome}</div>
                                          <div className="text-xs text-muted-foreground line-clamp-2">
                                            {p.descricao || p.descricao_curta || p.descricao_completa || "Sem descrição."}
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
                            <p className="text-xs text-neutral-500">
                              {selectedFlavor.descricao || selectedFlavor.descricao_curta || selectedFlavor.descricao_completa || "Sem descrição."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
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
                if (!selectedProduct) return null;
                const isPizza = isPizzaProduct(selectedProduct);
                const validExtras = isPizza && selectedPizzaSize
                  ? extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1)
                  : [];
                const finalPrice = isPizza && selectedPizzaSize
                  ? computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier)
                  : Number(selectedProduct.preco_sugerido || 0);
                return (
                  <Button
                    className="text-white font-semibold"
                    style={{ backgroundColor: primary }}
                    onClick={addToCart}
                    disabled={isPizza && !selectedPizzaSize}
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

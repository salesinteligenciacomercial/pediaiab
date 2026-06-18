import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, User, Star, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME, MARKETPLACE_PATH, MARKETPLACE_TITLE } from "@/config/branding";
import { useCardapioPwa } from "@/hooks/useCardapioPwa";
import { CardapioInstallBanner } from "@/components/cardapio/CardapioInstallBanner";
import { CARDAPIO_CSS, categoryEmoji } from "@/styles/cardapioTheme";

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

type CartItem = { product: Product; quantity: number; observations: string };

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [flavorSearch, setFlavorSearch] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [activePill, setActivePill] = useState<string>("destaques");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const CUSTOMER_STORAGE_KEY = `cardapio_customer_${slug || "default"}`;
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [customer, setCustomer] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(`cardapio_customer_${slug || "default"}`) : null;
      if (saved) {
        const p = JSON.parse(saved);
        return {
          nome: p.nome || "",
          telefone: p.telefone || "",
          tipo_atendimento: p.tipo_atendimento || "entrega",
          forma_pagamento: p.forma_pagamento || "pix",
          observacoes: "",
          endereco: p.endereco || "",
        };
      }
    } catch {/* ignore */}
    return { nome: "", telefone: "", tipo_atendimento: "entrega", forma_pagamento: "pix", observacoes: "", endereco: "" };
  });

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountData, setAccountData] = useState<{ pedidos: number; total: number; pontos: number } | null>(null);
  const isLogged = !!(customer.nome && customer.telefone);

  useEffect(() => {
    registerSW({ immediate: true });
  }, []);

  // load collapsed categories from localStorage
  useEffect(() => {
    try {
      const key = `cardapio_collapsed_${slug || 'default'}`;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {};
  }, [slug]);

  // 🔐 "Login" automático por telefone: ao informar telefone válido, busca dados salvos
  const lastFetchedPhone = useRef<string>("");
  useEffect(() => {
    const tel = String(customer.telefone || "").replace(/\D/g, "");
    if (tel.length < 10 || tel === lastFetchedPhone.current) return;
    lastFetchedPhone.current = tel;
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "customer", slug, telefone: tel },
        });
        if (data?.success) {
          setCustomer((prev) => {
            const next = { ...prev };
            if (!prev.nome && data.nome) next.nome = data.nome;
            if (!prev.endereco && data.endereco?.logradouro) {
              const e = data.endereco;
              next.endereco = [e.logradouro, e.numero, e.bairro, e.cidade]
                .filter(Boolean).join(", ");
            }
            // Persistir no localStorage para próximas visitas
            try {
              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                nome: next.nome, telefone: next.telefone,
                tipo_atendimento: next.tipo_atendimento,
                forma_pagamento: next.forma_pagamento,
                endereco: next.endereco,
              }));
            } catch {/* ignore */}
            return next;
          });
          if (data.nome || data.endereco?.logradouro) {
            toast.success("Bem-vindo de volta! Seus dados foram preenchidos.");
          }
        }
      } catch (e) { console.error("auto-login customer:", e); }
    }, 500);
    return () => clearTimeout(timer);
  }, [customer.telefone, slug]);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "menu", slug },
        });
        if (error) throw error;
        if (!data?.success) { setNotFound(true); return; }
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

  const isPizzaProduct = (product?: Product | null) => {
    if (!product) return false;
    const n = (product.nome || "").toLowerCase();
    const c = (product.categoria || "").toLowerCase();
    return !!product.permite_meio_a_meio || n.includes("pizza") || c.includes("pizza");
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.descricao_curta || "").toLowerCase().includes(q) ||
        (p.descricao || "").toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const categories = useMemo(
    () => Array.from(new Set(filteredProducts.map((p) => p.categoria || "Outros"))),
    [filteredProducts]
  );

  // debounce search input to avoid filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const destaques = useMemo(
    () => products.filter((p) => p.destaque_cardapio).slice(0, 10),
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

  const DEFAULT_SIZES = [
    { id: "brotinho", label: "Brotinho", multiplier: 0.625, maxFlavors: 1, slices: 4, descricao: "1 sabor" },
    { id: "pequena", label: "Pequena", multiplier: 1, maxFlavors: 2, slices: 6, descricao: "Até 2 sabores" },
    { id: "media", label: "Média", multiplier: 1.343, maxFlavors: 2, slices: 8, descricao: "Até 2 sabores" },
    { id: "grande", label: "Grande", multiplier: 1.5, maxFlavors: 3, slices: 10, descricao: "Até 3 sabores" },
    { id: "gigante", label: "Gigante", multiplier: 1.875, maxFlavors: 4, slices: 12, descricao: "Até 4 sabores" },
  ];

  const SIZE_OPTIONS = useMemo(() => {
    if (pizzaSizes.length > 0) {
      return pizzaSizes.map((s) => ({
        id: s.slug, tamanhoId: s.id, label: s.nome,
        multiplier: Number(s.multiplicador) || 1,
        maxFlavors: s.max_sabores || 1, slices: s.fatias || 1,
        descricao: s.descricao || "",
      }));
    }
    return DEFAULT_SIZES.map((d) => ({ ...d, tamanhoId: "" }));
  }, [pizzaSizes]);

  useEffect(() => {
    if (!selectedProduct) return;
    setFlavorSearch("");
    if (isPizzaProduct(selectedProduct)) {
      setSelectedSize(""); setExtraFlavors([]); setSelectedBordaId("");
      return;
    }
    if (SIZE_OPTIONS.length > 0 && !SIZE_OPTIONS.find((s) => s.id === selectedSize)) {
      setSelectedSize(SIZE_OPTIONS[Math.min(1, SIZE_OPTIONS.length - 1)].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const selectedPizzaSize = selectedSize ? SIZE_OPTIONS.find((s) => s.id === selectedSize) : undefined;

  const getBordaPriceForSize = (bordaId: string, tamanhoId: string) => {
    const p = pizzaBordaPrecos.find((x) => x.borda_id === bordaId && x.tamanho_id === tamanhoId);
    return Number(p?.preco || 0);
  };
  const selectedBorda = pizzaBordas.find((b) => b.id === selectedBordaId);

  const computePizzaPrice = (mainProduct: Product, extraIds: string[], sizeMultiplier: number) => {
    const prices = [Number(mainProduct.preco_sugerido || 0)];
    extraIds.forEach((id) => {
      const f = products.find((p) => p.id === id);
      if (f) prices.push(Number(f.preco_sugerido || 0));
    });
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
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
      const flavorObjs = validExtras.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
      const basePrice = computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier);
      const bordaPrice = selectedBorda && selectedPizzaSize.tamanhoId ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId) : 0;
      const finalPrice = Math.round((basePrice + bordaPrice) * 100) / 100;
      const allNames = [selectedProduct.nome, ...flavorObjs.map((f) => f.nome)];
      const totalFlavors = allNames.length;
      const fraction = totalFlavors === 2 ? "½" : totalFlavors === 3 ? "⅓" : totalFlavors === 4 ? "¼" : "";
      const baseName = totalFlavors === 1
        ? `${selectedProduct.nome} (${selectedPizzaSize.label})`
        : `${allNames.map((n) => `${fraction} ${n}`).join(" / ")} (${selectedPizzaSize.label})`;
      const composedName = selectedBorda ? `${baseName} • Borda ${selectedBorda.nome}` : baseName;
      productToAdd = {
        ...selectedProduct,
        id: `${selectedProduct.id}__${selectedPizzaSize.id}__${validExtras.join("_")}__${selectedBorda?.id || "noborda"}`,
        nome: composedName, preco_sugerido: finalPrice,
      };
      if (totalFlavors > 1) obs = obs ? `${totalFlavors} sabores. ${obs}` : `${totalFlavors} sabores`;
      if (selectedBorda) obs = obs ? `Borda ${selectedBorda.nome}. ${obs}` : `Borda ${selectedBorda.nome}`;
    }

    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === productToAdd.id && it.observations === obs);
      if (existing) return prev.map((it) => it === existing ? { ...it, quantity: it.quantity + selectedQty } : it);
      return [...prev, { product: productToAdd, quantity: selectedQty, observations: obs.trim() }];
    });
    setSelectedProduct(null);
    setSelectedObs(""); setSelectedQty(1); setExtraFlavors([]); setSelectedSize(""); setSelectedBordaId("");
    toast.success("Item adicionado ao carrinho");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => prev.map((it, i) => i === index ? { ...it, quantity: it.quantity + delta } : it).filter((it) => it.quantity > 0));
  };

  const submitOrder = async () => {
    if (!cart.length) { toast.error("Adicione itens ao carrinho"); return; }
    if (!customer.nome.trim() || !customer.telefone.trim()) { toast.error("Informe nome e WhatsApp"); return; }
    if (customer.tipo_atendimento === "entrega" && !customer.endereco.trim()) { toast.error("Informe o endereço de entrega"); return; }
    if (total < Number(config.pedido_minimo || 0)) { toast.error("Pedido abaixo do mínimo da loja"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
        body: {
          action: "create", slug, customer,
          items: cart.map((it) => ({
            produto_id: String(it.product.id).split("__")[0],
            produto_nome: it.product.nome,
            quantidade: it.quantity,
            valor_unitario: it.product.preco_sugerido,
            observacoes: it.observations,
          })),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao criar pedido");
      toast.success(`Pedido enviado! Código ${data.codigo_pedido}`);
      try {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
          nome: customer.nome, telefone: customer.telefone,
          tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
          endereco: customer.endereco,
        }));
      } catch {/* ignore */}
      setCart([]); setCartOpen(false);
      setCustomer((prev) => ({ ...prev, observacoes: "" }));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const openAccount = async () => {
    setAccountOpen(true);
    if (!customer.telefone) return;
    setAccountLoading(true);
    try {
      const { data } = await supabase.functions.invoke("api-public-pedidos", {
        body: { action: "customer", slug, telefone: customer.telefone },
      });
      if (data?.success) {
        const t = Number(data.total || 0);
        setAccountData({ pedidos: Number(data.pedidos || 0), total: t, pontos: Math.floor(t / 10) });
      }
    } catch (e) { console.error(e); }
    finally { setAccountLoading(false); }
  };

  const logoutAccount = () => {
    try { localStorage.removeItem(CUSTOMER_STORAGE_KEY); } catch {/* ignore */}
    setCustomer({ nome: "", telefone: "", tipo_atendimento: "entrega", forma_pagamento: "pix", observacoes: "", endereco: "" });
    setAccountData(null); setAccountOpen(false);
    toast.success("Cadastro removido deste dispositivo");
  };

  const scrollToSection = (id: string) => {
    setActivePill(id);
    document.getElementById(`c-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const nomeLoja = config.nome_loja || APP_NAME;
  const pwa = useCardapioPwa({
    slug,
    storeName: nomeLoja,
    logoUrl: config.logo_url,
    themeColor: config.cor_primaria || "#FF4500",
    enabled: !loading && !notFound,
  });

  if (loading) {
    return (
      <div className="cardapio-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{CARDAPIO_CSS}</style>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF6B1A" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="cardapio-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <style>{CARDAPIO_CSS}</style>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Playfair Display',serif" }}>Cardápio não encontrado</h1>
          <p style={{ color: "#B8A898", marginTop: 6 }}>Verifique o link da loja.</p>
        </div>
      </div>
    );
  }

  const telWa = (config.telefone_loja || "").replace(/\D/g, "");
  const aberto = config.aberto !== false;
  const minimo = Number(config.pedido_minimo || 0);
  const taxa = Number(config.taxa_entrega || 0);

  // filtered flavors for pizza picker
  const availableFlavorsBase = products.filter((p) => isPizzaProduct(p) && p.id !== selectedProduct?.id);
  const visibleFlavors = flavorSearch.trim()
    ? availableFlavorsBase.filter((p) => p.nome.toLowerCase().includes(flavorSearch.toLowerCase()))
    : availableFlavorsBase;

  const selectedExtraIds = extraFlavors.filter(Boolean);
  const maxExtras = (selectedPizzaSize?.maxFlavors || 1) - 1;
  const toggleFlavor = (id: string) => {
    setExtraFlavors((prev) => {
      const cleaned = prev.filter(Boolean);
      if (cleaned.includes(id)) return cleaned.filter((x) => x !== id);
      if (cleaned.length >= maxExtras) {
        toast.error(`Você pode escolher até ${maxExtras} sabor(es) adicional(is)`);
        return cleaned;
      }
      return [...cleaned, id];
    });
  };

  const finalModalPrice = (() => {
    if (!selectedProduct) return 0;
    if (isPizzaProduct(selectedProduct) && selectedPizzaSize) {
      const base = computePizzaPrice(selectedProduct, selectedExtraIds, selectedPizzaSize.multiplier);
      const bordaPrice = selectedBorda && selectedPizzaSize.tamanhoId ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId) : 0;
      return Math.round((base + bordaPrice) * 100) / 100;
    }
    return Number(selectedProduct.preco_sugerido || 0);
  })();

  return (
    <div className="cardapio-root">
      <style>{CARDAPIO_CSS}</style>

      {/* HEADER */}
      <header className="c-header">
        <div className="c-logo-wrap">
          <span className="c-logo-flame">🔥</span>
          <span className="c-logo-text">{nomeLoja}</span>
        </div>
        <div className="c-header-actions">
          <Link className="c-icon-btn" to={MARKETPLACE_PATH} title={MARKETPLACE_TITLE} style={{ width: "auto", padding: "0 12px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
            🏪 Marketplace
          </Link>
          <a className="c-icon-btn" href="https://instagram.com/roshpizzaria" target="_blank" rel="noopener noreferrer" title="Instagram">📸</a>
          <a className="c-icon-btn" href="https://maps.app.goo.gl/c1MTAgZpNjRQSVKCA" target="_blank" rel="noopener noreferrer" title="Localização">📍</a>
          <button className="c-icon-btn" onClick={() => { setSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 60); }} title="Buscar">🔍</button>
          {(pwa.isMobile && !pwa.isInstalled) && (
            <button className="c-icon-btn" onClick={() => void pwa.promptInstall()} title="Instalar app">📲</button>
          )}
          <button className="c-icon-btn" onClick={openAccount} title="Minha conta" aria-label="Minha conta">
            <User size={16} />
          </button>
          {cartCount > 0 && (
            <button className="c-cart-btn" onClick={() => setCartOpen(true)}>
              🛒 <span className="c-cart-count">{cartCount}</span>
            </button>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="c-hero">
        <div className="c-hero-bg" />
        <div className="c-hero-blur" />
        <div className="c-hero-glow" />
        <div className="c-hero-emoji">🍕</div>
        <div className="c-hero-content">
          <div className="c-hero-badge">
            <i /> {aberto ? "Aberto agora" : "Fechado"}{config.horario_funcionamento ? " · Até 23h" : ""}
          </div>
          <h1 className="c-hero-title">
            Pizza que faz<br /><em>você sonhar</em>
          </h1>
          <p className="c-hero-sub">
            {config.descricao_loja || "Massa artesanal fermentada 24h, ingredientes frescos e entrega ultrarrápida. Peça agora."}
          </p>
          <div className="c-hero-stats">
            <div><div className="c-stat-val">4.9★</div><div className="c-stat-lbl">Avaliação</div></div>
            <div><div className="c-stat-val">30min</div><div className="c-stat-lbl">Entrega</div></div>
            <div><div className="c-stat-val">+2k</div><div className="c-stat-lbl">Pedidos/mês</div></div>
          </div>
        </div>
      </section>

      {/* STATUS BAR */}
      <div className="c-status-bar">
        <div className="c-status-open">
          <span className="c-dot-green" />
          {aberto ? "Aberto agora" : "Fechado"}{aberto ? " — Fecha às 23:00" : ""}
        </div>
        <div className="c-status-chips">
          {taxa > 0 && <span className="c-chip hot">🛵 Entrega {formatBRL(taxa)}</span>}
          {minimo > 0 && <span className="c-chip">Mín {formatBRL(minimo)}</span>}
          <span className="c-chip">Pix · Cartão · Dinheiro</span>
        </div>
      </div>

      {/* SEARCH */}
      <div className="c-search-wrap c-fade-up">
        <div className="c-search-inner">
          <span className="c-search-icon">🔍</span>
          <input
            ref={searchRef}
            className="c-search-input"
            placeholder="Buscar pizza, bebida, combo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* NAV PILLS */}
      <div className="c-nav-pills">
        {topShown.length > 0 && (
          <button
            className={`c-pill ${activePill === "destaques" ? "active" : ""}`}
            onClick={() => scrollToSection("destaques")}
          >
            ⭐ Mais pedidos
          </button>
        )}
        {categories.map((cat) => {
          const count = filteredProducts.filter((p) => (p.categoria || "Outros") === cat).length;
          const id = cat.replace(/\s+/g, "-");
          return (
            <button
              key={cat}
              className={`c-pill ${activePill === id ? "active" : ""}`}
              onClick={() => scrollToSection(id)}
            >
              {categoryEmoji(cat)} {cat} <span className="c-pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN */}
      <main className="c-main">
        {topShown.length > 0 && (
          <section id="c-sec-destaques" className="c-category-section c-fade-up">
            <div className="c-section-header">
              <h2 className="c-section-title">🔥 Os mais pedidos</h2>
              <span className="c-section-sub">Campeões de venda</span>
            </div>
            <div className="c-destaques-scroll">
              {topShown.map((p) => (
                <div key={p.id} className="c-destaque-card" onClick={() => setSelectedProduct(p)}>
                  <span className="c-destaque-badge">★ Popular</span>
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} className="c-destaque-img" loading="lazy" />
                    : <div className="c-destaque-img-ph">🍕</div>}
                  <div className="c-destaque-body">
                    <div className="c-destaque-name">{p.nome}</div>
                    <div className="c-destaque-price">{formatBRL(p.preco_sugerido)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {categories.map((cat) => {
          const items = filteredProducts.filter((p) => (p.categoria || "Outros") === cat);
          if (!items.length) return null;
          const id = cat.replace(/\s+/g, "-");
          const isCollapsed = !!collapsed[id];
          return (
            <section key={cat} id={`c-sec-${id}`} className="c-category-section c-fade-up">
              <div className="c-cat-label" style={{ cursor: 'pointer' }} onClick={() => {
                const next = { ...collapsed, [id]: !isCollapsed };
                setCollapsed(next);
                try { localStorage.setItem(`cardapio_collapsed_${slug || 'default'}`, JSON.stringify(next)); } catch {}
              }}>
                <span style={{ marginRight: 8 }}>{isCollapsed ? '▸' : '▾'}</span>
                {categoryEmoji(cat)} {cat} <small>({items.length} {items.length === 1 ? "item" : "itens"})</small>
              </div>
              {!isCollapsed && (
                <div className="c-prod-list">
                  {items.map((p) => (
                    <button key={p.id} className="c-prod-item" onClick={() => setSelectedProduct(p)}>
                      <div className="c-prod-info">
                        <div className="c-prod-name">{p.nome}</div>
                        <div className="c-prod-desc">{p.descricao || p.descricao_curta || p.descricao_completa || "—"}</div>
                        <div className="c-prod-footer">
                          <div>
                            <div className="c-prod-price-from">A partir de</div>
                            <div className="c-prod-price">{formatBRL(p.preco_sugerido)}</div>
                          </div>
                          {isPizzaProduct(p) && <span className="c-half-badge">½ + ½</span>}
                        </div>
                      </div>
                      <div className="c-prod-img-wrap">
                        {p.imagem_url
                          ? <img src={p.imagem_url} alt={p.nome} className="c-prod-img" loading="lazy" />
                          : <div className="c-prod-img-ph">{categoryEmoji(cat)}</div>}
                        <div className="c-add-circle">+</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {filteredProducts.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px" }}>
            Nenhum item encontrado.
          </div>
        )}
      </main>

      {/* STICKY CART BAR */}
      {cartCount > 0 && (
        <div className="c-sticky-cart">
          <button className="c-sticky-cart-btn" onClick={() => setCartOpen(true)}>
            <div className="c-cart-left">
              <div className="c-cart-pill">{cartCount}</div>
              <span>Ver meu pedido</span>
            </div>
            <span>{formatBRL(subtotal)}</span>
          </button>
        </div>
      )}

      {/* WHATSAPP */}
      {telWa && (
        <a className="c-wa-btn" href={`https://api.whatsapp.com/send/?phone=${telWa}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
          💬
        </a>
      )}

      {pwa.showBanner && (
        <CardapioInstallBanner
          storeName={nomeLoja}
          isIos={pwa.isIos}
          iosHintOpen={pwa.iosHintOpen}
          onInstall={() => void pwa.promptInstall()}
          onDismiss={pwa.dismissBanner}
          onCloseIosHint={() => pwa.setIosHintOpen(false)}
        />
      )}

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <div className="c-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="c-modal">
            <div style={{ position: "relative" }}>
              {selectedProduct.imagem_url
                ? <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="c-modal-img" />
                : <div className="c-modal-img-ph">{categoryEmoji(selectedProduct.categoria || "")}</div>}
              <button className="c-modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="c-modal-body">
              <div className="c-modal-name">{selectedProduct.nome}</div>
              <div className="c-modal-desc">
                {selectedProduct.descricao || selectedProduct.descricao_completa || selectedProduct.descricao_curta || "Sem descrição."}
              </div>
              <div className="c-modal-price">{formatBRL(finalModalPrice)}</div>

              {isPizzaProduct(selectedProduct) && (
                <>
                  <div className="c-sub2">📏 Escolha o tamanho</div>
                  <div className="c-sizes-grid">
                    {SIZE_OPTIONS.map((s) => {
                      const price = computePizzaPrice(selectedProduct, [], s.multiplier);
                      const active = selectedSize === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`c-size-btn ${active ? "active" : ""}`}
                          onClick={() => { setSelectedSize(s.id); setExtraFlavors((prev) => prev.slice(0, s.maxFlavors - 1)); }}
                          title={s.descricao || ""}
                        >
                          <div className="c-size-name">{s.label}</div>
                          <div className="c-size-info">{s.maxFlavors} sab · {s.slices} fat</div>
                          <div className="c-size-price">{formatBRL(price)}</div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                    <>
                      <div className="c-sub2">
                        🍕 Sabores adicionais
                        <span className="c-hint">(até {maxExtras} · {selectedExtraIds.length} selecionado{selectedExtraIds.length !== 1 ? "s" : ""})</span>
                      </div>
                      <input
                        className="c-flavor-search"
                        placeholder="Pesquisar sabor..."
                        value={flavorSearch}
                        onChange={(e) => setFlavorSearch(e.target.value)}
                      />
                      <div className="c-flavor-list">
                        {visibleFlavors.map((f) => {
                          const sel = selectedExtraIds.includes(f.id);
                          return (
                            <button key={f.id} className={`c-flavor-item ${sel ? "selected" : ""}`} onClick={() => toggleFlavor(f.id)}>
                              <div className="c-flavor-check">{sel ? "✓" : ""}</div>
                              <div className="c-flavor-text">
                                <div className="c-flavor-name">{f.nome}</div>
                                <div className="c-flavor-desc">{f.descricao || f.descricao_curta || ""}</div>
                              </div>
                              <div className="c-flavor-price-tag">{formatBRL(f.preco_sugerido)}</div>
                            </button>
                          );
                        })}
                        {visibleFlavors.length === 0 && (
                          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: 12 }}>Nenhum sabor encontrado.</div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedPizzaSize && pizzaBordas.length > 0 && (
                    <>
                      <div className="c-sub2">🥯 Borda recheada <span className="c-hint">(opcional)</span></div>
                      <div className="c-bordas-grid">
                        <button
                          className={`c-borda-btn ${!selectedBordaId ? "active" : ""}`}
                          onClick={() => setSelectedBordaId("")}
                        >
                          <div className="c-borda-name">Sem borda</div>
                          <div className="c-borda-price">Grátis</div>
                        </button>
                        {pizzaBordas.map((b) => {
                          const price = selectedPizzaSize.tamanhoId ? getBordaPriceForSize(b.id, selectedPizzaSize.tamanhoId) : 0;
                          return (
                            <button
                              key={b.id}
                              className={`c-borda-btn ${selectedBordaId === b.id ? "active" : ""}`}
                              onClick={() => setSelectedBordaId(b.id)}
                            >
                              <div className="c-borda-name">{b.nome}</div>
                              <div className="c-borda-price">+ {formatBRL(price)}</div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              <div style={{ marginBottom: 14 }}>
                <div className="c-sub2">📝 Observações <span className="c-hint">(opcional)</span></div>
                <textarea
                  className="c-obs-input"
                  rows={2}
                  placeholder="Ex: sem cebola, bem assada, molho extra..."
                  value={selectedObs}
                  onChange={(e) => setSelectedObs(e.target.value)}
                />
              </div>
            </div>
            <div className="c-modal-footer">
              <div className="c-qty-ctrl">
                <button className="c-qty-btn" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="c-qty-val">{selectedQty}</span>
                <button className="c-qty-btn" onClick={() => setSelectedQty((q) => q + 1)}>+</button>
              </div>
              <button
                className="c-add-btn"
                onClick={addToCart}
                disabled={isPizzaProduct(selectedProduct) && !selectedPizzaSize}
              >
                🛒 Adicionar {formatBRL(finalModalPrice * selectedQty)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="c-cart-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
          <div className="c-cart-drawer">
            <div className="c-cart-head">
              <div className="c-cart-title">🛒 Meu pedido</div>
              <button className="c-icon-btn" onClick={() => setCartOpen(false)}>✕</button>
            </div>
            <div className="c-cart-body">
              {cart.length === 0 ? (
                <div className="c-empty-cart">
                  <div className="c-empty-icon">🛒</div>
                  <div className="c-empty-text">Seu carrinho está vazio</div>
                </div>
              ) : (
                cart.map((it, idx) => (
                  <div key={`${it.product.id}-${idx}`} className="c-cart-item">
                    <div className="c-cart-item-info">
                      <div className="c-cart-item-name">{it.product.nome}</div>
                      {it.observations && <div className="c-cart-item-obs">{it.observations}</div>}
                      <div className="c-cart-item-price">{formatBRL(it.product.preco_sugerido * it.quantity)}</div>
                      <div className="c-cq-wrap">
                        <button className="c-cq-btn" onClick={() => updateQuantity(idx, -1)}>−</button>
                        <span className="c-cq-val">{it.quantity}</span>
                        <button className="c-cq-btn" onClick={() => updateQuantity(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="c-cart-form">
                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Nome</label>
                    <input className="c-form-input" placeholder="Seu nome" value={customer.nome}
                      onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">WhatsApp</label>
                    <input className="c-form-input" placeholder="(00) 00000-0000" inputMode="tel" value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} />
                  </div>
                </div>
                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Atendimento</label>
                    <select className="c-form-select" value={customer.tipo_atendimento}
                      onChange={(e) => setCustomer({ ...customer, tipo_atendimento: e.target.value })}>
                      {config.aceita_entrega !== false && <option value="entrega">🛵 Entrega</option>}
                      {config.aceita_retirada !== false && <option value="retirada">🏃 Retirada</option>}
                    </select>
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Pagamento</label>
                    <select className="c-form-select" value={customer.forma_pagamento}
                      onChange={(e) => setCustomer({ ...customer, forma_pagamento: e.target.value })}>
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </div>
                </div>
                {customer.tipo_atendimento === "entrega" && (
                  <div className="c-form-field" style={{ marginBottom: 11 }}>
                    <label className="c-form-label">Endereço de entrega</label>
                    <textarea className="c-form-textarea" rows={2} placeholder="Rua, nº, bairro, ponto de referência"
                      value={customer.endereco}
                      onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
                  </div>
                )}
                <div className="c-form-field" style={{ marginBottom: 13 }}>
                  <label className="c-form-label">Observações do pedido</label>
                  <textarea className="c-form-textarea" rows={2} placeholder="Alguma instrução especial?"
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })} />
                </div>
                <div className="c-total-box">
                  <div className="c-total-row"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
                  <div className="c-total-row"><span>Taxa de entrega</span><span>{formatBRL(deliveryFee)}</span></div>
                  <div className="c-total-final"><span>Total</span><span className="c-total-val">{formatBRL(total)}</span></div>
                </div>
                <button className="c-submit-btn" onClick={submitOrder} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "🚀"} Confirmar pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minha Conta */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-md w-[calc(100%-1rem)] rounded-2xl bg-[#1A1410] border-[rgba(255,180,100,0.22)] text-[#F5EAD8]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display',serif" }}>
              <User className="h-5 w-5" style={{ color: "#FF6B1A" }} />
              {isLogged ? "Minha conta" : "Meu cadastro"}
            </DialogTitle>
          </DialogHeader>
          {!isLogged ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm" style={{ color: "#B8A898" }}>
                Cadastro rápido — acumule pontos e não precise digitar seus dados a cada pedido.
              </p>
              <div>
                <label className="c-form-label">Nome</label>
                <input className="c-form-input" placeholder="Seu nome"
                  value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
              </div>
              <div>
                <label className="c-form-label">WhatsApp</label>
                <input className="c-form-input" inputMode="tel" placeholder="(00) 00000-0000"
                  value={customer.telefone} onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} />
              </div>
              <div>
                <label className="c-form-label">Endereço</label>
                <textarea className="c-form-textarea" rows={2} placeholder="Rua, nº, bairro"
                  value={customer.endereco} onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
              </div>
              <button className="c-submit-btn" onClick={() => {
                if (!customer.nome.trim() || !customer.telefone.trim()) { toast.error("Informe nome e WhatsApp"); return; }
                try {
                  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                    nome: customer.nome, telefone: customer.telefone,
                    tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
                    endereco: customer.endereco,
                  }));
                } catch {/* ignore */}
                toast.success("Cadastro salvo!");
                openAccount();
              }}>Salvar cadastro</button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#FF6B1A,#FF4500)" }}>
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Star className="h-4 w-4 fill-current" /> Programa de fidelidade
                </div>
                <div className="mt-2 text-3xl font-extrabold">
                  {accountLoading ? "…" : (accountData?.pontos ?? 0)} <span className="text-base font-medium opacity-90">pontos</span>
                </div>
                <div className="text-xs opacity-90 mt-1">
                  {accountLoading ? "Carregando..." : `${accountData?.pedidos ?? 0} pedido(s) • ${formatBRL(accountData?.total ?? 0)} acumulados`}
                </div>
                <div className="text-[11px] opacity-80 mt-2">A cada R$ 10,00 em pedidos você ganha 1 ponto.</div>
              </div>
              <div className="rounded-xl border p-3 space-y-2 text-sm" style={{ borderColor: "rgba(255,180,100,0.12)" }}>
                <div className="flex justify-between"><span style={{ color: "#B8A898" }}>Nome</span><span>{customer.nome}</span></div>
                <div className="flex justify-between"><span style={{ color: "#B8A898" }}>WhatsApp</span><span>{customer.telefone}</span></div>
                {customer.endereco && (
                  <div className="flex justify-between gap-3"><span style={{ color: "#B8A898" }} className="shrink-0">Endereço</span><span className="text-right">{customer.endereco}</span></div>
                )}
              </div>
              <div className="space-y-2">
                <label className="c-form-label">Editar endereço</label>
                <textarea className="c-form-textarea" rows={2} value={customer.endereco}
                  onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
                <button className="c-submit-btn" style={{ height: 42, fontSize: 13 }} onClick={() => {
                  try {
                    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                      nome: customer.nome, telefone: customer.telefone,
                      tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
                      endereco: customer.endereco,
                    }));
                    toast.success("Dados atualizados");
                  } catch {/* ignore */}
                }}>Atualizar dados</button>
              </div>
              <button onClick={logoutAccount} className="w-full text-sm py-2 rounded-lg flex items-center justify-center gap-2"
                style={{ color: "#ff6b6b", background: "rgba(255,107,107,.08)" }}>
                <LogOut className="h-4 w-4" /> Sair deste dispositivo
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

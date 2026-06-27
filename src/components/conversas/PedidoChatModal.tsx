import { useEffect, useMemo, useRef, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CARDAPIO_CSS, CARDAPIO_CHAT_CSS, categoryEmoji } from "@/styles/cardapioTheme";

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
  tipo_produto?: string | null;
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
  const [activePill, setActivePill] = useState<string>("destaques");
  const [flavorSearch, setFlavorSearch] = useState("");
  const [step, setStep] = useState<"cardapio" | "checkout">("cardapio");
  const menuScrollRef = useRef<HTMLDivElement>(null);

  // Pizza configurator
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [selectedBordaId, setSelectedBordaId] = useState<string>("");

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
      setActivePill("destaques");
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

      // 1) Endereço salvo direto no lead
      let leadEnd: any = leadRes?.data;

      // 2) Fallback: buscar lead pelo telefone (mesmo sem leadId vinculado)
      if ((!leadEnd || !leadEnd.endereco_logradouro) && clienteTelefone) {
        const telLimpo = String(clienteTelefone).replace(/\D/g, "");
        if (telLimpo.length >= 10) {
          const { data: leadByPhone } = await (supabase.from("leads") as any)
            .select("endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
            .eq("company_id", companyId)
            .or(`telefone.eq.${telLimpo},phone.eq.${telLimpo}`)
            .not("endereco_logradouro", "is", null)
            .limit(1)
            .maybeSingle();
          if (leadByPhone?.endereco_logradouro) leadEnd = leadByPhone;
        }
      }

      // 3) Fallback final: último pedido_enderecos do telefone
      if ((!leadEnd || !leadEnd.endereco_logradouro) && clienteTelefone) {
        const telLimpo = String(clienteTelefone).replace(/\D/g, "");
        if (telLimpo.length >= 10) {
          const { data: lastEnd } = await (supabase.from("pedido_enderecos" as any) as any)
            .select("logradouro, numero, complemento, bairro, cidade, estado, cep")
            .eq("company_id", companyId)
            .eq("telefone_contato", telLimpo)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastEnd?.logradouro) {
            leadEnd = {
              endereco_logradouro: lastEnd.logradouro,
              endereco_numero: lastEnd.numero,
              endereco_complemento: lastEnd.complemento,
              endereco_bairro: lastEnd.bairro,
              endereco_cidade: lastEnd.cidade,
              endereco_estado: lastEnd.estado,
              endereco_cep: lastEnd.cep,
            };
          }
        }
      }

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
    const descricao = (product.descricao || "").toLowerCase();
    const descricaoCurta = (product.descricao_curta || "").toLowerCase();
    return !!product.permite_meio_a_meio ||
      product.tipo_produto === "pizza" ||
      nome.includes("pizza") ||
      categoria.includes("pizza") ||
      descricao.includes("pizza") ||
      descricaoCurta.includes("pizza");
  };

  const isPromotionActive = (product: Product) => {
    if (!product.promocao_ativa) return false;
    const promoPrice = Number((product as any).promocao_preco || 0);
    if (promoPrice <= 0 && !(product as any).promocao_nota) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = (product as any).promocao_inicio ? new Date(`${(product as any).promocao_inicio}T00:00:00`) : null;
    const end = (product as any).promocao_fim ? new Date(`${(product as any).promocao_fim}T23:59:59`) : null;

    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
  };

  const displayPrice = (product: Product) => {
    if (isPromotionActive(product) && Number((product as any).promocao_preco || 0) > 0) {
      return Number((product as any).promocao_preco);
    }
    return Number(product.preco_sugerido || 0);
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

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        (p.descricao_curta || "").toLowerCase().includes(term) ||
        (p.descricao || "").toLowerCase().includes(term) ||
        (p.categoria || "").toLowerCase().includes(term)
    );
  }, [products, search]);

  const categories = useMemo(
    () => Array.from(new Set(filteredProducts.map((p) => p.categoria || "Outros"))),
    [filteredProducts]
  );

  const destaques = useMemo(
    () => products.filter((p) => p.destaque_cardapio).slice(0, 10),
    [products]
  );
  const topShown = destaques.length > 0 ? destaques : products.slice(0, 8);

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
    // Não-pizza: adiciona direto com preço promocional quando aplicável
    const productToAdd = { ...product, preco_sugerido: displayPrice(product) };
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === productToAdd.id && !i.observations);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product: productToAdd, quantity: 1, observations: "" }];
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
      const pizzaProduct = { ...selectedProduct, preco_sugerido: displayPrice(selectedProduct) };
      const basePrice = computePizzaPrice(pizzaProduct, validExtras, selectedPizzaSize.multiplier);
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

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const nomeLoja = storeConfig?.nome_loja || "Cardápio";
  const taxa = Number(storeConfig?.taxa_entrega || 0);
  const minimo = Number(storeConfig?.pedido_minimo || 0);

  const scrollToSection = (id: string) => {
    setActivePill(id);
    menuScrollRef.current?.querySelector(`#c-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      const pizzaProduct = { ...selectedProduct, preco_sugerido: displayPrice(selectedProduct) };
      const base = computePizzaPrice(pizzaProduct, selectedExtraIds, selectedPizzaSize.multiplier);
      const bordaPrice =
        selectedBorda && selectedPizzaSize.tamanhoId
          ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId)
          : 0;
      return Math.round((base + bordaPrice) * 100) / 100;
    }
    return displayPrice(selectedProduct);
  })();

  useEffect(() => {
    if (!selectedProduct) return;
    setFlavorSearch("");
    if (isPizzaProduct(selectedProduct)) {
      setSelectedSize("");
      setExtraFlavors([]);
      setSelectedBordaId("");
    }
  }, [selectedProduct]);

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

      for (const item of cart) {
        const produtoId = String(item.product.id).split("__")[0];
        const valorUnitario = Number(item.product.preco_sugerido || 0);
        const { error: iErr } = await supabase.rpc("registrar_item_pedido_com_custo" as any, {
          p_pedido_id: pedidoData.id,
          p_company_id: companyId,
          p_produto_id: produtoId,
          p_produto_nome: item.product.nome,
          p_quantidade: item.quantity,
          p_valor_unitario: valorUnitario,
          p_observacoes: item.observations || null,
        });
        if (iErr) {
          const msg = String(iErr.message || "");
          const rpcNaoExiste = iErr.code === "PGRST202" || msg.includes("registrar_item_pedido_com_custo") || msg.includes("Could not find the function");
          if (!rpcNaoExiste) throw iErr;

          const { error: insertErr } = await supabase.from("pedido_itens" as any).insert({
            pedido_id: pedidoData.id,
            company_id: companyId,
            produto_id: produtoId,
            produto_nome: item.product.nome,
            quantidade: item.quantity,
            valor_unitario: valorUnitario,
            valor_total: valorUnitario * item.quantity,
            observacoes: item.observations || null,
          });
          if (insertErr) throw insertErr;
        }
      }

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

      // 🍕 Acumular selos no cartão fidelidade (1 selo por pizza)
      try {
        const pizzasQty = cart.reduce((acc, i) => {
          const isPz =
            !!i.product.permite_meio_a_meio ||
            (i.product.nome || "").toLowerCase().includes("pizza") ||
            (i.product.categoria || "").toLowerCase().includes("pizza");
          return acc + (isPz ? i.quantity : 0);
        }, 0);

        if (pizzasQty > 0 && leadId) {
          const { data: existingCard } = await (supabase.from("loyalty_cards" as any) as any)
            .select("selos_atuais, total_premios_resgatados")
            .eq("company_id", companyId)
            .eq("lead_id", leadId)
            .maybeSingle();

          const currentStamps = (existingCard as any)?.selos_atuais || 0;
          const totalRedeemed = (existingCard as any)?.total_premios_resgatados || 0;

          await (supabase.from("loyalty_cards" as any) as any).upsert(
            {
              company_id: companyId,
              lead_id: leadId,
              selos_atuais: currentStamps + pizzasQty,
              total_premios_resgatados: totalRedeemed,
              ultimo_selo_em: new Date().toISOString(),
            },
            { onConflict: "company_id,lead_id" }
          );
        }
      } catch (loyaltyErr) {
        console.error("Erro ao acumular selos fidelidade:", loyaltyErr);
      }

      // 📲 Enviar mensagem de confirmação via WhatsApp
      try {
        const telefoneEnvio = String(customer.telefone || "").replace(/\D/g, "");
        if (telefoneEnvio.length >= 10) {
          const itensTexto = cart
            .map(
              (it) =>
                `• ${it.quantity}x ${it.product.nome} - ${formatBRL(
                  Number(it.product.preco_sugerido || 0) * it.quantity
                )}`
            )
            .join("\n");
          const tipoAtend = customer.tipo_atendimento === "entrega" ? "🛵 Entrega" : "🏠 Retirada";
          const enderecoLinha = customer.endereco ? `\n📍 *Endereço:* ${customer.endereco}` : "";
          const taxaLinha = deliveryFee > 0 ? `\nTaxa de entrega: ${formatBRL(deliveryFee)}` : "";
          const nomeLoja = storeConfig?.nome_loja || "nossa loja";
          const mensagem = `🍕 *Pedido confirmado!*\n\nOlá ${customer.nome}, recebemos seu pedido *${pedidoData.codigo_pedido}* na ${nomeLoja}.\n\n*Itens:*\n${itensTexto}\n\nSubtotal: ${formatBRL(subtotal)}${taxaLinha}\n*Total: ${formatBRL(total)}*\n\n${tipoAtend}\n💳 *Pagamento:* ${customer.forma_pagamento}${enderecoLinha}\n\nObrigado pela preferência! 🧡`;

          await supabase.functions.invoke("enviar-whatsapp", {
            body: {
              company_id: companyId,
              numero: telefoneEnvio,
              mensagem,
              origem: "chat-pedido",
            },
          });
        }
      } catch (msgErr) {
        console.error("Erro ao enviar confirmação WhatsApp:", msgErr);
      }

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
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 gap-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>Novo Pedido — {clienteNome || "Cliente"}</DialogTitle>
        </VisuallyHidden>
        <style>{CARDAPIO_CSS}{CARDAPIO_CHAT_CSS}</style>
        <div className="cardapio-root cardapio-chat-root">
          <header className="c-header">
            <div className="c-logo-wrap">
              <span className="c-logo-flame">🍕</span>
              <span className="c-logo-text">Novo Pedido — {clienteNome || "Cliente"}</span>
            </div>
            <div className="c-header-actions">
              <span className="c-chip" style={{ fontSize: 11 }}>{nomeLoja}</span>
              <button type="button" className="c-icon-btn" onClick={() => onOpenChange(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
          </header>

          {loading ? (
            <div className="cardapio-chat-loading">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : step === "cardapio" ? (
            <>
              <div className="c-status-bar">
                <div className="c-status-open">
                  <span className="c-dot-green" />
                  Pedido via chat · {clienteTelefone || "sem telefone"}
                </div>
                <div className="c-status-chips">
                  {taxa > 0 && <span className="c-chip hot">🛵 Entrega {formatBRL(taxa)}</span>}
                  {minimo > 0 && <span className="c-chip">Mín {formatBRL(minimo)}</span>}
                  <span className="c-chip">Pix · Cartão · Dinheiro</span>
                </div>
              </div>

              <div className="cardapio-chat-body">
                <div className="cardapio-chat-menu">
                  <div className="c-search-wrap">
                    <div className="c-search-inner">
                      <span className="c-search-icon">🔍</span>
                      <input
                        className="c-search-input"
                        placeholder="Buscar pizza, bebida, combo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="c-nav-pills">
                    {topShown.length > 0 && (
                      <button
                        type="button"
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
                          type="button"
                          className={`c-pill ${activePill === id ? "active" : ""}`}
                          onClick={() => scrollToSection(id)}
                        >
                          {categoryEmoji(cat)} {cat} <span className="c-pill-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  <main className="c-main" ref={menuScrollRef}>
                    {topShown.length > 0 && (
                      <section id="c-sec-destaques" className="c-category-section c-fade-up">
                        <div className="c-section-header">
                          <h2 className="c-section-title">🔥 Os mais pedidos</h2>
                          <span className="c-section-sub">Campeões de venda</span>
                        </div>
                        <div className="c-destaques-scroll">
                          {topShown.map((p) => (
                            <div key={p.id} className="c-destaque-card" onClick={() => openProduct(p)}>
                              <span className="c-destaque-badge">★ Popular</span>
                              {p.imagem_url ? (
                                <img src={p.imagem_url} alt={p.nome} className="c-destaque-img" loading="lazy" />
                              ) : (
                                <div className="c-destaque-img-ph">🍕</div>
                              )}
                              <div className="c-destaque-body">
                                <div className="c-destaque-name">{p.nome}</div>
                                <div className="c-destaque-price">{formatBRL(Number(p.preco_sugerido || 0))}</div>
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
                      return (
                        <section key={cat} id={`c-sec-${id}`} className="c-category-section c-fade-up">
                          <div className="c-cat-label">
                            {categoryEmoji(cat)} {cat}{" "}
                            <small>({items.length} {items.length === 1 ? "item" : "itens"})</small>
                          </div>
                          <div className="c-prod-list">
                            {items.map((p) => (
                              <button key={p.id} type="button" className="c-prod-item" onClick={() => openProduct(p)}>
                                <div className="c-prod-info">
                                  <div className="c-prod-name">{p.nome}</div>
                                  <div className="c-prod-desc">
                                    {p.descricao || p.descricao_curta || p.descricao_completa || "—"}
                                  </div>
                                  <div className="c-prod-footer">
                                    <div>
                                      <div className="c-prod-price-from">A partir de</div>
                                      <div className="c-prod-price">{formatBRL(Number(p.preco_sugerido || 0))}</div>
                                    </div>
                                    {isPizzaProduct(p) && <span className="c-half-badge">½ + ½</span>}
                                  </div>
                                </div>
                                <div className="c-prod-img-wrap">
                                  {p.imagem_url ? (
                                    <img src={p.imagem_url} alt={p.nome} className="c-prod-img" loading="lazy" />
                                  ) : (
                                    <div className="c-prod-img-ph">{categoryEmoji(cat)}</div>
                                  )}
                                  <div className="c-add-circle">+</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px" }}>
                        Nenhum item encontrado.
                      </div>
                    )}
                  </main>
                </div>

                <aside className="cardapio-chat-cart">
                  <div className="c-cart-head">
                    <div className="c-cart-title">🛒 Meu pedido ({cartCount})</div>
                  </div>
                  <div className="c-cart-body">
                    {cart.length === 0 ? (
                      <div className="c-empty-cart">
                        <div className="c-empty-icon">🛒</div>
                        <div className="c-empty-text">Seu carrinho está vazio.<br />Adicione itens do cardápio.</div>
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={`${item.product.id}-${idx}`} className="c-cart-item">
                          <div className="c-cart-item-info">
                            <div className="c-cart-item-name">{item.product.nome}</div>
                            {item.observations && <div className="c-cart-item-obs">{item.observations}</div>}
                            <div className="c-cart-item-price">
                              {formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}
                            </div>
                            <textarea
                              className="c-obs-input"
                              rows={1}
                              placeholder="Obs: sem cebola..."
                              value={item.observations}
                              onChange={(e) => updateObs(idx, e.target.value)}
                              style={{ marginTop: 8, fontSize: 12 }}
                            />
                            <div className="c-cq-wrap">
                              <button type="button" className="c-cq-btn" onClick={() => updateQty(idx, -1)}>−</button>
                              <span className="c-cq-val">{item.quantity}</span>
                              <button type="button" className="c-cq-btn" onClick={() => updateQty(idx, 1)}>+</button>
                              <button
                                type="button"
                                className="c-cq-btn"
                                onClick={() => removeItem(idx)}
                                style={{ marginLeft: 8, color: "var(--fire2)" }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="c-cart-foot">
                    <div className="c-total-box" style={{ marginBottom: 12 }}>
                      <div className="c-total-row">
                        <span>Subtotal</span>
                        <span>{formatBRL(subtotal)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="c-submit-btn"
                      disabled={!cart.length}
                      onClick={() => setStep("checkout")}
                    >
                      Continuar → {formatBRL(subtotal)}
                    </button>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="cardapio-chat-checkout">
                <div className="c-cart-title">📋 Finalizar pedido</div>

                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Nome do cliente</label>
                    <input
                      className="c-form-input"
                      value={customer.nome}
                      onChange={(e) => setCustomer({ ...customer, nome: e.target.value })}
                    />
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Telefone</label>
                    <input
                      className="c-form-input"
                      value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Tipo de atendimento</label>
                    <select
                      className="c-form-select"
                      value={customer.tipo_atendimento}
                      onChange={(e) => setCustomer({ ...customer, tipo_atendimento: e.target.value })}
                    >
                      <option value="entrega">🛵 Delivery</option>
                      <option value="retirada">🏃 Retirada no balcão</option>
                      <option value="mesa">🍽️ Mesa / Local</option>
                    </select>
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Forma de pagamento</label>
                    <select
                      className="c-form-select"
                      value={customer.forma_pagamento}
                      onChange={(e) => setCustomer({ ...customer, forma_pagamento: e.target.value })}
                    >
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                    </select>
                  </div>
                </div>

                {customer.forma_pagamento === "dinheiro" && (
                  <div className="c-form-field" style={{ marginBottom: 11 }}>
                    <label className="c-form-label">Troco para (opcional)</label>
                    <input
                      className="c-form-input"
                      type="number"
                      placeholder="Ex: 100"
                      value={customer.troco_para}
                      onChange={(e) => setCustomer({ ...customer, troco_para: e.target.value })}
                    />
                  </div>
                )}

                {customer.tipo_atendimento === "entrega" && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="c-sub2" style={{ marginBottom: 10 }}>
                      📍 Endereço de entrega
                      {enderecoSalvo && <span className="c-hint"> · endereço salvo do cliente</span>}
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field" style={{ gridColumn: "span 2" }}>
                        <label className="c-form-label">Rua / Logradouro</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco}
                          onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">Número</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_numero}
                          onChange={(e) => setCustomer({ ...customer, endereco_numero: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field">
                        <label className="c-form-label">Bairro</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_bairro}
                          onChange={(e) => setCustomer({ ...customer, endereco_bairro: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">Complemento</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_complemento}
                          onChange={(e) => setCustomer({ ...customer, endereco_complemento: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field">
                        <label className="c-form-label">Cidade</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_cidade}
                          onChange={(e) => setCustomer({ ...customer, endereco_cidade: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">UF</label>
                        <input
                          className="c-form-input"
                          maxLength={2}
                          value={customer.endereco_estado}
                          onChange={(e) =>
                            setCustomer({ ...customer, endereco_estado: e.target.value.toUpperCase() })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="c-form-field" style={{ marginBottom: 14 }}>
                  <label className="c-form-label">Observações do pedido</label>
                  <textarea
                    className="c-form-textarea"
                    rows={2}
                    placeholder="Ex: tirar a cebola da pizza..."
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
                  />
                </div>

                <div className="c-total-box">
                  <div className="c-sub2" style={{ marginBottom: 10 }}>Resumo</div>
                  {cart.map((item, idx) => (
                    <div key={idx} className="c-total-row">
                      <span>{item.quantity}x {item.product.nome}</span>
                      <span>{formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="c-total-row">
                    <span>Taxa de entrega</span>
                    <span>{formatBRL(deliveryFee)}</span>
                  </div>
                  <div className="c-total-final">
                    <span>TOTAL</span>
                    <span className="c-total-val">{formatBRL(total)}</span>
                  </div>
                </div>
              </div>

              <div className="cardapio-chat-actions">
                <button type="button" className="cardapio-chat-back" onClick={() => setStep("cardapio")}>
                  ← Voltar ao cardápio
                </button>
                <button type="button" className="c-submit-btn" style={{ flex: 1 }} disabled={submitting} onClick={submitOrder}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : `Confirmar pedido · ${formatBRL(total)}`}
                </button>
              </div>
            </>
          )}

          {selectedProduct && (
            <div
              className="c-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) resetSelection();
              }}
            >
              <div className="c-modal">
                <div style={{ position: "relative" }}>
                  {selectedProduct.imagem_url ? (
                    <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="c-modal-img" />
                  ) : (
                    <div className="c-modal-img-ph">{categoryEmoji(selectedProduct.categoria || "")}</div>
                  )}
                  <button type="button" className="c-modal-close" onClick={resetSelection}>
                    ✕
                  </button>
                </div>
                <div className="c-modal-body">
                  <div className="c-modal-name">{selectedProduct.nome}</div>
                  <div className="c-modal-desc">
                    {selectedProduct.descricao ||
                      selectedProduct.descricao_completa ||
                      selectedProduct.descricao_curta ||
                      "Sem descrição."}
                  </div>
                  <div className="c-modal-price">{formatBRL(finalModalPrice)}</div>

                  {isPizzaProduct(selectedProduct) && (
                    <>
                      <div className="c-sub2">📏 Escolha o tamanho</div>
                      <div className="c-sizes-grid">
                        {SIZE_OPTIONS.map((s) => {
                          const price = computePizzaPrice({ ...selectedProduct, preco_sugerido: displayPrice(selectedProduct) }, [], s.multiplier);
                          const active = selectedSize === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={`c-size-btn ${active ? "active" : ""}`}
                              onClick={() => {
                                setSelectedSize(s.id);
                                setExtraFlavors((prev) => prev.slice(0, s.maxFlavors - 1));
                                setSelectedBordaId("");
                              }}
                              title={s.descricao || ""}
                            >
                              <div className="c-size-name">{s.label}</div>
                              <div className="c-size-info">
                                {s.maxFlavors} sab · {s.slices} fat
                              </div>
                              <div className="c-size-price">{formatBRL(price)}</div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                        <>
                          <div className="c-sub2">
                            🍕 Sabores adicionais
                            <span className="c-hint">
                              (até {maxExtras} · {selectedExtraIds.length} selecionado
                              {selectedExtraIds.length !== 1 ? "s" : ""})
                            </span>
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
                                <button
                                  key={f.id}
                                  type="button"
                                  className={`c-flavor-item ${sel ? "selected" : ""}`}
                                  onClick={() => toggleFlavor(f.id)}
                                >
                                  <div className="c-flavor-check">{sel ? "✓" : ""}</div>
                                  <div className="c-flavor-text">
                                    <div className="c-flavor-name">{f.nome}</div>
                                    <div className="c-flavor-desc">{f.descricao || f.descricao_curta || ""}</div>
                                  </div>
                                  <div className="c-flavor-price-tag">{formatBRL(Number(f.preco_sugerido || 0))}</div>
                                </button>
                              );
                            })}
                            {visibleFlavors.length === 0 && (
                              <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: 12 }}>
                                Nenhum sabor encontrado.
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {selectedPizzaSize && pizzaBordas.length > 0 && (
                        <>
                          <div className="c-sub2">
                            🥯 Borda recheada <span className="c-hint">(opcional)</span>
                          </div>
                          <div className="c-bordas-grid">
                            <button
                              type="button"
                              className={`c-borda-btn ${!selectedBordaId ? "active" : ""}`}
                              onClick={() => setSelectedBordaId("")}
                            >
                              <div className="c-borda-name">Sem borda</div>
                              <div className="c-borda-price">Grátis</div>
                            </button>
                            {pizzaBordas.map((b) => {
                              const price = selectedPizzaSize.tamanhoId
                                ? getBordaPriceForSize(b.id, selectedPizzaSize.tamanhoId)
                                : 0;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
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
                    <div className="c-sub2">
                      📝 Observações <span className="c-hint">(opcional)</span>
                    </div>
                    <textarea
                      className="c-obs-input"
                      rows={2}
                      placeholder="Ex: sem cebola, bem assada..."
                      value={selectedObs}
                      onChange={(e) => setSelectedObs(e.target.value)}
                    />
                  </div>
                </div>
                <div className="c-modal-footer">
                  <div className="c-qty-ctrl">
                    <button type="button" className="c-qty-btn" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}>
                      −
                    </button>
                    <span className="c-qty-val">{selectedQty}</span>
                    <button type="button" className="c-qty-btn" onClick={() => setSelectedQty((q) => q + 1)}>
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="c-add-btn"
                    onClick={addPizzaToCart}
                    disabled={isPizzaProduct(selectedProduct) && !selectedPizzaSize}
                  >
                    🛒 Adicionar {formatBRL(finalModalPrice * selectedQty)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { AlertTriangle, Bike, Check, Clock, Copy, MapPin, Navigation, Phone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Entregador = {
  id: string;
  company_id: string;
  nome: string;
  telefone: string | null;
  veiculo: string;
  pct_comissao: number;
  pix_chave: string | null;
  avaliacao_media: number;
  online: boolean;
};

type Pedido = {
  id: string;
  company_id: string;
  codigo_pedido: string;
  cliente_nome: string;
  cliente_telefone?: string | null;
  status: PedidoStatus;
  total: number;
  created_at: string;
  entregador_id?: string | null;
  valor_comissao?: number | null;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  observacoes: string | null;
};

type Endereco = {
  pedido_id: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  referencia: string | null;
};

type DriverLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  created_at?: string;
};

function today(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function onlyDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function phoneMatches(left: string | null | undefined, right: string | null | undefined) {
  const a = onlyDigits(left);
  const b = onlyDigits(right);
  if (!a || !b) return false;
  return a === b || a.slice(-11) === b.slice(-11) || a.slice(-10) === b.slice(-10);
}

function formatAddress(endereco?: Endereco) {
  if (!endereco) return "Endereco nao informado";
  return [
    [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
    endereco.complemento,
    endereco.bairro,
    endereco.cidade,
  ].filter(Boolean).join(" - ") || "Endereco nao informado";
}

const inputStyle = {
  width: "100%",
  background: "#0f0f12",
  border: "1px solid #2a2a3e",
  borderRadius: 12,
  color: "#f5f5f5",
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
} as const;

const buttonStyle = {
  width: "100%",
  border: 0,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;

export default function EntregadorApp() {
  const [loading, setLoading] = useState(true);
  const [telefoneVinculo, setTelefoneVinculo] = useState("");
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState<Pedido[]>([]);
  const [itensByPedido, setItensByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [enderecosByPedido, setEnderecosByPedido] = useState<Record<string, Endereco>>({});
  const [saving, setSaving] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstallHint, setIosInstallHint] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [lastLocation, setLastLocation] = useState<DriverLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<"idle" | "active" | "blocked">("idle");
  const [pedidosRecusados, setPedidosRecusados] = useState<Set<string>>(new Set());
  const lastLocationSentAt = useRef(0);

  useEffect(() => {
    registerSW({ immediate: true });

    document.title = "App do Entregador";
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("theme-color", "#1a1a2e");
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    setMeta("apple-mobile-web-app-title", "Entregador");
    setMeta("mobile-web-app-capable", "yes");

    const manifest = {
      id: "/entregador",
      name: "App do Entregador",
      short_name: "Entregador",
      description: "Acesso dos entregadores para pegar pedidos e concluir entregas.",
      start_url: "/entregador",
      scope: "/entregador",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0f0f12",
      theme_color: "#1a1a2e",
      lang: "pt-BR",
      categories: ["business", "food", "productivity"],
      icons: [
        { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const manifestUrl = URL.createObjectURL(blob);
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = manifestUrl;

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = "/pwa/icon-192.png";

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const loadEntregadorById = useCallback(async (id: string) => {
    const rpc = await (supabase.rpc("entregador_app_get_entregador" as any, { p_entregador_id: id }) as any);
    if (rpc.data && !rpc.error) {
      setEntregador(rpc.data);
      return rpc.data as Entregador;
    }

    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("*")
      .eq("id", id)
      .eq("status", "ativo")
      .maybeSingle();

    if (error) {
      console.error("[EntregadorApp] erro ao carregar entregador", error);
      setEntregador(null);
      return null;
    }

    setEntregador(data || null);
    return (data || null) as Entregador | null;
  }, []);

  const findEntregadorByPhone = useCallback(async (phone: string) => {
    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("*")
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[EntregadorApp] erro ao buscar entregador por telefone", error);
      return null;
    }

    return ((data || []) as Entregador[]).find((item) => phoneMatches(item.telefone, phone)) || null;
  }, []);

  const loadPedidos = useCallback(async (ent: Entregador) => {
    const rpc = await (supabase.rpc("entregador_app_get_data" as any, { p_entregador_id: ent.id }) as any);
    if (rpc.data && !rpc.error) {
      const payload = rpc.data as {
        entregador?: Entregador;
        pedidos?: Pedido[];
        disponiveis?: Pedido[];
        itens?: PedidoItem[];
        enderecos?: Endereco[];
      };

      if (payload.entregador) setEntregador(payload.entregador);
      const rows = payload.pedidos || [];
      const disponiveis = payload.disponiveis || [];
      setPedidos(rows);
      setPedidosDisponiveis(disponiveis);

      const groupedItens: Record<string, PedidoItem[]> = {};
      for (const item of payload.itens || []) {
        if (!groupedItens[item.pedido_id]) groupedItens[item.pedido_id] = [];
        groupedItens[item.pedido_id].push(item);
      }
      setItensByPedido(groupedItens);

      const groupedEnderecos: Record<string, Endereco> = {};
      for (const endereco of payload.enderecos || []) {
        groupedEnderecos[endereco.pedido_id] = endereco;
      }
      setEnderecosByPedido(groupedEnderecos);
      return;
    }

    const [meusPedidosRes, disponiveisRes] = await Promise.all([
      (supabase.from("pedidos" as any) as any)
        .select("*")
        .eq("entregador_id", ent.id)
        .in("status", ["saiu_entrega", "entregue"])
        .order("created_at", { ascending: false })
        .limit(30),
      (supabase.from("pedidos" as any) as any)
        .select("*")
        .eq("company_id", ent.company_id)
        .eq("status", "pronto")
        .is("entregador_id", null)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    if (meusPedidosRes.error || disponiveisRes.error) {
      console.error("[EntregadorApp] erro ao carregar pedidos", meusPedidosRes.error || disponiveisRes.error);
      return;
    }

    const rows: Pedido[] = meusPedidosRes.data || [];
    const disponiveis: Pedido[] = disponiveisRes.data || [];
    setPedidos(rows);
    setPedidosDisponiveis(disponiveis);

    const ids = [...rows, ...disponiveis].map((p) => p.id);
    if (ids.length === 0) {
      setItensByPedido({});
      setEnderecosByPedido({});
      return;
    }

    const [itensRes, enderecosRes] = await Promise.all([
      (supabase.from("pedido_itens" as any) as any).select("*").in("pedido_id", ids),
      (supabase.from("pedido_enderecos" as any) as any).select("*").in("pedido_id", ids),
    ]);

    if (!itensRes.error) {
      const grouped: Record<string, PedidoItem[]> = {};
      for (const item of (itensRes.data || [])) {
        if (!grouped[item.pedido_id]) grouped[item.pedido_id] = [];
        grouped[item.pedido_id].push(item);
      }
      setItensByPedido(grouped);
    }

    if (!enderecosRes.error) {
      const grouped: Record<string, Endereco> = {};
      for (const endereco of (enderecosRes.data || [])) {
        grouped[endereco.pedido_id] = endereco;
      }
      setEnderecosByPedido(grouped);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!mounted) return;

      const savedId = localStorage.getItem("entregador_app_id");
      if (savedId) {
        const ent = await loadEntregadorById(savedId);
        if (ent) {
          await loadPedidos(ent);
        } else {
          localStorage.removeItem("entregador_app_id");
        }
      }
      setLoading(false);
    };

    init();

    return () => {
      mounted = false;
    };
  }, [loadEntregadorById, loadPedidos]);

  useEffect(() => {
    if (!entregador) return;
    const channel = supabase
      .channel(`entregador-app-${entregador.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `entregador_id=eq.${entregador.id}` },
        () => loadPedidos(entregador)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${entregador.company_id}` },
        () => loadPedidos(entregador)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_itens" },
        () => loadPedidos(entregador)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entregador, loadPedidos]);

  const pedidoAtivo = pedidos.find((p) => p.status === "saiu_entrega");
  const historicoHoje = pedidos.filter((p) => p.status === "entregue" && today(p.created_at));
  const ganhosHoje = historicoHoje.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);
  const comissaoPedidoAtivo = pedidoAtivo
    ? Number(pedidoAtivo.valor_comissao || pedidoAtivo.total * ((entregador?.pct_comissao ?? 10) / 100))
    : 0;

  const trackingUrl = pedidoAtivo ? `https://pediaiab.lovable.app/acompanhar/${pedidoAtivo.id}` : "";

  useEffect(() => {
    if (!entregador || !pedidoAtivo || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          created_at: new Date().toISOString(),
        };
        setLastLocation(location);
        setLocationPermission("active");

        if (now - lastLocationSentAt.current < 15000) return;
        lastLocationSentAt.current = now;

        const { error } = await (supabase.rpc("entregador_app_update_location" as any, {
          p_entregador_id: entregador.id,
          p_pedido_id: pedidoAtivo.id,
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_accuracy: location.accuracy,
          p_heading: location.heading,
          p_speed: location.speed,
        }) as any);

        if (error) {
          console.error("[EntregadorApp] erro ao enviar localizacao", error);
        }
      },
      (error) => {
        console.error("[EntregadorApp] geolocation", error);
        setLocationPermission("blocked");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [entregador, pedidoAtivo]);

  const vincularTelefone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!telefoneVinculo.trim()) {
      toast.error("Informe o telefone cadastrado");
      return;
    }

    setSaving(true);

    let entregadorEncontrado: Entregador | null = null;
    const publicRpc = await (supabase.rpc("link_entregador_by_phone_public" as any, { p_phone: telefoneVinculo }) as any);

    if (publicRpc.data && !publicRpc.error) {
      entregadorEncontrado = publicRpc.data as Entregador;
    } else {
      const privateRpc = await (supabase.rpc("link_entregador_by_phone" as any, { p_phone: telefoneVinculo }) as any);
      if (privateRpc.data && !privateRpc.error) {
        entregadorEncontrado = privateRpc.data as Entregador;
      } else {
        entregadorEncontrado = await findEntregadorByPhone(telefoneVinculo);
      }
    }

    setSaving(false);

    if (!entregadorEncontrado) {
      toast.error("Nao encontrei entregador ativo com esse telefone. Confira o cadastro na aba Entregadores.");
      return;
    }

    localStorage.setItem("entregador_app_id", entregadorEncontrado.id);
    setEntregador(entregadorEncontrado);
    await loadPedidos(entregadorEncontrado);
    toast.success("Acesso vinculado ao entregador");
  };

  const toggleOnline = async () => {
    if (!entregador) return;
    const next = !entregador.online;
    setEntregador({ ...entregador, online: next });
    const rpc = await (supabase.rpc("entregador_app_toggle_online" as any, {
      p_entregador_id: entregador.id,
      p_online: next,
    }) as any);
    const direct = rpc.error
      ? await (supabase.from("entregadores" as any) as any)
      .update({ online: next })
      .eq("id", entregador.id)
      : { error: null };

    if (direct.error) {
      setEntregador({ ...entregador, online: !next });
      toast.error("Erro ao atualizar status");
      return;
    }

    if (rpc.data) setEntregador(rpc.data as Entregador);
    await loadPedidos({ ...entregador, online: next });
  };

  const recusarPedido = async () => {
    if (!pedidoAtivo) return;
    setSaving(true);
    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({
        status: "pronto",
        entregador_id: null,
        valor_comissao: null,
        aceito_entregador_em: null,
      })
      .eq("id", pedidoAtivo.id);

    setSaving(false);
    if (error) {
      toast.error("Erro ao recusar entrega");
      return;
    }

    toast.success("Entrega devolvida para o restaurante");
    if (entregador) await loadPedidos(entregador);
  };

  const pegarPedido = async (pedido: Pedido) => {
    if (!entregador) return;
    if (!entregador.online) {
      toast.error("Fique online antes de pegar pedidos");
      return;
    }

    setSaving(true);
    const rpc = await (supabase.rpc("entregador_app_pegar_pedido" as any, {
      p_entregador_id: entregador.id,
      p_pedido_id: pedido.id,
    }) as any);

    if (rpc.error) {
      const valorComissao = Number(pedido.total || 0) * ((entregador.pct_comissao ?? 10) / 100);
      const { error } = await (supabase.from("pedidos" as any) as any)
      .update({
        entregador_id: entregador.id,
        status: "saiu_entrega",
        valor_comissao: valorComissao,
        aceito_entregador_em: new Date().toISOString(),
      })
      .eq("id", pedido.id)
      .eq("company_id", entregador.company_id)
      .eq("status", "pronto")
      .is("entregador_id", null);

      if (!error) {
        await (supabase.from("pedido_eventos" as any) as any).insert({
          pedido_id: pedido.id,
          company_id: pedido.company_id,
          status: "entregador_pegou_pedido",
          descricao: `Entregador ${entregador.nome} pegou o pedido #${pedido.codigo_pedido}`,
        });
      }

      if (error) {
        setSaving(false);
        toast.error("Esse pedido nao esta mais disponivel");
        await loadPedidos(entregador);
        return;
      }
    }

    setSaving(false);
    toast.success(`Pedido #${pedido.codigo_pedido} iniciado`);
    await loadPedidos(entregador);
  };

  const concluirEntrega = async () => {
    if (!pedidoAtivo) return;
    setSaving(true);
    const rpc = await (supabase.rpc("entregador_app_concluir_pedido" as any, {
      p_entregador_id: entregador?.id,
      p_pedido_id: pedidoAtivo.id,
    }) as any);
    const direct = rpc.error
      ? await (supabase.from("pedidos" as any) as any)
      .update({
        status: "entregue",
        entregue_em: new Date().toISOString(),
      })
      .eq("id", pedidoAtivo.id)
      : { error: null };

    if (rpc.error && !direct.error) {
      await (supabase.from("pedido_eventos" as any) as any).insert({
        pedido_id: pedidoAtivo.id,
        company_id: pedidoAtivo.company_id,
        status: "entrega_concluida",
        descricao: `Entregador confirmou entrega do pedido #${pedidoAtivo.codigo_pedido}`,
      });
    }

    setSaving(false);
    if (direct.error) {
      toast.error("Erro ao concluir entrega");
      return;
    }

    toast.success("Entrega concluida");
    if (entregador) await loadPedidos(entregador);
  };

  const sair = async () => {
    localStorage.removeItem("entregador_app_id");
    setEntregador(null);
    setPedidos([]);
    setPedidosDisponiveis([]);
    setItensByPedido({});
    setEnderecosByPedido({});
    setPedidosRecusados(new Set());
  };

  const instalarApp = async () => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setIosInstallHint(true);
      return;
    }

    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallDismissed(true);
  };

  const itensAtivos = pedidoAtivo ? itensByPedido[pedidoAtivo.id] || [] : [];
  const enderecoAtivo = pedidoAtivo ? enderecosByPedido[pedidoAtivo.id] : undefined;
  const ganhosSemana = useMemo(
    () => pedidos
      .filter((p) => p.status === "entregue")
      .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
    [pedidos]
  );
  const pedidosVisiveis = pedidosDisponiveis.filter((pedido) => !pedidosRecusados.has(pedido.id));

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Carregando...
      </div>
    );
  }

  if (!entregador) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <form onSubmit={vincularTelefone} style={{ width: "100%", maxWidth: 380, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>Vincular entregador</div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Digite o mesmo telefone cadastrado pelo restaurante.</div>
          </div>
          <input value={telefoneVinculo} onChange={(e) => setTelefoneVinculo(e.target.value)} placeholder="Telefone cadastrado" style={inputStyle} />
          <button disabled={saving} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16" }}>
            {saving ? "Vinculando..." : "Vincular meu acesso"}
          </button>
          <button type="button" onClick={sair} style={{ ...buttonStyle, background: "#252540", color: "#aaa" }}>Sair</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", color: "#fff", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#f5f5f7", minHeight: "100vh" }}>
        <div style={{ background: "#1a1a2e", padding: "18px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: entregador.online ? "#0d2012" : "#252540", border: `1px solid ${entregador.online ? "#4ade80" : "#555"}`, color: entregador.online ? "#4ade80" : "#aaa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
              {initials(entregador.nome)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#aaa", fontSize: 11 }}>Ola, entregador</div>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{entregador.nome}</div>
            </div>
            <button onClick={sair} style={{ background: "transparent", border: 0, color: "#666", fontSize: 12, cursor: "pointer" }}>Sair</button>
          </div>
          <button onClick={toggleOnline} style={{ marginTop: 14, width: "100%", background: entregador.online ? "#0d2012" : "#252540", border: `1px solid ${entregador.online ? "#4ade80" : "#555"}`, color: entregador.online ? "#4ade80" : "#aaa", borderRadius: 12, padding: 12, fontWeight: 700, cursor: "pointer" }}>
            {entregador.online ? "Online - recebendo pedidos" : "Offline - tocar para ficar online"}
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
            <div style={statCard}><span style={statNum}>{historicoHoje.length}</span><span style={statLabel}>Entregas hoje</span></div>
            <div style={statCard}><span style={{ ...statNum, color: "#4ade80" }}>R${ganhosHoje.toFixed(2)}</span><span style={statLabel}>Ganhos hoje</span></div>
            <div style={statCard}><span style={statNum}>{Number(entregador.avaliacao_media || 0).toFixed(1)}</span><span style={statLabel}>Avaliacao</span></div>
          </div>
        </div>

        {!installDismissed && (installPrompt || /iphone|ipad|ipod/i.test(navigator.userAgent)) && (
          <div style={{ background: "#0f0f12", padding: "10px 14px 0" }}>
            <div style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Instalar app</div>
                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>Abra direto pela tela inicial do celular.</div>
              </div>
              <button onClick={instalarApp} style={{ background: "#4ade80", color: "#052e16", border: 0, borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                Instalar
              </button>
              <button onClick={() => setInstallDismissed(true)} style={{ background: "transparent", color: "#777", border: 0, cursor: "pointer" }}>
                x
              </button>
            </div>
          </div>
        )}

        {pedidoAtivo ? (
          <>
            <div style={{ background: "#2a2a3e", height: 142, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.8 }}>
                {[28, 58, 82].map((top) => <div key={`h-${top}`} style={{ position: "absolute", height: 4, background: "#444", left: 0, right: 0, top: `${top}%` }} />)}
                {[24, 55, 80].map((left) => <div key={`v-${left}`} style={{ position: "absolute", width: 4, background: "#444", top: 0, bottom: 0, left: `${left}%` }} />)}
              </div>
              <div style={{ position: "absolute", left: 18, top: 8, color: "#4ade80", fontSize: 10, background: "rgba(0,0,0,0.65)", padding: "3px 7px", borderRadius: 6 }}>Restaurante</div>
              <div style={{ position: "absolute", left: "22%", top: "54%", width: 14, height: 14, borderRadius: "50%", background: "#4ade80", border: "2px solid #fff" }} />
              <div style={{ position: "absolute", right: 18, bottom: 8, color: "#f87171", fontSize: 10, background: "rgba(0,0,0,0.65)", padding: "3px 7px", borderRadius: 6 }}>Cliente</div>
              <div style={{ position: "absolute", right: "18%", top: "28%", width: 14, height: 14, borderRadius: "50%", background: "#f87171", border: "2px solid #fff" }} />
              <div style={{ position: "absolute", left: "25%", top: "50%", width: "52%", height: 3, background: "#facc15", transform: "rotate(-18deg)", transformOrigin: "left center" }} />
              <div style={{ position: "absolute", left: "50%", top: "38%", color: "#facc15", background: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 6 }}>
                <Bike size={20} />
              </div>
              <div style={{ position: "absolute", right: 8, top: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "4px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <Navigation size={11} />
                {lastLocation ? "GPS ativo" : "Aguardando GPS"}
              </div>
            </div>

            <div style={{ background: "#0f0f12", padding: 14 }}>
              <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 14, border: "1px solid #2a2a3e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#aaa", fontSize: 11 }}>Pedido #{pedidoAtivo.codigo_pedido}</span>
                  <span style={{ color: "#4ade80", border: "1px solid #4ade80", background: "#1a3a0a", fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>em rota</span>
                </div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{pedidoAtivo.cliente_nome}</div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4, display: "flex", gap: 5 }}>
                  <MapPin size={14} color="#facc15" />
                  <span>{formatAddress(enderecoAtivo)}</span>
                </div>
                {enderecoAtivo?.referencia && <div style={{ color: "#facc15", fontSize: 11, marginTop: 4 }}>{enderecoAtivo.referencia}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 8, color: "#aaa", fontSize: 11, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock size={13} color="#facc15" />
                    rota em andamento
                  </span>
                  {pedidoAtivo.cliente_telefone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Phone size={13} color="#4ade80" />
                      {pedidoAtivo.cliente_telefone}
                    </span>
                  )}
                </div>
                <div style={{ height: 1, background: "#333", margin: "12px 0" }} />
                {itensAtivos.map((item) => (
                  <div key={item.id} style={{ color: "#aaa", fontSize: 12, padding: "3px 0" }}>
                    {item.quantidade}x {item.produto_nome}
                  </div>
                ))}
                <div style={{ background: "#0d2012", borderRadius: 10, padding: 10, marginTop: 12, display: "flex", justifyContent: "space-between", color: "#4ade80" }}>
                  <span>Voce recebe</span>
                  <strong>R${comissaoPedidoAtivo.toFixed(2)}</strong>
                </div>
                <div style={{ marginTop: 10, background: "#0f0f12", border: "1px solid #2a2a3e", borderRadius: 10, padding: 10 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>Link de rastreio para o cliente</div>
                  <div style={{ color: "#888", fontSize: 10, marginTop: 4, wordBreak: "break-all" }}>{trackingUrl}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(trackingUrl);
                      toast.success("Link de rastreio copiado");
                    }}
                    style={{ marginTop: 8, background: "#252540", border: "1px solid #2a2a3e", color: "#fff", borderRadius: 9, padding: "8px 10px", width: "100%", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Copy size={13} />
                    Copiar link
                  </button>
                </div>
                {locationPermission === "blocked" && (
                  <div style={{ marginTop: 10, color: "#f87171", fontSize: 11 }}>
                    Ative a permissao de localizacao no navegador para o cliente acompanhar a entrega.
                  </div>
                )}
              </div>

              <button disabled={saving} onClick={concluirEntrega} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={15} />
                Confirmar entrega realizada
              </button>
              <button disabled={saving} onClick={recusarPedido} style={{ ...buttonStyle, background: "#1a1a2e", color: "#f87171", border: "1px solid #7f1d1d", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <AlertTriangle size={14} />
                Reportar problema / devolver
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: 14 }}>
            <div style={{ color: "#888", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Pedidos disponiveis</div>
            {entregador.online && pedidosVisiveis.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pedidosVisiveis.map((pedido) => {
                  const endereco = enderecosByPedido[pedido.id];
                  const itens = itensByPedido[pedido.id] || [];
                  const comissao = Number(pedido.total || 0) * ((entregador.pct_comissao ?? 10) / 100);

                  return (
                    <div key={pedido.id} style={{ background: "#1a1a2e", border: "1.5px solid #facc15", borderRadius: 16, overflow: "hidden" }}>
                      <div style={{ background: "#facc15", color: "#1a0a00", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          <Bike size={15} />
                          Pedido #{pedido.codigo_pedido}
                        </strong>
                        <span style={{ background: "#1a0a00", color: "#facc15", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 999 }}>novo</span>
                      </div>
                      <div style={{ padding: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12, marginBottom: 8 }}>
                          <span style={{ color: "#666" }}>Cliente</span>
                          <strong style={{ color: "#eee", textAlign: "right" }}>{pedido.cliente_nome}</strong>
                          <span style={{ color: "#666" }}>Endereco</span>
                          <strong style={{ color: "#eee", textAlign: "right" }}>{formatAddress(endereco)}</strong>
                        </div>
                        <div style={{ height: 1, background: "#333", margin: "10px 0" }} />
                        {itens.slice(0, 4).map((item) => (
                          <div key={item.id} style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                            <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#facc15", marginRight: 7 }} />
                            {item.quantidade}x {item.produto_nome}
                          </div>
                        ))}
                        <div style={{ background: "#0d2012", borderRadius: 10, padding: 10, marginTop: 12, display: "flex", justifyContent: "space-between", color: "#4ade80" }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800 }}>Voce recebe</div>
                            <div style={{ fontSize: 9 }}>{entregador.pct_comissao || 10}% de {Number(pedido.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                          </div>
                          <strong style={{ fontSize: 16 }}>R${comissao.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 8, marginTop: 12 }}>
                          <button
                            disabled={saving}
                            type="button"
                            onClick={() => {
                              setPedidosRecusados((current) => new Set(current).add(pedido.id));
                              toast.info("Pedido ocultado para voce nesta sessao");
                            }}
                            style={{ ...buttonStyle, background: "#2a1a1a", color: "#f87171", border: "1px solid #7f1d1d", padding: "11px 10px" }}
                          >
                            Recusar
                          </button>
                          <button disabled={saving} onClick={() => pegarPedido(pedido)} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16", padding: "11px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Check size={14} />
                            Aceitar entrega
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: "#fff", border: "1px dashed #ddd", borderRadius: 14, padding: 26, textAlign: "center", color: "#bbb", fontSize: 13 }}>
                {entregador.online
                  ? "Nenhum pedido pronto disponivel agora. Quando sair da cozinha, aparece aqui em tempo real."
                  : "Fique online para visualizar e pegar pedidos prontos."}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: "0 14px 18px" }}>
          <div style={{ color: "#888", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Extrato</div>
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #eee" }}>
            {pedidos.filter((p) => p.status === "entregue").slice(0, 8).map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <div>
                  <div style={{ color: "#333", fontWeight: 700, fontSize: 12 }}>#{p.codigo_pedido}</div>
                  <div style={{ color: "#aaa", fontSize: 10 }}>{new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div style={{ color: "#16a34a", fontWeight: 700, fontSize: 12 }}>+R${Number(p.valor_comissao || 0).toFixed(2)}</div>
              </div>
            ))}
            {pedidos.filter((p) => p.status === "entregue").length === 0 && (
              <div style={{ padding: 14, color: "#aaa", fontSize: 12, textAlign: "center" }}>Sem entregas concluidas ainda</div>
            )}
          </div>
          <div style={{ background: "#0d2012", color: "#4ade80", borderRadius: 12, marginTop: 10, padding: 12, display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total listado</span>
            <span>R${ganhosSemana.toFixed(2)}</span>
          </div>
        </div>
      </div>
      {iosInstallHint && (
        <div onClick={() => setIosInstallHint(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", zIndex: 2000 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", background: "#1a1a2e", borderTop: "1px solid #2a2a3e", borderRadius: "18px 18px 0 0", padding: 18 }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Instalar no iPhone</div>
            <ol style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Abra esta tela no Safari.</li>
              <li>Toque em Compartilhar.</li>
              <li>Escolha Adicionar a Tela de Inicio.</li>
            </ol>
            <button onClick={() => setIosInstallHint(false)} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16", marginTop: 12 }}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const statCard = {
  background: "#252540",
  borderRadius: 12,
  padding: 10,
  textAlign: "center",
} as const;

const statNum = {
  color: "#fff",
  fontSize: 15,
  fontWeight: 800,
  display: "block",
} as const;

const statLabel = {
  color: "#888",
  fontSize: 9,
  display: "block",
  marginTop: 2,
} as const;

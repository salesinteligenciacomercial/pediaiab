import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [telefoneVinculo, setTelefoneVinculo] = useState("");
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itensByPedido, setItensByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [enderecosByPedido, setEnderecosByPedido] = useState<Record<string, Endereco>>({});
  const [saving, setSaving] = useState(false);

  const loadEntregador = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setEntregador(null);
      return null;
    }

    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("*")
      .eq("user_id", auth.user.id)
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

  const loadPedidos = useCallback(async (ent: Entregador) => {
    const { data: pedidosData, error: pedidosError } = await (supabase.from("pedidos" as any) as any)
      .select("*")
      .eq("entregador_id", ent.id)
      .in("status", ["saiu_entrega", "entregue"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (pedidosError) {
      console.error("[EntregadorApp] erro ao carregar pedidos", pedidosError);
      return;
    }

    const rows: Pedido[] = pedidosData || [];
    setPedidos(rows);

    const ids = rows.map((p) => p.id);
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
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        const ent = await loadEntregador();
        if (ent) await loadPedidos(ent);
      }
      setLoading(false);
    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setEntregador(null);
        setPedidos([]);
      } else {
        setTimeout(async () => {
          const ent = await loadEntregador();
          if (ent) await loadPedidos(ent);
        }, 0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadEntregador, loadPedidos]);

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

  const authSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    let result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: nome },
            emailRedirectTo: `${window.location.origin}/entregador`,
          },
        });

    if (authMode === "signup" && result.error?.message.toLowerCase().includes("already registered")) {
      result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) {
        setSaving(false);
        toast.success("Esse email ja existia. Entrei com ele para vincular o entregador.");
        return;
      }
    }

    setSaving(false);
    if (result.error) {
      if (result.error.message.toLowerCase().includes("already registered")) {
        setAuthMode("login");
        toast.error("Esse email ja existe. Use Entrar com a senha cadastrada.");
        return;
      }

      if (result.error.message.toLowerCase().includes("invalid login credentials")) {
        toast.error("Email ou senha incorretos. Se esse email ja existe, use a senha cadastrada.");
        return;
      }

      toast.error(result.error.message);
      return;
    }

    toast.success(authMode === "login" ? "Login realizado" : "Conta criada. Se precisar, confirme seu email.");
  };

  const vincularTelefone = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { data, error } = await (supabase.rpc("link_entregador_by_phone" as any, { p_phone: telefoneVinculo }) as any);
    setSaving(false);

    if (error) {
      const message = String(error.message || "");
      if (message.includes("Could not find the function") || message.includes("link_entregador_by_phone")) {
        toast.error("A migration do app do entregador ainda nao foi aplicada no Supabase.");
        return;
      }

      toast.error("Nao encontrei entregador ativo com esse telefone. Confira o cadastro na aba Entregadores.");
      return;
    }

    setEntregador(data);
    await loadPedidos(data);
    toast.success("Acesso vinculado ao entregador");
  };

  const toggleOnline = async () => {
    if (!entregador) return;
    const next = !entregador.online;
    setEntregador({ ...entregador, online: next });
    const { error } = await (supabase.from("entregadores" as any) as any)
      .update({ online: next })
      .eq("id", entregador.id);

    if (error) {
      setEntregador({ ...entregador, online: !next });
      toast.error("Erro ao atualizar status");
    }
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

  const concluirEntrega = async () => {
    if (!pedidoAtivo) return;
    setSaving(true);
    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({
        status: "entregue",
        entregue_em: new Date().toISOString(),
      })
      .eq("id", pedidoAtivo.id);

    if (!error) {
      await (supabase.from("pedido_eventos" as any) as any).insert({
        pedido_id: pedidoAtivo.id,
        company_id: pedidoAtivo.company_id,
        tipo: "entrega_concluida",
        descricao: `Entregador confirmou entrega do pedido #${pedidoAtivo.codigo_pedido}`,
      });
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao concluir entrega");
      return;
    }

    toast.success("Entrega concluida");
    if (entregador) await loadPedidos(entregador);
  };

  const sair = async () => {
    await supabase.auth.signOut();
  };

  const itensAtivos = pedidoAtivo ? itensByPedido[pedidoAtivo.id] || [] : [];
  const enderecoAtivo = pedidoAtivo ? enderecosByPedido[pedidoAtivo.id] : undefined;
  const ganhosSemana = useMemo(
    () => pedidos
      .filter((p) => p.status === "entregue")
      .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
    [pedidos]
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
        Carregando...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <form onSubmit={authSubmit} style={{ width: "100%", maxWidth: 380, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>App do Entregador</div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Rosh Pizzaria</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setAuthMode("login")} style={{ ...buttonStyle, flex: 1, background: authMode === "login" ? "#4ade80" : "#252540", color: authMode === "login" ? "#052e16" : "#aaa" }}>Entrar</button>
            <button type="button" onClick={() => setAuthMode("signup")} style={{ ...buttonStyle, flex: 1, background: authMode === "signup" ? "#4ade80" : "#252540", color: authMode === "signup" ? "#052e16" : "#aaa" }}>Criar acesso</button>
          </div>
          {authMode === "signup" && (
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" style={inputStyle} />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" style={inputStyle} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" style={inputStyle} />
          <button disabled={saving} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16" }}>
            {saving ? "Aguarde..." : authMode === "login" ? "Entrar no app" : "Criar acesso"}
          </button>
          <a href="/auth" style={{ color: "#666", textAlign: "center", fontSize: 12, textDecoration: "none" }}>Area do restaurante</a>
        </form>
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

        {pedidoAtivo ? (
          <>
            <div style={{ background: "#2a2a3e", height: 142, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.8 }}>
                {[28, 58, 82].map((top) => <div key={`h-${top}`} style={{ position: "absolute", height: 4, background: "#444", left: 0, right: 0, top: `${top}%` }} />)}
                {[24, 55, 80].map((left) => <div key={`v-${left}`} style={{ position: "absolute", width: 4, background: "#444", top: 0, bottom: 0, left: `${left}%` }} />)}
              </div>
              <div style={{ position: "absolute", left: "22%", top: "54%", width: 14, height: 14, borderRadius: "50%", background: "#4ade80", border: "2px solid #fff" }} />
              <div style={{ position: "absolute", right: "18%", top: "28%", width: 14, height: 14, borderRadius: "50%", background: "#f87171", border: "2px solid #fff" }} />
              <div style={{ position: "absolute", left: "25%", top: "50%", width: "52%", height: 3, background: "#facc15", transform: "rotate(-18deg)", transformOrigin: "left center" }} />
              <div style={{ position: "absolute", left: "50%", top: "39%", color: "#facc15", fontSize: 18 }}>moto</div>
              <div style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "4px 8px", borderRadius: 8 }}>Rota ativa</div>
            </div>

            <div style={{ background: "#0f0f12", padding: 14 }}>
              <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 14, border: "1px solid #2a2a3e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#aaa", fontSize: 11 }}>Pedido #{pedidoAtivo.codigo_pedido}</span>
                  <span style={{ color: "#4ade80", border: "1px solid #4ade80", background: "#1a3a0a", fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>em rota</span>
                </div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{pedidoAtivo.cliente_nome}</div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{formatAddress(enderecoAtivo)}</div>
                {enderecoAtivo?.referencia && <div style={{ color: "#facc15", fontSize: 11, marginTop: 4 }}>{enderecoAtivo.referencia}</div>}
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
              </div>

              <button disabled={saving} onClick={concluirEntrega} style={{ ...buttonStyle, background: "#4ade80", color: "#052e16", marginTop: 10 }}>Confirmar entrega</button>
              <button disabled={saving} onClick={recusarPedido} style={{ ...buttonStyle, background: "#2a1a1a", color: "#f87171", border: "1px solid #7f1d1d", marginTop: 8 }}>Recusar / devolver ao restaurante</button>
            </div>
          </>
        ) : (
          <div style={{ padding: 14 }}>
            <div style={{ color: "#888", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Aguardando pedidos</div>
            <div style={{ background: "#fff", border: "1px dashed #ddd", borderRadius: 14, padding: 26, textAlign: "center", color: "#bbb", fontSize: 13 }}>
              Nenhum pedido atribuido agora. Quando o restaurante enviar uma entrega, ela aparece aqui em tempo real.
            </div>
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

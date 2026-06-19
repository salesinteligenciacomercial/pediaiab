import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  codigo_pedido: string;
  status: PedidoStatus;
  total: number;
  created_at: string;
  entregador_id?: string | null;
  valor_comissao?: number | null;
};

type Entregador = {
  id: string;
  company_id: string;
  nome: string;
  telefone: string | null;
  veiculo: string;
  status: string;
  pct_comissao: number;
  pix_chave: string | null;
  avaliacao_media: number;
  online: boolean;
};

type Props = {
  entregadores: Entregador[];
  pedidos: Pedido[];
  companyId: string;
  onReload: () => void;
};

type FormState = {
  nome: string;
  telefone: string;
  veiculo: string;
  pct_comissao: string;
  pix_chave: string;
};

const cardStyle = {
  background: "#111118",
  border: "1px solid #1f1f28",
  borderRadius: 10,
} as const;

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function metric(label: string, value: string | number, color: string) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px" }}>
      <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ color, fontSize: 24, fontWeight: 700, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}

export default function EntregadoresView({ entregadores, pedidos, companyId, onReload }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("10");
  const [editPix, setEditPix] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    nome: "",
    telefone: "",
    veiculo: "moto",
    pct_comissao: "10",
    pix_chave: "",
  });

  const pedidosHoje = useMemo(() => pedidos.filter((p) => isToday(p.created_at)), [pedidos]);
  const emRotaIds = useMemo(
    () => new Set(pedidos.filter((p) => p.status === "saiu_entrega" && p.entregador_id).map((p) => p.entregador_id as string)),
    [pedidos]
  );

  const online = entregadores.filter((e) => e.online);
  const offline = entregadores.filter((e) => !e.online);
  const entregasHoje = pedidosHoje.filter((p) => p.status === "entregue" || p.status === "saiu_entrega").length;
  const comissoesHoje = pedidosHoje
    .filter((p) => p.status === "entregue")
    .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

  const startEdit = (ent: Entregador) => {
    setEditingId(ent.id);
    setEditPct(String(ent.pct_comissao ?? 10));
    setEditPix(ent.pix_chave || "");
  };

  const saveEdit = async (ent: Entregador) => {
    setSaving(true);
    const { error } = await (supabase.from("entregadores" as any) as any)
      .update({
        pct_comissao: Number(editPct || 0),
        pix_chave: editPix || null,
      })
      .eq("id", ent.id)
      .eq("company_id", companyId);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar entregador");
      return;
    }

    toast.success("Entregador atualizado");
    setEditingId(null);
    onReload();
  };

  const toggleOnline = async (ent: Entregador) => {
    const { error } = await (supabase.from("entregadores" as any) as any)
      .update({ online: !ent.online })
      .eq("id", ent.id)
      .eq("company_id", companyId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    onReload();
  };

  const createEntregador = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do entregador");
      return;
    }

    setSaving(true);
    const { error } = await (supabase.from("entregadores" as any) as any).insert({
      company_id: companyId,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      veiculo: form.veiculo,
      pct_comissao: Number(form.pct_comissao || 10),
      pix_chave: form.pix_chave.trim() || null,
      status: "ativo",
      online: false,
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao cadastrar entregador");
      return;
    }

    toast.success("Entregador cadastrado");
    setShowCreate(false);
    setForm({ nome: "", telefone: "", veiculo: "moto", pct_comissao: "10", pix_chave: "" });
    onReload();
  };

  const renderEntregador = (ent: Entregador, muted = false) => {
    const pedidoEmRota = pedidos.find((p) => p.entregador_id === ent.id && p.status === "saiu_entrega");
    const comissaoHoje = pedidosHoje
      .filter((p) => p.entregador_id === ent.id && (p.status === "entregue" || p.status === "saiu_entrega"))
      .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

    return (
      <div key={ent.id} style={{ ...cardStyle, padding: 14, opacity: muted ? 0.45 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: pedidoEmRota ? "#1e0a2e" : ent.online ? "#0d2012" : "#1a1a1a",
            border: `1px solid ${pedidoEmRota ? "#3B2544" : ent.online ? "#14532d" : "#252525"}`,
            color: pedidoEmRota ? "#B980FF" : ent.online ? "#4ade80" : "#555",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12,
            flexShrink: 0,
          }}>
            {initials(ent.nome)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#e5e5e5", fontSize: 14, fontWeight: 600 }}>{ent.nome}</span>
              <span style={{ color: "#555", fontSize: 10 }}>{ent.veiculo}</span>
              <span style={{ color: "#F5A623", fontSize: 10 }}>Nota {Number(ent.avaliacao_media || 0).toFixed(1)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
              <span style={{ color: pedidoEmRota ? "#B980FF" : ent.online ? "#4ade80" : "#555", fontSize: 11 }}>
                {pedidoEmRota ? `em rota - #${pedidoEmRota.codigo_pedido}` : ent.online ? "livre" : "offline"}
              </span>
              <span style={{ color: "#2ECC8F", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                R${comissaoHoje.toFixed(2)} hoje
              </span>
            </div>
          </div>

          <button onClick={() => startEdit(ent)} style={{ background: "#1a1a2e", color: "#9CA3AF", border: "1px solid #2a2a3e", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 11 }}>
            Editar
          </button>
          <button onClick={() => toggleOnline(ent)} style={{ background: ent.online ? "#12071A" : "#0d2012", color: ent.online ? "#B980FF" : "#4ade80", border: `1px solid ${ent.online ? "#3B2544" : "#14532d"}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 11 }}>
            {ent.online ? "Forcar offline" : "Forcar online"}
          </button>
        </div>

        {editingId === ent.id && (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, marginTop: 12 }}>
            <input value={editPct} onChange={(e) => setEditPct(e.target.value)} type="number" min="0" max="100" step="0.5" style={inputStyle} />
            <input value={editPix} onChange={(e) => setEditPix(e.target.value)} placeholder="Chave Pix" style={inputStyle} />
            <button disabled={saving} onClick={() => saveEdit(ent)} style={{ background: "#2ECC8F", color: "#001A08", border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>
              Salvar
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px", background: "#0a0a0f" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {metric("Online agora", online.length, "#4ade80")}
        {metric("Em rota agora", emRotaIds.size, "#B980FF")}
        {metric("Entregas hoje", entregasHoje, "#F5A623")}
        {metric("Comissoes hoje", `R$${comissoesHoje.toFixed(2)}`, "#2ECC8F")}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ color: "#B980FF", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>Entregadores online</div>
          <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>Operacao em tempo real</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: "#B980FF", color: "#12071A", border: 0, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Cadastrar entregador
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {online.length ? online.map((ent) => renderEntregador(ent)) : (
          <div style={{ color: "#444", border: "1px dashed #1f1f28", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 12 }}>
            Nenhum entregador online agora
          </div>
        )}
      </div>

      <div style={{ color: "#555", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>Offline</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {offline.length ? offline.map((ent) => renderEntregador(ent, true)) : (
          <div style={{ color: "#333", fontSize: 12 }}>Nenhum entregador offline</div>
        )}
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#111118", border: "1px solid #B980FF", borderRadius: 14, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 0 40px rgba(185,128,255,0.14)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #3B2544", background: "#12071A" }}>
              <span style={{ color: "#B980FF", fontSize: 13, fontWeight: 700 }}>Cadastrar entregador</span>
              <button onClick={() => setShowCreate(false)} style={{ background: "transparent", border: 0, color: "#555", fontSize: 18, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome" style={inputStyle} />
              <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="Telefone" style={inputStyle} />
              <select value={form.veiculo} onChange={(e) => setForm((f) => ({ ...f, veiculo: e.target.value }))} style={inputStyle}>
                <option value="moto">moto</option>
                <option value="bike">bike</option>
                <option value="carro">carro</option>
              </select>
              <input value={form.pct_comissao} onChange={(e) => setForm((f) => ({ ...f, pct_comissao: e.target.value }))} type="number" min="0" max="100" step="0.5" placeholder="Comissao %" style={inputStyle} />
              <input value={form.pix_chave} onChange={(e) => setForm((f) => ({ ...f, pix_chave: e.target.value }))} placeholder="Chave Pix" style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8, padding: "0 18px 18px" }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: "#1a1a2e", color: "#777", border: "1px solid #2a2a3e", borderRadius: 10, padding: 10, cursor: "pointer" }}>Cancelar</button>
              <button disabled={saving} onClick={createEntregador} style={{ flex: 2, background: "#B980FF", color: "#12071A", border: 0, borderRadius: 10, padding: 10, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: "#0d0d16",
  border: "1px solid #1e1e28",
  borderRadius: 8,
  color: "#e5e5e5",
  padding: "10px 12px",
  outline: "none",
  fontSize: 12,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
} as const;

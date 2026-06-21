import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Bike, CheckCircle2, Clock, ExternalLink, MapPin, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TrackingPayload = {
  pedido: {
    id: string;
    codigo_pedido: string;
    status: string;
    cliente_nome: string;
    created_at: string;
    aceito_entregador_em?: string | null;
    entregue_em?: string | null;
  };
  entregador: {
    nome: string;
    veiculo: string;
    avaliacao_media: number;
  } | null;
  endereco: {
    bairro?: string | null;
    cidade?: string | null;
    referencia?: string | null;
  } | null;
  localizacao: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    created_at: string;
  } | null;
};

export default function AcompanharPedido() {
  const { pedidoId } = useParams();
  const [tracking, setTracking] = useState<TrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!pedidoId) return;
    const { data, error } = await (supabase.rpc("get_pedido_tracking_public" as any, { p_pedido_id: pedidoId }) as any);

    if (error) {
      setError("Nao encontramos uma entrega em rota para este pedido.");
      setLoading(false);
      return;
    }

    setTracking(data as TrackingPayload);
    setError("");
    setLoading(false);
  }, [pedidoId]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [load]);

  const mapsUrl = useMemo(() => {
    if (!tracking?.localizacao) return "";
    return `https://www.google.com/maps?q=${tracking.localizacao.latitude},${tracking.localizacao.longitude}`;
  }, [tracking?.localizacao]);

  if (loading) {
    return (
      <Shell>
        <div style={centerCard}>Carregando rastreio...</div>
      </Shell>
    );
  }

  if (error || !tracking) {
    return (
      <Shell>
        <div style={centerCard}>
          <AlertCircle color="#f87171" size={30} />
          <strong style={{ color: "#fff", marginTop: 12 }}>Rastreio indisponivel</strong>
          <span style={{ color: "#aaa", fontSize: 13, marginTop: 6 }}>{error}</span>
        </div>
      </Shell>
    );
  }

  const delivered = tracking.pedido.status === "entregue";

  return (
    <Shell>
      <div style={{ background: "#1a1a2e", padding: "18px 16px 14px" }}>
        <div style={{ color: "#aaa", fontSize: 12 }}>Pedido #{tracking.pedido.codigo_pedido}</div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginTop: 2 }}>
          {delivered ? "Entrega concluida" : "Seu pedido esta em rota"}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <StatusPill active icon={delivered ? CheckCircle2 : Bike} label={delivered ? "Entregue" : "Entregador a caminho"} />
          {tracking.localizacao && <StatusPill active icon={Navigation} label="Localizacao ativa" />}
        </div>
      </div>

      <div style={{ background: "#2a2a3e", height: 210, position: "relative", overflow: "hidden" }}>
        {[24, 50, 74].map((top) => <div key={`h-${top}`} style={{ position: "absolute", height: 5, background: "#444", left: 0, right: 0, top: `${top}%` }} />)}
        {[22, 48, 76].map((left) => <div key={`v-${left}`} style={{ position: "absolute", width: 5, background: "#444", top: 0, bottom: 0, left: `${left}%` }} />)}
        <div style={{ position: "absolute", left: "20%", bottom: "22%", width: 16, height: 16, borderRadius: "50%", background: "#4ade80", border: "3px solid #fff" }} />
        <div style={{ position: "absolute", right: "18%", top: "20%", width: 16, height: 16, borderRadius: "50%", background: "#f87171", border: "3px solid #fff" }} />
        <div style={{ position: "absolute", left: "24%", bottom: "25%", width: "55%", height: 4, background: "#facc15", transform: "rotate(-25deg)", transformOrigin: "left center" }} />
        <div style={{ position: "absolute", left: tracking.localizacao ? "52%" : "38%", top: tracking.localizacao ? "42%" : "52%", background: "rgba(0,0,0,0.68)", color: "#facc15", padding: 9, borderRadius: 999 }}>
          <Bike size={24} />
        </div>
        <div style={{ position: "absolute", left: 14, bottom: 12, background: "rgba(0,0,0,0.65)", color: "#4ade80", fontSize: 11, padding: "5px 8px", borderRadius: 8 }}>Restaurante</div>
        <div style={{ position: "absolute", right: 14, top: 12, background: "rgba(0,0,0,0.65)", color: "#f87171", fontSize: 11, padding: "5px 8px", borderRadius: 8 }}>Voce</div>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={infoCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: "#aaa", fontSize: 12 }}>Entregador</div>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>{tracking.entregador?.nome || "Aguardando entregador"}</div>
            </div>
            <div style={{ background: "#0d2012", color: "#4ade80", border: "1px solid #4ade80", borderRadius: 999, padding: "5px 9px", fontSize: 11 }}>
              {tracking.entregador?.veiculo || "moto"}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <SmallLine icon={MapPin} label={tracking.endereco?.bairro || tracking.endereco?.cidade ? `${tracking.endereco?.bairro || ""}${tracking.endereco?.cidade ? ` - ${tracking.endereco.cidade}` : ""}` : "Endereco protegido"} />
            <SmallLine icon={Clock} label={tracking.localizacao ? `Atualizado ${new Date(tracking.localizacao.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando primeira localizacao"} />
          </div>
        </div>

        {tracking.localizacao && (
          <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ ...buttonLink, textDecoration: "none" }}>
            <ExternalLink size={16} />
            Abrir localizacao no mapa
          </a>
        )}

        <div style={{ color: "#777", fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>
          A posicao e atualizada automaticamente enquanto o entregador estiver com permissao de GPS ativa.
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12", display: "flex", justifyContent: "center", color: "#fff" }}>
      <div style={{ width: "100%", maxWidth: 460, minHeight: "100vh", background: "#0f0f12" }}>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ icon: Icon, label, active }: { icon: any; label: string; active: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: active ? "#4ade80" : "#aaa", border: `1px solid ${active ? "#4ade80" : "#555"}`, background: active ? "#0d2012" : "#252540", borderRadius: 999, padding: "5px 9px", fontSize: 11, fontWeight: 800 }}>
      <Icon size={13} />
      {label}
    </span>
  );
}

function SmallLine({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#aaa", fontSize: 13 }}>
      <Icon size={15} color="#facc15" />
      <span>{label}</span>
    </div>
  );
}

const centerCard = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  padding: 24,
  color: "#aaa",
} as const;

const infoCard = {
  background: "#1a1a2e",
  border: "1px solid #2a2a3e",
  borderRadius: 16,
  padding: 14,
} as const;

const buttonLink = {
  background: "#4ade80",
  color: "#052e16",
  borderRadius: 12,
  padding: "13px 14px",
  fontSize: 13,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
} as const;

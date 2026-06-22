import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
    foto_url?: string | null;
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

const DEFAULT_DELIVERY_MINUTES = 28;
const ROUTE_START = { x: 20, y: 72 };
const ROUTE_END = { x: 80, y: 36 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function minutesSince(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (Date.now() - timestamp) / 60000);
}

function formatEta(minutes: number, delivered: boolean) {
  if (delivered) return "Entregue";
  if (minutes <= 1) return "Chegando agora";
  return `${minutes} min`;
}

function buildRouteState(tracking: TrackingPayload) {
  const delivered = tracking.pedido.status === "entregue";
  const startedAt = tracking.pedido.aceito_entregador_em || tracking.pedido.created_at;
  const elapsed = minutesSince(startedAt);
  const freshness = tracking.localizacao ? minutesSince(tracking.localizacao.created_at) : null;
  const hasFreshGps = freshness !== null && freshness <= 2.5;
  const estimatedProgress = delivered ? 1 : clamp(elapsed / DEFAULT_DELIVERY_MINUTES, 0.08, hasFreshGps ? 0.96 : 0.88);
  const x = ROUTE_START.x + (ROUTE_END.x - ROUTE_START.x) * estimatedProgress;
  const y = ROUTE_START.y + (ROUTE_END.y - ROUTE_START.y) * estimatedProgress;
  const etaMinutes = delivered ? 0 : Math.max(1, Math.ceil(DEFAULT_DELIVERY_MINUTES - elapsed));

  return {
    delivered,
    progress: estimatedProgress,
    x,
    y,
    etaMinutes,
    hasFreshGps,
    isArriving: !delivered && estimatedProgress >= 0.86,
  };
}

export default function AcompanharPedido() {
  const { pedidoId } = useParams();
  const [searchParams] = useSearchParams();
  const [tracking, setTracking] = useState<TrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [nota, setNota] = useState(0);
  const [avaliando, setAvaliando] = useState(false);
  const [avaliado, setAvaliado] = useState(false);

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
    const interval = window.setInterval(load, 5000);
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
  const routeState = buildRouteState(tracking);
  const destacarAvaliacao = delivered && searchParams.get("avaliar") === "1";

  const enviarAvaliacao = async (valor: number) => {
    if (!pedidoId || avaliado) return;
    setNota(valor);
    setAvaliando(true);
    const { error } = await supabase.rpc("avaliar_entregador_public" as any, {
      p_pedido_id: pedidoId,
      p_nota: valor,
      p_comentario: null,
    });
    setAvaliando(false);
    if (error) {
      setRatingError("Nao foi possivel registrar sua avaliacao. Tente novamente em instantes.");
      return;
    }
    setRatingError("");
    setAvaliado(true);
  };

  return (
    <Shell>
      <div style={{ background: "#1a1a2e", padding: "18px 16px 14px" }}>
        <div style={{ color: "#aaa", fontSize: 12 }}>Pedido #{tracking.pedido.codigo_pedido}</div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginTop: 2 }}>
          {delivered ? "Entrega concluida" : "Seu pedido esta em rota"}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <StatusPill active icon={delivered ? CheckCircle2 : Bike} label={delivered ? "Entregue" : "Entregador a caminho"} />
          <StatusPill active icon={Clock} label={`Previsao ${formatEta(routeState.etaMinutes, delivered)}`} />
          {tracking.localizacao && <StatusPill active={routeState.hasFreshGps} icon={Navigation} label={routeState.hasFreshGps ? "GPS em tempo real" : "GPS recalculando"} />}
        </div>
      </div>

      <div style={{ background: "#2a2a3e", height: 210, position: "relative", overflow: "hidden" }}>
        {[24, 50, 74].map((top) => <div key={`h-${top}`} style={{ position: "absolute", height: 5, background: "#444", left: 0, right: 0, top: `${top}%` }} />)}
        {[22, 48, 76].map((left) => <div key={`v-${left}`} style={{ position: "absolute", width: 5, background: "#444", top: 0, bottom: 0, left: `${left}%` }} />)}
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <line x1={ROUTE_START.x} y1={ROUTE_START.y} x2={ROUTE_END.x} y2={ROUTE_END.y} stroke="rgba(250, 204, 21, 0.28)" strokeWidth="2.4" strokeDasharray="3 3" />
          <line x1={ROUTE_START.x} y1={ROUTE_START.y} x2={routeState.x} y2={routeState.y} stroke="#facc15" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", left: `${ROUTE_START.x}%`, top: `${ROUTE_START.y}%`, transform: "translate(-50%, -50%)", width: 16, height: 16, borderRadius: "50%", background: "#4ade80", border: "3px solid #fff" }} />
        <div style={{ position: "absolute", left: `${ROUTE_END.x}%`, top: `${ROUTE_END.y}%`, transform: "translate(-50%, -50%)", width: 16, height: 16, borderRadius: "50%", background: "#f87171", border: "3px solid #fff" }} />
        <div style={{ position: "absolute", left: `${routeState.x}%`, top: `${routeState.y}%`, transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.72)", color: "#facc15", padding: 9, borderRadius: 999, transition: "left 900ms ease, top 900ms ease" }}>
          <Bike size={24} />
        </div>
        <div style={{ position: "absolute", left: 14, bottom: 12, background: "rgba(0,0,0,0.65)", color: "#4ade80", fontSize: 11, padding: "5px 8px", borderRadius: 8 }}>Restaurante</div>
        <div style={{ position: "absolute", right: 14, top: 12, background: "rgba(0,0,0,0.65)", color: "#f87171", fontSize: 11, padding: "5px 8px", borderRadius: 8 }}>Voce</div>
        <div style={{ position: "absolute", left: 14, top: 12, background: "rgba(0,0,0,0.68)", color: "#fff", fontSize: 11, padding: "6px 9px", borderRadius: 9, display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={12} color="#facc15" />
          {formatEta(routeState.etaMinutes, delivered)}
        </div>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        {routeState.isArriving && (
          <div style={{ ...infoCard, borderColor: "#4ade80", background: "#0d2012" }}>
            <div style={{ color: "#4ade80", fontSize: 14, fontWeight: 900 }}>O entregador esta chegando</div>
            <div style={{ color: "#b7f7c8", fontSize: 12, marginTop: 5 }}>Saia para receber sua entrega com seguranca e confira o entregador nesta tela.</div>
          </div>
        )}

        <div style={infoCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <DriverPhoto entregador={tracking.entregador} />
            <div>
              <div style={{ color: "#aaa", fontSize: 12 }}>Entregador</div>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>{tracking.entregador?.nome || "Aguardando entregador"}</div>
              <div style={{ color: "#facc15", fontSize: 12, marginTop: 3 }}>
                Nota {Number(tracking.entregador?.avaliacao_media || 5).toFixed(1)}
              </div>
            </div>
            <div style={{ background: "#0d2012", color: "#4ade80", border: "1px solid #4ade80", borderRadius: 999, padding: "5px 9px", fontSize: 11 }}>
              {tracking.entregador?.veiculo || "moto"}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <SmallLine icon={MapPin} label={tracking.endereco?.bairro || tracking.endereco?.cidade ? `${tracking.endereco?.bairro || ""}${tracking.endereco?.cidade ? ` - ${tracking.endereco.cidade}` : ""}` : "Endereco protegido"} />
            <SmallLine icon={Clock} label={tracking.localizacao ? `Atualizado ${new Date(tracking.localizacao.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando primeira localizacao"} />
            <SmallLine icon={Navigation} label={routeState.hasFreshGps ? "A rota acompanha o GPS ativo do entregador" : "Estimativa recalculando enquanto aguardamos novo GPS"} />
          </div>
        </div>

        {delivered && (
          <div style={{ ...infoCard, borderColor: destacarAvaliacao ? "#4ade80" : "#2a2a3e" }}>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>Avalie sua entrega</div>
            <div style={{ color: "#aaa", fontSize: 13, marginTop: 5 }}>
              Sua nota ajuda a manter mais seguranca e qualidade nas proximas entregas.
            </div>
            {avaliado ? (
              <div style={{ marginTop: 14, color: "#4ade80", fontWeight: 900 }}>Obrigado pela avaliacao!</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 14 }}>
                {[1, 2, 3, 4, 5].map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    disabled={avaliando}
                    onClick={() => enviarAvaliacao(valor)}
                    style={{
                      border: `1px solid ${nota >= valor ? "#facc15" : "#444"}`,
                      background: nota >= valor ? "#3a2f08" : "#252540",
                      color: nota >= valor ? "#facc15" : "#aaa",
                      borderRadius: 10,
                      padding: "12px 0",
                      fontWeight: 900,
                      cursor: avaliando ? "wait" : "pointer",
                    }}
                  >
                    {valor}
                  </button>
                ))}
              </div>
            )}
            {ratingError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{ratingError}</div>}
          </div>
        )}

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

function getInitials(name?: string | null) {
  return String(name || "E")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function DriverPhoto({ entregador }: { entregador: TrackingPayload["entregador"] }) {
  const initials = getInitials(entregador?.nome);
  if (entregador?.foto_url) {
    return (
      <img
        src={entregador.foto_url}
        alt={entregador.nome}
        style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "2px solid #4ade80", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#0d2012", border: "2px solid #4ade80", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, flexShrink: 0 }}>
      {initials}
    </div>
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

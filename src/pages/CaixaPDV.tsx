import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

type Period = "hoje" | "ontem" | "semana" | "mes";
type FormaPagamento = "pix" | "dinheiro" | "credito" | "debito" | "voucher";
type Movimentacao = {
  id: string;
  tipo: "entrada" | "saida";
  forma_pagamento: FormaPagamento | null;
  valor: number;
  descricao: string;
  categoria: string;
  created_at: string;
};
type StatusCaixa = "fechado" | "aberto";
type SessaoCaixa = {
  id: string;
  status: StatusCaixa;
  fundo_caixa: number;
  abertura_at: string;
  fechamento_at: string | null;
  responsavel: string;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function startOfDay(d: Date) {
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return dd;
}

function endOfDay(d: Date) {
  const dd = new Date(d);
  dd.setHours(23, 59, 59, 999);
  return dd;
}

function periodRange(p: Period): { start: string; end: string } {
  const now = new Date();
  if (p === "hoje") {
    return { start: startOfDay(now).toISOString(), end: now.toISOString() };
  }
  if (p === "ontem") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y).toISOString(), end: endOfDay(y).toISOString() };
  }
  if (p === "semana") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: startOfDay(s).toISOString(), end: now.toISOString() };
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: startOfDay(s).toISOString(), end: now.toISOString() };
}

function normalizeFormaPagamento(raw: string | null | undefined): FormaPagamento {
  if (!raw) return "pix";
  const s = raw.toLowerCase();
  if (s.includes("pix")) return "pix";
  if (s.includes("dinheiro") || s.includes("cash")) return "dinheiro";
  if (s.includes("credito") || s.includes("crédito") || s.includes("credit")) return "credito";
  if (s.includes("debito") || s.includes("débito") || s.includes("debit")) return "debito";
  if (s.includes("voucher") || s.includes("vale")) return "voucher";
  return "pix";
}

const EMPTY_PGTO: Record<FormaPagamento, number> = {
  pix: 0, dinheiro: 0, credito: 0, debito: 0, voucher: 0,
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
  :root {
    --bg:#0A0A0D;--s1:#111115;--s2:#18181D;--s3:#1F1F26;--s4:#27272F;
    --bd:rgba(255,255,255,0.06);--bd2:rgba(255,255,255,0.12);
    --tx:#EEEDF4;--mu:#6E6D82;--mu2:#9998AF;
    --acc:#FF5C00;--acc2:#FF8640;--grn:#22C97A;--red:#F04E4E;
    --blu:#4A9EFF;--pur:#9B6FFF;--amb:#FFAB00;
    --r:14px;--r-sm:9px;
  }
  .pdv-root{background:var(--bg);min-height:100%;font-family:'Inter',sans-serif;color:var(--tx);margin:-8px -8px;}
  @media(min-width:768px){.pdv-root{margin:-24px -24px;}}
  .pdv-topbar{background:var(--s1);border-bottom:1px solid var(--bd);padding:0 28px;height:58px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;}
  .pdv-logo{display:flex;align-items:center;gap:10px;}
  .pdv-logo-icon{width:34px;height:34px;background:linear-gradient(135deg,var(--acc),var(--acc2));border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:17px;}
  .pdv-logo-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;letter-spacing:-.3px;}
  .pdv-topbar-right{display:flex;align-items:center;gap:10px;}
  .pdv-badge{background:var(--s3);border:1px solid var(--bd2);border-radius:20px;padding:5px 12px;font-size:12px;color:var(--mu2);display:flex;align-items:center;gap:6px;}
  .pdv-badge strong{color:var(--tx);}
  .dot-live{width:7px;height:7px;border-radius:50%;background:var(--grn);animation:pdv-pulse 2s infinite;}
  @keyframes pdv-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
  .pdv-clock{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--mu2);min-width:68px;}
  .pdv-content{padding:24px 28px;}
  .caixa-status-bar{border-radius:var(--r);padding:16px 22px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--bd2);transition:background .3s;}
  .caixa-status-bar.aberto{background:rgba(34,201,122,.06);border-color:rgba(34,201,122,.2);}
  .caixa-status-bar.fechado{background:rgba(240,78,78,.06);border-color:rgba(240,78,78,.2);}
  .cs-left{display:flex;align-items:center;gap:12px;}
  .cs-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;}
  .cs-icon.aberto{background:rgba(34,201,122,.12);color:var(--grn);}
  .cs-icon.fechado{background:rgba(240,78,78,.12);color:var(--red);}
  .cs-label{font-size:11px;color:var(--mu);}
  .cs-value{font-size:15px;font-weight:600;}
  .cs-right{display:flex;align-items:center;gap:8px;}
  .pdv-tabs{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;}
  .pdv-tab{padding:8px 14px;border-radius:10px;background:var(--s2);color:var(--mu);cursor:pointer;font-size:13px;border:1px solid transparent;transition:all .15s;display:flex;align-items:center;gap:7px;}
  .pdv-tab:hover{background:var(--s3);color:var(--mu2);}
  .pdv-tab.on{background:var(--s1);border-color:var(--bd2);color:var(--tx);}
  .tab-count{background:var(--s3);padding:1px 7px;border-radius:6px;font-size:11px;}
  .period-select{display:flex;gap:4px;margin-bottom:20px;}
  .period-btn{padding:6px 12px;border-radius:8px;background:var(--s2);color:var(--mu);font-size:12px;cursor:pointer;border:1px solid transparent;transition:all .15s;}
  .period-btn.on{background:rgba(255,92,0,.12);border-color:rgba(255,92,0,.3);color:var(--acc2);}
  .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;}
  @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(3,1fr);}}
  @media(max-width:700px){.kpi-grid{grid-template-columns:1fr 1fr;}}
  .kpi-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:18px 20px;transition:border-color .15s;}
  .kpi-card:hover{border-color:var(--bd2);}
  .kpi-label{font-size:11px;color:var(--mu);margin-bottom:6px;display:flex;align-items:center;gap:5px;}
  .kpi-value{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;line-height:1;margin-bottom:4px;}
  .kpi-sub{font-size:11px;color:var(--mu);}
  .saldo-banner{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;}
  .saldo-left{display:flex;align-items:center;gap:16px;}
  .saldo-icon{width:52px;height:52px;border-radius:13px;background:rgba(255,92,0,.08);display:flex;align-items:center;justify-content:center;font-size:24px;}
  .saldo-value{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:var(--acc);line-height:1;}
  .saldo-meta{font-size:12px;color:var(--mu);margin-top:4px;display:flex;gap:16px;flex-wrap:wrap;}
  .main-grid{display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start;}
  @media(max-width:900px){.main-grid{grid-template-columns:1fr;}}
  .card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;}
  .card-head{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--bd);}
  .card-title{font-size:13px;font-weight:600;}
  .card-meta{font-size:11px;color:var(--mu);}
  .mov-table{width:100%;border-collapse:collapse;}
  .mov-table th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--mu);padding:10px 20px;text-align:left;background:var(--s2);border-bottom:1px solid var(--bd);}
  .mov-table td{padding:11px 20px;font-size:12px;border-bottom:1px solid var(--bd);}
  .mov-table tr:last-child td{border-bottom:none;}
  .mov-table tr:hover td{background:rgba(255,255,255,.02);}
  .tag-tipo{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase;}
  .tag-tipo.entrada{background:rgba(34,201,122,.12);color:var(--grn);}
  .tag-tipo.saida{background:rgba(240,78,78,.12);color:var(--red);}
  .pgto-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:10px;background:var(--s3);color:var(--mu2);}
  .form-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;position:sticky;top:74px;}
  .form-body{padding:16px;display:flex;flex-direction:column;gap:12px;}
  .tipo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .tipo-btn{padding:10px;border-radius:var(--r-sm);background:var(--s2);color:var(--mu);border:1px solid var(--bd);cursor:pointer;font-size:13px;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px;}
  .tipo-btn.on.entrada{background:rgba(34,201,122,.1);border-color:rgba(34,201,122,.3);color:var(--grn);}
  .tipo-btn.on.saida{background:rgba(240,78,78,.1);border-color:rgba(240,78,78,.3);color:var(--red);}
  .field label{display:block;font-size:11px;color:var(--mu);margin-bottom:5px;}
  .field input,.field select{width:100%;padding:10px 12px;border-radius:var(--r-sm);background:var(--s2);border:1px solid var(--bd2);color:var(--tx);font-size:13px;outline:none;transition:border-color .15s;}
  .field input:focus,.field select:focus{border-color:var(--acc);}
  .field select option{background:var(--s2);}
  .fpag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
  .fpag-btn{padding:8px 6px;border-radius:8px;background:var(--s2);border:1px solid var(--bd);color:var(--mu);cursor:pointer;font-size:11px;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:3px;}
  .fpag-btn.on{background:rgba(74,158,255,.1);border-color:rgba(74,158,255,.35);color:var(--blu);}
  .btn-primary{width:100%;padding:12px;border-radius:var(--r-sm);background:var(--acc);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s;}
  .btn-primary:hover{opacity:.88;}
  .btn-primary:disabled{opacity:.4;cursor:not-allowed;}
  .btn-outline{padding:9px 16px;border-radius:var(--r-sm);background:transparent;color:var(--tx);border:1px solid var(--bd2);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;}
  .btn-outline:hover{background:var(--s3);}
  .btn-outline-acc{color:var(--acc);border-color:rgba(255,92,0,.35);}
  .btn-outline-acc:hover{background:rgba(255,92,0,.08);}
  .btn-danger{padding:9px 16px;border-radius:var(--r-sm);background:rgba(240,78,78,.1);color:var(--red);border:1px solid rgba(240,78,78,.25);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;}
  .btn-danger:hover{background:rgba(240,78,78,.18);}
  .fpag-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
  @media(max-width:700px){.fpag-cards{grid-template-columns:1fr 1fr;}}
  .fpag-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:18px;}
  .fpag-icon{font-size:26px;margin-bottom:8px;}
  .fpag-name{font-size:11px;color:var(--mu);margin-bottom:4px;}
  .fpag-val{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;}
  .chart-bar-wrap{display:flex;align-items:flex-end;gap:5px;height:110px;padding:0 4px;}
  .chart-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;}
  .chart-bar{width:100%;border-radius:5px 5px 0 0;transition:height .3s ease;}
  .chart-label{font-size:9px;color:var(--mu);}
  .sessao-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  @media(max-width:700px){.sessao-grid{grid-template-columns:1fr;}}
  .sessao-event{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid var(--bd);}
  .sessao-event:last-child{border-bottom:none;}
  .ev-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .ev-icon.aberto{background:rgba(34,201,122,.1);color:var(--grn);}
  .ev-icon.fechado{background:rgba(240,78,78,.1);color:var(--red);}
  .ev-icon.mov{background:rgba(255,92,0,.1);color:var(--acc);}
  .ev-title{font-size:12px;font-weight:600;}
  .ev-sub{font-size:11px;color:var(--mu);}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;}
  .modal{background:var(--s1);border:1px solid var(--bd2);border-radius:18px;padding:28px;width:100%;max-width:420px;animation:pdv-fadeUp .2s ease;}
  @keyframes pdv-fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
  .modal-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:4px;}
  .modal-sub{font-size:13px;color:var(--mu);margin-bottom:20px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
  .empty-state{padding:36px 20px;text-align:center;color:var(--mu);font-size:13px;}
  .divider{height:1px;background:var(--bd);margin:8px 0;}
  .info-note{font-size:11px;color:var(--mu);margin-top:6px;padding:8px 10px;background:var(--s2);border-radius:7px;}
  .chart-grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;}
  @media(max-width:900px){.chart-grid{grid-template-columns:1fr;}}
`;

const Icon = ({ d, size = 14, color }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  TrendingUp: "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  TrendingDown: "M23 18l-9.5-9.5-5 5L1 6 M17 18h6v-6",
  Wallet: "M20 12V22H4V12 M22 7H2v5h20V7z M12 22V7 M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  Receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z M8 9h8 M8 13h6",
  BarChart3: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
  CreditCard: "M2 5h20v14H2z M2 10h20",
  Lock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4",
  Unlock: "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 019.9-1",
  Plus: "M12 5v14 M5 12h14",
  Minus: "M5 12h14",
  Clock: "M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2",
  CheckCircle2: "M12 22a10 10 0 100-20 10 10 0 000 20z M8 12l3 3 5-5",
  AlertCircle: "M12 2a10 10 0 100 20A10 10 0 0012 2z M12 8v4 M12 16h.01",
  X: "M18 6L6 18 M6 6l12 12",
  ShoppingBag: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0",
};
const I = ({ n, size = 14, color }: { n: keyof typeof Icons; size?: number; color?: string }) =>
  <Icon d={Icons[n]} size={size} color={color} />;

const HOURS = ["09h","10h","11h","12h","13h","14h","15h","16h","17h","18h","19h","20h","21h","22h"];

const fpagInfo: Record<FormaPagamento, { label: string; emoji: string }> = {
  pix: { label: "Pix", emoji: "💠" },
  dinheiro: { label: "Dinheiro", emoji: "💵" },
  credito: { label: "Crédito", emoji: "💳" },
  debito: { label: "Débito", emoji: "🔵" },
  voucher: { label: "Voucher", emoji: "🎫" },
};

const categorias = ["geral","insumos","salários","delivery","manutenção","aluguel","outros"];

const MOV_KEY = "pdv_caixa_movs_v2";
const SESSAO_KEY = "pdv_sessao_v1";
const MOV_KEY_LEGACY = "pdv_caixa_movimentacoes_local_v1";

type PedidoRow = { id: string; total: number | null; status: string | null; created_at: string; forma_pagamento: string | null };

function buildHourlyChart(pedidos: PedidoRow[]): Record<string, number> {
  const horas: Record<string, number> = {};
  HOURS.forEach((h) => { horas[h] = 0; });
  pedidos
    .filter((p) => p.status === "entregue")
    .forEach((p) => {
      const h = new Date(p.created_at).getHours();
      const key = `${String(h).padStart(2, "0")}h`;
      if (key in horas) horas[key] += Number(p.total || 0);
    });
  return horas;
}

function buildPgtoBreakdown(pedidos: PedidoRow[]): Record<FormaPagamento, number> {
  const out = { ...EMPTY_PGTO };
  pedidos
    .filter((p) => p.status === "entregue")
    .forEach((p) => {
      const fp = normalizeFormaPagamento(p.forma_pagamento);
      out[fp] += Number(p.total || 0);
    });
  return out;
}

export default function CaixaPDV() {
  const [isMasterAccount, setIsMasterAccount] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [period, setPeriod] = useState<Period>("hoje");
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [faturamento, setFaturamento] = useState(0);
  const [vendasCount, setVendasCount] = useState(0);
  const [hojeFaturamento, setHojeFaturamento] = useState(0);
  const [hojePedidos, setHojePedidos] = useState(0);
  const [pgtoBreakdown, setPgtoBreakdown] = useState<Record<FormaPagamento, number>>(EMPTY_PGTO);
  const [horasChart, setHorasChart] = useState<Record<string, number>>({});

  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [sessao, setSessao] = useState<SessaoCaixa | null>(null);
  const [activeTab, setActiveTab] = useState("chart");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [formaPgto, setFormaPgto] = useState<FormaPagamento>("pix");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [clock, setClock] = useState(new Date().toLocaleTimeString("pt-BR"));
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [showFecharModal, setShowFecharModal] = useState(false);
  const [fundoCaixa, setFundoCaixa] = useState("");
  const [responsavel, setResponsavel] = useState("");

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("pt-BR")), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const r = localStorage.getItem(MOV_KEY);
      if (r) { setMovimentacoes(JSON.parse(r)); return; }
      const legacy = localStorage.getItem(MOV_KEY_LEGACY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Array<{ id: string; tipo: "entrada" | "saida"; valor: number; descricao: string; created_at: string }>;
        const migrated: Movimentacao[] = parsed.map((m) => ({
          ...m, forma_pagamento: m.tipo === "entrada" ? "pix" : null, categoria: "geral",
        }));
        setMovimentacoes(migrated);
        localStorage.setItem(MOV_KEY, JSON.stringify(migrated));
      }
    } catch { /* ignore */ }
    try {
      const r = localStorage.getItem(SESSAO_KEY);
      if (r) setSessao(JSON.parse(r));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: company } = await supabase.rpc("get_my_company");
        setIsMasterAccount(company?.[0]?.is_master_account === true);
      } catch {
        setIsMasterAccount(false);
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  const refreshResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const { data: companyId, error: companyError } = await supabase.rpc("get_my_company_id");
      if (companyError) throw companyError;
      if (!companyId) throw new Error("company id not found");

      const range = periodRange(period);
      const todayRange = periodRange("hoje");

      const [periodRes, todayRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select("id, total, status, created_at, forma_pagamento")
          .eq("company_id", companyId as string)
          .gte("created_at", range.start)
          .lte("created_at", range.end),
        supabase
          .from("pedidos")
          .select("id, total, status, created_at, forma_pagamento")
          .eq("company_id", companyId as string)
          .gte("created_at", todayRange.start)
          .lte("created_at", todayRange.end),
      ]);

      if (periodRes.error) throw periodRes.error;
      if (todayRes.error) throw todayRes.error;

      const pedidosPeriod = (periodRes.data || []) as PedidoRow[];
      const pedidosHoje = (todayRes.data || []) as PedidoRow[];
      const entregues = pedidosPeriod.filter((p) => p.status === "entregue");
      const entreguesHoje = pedidosHoje.filter((p) => p.status === "entregue");

      const total = entregues.reduce((s, p) => s + Number(p.total || 0), 0);
      const totalHoje = entreguesHoje.reduce((s, p) => s + Number(p.total || 0), 0);

      setFaturamento(total);
      setVendasCount(entregues.length);
      setHojeFaturamento(totalHoje);
      setHojePedidos(entreguesHoje.length);
      setPgtoBreakdown(buildPgtoBreakdown(pedidosPeriod));
      setHorasChart(buildHourlyChart(pedidosHoje));
    } catch (error) {
      console.error("Erro ao carregar resumo PDV:", error);
      toast.error("Erro ao carregar Caixa/PDV");
    } finally {
      setLoadingResumo(false);
    }
  }, [period]);

  useEffect(() => {
    if (isMasterAccount) refreshResumo();
  }, [isMasterAccount, refreshResumo]);

  const entradas = useMemo(() => movimentacoes.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0), [movimentacoes]);
  const saidas = useMemo(() => movimentacoes.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0), [movimentacoes]);
  const fundoInicial = sessao?.fundo_caixa ?? 0;
  const saldo = fundoInicial + faturamento + entradas - saidas;
  const ticketMedio = vendasCount > 0 ? faturamento / vendasCount : 0;
  const maxVendaHora = Math.max(1, ...HOURS.map((h) => horasChart[h] || 0));

  const abrirCaixa = () => {
    if (!responsavel.trim()) { toast.error("Informe o nome do responsável"); return; }
    const s: SessaoCaixa = {
      id: crypto.randomUUID(), status: "aberto",
      fundo_caixa: Number(fundoCaixa) || 0,
      abertura_at: new Date().toISOString(), fechamento_at: null,
      responsavel: responsavel.trim(),
    };
    setSessao(s);
    localStorage.setItem(SESSAO_KEY, JSON.stringify(s));
    setShowAbrirModal(false);
    setFundoCaixa("");
    setResponsavel("");
    toast.success("Caixa aberto com sucesso!");
  };

  const fecharCaixa = () => {
    if (!sessao) return;
    const s: SessaoCaixa = { ...sessao, status: "fechado", fechamento_at: new Date().toISOString() };
    setSessao(s);
    localStorage.setItem(SESSAO_KEY, JSON.stringify(s));
    setShowFecharModal(false);
    toast.success("Caixa fechado. Bom descanso!");
  };

  const registrarMovimentacao = () => {
    if (sessao?.status !== "aberto") { toast.error("Abra o caixa antes de registrar movimentações"); return; }
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) { toast.error("Informe um valor válido"); return; }
    const item: Movimentacao = {
      id: crypto.randomUUID(), tipo,
      forma_pagamento: tipo === "entrada" ? formaPgto : null,
      valor: v, descricao: descricao.trim(), categoria,
      created_at: new Date().toISOString(),
    };
    const next = [item, ...movimentacoes];
    setMovimentacoes(next);
    localStorage.setItem(MOV_KEY, JSON.stringify(next));
    setValor("");
    setDescricao("");
    toast.success(`${tipo === "entrada" ? "Entrada" : "Saída"} registrada`);
  };

  const removerMovimentacao = (id: string) => {
    const next = movimentacoes.filter((m) => m.id !== id);
    setMovimentacoes(next);
    localStorage.setItem(MOV_KEY, JSON.stringify(next));
    toast.success("Movimentação removida");
  };

  if (checkingAccess) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isMasterAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva para contas master. Entre em contato com o administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="pdv-root">

        <div className="pdv-topbar">
          <div className="pdv-logo">
            <div className="pdv-logo-icon">🍕</div>
            <div className="pdv-logo-title">Caixa / PDV</div>
            <div style={{ width: 1, height: 20, background: "var(--bd2)", margin: "0 4px" }} />
            <div style={{ fontSize: 12, color: "var(--mu)" }}>
              {sessao?.status === "aberto" ? `Aberto por ${sessao.responsavel}` : "Caixa fechado"}
            </div>
          </div>
          <div className="pdv-topbar-right">
            <div className="pdv-badge"><div className="dot-live" />Hoje <strong>{brl(hojeFaturamento)}</strong></div>
            <div className="pdv-badge">Pedidos <strong>{hojePedidos}</strong></div>
            <div className="pdv-clock">{clock}</div>
          </div>
        </div>

        <div className="pdv-content">

          <div className={`caixa-status-bar ${sessao?.status ?? "fechado"}`}>
            <div className="cs-left">
              <div className={`cs-icon ${sessao?.status ?? "fechado"}`}>
                <I n={sessao?.status === "aberto" ? "Unlock" : "Lock"} size={18} />
              </div>
              <div>
                <div className="cs-label">Status do caixa</div>
                <div className="cs-value" style={{ color: sessao?.status === "aberto" ? "var(--grn)" : "var(--red)" }}>
                  {sessao?.status === "aberto"
                    ? `Aberto desde ${new Date(sessao.abertura_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Caixa fechado"}
                </div>
              </div>
              {sessao?.status === "aberto" && (
                <div style={{ marginLeft: 16 }}>
                  <div className="cs-label">Fundo inicial</div>
                  <div className="cs-value">{brl(sessao.fundo_caixa)}</div>
                </div>
              )}
            </div>
            <div className="cs-right">
              {sessao?.status !== "aberto"
                ? <button type="button" className="btn-outline btn-outline-acc" onClick={() => setShowAbrirModal(true)}><I n="Unlock" size={14} /> Abrir caixa</button>
                : <button type="button" className="btn-danger" onClick={() => setShowFecharModal(true)}><I n="Lock" size={14} /> Fechar caixa</button>}
            </div>
          </div>

          <div className="period-select">
            {(["hoje", "ontem", "semana", "mes"] as Period[]).map((p) => (
              <button key={p} type="button" className={`period-btn ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>
                {{ hoje: "Hoje", ontem: "Ontem", semana: "7 dias", mes: "Este mês" }[p]}
              </button>
            ))}
            {loadingResumo && <span style={{ fontSize: 11, color: "var(--mu)", alignSelf: "center", marginLeft: 8 }}>Atualizando…</span>}
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label"><I n="TrendingUp" size={12} />Faturamento</div>
              <div className="kpi-value" style={{ color: "var(--grn)" }}>{brl(faturamento)}</div>
              <div className="kpi-sub">{vendasCount} pedidos entregues</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><I n="ShoppingBag" size={12} />Ticket médio</div>
              <div className="kpi-value" style={{ color: "var(--blu)" }}>{brl(ticketMedio)}</div>
              <div className="kpi-sub">{vendasCount} vendas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><I n="Plus" size={12} color="var(--grn)" />Entradas manuais</div>
              <div className="kpi-value" style={{ color: "var(--grn)" }}>{brl(entradas)}</div>
              <div className="kpi-sub">{movimentacoes.filter((m) => m.tipo === "entrada").length} lançamentos</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><I n="Minus" size={12} color="var(--red)" />Saídas manuais</div>
              <div className="kpi-value" style={{ color: "var(--red)" }}>{brl(saidas)}</div>
              <div className="kpi-sub">{movimentacoes.filter((m) => m.tipo === "saida").length} lançamentos</div>
            </div>
            <div className="kpi-card" style={{ borderColor: "rgba(255,92,0,.25)" }}>
              <div className="kpi-label"><I n="Wallet" size={12} color="var(--acc)" />Saldo do caixa</div>
              <div className="kpi-value" style={{ color: "var(--acc)" }}>{brl(saldo)}</div>
              <div className="kpi-sub">Fundo + fat. + entradas − saídas</div>
            </div>
          </div>

          <div className="saldo-banner">
            <div className="saldo-left">
              <div className="saldo-icon">💰</div>
              <div>
                <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 4 }}>Saldo atual do caixa</div>
                <div className="saldo-value">{brl(saldo)}</div>
                <div className="saldo-meta">
                  <span style={{ color: "var(--grn)" }}>↑ {brl(faturamento + entradas)}</span>
                  <span style={{ color: "var(--red)" }}>↓ {brl(saidas)}</span>
                  <span>Fundo {brl(fundoInicial)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pdv-tabs">
            {[
              { id: "movs", label: "Movimentações", icon: "Receipt" as const },
              { id: "fpag", label: "Formas de Pagamento", icon: "CreditCard" as const },
              { id: "chart", label: "Gráfico do Dia", icon: "BarChart3" as const },
              { id: "sessao", label: "Sessão", icon: "Clock" as const },
            ].map((t) => (
              <div key={t.id} className={`pdv-tab ${activeTab === t.id ? "on" : ""}`} onClick={() => setActiveTab(t.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setActiveTab(t.id)}>
                <I n={t.icon} size={14} /> {t.label}
                {t.id === "movs" && <span className="tab-count">{movimentacoes.length}</span>}
              </div>
            ))}
          </div>

          {activeTab === "movs" && (
            <div className="main-grid">
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Movimentações manuais</div>
                  <div className="card-meta">{movimentacoes.length} registros</div>
                </div>
                {movimentacoes.length === 0 ? (
                  <div className="empty-state"><I n="Receipt" size={36} /><br />Nenhuma movimentação. Registre ao lado.</div>
                ) : (
                  <table className="mov-table">
                    <thead>
                      <tr><th>Descrição</th><th>Tipo</th><th>Pgto</th><th>Hora</th><th style={{ textAlign: "right" }}>Valor</th><th></th></tr>
                    </thead>
                    <tbody>
                      {movimentacoes.slice(0, 30).map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 500 }}>{m.descricao || (m.tipo === "entrada" ? "Entrada" : "Saída")}</td>
                          <td><span className={`tag-tipo ${m.tipo}`}>{m.tipo === "entrada" ? "↑" : "↓"} {m.tipo}</span></td>
                          <td>
                            {m.forma_pagamento
                              ? <span className="pgto-pill">{fpagInfo[m.forma_pagamento].emoji} {fpagInfo[m.forma_pagamento].label}</span>
                              : <span style={{ color: "var(--mu)", fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--mu)" }}>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: m.tipo === "entrada" ? "var(--grn)" : "var(--red)" }}>
                            {m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}
                          </td>
                          <td>
                            <button type="button" onClick={() => removerMovimentacao(m.id)} style={{ background: "none", border: "none", color: "var(--mu)", cursor: "pointer", padding: 4 }}>
                              <I n="X" size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="form-card">
                <div className="card-head">
                  <div className="card-title">Nova movimentação</div>
                  {sessao?.status === "aberto"
                    ? <span style={{ fontSize: 10, color: "var(--grn)", display: "flex", alignItems: "center", gap: 4 }}><I n="CheckCircle2" size={11} /> Aberto</span>
                    : <span style={{ fontSize: 10, color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}><I n="AlertCircle" size={11} /> Fechado</span>}
                </div>
                <div className="form-body">
                  <div className="tipo-grid">
                    <button type="button" className={`tipo-btn ${tipo === "entrada" ? "on entrada" : ""}`} onClick={() => setTipo("entrada")}><I n="TrendingUp" size={14} /> Entrada</button>
                    <button type="button" className={`tipo-btn ${tipo === "saida" ? "on saida" : ""}`} onClick={() => setTipo("saida")}><I n="TrendingDown" size={14} /> Saída</button>
                  </div>
                  {tipo === "entrada" && (
                    <div className="field">
                      <label>Forma de pagamento</label>
                      <div className="fpag-grid">
                        {(Object.keys(fpagInfo) as FormaPagamento[]).map((fp) => (
                          <button key={fp} type="button" className={`fpag-btn ${formaPgto === fp ? "on" : ""}`} onClick={() => setFormaPgto(fp)}>
                            {fpagInfo[fp].emoji}<span>{fpagInfo[fp].label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {tipo === "saida" && (
                    <div className="field">
                      <label>Categoria</label>
                      <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                        {categorias.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="field">
                    <label>Valor (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Descrição (opcional)</label>
                    <input type="text" placeholder={tipo === "entrada" ? "Ex: Venda balcão" : "Ex: Compra insumos"} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                  </div>
                  <button type="button" className="btn-primary" onClick={registrarMovimentacao} disabled={sessao?.status !== "aberto"}>
                    + Registrar movimentação
                  </button>
                  {sessao?.status !== "aberto" && <div className="info-note">Abra o caixa para registrar movimentações.</div>}
                  <div className="info-note">Dados salvos no localStorage do navegador.</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "fpag" && (
            <div>
              <div className="fpag-cards">
                {(Object.keys(fpagInfo) as FormaPagamento[]).map((fp) => (
                  <div className="fpag-card" key={fp}>
                    <div className="fpag-icon">{fpagInfo[fp].emoji}</div>
                    <div className="fpag-name">{fpagInfo[fp].label}</div>
                    <div className="fpag-val" style={{ color: pgtoBreakdown[fp] > 0 ? "var(--grn)" : "var(--mu)" }}>{brl(pgtoBreakdown[fp])}</div>
                  </div>
                ))}
              </div>
              <div className="main-grid">
                <div className="card">
                  <div className="card-head"><div className="card-title">Breakdown de pagamentos</div></div>
                  <div style={{ padding: 20 }}>
                    {(Object.keys(fpagInfo) as FormaPagamento[]).map((fp) => {
                      const pct = faturamento > 0 ? (pgtoBreakdown[fp] / faturamento) * 100 : 0;
                      const colors: Record<FormaPagamento, string> = { pix: "var(--pur)", dinheiro: "var(--grn)", credito: "var(--acc)", debito: "var(--blu)", voucher: "var(--amb)" };
                      return (
                        <div key={fp} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13 }}>{fpagInfo[fp].emoji} {fpagInfo[fp].label}</span>
                            <span style={{ fontSize: 12, color: "var(--mu)" }}>{brl(pgtoBreakdown[fp])} · {pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 6, background: "var(--s3)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: colors[fp], borderRadius: 3, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="form-card" style={{ position: "relative" }}>
                  <div className="card-head"><div className="card-title">Calculadora de troco</div></div>
                  <TrocoCalc />
                </div>
              </div>
            </div>
          )}

          {activeTab === "chart" && (
            <div className="chart-grid">
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Faturamento por hora — hoje</div>
                  <div className="card-meta">Pedidos entregues</div>
                </div>
                <div style={{ padding: "20px 20px 16px" }}>
                  <div className="chart-bar-wrap">
                    {HOURS.map((h) => {
                      const v = horasChart[h] || 0;
                      const pct = (v / maxVendaHora) * 90 || 2;
                      return (
                        <div className="chart-col" key={h}>
                          <div className="chart-bar" style={{
                            height: `${pct}px`,
                            background: v > 0 ? "linear-gradient(180deg,var(--acc),rgba(255,92,0,.35))" : "var(--s3)",
                          }} title={brl(v)} />
                          <div className="chart-label">{h}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title">Resumo do período</div></div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "Faturamento bruto", val: brl(faturamento), color: "var(--grn)" },
                    { label: "Entradas manuais", val: brl(entradas), color: "var(--blu)" },
                    { label: "Saídas manuais", val: brl(saidas), color: "var(--red)" },
                    { label: "Fundo de caixa", val: brl(fundoInicial), color: "var(--mu2)" },
                    { label: "Saldo final", val: brl(saldo), color: "var(--acc)" },
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--mu)" }}>{r.label}</span>
                      <span style={{ fontWeight: 700, fontSize: r.label === "Saldo final" ? 16 : 13, color: r.color }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "sessao" && (
            <div className="sessao-grid">
              <div className="card">
                <div className="card-head"><div className="card-title">Histórico da sessão atual</div></div>
                <div style={{ padding: "0 20px" }}>
                  {sessao ? (
                    <>
                      <div className="sessao-event">
                        <div className="ev-icon aberto"><I n="Unlock" size={14} /></div>
                        <div>
                          <div className="ev-title">Caixa aberto</div>
                          <div className="ev-sub">{new Date(sessao.abertura_at).toLocaleString("pt-BR")} · {sessao.responsavel}</div>
                          <div className="ev-sub">Fundo: {brl(sessao.fundo_caixa)}</div>
                        </div>
                      </div>
                      {movimentacoes.slice(0, 10).map((m) => (
                        <div className="sessao-event" key={m.id}>
                          <div className="ev-icon mov"><I n={m.tipo === "entrada" ? "TrendingUp" : "TrendingDown"} size={13} /></div>
                          <div>
                            <div className="ev-title">{m.descricao || (m.tipo === "entrada" ? "Entrada manual" : "Saída manual")}</div>
                            <div className="ev-sub">
                              {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                              <span style={{ color: m.tipo === "entrada" ? "var(--grn)" : "var(--red)" }}>{m.tipo === "entrada" ? "+" : "−"}{brl(m.valor)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {sessao.status === "fechado" && (
                        <div className="sessao-event">
                          <div className="ev-icon fechado"><I n="Lock" size={14} /></div>
                          <div>
                            <div className="ev-title">Caixa fechado</div>
                            <div className="ev-sub">{sessao.fechamento_at && new Date(sessao.fechamento_at).toLocaleString("pt-BR")}</div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state"><I n="Clock" size={32} /><br />Nenhuma sessão registrada.</div>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title">Conferência de fechamento</div></div>
                <div style={{ padding: 16 }}>
                  {[
                    { label: "Faturamento", val: brl(faturamento), ok: true },
                    { label: "Entradas manuais", val: brl(entradas), ok: true },
                    { label: "Saídas manuais", val: brl(saidas), ok: true },
                    { label: "Fundo inicial", val: brl(fundoInicial), ok: fundoInicial > 0 },
                    { label: "Saldo calculado", val: brl(saldo), ok: saldo >= 0 },
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--mu)" }}>
                        <I n={r.ok ? "CheckCircle2" : "AlertCircle"} size={13} color={r.ok ? "var(--grn)" : "var(--amb)"} />
                        {r.label}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{r.val}</span>
                    </div>
                  ))}
                  <div className="divider" />
                  <div style={{ marginTop: 12 }}>
                    {sessao?.status === "aberto"
                      ? <button type="button" className="btn-danger" style={{ width: "100%" }} onClick={() => setShowFecharModal(true)}><I n="Lock" size={14} /> Fechar caixa agora</button>
                      : <button type="button" className="btn-outline btn-outline-acc" style={{ width: "100%" }} onClick={() => setShowAbrirModal(true)}><I n="Unlock" size={14} /> Abrir novo caixa</button>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAbrirModal && (
          <div className="modal-overlay" onClick={() => setShowAbrirModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Abrir caixa</div>
              <div className="modal-sub">Informe o fundo de caixa e o responsável pelo turno.</div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Responsável *</label>
                <input type="text" placeholder="Nome do operador" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
              </div>
              <div className="field">
                <label>Fundo de caixa (R$)</label>
                <input type="number" min="0" placeholder="0,00" value={fundoCaixa} onChange={(e) => setFundoCaixa(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowAbrirModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={abrirCaixa}><I n="Unlock" size={14} /> Abrir caixa</button>
              </div>
            </div>
          </div>
        )}

        {showFecharModal && (
          <div className="modal-overlay" onClick={() => setShowFecharModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Fechar caixa</div>
              <div className="modal-sub">Confirme os valores antes de fechar o turno.</div>
              {[
                { label: "Faturamento", val: brl(faturamento) },
                { label: "Entradas manuais", val: brl(entradas) },
                { label: "Saídas manuais", val: brl(saidas) },
                { label: "Saldo final", val: brl(saldo) },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bd)", fontSize: 13 }}>
                  <span style={{ color: "var(--mu)" }}>{r.label}</span><strong>{r.val}</strong>
                </div>
              ))}
              <div className="modal-actions">
                <button type="button" className="btn-outline" onClick={() => setShowFecharModal(false)}>Cancelar</button>
                <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={fecharCaixa}><I n="Lock" size={14} /> Confirmar fechamento</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TrocoCalc() {
  const [vlTotal, setVlTotal] = useState("");
  const [vlRecebido, setVlRecebido] = useState("");
  const troco = useMemo(() => {
    const t = Number(vlTotal);
    const r = Number(vlRecebido);
    if (!Number.isFinite(t) || !Number.isFinite(r) || !vlTotal || !vlRecebido) return null;
    return r - t;
  }, [vlTotal, vlRecebido]);
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="field">
        <label>Total da venda (R$)</label>
        <input type="number" min="0" step="0.01" placeholder="0,00" value={vlTotal} onChange={(e) => setVlTotal(e.target.value)} />
      </div>
      <div className="field">
        <label>Valor recebido (R$)</label>
        <input type="number" min="0" step="0.01" placeholder="0,00" value={vlRecebido} onChange={(e) => setVlRecebido(e.target.value)} />
      </div>
      {troco !== null && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: troco >= 0 ? "rgba(34,201,122,.08)" : "rgba(240,78,78,.08)", border: `1px solid ${troco >= 0 ? "rgba(34,201,122,.25)" : "rgba(240,78,78,.25)"}` }}>
          <div style={{ fontSize: 11, color: "var(--mu)", marginBottom: 4 }}>{troco >= 0 ? "Troco a dar" : "Valor insuficiente"}</div>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 28, fontWeight: 800, color: troco >= 0 ? "var(--grn)" : "var(--red)" }}>
            {troco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Copy, Gift, Megaphone, Percent, RefreshCcw, Settings2, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { CampanhasDashboard } from "@/components/campanhas/CampanhasDashboard";
import { WhatsAppTemplatesManager } from "@/components/whatsapp/WhatsAppTemplatesManager";
import { AniversariantesManager } from "@/components/leads/AniversariantesManager";

type Coupon = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: "percentual" | "valor_fixo" | "frete_gratis";
  valor: number;
  pedido_minimo: number;
  limite_uso: number | null;
  usos: number;
  inicio: string | null;
  fim: string | null;
  ativo: boolean;
};

type Automation = {
  id: string;
  nome: string;
  gatilho: string;
  atraso_minutos: number;
  mensagem: string;
  ativo: boolean;
};

type OrderRow = {
  id: string;
  lead_id: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  total: number;
  status: string;
  created_at: string;
  origem_publica?: any;
};

type SegmentRow = {
  key: string;
  name: string;
  phone: string;
  orders: number;
  total: number;
  recency: number;
  lastOrder: string;
  segment: string;
};

const defaultDates = [
  { nome: "Dia da Pizza", when: "10/07", categoria: "Pizzaria", sugestao: "Combo com pizza grande + refri e cupom PIZZA10." },
  { nome: "Dia dos Namorados", when: "12/06", categoria: "Casais", sugestao: "Oferta para 2 pessoas com sobremesa." },
  { nome: "Dia das Maes", when: "2o domingo de maio", categoria: "Familia", sugestao: "Campanha antecipada para almoco em familia." },
  { nome: "Black Friday", when: "Novembro", categoria: "Promocao", sugestao: "Cupom limitado por horario para gerar urgencia." },
  { nome: "Festa Junina", when: "Junho", categoria: "Sazonal", sugestao: "Produtos tematicos e combos de inverno." },
  { nome: "Aniversario da loja", when: "Personalizado", categoria: "Relacionamento", sugestao: "Cupom de agradecimento para clientes ativos." },
  { nome: "Dia de chuva", when: "Gatilho manual", categoria: "Clima", sugestao: "Mensagem rapida para delivery com conforto em casa." },
  { nome: "Dia fraco", when: "Terca/quarta", categoria: "Recorrente", sugestao: "Oferta simples para aumentar movimento." },
];

const defaultAutomations = [
  {
    nome: "Carrinho abandonado",
    gatilho: "carrinho_abandonado",
    atraso_minutos: 45,
    mensagem: "Oi {{nome}}, seu pedido ficou esperando. Quer finalizar agora? Use o cupom VOLTEI10.",
  },
  {
    nome: "Cliente sumiu 30 dias",
    gatilho: "cliente_inativo",
    atraso_minutos: 43200,
    mensagem: "Oi {{nome}}, sentimos sua falta. Hoje tem uma oferta especial para voce voltar.",
  },
  {
    nome: "Pos-compra",
    gatilho: "pos_compra",
    atraso_minutos: 120,
    mensagem: "Oi {{nome}}, obrigado pelo pedido. Conta pra gente se chegou tudo certinho?",
  },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function normalizeCouponCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

export default function MarketingPromocional() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [couponForm, setCouponForm] = useState({
    codigo: "",
    descricao: "",
    tipo: "percentual" as Coupon["tipo"],
    valor: "10",
    pedido_minimo: "0",
    limite_uso: "",
    inicio: "",
    fim: "",
  });
  const [automationForm, setAutomationForm] = useState({
    nome: "",
    gatilho: "cliente_inativo",
    atraso_minutos: "1440",
    mensagem: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const segments = useMemo(() => buildSegments(orders), [orders]);
  const segmentStats = useMemo(() => ({
    vip: segments.filter((item) => item.segment === "VIP").length,
    risco: segments.filter((item) => item.segment === "Em risco").length,
    dormente: segments.filter((item) => item.segment === "Dormente").length,
    novo: segments.filter((item) => item.segment === "Novo").length,
  }), [segments]);

  const activeCoupons = coupons.filter((coupon) => coupon.ativo).length;
  const activeAutomations = automations.filter((automation) => automation.ativo).length;
  const monthlyRevenue = orders
    .filter((order) => daysSince(order.created_at) <= 30 && order.status !== "cancelado")
    .reduce((sum, order) => sum + safeNumber(order.total), 0);

  async function loadInitialData() {
    setLoading(true);
    setMigrationNeeded(false);

    try {
      const { data: cid, error } = await supabase.rpc("get_my_company_id");
      if (error) throw error;
      if (!cid) return;

      setCompanyId(cid);
      await Promise.all([loadCoupons(cid), loadAutomations(cid), loadOrders(cid)]);
    } catch (error: any) {
      console.error("Erro ao carregar marketing:", error);
      toast.error("Nao foi possivel carregar o modulo de marketing.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCoupons(cid = companyId) {
    if (!cid) return;

    const { data, error } = await (supabase.from("marketing_cupons" as any) as any)
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    setCoupons((data || []) as Coupon[]);
  }

  async function loadAutomations(cid = companyId) {
    if (!cid) return;

    const { data, error } = await (supabase.from("marketing_automacoes" as any) as any)
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    setAutomations((data || []) as Automation[]);
  }

  async function loadOrders(cid = companyId) {
    if (!cid) return;

    const { data, error } = await supabase
      .from("pedidos")
      .select("id, lead_id, cliente_nome, cliente_telefone, total, status, created_at, origem_publica")
      .eq("company_id", cid)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Erro ao carregar pedidos para RFM:", error);
      return;
    }

    setOrders((data || []) as OrderRow[]);
  }

  function handleMaybeMissingMigration(error: any) {
    console.error("Tabela de marketing indisponivel:", error);
    if (error?.code === "42P01" || error?.message?.includes("does not exist") || error?.message?.includes("schema cache")) {
      setMigrationNeeded(true);
      return;
    }
    toast.error(error?.message || "Erro ao carregar marketing.");
  }

  async function createCoupon() {
    if (!companyId) return;
    const codigo = normalizeCouponCode(couponForm.codigo);
    if (!codigo) {
      toast.error("Informe o codigo do cupom.");
      return;
    }

    const payload = {
      company_id: companyId,
      codigo,
      descricao: couponForm.descricao || null,
      tipo: couponForm.tipo,
      valor: couponForm.tipo === "frete_gratis" ? 0 : safeNumber(couponForm.valor),
      pedido_minimo: safeNumber(couponForm.pedido_minimo),
      limite_uso: couponForm.limite_uso ? Number(couponForm.limite_uso) : null,
      inicio: couponForm.inicio || null,
      fim: couponForm.fim || null,
      ativo: true,
    };

    const { error } = await (supabase.from("marketing_cupons" as any) as any).insert(payload);
    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    toast.success("Cupom criado.");
    setCouponForm({ codigo: "", descricao: "", tipo: "percentual", valor: "10", pedido_minimo: "0", limite_uso: "", inicio: "", fim: "" });
    loadCoupons();
  }

  async function toggleCoupon(coupon: Coupon) {
    const { error } = await (supabase.from("marketing_cupons" as any) as any)
      .update({ ativo: !coupon.ativo })
      .eq("id", coupon.id);

    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    setCoupons((current) => current.map((item) => item.id === coupon.id ? { ...item, ativo: !item.ativo } : item));
  }

  async function createAutomation(seed?: typeof defaultAutomations[number]) {
    if (!companyId) return;
    const source = seed || {
      nome: automationForm.nome,
      gatilho: automationForm.gatilho,
      atraso_minutos: Number(automationForm.atraso_minutos || 0),
      mensagem: automationForm.mensagem,
    };

    if (!source.nome || !source.mensagem) {
      toast.error("Informe nome e mensagem da automacao.");
      return;
    }

    const { error } = await (supabase.from("marketing_automacoes" as any) as any).insert({
      company_id: companyId,
      nome: source.nome,
      gatilho: source.gatilho,
      atraso_minutos: Number(source.atraso_minutos || 0),
      mensagem: source.mensagem,
      ativo: true,
    });

    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    toast.success("Automacao criada.");
    setAutomationForm({ nome: "", gatilho: "cliente_inativo", atraso_minutos: "1440", mensagem: "" });
    loadAutomations();
  }

  async function toggleAutomation(automation: Automation) {
    const { error } = await (supabase.from("marketing_automacoes" as any) as any)
      .update({ ativo: !automation.ativo })
      .eq("id", automation.id);

    if (error) {
      handleMaybeMissingMigration(error);
      return;
    }

    setAutomations((current) => current.map((item) => item.id === automation.id ? { ...item, ativo: !item.ativo } : item));
  }

  function copyCampaignIdea(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Ideia copiada para usar na campanha.");
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Marketing Promocional
          </h1>
          <p className="text-muted-foreground text-lg">
            Campanhas, cupons, datas comemorativas, segmentos RFM e automacoes.
          </p>
        </div>
        <Button variant="outline" onClick={loadInitialData} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {migrationNeeded && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <Settings2 className="h-4 w-4" />
          <AlertTitle>Migration pendente no Supabase</AlertTitle>
          <AlertDescription>
            A tela ja esta pronta, mas as tabelas de cupons e automacoes precisam da migration
            <span className="font-mono"> supabase/migrations/add_marketing_promocional.sql</span>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Cupons ativos" value={activeCoupons} icon={Percent} hint={`${coupons.length} cadastrados`} />
        <MetricCard title="Datas prontas" value={defaultDates.length} icon={CalendarDays} hint="Sugestoes sazonais" />
        <MetricCard title="Clientes VIP" value={segmentStats.vip} icon={Users} hint={`${segments.length} clientes analisados`} />
        <MetricCard title="Receita 30 dias" value={currency.format(monthlyRevenue)} icon={TrendingUp} hint={`${activeAutomations} automacoes ativas`} />
      </div>

      <Tabs defaultValue="hub" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="hub">Hub</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="cupons">Cupons</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="rfm">RFM</TabsTrigger>
          <TabsTrigger value="automacoes">Automacoes</TabsTrigger>
        </TabsList>

        <TabsContent value="hub" className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  O que ja esta conectado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatusLine label="Disparo em massa" done />
                <StatusLine label="Dashboard de campanhas" done />
                <StatusLine label="Aniversario automatico" done />
                <StatusLine label="Templates WhatsApp" done />
                <StatusLine label="Fidelidade por selos" done />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Fechamento do modulo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <StatusLine label="Cupons de desconto" done={coupons.length > 0} />
                <StatusLine label="Calendario promocional" done />
                <StatusLine label="Segmentacao RFM" done={segments.length > 0} />
                <StatusLine label="Automacoes de gatilho" done={automations.length > 0} />
                <StatusLine label="ROI por campanha" done={false} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Acoes rapidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {defaultAutomations.map((item) => (
                  <Button key={item.gatilho} variant="outline" className="w-full justify-start" onClick={() => createAutomation(item)}>
                    <Zap className="h-4 w-4 mr-2" />
                    Criar: {item.nome}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Aniversarios de clientes</CardTitle>
              <CardDescription>Use a rotina existente para mandar mensagem em datas de aniversario.</CardDescription>
            </CardHeader>
            <CardContent>
              <AniversariantesManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campanhas" className="mt-6 space-y-6">
          <Tabs defaultValue="disparo">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="disparo">Disparo</TabsTrigger>
              <TabsTrigger value="relatorio">Relatorio</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="disparo" className="mt-4">
              <DisparoEmMassa />
            </TabsContent>
            <TabsContent value="relatorio" className="mt-4">
              <CampanhasDashboard />
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              {companyId ? <WhatsAppTemplatesManager companyId={companyId} /> : null}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="cupons" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Novo cupom
              </CardTitle>
              <CardDescription>Crie codigos para usar em campanhas e automacoes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input value={couponForm.codigo} onChange={(event) => setCouponForm((prev) => ({ ...prev, codigo: normalizeCouponCode(event.target.value) }))} placeholder="PIZZA10" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={couponForm.tipo} onValueChange={(value: Coupon["tipo"]) => setCouponForm((prev) => ({ ...prev, tipo: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentual">Percentual</SelectItem>
                    <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                    <SelectItem value="frete_gratis">Frete gratis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={couponForm.valor} disabled={couponForm.tipo === "frete_gratis"} onChange={(event) => setCouponForm((prev) => ({ ...prev, valor: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pedido minimo</Label>
                <Input type="number" value={couponForm.pedido_minimo} onChange={(event) => setCouponForm((prev) => ({ ...prev, pedido_minimo: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descricao</Label>
                <Input value={couponForm.descricao} onChange={(event) => setCouponForm((prev) => ({ ...prev, descricao: event.target.value }))} placeholder="Campanha Dia da Pizza" />
              </div>
              <div className="space-y-2">
                <Label>Limite de uso</Label>
                <Input type="number" value={couponForm.limite_uso} onChange={(event) => setCouponForm((prev) => ({ ...prev, limite_uso: event.target.value }))} placeholder="Sem limite" />
              </div>
              <div className="flex items-end">
                <Button onClick={createCoupon} className="w-full">
                  <Gift className="h-4 w-4 mr-2" />
                  Criar cupom
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cupons cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Beneficio</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ativar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-semibold">{coupon.codigo}</TableCell>
                      <TableCell>{describeCoupon(coupon)}</TableCell>
                      <TableCell>{coupon.usos}{coupon.limite_uso ? `/${coupon.limite_uso}` : ""}</TableCell>
                      <TableCell><Badge variant={coupon.ativo ? "default" : "secondary"}>{coupon.ativo ? "Ativo" : "Pausado"}</Badge></TableCell>
                      <TableCell className="text-right"><Switch checked={coupon.ativo} onCheckedChange={() => toggleCoupon(coupon)} /></TableCell>
                    </TableRow>
                  ))}
                  {coupons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cupom cadastrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {defaultDates.map((date) => (
              <Card key={date.nome}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{date.nome}</CardTitle>
                      <CardDescription>{date.when}</CardDescription>
                    </div>
                    <Badge variant="outline">{date.categoria}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground min-h-12">{date.sugestao}</p>
                  <Button variant="outline" className="w-full" onClick={() => copyCampaignIdea(`${date.nome}: ${date.sugestao}`)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar ideia
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rfm" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard title="VIP" value={segmentStats.vip} icon={Sparkles} hint="Alta frequencia/valor" />
            <MetricCard title="Em risco" value={segmentStats.risco} icon={TrendingUp} hint="Compravam e esfriaram" />
            <MetricCard title="Dormentes" value={segmentStats.dormente} icon={Users} hint="Sem compra recente" />
            <MetricCard title="Novos" value={segmentStats.novo} icon={Gift} hint="Primeira compra recente" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Segmentacao RFM</CardTitle>
              <CardDescription>Calculada a partir dos pedidos da empresa.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ultima compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.slice(0, 80).map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.phone}</div>
                      </TableCell>
                      <TableCell><Badge variant={segmentVariant(item.segment)}>{item.segment}</Badge></TableCell>
                      <TableCell className="text-right">{item.orders}</TableCell>
                      <TableCell className="text-right">{currency.format(item.total)}</TableCell>
                      <TableCell className="text-right">{item.recency} dias</TableCell>
                    </TableRow>
                  ))}
                  {segments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Ainda nao ha pedidos suficientes para segmentar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova automacao</CardTitle>
              <CardDescription>Cadastre gatilhos que depois podem ser executados por cron/edge function.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={automationForm.nome} onChange={(event) => setAutomationForm((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Cliente inativo 30 dias" />
              </div>
              <div className="space-y-2">
                <Label>Gatilho</Label>
                <Select value={automationForm.gatilho} onValueChange={(value) => setAutomationForm((prev) => ({ ...prev, gatilho: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carrinho_abandonado">Carrinho abandonado</SelectItem>
                    <SelectItem value="cliente_inativo">Cliente inativo</SelectItem>
                    <SelectItem value="data_especial">Data especial</SelectItem>
                    <SelectItem value="cliente_vip">Cliente VIP</SelectItem>
                    <SelectItem value="pos_compra">Pos-compra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atraso em minutos</Label>
                <Input type="number" value={automationForm.atraso_minutos} onChange={(event) => setAutomationForm((prev) => ({ ...prev, atraso_minutos: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mensagem</Label>
                <Textarea value={automationForm.mensagem} onChange={(event) => setAutomationForm((prev) => ({ ...prev, mensagem: event.target.value }))} placeholder="Oi {{nome}}, sentimos sua falta..." />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => createAutomation()}>
                  <Zap className="h-4 w-4 mr-2" />
                  Criar automacao
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {automations.map((automation) => (
              <Card key={automation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{automation.nome}</CardTitle>
                      <CardDescription>{describeTrigger(automation.gatilho)} depois de {automation.atraso_minutos} min</CardDescription>
                    </div>
                    <Switch checked={automation.ativo} onCheckedChange={() => toggleAutomation(automation)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{automation.mensagem}</p>
                </CardContent>
              </Card>
            ))}
            {automations.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Nenhuma automacao cadastrada.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, hint }: { title: string; value: string | number; icon: any; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatusLine({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <Badge variant={done ? "default" : "secondary"}>{done ? "Pronto" : "Pendente"}</Badge>
    </div>
  );
}

function describeCoupon(coupon: Coupon) {
  if (coupon.tipo === "frete_gratis") return "Frete gratis";
  if (coupon.tipo === "percentual") return `${coupon.valor}% de desconto`;
  return `${currency.format(coupon.valor)} de desconto`;
}

function describeTrigger(trigger: string) {
  const map: Record<string, string> = {
    carrinho_abandonado: "Carrinho abandonado",
    cliente_inativo: "Cliente inativo",
    data_especial: "Data especial",
    cliente_vip: "Cliente VIP",
    pos_compra: "Pos-compra",
  };
  return map[trigger] || trigger;
}

function segmentVariant(segment: string) {
  if (segment === "VIP") return "default";
  if (segment === "Dormente") return "destructive";
  return "secondary";
}

function buildSegments(orders: OrderRow[]): SegmentRow[] {
  const grouped = new Map<string, SegmentRow>();

  orders
    .filter((order) => order.status !== "cancelado")
    .forEach((order) => {
      const key = order.lead_id || order.cliente_telefone || order.cliente_nome;
      const existing = grouped.get(key);
      const currentDate = order.created_at;

      if (!existing) {
        grouped.set(key, {
          key,
          name: order.cliente_nome || "Cliente",
          phone: order.cliente_telefone || "",
          orders: 1,
          total: safeNumber(order.total),
          recency: daysSince(currentDate),
          lastOrder: currentDate,
          segment: "Novo",
        });
        return;
      }

      existing.orders += 1;
      existing.total += safeNumber(order.total);
      if (new Date(currentDate) > new Date(existing.lastOrder)) {
        existing.lastOrder = currentDate;
        existing.recency = daysSince(currentDate);
      }
    });

  return Array.from(grouped.values())
    .map((item) => ({ ...item, segment: classifySegment(item) }))
    .sort((a, b) => b.total - a.total);
}

function classifySegment(item: SegmentRow) {
  if ((item.orders >= 5 || item.total >= 500) && item.recency <= 45) return "VIP";
  if (item.orders === 1 && item.recency <= 30) return "Novo";
  if (item.recency > 60) return "Dormente";
  if (item.orders >= 2 && item.recency > 45) return "Em risco";
  return "Recorrente";
}

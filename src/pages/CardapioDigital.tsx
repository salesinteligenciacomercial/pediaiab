import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Store } from "lucide-react";
import { MARKETPLACE_PATH, MARKETPLACE_TITLE } from "@/config/branding";

const WEEKDAY_OPTIONS = [
  { key: "segunda", label: "Segunda" },
  { key: "terca", label: "Terça" },
  { key: "quarta", label: "Quarta" },
  { key: "quinta", label: "Quinta" },
  { key: "sexta", label: "Sexta" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
] as const;

type WeekdayKey = (typeof WEEKDAY_OPTIONS)[number]["key"];
type ScheduleMap = Record<WeekdayKey, string>;

const parseHorarioFunc = (value: string | undefined): ScheduleMap => {
  try {
    const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
    return WEEKDAY_OPTIONS.reduce((acc, item) => ({
      ...acc,
      [item.key]: typeof parsed[item.key] === "string" ? (parsed[item.key] as string) : "",
    }), {} as ScheduleMap);
  } catch {
    return WEEKDAY_OPTIONS.reduce((acc, item) => ({ ...acc, [item.key]: "" }), {} as ScheduleMap);
  }
};

const formatScheduleJson = (schedule: ScheduleMap) => JSON.stringify(schedule, null, 2);

type LojaConfig = {
  id?: string;
  company_id?: string;
  slug: string;
  nome_loja: string;
  descricao_loja: string;
  logo_url: string;
  banner_url: string;
  cor_primaria: string;
  cor_secundaria: string;
  telefone_loja: string;
  whatsapp_loja: string;
  endereco_loja: string;
  pedido_minimo: string;
  taxa_entrega: string;
  aceita_retirada: boolean;
  aceita_entrega: boolean;
  horario_funcionamento: string;
  mensagem_loja: string;
  impressao_automatica: boolean;
  print_bridge_url: string;
  visivel_marketplace: boolean;
  categoria_marketplace: string;
};

const EMPTY_CONFIG: LojaConfig = {
  slug: "",
  nome_loja: "",
  descricao_loja: "",
  logo_url: "",
  banner_url: "",
  cor_primaria: "#ea580c",
  cor_secundaria: "#111827",
  telefone_loja: "",
  whatsapp_loja: "",
  endereco_loja: "",
  pedido_minimo: "0",
  taxa_entrega: "0",
  aceita_retirada: true,
  aceita_entrega: true,
  horario_funcionamento:
    '{\n  "segunda": "18:00-23:00",\n  "terca": "18:00-23:00",\n  "quarta": "18:00-23:00",\n  "quinta": "18:00-23:00",\n  "sexta": "18:00-23:59",\n  "sabado": "18:00-23:59",\n  "domingo": "18:00-23:00"\n}',
  mensagem_loja: "",
  impressao_automatica: false,
  print_bridge_url: "",
  visivel_marketplace: true,
  categoria_marketplace: "restaurante",
};

export default function CardapioDigital() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [config, setConfig] = useState<LojaConfig>(EMPTY_CONFIG);
  const [schedule, setSchedule] = useState<ScheduleMap>(() => parseHorarioFunc(EMPTY_CONFIG.horario_funcionamento));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;

      const { data: company } = await supabase.from("companies").select("name").eq("id", cid).single();
      const { data, error } = await supabase.from("loja_configuracoes" as any).select("*").eq("company_id", cid).maybeSingle();
      if (error) throw error;

      if (data) {
        const horarioJson = JSON.stringify((data as any).horario_funcionamento || {}, null, 2);
        setConfig({
          ...EMPTY_CONFIG,
          ...(data as any),
          pedido_minimo: String((data as any).pedido_minimo ?? 0),
          taxa_entrega: String((data as any).taxa_entrega ?? 0),
          horario_funcionamento: horarioJson,
          visivel_marketplace: (data as any).visivel_marketplace ?? true,
          categoria_marketplace: (data as any).categoria_marketplace || "restaurante",
        });
        setSchedule(parseHorarioFunc(horarioJson));
      } else {
        const baseSlug = String(company?.name || "loja")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        setConfig((prev) => ({ ...prev, nome_loja: company?.name || "", slug: baseSlug || "loja" }));
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar cardápio digital");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const publicUrl = `${window.location.origin}/cardapio/${config.slug || "loja"}`;
  const marketplaceUrl = `${window.location.origin}${MARKETPLACE_PATH}`;

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        slug: config.slug.trim(),
        nome_loja: config.nome_loja.trim() || null,
        descricao_loja: config.descricao_loja.trim() || null,
        logo_url: config.logo_url.trim() || null,
        banner_url: config.banner_url.trim() || null,
        cor_primaria: config.cor_primaria,
        cor_secundaria: config.cor_secundaria,
        telefone_loja: config.telefone_loja.trim() || null,
        whatsapp_loja: config.whatsapp_loja.trim() || null,
        endereco_loja: config.endereco_loja.trim() || null,
        pedido_minimo: Number(config.pedido_minimo || 0),
        taxa_entrega: Number(config.taxa_entrega || 0),
        aceita_retirada: config.aceita_retirada,
        aceita_entrega: config.aceita_entrega,
        horario_funcionamento: schedule,
        mensagem_loja: config.mensagem_loja.trim() || null,
        impressao_automatica: config.impressao_automatica,
        print_bridge_url: config.print_bridge_url.trim() || null,
        visivel_marketplace: config.visivel_marketplace,
        categoria_marketplace: config.categoria_marketplace,
      };

      const { data: existing } = await supabase.from("loja_configuracoes" as any).select("id").eq("company_id", companyId).maybeSingle();
      const query = existing
        ? supabase.from("loja_configuracoes" as any).update(payload).eq("company_id", companyId)
        : supabase.from("loja_configuracoes" as any).insert(payload);

      const { error } = await query;
      if (error) throw error;
      toast.success("Configurações do cardápio salvas");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cardápio Digital</h1>
          <p className="text-muted-foreground">Configure a loja pública, link do cardápio e operação de entrega/retirada.</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Link público do cardápio</div>
            <div className="text-sm text-muted-foreground">{publicUrl}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar link
            </Button>
            <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Marketplace — {MARKETPLACE_TITLE}</div>
            <div className="text-sm text-muted-foreground">
              Todos os restaurantes conectados em um hub tipo iFood. Seu cardápio aparece aqui quando publicado.
            </div>
            <div className="text-sm text-muted-foreground mt-1">{marketplaceUrl}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(marketplaceUrl); toast.success("Link do marketplace copiado"); }}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar marketplace
            </Button>
            <Button variant="outline" onClick={() => window.open(marketplaceUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver marketplace
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Loja e aparência</CardTitle>
            <CardDescription>Informações principais que aparecem no cardápio público.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Slug</Label><Input value={config.slug} onChange={(e) => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} /></div>
            <div className="space-y-2"><Label>Nome da loja</Label><Input value={config.nome_loja} onChange={(e) => setConfig({ ...config, nome_loja: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={config.descricao_loja} onChange={(e) => setConfig({ ...config, descricao_loja: e.target.value })} /></div>
            <div className="space-y-2"><Label>URL do logo</Label><Input value={config.logo_url} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} /></div>
            <div className="space-y-2"><Label>URL do banner</Label><Input value={config.banner_url} onChange={(e) => setConfig({ ...config, banner_url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cor primária</Label><Input value={config.cor_primaria} onChange={(e) => setConfig({ ...config, cor_primaria: e.target.value })} /></div>
              <div className="space-y-2"><Label>Cor secundária</Label><Input value={config.cor_secundaria} onChange={(e) => setConfig({ ...config, cor_secundaria: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operação</CardTitle>
            <CardDescription>Entrega, retirada, taxa e impressão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Pedido mínimo</Label><Input type="number" step="0.01" value={config.pedido_minimo} onChange={(e) => setConfig({ ...config, pedido_minimo: e.target.value })} /></div>
              <div className="space-y-2"><Label>Taxa de entrega</Label><Input type="number" step="0.01" value={config.taxa_entrega} onChange={(e) => setConfig({ ...config, taxa_entrega: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={config.telefone_loja} onChange={(e) => setConfig({ ...config, telefone_loja: e.target.value })} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={config.whatsapp_loja} onChange={(e) => setConfig({ ...config, whatsapp_loja: e.target.value })} /></div>
            <div className="space-y-2"><Label>Endereço</Label><Textarea rows={3} value={config.endereco_loja} onChange={(e) => setConfig({ ...config, endereco_loja: e.target.value })} /></div>
            <div className="space-y-2"><Label>Mensagem da loja</Label><Textarea rows={3} value={config.mensagem_loja} onChange={(e) => setConfig({ ...config, mensagem_loja: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Horário de funcionamento</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {WEEKDAY_OPTIONS.map((day) => (
                  <div key={day.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{day.label}</span>
                      <span className="text-xs text-slate-400">Ex: 18:00-23:00</span>
                    </div>
                    <Input
                      value={schedule[day.key]}
                      onChange={(e) => setSchedule({ ...schedule, [day.key]: e.target.value })}
                      placeholder="18:00-23:00"
                    />
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Deixe em branco para dia fechado. O valor será salvo como JSON na configuração.
              </div>
            </div>
            <div className="space-y-2"><Label>Horário de funcionamento (JSON)</Label><Textarea rows={8} value={formatScheduleJson(schedule)} readOnly /></div>
            <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Aceita retirada</span><Switch checked={config.aceita_retirada} onCheckedChange={(v) => setConfig({ ...config, aceita_retirada: v })} /></div>
            <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Aceita entrega</span><Switch checked={config.aceita_entrega} onCheckedChange={(v) => setConfig({ ...config, aceita_entrega: v })} /></div>
            <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Exibir no marketplace público</span><Switch checked={config.visivel_marketplace} onCheckedChange={(v) => setConfig({ ...config, visivel_marketplace: v })} /></div>
            <div className="space-y-2">
              <Label>Categoria no marketplace</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={config.categoria_marketplace}
                onChange={(e) => setConfig({ ...config, categoria_marketplace: e.target.value })}
              >
                <option value="pizzaria">Pizzaria</option>
                <option value="hamburguer">Hambúrguer</option>
                <option value="lanches">Lanches</option>
                <option value="doces">Doces</option>
                <option value="restaurante">Restaurante</option>
              </select>
            </div>
            <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Impressão automática</span><Switch checked={config.impressao_automatica} onCheckedChange={(v) => setConfig({ ...config, impressao_automatica: v })} /></div>
            <div className="space-y-2"><Label>Print bridge URL</Label><Input value={config.print_bridge_url} onChange={(e) => setConfig({ ...config, print_bridge_url: e.target.value })} placeholder="http://127.0.0.1:8989/print" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

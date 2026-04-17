import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Gift,
  Plus,
  Minus,
  Award,
  Loader2,
  Pizza,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  leadId: string | null;
  companyId: string | null;
}

interface LTV {
  total_gasto: number;
  total_compras: number;
  ticket_medio: number;
  ultima_compra: string | null;
}

interface LoyaltyCard {
  id?: string;
  selos_atuais: number;
  total_premios_resgatados: number;
}

interface LoyaltySettings {
  id?: string;
  ativo: boolean;
  selos_para_premio: number;
  nome_premio: string;
}

export function ClienteLTVFidelidadePanel({ leadId, companyId }: Props) {
  const [loading, setLoading] = useState(false);
  const [ltv, setLtv] = useState<LTV | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<LoyaltySettings>({
    ativo: true,
    selos_para_premio: 10,
    nome_premio: "1 Pizza Grátis",
  });

  const load = useCallback(async () => {
    if (!leadId || !companyId) {
      setLtv(null);
      setCard(null);
      return;
    }
    setLoading(true);
    try {
      const [ltvRes, cardRes, settingsRes] = await Promise.all([
        supabase
          .from("customer_ltv_cache")
          .select("total_gasto, total_compras, ticket_medio, ultima_compra")
          .eq("lead_id", leadId)
          .maybeSingle(),
        (supabase.from("loyalty_cards" as any) as any)
          .select("*")
          .eq("lead_id", leadId)
          .eq("company_id", companyId)
          .maybeSingle(),
        (supabase.from("loyalty_settings" as any) as any)
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

      setLtv(
        ltvRes.data || {
          total_gasto: 0,
          total_compras: 0,
          ticket_medio: 0,
          ultima_compra: null,
        }
      );

      setCard(
        cardRes.data || {
          selos_atuais: 0,
          total_premios_resgatados: 0,
        }
      );

      if (settingsRes.data) {
        setSettings(settingsRes.data as LoyaltySettings);
        setEditingSettings(settingsRes.data as LoyaltySettings);
      } else {
        const defaultSettings: LoyaltySettings = {
          ativo: true,
          selos_para_premio: 10,
          nome_premio: "1 Pizza Grátis",
        };
        setSettings(defaultSettings);
        setEditingSettings(defaultSettings);
      }
    } catch (err) {
      console.error("Erro carregando LTV/fidelidade:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStamps = async (delta: number) => {
    if (!leadId || !companyId || !card) return;
    const newStamps = Math.max(0, card.selos_atuais + delta);
    try {
      const { error } = await (supabase.from("loyalty_cards" as any) as any).upsert(
        {
          company_id: companyId,
          lead_id: leadId,
          selos_atuais: newStamps,
          total_premios_resgatados: card.total_premios_resgatados,
          ultimo_selo_em: delta > 0 ? new Date().toISOString() : undefined,
        },
        { onConflict: "company_id,lead_id" }
      );
      if (error) throw error;
      setCard({ ...card, selos_atuais: newStamps });
      toast.success(delta > 0 ? "Selo adicionado!" : "Selo removido");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar selos");
    }
  };

  const redeemReward = async () => {
    if (!leadId || !companyId || !card || !settings) return;
    if (card.selos_atuais < settings.selos_para_premio) {
      toast.error("Selos insuficientes para resgate");
      return;
    }
    try {
      const newStamps = card.selos_atuais - settings.selos_para_premio;
      const newRedeemed = card.total_premios_resgatados + 1;
      const { error } = await (supabase.from("loyalty_cards" as any) as any).upsert(
        {
          company_id: companyId,
          lead_id: leadId,
          selos_atuais: newStamps,
          total_premios_resgatados: newRedeemed,
          ultimo_resgate_em: new Date().toISOString(),
        },
        { onConflict: "company_id,lead_id" }
      );
      if (error) throw error;
      setCard({
        ...card,
        selos_atuais: newStamps,
        total_premios_resgatados: newRedeemed,
      });
      toast.success(`🎉 Prêmio resgatado: ${settings.nome_premio}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao resgatar prêmio");
    }
  };

  const saveSettings = async () => {
    if (!companyId) return;
    try {
      const { error } = await (supabase.from("loyalty_settings" as any) as any).upsert(
        {
          company_id: companyId,
          ativo: editingSettings.ativo,
          selos_para_premio: editingSettings.selos_para_premio,
          nome_premio: editingSettings.nome_premio,
        },
        { onConflict: "company_id" }
      );
      if (error) throw error;
      setSettings(editingSettings);
      setConfigOpen(false);
      toast.success("Configuração salva");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configuração");
    }
  };

  if (!leadId) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
        Vincule este contato a um lead para ver LTV e fidelidade
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stamps = card?.selos_atuais || 0;
  const target = settings?.selos_para_premio || 10;
  const canRedeem = stamps >= target;
  const progressPct = Math.min(100, (stamps / target) * 100);

  return (
    <div className="space-y-4">
      {/* LTV Card */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            LTV do Cliente
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Total Gasto
            </div>
            <div className="font-semibold text-foreground text-sm mt-0.5">
              R$ {Number(ltv?.total_gasto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Compras
            </div>
            <div className="font-semibold text-foreground text-sm mt-0.5">
              {ltv?.total_compras || 0}
            </div>
          </div>
          <div className="bg-muted/50 rounded p-2 col-span-2">
            <div className="text-muted-foreground">Ticket Médio</div>
            <div className="font-semibold text-foreground text-sm mt-0.5">
              R$ {Number(ltv?.ticket_medio || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        {ltv?.ultima_compra && (
          <p className="text-[10px] text-muted-foreground">
            Última compra: {new Date(ltv.ultima_compra).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {/* Loyalty Card */}
      <div className="rounded-lg border border-border bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-orange-600" />
            Cartão Fidelidade
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setConfigOpen(true)}
            title="Configurar programa"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Prêmio: <span className="font-medium text-foreground">{settings?.nome_premio}</span> a cada {target} pizzas
        </div>

        {/* Selos visuais */}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-full flex items-center justify-center border-2 transition-all ${
                i < stamps
                  ? "bg-orange-500 border-orange-600 text-white shadow-sm"
                  : "bg-background border-dashed border-muted-foreground/30 text-muted-foreground/40"
              }`}
            >
              <Pizza className="h-3 w-3" />
            </div>
          ))}
        </div>

        {/* Progresso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{stamps} / {target} selos</span>
            <span className="font-medium text-orange-600">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8"
            onClick={() => updateStamps(-1)}
            disabled={stamps === 0}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="flex-[2] h-8 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => updateStamps(1)}
          >
            <Plus className="h-3 w-3 mr-1" /> Selo
          </Button>
        </div>

        {canRedeem && (
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white"
            onClick={redeemReward}
          >
            <Gift className="h-3 w-3 mr-1" /> Resgatar Prêmio
          </Button>
        )}

        {(card?.total_premios_resgatados || 0) > 0 && (
          <div className="text-xs text-center text-muted-foreground border-t border-border/50 pt-2">
            <Badge variant="secondary" className="text-xs">
              🏆 {card?.total_premios_resgatados} prêmio(s) resgatado(s)
            </Badge>
          </div>
        )}
      </div>

      {/* Modal de configuração */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Programa Fidelidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="selos">Selos para ganhar prêmio</Label>
              <Input
                id="selos"
                type="number"
                min={1}
                max={50}
                value={editingSettings.selos_para_premio}
                onChange={(e) =>
                  setEditingSettings({
                    ...editingSettings,
                    selos_para_premio: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="premio">Nome do prêmio</Label>
              <Input
                id="premio"
                value={editingSettings.nome_premio}
                onChange={(e) =>
                  setEditingSettings({ ...editingSettings, nome_premio: e.target.value })
                }
                placeholder="Ex: 1 Pizza Grátis"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A cada {editingSettings.selos_para_premio} pedidos, o cliente ganha: <strong>{editingSettings.nome_premio}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveSettings}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Instagram, Loader2, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MetaIntegrationsConfigProps {
  companyId: string;
}

interface TenantIntegration {
  id: string;
  company_id: string;
  meta_access_token: string | null;
  instagram_ig_id: string | null;
  instagram_username: string | null;
  instagram_status: string;
}

const META_APP_ID = import.meta.env.VITE_META_APP_ID || "1353481286527361";
const META_REDIRECT_URI = "https://wazecrm.lovable.app/oauth/callback";
const MASTER_VERIFY_TOKEN = "wazecrm_master_2024";
const INSTAGRAM_OAUTH_URL = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;

export function MetaIntegrationsConfig({ companyId }: MetaIntegrationsConfigProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<TenantIntegration | null>(null);
  const [instagramToken, setInstagramToken] = useState("");
  const [instagramIgId, setInstagramIgId] = useState("");

  const webhookBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, company_id, meta_access_token, instagram_ig_id, instagram_username, instagram_status")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setIntegration(data);
        setInstagramIgId(data.instagram_ig_id || "");
      } else {
        setIntegration(null);
        setInstagramIgId("");
      }
    } catch (error: any) {
      console.error("Erro ao carregar Instagram:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar Instagram",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegration();
  }, [companyId]);

  const getStatusBadge = (status: string) => {
    const isConnected = status === "connected";
    return (
      <Badge variant={isConnected ? "default" : "secondary"}>
        {isConnected ? "Conectado" : "Desconectado"}
      </Badge>
    );
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado para a area de transferencia" });
  };

  const handleOAuthLogin = () => {
    localStorage.setItem("instagram_oauth_company_id", companyId);
    window.open(INSTAGRAM_OAUTH_URL, "_blank");
  };

  const saveInstagramConfig = async () => {
    try {
      setSaving(true);

      const updateData = {
        instagram_ig_id: instagramIgId || null,
        instagram_status: instagramIgId ? "connected" : "disconnected",
        meta_access_token: instagramToken || integration?.meta_access_token || null,
        updated_at: new Date().toISOString(),
      };

      if (integration) {
        const { error } = await supabase
          .from("tenant_integrations")
          .update(updateData)
          .eq("id", integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_integrations")
          .insert({ company_id: companyId, ...updateData });
        if (error) throw error;
      }

      const { data: existingConn } = await supabase
        .from("whatsapp_connections")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      const connectionData = {
        instagram_account_id: instagramIgId || null,
        instagram_access_token: instagramToken || null,
      };

      if (existingConn) {
        await supabase
          .from("whatsapp_connections")
          .update(connectionData)
          .eq("id", existingConn.id);
      } else {
        await supabase
          .from("whatsapp_connections")
          .insert({
            company_id: companyId,
            instance_name: `META_${companyId.slice(0, 8).toUpperCase()}`,
            api_provider: "meta",
            status: "disconnected",
            ...connectionData,
          });
      }

      toast({ title: "Instagram configurado com sucesso!" });
      setInstagramToken("");
      await loadIntegration();
    } catch (error: any) {
      console.error("Erro ao salvar Instagram:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar Instagram",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const disconnectInstagram = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Instagram?")) return;

    try {
      await supabase
        .from("tenant_integrations")
        .update({
          instagram_status: "disconnected",
          instagram_ig_id: null,
          instagram_username: null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      await supabase
        .from("whatsapp_connections")
        .update({
          instagram_account_id: null,
          instagram_access_token: null,
        })
        .eq("company_id", companyId);

      toast({ title: "Instagram desconectado com sucesso" });
      await loadIntegration();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao desconectar Instagram",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando Instagram...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              Instagram
            </CardTitle>
            <CardDescription>Conecte o Instagram Direct ao CRM.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadIntegration}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Instagram Direct
          </h3>
          {getStatusBadge(integration?.instagram_status || "disconnected")}
        </div>

        <Alert>
          <AlertDescription>
            Receba e responda mensagens do Instagram Direct pelo CRM. Use uma conta comercial do Instagram.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleOAuthLogin}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Instagram className="h-4 w-4 mr-2" />
          {integration?.instagram_status === "connected" ? "Reconectar Instagram" : "Conectar Instagram"}
        </Button>

        {integration?.instagram_status === "connected" && (
          <Button variant="destructive" onClick={disconnectInstagram} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Desconectar Instagram {integration?.instagram_username ? `(@${integration.instagram_username})` : ""}
          </Button>
        )}

        <div className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label>Instagram Business Account ID</Label>
            <Input
              placeholder="ID da conta comercial do Instagram"
              value={instagramIgId}
              onChange={(event) => setInstagramIgId(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              placeholder="Token de acesso do Graph API"
              value={instagramToken}
              onChange={(event) => setInstagramToken(event.target.value)}
            />
          </div>
          <Button onClick={saveInstagramConfig} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar Instagram
          </Button>
        </div>

        {integration?.instagram_username && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Conta conectada:</strong> @{integration.instagram_username}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Webhook URL do Instagram</Label>
          <div className="flex gap-2">
            <Input readOnly value={`${webhookBaseUrl}/webhook-meta?channel=instagram`} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${webhookBaseUrl}/webhook-meta?channel=instagram`)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Token de verificacao</Label>
          <div className="flex gap-2">
            <Input readOnly value={MASTER_VERIFY_TOKEN} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(MASTER_VERIFY_TOKEN)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, Sparkles, Target, Workflow, BarChart3, Send, AlertTriangle, Smartphone, FileText, DollarSign, Globe } from "lucide-react";
import { N8nIntegration } from "@/components/ia/N8nIntegration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { IAAgentCard } from "@/components/ia/IAAgentCard";
import { WhatsAppDashboard } from "@/components/whatsapp/WhatsAppDashboard";
import { WhatsAppTemplatesManager } from "@/components/whatsapp/WhatsAppTemplatesManager";
import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { CampanhasDashboard } from "@/components/campanhas/CampanhasDashboard";
import { CapturePageConfig } from "@/components/ia/CapturePageConfig";
import { useEffect, useState } from "react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function IA() {
  const { canAccess, isAdmin, isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const [agentStates, setAgentStates] = useState({ atendimento: false, agendamento: false });
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [loadingAiPermission, setLoadingAiPermission] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { getAgentConfigs, updateAgentConfig } = useAIAgents();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role, company_id')
        .eq('user_id', user.id)
        .single();
      
      const isUserSuperAdmin = userRoleData?.role === 'super_admin';
      
      if (isUserSuperAdmin) {
        console.log('✅ Super Admin detectado - liberando IA');
        setAiEnabled(true);
        setLoadingAiPermission(false);
        if (userRoleData?.company_id) setCompanyId(userRoleData.company_id);
      } else {
        if (!userRoleData?.company_id) return;
        setCompanyId(userRoleData.company_id);
        
        const { data: company } = await supabase
          .from('companies')
          .select('allow_ai_features')
          .eq('id', userRoleData.company_id)
          .single();
        
        setAiEnabled(company?.allow_ai_features ?? false);
        setLoadingAiPermission(false);
      }
      
      const configs = await getAgentConfigs();
      const state = { atendimento: false, agendamento: false } as any;
      if (configs && Array.isArray(configs)) {
        configs.forEach((c: any) => { state[c.agent_type] = !!c.enabled; });
      }
      setAgentStates(state);
    };
    load();
  }, [getAgentConfigs]);

  // Verificar permissão de acesso à Automação
  if (!permissionsLoading && !canAccess('automacao') && !isAdmin) {
    return <Navigate to="/leads" replace />;
  }


  const handleAgentToggle = async (id: string, active: boolean) => {
    setAgentStates(prev => ({ ...prev, [id]: active }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();
    if (!userRole?.company_id) return;
    await updateAgentConfig(id, { enabled: active });
  };

  const aiAgents = [
    {
      id: "atendimento",
      name: "IA de Atendimento",
      description: "Pré-atendimento, qualificação, vendas, suporte e gestão de leads",
      icon: Bot,
      color: "bg-blue-500",
      active: agentStates.atendimento,
      stats: {
        conversationsHandled: 23,
        avgResponseTime: "8s",
        successRate: "94%",
      }
    },
    {
      id: "agendamento",
      name: "IA de Agendamento",
      description: "Agenda, remarca e cancela compromissos automaticamente",
      icon: Target,
      color: "bg-emerald-500",
      active: agentStates.agendamento ?? true,
      stats: {
        conversationsHandled: 18,
        avgResponseTime: "5s",
        successRate: "98%",
      }
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Fluxos e Automação Inteligente
        </h1>
        <p className="text-muted-foreground text-lg">
          Agentes inteligentes, automações e campanhas
        </p>
      </div>

      {/* Alerta quando IA não está habilitada para esta subconta */}
      {!loadingAiPermission && aiEnabled === false && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Funcionalidade de IA não habilitada</AlertTitle>
          <AlertDescription>
            Os agentes de IA não estão disponíveis para sua conta. Entre em contato com o administrador para contratar e ativar esta funcionalidade.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="agentes" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agentes" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-2">
            <Workflow className="h-4 w-4" />
            Fluxos
          </TabsTrigger>
          <TabsTrigger value="captura" className="gap-2">
            <Globe className="h-4 w-4" />
            Página de Captura
          </TabsTrigger>
          <TabsTrigger value="whatsapp-meta" className="gap-2 text-green-600">
            <Smartphone className="h-4 w-4" />
            WhatsApp Meta
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agentes" className="space-y-6 mt-6">
          {aiEnabled === false ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="font-semibold">Agentes de IA Bloqueados</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Os agentes de IA não estão habilitados para sua conta. Esta funcionalidade precisa ser contratada e ativada pelo administrador.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Agentes de IA Disponíveis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Os agentes de IA estão disponíveis e podem responder automaticamente conversas em tempo real.
                    Ative cada agente individualmente para começar a usar.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {aiAgents.map((agent) => (
                  <IAAgentCard
                    key={agent.id}
                    {...agent}
                    onToggle={handleAgentToggle}
                  />
                ))}
              </div>

              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle>Modo Híbrido: IA + Humano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure quando a IA deve transferir conversas para atendimento humano:
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Transferência Automática</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Quando não souber responder</li>
                        <li>• Cliente solicitar atendente</li>
                        <li>• Negociação acima de R$ 10.000</li>
                        <li>• Reclamação detectada</li>
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Sugestões ao Humano</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• IA sugere respostas</li>
                        <li>• Humano pode aceitar ou editar</li>
                        <li>• Histórico completo disponível</li>
                        <li>• Transição suave</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Integração n8n */}
              <N8nIntegration />
            </>
          )}
        </TabsContent>


        <TabsContent value="fluxos" className="space-y-4 mt-6">
          <FluxoAutomacaoBuilder />
        </TabsContent>

        {/* Página de Captura */}
        {companyId && (
          <TabsContent value="captura" className="space-y-4 mt-6">
            <CapturePageConfig companyId={companyId} />
          </TabsContent>
        )}

        {/* WhatsApp Meta API */}
        {companyId && (
          <TabsContent value="whatsapp-meta" className="space-y-4 mt-6">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Smartphone className="h-5 w-5" />
                  Central de Controle - WhatsApp Meta API
                </CardTitle>
                <CardDescription>
                  Gerencie templates, disparos em massa, métricas e custos da API oficial do WhatsApp
                </CardDescription>
              </CardHeader>
            </Card>

            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="disparo" className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Disparo em Massa
                </TabsTrigger>
                <TabsTrigger value="custos" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Custos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-4">
                <WhatsAppDashboard companyId={companyId} />
              </TabsContent>

              <TabsContent value="templates" className="mt-4">
                <WhatsAppTemplatesManager companyId={companyId} />
              </TabsContent>

              <TabsContent value="disparo" className="mt-4">
                <DisparoEmMassa />
              </TabsContent>

              <TabsContent value="custos" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Tabela de Preços - WhatsApp Business API
                    </CardTitle>
                    <CardDescription>
                      Preços por categoria de mensagem (valores aproximados em BRL)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Categoria</th>
                              <th className="text-left p-3 font-medium">Descrição</th>
                              <th className="text-right p-3 font-medium">Preço (BRL)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t">
                              <td className="p-3">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">UTILITY</span>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">Confirmações de pedidos, atualizações de entrega, alertas</td>
                              <td className="p-3 text-right font-medium">R$ 0,0625</td>
                            </tr>
                            <tr className="border-t">
                              <td className="p-3">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">MARKETING</span>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">Promoções, ofertas, newsletters, campanhas</td>
                              <td className="p-3 text-right font-medium">R$ 0,1250</td>
                            </tr>
                            <tr className="border-t">
                              <td className="p-3">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">AUTHENTICATION</span>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">Códigos OTP, verificação de identidade, 2FA</td>
                              <td className="p-3 text-right font-medium">R$ 0,0525</td>
                            </tr>
                            <tr className="border-t bg-green-50">
                              <td className="p-3">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">SERVICE</span>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">Respostas na janela de 24h</td>
                              <td className="p-3 text-right font-medium text-green-600">Grátis*</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>* Mensagens SERVICE são gratuitas dentro da janela de 24h.</p>
                        <p>• Preços podem variar por região e volume.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        <TabsContent value="campanhas" className="space-y-4 mt-6">
          <Tabs defaultValue="disparo" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="disparo">
                <Send className="h-4 w-4 mr-2" />
                Disparo em Massa
              </TabsTrigger>
              <TabsTrigger value="relatorio">
                <BarChart3 className="h-4 w-4 mr-2" />
                Relatório
              </TabsTrigger>
            </TabsList>
            <TabsContent value="disparo" className="mt-4">
              <DisparoEmMassa />
            </TabsContent>
            <TabsContent value="relatorio" className="mt-4">
              <CampanhasDashboard />
            </TabsContent>
          </Tabs>
        </TabsContent>


      </Tabs>
    </div>
  );
}

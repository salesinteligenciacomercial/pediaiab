import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Target, MessageSquare, Calendar, CheckCircle, Bot, Activity, BarChart3, Trophy, XCircle, Download, Share2, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";

interface Stats {
  totalLeads: number;
  totalValue: number;
  conversionRate: number;
  activeDeals: number;
  conversas: number;
  compromissos: number;
  tarefas: number;
  mensagensIA: number;
}

interface ReportFilters {
  period: string;
  startDate?: string;
  endDate?: string;
  responsible?: string;
  channel?: string;
}

interface LeadReportStats {
  totalGanhos: number;
  totalPerdidos: number;
  valorTotalGanhos: number;
  taxaConversao: number;
}

export default function Dashboard() {
  const { canAccess, isAdmin, loading: permissionsLoading } = usePermissions();
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    totalValue: 0,
    conversionRate: 0,
    activeDeals: 0,
    conversas: 0,
    compromissos: 0,
    tarefas: 0,
    mensagensIA: 0,
  });
  const [loading, setLoading] = useState(true);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [funis, setFunis] = useState<any[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string | null>(null);

  // Novos estados para relatórios
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    period: 'all'
  });
  const [reportStats, setReportStats] = useState<LeadReportStats>({
    totalGanhos: 0,
    totalPerdidos: 0,
    valorTotalGanhos: 0,
    taxaConversao: 0
  });
  const [reportLoading, setReportLoading] = useState(false);

  // Verificar permissão de acesso ao Dashboard
  // Se não tiver permissão e não for admin, redirecionar
  if (!permissionsLoading && !canAccess('dashboard') && !isAdmin) {
    return <Navigate to="/leads" replace />;
  }

  useEffect(() => {
    fetchStats();
    fetchReportStats();
  }, []);

  useEffect(() => {
    fetchReportStats();
  }, [reportFilters]);

  useEffect(() => {
    if (selectedFunil) {
      fetchEtapasDoFunil(selectedFunil);
    } else {
      setEtapas([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFunil]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Leads - usar count: 'exact' para contagem precisa além do limite de 1000
      const [{ count: totalLeadsCount }, { data: leads }] = await Promise.all([
        supabase.from("leads").select("*", { count: 'exact', head: true }),
        supabase.from("leads").select("value, status, etapa_id")
      ]);
      
      const totalLeads = totalLeadsCount || 0;
      const totalValue = leads?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      const activeDeals = leads?.filter((l) => l.status !== "perdido" && l.status !== "ganho").length || 0;
      const wonDeals = leads?.filter((l) => l.status === "ganho").length || 0;
      const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;

      // Conversas
      const { count: conversasCount } = await supabase.from("conversas").select("*", { count: 'exact', head: true });

      // Compromissos
      const { count: compromissosCount } = await supabase.from("compromissos").select("*", { count: 'exact', head: true });

      // Tarefas
      const { count: tarefasCount } = await supabase.from("tasks").select("*", { count: 'exact', head: true });

      // Mensagens IA
      const { count: iaCount } = await supabase.from("ia_training_data").select("*", { count: 'exact', head: true });

      // Carregar funis de vendas (ordenar por nome para evitar dependência de coluna inexistente)
      // Carregar funis sem dependência de coluna específica de ordenação
      let funisData: any[] | null = null;
      let funisError: any = null;
      try {
        const res = await supabase.from("funis").select("id, nome");
        funisData = res.data as any[] | null;
        funisError = res.error;
      } catch (e) {
        funisError = e;
      }

      if (funisError) {
        console.error("Erro ao carregar lista de funis:", funisError);
      }
      
      setFunis(funisData || []);

      // Selecionar automaticamente o primeiro funil quando houver dados
      if (!funisData || funisData.length === 0) {
        setEtapas([]);
        setSelectedFunil(null);
      } else if (!selectedFunil || !funisData.some((f: any) => f.id === selectedFunil)) {
        // Se não há funil selecionado OU o funil selecionado não existe mais, seleciona o primeiro
        setSelectedFunil(funisData[0].id);
      }

      setStats({
        totalLeads,
        totalValue,
        conversionRate: Math.round(conversionRate),
        activeDeals,
        conversas: conversasCount || 0,
        compromissos: compromissosCount || 0,
        tarefas: tarefasCount || 0,
        mensagensIA: iaCount || 0,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEtapasDoFunil = async (funilId: string) => {
    try {
      // Carregar leads para cálculos
      const { data: leads } = await supabase.from("leads").select("value, status, etapa_id, funil_id");

      // Carregar etapas do funil selecionado
      const { data: etapasData } = await supabase
        .from("etapas")
        .select("id, nome, cor, funil_id")
        .eq("funil_id", funilId)
        .order("posicao");
      
      // Filtrar leads do funil selecionado
      const leadsDoFunil = leads?.filter(l => l.funil_id === funilId) || [];

      const etapasComContagem = await Promise.all((etapasData || []).map(async (etapa) => {
        const leadsNaEtapa = leadsDoFunil.filter(l => l.etapa_id === etapa.id) || [];
        return {
          ...etapa,
          quantidade: leadsNaEtapa.length,
          valor: leadsNaEtapa.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
        };
      }));

      setEtapas(etapasComContagem);
    } catch (error) {
      console.error("Erro ao carregar etapas do funil:", error);
    }
  };

  const fetchReportStats = async () => {
    try {
      setReportLoading(true);

      // Base query com filtros
      let queryGanhos = supabase.from("leads").select("value, created_at").eq("status", "ganho");
      let queryPerdidos = supabase.from("leads").select("id, created_at").eq("status", "perdido");

      // Aplicar filtros de período
      if (reportFilters.period !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (reportFilters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0);
        }

        queryGanhos = queryGanhos.gte('created_at', startDate.toISOString());
        queryPerdidos = queryPerdidos.gte('created_at', startDate.toISOString());
      }

      const { data: leadsGanhos, error: errorGanhos } = await queryGanhos;
      const { data: leadsPerdidos, error: errorPerdidos } = await queryPerdidos;

      if (errorGanhos || errorPerdidos) {
        throw new Error("Erro ao carregar estatísticas de relatório");
      }

      const valorTotal = leadsGanhos?.reduce((acc, lead) => acc + (lead.value || 0), 0) || 0;
      const totalGanhos = leadsGanhos?.length || 0;
      const totalPerdidos = leadsPerdidos?.length || 0;
      const taxaConversao = totalGanhos + totalPerdidos > 0
        ? (totalGanhos / (totalGanhos + totalPerdidos)) * 100
        : 0;

      setReportStats({
        totalGanhos,
        totalPerdidos,
        valorTotalGanhos: valorTotal,
        taxaConversao: Math.round(taxaConversao * 10) / 10
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas de relatório:", error);
    } finally {
      setReportLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats.totalLeads,
      icon: Users,
      description: "Leads ativos no sistema",
      color: "text-primary",
    },
    {
      title: "Vendas Previstas",
      value: `R$ ${stats.totalValue.toLocaleString("pt-BR")}`,
      icon: DollarSign,
      description: "Valor total em negociação",
      color: "text-success",
    },
    {
      title: "Taxa de Conversão",
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      description: "Conversão média",
      color: "text-accent",
    },
    {
      title: "Pedidos Ativos",
      value: stats.activeDeals,
      icon: Target,
      description: "Em andamento",
      color: "text-warning",
    },
  ];

  const operacionalCards = [
    {
      title: "Conversas Ativas",
      value: stats.conversas,
      icon: MessageSquare,
      description: "WhatsApp, Instagram, Facebook",
      color: "text-blue-500",
    },
    {
      title: "Agendamentos",
      value: stats.compromissos,
      icon: Calendar,
      description: "Compromissos marcados",
      color: "text-purple-500",
    },
    {
      title: "Tarefas",
      value: stats.tarefas,
      icon: CheckCircle,
      description: "Em todos os quadros",
      color: "text-green-500",
    },
    {
      title: "Atendimentos IA",
      value: stats.mensagensIA,
      icon: Bot,
      description: "Mensagens processadas",
      color: "text-cyan-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Analytics & Performance
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Visão completa e análises detalhadas do seu negócio</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1 md:gap-2 text-xs md:text-sm flex-shrink-0">
            <Activity className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Dash</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1 md:gap-2 text-xs md:text-sm flex-shrink-0">
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Relatórios</span>
            <span className="sm:hidden">Rel.</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1 md:gap-2 text-xs md:text-sm flex-shrink-0">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1 md:gap-2 text-xs md:text-sm flex-shrink-0">
            <Download className="h-3 w-3 md:h-4 md:w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 md:space-y-6">
          <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => (
              <Card 
                key={stat.title} 
                className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                  <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative p-3 md:p-6 pt-0">
                  <div className="text-xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pipeline por Etapa */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CardTitle>Pipeline por Etapa</CardTitle>
                  {funis.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {funis.length} {funis.length === 1 ? 'funil' : 'funis'}
                    </Badge>
                  )}
                </div>
                <Select
                  value={selectedFunil || ""}
                  onValueChange={(value) => setSelectedFunil(value)}
                >
                  <SelectTrigger className="min-w-[200px] sm:w-[280px]">
                    <SelectValue placeholder={funis.length === 0 ? "Nenhum funil encontrado" : "Selecione o funil de vendas"} />
                  </SelectTrigger>
                  <SelectContent>
                    {funis.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum funil disponível
                      </div>
                    ) : (
                      funis.map((funil) => (
                        <SelectItem key={funil.id} value={funil.id}>
                          {funil.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Distribuição visual dos leads no funil de vendas
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedFunil ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">
                    {funis.length === 0 
                      ? "Nenhum funil de vendas encontrado. Crie um funil para visualizar os dados."
                      : "Selecione um funil de vendas para visualizar as etapas"}
                  </p>
                </div>
              ) : etapas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma etapa encontrada para este funil</p>
                </div>
              ) : (
                <>
                  {etapas
                    .filter((e: any) => !selectedFunil || e.funil_id === selectedFunil)
                    .map((etapa) => {        
                    const totalLeadsDoFunil = etapas
                      .filter((e: any) => e.funil_id === etapa.funil_id)
                      .reduce((sum: number, e: any) => sum + e.quantidade, 0);
                    return (
                      <div key={etapa.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: etapa.cor }}
                            />
                            <span className="font-medium">{etapa.nome}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {etapa.quantidade} leads • R$ {etapa.valor.toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <Progress 
                          value={totalLeadsDoFunil > 0 ? (etapa.quantidade / totalLeadsDoFunil) * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 rounded-full blur-3xl" />
            <CardHeader className="relative">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                CEUSIA CRM - Sistema Multiempresa
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Plataforma completa de gestão comercial com IA integrada
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Gestão de Leads e Funil</p>
                    <p className="text-sm text-muted-foreground">Kanban visual com drag & drop</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-success/10">
                    <MessageSquare className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Conversas Unificadas</p>
                    <p className="text-sm text-muted-foreground">WhatsApp, Instagram, Facebook</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-purple-500/10">
                    <Calendar className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Agenda e Compromissos</p>
                    <p className="text-sm text-muted-foreground">Lembretes automáticos via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-cyan-500/10">
                    <Bot className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">IAs Autônomas</p>
                    <p className="text-sm text-muted-foreground">Atendimento, Vendas e Suporte</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          {/* Filtros de Relatório */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros de Relatório
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecione o período para análise detalhada
                  </p>
                </div>
                <Button
                  onClick={() => fetchReportStats()}
                  disabled={reportLoading}
                  variant="outline"
                  size="sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select
                    value={reportFilters.period}
                    onValueChange={(value) => setReportFilters(prev => ({ ...prev, period: value }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo o período</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="quarter">Último trimestre</SelectItem>
                      <SelectItem value="year">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Relatórios */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Leads Ganhos
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                {reportLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-green-600">{reportStats.totalGanhos}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      R$ {reportStats.valorTotalGanhos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Leads Perdidos
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                {reportLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-red-600">{reportStats.totalPerdidos}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Taxa conversão: {reportStats.taxaConversao}%
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Performance Geral
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                {reportLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-blue-600">
                      {reportStats.totalGanhos + reportStats.totalPerdidos}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total de leads processados
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Ticket Médio
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                {reportLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-purple-600">
                      R$ {reportStats.totalGanhos > 0
                        ? (reportStats.valorTotalGanhos / reportStats.totalGanhos).toLocaleString('pt-BR', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })
                        : '0'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Por lead convertido
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Relatórios Avançados */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Análise de Conversão por Canal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">WhatsApp</span>
                    <Badge variant="secondary">Em breve</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Instagram</span>
                    <Badge variant="secondary">Em breve</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Facebook</span>
                    <Badge variant="secondary">Em breve</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Performance por Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Relatórios detalhados em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Insights Avançados
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Análises preditivas e recomendações inteligentes
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <h3 className="font-semibold mb-2">Insights Avançados</h3>
                <p className="text-sm">Análises preditivas e recomendações estarão disponíveis em breve</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Export & Compartilhar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Exporte relatórios e compartilhe insights
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Download className="h-6 w-6" />
                  <span>Exportar PDF</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Share2 className="h-6 w-6" />
                  <span>Compartilhar</span>
                </Button>
              </div>
              <div className="text-center py-8 text-muted-foreground">
                <Download className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Funcionalidades de export em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {operacionalCards.map((stat, index) => (
              <Card 
                key={stat.title} 
                className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ia" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  IA de Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Acurácia</span>
                    <span className="font-semibold">94%</span>
                  </div>
                  <Progress value={94} />
                  <div className="text-xs text-muted-foreground mt-2">
                    23 conversas atendidas hoje
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-500" />
                  IA Vendedora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversões</span>
                    <span className="font-semibold">89%</span>
                  </div>
                  <Progress value={89} />
                  <div className="text-xs text-muted-foreground mt-2">
                    15 negociações em andamento
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-cyan-500" />
                  IA de Suporte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Satisfação</span>
                    <span className="font-semibold">96%</span>
                  </div>
                  <Progress value={96} />
                  <div className="text-xs text-muted-foreground mt-2">
                    9 atendimentos resolvidos
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


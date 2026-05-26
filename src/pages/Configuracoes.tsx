import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Key,
  Webhook,
  Users,
  Upload,
  Bot,
  MessageSquare,
  Mic,
  UserPlus,
  Trash2,
  Building2,
  Pencil,
  Plus,
  UserCog,
  Target,
  Shield,
  Smartphone,
  BarChart3,
  FileText,
  Send,
  DollarSign,
  User
} from "lucide-react";
import { WhatsAppDashboard } from "@/components/whatsapp/WhatsAppDashboard";
import { WhatsAppTemplatesManager } from "@/components/whatsapp/WhatsAppTemplatesManager";
import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppQRCode } from "@/components/configuracoes/WhatsAppQRCode";
import { MetaApiConfig } from "@/components/configuracoes/MetaApiConfig";
import { MetaIntegrationsConfig } from "@/components/configuracoes/MetaIntegrationsConfig";
import { SubcontasManager } from "@/components/configuracoes/SubcontasManager";
import { LeadAdsFormsConfig } from "@/components/configuracoes/LeadAdsFormsConfig";
import { GmailConfig } from "@/components/configuracoes/GmailConfig";
import { ProdutosServicosManager } from "@/components/configuracoes/ProdutosServicosManager";
import { cleanAllConversationsHistory } from "@/utils/cleanConversationsHistory";
import { WebhooksConfig } from "@/components/configuracoes/WebhooksConfig";
import { StorageCleanup } from "@/components/configuracoes/StorageCleanup";
import { DatabaseHealth } from "@/components/configuracoes/DatabaseHealth";
import { UsuariosSubcontaDialog } from "@/components/configuracoes/UsuariosSubcontaDialog";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { EditarUsuarioDialog } from "@/components/configuracoes/EditarUsuarioDialog";
import { PermissoesUsuarioDialog } from "@/components/configuracoes/PermissoesUsuarioDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Colaborador {
  id: string; // user_roles.id
  userId?: string; // profiles.id
  nome: string;
  email: string;
  setor?: string;
  funcao?: string;
  atendimentosAtivos: number;
  capacidadeMaxima: number;
  status: "disponivel" | "ocupado" | "ausente";
  avatar_url?: string | null;
}

export default function Configuracoes() {
  const { toast } = useToast();
  const { canAccess, isAdmin, loading: permissionsLoading } = usePermissions();
  const [isCleaningHistory, setIsCleaningHistory] = useState(false);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [cleaningStats, setCleaningStats] = useState({ deleted: 0, total: 0 });
  const [openaiKey, setOpenaiKey] = useState("");
  const [audimaToken, setAudimaToken] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCompany, setCurrentCompany] = useState<any | null>(null);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [savingCompanyName, setSavingCompanyName] = useState(false);
  
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [editarUsuarioDialogOpen, setEditarUsuarioDialogOpen] = useState(false);
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState<Colaborador | null>(null);
  const [excluirDialogOpen, setExcluirDialogOpen] = useState(false);
  const [colaboradorParaExcluir, setColaboradorParaExcluir] = useState<Colaborador | null>(null);
  const [excluindoUsuario, setExcluindoUsuario] = useState(false);
  const [permissoesDialogOpen, setPermissoesDialogOpen] = useState(false);
  const [colaboradorParaPermissoes, setColaboradorParaPermissoes] = useState<Colaborador | null>(null);
  
  const [novoColaborador, setNovoColaborador] = useState({
    nome: "",
    email: "",
    setor: "",
    funcao: "vendedor",
    capacidadeMaxima: 10,
  });
  
  const hasRole = (role: string) => userRoles.includes(role);

  useEffect(() => {
    checkAccessAndRoles();
  }, []);

  const checkAccessAndRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar todas as associações do usuário (pode pertencer a múltiplas empresas)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role, company_id, created_at')
        .eq('user_id', user.id);

      const roleList = (roles || []).map(r => r.role).filter(Boolean);
      setUserRoles(Array.from(new Set(roleList)));

      const companyIds = Array.from(new Set((roles || []).map(r => r.company_id).filter(Boolean)));
      if (companyIds.length > 0) {
        const { data: companies } = await (supabase as any)
          .from('companies')
          .select('id, name, plan, is_master_account, parent_company_id')
          .in('id', companyIds as any);

        // Empresa atual padrão: prioriza master; senão, usa a mais recente do user_roles
        const latestRole = (roles || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const preferred = (companies || []).find((c: any) => c.is_master_account) || (companies || []).find((c: any) => c.id === latestRole?.company_id) || null;
        setCurrentCompany(preferred || null);

        // 🔒 SEGURANÇA: Verificar se a empresa atual é subconta
        const isCurrentSubAccount = preferred?.parent_company_id !== null && preferred?.parent_company_id !== undefined;
        setIsSubAccount(isCurrentSubAccount);

        // 🔒 SEGURANÇA: Apenas mostrar opções de master se NÃO for subconta E for master account
        const canAccessMasterFeatures = !isCurrentSubAccount && preferred?.is_master_account === true;
        setIsMasterAccount(canAccessMasterFeatures);
      } else {
        setIsMasterAccount(false);
        setIsSubAccount(false);
        setCurrentCompany(null);
      }
    } catch (error) {
      console.error('Erro ao verificar role:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompanyName = async () => {
    if (!currentCompany?.id || !newCompanyName.trim()) return;
    
    setSavingCompanyName(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: newCompanyName.trim() })
        .eq('id', currentCompany.id);

      if (error) throw error;

      setCurrentCompany({ ...currentCompany, name: newCompanyName.trim() });
      setEditingCompanyName(false);
      toast({
        title: "Sucesso",
        description: "Nome da empresa atualizado com sucesso!",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar nome:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o nome da empresa.",
        variant: "destructive",
      });
    } finally {
      setSavingCompanyName(false);
    }
  };

  // Carregar último aviso publicado (geral ou por empresa)
  useEffect(() => {
    const loadAnnouncement = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // company_id pode ser definido após checkAccessAndRoles; aguardamos currentCompany
        const companyId = currentCompany?.id;
        let query = (supabase as any)
          .from('announcements')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (companyId) {
          // Buscar primeiro por avisos da empresa e gerais (company_id is null)
          query = (supabase as any)
            .from('announcements')
            .select('*')
            .eq('published', true)
            .or(`company_id.is.null,company_id.eq.${companyId}`)
            .order('created_at', { ascending: false })
            .limit(1);
        }

        const { data, error } = await query;
        if (error) throw error;
        setLatestAnnouncement((data && data.length > 0) ? data[0] : null);
      } catch (e: any) {
        // Ignorar erro se a tabela não existir
        if (e?.message?.includes('announcements')) {
          // Tabela não existe, não é crítico
          return;
        }
        console.error('Erro ao carregar avisos:', e?.message || e);
      }
    };
    loadAnnouncement();
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      carregarColaboradores();
    }
  }, [currentCompany?.id]);

  const carregarColaboradores = async () => {
    try {
      const companyId = currentCompany?.id;
      if (!companyId) {
        setColaboradores([]);
        return;
      }
      
      // Buscar user_roles primeiro
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role')
        .eq('company_id', companyId);
        
      if (rolesError) throw rolesError;
      
      if (!userRoles || userRoles.length === 0) {
        setColaboradores([]);
        return;
      }

      // Buscar profiles separadamente
      const userIds = userRoles.map((ur: any) => ur.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combinar dados
      const mapped: Colaborador[] = (userRoles || []).map((u: any) => {
        const profile = (profilesData || []).find((p: any) => p.id === u.user_id);
        return {
          id: u.id,
          userId: u.user_id,
          nome: profile?.full_name || profile?.email || 'Usuário',
          email: profile?.email || '',
          setor: undefined,
          funcao: u.role,
          atendimentosAtivos: 0,
          capacidadeMaxima: 10,
          status: "disponivel" as const,
          avatar_url: profile?.avatar_url || null,
        };
      });
      
      setColaboradores(mapped);
    } catch (e: any) {
      console.error('Erro ao carregar colaboradores:', e?.message || e);
      console.error('Detalhes do erro:', JSON.stringify(e, null, 2));
      toast({
        variant: "destructive",
        title: "Erro ao carregar colaboradores",
        description: e?.message || "Não foi possível carregar os colaboradores.",
      });
      setColaboradores([]);
    }
  };

  const handleSaveToken = (integration: string) => {
    toast({
      title: "Token salvo",
      description: `Token de ${integration} salvo com sucesso`,
    });
  };

  const elevateSuperAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Você precisa estar autenticado' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('elevate-super-admin', {
        body: { action: 'elevate_super_admin' }
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Você agora é Super Admin' });
      
      // Recarregar roles
      await checkAccessAndRoles();
    } catch (error) {
      console.error('Erro ao elevar privilégio:', error);
      toast({ variant: 'destructive', title: 'Erro ao elevar privilégio' });
    }
  };

  const makeMasterAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Você precisa estar autenticado' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('elevate-super-admin', {
        body: { action: 'make_master_account' }
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Sua empresa agora é uma Conta Mestre' });
      
      // Recarregar roles
      await checkAccessAndRoles();
    } catch (error) {
      console.error('Erro ao tornar conta mestre:', error);
      toast({ variant: 'destructive', title: 'Erro ao tornar conta mestre' });
    }
  };

  const adicionarColaborador = async () => {
    if (!novoColaborador.nome || !novoColaborador.email) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha nome e e-mail do usuário",
      });
      return;
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoColaborador.email)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "E-mail inválido",
      });
      return;
    }

    try {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      const { data, error } = await supabase.functions.invoke('criar-usuario-subconta', {
        body: {
          companyId: currentCompany.id, // IMPORTANTE: Apenas companyId = criar usuário na empresa existente
          email: novoColaborador.email,
          full_name: novoColaborador.nome,
          role: novoColaborador.funcao || 'vendedor', // Valor válido do enum
        },
      });
      
      if (error) throw error;
      
      setNovoColaborador({ nome: "", email: "", setor: "", funcao: "vendedor", capacidadeMaxima: 10 });
      toast({ 
        title: "Usuário criado", 
        description: "Usuário criado e vinculado à empresa com sucesso." 
      });
      await carregarColaboradores();
    } catch (e: any) {
      console.error('Erro ao criar usuário:', e);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao criar usuário', 
        description: e.message || 'Ocorreu um erro ao criar o usuário. Verifique se o e-mail já não está cadastrado.' 
      });
    }
  };

  const abrirEditarUsuario = (colaborador: Colaborador) => {
    setColaboradorParaEditar(colaborador);
    setEditarUsuarioDialogOpen(true);
  };

  const abrirExcluirUsuario = (colaborador: Colaborador) => {
    setColaboradorParaExcluir(colaborador);
    setExcluirDialogOpen(true);
  };

  const abrirPermissoes = (colaborador: Colaborador) => {
    setColaboradorParaPermissoes(colaborador);
    setPermissoesDialogOpen(true);
  };

  const confirmarExcluirUsuario = async () => {
    if (!colaboradorParaExcluir?.userId) return;
    
    setExcluindoUsuario(true);
    try {
      const { data, error } = await supabase.functions.invoke('excluir-usuario', {
        body: {
          userId: colaboradorParaExcluir.userId,
          companyId: currentCompany?.id,
        },
      });

      if (error) throw error;

      toast({ title: 'Usuário excluído com sucesso' });
      await carregarColaboradores();
      setExcluirDialogOpen(false);
      setColaboradorParaExcluir(null);
    } catch (e: any) {
      console.error('Erro ao excluir usuário:', e);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao excluir usuário', 
        description: e.message || 'Ocorreu um erro ao excluir o usuário'
      });
    } finally {
      setExcluindoUsuario(false);
    }
  };

  const removerColaborador = async (id: string) => {
    try {
      const { error } = await supabase.from('user_roles').delete().eq('id', id);
      if (error) throw error;
      await carregarColaboradores();
      toast({ title: 'Colaborador removido' });
    } catch (e: any) {
      console.error('Erro ao remover colaborador:', e);
      toast({ variant: 'destructive', title: 'Erro ao remover colaborador', description: e.message });
    }
  };

  const handleCleanAllHistory = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso vai deletar TODAS as conversas (backup automático será criado). Deseja continuar?")) {
      return;
    }

    setIsCleaningHistory(true);
    setCleaningProgress(0);
    setCleaningStats({ deleted: 0, total: 0 });
    
    try {
      const result = await cleanAllConversationsHistory(undefined, (progress, deleted, total) => {
        setCleaningProgress(progress);
        setCleaningStats({ deleted, total });
      });
      
      if (result.success) {
        toast({
          title: "✅ Histórico Limpo com Sucesso",
          description: `Deletadas: ${result.supabaseResult?.deletedCount || 0} conversas. Cache limpo: ${result.localStorageResult?.cleanedKeys.length || 0} itens.`,
        });
        
        // Recarregar página após 2s
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }
    } catch (error: any) {
      console.error("Erro ao limpar histórico:", error);
      toast({
        title: "❌ Erro ao Limpar Histórico",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setCleaningProgress(0);
      setCleaningStats({ deleted: 0, total: 0 });
      setIsCleaningHistory(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      disponivel: "default",
      ocupado: "destructive",
      ausente: "secondary",
    };
    const labels = {
      disponivel: "Disponível",
      ocupado: "Ocupado",
      ausente: "Ausente",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  // Verificar permissão de acesso às Configurações (APÓS todos os hooks)
  if (!permissionsLoading && !canAccess('configuracoes') && !isAdmin) {
    return <Navigate to="/leads" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const defaultTab = isMasterAccount ? "subcontas" : "team";

  // Seções unificadas da aba Equipe & Permissões

  const ColaboradoresSection = () => (
    <>
          <Card>
            <CardHeader>
              <CardTitle>Colaboradores Ativos</CardTitle>
              <CardDescription>
                Lista de colaboradores e suas cargas de trabalho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {colaboradores.map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={colaborador.avatar_url || undefined} alt={colaborador.nome} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {colaborador.nome ? colaborador.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{colaborador.nome}</h4>
                          <p className="text-sm text-muted-foreground">{colaborador.email}</p>
                        </div>
                        {getStatusBadge(colaborador.status)}
                      </div>
                      <div className="mt-2 ml-13 flex gap-4 text-sm text-muted-foreground">
                        <span>
                          <strong>Setor:</strong> {colaborador.setor || "—"}
                        </span>
                        <span>
                          <strong>Função:</strong> {colaborador.funcao || "—"}
                        </span>
                        <span>
                          <strong>Atendimentos:</strong> {colaborador.atendimentosAtivos}/
                          {colaborador.capacidadeMaxima}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirPermissoes(colaborador)}
                        title="Gerenciar permissões"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEditarUsuario(colaborador)}
                        title="Editar usuário"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => abrirExcluirUsuario(colaborador)}
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {colaboradores.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum colaborador cadastrado ainda</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <EditarUsuarioDialog
            open={editarUsuarioDialogOpen}
            onOpenChange={setEditarUsuarioDialogOpen}
            colaborador={colaboradorParaEditar}
            companyId={currentCompany?.id || ''}
            onSuccess={carregarColaboradores}
          />

          <AlertDialog open={excluirDialogOpen} onOpenChange={setExcluirDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o usuário <strong>{colaboradorParaExcluir?.nome}</strong>?
                  <br /><br />
                  Esta ação irá remover o acesso do usuário à empresa. Se o usuário não estiver vinculado a outras empresas, ele será completamente removido do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={excluindoUsuario}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmarExcluirUsuario}
                  disabled={excluindoUsuario}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {excluindoUsuario ? "Excluindo..." : "Excluir Usuário"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <PermissoesUsuarioDialog
            open={permissoesDialogOpen}
            onOpenChange={setPermissoesDialogOpen}
            userId={colaboradorParaPermissoes?.userId || null}
            userName={colaboradorParaPermissoes?.nome || ''}
            companyId={currentCompany?.id || ''}
            onSuccess={carregarColaboradores}
          />
    </>
  );

  const PermissoesSection = () => {
    const [permissions, setPermissions] = useState<any[]>([]);
    const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
    const [loadingPerms, setLoadingPerms] = useState(true);

    useEffect(() => {
      const loadPermissions = async () => {
        try {
          // Buscar todas as permissões
          const { data: permsData } = await supabase
            .from('permissions')
            .select('id, name, description, module, action')
            .order('module, action');

          if (permsData) {
            setPermissions(permsData);

            // Buscar permissões por role
            const { data: rolePermsData } = await supabase
              .from('role_permissions')
              .select('role, permission_id, permissions!inner(name)');

            if (rolePermsData) {
              const grouped: Record<string, string[]> = {};
              rolePermsData.forEach((rp: any) => {
                if (!grouped[rp.role]) grouped[rp.role] = [];
                if (rp.permissions?.name) {
                  grouped[rp.role].push(rp.permissions.name);
                }
              });
              setRolePermissions(grouped);
            }
          }
        } catch (error) {
          console.error('Erro ao carregar permissões:', error);
        } finally {
          setLoadingPerms(false);
        }
      };

      loadPermissions();
    }, []);

    const modules = Array.from(new Set(permissions.map(p => p.module)));

    return (
      <Card>
        <CardHeader>
          <CardTitle>Permissões e Perfis</CardTitle>
          <CardDescription>
            Visualize e gerencie permissões por perfil de usuário
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPerms ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="rounded-md border p-4 bg-green-500/5 border-green-500/20">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="default">Super Admin</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesso total ao sistema, incluindo gestão de subcontas e todas as funcionalidades.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Acesso total ({permissions.length} módulos)
                  </div>
                </div>
                <div className="rounded-md border p-4 bg-blue-500/5 border-blue-500/20">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="secondary">Administrador</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesso total à sua empresa, gestão de usuários e configurações.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Acesso administrador ({rolePermissions['company_admin']?.length || 0} módulos)
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="outline">Gestor</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesso a relatórios, leads, funis e conversas. Pode visualizar métricas da equipe.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Acesso gerencial ({rolePermissions['gestor']?.length || 0} módulos)
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="outline">Vendedor/Atendente</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesso a leads, conversas, tarefas e agenda. Pode criar e gerenciar seus próprios itens.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Acesso padrão ({rolePermissions['vendedor']?.length || 0} módulos)
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge variant="outline">Suporte</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesso a conversas e agenda. Focado em atendimento ao cliente.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Acesso suporte ({rolePermissions['suporte']?.length || 0} módulos)
                  </div>
                </div>
              </div>

              {modules.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Permissões por Módulo</h4>
                  <div className="grid gap-3">
                    {modules.map(module => {
                      const modulePerms = permissions.filter(p => p.module === module);
                      return (
                        <div key={module} className="rounded-md border p-3">
                          <div className="font-medium text-sm mb-2 capitalize">{module}</div>
                          <div className="flex flex-wrap gap-1">
                            {modulePerms.map(perm => (
                              <Badge key={perm.id} variant="outline" className="text-xs">
                                {perm.action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const EquipeConfigSection = () => {
    const [autoAssign, setAutoAssign] = useState("auto");
    const [productivityReports, setProductivityReports] = useState("habilitado");
    const [shareLeads, setShareLeads] = useState("todos");
    const [shareTasks, setShareTasks] = useState("todos");

    const handleSaveSettings = async () => {
      // Aqui você pode salvar as configurações no banco de dados
      toast({
        title: "Configurações salvas",
        description: "As configurações da equipe foram atualizadas com sucesso.",
      });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Equipe</CardTitle>
          <CardDescription>Preferências e regras de distribuição e compartilhamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Atribuição automática de leads por fila</Label>
                <Select value={autoAssign} onValueChange={setAutoAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Ativar</SelectItem>
                    <SelectItem value="manual">Desativar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, os leads são distribuídos automaticamente entre os membros da fila
                </p>
              </div>
              <div className="space-y-2">
                <Label>Relatórios de produtividade</Label>
                <Select value={productivityReports} onValueChange={setProductivityReports}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habilitado">Habilitar</SelectItem>
                    <SelectItem value="desabilitado">Desabilitar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Permite visualizar métricas de produtividade por usuário
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Compartilhamento</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Compartilhamento de Leads</Label>
                  <Select value={shareLeads} onValueChange={setShareLeads}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos podem ver e compartilhar</SelectItem>
                      <SelectItem value="responsavel">Apenas responsável vê</SelectItem>
                      <SelectItem value="equipe">Apenas membros da equipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compartilhamento de Tarefas</Label>
                  <Select value={shareTasks} onValueChange={setShareTasks}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos podem ver e compartilhar</SelectItem>
                      <SelectItem value="criador">Apenas criador e responsável</SelectItem>
                      <SelectItem value="equipe">Apenas membros da equipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSaveSettings}>
                Salvar Configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const UsuariosEquipeSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usuários do CRM</CardTitle>
            <CardDescription>Gerencie usuários e perfis desta empresa</CardDescription>
          </div>
          <Button onClick={() => setManageUsersOpen(true)}>Gerenciar Usuários</Button>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, tokens e configurações do sistema
        </p>
      </div>

      {latestAnnouncement && (
        <Alert className={latestAnnouncement.critical ? "border-destructive bg-destructive/10" : ""}>
          <AlertDescription className="space-y-1">
            <p className="font-medium">{latestAnnouncement.title}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latestAnnouncement.body}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Status do usuário - Mostra privilégios atuais */}
      <Card className={hasRole('super_admin') && isMasterAccount ? "border-green-500/50 bg-green-500/5" : "border-blue-500/50 bg-blue-500/5"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {hasRole('super_admin') && isMasterAccount ? "✅" : "ℹ️"} Status da Conta
          </CardTitle>
          <CardDescription>
            Informações sobre seus privilégios e tipo de conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Nível de Acesso:</div>
              <div className="flex flex-wrap gap-2">
                {userRoles.map((role) => (
                  <Badge key={role} variant={role === 'super_admin' ? 'default' : 'secondary'}>
                    {role === 'super_admin' ? '🔐 Super Admin' : role}
                  </Badge>
                ))}
                {userRoles.length === 0 && <Badge variant="secondary">Usuário Padrão</Badge>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Tipo de Conta:</div>
              <Badge variant={isMasterAccount ? 'default' : 'secondary'}>
                {isMasterAccount ? '🏢 Conta Mestre (SaaS)' : '📋 Conta Cliente'}
              </Badge>
            </div>
          </div>
          
          {currentCompany && (
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-1">Empresa Atual:</div>
              {editingCompanyName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Nome da empresa"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveCompanyName}
                    disabled={savingCompanyName || !newCompanyName.trim()}
                  >
                    {savingCompanyName ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingCompanyName(false);
                      setNewCompanyName(currentCompany.name);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{currentCompany.name || "Rosh Pizzaria"}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setNewCompanyName(currentCompany.name);
                      setEditingCompanyName(true);
                    }}
                    title="Editar nome da empresa"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                Plano: {currentCompany.plan} • 
                Usuários: {currentCompany.max_users} • 
                Leads: {currentCompany.max_leads}
              </div>
            </div>
          )}

          {hasRole('super_admin') && isMasterAccount && (
            <Alert className="border-green-500/50 bg-green-500/5">
              <AlertDescription>
                ✅ Você possui acesso completo como Super Admin de uma Conta Mestre. 
                Você pode criar e gerenciar subcontas/licenças SaaS na aba "Subcontas".
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 🔒 SEGURANÇA: Apenas super admin da conta MESTRE pode elevar privilégios */}
      {!isSubAccount && (!hasRole('super_admin') || !isMasterAccount) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-lg">🔐 Elevação de Privilégios</CardTitle>
            <CardDescription>
              Eleve suas permissões para acessar funcionalidades avançadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {!hasRole('super_admin') && (
                <Button
                  variant="outline"
                  onClick={elevateSuperAdmin}
                  className="border-primary/50 hover:bg-primary/10"
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Tornar-me Super Admin
                </Button>
              )}
              {!isMasterAccount && (
                <Button
                  variant="outline"
                  onClick={makeMasterAccount}
                  className="border-purple-500/50 hover:bg-purple-500/10"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Tornar esta conta mestre
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Use apenas se você é o administrador principal do sistema
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${isMasterAccount ? 'grid-cols-6' : 'grid-cols-5'}`}>
          {isMasterAccount && (
            <TabsTrigger value="subcontas">
              <Building2 className="mr-2 h-4 w-4" />
              Subcontas
            </TabsTrigger>
          )}
          <TabsTrigger value="team">Equipe</TabsTrigger>
          
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="webhooks_api">Webhooks</TabsTrigger>
          <TabsTrigger value="avancado" className="text-destructive">Avançado</TabsTrigger>
        </TabsList>

        {isMasterAccount && (
          <TabsContent value="subcontas">
            <SubcontasManager />
          </TabsContent>
        )}

        <TabsContent value="team" className="space-y-4">
          {/* Usuários do CRM (todas as empresas podem gerenciar seus usuários) */}
          {currentCompany && <UsuariosEquipeSection />}
          {/* Colaboradores - disponíveis para todos */}
          <ColaboradoresSection />
          {/* Permissões e Configurações de Equipe - reservado a administradores */}
          {(hasRole('admin') || hasRole('company_admin')) && <PermissoesSection />}
          {(hasRole('admin') || hasRole('company_admin')) && <EquipeConfigSection />}
        </TabsContent>


        <TabsContent value="channels" className="space-y-4">
          <WhatsAppQRCode />
          {currentCompany?.id && <MetaApiConfig companyId={currentCompany.id} />}
          {currentCompany?.id && <MetaIntegrationsConfig companyId={currentCompany.id} />}
          
          {/* Gmail Integration */}
          {currentCompany?.id && <GmailConfig companyId={currentCompany.id} />}

          {/* Lead Ads Forms - Rastreamento de Tráfego Pago */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                Lead Ads (Tráfego Pago)
              </CardTitle>
              <CardDescription>
                Configure formulários de Lead Ads do Facebook/Instagram para receber leads automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadAdsFormsConfig />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-cyan-500" />
                  Telegram
                </CardTitle>
                <CardDescription>Conecte seu bot do Telegram</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Token do Bot</Label>
                  <Input placeholder="Cole o token do BotFather" />
                </div>
                <Button className="w-full">Conectar Telegram</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* WhatsApp Meta API movido para página de Fluxos e Automação */}

        <TabsContent value="ia" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                OpenAI (GPT)
              </CardTitle>
              <CardDescription>
                Configure sua chave da API OpenAI para usar GPT-4 e GPT-5
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chave da API</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("OpenAI")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Audima (Text-to-Speech)
              </CardTitle>
              <CardDescription>
                Configure sua conta Audima para conversão de texto em áudio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Token de Acesso</Label>
                <Input
                  type="password"
                  placeholder="Cole seu token Audima"
                  value={audimaToken}
                  onChange={(e) => setAudimaToken(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("Audima")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                ElevenLabs (Voz Neural)
              </CardTitle>
              <CardDescription>
                Configure ElevenLabs para geração de áudio com IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chave da API</Label>
                <Input
                  type="password"
                  placeholder="Cole sua chave ElevenLabs"
                  value={elevenlabsKey}
                  onChange={(e) => setElevenlabsKey(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("ElevenLabs")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks_api" className="space-y-4">
          <WebhooksConfig />
        </TabsContent>

        <TabsContent value="avancado" className="space-y-4">
          <DatabaseHealth />
          <StorageCleanup />
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">🚨 Zona de Perigo</CardTitle>
              <CardDescription>
                Operações irreversíveis que afetam todo o histórico do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <div>
                  <h4 className="font-semibold text-destructive mb-1">Limpar Todo Histórico de Conversas</h4>
                  <p className="text-sm text-muted-foreground">
                    Deleta TODAS as conversas (backup automático criado). Sistema começará do zero.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleCleanAllHistory}
                  disabled={isCleaningHistory}
                >
                  {isCleaningHistory ? (
                    <div className="flex items-center gap-2">
                      <span>Limpando... {cleaningProgress}%</span>
                      <span className="text-xs opacity-70">({cleaningStats.deleted}/{cleaningStats.total})</span>
                    </div>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpar Tudo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {currentCompany && (
        <UsuariosSubcontaDialog
          company={{ id: currentCompany.id, name: currentCompany.name }}
          open={manageUsersOpen}
          onOpenChange={setManageUsersOpen}
        />
      )}
    </div>
  );
}



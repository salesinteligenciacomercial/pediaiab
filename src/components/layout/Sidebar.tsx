import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Bot, Settings, LogOut, DollarSign, Lock, X, Package, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useConversasNotifications } from "@/hooks/useConversasNotifications";
import { useIsMobile } from "@/hooks/use-mobile";

const navigation = [{
  name: "Relatórios",
  href: "/analytics",
  icon: LayoutDashboard,
  menuKey: "analytics"
}, {
  name: "Clientes",
  href: "/leads",
  icon: Users,
  menuKey: "leads"
}, {
  name: "Gestão de Pedidos",
  href: "/kanban",
  icon: LayoutDashboard,
  menuKey: "funil"
}, {
  name: "Produtos",
  href: "/produtos",
  icon: Package,
  menuKey: "produtos"
}, {
  name: "Cardápio Digital",
  href: "/cardapio-digital",
  icon: Store,
  menuKey: "cardapio-digital"
}, {
  name: "Bate-Papo",
  href: "/conversas",
  icon: MessageSquare,
  menuKey: "conversas",
  showConversasBadge: true
}, {
  name: "Caixa/PDV",
  href: "/financeiro",
  icon: DollarSign,
  menuKey: "financeiro",
  masterOnly: true
}, {
  name: "Configurações",
  href: "/configuracoes",
  icon: Settings,
  menuKey: "configuracoes"
}];

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  collapsed = false,
  onNavigate
}: SidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    canAccess,
    loading: permissionsLoading
  } = usePermissions();
  const {
    canAccessModule,
    loading: moduleLoading,
    isMasterAccount
  } = useModuleAccess();
  const { unreadCount: conversasUnread } = useConversasNotifications();

  // Módulos premium que requerem liberação
  const premiumModules = ['automacao'];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message
      });
    } else {
      navigate("/auth");
    }
  };

  const handleNavClick = () => {
    // Fechar sidebar em mobile após navegação
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  // Em mobile, nunca colapsa (sempre mostra texto)
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <div className={`flex h-screen flex-col bg-sidebar border-r border-sidebar-border shadow-xl transition-all duration-300 ease-in-out ${effectiveCollapsed ? "w-20" : "w-64"}`}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-sidebar-border/50">
        {effectiveCollapsed ?
        <img src="/logo-waze.png" alt="Waze Platform" className="h-10 w-10 object-contain mx-auto" /> :

        <>
            <div className="flex items-center gap-3">
              <img src="/logo-waze.png" alt="Waze Platform" className="h-10 w-10 object-contain" />
              <div>
                <span className="text-sidebar-foreground font-bold text-lg block leading-tight">Rosh Pizzaria</span>
                <span className="text-sidebar-foreground/60 text-xs">Sistema inteligente de gestão de pedidos</span>
              </div>
            </div>
            {/* Botão fechar apenas em mobile */}
            {isMobile && onNavigate &&
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigate}
            className="text-sidebar-foreground hover:bg-sidebar-accent">
            
                <X className="h-5 w-5" />
              </Button>
          }
          </>
        }
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.filter((item) => {
            if (permissionsLoading || moduleLoading) return true;
            if (item.menuKey === 'configuracoes') return true; // Always show config

            // Financeiro só aparece para master accounts
            if ((item as any).masterOnly && !isMasterAccount) {
              return false;
            }

            // Verificar se é módulo premium
            const isPremiumModule = premiumModules.includes(item.menuKey);
            if (isPremiumModule && !isMasterAccount) {
              // Verificar se tem acesso ao módulo
              return canAccessModule(item.menuKey);
            }

            return canAccess(item.menuKey || '');
          }).map((item) => {
            const isPremiumModule = premiumModules.includes(item.menuKey);
            const hasModuleAccess = isMasterAccount || canAccessModule(item.menuKey);
            const isLocked = isPremiumModule && !hasModuleAccess && !moduleLoading;

            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={isLocked ? "#" : item.href}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        toast({
                          title: "Módulo Premium",
                          description: `O módulo ${item.name} requer ativação. Entre em contato com o administrador.`,
                          variant: "destructive"
                        });
                      } else {
                        handleNavClick();
                      }
                    }}
                    className={({
                      isActive
                    }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    isLocked ?
                    "text-sidebar-foreground/40 cursor-not-allowed" :
                    isActive ?
                    "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20" :
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"} ${
                    effectiveCollapsed ? "justify-center" : ""}`}>
                    
                    {({
                      isActive
                    }) => <>
                        <div className={`p-1.5 rounded-lg transition-colors relative ${
                      isLocked ?
                      "bg-sidebar-accent/20" :
                      isActive ?
                      "bg-white/20" :
                      "bg-sidebar-accent/30 group-hover:bg-sidebar-accent"}`
                      }>
                          <item.icon className="h-4 w-4" />
                          {isLocked && !effectiveCollapsed &&
                        <Lock className="h-3 w-3 absolute -top-1 -right-1 text-muted-foreground" />
                        }
                          {item.showConversasBadge && conversasUnread > 0 && effectiveCollapsed && !isLocked &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
                              {conversasUnread > 99 ? '99+' : conversasUnread}
                            </Badge>
                        }
                        </div>
                        {!effectiveCollapsed &&
                      <span className="flex-1 flex items-center justify-between">
                            {item.name}
                            {isLocked &&
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        }
                            {item.showConversasBadge && conversasUnread > 0 && !isLocked &&
                        <Badge className="ml-2 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                {conversasUnread > 99 ? '99+' : conversasUnread}
                              </Badge>
                        }
                          </span>
                      }
                      </>
                    }
                  </NavLink>
                </TooltipTrigger>
                {effectiveCollapsed &&
                <TooltipContent side="right" className="font-medium">
                    {item.name} {isLocked ? "(Bloqueado)" : item.showConversasBadge && conversasUnread > 0 ? `(${conversasUnread})` : ""}
                  </TooltipContent>
                }
              </Tooltip>);

          })}
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="border-t border-sidebar-border/50 p-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-all duration-200 group ${effectiveCollapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={handleLogout}>
                
                <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-destructive/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                {!effectiveCollapsed && <span className="font-medium ml-3">Sair do Sistema</span>}
              </Button>
            </TooltipTrigger>
            {effectiveCollapsed &&
            <TooltipContent side="right" className="font-medium">
                Sair do Sistema
              </TooltipContent>
            }
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>);

}
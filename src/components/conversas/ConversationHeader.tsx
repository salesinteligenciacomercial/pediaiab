import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, Video, Info, User, MessageSquare, Instagram, Facebook, FileText, DollarSign, RefreshCw, CheckCircle2, AlertCircle, Loader2, Check, Plus, RotateCcw, ArrowRightLeft, Bot, ArrowLeft, Tag, TrendingUp, UserCog } from "lucide-react";
import { AIModeSelectorDropdown, type AIMode } from "./AIModeSelectorDropdown";
import { ProtocolBadge } from "./ProtocolBadge";
import { ProtocolWelcomeSettings } from "./ProtocolWelcomeSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader as UIDialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

 type SyncStatus = 'synced' | 'syncing' | 'error' | 'idle';
 type OnlineStatus = 'online' | 'offline' | 'unknown';

 interface ConversationHeaderProps {
   contactName: string;
   channel: "whatsapp" | "instagram" | "facebook";
   avatarUrl?: string;
   produto?: string;
   valor?: string;
   responsavel?: string;
   tags?: string[];
   funnelStage?: string;
   showInfoPanel: boolean;
   onToggleInfoPanel: () => void;
   syncStatus?: SyncStatus;
   leadVinculado?: any;
   mostrarBotaoCriarLead?: boolean;
   onCriarLead?: () => void;
  onFinalizeAtendimento?: (message: string) => void;
  onFinalizeAtendimentoSilent?: () => void;
    onTransferAtendimento?: () => void;
    onNovoPedido?: () => void;
    onChangeAIMode?: (mode: AIMode) => void;
    currentAIMode?: AIMode;
    onlineStatus?: OnlineStatus;
   isContactInactive?: boolean;
   onRestoreConversation?: () => void;
   restoringConversation?: boolean;
   restoreProgress?: { step: number; label: string } | null;
    onBack?: () => void;
    showBackButton?: boolean;
     protocolNumber?: string | null;
     protocolStatus?: string;
     contactPhone?: string;
     companyId?: string | null;
 }

  export function ConversationHeader({
   contactName,
   channel,
   avatarUrl,
   produto,
   valor,
   responsavel,
   tags = [],
   funnelStage,
   showInfoPanel,
   onToggleInfoPanel,
   syncStatus = 'idle',
   leadVinculado,
   mostrarBotaoCriarLead = false,
   onCriarLead,
   onFinalizeAtendimento,
   onFinalizeAtendimentoSilent,
    onTransferAtendimento,
    onNovoPedido,
    onChangeAIMode,
    currentAIMode = 'off',
    onlineStatus = 'unknown',
   isContactInactive = false,
   onRestoreConversation,
   restoringConversation = false,
   restoreProgress = null,
    onBack,
    showBackButton = false,
     protocolNumber = null,
     protocolStatus = 'aberto',
     contactPhone,
     companyId,
  }: ConversationHeaderProps) {
   const isMobile = useIsMobile();
   const [finalizeOpen, setFinalizeOpen] = useState(false);
   const [finalizeMessage, setFinalizeMessage] = useState("");
   const [showAvatarPreview, setShowAvatarPreview] = useState(false);

    useEffect(() => {
      const saved = localStorage.getItem("continuum_finalize_template");
      if (saved) {
        setFinalizeMessage(saved);
      } else {
        setFinalizeMessage(`Seu atendimento foi finalizado com sucesso. Se precisar de algo, basta responder esta mensagem.\n\nPoderia nos avaliar no Google? Sua opinião é muito importante.\nLink: `);
      }
    }, []);

   const getChannelIcon = () => {
     switch (channel) {
       case "whatsapp":
         return <MessageSquare className="h-4 w-4 text-[#25D366]" />;
       case "instagram":
         return <Instagram className="h-4 w-4 text-pink-500" />;
       case "facebook":
         return <Facebook className="h-4 w-4 text-blue-600" />;
       default:
         return <MessageSquare className="h-4 w-4" />;
     }
   };

   const getInitials = (name: string) => {
     return name
       .split(" ")
       .map((n) => n[0])
       .join("")
       .toUpperCase()
       .slice(0, 2);
   };

   const getSyncStatusBadge = () => {
     switch (syncStatus) {
       case 'syncing':
         return (
           <Badge variant="outline" className="gap-1.5 bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse">
             <RefreshCw className="h-3 w-3 animate-spin" />
             <span className="text-xs font-medium">Sincronizando...</span>
           </Badge>
         );
       case 'synced':
         return (
           <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20">
             <CheckCircle2 className="h-3 w-3" />
             <span className="text-xs font-medium">Sincronizado</span>
           </Badge>
         );
       case 'error':
         return (
           <Badge variant="outline" className="gap-1.5 bg-red-500/10 text-red-600 border-red-500/20">
             <AlertCircle className="h-3 w-3" />
             <span className="text-xs font-medium">Erro na sincronização</span>
           </Badge>
         );
       default:
         return null;
     }
   };

  // Always show lead info bar when a lead is linked
  const hasLeadInfo = !!leadVinculado;

  return (
    <div className="w-full bg-background border-b border-border shadow-sm" style={{ overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
       {/* Header compacto - tudo em uma linha */}
       <div className="px-2 py-1.5 flex items-center justify-between gap-2" style={{ height: '56px' }}>
         <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Botão Voltar (Mobile) */}
            {showBackButton && onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 md:hidden flex-shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {/* Avatar do Lead */}
            <div className="relative flex-shrink-0">
              <Avatar
                className="h-10 w-10 border-2 border-primary/20 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => avatarUrl && avatarUrl.trim() !== '' && setShowAvatarPreview(true)}
              >
                {avatarUrl && avatarUrl.trim() !== '' ? (
                  <AvatarImage src={avatarUrl} alt={contactName} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                  {getInitials(contactName)}
                </AvatarFallback>
              </Avatar>
              {/* Badge da Rede Social */}
              <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5 border border-background shadow-sm">
                {getChannelIcon()}
              </div>
            </div>
            {/* Nome, telefone e badge */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm md:text-base text-foreground truncate">
                  {contactName}
                </h2>
                {leadVinculado ? (
                  <Badge className="gap-0.5 bg-green-600 hover:bg-green-700 text-[10px] py-0 px-1.5 h-5 flex-shrink-0">
                    <Check className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Lead</span>
                  </Badge>
                ) : (mostrarBotaoCriarLead && onCriarLead && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCriarLead}
                    className="h-5 text-[10px] gap-0.5 px-1.5 py-0"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Criar Lead</span>
                  </Button>
                ))}
                {protocolNumber && (
                  <ProtocolBadge protocolNumber={protocolNumber} status={protocolStatus} />
                )}
                {getSyncStatusBadge()}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {getChannelIcon()}
                <span className="capitalize font-medium">{channel}</span>
              </div>
            </div>
         </div>
            {/* Ações - Versão Desktop (apenas ícones com tooltip) */}
              <TooltipProvider delayDuration={0}>
              <div className="hidden md:flex items-center gap-1">
               {/* Botão Restaurar Histórico do WhatsApp */}
               {onRestoreConversation && (
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button
                       variant="outline"
                       size="icon"
                       onClick={onRestoreConversation}
                       disabled={restoringConversation}
                       className="h-8 w-8"
                     >
                       {restoringConversation ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <RotateCcw className="h-4 w-4" />
                       )}
                     </Button>
                   </TooltipTrigger>
                    <TooltipContent>Puxar Histórico</TooltipContent>
                  </Tooltip>
                )}
                {/* Botão Enviar Protocolo */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ProtocolWelcomeSettings 
                        protocolNumber={protocolNumber}
                        contactPhone={contactPhone}
                        contactName={contactName}
                        companyId={companyId}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Enviar Protocolo</TooltipContent>
                </Tooltip>
               {/* Botão IA - Dropdown */}
               {onChangeAIMode && (
                 <AIModeSelectorDropdown
                   currentMode={currentAIMode}
                   onModeChange={onChangeAIMode}
                   compact
                 />
               )}
               {/* Botão Transferir Atendimento */}
               {onTransferAtendimento && (
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button
                       variant="outline"
                       size="icon"
                       onClick={onTransferAtendimento}
                       className="h-8 w-8"
                     >
                       <ArrowRightLeft className="h-4 w-4" />
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent>Transferir</TooltipContent>
                 </Tooltip>
                )}
                {/* 🛒 Novo pedido via chat (mockup pizzaria) */}
                {onNovoPedido && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onNovoPedido}
                        className="h-8 w-8 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        🛒
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Novo pedido</TooltipContent>
                  </Tooltip>
                )}
               {onFinalizeAtendimento && (
                <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Finalizar</TooltipContent>
                  </Tooltip>
                  <DialogContent className="sm:max-w-lg">
                    <UIDialogHeader>
                      <DialogTitle>Mensagem de finalização</DialogTitle>
                    </UIDialogHeader>
                    <div className="space-y-3">
                      <Textarea
                        rows={6}
                        value={finalizeMessage}
                        onChange={(e) => setFinalizeMessage(e.target.value)}
                      />
                      <div className="flex flex-col gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            localStorage.setItem("continuum_finalize_template", finalizeMessage);
                          }}
                        >
                          Salvar como padrão
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (onFinalizeAtendimentoSilent) {
                                onFinalizeAtendimentoSilent();
                              }
                              setFinalizeOpen(false);
                            }}
                          >
                            Só finalizar
                          </Button>
                          <Button
                            onClick={() => {
                              onFinalizeAtendimento(finalizeMessage);
                              localStorage.setItem("continuum_finalize_template", finalizeMessage);
                              setFinalizeOpen(false);
                            }}
                          >
                            Enviar e finalizar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={onToggleInfoPanel}
                    className={`h-8 w-8 ${showInfoPanel ? "bg-primary/10 text-primary" : "hover:bg-primary/10"}`}
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Informações</TooltipContent>
              </Tooltip>
            </div>
            </TooltipProvider>

            {/* Ações - Versão Mobile (apenas ícones) */}
            <div className="flex md:hidden items-center gap-0.5">
              {/* Botão Puxar Histórico do WhatsApp - Mobile */}
              {onRestoreConversation && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRestoreConversation}
                  disabled={restoringConversation}
                  className="h-8 w-8"
                  title="Puxar histórico do WhatsApp"
                >
                  {restoringConversation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              )}
              {/* Botão IA - Dropdown Mobile */}
              {onChangeAIMode && (
                <AIModeSelectorDropdown
                  currentMode={currentAIMode}
                  onModeChange={onChangeAIMode}
                  compact
                />
              )}
              {/* Botão Transferir Atendimento */}
              {onTransferAtendimento && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onTransferAtendimento}
                  className="h-8 w-8"
                  title="Transferir atendimento"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              )}
              {/* Botão Finalizar */}
              {onFinalizeAtendimento && (
                <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Finalizar atendimento"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-lg mx-auto">
                    <UIDialogHeader>
                      <DialogTitle>Mensagem de finalização</DialogTitle>
                    </UIDialogHeader>
                    <div className="space-y-3">
                      <Textarea
                        rows={6}
                        value={finalizeMessage}
                        onChange={(e) => setFinalizeMessage(e.target.value)}
                      />
                      <div className="flex flex-col gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            localStorage.setItem("continuum_finalize_template", finalizeMessage);
                          }}
                        >
                          Salvar como padrão
                        </Button>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" className="w-full" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
                          <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => {
                              if (onFinalizeAtendimentoSilent) {
                                onFinalizeAtendimentoSilent();
                              }
                              setFinalizeOpen(false);
                            }}
                          >
                            Só finalizar
                          </Button>
                          <Button
                            className="w-full"
                            onClick={() => {
                              onFinalizeAtendimento(finalizeMessage);
                              localStorage.setItem("continuum_finalize_template", finalizeMessage);
                              setFinalizeOpen(false);
                            }}
                          >
                            Enviar e finalizar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {/* Botão Info */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onToggleInfoPanel}
                className={`h-8 w-8 ${showInfoPanel ? "bg-primary/10 text-primary" : ""}`}
                title="Informações"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
       </div>

       {/* ✅ Barra fixa de informações do Lead - sempre visível */}
       {hasLeadInfo && (
         <div className="px-3 py-1.5 bg-muted/30 border-t border-border/50 flex items-center gap-3 flex-wrap overflow-hidden" style={{ maxHeight: '36px' }}>
           {/* Valor */}
           {(valor || (leadVinculado?.value && leadVinculado.value > 0)) && (
             <div className="flex items-center gap-1 flex-shrink-0">
               <DollarSign className="h-3 w-3 text-green-600" />
               <span className="text-xs font-semibold text-green-600">
                 {valor || `R$ ${Number(leadVinculado.value).toLocaleString('pt-BR')}`}
               </span>
             </div>
           )}

           {/* Funil/Etapa */}
           {(funnelStage || leadVinculado?.etapa_nome) && (
             <div className="flex items-center gap-1 flex-shrink-0">
               <TrendingUp className="h-3 w-3 text-blue-500" />
               <span className="text-xs font-medium text-blue-600">
                 {funnelStage || leadVinculado.etapa_nome}
               </span>
             </div>
           )}

           {/* Responsável */}
           {(responsavel || leadVinculado?.responsavel_nome) && (
             <div className="flex items-center gap-1 flex-shrink-0">
               <UserCog className="h-3 w-3 text-muted-foreground" />
               <span className="text-xs text-muted-foreground">
                 {responsavel || leadVinculado.responsavel_nome}
               </span>
             </div>
           )}

           {/* Tags */}
           {tags && tags.length > 0 && (
             <div className="flex items-center gap-1 flex-shrink-0 overflow-hidden">
               <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
               <div className="flex gap-1 overflow-hidden">
                 {tags.slice(0, 3).map((tag, i) => (
                   <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 flex-shrink-0">
                     {tag}
                   </Badge>
                 ))}
                 {tags.length > 3 && (
                   <span className="text-[10px] text-muted-foreground flex-shrink-0">+{tags.length - 3}</span>
                 )}
               </div>
             </div>
           )}
         </div>
       )}

       {/* Barra de progresso - aparece durante o Puxar Histórico */}
       {restoreProgress && (
         <div className="px-3 pb-2 pt-0.5 space-y-1">
           <div className="flex items-center justify-between">
             <span className="text-xs text-muted-foreground">{restoreProgress.label}</span>
             <span className="text-xs font-medium text-primary">{restoreProgress.step}%</span>
           </div>
           <Progress value={restoreProgress.step} className="h-1.5" />
         </div>
       )}
      {/* Avatar Preview Dialog */}
      {avatarUrl && avatarUrl.trim() !== '' && (
        <Dialog open={showAvatarPreview} onOpenChange={setShowAvatarPreview}>
          <DialogContent className="max-w-md w-[90vw] p-0 overflow-hidden bg-background rounded-xl">
            <VisuallyHidden>
              <DialogTitle>Foto de perfil - {contactName}</DialogTitle>
            </VisuallyHidden>
            <div className="p-4 border-b">
              <p className="text-sm font-medium text-foreground">{contactName}</p>
              <p className="text-xs text-muted-foreground capitalize">{channel}</p>
            </div>
            <div className="flex items-center justify-center p-4 bg-muted/30">
              <img
                src={avatarUrl}
                alt={contactName}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
  }



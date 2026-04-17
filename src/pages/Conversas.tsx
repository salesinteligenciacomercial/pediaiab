import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip, Clock, Calendar, Zap, FileText, Tag, TrendingUp, ArrowRightLeft, Image as ImageIcon, Mic, FileUp, Check, CheckCheck, Phone, Video, Info, DollarSign, Users, Bell, Download, Volume2, RefreshCw, CheckCircle2, AlertCircle, Reply, CheckSquare, X, Plus, Trash2, Loader2, UserCog, ArrowLeft, SpellCheck, Trophy, XCircle, Eye, ChevronDown, Mail, Building2, Globe, Pencil, MapPin, Key, Shield, Package, PenLine, BarChart3, Music, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinalizarNegociacaoDialog } from "@/components/leads/FinalizarNegociacaoDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CountdownTimer } from "@/components/conversas/CountdownTimer";
import { ConversationHeader } from "@/components/conversas/ConversationHeader";
import { ConversationListItem } from "@/components/conversas/ConversationListItem";
import { MessageItem } from "@/components/conversas/MessageItem";
import { ForwardMessageDialog } from "@/components/conversas/ForwardMessageDialog";
import { AudioRecorder } from "@/components/conversas/AudioRecorder";
import { MediaUpload } from "@/components/conversas/MediaUpload";
import { NovaConversaDialog } from "@/components/conversas/NovaConversaDialog";
import { EditarLeadDialog } from "@/components/funil/EditarLeadDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { HorarioSeletor } from "@/components/agenda/HorarioSeletor";
import { HorarioComercial, criarHorarioPadrao } from "@/components/agenda/HorarioComercialConfig";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { LeadAttachments } from "@/components/leads/LeadAttachments";
import { ProdutoSelectorDialog } from "@/components/conversas/ProdutoSelectorDialog";
import { VendasLeadPanel } from "@/components/conversas/VendasLeadPanel";
import { PedidoChatModal } from "@/components/conversas/PedidoChatModal";
import { ClienteLTVFidelidadePanel } from "@/components/conversas/ClienteLTVFidelidadePanel";
import { PropostasBancariasPanel } from "@/components/conversas/PropostasBancariasPanel";
import { ProcessosJuridicosPanel } from "@/components/conversas/ProcessosJuridicosPanel";
import { isSegmentoFinanceiro, isSegmentoJuridico } from "@/lib/segmentos";
import { LembretesAntecipados, LembreteAntecipado } from "@/components/conversas/LembretesAntecipados";
import { ProductivityPanel } from "@/components/conversas/ProductivityPanel";
import { PastedImagePreview } from "@/components/conversas/PastedImagePreview";
import { formatPhoneNumber, safeFormatPhoneNumber, normalizePhoneForComparison } from "@/utils/phoneFormatter";
import { cleanAllConversationsHistory } from "@/utils/cleanConversationsHistory";
import { getMediaUrl, MediaExpiredError } from "@/utils/mediaLoader";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { useConversationsCache } from "@/hooks/useConversationsCache";
import { usePermissions } from "@/hooks/usePermissions";
import { useTagsManager } from "@/hooks/useTagsManager";
import { useConversationSearch, loadAllUniqueConversations } from "@/hooks/useConversationSearch";
import { useActiveAttendance, TEMPO_ATENDIMENTO_ATIVO } from "@/hooks/useActiveAttendance";
import { useAttendanceProtocol } from "@/hooks/useAttendanceProtocol";
import * as evolutionAPI from "@/services/evolutionApi";
import { ConversasAdvancedFilter, AdvancedFilters, defaultFilters } from "@/components/conversas/ConversasAdvancedFilter";
import { ConversaTemplateSender } from "@/components/conversas/ConversaTemplateSender";

// Verificar se URL do WhatsApp (pps.whatsapp.net) expirou
function isExpiredWhatsAppUrl(url: string): boolean {
  if (!url || !url.includes('pps.whatsapp.net')) return false;
  try {
    const oeMatch = url.match(/[?&]oe=([0-9a-fA-F]+)/);
    if (oeMatch) {
      const expiryTimestamp = parseInt(oeMatch[1], 16);
      const now = Math.floor(Date.now() / 1000);
      return expiryTimestamp < now + 3600; // expirada ou expira em menos de 1 hora
    }
  } catch { /* ignore */ }
  return false;
}

// Função auxiliar para extrair fileSize do JSON de mídia
function extractFileSizeFromMediaUrl(mediaUrl?: string): number | undefined {
  if (!mediaUrl) return undefined;
  try {
    // Tentar parsear como JSON (formato usado pelo Meta API)
    const parsed = JSON.parse(mediaUrl);
    if (parsed.file_size && typeof parsed.file_size === 'number') {
      return parsed.file_size;
    }
  } catch {
    // Não é JSON, ignorar
  }
  return undefined;
}

// Função auxiliar para extrair contactData de mensagens tipo 'contact'
function parseContactData(content: string): { name: string; phone: string } | undefined {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'contact') {
      return { name: parsed.name || 'Contato', phone: parsed.phone || '' };
    }
    if (parsed.type === 'contacts' && parsed.contacts?.length > 0) {
      return { name: parsed.contacts[0].name || 'Contato', phone: parsed.contacts[0].phone || '' };
    }
  } catch {
    // Not JSON, try legacy format
    const match = content.match(/📇\s*Contato\(s\):\s*(.+)/);
    if (match) return { name: match[1].trim(), phone: '' };
  }
  return undefined;
}

function normalizeMessageDeliveryStatus(status?: string | null): string {
  return String(status || "").trim().toLowerCase();
}

function getMessageDeliveryState(message: {
  status?: string | null;
  delivered?: boolean | null;
  read?: boolean | null;
}) {
  const normalizedStatus = normalizeMessageDeliveryStatus(message.status);
  const isDeliveredStatus = ["entregue", "delivered", "lida", "read"].includes(normalizedStatus);
  const isReadStatus = ["lida", "read"].includes(normalizedStatus);

  return {
    status: typeof message.status === "string" ? message.status : undefined,
    delivered: message.delivered === true || isDeliveredStatus,
    read: message.read === true || isReadStatus,
  };
}

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document" | "template";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  status?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number; // Tamanho do arquivo em bytes
  transcricao?: string;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error"; // Status da transcrição
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
  sentBy?: string; // Nome do responsável que enviou
  contactData?: {
    name: string;
    phone: string;
  };
}
interface Conversation {
  id: string;
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  status: "waiting" | "answered" | "resolved";
  lastMessage: string;
  unread: number;
  messages: Message[];
  tags: string[];
  funnelStage?: string;
  responsavel?: string;
  produto?: string;
  valor?: string;
  anotacoes?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  isGroup?: boolean;
  leadId?: string; // 🆕 ID do lead vinculado
  assignedUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  origemApi?: "evolution" | "meta"; // 🔥 NOVO: Identificação da API de origem
}
interface QuickMessage {
  id: string;
  title: string;
  content: string;
  category: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'document'; // Tipo de mensagem
  mediaUrl?: string; // URL base64 da mídia
  fileName?: string; // Nome do arquivo
  mimeType?: string; // Tipo MIME do arquivo
}
interface QuickMessageCategory {
  id: string;
  name: string;
}
interface Reminder {
  id: string;
  compromisso_id: string;
  canal: string;
  status_envio: string;
  mensagem?: string;
  horas_antecedencia: number;
  data_envio?: string;
  created_at: string;
  destinatario?: string;
  telefone_responsavel?: string;
  compromisso?: {
    data_hora_inicio: string;
    tipo_servico: string;
    lead_id?: string;
  };
}
interface ScheduledMessage {
  id: string;
  conversationId: string;
  content: string;
  datetime: string;
}
interface Meeting {
  id: string;
  lead_id?: string;
  usuario_responsavel_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  custo_estimado?: number;
  lembrete_enviado: boolean;
  created_at: string;
  company_id?: string;
  lead?: {
    name: string;
    phone?: string;
  };
}
const CONVERSATIONS_KEY = "continuum_conversations";
const CONVERSATIONS_CACHE_KEY = "continuum_conversations_cache_v3"; // ⚡ v3: Agora inclui company_id
const CONVERSATIONS_CACHE_TIMESTAMP_KEY = "continuum_conversations_cache_timestamp_v3"; // ⚡ v3
const CONVERSATIONS_CACHE_COMPANY_KEY = "continuum_conversations_cache_company_v3"; // ⚡ NOVO: Armazena company_id do cache
const QUICK_MESSAGES_KEY = "continuum_quick_messages";
const QUICK_CATEGORIES_KEY = "continuum_quick_categories";
const REMINDERS_KEY = "continuum_reminders";
const SCHEDULED_MESSAGES_KEY = "continuum_scheduled_messages";
const MEETINGS_KEY = "continuum_meetings";
const AI_MODE_KEY = "continuum_ai_mode";
const AUTO_CORRECT_KEY = "continuum_auto_correct_enabled"; // Chave para salvar preferência de correção automática
const INCLUDE_SIGNATURE_KEY = "waze_include_signature"; // Chave para salvar preferência de assinatura
const PINNED_CONVERSATIONS_KEY = "continuum_pinned_conversations"; // Chave para salvar conversas fixadas
const CACHE_MAX_AGE = 30 * 60 * 1000; // Cache válido por 30 minutos (carregamento instantâneo)

const initialConversations: Conversation[] = [{
  id: "1",
  contactName: "João Silva",
  channel: "whatsapp",
  status: "waiting",
  lastMessage: "Gostaria de saber mais sobre o produto",
  unread: 2,
  tags: ["cliente", "interesse"],
  funnelStage: "Novo",
  responsavel: "Você",
  produto: "Sistema CRM Premium",
  valor: "R$ 5.000,00",
  anotacoes: "Cliente interessado em plano anual",
  messages: [{
    id: "1",
    content: "Olá! Gostaria de saber mais sobre o produto",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 300000),
    delivered: true
  }, {
    id: "2",
    content: "Vocês têm disponibilidade para esta semana?",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 180000),
    delivered: true
  }]
}, {
  id: "2",
  contactName: "Maria Santos",
  channel: "instagram",
  status: "answered",
  lastMessage: "Obrigada pelas informações!",
  unread: 0,
  tags: ["promoção"],
  funnelStage: "Qualificado",
  responsavel: "Ana Costa",
  produto: "Consultoria Digital",
  valor: "R$ 2.500,00",
  messages: [{
    id: "1",
    content: "Vi o post sobre promoção",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 7200000),
    delivered: true
  }, {
    id: "2",
    content: "Olá Maria! Temos várias opções em promoção. Qual produto te interessa?",
    type: "text",
    sender: "user",
    timestamp: new Date(Date.now() - 7000000),
    delivered: true
  }, {
    id: "3",
    content: "Obrigada pelas informações!",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 6800000),
    delivered: true
  }]
}, {
  id: "3",
  contactName: "Carlos Oliveira",
  channel: "facebook",
  status: "resolved",
  lastMessage: "Fechado! Muito obrigado",
  unread: 0,
  tags: ["venda", "fechado"],
  funnelStage: "Fechado",
  responsavel: "Pedro Lima",
  produto: "Plano Enterprise",
  valor: "R$ 15.000,00",
  messages: [{
    id: "1",
    content: "Quero fazer uma compra",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 86400000),
    delivered: true
  }, {
    id: "2",
    content: "Ótimo! Vou te passar os detalhes.",
    type: "text",
    sender: "user",
    timestamp: new Date(Date.now() - 86000000),
    delivered: true
  }, {
    id: "3",
    content: "Fechado! Muito obrigado",
    type: "text",
    sender: "contact",
    timestamp: new Date(Date.now() - 85000000),
    delivered: true
  }]
}];
function Conversas() {
  const isMobile = useIsMobile();
  const {
    isAdmin,
    isSuperAdmin,
    userRoles
  } = usePermissions();
  const {
    allTags,
    refreshTags
  } = useTagsManager();

  // 📊 Controle de acesso ao painel de produtividade (gestores e admins)
  const canViewProductivity = useMemo(() => {
    return isAdmin || userRoles.some(r => 
      ['super_admin', 'company_admin', 'gestor'].includes(r.role)
    );
  }, [isAdmin, userRoles]);
  const [productivityPanelOpen, setProductivityPanelOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null); // Declarar primeiro
  const [companySegmento, setCompanySegmento] = useState<string | null>(null);
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Estado para encaminhamento de mensagens
  const [forwardData, setForwardData] = useState<{
    open: boolean;
    content: string;
    type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
    mediaUrl?: string;
    fileName?: string;
  }>({ open: false, content: "", type: "text" });

  // ⚡ CARREGAMENTO INSTANTÂNEO: Hook carrega do cache em 0 segundos
  const {
    conversations: cachedConversations,
    isLoading: cacheLoading,
    isSyncing: cacheSyncing,
    // ✅ FASE 3: Flag de sincronização
    lastSync: cacheLastSync,
    // ✅ FASE 4: Timestamp da última sincronização
    syncConversations,
    updateConversation: updateCachedConversation,
    addMessage: addCachedMessage
  } = useConversationsCache(userCompanyId);

  // 🔍 BUSCA NO BANCO: Hook para buscar conversas diretamente no banco
  const {
    searchResults,
    isSearching,
    hasSearched,
    searchConversations,
    clearSearch
  } = useConversationSearch(userCompanyId);

  // 🆕 ATENDIMENTOS ATIVOS: Hook para gerenciar quem está atendendo cada conversa
  const {
    startOrRefreshAttendance,
    refreshAttendance,
    getAttendingUser,
    hasActiveAttendance,
    activeAttendances,
    isCurrentUserAttending, // 🆕 NOVO: Verificar se usuário atual está atendendo
  } = useActiveAttendance(userCompanyId);

  // 📋 PROTOCOLO DE ATENDIMENTO
  const {
    activeProtocol,
    createProtocol,
    loadActiveProtocol,
    finalizeProtocol,
  } = useAttendanceProtocol(userCompanyId);

  // ⚡ DESATIVADO: Carregamento de avatares movido para lazy loading
  // Para evitar loops e melhorar performance
  // Avatares são carregados quando a conversa é aberta

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "resolved" | "group" | "responsible" | "transferred" | "instagram">("all");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultFilters);
  const [searchTerm, setSearchTerm] = useState("");
  // MELHORIA: Estado para busca debounced (otimização de performance)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // MELHORIA: Estados para paginação e cache
  const [conversationsLimit, setConversationsLimit] = useState(30); // ⚡ Limitar conversas iniciais para 30
  const [conversationsOffset, setConversationsOffset] = useState(0); // Offset para paginação
  const [hasMoreConversations, setHasMoreConversations] = useState(true); // Flag se há mais conversas
  const [loadingMore, setLoadingMore] = useState(false); // Loading state para "carregar mais"
  const [messagesLimit, setMessagesLimit] = useState(50); // Limite de mensagens exibidas
  const conversationsCacheRef = useRef<Map<string, Conversation>>(new Map()); // Cache de conversas abertas
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map()); // Cache de mensagens carregadas
  const [messageInput, setMessageInput] = useState("");
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const inflightAvatarPromisesRef = useRef<Map<string, Promise<string | undefined>>>(new Map());
  const initialLoadRef = useRef<boolean>(false);
  const notifiedMessagesRef = useRef<Set<string>>(new Set()); // ⚡ Rastrear mensagens já notificadas
  const [aiMode, setAiMode] = useState<Record<string, string>>({}); // conversation_id -> AIMode ('off'|'atendimento'|'agendamento'|'fluxo'|'all')
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [quickCategories, setQuickCategories] = useState<QuickMessageCategory[]>([]);
  const [showQuickRepliesPopup, setShowQuickRepliesPopup] = useState(false); // Estado para popup de respostas rápidas
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [leadVinculado, setLeadVinculado] = useState<any>(null);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [leadExtraInfo, setLeadExtraInfo] = useState<{ etapaNome?: string; funilNome?: string; responsavelNome?: string }>({});
  const [mostrarBotaoCriarLead, setMostrarBotaoCriarLead] = useState(false);
  const [leadsVinculados, setLeadsVinculados] = useState<Record<string, string>>({}); // conversationId -> leadId
  const [onlineStatus, setOnlineStatus] = useState<Record<string, 'online' | 'offline' | 'unknown'>>({}); // telefone -> status
  const [userName, setUserName] = useState<string>(""); // Nome do usuário logado
  const [blockedGroups, setBlockedGroups] = useState<Set<string>>(new Set()); // Grupos bloqueados
  const [companyMetrics, setCompanyMetrics] = useState<{
    totalConversas: number;
    conversasAtivas: number;
    mensagensHoje: number;
    whatsappConnections: number;
    whatsappConnected: number;
  }>({
    totalConversas: 0,
    conversasAtivas: 0,
    mensagensHoje: 0,
    whatsappConnections: 0,
    whatsappConnected: 0
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [historyStats, setHistoryStats] = useState<Record<string, {
    total: number;
    loaded: number;
  }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const userCompanyIdRef = useRef<string | null>(null);

  // 🔊 Ref para som de notificação
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const location = useLocation();

  // Estados para modais de visualização
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    name?: string;
  } | null>(null);
  // Estado para drag-and-drop de arquivos
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  // MELHORIA: Gerenciar status de transcrição por mensagem
  const [transcriptionStatuses, setTranscriptionStatuses] = useState<Record<string, "pending" | "processing" | "completed" | "error">>({});
  const transcriptionPollingRefs = useRef<Record<string, {
    interval?: NodeJS.Timeout;
    timeout?: NodeJS.Timeout;
  }>>({});

  // Estados para controle dos modais
  const [tarefasDialogOpen, setTarefasDialogOpen] = useState(false);
  const [tarefasTabValue, setTarefasTabValue] = useState("criar");
  const [reunioesDialogOpen, setReunioesDialogOpen] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [cleanHistoryDialogOpen, setCleanHistoryDialogOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachmentsCount, setAttachmentsCount] = useState(0);
  const [valorVendaDialogOpen, setValorVendaDialogOpen] = useState(false);
  const [valorVendaInput, setValorVendaInput] = useState("");
  const [salvandoValor, setSalvandoValor] = useState(false);
  const [finalizarNegociacaoOpen, setFinalizarNegociacaoOpen] = useState(false);
  const [finalizarNegociacaoAction, setFinalizarNegociacaoAction] = useState<'ganho' | 'perdido'>('ganho');
  const [cleaningHistory, setCleaningHistory] = useState(false);
  
  // Estados para seleção de produto
  const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string; preco_sugerido: number | null; categoria: string | null; subcategoria: string | null }>>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [cleaningStats, setCleaningStats] = useState({
    deleted: 0,
    total: 0
  });

  // CORREÇÃO: Estados para quadro e etapa (igual ao Funil de Vendas) - DEVE VIR ANTES DOS useEffects
  const [taskBoards, setTaskBoards] = useState<any[]>([]);
  const [taskColumns, setTaskColumns] = useState<any[]>([]);
  const [selectedTaskBoardId, setSelectedTaskBoardId] = useState<string>("");
  const [selectedTaskColumnId, setSelectedTaskColumnId] = useState<string>("");

  // Estados para sincronização WhatsApp e restauração de conversas
  const [isContactInactive, setIsContactInactive] = useState(false);
  const [restoringConversation, setRestoringConversation] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ step: number; label: string } | null>(null);

  // 🔤 Estado para correção automática de texto
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTO_CORRECT_KEY);
    return saved !== null ? JSON.parse(saved) : true; // Habilitado por padrão
  });
  const [isCorrectingText, setIsCorrectingText] = useState(false); // Estado de loading durante correção
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const sendingMessageRef = useRef(false);

  // ✍️ Estado para assinatura na mensagem
  const [includeSignature, setIncludeSignature] = useState<boolean>(() => {
    const saved = localStorage.getItem(INCLUDE_SIGNATURE_KEY);
    return saved !== null ? JSON.parse(saved) : false; // Desabilitado por padrão
  });

  // 📌 Estado para conversas fixadas
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(PINNED_CONVERSATIONS_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Função para alternar conversa fixada
  const togglePinConversation = useCallback((conversationId: string) => {
    setPinnedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
        toast.success("Conversa desafixada");
      } else {
        newSet.add(conversationId);
        toast.success("Conversa fixada no topo");
      }
      localStorage.setItem(PINNED_CONVERSATIONS_KEY, JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  // MELHORIA: Estados para sincronização realtime - Iniciar como conectado para UX instantânea
  const [realtimeConnectionStatus, setRealtimeConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('connected');
  const [realtimeReconnectAttempts, setRealtimeReconnectAttempts] = useState(0);
  const realtimeChannelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef<boolean>(false);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // MELHORIA: Função auxiliar para chamar Edge Functions com retry, timeout e fallback
  const callEdgeFunctionWithRetry = async <T = any,>(functionName: string, body: any, options: {
    maxRetries?: number;
    timeout?: number;
    fallback?: () => T | Promise<T>;
    onError?: (error: any, attempt: number) => void;
  } = {}): Promise<T | null> => {
    const {
      maxRetries = 3,
      timeout = 10000,
      // 10 segundos
      fallback,
      onError
    } = options;
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [EDGE-FUNCTION] Chamando ${functionName} (tentativa ${attempt}/${maxRetries})...`);

        // Criar promise com timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout após ${timeout}ms`));
          }, timeout);
        });

        // Promise da edge function
        const functionPromise = supabase.functions.invoke(functionName, {
          body
        });

        // Race entre função e timeout
        const result = await Promise.race([functionPromise, timeoutPromise]);

        // Validar resposta
        if (!result || !result.data) {
          throw new Error('Resposta inválida da edge function');
        }

        // Verificar se há erro na resposta
        if (result.error) {
          throw new Error(result.error.message || 'Erro na edge function');
        }
        console.log(`✅ [EDGE-FUNCTION] ${functionName} executada com sucesso (tentativa ${attempt})`);
        return result.data as T;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        console.error(`❌ [EDGE-FUNCTION] Erro ao chamar ${functionName} (tentativa ${attempt}/${maxRetries}):`, {
          error: errorMessage,
          attempt,
          functionName,
          body: typeof body === 'object' ? JSON.stringify(body).substring(0, 100) : body
        });

        // Logar erro completo para monitoramento
        if (onError) {
          onError(error, attempt);
        }

        // Se não for a última tentativa, esperar antes de tentar novamente (backoff exponencial)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s
          console.log(`⏳ [EDGE-FUNCTION] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Se todas as tentativas falharam, usar fallback se disponível
    console.error(`❌ [EDGE-FUNCTION] Todas as tentativas falharam para ${functionName}. Último erro:`, lastError);
    if (fallback) {
      console.log(`🔄 [EDGE-FUNCTION] Usando fallback para ${functionName}`);
      try {
        return await fallback();
      } catch (fallbackError) {
        console.error(`❌ [EDGE-FUNCTION] Erro no fallback para ${functionName}:`, fallbackError);
      }
    }
    return null;
  };

  // MELHORIA: Avatar com cache + fallback (NÃO cacheia placeholders para permitir retentativas)
  const getProfilePictureWithFallback = async (number: string, companyId: string, contactName: string, channel?: string): Promise<string | undefined> => {
    if (!number) return undefined;
    const isGroup = /@g\.us$/.test(String(number));
    const isInstagram = channel === 'instagram' || /^\d{15,20}$/.test(String(number).replace(/^ig_/, ''));
    const normalized = isGroup ? number : normalizePhoneForWA(number);
    const cacheKey = `${companyId || 'no-company'}:${normalized}`;
    const cached = avatarCacheRef.current.get(cacheKey);
    // Só retornar cache se for uma URL real (não placeholder)
    if (cached && !cached.includes('ui-avatars.com')) return cached;
    const inflight = inflightAvatarPromisesRef.current.get(cacheKey);
    if (inflight) return await inflight;
    const promise = (async () => {
      const result = await callEdgeFunctionWithRetry<{
        profilePictureUrl?: string;
      }>('get-profile-picture', {
        number: normalized,
        company_id: companyId,
        channel: isInstagram ? 'instagram' : undefined
      }, {
        maxRetries: 2,
        timeout: 8000,
        fallback: () => {
          const fallbackUrl = isGroup 
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || 'Grupo')}&background=10b981&color=fff&bold=true` 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || normalized)}&background=0ea5e9&color=fff&bold=true`;
          return Promise.resolve({ profilePictureUrl: fallbackUrl });
        },
        onError: error => {
          console.error('❌ [PROFILE-PICTURE] In-flight erro:', error);
        }
      });
      
      const receivedUrl = result?.profilePictureUrl;
      const hasValidUrl = receivedUrl && typeof receivedUrl === 'string' && receivedUrl.trim() !== '' && !receivedUrl.includes('undefined') && !receivedUrl.includes('null');
      
      const fallbackUrl = isGroup 
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || 'Grupo')}&background=10b981&color=fff&bold=true` 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || normalized)}&background=0ea5e9&color=fff&bold=true`;
      
      const url = hasValidUrl ? receivedUrl : fallbackUrl;
      // ⚡ CORREÇÃO: Só cachear URLs reais, não placeholders - permite retentativas futuras
      if (hasValidUrl) {
        avatarCacheRef.current.set(cacheKey, url);
      }
      inflightAvatarPromisesRef.current.delete(cacheKey);
      return url;
    })();
    inflightAvatarPromisesRef.current.set(cacheKey, promise);
    return await promise;
  };

  // MELHORIA: Wrapper enviar-whatsapp com retries e mapeamento de erros → toast
  const sendWhatsAppWithRetry = async (body: {
    company_id: string;
  } & Record<string, any>): Promise<{
    success: boolean;
    errorCode?: string;
    httpStatus?: number;
    message?: string;
    details?: any;
    message_id?: string;
    data?: any;
    provider?: string;
  }> => {
    const maxRetries = 1; // ⚡ CORREÇÃO: Reduzido de 3 para 1 - evitar espera longa
    console.log('🔄 [SEND-WHATSAPP-RETRY] Iniciando envio (tentativa 1):', {
      company_id: body.company_id,
      numero: body.numero,
      temMensagem: !!body.mensagem
    });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [SEND-WHATSAPP-RETRY] Tentativa ${attempt}/${maxRetries} - Chamando edge function...`, {
          body: {
            company_id: body.company_id,
            numero: body.numero,
            tipo_mensagem: body.tipo_mensagem,
            temMensagem: !!body.mensagem
          }
        });

        // ⚡ CORREÇÃO: Adicionar timeout explícito para evitar travamento
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout após 15 segundos')), 15000);
        });
        const functionPromise = supabase.functions.invoke('enviar-whatsapp', {
          body
        });
        console.log(`⏳ [SEND-WHATSAPP-RETRY] Aguardando resposta da edge function...`);
        const res: any = await Promise.race([functionPromise, timeoutPromise]);
        console.log(`📥 [SEND-WHATSAPP-RETRY] Resposta recebida!`);
        console.log(`📥 [SEND-WHATSAPP-RETRY] Resposta da edge function (tentativa ${attempt}):`, {
          hasData: !!res?.data,
          hasError: !!res?.error,
          status: res?.status,
          dataSuccess: res?.data?.success,
          dataError: res?.data?.error,
          dataCode: res?.data?.code
        });
        const data = res?.data;
        const err = res?.error;
        // Tratar erros retornados como data
        if (data && (data.error || data.code) && !data.success) {
          const code = data.code || data.error || 'UNKNOWN_ERROR';
          const msg = data.error || data.message || 'Falha no envio';
          const status = res?.status || undefined;
          const details = data.details || data;
          showWhatsAppErrorToast(code, status, details);
          console.debug('❌ [WHATSAPP] Erro detalhado:', {
            attempt,
            status,
            code,
            msg: data?.error || data?.message,
            details
          });
          return {
            success: false,
            errorCode: code,
            httpStatus: status,
            message: msg,
            details
          };
        }
        if (err) {
          let code: string | undefined;
          let httpStatus: number | undefined = (err as any)?.status || (err as any)?.context?.status;
          const raw = String(err?.message || '');

          let parsedPayload: any = null;
          try {
            parsedPayload = JSON.parse(raw);
          } catch {
            const jsonStart = raw.indexOf('{');
            if (jsonStart >= 0) {
              try {
                parsedPayload = JSON.parse(raw.slice(jsonStart));
              } catch {
                parsedPayload = null;
              }
            }
          }

          if (parsedPayload) {
            code = parsedPayload?.code || parsedPayload?.error?.code || parsedPayload?.error_code;
            httpStatus = httpStatus ?? parsedPayload?.status;
          }

          if (!code) {
            if (/INSTANCE_DISCONNECTED|Reconecte via QR Code|Instância desconectada/i.test(raw)) code = 'INSTANCE_DISCONNECTED';
            else if (/NO_API_KEY/.test(raw)) code = 'NO_API_KEY';
            else if (/NO_WHATSAPP_CONNECTION/.test(raw)) code = 'NO_WHATSAPP_CONNECTION';
            else if (/EXTERNAL_API_ERROR/.test(raw)) code = 'EXTERNAL_API_ERROR';
            else if (/CONFIG_ERROR/.test(raw)) code = 'CONFIG_ERROR';
            else if (/SEND_FAILED/.test(raw)) code = 'SEND_FAILED';
          }

          const messageFromPayload = parsedPayload?.error || parsedPayload?.message;
          const finalMessage = String(messageFromPayload || raw).slice(0, 240);
          const details = parsedPayload || raw;

          showWhatsAppErrorToast(code, httpStatus, details);
          console.debug('❌ [WHATSAPP] Erro detalhado:', {
            attempt,
            httpStatus,
            code,
            raw: finalMessage
          });
          return {
            success: false,
            errorCode: code,
            httpStatus,
            message: finalMessage,
            details
          };
        }
        if (data?.success) {
          console.log('✅ [SEND-WHATSAPP-RETRY] Mensagem enviada com sucesso! message_id:', data?.message_id);
          return {
            success: true,
            message_id: data?.message_id,
            data: data?.data,
            provider: data?.provider,
          };
        }
        // Falha desconhecida
        console.error('❌ [SEND-WHATSAPP-RETRY] Falha desconhecida. Resposta:', data);
        toast.error('Falha desconhecida ao enviar mensagem.');
        return {
          success: false
        };
      } catch (err: any) {
        const errorMessage = err?.message || String(err);
        console.error(`❌ [SEND-WHATSAPP-RETRY] Exceção na tentativa ${attempt}:`, {
          error: errorMessage,
          isTimeout: errorMessage.includes('Timeout'),
          attempt,
          maxRetries
        });
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ [SEND-WHATSAPP-RETRY] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // Se foi timeout, mensagem específica
        if (errorMessage.includes('Timeout')) {
          toast.error('Timeout ao enviar mensagem. A conexão pode estar lenta. Tente novamente.');
        } else {
          toast.error(`Erro de rede ao enviar mensagem: ${errorMessage}`);
        }
        return {
          success: false,
          errorCode: 'NETWORK_ERROR',
          message: errorMessage
        };
      }
    }
    return {
      success: false
    };
  };
  const showWhatsAppErrorToast = (code?: string, httpStatus?: number, details?: any) => {
    const prefix = code ? `[${code}] ` : '';
    const description = details ? typeof details === 'string' ? details.slice(0, 240) : JSON.stringify(details).slice(0, 240) : undefined;
    const opts = description ? {
      description
    } as any : undefined;

    const detailsText = typeof details === 'string' ? details : JSON.stringify(details || {});
    const isDisconnected = code === 'INSTANCE_DISCONNECTED' || /Instância desconectada|Reconecte via QR Code/i.test(detailsText);

    if (isDisconnected) {
      toast.error(`${prefix}Instância desconectada. Reconecte via QR Code nas Configurações.`, opts);
    } else if (httpStatus === 401 || httpStatus === 403) {
      toast.error(`${prefix}Sem autorização. Faça login novamente ou verifique permissões.`, opts);
    } else if (httpStatus === 404 || code === 'NO_WHATSAPP_CONNECTION') {
      toast.error(`${prefix}Conexão/instância não encontrada. Verifique suas conexões WhatsApp.`, opts);
    } else if (httpStatus && httpStatus >= 500) {
      toast.error(`${prefix}Erro no servidor. Tente novamente em instantes.`, opts);
    } else if (code === 'NO_API_KEY') {
      toast.error(`${prefix}API key ausente. Configure EVOLUTION_API_KEY ou a conexão da empresa.`, opts);
    } else if (code === 'EXTERNAL_API_ERROR') {
      toast.error(`${prefix}Falha na Evolution API. Verifique instância e payload.`, opts);
    } else if (code === 'CONFIG_ERROR') {
      toast.error(`${prefix}Configuração incompleta da Evolution API.`, opts);
    } else {
      toast.error(`${prefix}Falha ao enviar. Verifique os dados e tente novamente.`, opts);
    }
  };

  // MELHORIA: Wrapper específico para transcrever-audio com fallback de "transcrição pendente"
  const transcribeAudioWithRetry = async (body: {
    audioUrl: string;
    audioBase64?: string;
    company_id: string;
  }): Promise<{
    transcription?: string;
    status: string;
  }> => {
    return (await callEdgeFunctionWithRetry<{
      transcription?: string;
      status: string;
    }>('transcrever-audio', body, {
      maxRetries: 3,
      timeout: 10000,
      fallback: () => {
        console.warn('⚠️ [TRANSCRIBE] Transcrição falhou - marcando como pendente');
        return Promise.resolve({
          transcription: '[Transcrição pendente - erro ao processar áudio]',
          status: 'pending'
        });
      },
      onError: (error, attempt) => {
        console.error(`❌ [TRANSCRIBE] Erro na tentativa ${attempt}:`, {
          error: error?.message || String(error),
          audioUrl: body.audioUrl?.substring(0, 100)
        });
      }
    })) || {
      transcription: '[Transcrição pendente - erro ao processar áudio]',
      status: 'pending'
    };
  };

  // 🔍 BUSCA INTELIGENTE: Debounce + busca no banco de dados
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);

      // 🔍 Se tem termo de busca, buscar no banco de dados
      if (searchTerm.trim().length >= 2) {
        console.log('🔍 [SEARCH] Iniciando busca no banco:', searchTerm);
        searchConversations(searchTerm);
      } else {
        clearSearch();
      }
    }, 600); // 600ms de delay para busca no banco

    return () => clearTimeout(timer);
  }, [searchTerm, searchConversations, clearSearch]);

  // 🔐 CARREGAR GRUPOS BLOQUEADOS
  useEffect(() => {
    if (!currentUserId || !userCompanyId) return;
    const loadBlockedGroups = async () => {
      const {
        data,
        error
      } = await supabase.from('blocked_groups').select('group_number').eq('user_id', currentUserId).eq('company_id', userCompanyId);
      if (error) {
        console.error('❌ Erro ao carregar grupos bloqueados:', error);
        return;
      }
      if (data) {
        setBlockedGroups(new Set(data.map(g => g.group_number)));
        console.log('🔐 Grupos bloqueados carregados:', data.length);
      }
    };
    loadBlockedGroups();
  }, [currentUserId, userCompanyId]);

  // 🔐 FUNÇÃO: Bloquear/Desbloquear Grupo
  const toggleBlockGroup = async (groupNumber: string, groupName: string, block: boolean) => {
    if (!currentUserId || !userCompanyId) {
      toast.error('Erro: usuário ou empresa não identificado');
      return;
    }
    try {
      if (block) {
        // Bloquear grupo
        const {
          error
        } = await supabase.from('blocked_groups').insert({
          user_id: currentUserId,
          company_id: userCompanyId,
          group_number: groupNumber,
          group_name: groupName
        });
        if (error) throw error;
        setBlockedGroups(prev => new Set([...prev, groupNumber]));
        toast.success(`🔒 Grupo "${groupName}" bloqueado com sucesso`);
        console.log('🔒 Grupo bloqueado:', groupNumber);
      } else {
        // Desbloquear grupo
        const {
          error
        } = await supabase.from('blocked_groups').delete().eq('user_id', currentUserId).eq('company_id', userCompanyId).eq('group_number', groupNumber);
        if (error) throw error;
        setBlockedGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(groupNumber);
          return newSet;
        });
        toast.success(`🔓 Grupo "${groupName}" desbloqueado com sucesso`);
        console.log('🔓 Grupo desbloqueado:', groupNumber);
      }
    } catch (error) {
      console.error('❌ Erro ao bloquear/desbloquear grupo:', error);
      toast.error(`Erro ao ${block ? 'bloquear' : 'desbloquear'} grupo`);
    }
  };

  // ✅ FASE 1 CORRIGIDA: Contador de conversas aguardando resposta
  // 🆕 NOVA LÓGICA: Conversas onde última msg é do contato E NÃO existe atendimento ativo
  const waitingCount = useMemo(() => {
    return conversations.filter(conv => {
      if (conv.isGroup === true) return false; // Excluir grupos
      if (conv.status === 'resolved') return false; // Excluir finalizadas

      const lastMessage = conv.messages?.[conv.messages.length - 1];
      if (!lastMessage) return false;
      
      // Só é "Esperando" se última msg é do contato
      if (lastMessage.sender !== 'contact') return false;
      
      // 🆕 NOVO: Verificar se existe atendimento ativo não expirado
      const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
      const temAtendimentoAtivo = hasActiveAttendance(telefone);
      
      // Se tem atendimento ativo, não é "Esperando" (vai para "Em Atendimento")
      return !temAtendimentoAtivo;
    }).length;
  }, [conversations, hasActiveAttendance, activeAttendances]);

  // ✅ FASE 1 CORRIGIDA: Contador de conversas em atendimento
  // 🆕 NOVA LÓGICA: Conversas com atendimento ativo OU última msg é do usuário (dentro de 5min)
  const answeredCount = useMemo(() => {
    return conversations.filter(conv => {
      if (conv.isGroup === true) return false;
      if (conv.status === 'resolved') return false;
      
      const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
      
      // 🆕 NOVO: Se tem atendimento ativo não expirado, está "Em Atendimento"
      if (hasActiveAttendance(telefone)) return true;
      
      // Fallback: Verificar se última mensagem é do usuário
      const lastMessage = conv.messages?.[conv.messages.length - 1];
      if (!lastMessage) return false;
      return lastMessage.sender === 'user';
    }).length;
  }, [conversations, hasActiveAttendance, activeAttendances]);

  // 🆕 NOVO: Contador de conversas onde o usuário atual é responsável (ativo + legado)
  const responsibleCount = useMemo(() => {
    return conversations.filter(conv => {
      if (conv.isGroup) return false;
      const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
      // Incluir: atendimentos ativos do usuário atual OU responsáveis legados
      return isCurrentUserAttending(telefone) || conv.responsavel === currentUserId || conv.assignedUser?.id === currentUserId;
    }).length;
  }, [conversations, isCurrentUserAttending, currentUserId, activeAttendances]);
  const filteredConversations = useMemo(() => {
    // 🔍 Se tem resultados de busca do banco de dados, usar esses resultados
    const hasValidSearch = debouncedSearchTerm.trim().length >= 2 && hasSearched;

    // Se está buscando no banco, mostrar resultados da busca
    if (hasValidSearch && searchResults.length > 0) {
      console.log('🔍 [SEARCH] Usando resultados do banco:', searchResults.length);
      return searchResults as Conversation[];
    }
    console.log('🔍 [DEBUG] Filtrando conversas:', {
      total: conversations.length,
      filtro: filter,
      busca: debouncedSearchTerm,
      gruposBloqueados: blockedGroups.size,
      hasSearched,
      searchResultsCount: searchResults.length
    });
    let filtered = conversations;

    // Aplicar filtro de status conforme especificação
    if (filter === "all") {
      // ✅ Filtro "Todos": Mostrar TODAS as conversas EXCETO grupos bloqueados
      // 🔐 Para não super admins, esconder TODOS os grupos
      filtered = filtered.filter(conv => {
        if (conv.isGroup) {
          // Super admin vê grupos não bloqueados
          if (isSuperAdmin) {
            return !blockedGroups.has(conv.phoneNumber || conv.id);
          }
          // Não super admin não vê grupos
          return false;
        }
        return true;
      });
    } else if (filter === "group") {
      // ✅ Filtro "Grupos": Mostrar APENAS grupos (bloqueados e não bloqueados aparecem aqui)
      // 🔐 APENAS SUPER ADMIN pode ver este filtro
      filtered = isSuperAdmin ? filtered.filter(conv => conv.isGroup === true) : [];
    } else if (filter === "waiting") {
      // ✅ Filtro "Aguardando": Contatos que enviaram mensagem E NÃO tem atendimento ativo
      filtered = filtered.filter(conv => {
        if (conv.isGroup === true) return false;
        if (conv.status === 'resolved') return false;
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        
        // Só é "Esperando" se última msg é do contato
        if (lastMessage.sender !== 'contact') return false;
        
        // 🆕 NOVO: Verificar se existe atendimento ativo não expirado
        const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
        const temAtendimentoAtivo = hasActiveAttendance(telefone);
        
        // Se tem atendimento ativo, não é "Esperando"
        return !temAtendimentoAtivo;
      });
    } else if (filter === "answered") {
      // ✅ Filtro "Em Atendimento": Conversas com atendimento ativo OU última msg é do usuário
      filtered = filtered.filter(conv => {
        if (conv.isGroup === true) return false;
        if (conv.status === 'resolved') return false;
        
        const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
        
        // 🆕 NOVO: Se tem atendimento ativo não expirado, está "Em Atendimento"
        if (hasActiveAttendance(telefone)) return true;
        
        // Fallback: Verificar se última mensagem é do usuário
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        return lastMessage.sender === 'user';
      });
    } else if (filter === "resolved") {
      // ✅ Filtro "Finalizados"
      filtered = filtered.filter(conv => {
        if (conv.isGroup === true) return false;
        return conv.status === 'resolved';
      });
    } else if (filter === "responsible") {
      // ✅ Filtro "Responsável" ATUALIZADO
      // 🆕 Agora inclui: atendimentos ativos do usuário atual + responsáveis legados
      console.log('🔍 [RESPONSIBLE] Verificando filtro responsável, activeAttendances:', activeAttendances.size, 'currentUserId:', currentUserId);
      filtered = filtered.filter(conv => {
        if (conv.isGroup === true) return false;
        
        const telefone = (conv.phoneNumber || conv.id).replace(/[^0-9]/g, '');
        
        // 🆕 NOVO: Verificar se o usuário atual está atendendo ativamente este contato
        const isAttending = isCurrentUserAttending(telefone);
        if (isAttending) {
          console.log(`✅ [RESPONSIBLE] ${conv.contactName} (${telefone}) está em atendimento pelo usuário atual`);
          return true;
        }
        
        // Manter lógica legada: responsável ou transferido para mim
        const isLegacyResponsible = conv.responsavel === currentUserId || conv.assignedUser?.id === currentUserId;
        if (isLegacyResponsible) {
          console.log(`✅ [RESPONSIBLE] ${conv.contactName} é responsável legado`);
        }
        return isLegacyResponsible;
      });
    } else if (filter === "transferred") {
      // ✅ Filtro "Transferência"
      filtered = filtered.filter(conv => {
        if (conv.isGroup === true) return false;
        return conv.assignedUser?.id === currentUserId;
      });
    } else if (filter === "instagram") {
      // ✅ Filtro "Instagram": Mostrar APENAS conversas do Instagram Direct
      filtered = filtered.filter(conv => conv.channel === 'instagram');
    }
    console.log('📊 [DEBUG] Após filtro de status:', filtered.length);

    // 🆕 FILTROS AVANÇADOS
    // Filtrar por tags
    if (advancedFilters.tags.length > 0) {
      filtered = filtered.filter(conv => {
        if (!conv.tags || conv.tags.length === 0) return false;
        return advancedFilters.tags.some(tag => conv.tags.includes(tag));
      });
    }

    // Filtrar por responsáveis
    if (advancedFilters.responsaveis.length > 0) {
      filtered = filtered.filter(conv => {
        const respId = conv.responsavel || conv.assignedUser?.id;
        return respId && advancedFilters.responsaveis.includes(respId);
      });
    }

    // Filtrar por valor
    if (advancedFilters.comValor !== null) {
      filtered = filtered.filter(conv => {
        const temValor = conv.valor && parseFloat(conv.valor.replace(/[^0-9.,]/g, '').replace(',', '.')) > 0;
        return advancedFilters.comValor ? temValor : !temValor;
      });
    }

    // Filtrar por funil/etapa (requer leadId para buscar no banco - filtro básico por funnelStage)
    if (advancedFilters.funilId || advancedFilters.etapaId) {
      filtered = filtered.filter(conv => {
        // Por enquanto, filtrar pelo funnelStage da conversa
        // TODO: Fazer join com leads para filtro mais preciso
        if (advancedFilters.etapaId) {
          return conv.funnelStage === advancedFilters.etapaId;
        }
        return conv.funnelStage ? true : false;
      });
    }

    // Filtrar por temperatura (baseado nas tags)
    if (advancedFilters.temperatura) {
      filtered = filtered.filter(conv => {
        const tagsLower = conv.tags?.map(t => t.toLowerCase()) || [];
        if (advancedFilters.temperatura === 'quente') {
          return tagsLower.some(t => t.includes('quente') || t.includes('hot'));
        } else if (advancedFilters.temperatura === 'morno') {
          return tagsLower.some(t => t.includes('morno') || t.includes('warm'));
        } else if (advancedFilters.temperatura === 'frio') {
          return tagsLower.some(t => t.includes('frio') || t.includes('cold'));
        }
        return true;
      });
    }

    // Filtrar por status da venda
    if (advancedFilters.statusVenda) {
      filtered = filtered.filter(conv => {
        const tagsLower = conv.tags?.map(t => t.toLowerCase()) || [];
        if (advancedFilters.statusVenda === 'ganho') {
          return tagsLower.some(t => t.includes('ganho') || t.includes('fechado') || t.includes('won'));
        } else if (advancedFilters.statusVenda === 'perdido') {
          return tagsLower.some(t => t.includes('perdido') || t.includes('lost'));
        } else if (advancedFilters.statusVenda === 'em_negociacao') {
          return !tagsLower.some(t => t.includes('ganho') || t.includes('perdido') || t.includes('won') || t.includes('lost'));
        }
        return true;
      });
    }

    console.log('📊 [DEBUG] Após filtros avançados:', filtered.length);

    // Aplicar busca local (para buscas curtas < 2 caracteres)
    if (debouncedSearchTerm.trim() && debouncedSearchTerm.trim().length < 2) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(conv => conv.contactName.toLowerCase().includes(searchLower) || conv.lastMessage?.toLowerCase().includes(searchLower) || conv.phoneNumber?.includes(searchLower));
    }
    console.log('📊 [DEBUG] Após busca:', filtered.length);

    // Ordenar: primeiro conversas fixadas, depois por última mensagem (mais recentes primeiro)
    filtered = filtered.sort((a, b) => {
      // Prioridade 1: Conversas fixadas ficam no topo
      const aIsPinned = pinnedConversations.has(a.id) || pinnedConversations.has(a.phoneNumber || '');
      const bIsPinned = pinnedConversations.has(b.id) || pinnedConversations.has(b.phoneNumber || '');
      
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // Prioridade 2: Ordenar por última mensagem
      const aLastMsg = a.messages?.[a.messages.length - 1];
      const bLastMsg = b.messages?.[b.messages.length - 1];
      const aTimestamp = aLastMsg?.timestamp instanceof Date ? aLastMsg.timestamp : aLastMsg?.timestamp ? new Date(aLastMsg.timestamp) : null;
      const bTimestamp = bLastMsg?.timestamp instanceof Date ? bLastMsg.timestamp : bLastMsg?.timestamp ? new Date(bLastMsg.timestamp) : null;
      const aTime = aTimestamp?.getTime() || 0;
      const bTime = bTimestamp?.getTime() || 0;
      return bTime - aTime;
    });
    return filtered;
  }, [conversations, filter, debouncedSearchTerm, currentUserId, blockedGroups, hasSearched, searchResults, pinnedConversations, hasActiveAttendance, isCurrentUserAttending, activeAttendances, isSuperAdmin, advancedFilters]);

  // Mensagens exibidas: sempre refletir state atual da conversa selecionada (evitar cache obsoleto)
  // ⚡ CORREÇÃO: Não limitar mensagens exibidas - mostrar todas para preservar histórico
  const displayedMessages = useMemo(() => {
    if (!selectedConv) return [];
    const messages = selectedConv.messages || [];
    // ⚡ CORREÇÃO CRÍTICA: Mostrar TODAS as mensagens, não limitar
    // O limite de 50 era para performance, mas estava fazendo mensagens desaparecerem
    return messages; // Remover .slice(-messagesLimit) para preservar histórico completo
  }, [selectedConv?.id, selectedConv?.messages]);

  // MELHORIA: Função para carregar mais mensagens (lazy loading)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedConv) return;
    const currentLimit = messagesLimit;
    const newLimit = currentLimit + 50; // Carregar mais 50 mensagens

    setMessagesLimit(newLimit);

    // Se precisar buscar do servidor, fazer aqui
    // Por enquanto, apenas aumentamos o limite do cache

    console.log(`📦 [PERFORMANCE] Carregando mais mensagens: ${currentLimit} -> ${newLimit}`);
  }, [selectedConv, messagesLimit]);

  // MELHORIA: Função para atualizar cache de conversas abertas - otimização de performance
  const updateConversationCache = useCallback((conversation: Conversation) => {
    conversationsCacheRef.current.set(conversation.id, conversation);

    // Salvar mensagens no cache separadamente
    if (conversation.messages && conversation.messages.length > 0) {
      messagesCacheRef.current.set(conversation.id, conversation.messages);
    }

    // Limitar tamanho do cache (manter apenas últimas 100 conversas)
    if (conversationsCacheRef.current.size > 100) {
      const firstKey = conversationsCacheRef.current.keys().next().value;
      conversationsCacheRef.current.delete(firstKey);
      messagesCacheRef.current.delete(firstKey);
    }
    console.log(`💾 [PERFORMANCE] Cache atualizado para conversa: ${conversation.id}`);
  }, []);

  // MELHORIA: Função para recuperar conversa do cache - otimização de performance
  const getConversationFromCache = useCallback((conversationId: string): Conversation | null => {
    const cached = conversationsCacheRef.current.get(conversationId);
    if (cached) {
      console.log(`💾 [PERFORMANCE] Conversa recuperada do cache: ${conversationId}`);
      return cached;
    }
    return null;
  }, []);

  // ⚡ CORREÇÃO CRÍTICA: Carregar TODAS as conversas únicas usando nova função otimizada
  const loadInitialConversations = useCallback(async () => {
    if (!userCompanyId) return;
    try {
      console.log('📦 [LOAD-ALL] Iniciando carregamento otimizado de todas as conversas...');
      const allConversations = await loadAllUniqueConversations(userCompanyId);
      if (allConversations.length > 0) {
        console.log(`✅ [LOAD-ALL] ${allConversations.length} conversas únicas carregadas`);

        // ⚡ CORREÇÃO: Preservar avatarUrls E assignedUser das conversas existentes
        setConversations(prev => {
          // Criar mapas de dados existentes
          const avatarMap = new Map<string, string>();
          const assignedUserMap = new Map<string, {
            id: string;
            name: string;
            avatar?: string;
          }>();
          const responsavelMap = new Map<string, string>();
          prev.forEach(c => {
            const phoneKey = c.phoneNumber || c.id;
            if (c.avatarUrl && !c.avatarUrl.includes('ui-avatars.com')) {
              avatarMap.set(phoneKey, c.avatarUrl);
            }
            // ⚡ CRÍTICO: Preservar assignedUser para manter filtro "Transferidos"
            if (c.assignedUser?.id) {
              assignedUserMap.set(phoneKey, c.assignedUser);
            }
            if (c.responsavel) {
              responsavelMap.set(phoneKey, c.responsavel);
            }
          });

          // Mesclar novas conversas preservando avatares E assignedUser
          // ⚡ CORREÇÃO CRÍTICA: Preservar mensagens existentes das conversas
          // O sync de 30s trazia apenas 1 mensagem por conversa, apagando mensagens em tempo real
          const existingMessagesMap = new Map<string, Message[]>();
          prev.forEach(c => {
            const phoneKey = c.phoneNumber || c.id;
            if (c.messages && c.messages.length > 1) {
              existingMessagesMap.set(phoneKey, c.messages);
            }
          });

          const merged = (allConversations as Conversation[]).map(conv => {
            const phoneKey = conv.phoneNumber || conv.id;
            const existingAvatar = avatarMap.get(phoneKey);
            const existingAssignedUser = assignedUserMap.get(phoneKey);
            const existingResponsavel = responsavelMap.get(phoneKey);
            const existingMessages = existingMessagesMap.get(phoneKey);
            
            // Se a conversa existente já tem mais mensagens (carregadas ou recebidas em tempo real),
            // mesclar: manter as existentes e adicionar apenas novas do banco
            let finalMessages = conv.messages;
            if (existingMessages && existingMessages.length > conv.messages.length) {
              // Verificar se a mensagem mais recente do banco já existe nas existentes
              const newBankMsg = conv.messages[0]; // loadAllUniqueConversations retorna 1 msg
              const alreadyExists = existingMessages.some(m => m.id === newBankMsg?.id);
              if (alreadyExists) {
                finalMessages = existingMessages; // Manter mensagens existentes intactas
              } else if (newBankMsg) {
                // Mensagem nova do banco que não existe localmente - adicionar
                finalMessages = [...existingMessages, newBankMsg].sort((a, b) => {
                  const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                  const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                  return timeA - timeB;
                });
              }
            }
            
            // Atualizar lastMessage e status com base na mensagem mais recente do banco
            const latestMsg = finalMessages[finalMessages.length - 1];
            
            return {
              ...conv,
              messages: finalMessages,
              lastMessage: latestMsg?.content || conv.lastMessage,
              avatarUrl: existingAvatar || conv.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.contactName)}&background=0ea5e9&color=fff`,
              assignedUser: conv.assignedUser || existingAssignedUser,
              responsavel: conv.responsavel || existingResponsavel
            };
          });
          console.log(`✅ [LOAD-ALL] ${avatarMap.size} avatares, ${assignedUserMap.size} assignedUsers, ${existingMessagesMap.size} conversas com mensagens preservadas`);
          return merged;
        });

        // ⚡ DESATIVADO: Carregamento em massa de avatares removido para liberar capacidade das edge functions
        // Avatares agora são carregados sob demanda ao clicar em uma conversa
        console.log('📸 [LOAD-ALL] Carregamento de avatares em massa DESATIVADO - sob demanda ao clicar');
      }
    } catch (error) {
      console.error('❌ [LOAD-ALL] Erro ao carregar conversas:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, [userCompanyId, getProfilePictureWithFallback]);

  // CORREÇÃO: Carregar tarefas quando o modal de tarefas abrir e tiver lead vinculado
  useEffect(() => {
    if (tarefasDialogOpen && leadVinculado?.id) {
      console.log('📋 [TAREFAS] Modal aberto, carregando tarefas para lead:', leadVinculado.id);
      carregarTarefasDoLead(leadVinculado.id);
      // Resetar aba para "criar" quando abrir o modal
      setTarefasTabValue("criar");
    } else if (tarefasDialogOpen && !leadVinculado?.id) {
      // Se abrir sem lead, limpar lista
      setLeadTasks([]);
    }
  }, [tarefasDialogOpen, leadVinculado?.id]);

  // CORREÇÃO: Carregar boards e columns quando o modal de tarefas abrir (igual ao Funil de Vendas)
  useEffect(() => {
    if (tarefasDialogOpen) {
      carregarBoardsEColumns();
    }
  }, [tarefasDialogOpen]);

  // CORREÇÃO: Selecionar primeira coluna quando mudar o quadro
  useEffect(() => {
    if (selectedTaskBoardId && taskColumns.length > 0) {
      const columnsDoBoard = taskColumns.filter(c => c.board_id === selectedTaskBoardId);
      if (columnsDoBoard.length > 0 && !columnsDoBoard.find(c => c.id === selectedTaskColumnId)) {
        setSelectedTaskColumnId(columnsDoBoard[0].id);
      }
    }
  }, [selectedTaskBoardId, taskColumns]);

  // CORREÇÃO: Carregar reuniões quando o modal de reuniões abrir e tiver lead vinculado
  useEffect(() => {
    if (reunioesDialogOpen && leadVinculado?.id) {
      loadMeetings();
    }
  }, [reunioesDialogOpen, leadVinculado?.id]);

  // Manter referência atualizada da conversa selecionada para uso em handlers de realtime
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);
  useEffect(() => {
    userCompanyIdRef.current = userCompanyId;
  }, [userCompanyId]);

  // Sistema de eventos globais para comunicação entre módulos
  const {
    emitGlobalEvent
  } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: data => {
        console.log('🌍 [Conversas] Lead atualizado via evento global:', data);
        // Atualizar lead vinculado se for o mesmo
        if (leadVinculado && leadVinculado.id === data.id) {
          setLeadVinculado(data);
        }
        // Atualizar conversa correspondente se existir
        setConversations(prev => prev.map(conv => {
          const phoneMatch = conv.phoneNumber === data.phone || conv.phoneNumber === data.telefone;
          if (phoneMatch) {
            return {
              ...conv,
              contactName: data.name || conv.contactName,
              tags: data.tags?.length ? data.tags : conv.tags,
              funnelStage: data.stage || conv.funnelStage,
              produto: data.servico || conv.produto,
              valor: data.value ? `R$ ${Number(data.value).toLocaleString('pt-BR')}` : conv.valor,
              anotacoes: data.notes || conv.anotacoes
            };
          }
          return conv;
        }));
      },
      onTaskCreated: data => {
        console.log('🌍 [Conversas] Nova tarefa criada, verificar se vinculada ao lead:', data);
        // Se uma tarefa foi criada vinculada ao lead atual, podemos mostrar notificação
        if (leadVinculado && data.lead_id === leadVinculado.id) {
          // Opcional: mostrar indicador de tarefa criada
        }
      },
      onMeetingScheduled: data => {
        console.log('🌍 [Conversas] Reunião agendada, verificar se vinculada ao lead:', data);
        // Se uma reunião foi agendada vinculada ao lead atual, podemos mostrar notificação
        if (leadVinculado && data.lead_id === leadVinculado.id) {
          // Opcional: mostrar indicador de reunião agendada
        }
      },
      onFunnelStageChanged: data => {
        console.log('🌍 [Conversas] Lead movido no funil:', data);
        // Atualizar conversa se o lead mudou de etapa
        setConversations(prev => prev.map(conv => {
          if (leadVinculado && leadVinculado.id === data.leadId) {
            return {
              ...conv,
              funnelStage: data.newStage
            };
          }
          return conv;
        }));
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // Carregar métricas quando a empresa for identificada
  useEffect(() => {
    if (userCompanyId) {
      // FIXME: loadCompanyMetrics não definida
      // loadCompanyMetrics();
    }
  }, [userCompanyId]);

  // ⚡ CORREÇÃO CRÍTICA: Carregar mensagens rápidas e categorias do banco ao inicializar
  useEffect(() => {
    if (userCompanyId) {
      console.log('📦 [QUICK-MESSAGES] Carregando mensagens rápidas e categorias do banco...');
      loadQuickMessages();
      loadQuickCategories();
    }
  }, [userCompanyId]);

  // ⚡ Enriquecer leadVinculado com nomes de etapa, funil e responsável
  useEffect(() => {
    if (!leadVinculado) {
      setLeadExtraInfo({});
      return;
    }
    const fetchExtraInfo = async () => {
      const info: typeof leadExtraInfo = {};
      try {
        // Buscar nome da etapa
        if (leadVinculado.etapa_id) {
          const { data: etapa } = await supabase
            .from('etapas')
            .select('nome, funil_id')
            .eq('id', leadVinculado.etapa_id)
            .maybeSingle();
          if (etapa) {
            info.etapaNome = etapa.nome;
            // Buscar nome do funil
            if (etapa.funil_id) {
              const { data: funil } = await supabase
                .from('funis')
                .select('nome')
                .eq('id', etapa.funil_id)
                .maybeSingle();
              if (funil) info.funilNome = funil.nome;
            }
          }
        } else if (leadVinculado.funil_id) {
          const { data: funil } = await supabase
            .from('funis')
            .select('nome')
            .eq('id', leadVinculado.funil_id)
            .maybeSingle();
          if (funil) info.funilNome = funil.nome;
        }
        // Buscar nome do responsável
        if (leadVinculado.responsavel_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', leadVinculado.responsavel_id)
            .maybeSingle();
          if (profile) info.responsavelNome = profile.full_name;
        }
      } catch (err) {
        console.warn('Erro ao buscar info extra do lead:', err);
      }
      setLeadExtraInfo(info);
    };
    fetchExtraInfo();
  }, [leadVinculado?.id, leadVinculado?.etapa_id, leadVinculado?.funil_id, leadVinculado?.responsavel_id]);


  useEffect(() => {
    if (cachedConversations.length > 0) {
      console.log(`⚡ [INSTANT] ${cachedConversations.length} conversas carregadas instantaneamente do cache`);
      setConversations(cachedConversations);
    }
  }, [cachedConversations]);

  // ✅ SINCRONIZAÇÃO REALTIME MULTI-USER: Escutar novas mensagens e atualizações em tempo real
  useEffect(() => {
    if (!userCompanyId) return;

    // ⚡ CRÍTICO MULTI-USER: Usar channel name único por sessão para evitar conflitos entre usuários
    const uniqueChannelId = `conversas-realtime-${userCompanyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔴 [REALTIME-MULTIUSER] Iniciando escuta com canal único:', uniqueChannelId);
    const channel = supabase.channel(uniqueChannelId).on('postgres_changes', {
      event: '*',
      // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'conversas',
      filter: `company_id=eq.${userCompanyId}`
    }, async payload => {
      const newData = payload.new as any;
      console.log('📨 [REALTIME-MULTIUSER] Evento recebido:', payload.eventType, '- ID:', newData?.id);
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const novaMensagem = payload.new;

        // Validar company_id
        if (novaMensagem.company_id !== userCompanyId) {
          console.warn('⚠️ [REALTIME-MULTIUSER] Mensagem de outra company ignorada');
          return;
        }
        // ✅ CORREÇÃO: Para grupos, usar o número original com @g.us
        const isGroupMessage = novaMensagem.is_group === true || /@g\.us$/.test(novaMensagem.numero || '');
        // ⚡ CORREÇÃO: Detectar Instagram via origem
        const isInstagramMessage = novaMensagem.origem === 'Instagram' || (novaMensagem.origem_api === 'meta' && String(novaMensagem.telefone_formatado || novaMensagem.numero || '').replace(/[^0-9]/g, '').length > 13);
        
        const telefone = isGroupMessage 
          ? (novaMensagem.numero || '') // Manter formato original para grupos
          : isInstagramMessage
            ? `ig_${novaMensagem.telefone_formatado || novaMensagem.numero || ''}`
            : (novaMensagem.telefone_formatado || novaMensagem.numero || '').replace(/[^0-9]/g, '');
        
        // Validar telefone apenas para contatos individuais (grupos e Instagram têm formato diferente)
        if (!isGroupMessage && !isInstagramMessage && (telefone.length < 10 || telefone.length > 15)) {
          console.warn('⚠️ [REALTIME-MULTIUSER] Telefone inválido ignorado:', telefone);
          return;
        }
        
        // ⚡ CORREÇÃO: Se for UPDATE, SEMPRE atualizar status de leitura e retornar
        // UPDATE significa que a mensagem já existe no banco - apenas atualizar status
        if (payload.eventType === 'UPDATE') {
          const deliveryState = getMessageDeliveryState(novaMensagem);
          console.log('👁️ [REALTIME] UPDATE recebido - atualizando status:', {
            id: novaMensagem.id,
            status: novaMensagem.status,
            read: novaMensagem.read,
            delivered: novaMensagem.delivered
          });
          
          // Atualizar status de leitura na conversa selecionada
          setSelectedConv(prevSelected => {
            if (!prevSelected) return prevSelected;
            const mensagemIndex = prevSelected.messages.findIndex(m => m.id === novaMensagem.id);
            if (mensagemIndex !== -1) {
              const novasMensagens = [...prevSelected.messages];
              novasMensagens[mensagemIndex] = {
                ...novasMensagens[mensagemIndex],
                content: novaMensagem.mensagem || novasMensagens[mensagemIndex].content,
                status: deliveryState.status || novasMensagens[mensagemIndex].status,
                read: deliveryState.read,
                delivered: deliveryState.delivered
              };
              return {
                ...prevSelected,
                messages: novasMensagens
              };
            }
            return prevSelected;
          });
          
          // Atualizar também na lista de conversas
          setConversations(prev => prev.map(conv => {
            const mensagemIndex = conv.messages.findIndex(m => m.id === novaMensagem.id);
            if (mensagemIndex !== -1) {
              const novasMensagens = [...conv.messages];
              novasMensagens[mensagemIndex] = {
                ...novasMensagens[mensagemIndex],
                content: novaMensagem.mensagem || novasMensagens[mensagemIndex].content,
                status: deliveryState.status || novasMensagens[mensagemIndex].status,
                read: deliveryState.read,
                delivered: deliveryState.delivered
              };
              return {
                ...conv,
                messages: novasMensagens
              };
            }
            return conv;
          }));
          
          // ⚡ CORREÇÃO CRÍTICA: UPDATE sempre significa mensagem existente
          // Não processar como nova mensagem - apenas atualizar status e retornar
          return;
        }
        
        const isFromMe = novaMensagem.fromme === true || String(novaMensagem.fromme) === 'true';

        // ⚡ MULTI-USER: Buscar sent_by do banco - CRÍTICO para saber qual colega enviou
        let sentBy = novaMensagem.sent_by || undefined;

        // Se não tem sent_by mas tem owner_id, buscar nome do usuário (pode ser outro colega)
        if (!sentBy && novaMensagem.owner_id && isFromMe) {
          const {
            data: profile
          } = await supabase.from('profiles').select('full_name').eq('id', novaMensagem.owner_id).single();
          sentBy = profile?.full_name || 'Colega';
        }
        console.log('🔍 [REALTIME-MULTIUSER] Mensagem de:', sentBy || (isFromMe ? 'Usuário' : 'Contato'), '| owner_id:', novaMensagem.owner_id);

        // Mapear tipos de mensagem corretamente (inclui 'pdf' e 'document')
        const tipoMensagem = novaMensagem.tipo_mensagem === 'texto' ? 'text' : novaMensagem.tipo_mensagem === 'image' ? 'image' : novaMensagem.tipo_mensagem === 'audio' ? 'audio' : novaMensagem.tipo_mensagem === 'video' ? 'video' : novaMensagem.tipo_mensagem === 'document' || novaMensagem.tipo_mensagem === 'pdf' ? 'pdf' : novaMensagem.tipo_mensagem === 'contact' ? 'contact' : novaMensagem.tipo_mensagem || 'text';

        // Criar objeto de mensagem
        const contactDataParsed = tipoMensagem === 'contact' ? parseContactData(novaMensagem.mensagem || '') : undefined;
        const deliveryState = getMessageDeliveryState(novaMensagem);
        const novaMensagemObj: Message = {
          id: novaMensagem.id,
          content: tipoMensagem === 'contact' ? (contactDataParsed ? `📇 Contato: ${contactDataParsed.name}` : novaMensagem.mensagem || '') : (novaMensagem.mensagem || ''),
          type: tipoMensagem as any,
          sender: isFromMe ? 'user' : 'contact',
          timestamp: new Date(novaMensagem.created_at || Date.now()),
          delivered: deliveryState.delivered,
          read: deliveryState.read,
          status: deliveryState.status,
          mediaUrl: novaMensagem.midia_url,
          fileName: novaMensagem.arquivo_nome,
          fileSize: extractFileSizeFromMediaUrl(novaMensagem.midia_url),
          mimeType: novaMensagem.tipo_mensagem === 'video' ? 'video/mp4' : novaMensagem.tipo_mensagem === 'audio' ? 'audio/mpeg' : novaMensagem.tipo_mensagem === 'image' ? 'image/jpeg' : novaMensagem.tipo_mensagem === 'document' || novaMensagem.tipo_mensagem === 'pdf' ? 'application/pdf' : undefined,
          sentBy: sentBy,
          contactData: contactDataParsed
        };

        // ⚡ CRÍTICO MULTI-USER: Atualizar conversa selecionada em tempo real para TODOS
        setSelectedConv(prevSelected => {
          if (!prevSelected) return prevSelected;

          // Verificar se a mensagem pertence à conversa selecionada
          const igUserId = telefone.replace(/^ig_/, '');
          const convId = (prevSelected.id || '').replace(/^ig_/, '');
          const convPhone = (prevSelected.phoneNumber || '').replace(/^ig_/, '');
          const isMatch = isInstagramMessage 
            ? (convId === igUserId || convPhone === igUserId || prevSelected.id === telefone ||
               (prevSelected.channel === 'instagram' && convId === igUserId))
            : (prevSelected.phoneNumber || prevSelected.id || '').replace(/[^0-9]/g, '') === telefone;
          if (isMatch) {
            // ⚡ DEDUPLICAÇÃO: Verificar se mensagem já existe por ID
            const mensagemJaExiste = prevSelected.messages.some(m => m.id === novaMensagem.id);
            if (mensagemJaExiste) {
              console.log('⚠️ [REALTIME-MULTIUSER] Mensagem duplicada ignorada:', novaMensagem.id);
              return prevSelected;
            }
            console.log('✅ [REALTIME-MULTIUSER] Atualizando conversa selecionada para TODOS os usuários');
            const novasMensagens = [...prevSelected.messages, novaMensagemObj].sort((a, b) => {
              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
              return timeA - timeB;
            });

            // ⚡ MULTI-USER: Status correto - QUALQUER colega que responde = Em Atendimento
            let novoStatus: "waiting" | "answered" | "resolved" = prevSelected.status;
            if (novaMensagemObj.sender === 'user') {
              novoStatus = 'answered'; // Qualquer colega respondeu = Em Atendimento
            } else if (novaMensagemObj.sender === 'contact') {
              novoStatus = 'waiting'; // Contato enviou = Aguardando
            }
            return {
              ...prevSelected,
              messages: novasMensagens,
              lastMessage: novaMensagem.mensagem || '',
              status: novoStatus,
              unread: novaMensagemObj.sender === 'contact' ? (prevSelected.unread || 0) + 1 : 0
            };
          }
          return prevSelected;
        });

        // ⚡ CRÍTICO MULTI-USER: Atualizar lista de conversas para TODOS os usuários da empresa
        setConversations(prev => {
          const telefoneKey = telefone;
          const conversaExistente = prev.find(c => {
            if (isInstagramMessage) {
              // Instagram: match robustamente por ID numérico ou prefixado
              const igUserId = telefoneKey.replace(/^ig_/, '');
              const convId = (c.id || '').replace(/^ig_/, '');
              const convPhone = (c.phoneNumber || '').replace(/^ig_/, '');
              return c.id === telefoneKey || 
                     convId === igUserId ||
                     convPhone === igUserId || 
                     c.phoneNumber === telefoneKey ||
                     (c.channel === 'instagram' && convId === igUserId);
            }
            const tel = (c.phoneNumber || c.id || '').replace(/[^0-9]/g, '');
            return tel === telefoneKey;
          });
          if (conversaExistente) {
            // ⚡ DEDUPLICAÇÃO: Verificar se mensagem já existe por ID
            const mensagemJaExiste = conversaExistente.messages.some(m => m.id === novaMensagem.id);
            if (mensagemJaExiste) {
              console.log('⚠️ [REALTIME-MULTIUSER] Mensagem duplicada na lista, ignorando:', novaMensagem.id);
              return prev;
            }
            console.log('✅ [REALTIME-MULTIUSER] Adicionando mensagem à conversa para TODOS:', conversaExistente.contactName);
            return prev.map(conv => {
              if (conv.id === conversaExistente.id) {
                const novasMensagens = [...conv.messages, novaMensagemObj].sort((a, b) => {
                  const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                  const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                  return timeA - timeB;
                });

                // ⚡ MULTI-USER: Status correto - QUALQUER colega que responde = Em Atendimento
                let novoStatus: "waiting" | "answered" | "resolved" = conv.status;
                if (novaMensagemObj.sender === 'user') {
                  novoStatus = 'answered'; // Qualquer colega respondeu = Em Atendimento
                } else if (novaMensagemObj.sender === 'contact') {
                  // Verificar conversa ao vivo
                  const TEMPO_CONVERSA_AO_VIVO = 10 * 60 * 1000;
                  const agora = Date.now();
                  const ultimaMsgUsuario = novasMensagens.filter(m => m.sender === 'user').sort((a, b) => {
                    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                    return timeB - timeA;
                  })[0];
                  if (ultimaMsgUsuario) {
                    const tempoUltimaResposta = ultimaMsgUsuario.timestamp instanceof Date ? ultimaMsgUsuario.timestamp.getTime() : new Date(ultimaMsgUsuario.timestamp).getTime();
                    const usuarioRespondeuRecentemente = agora - tempoUltimaResposta < TEMPO_CONVERSA_AO_VIVO;
                    novoStatus = usuarioRespondeuRecentemente ? 'answered' : 'waiting';
                  } else {
                    novoStatus = 'waiting';
                  }
                }
                return {
                  ...conv,
                  messages: novasMensagens,
                  lastMessage: novaMensagem.mensagem || '',
                  status: novoStatus,
                  unread: novaMensagemObj.sender === 'contact' ? (conv.unread || 0) + 1 : 0
                };
              }
              return conv;
            });
          } else {
            // Criar nova conversa para TODOS os usuários
            console.log('✅ [REALTIME-MULTIUSER] Criando nova conversa para TODOS:', telefoneKey);
            const novaConversa: Conversation = {
              id: isInstagramMessage ? telefoneKey : (novaMensagem.lead_id || `conv-${telefoneKey}`),
              contactName: (() => {
                // Para nova conversa, usar nome_contato apenas se NÃO for um número puro e NÃO for fallback
                const nome = novaMensagem.nome_contato || '';
                const nomeDigits = nome.replace(/[^0-9]/g, '');
                const isFallback = /^Instagram\s+\d+$/i.test(nome);
                if (nome && !isFallback && !(nomeDigits.length > 8 && nomeDigits === nome)) {
                  return nome;
                }
                // ⚡ CORREÇÃO: Para Instagram, usar fallback amigável ao invés de ID numérico
                const cleanKey = telefoneKey.replace(/^ig_/, '');
                if (isInstagramMessage && /^\d{10,}$/.test(cleanKey)) {
                  return `Contato Instagram`;
                }
                return cleanKey;
              })(),
              channel: isInstagramMessage ? 'instagram' : 'whatsapp' as const,
              status: novaMensagemObj.sender === 'user' ? 'answered' : 'waiting',
              lastMessage: novaMensagem.mensagem || '',
              unread: novaMensagemObj.sender === 'contact' ? 1 : 0,
              messages: [novaMensagemObj],
              tags: [],
              phoneNumber: isInstagramMessage ? telefoneKey : (novaMensagem.telefone_formatado || novaMensagem.numero || telefoneKey),
              isGroup: novaMensagem.is_group || /@g\.us$/.test(novaMensagem.numero || ''),
              origemApi: isInstagramMessage ? 'meta' : undefined,
              avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent((novaMensagem.nome_contato || telefoneKey).substring(0, 2))}&background=0ea5e9&color=fff`
            };
            return [novaConversa, ...prev];
          }
        });

        // ⚡ CORREÇÃO CRÍTICA: Tocar som de notificação APENAS para mensagens novas recebidas do contato
        // Verificar: 1) É do contato (fromme === false), 2) É INSERT (não UPDATE), 3) Não foi notificada antes
        const isFromContact = novaMensagem.fromme === false || String(novaMensagem.fromme) === 'false';
        const isNewMessage = payload.eventType === 'INSERT';
        const notAlreadyNotified = !notifiedMessagesRef.current.has(novaMensagem.id);
        if (isFromContact && isNewMessage && notAlreadyNotified) {
          // Marcar como notificada
          notifiedMessagesRef.current.add(novaMensagem.id);

          // Limpar set se ficar muito grande (manter apenas últimas 100 mensagens)
          if (notifiedMessagesRef.current.size > 100) {
            const idsArray = Array.from(notifiedMessagesRef.current);
            notifiedMessagesRef.current = new Set(idsArray.slice(-100));
          }
          
          // 📋 AUTO-PROTOCOLO: Criar protocolo automaticamente ao receber mensagem do contato
          const telefoneProtocol = novaMensagem.telefone_formatado || (novaMensagem.numero || '').replace(/[^0-9]/g, '');
          if (telefoneProtocol && userCompanyIdRef.current) {
            createProtocol(telefoneProtocol, { 
              startedBy: 'contato',
              contactName: novaMensagem.nome_contato || undefined,
            }).catch(() => {});
          }
          
          console.log('🔔 [REALTIME] Disparando notificação para mensagem nova:', novaMensagem.id);
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {});
          toast.info(`Nova mensagem de ${novaMensagem.nome_contato || 'contato'}`, {
            duration: 3000
          });
        } else {
          console.log('⚠️ [REALTIME] Notificação ignorada:', {
            isFromContact,
            isNewMessage,
            notAlreadyNotified,
            messageId: novaMensagem.id
          });
        }
      }
    }).subscribe(status => {
      console.log('🔴 [REALTIME-MULTIUSER] Status da conexão:', status);
      if (status === 'SUBSCRIBED') {
        setRealtimeConnectionStatus('connected');
        setRealtimeReconnectAttempts(0);
        console.log('✅ [REALTIME-MULTIUSER] Conectado - sincronização multi-user ativa');
      } else if (status === 'CHANNEL_ERROR') {
        setRealtimeConnectionStatus('error');
      } else if (status === 'CLOSED') {
        setRealtimeConnectionStatus('disconnected');
      } else if (status === 'TIMED_OUT') {
        setRealtimeConnectionStatus('disconnected');
        if (realtimeReconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, realtimeReconnectAttempts), 30000);
          console.log(`🔄 [REALTIME-MULTIUSER] Reconectando em ${delay}ms (tentativa ${realtimeReconnectAttempts + 1})`);
          setRealtimeReconnectAttempts(prev => prev + 1);
          setTimeout(() => {
            setRealtimeConnectionStatus('connecting');
          }, delay);
        }
      }
    });
    return () => {
      console.log('🔴 [REALTIME-MULTIUSER] Desconectando canal...');
      setRealtimeConnectionStatus('disconnected');
      supabase.removeChannel(channel);
    };
  }, [userCompanyId, realtimeReconnectAttempts]);

  // ✅ REALTIME: Escutar mudanças em conversation_assignments (transferências do bot/atendentes)
  useEffect(() => {
    if (!userCompanyId) return;
    const assignChannel = supabase.channel(`assignments-realtime-${userCompanyId}-${Date.now()}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_assignments',
      filter: `company_id=eq.${userCompanyId}`
    }, async (payload: any) => {
      const data = (payload.new || payload.old) as any;
      if (!data?.telefone_formatado) return;
      const tel = data.telefone_formatado.replace(/[^0-9]/g, '');
      console.log('📋 [ASSIGNMENT-RT] Evento:', payload.eventType, tel);

      if (payload.eventType === 'DELETE') {
        // Assignment removido - limpar assignedUser da conversa
        setConversations(prev => prev.map(c => {
          const cTel = (c.phoneNumber || c.id).replace(/[^0-9]/g, '');
          if (cTel === tel) {
            return { ...c, assignedUser: undefined, responsavel: undefined };
          }
          return c;
        }));
      } else if (data.assigned_user_id) {
        // Assignment criado/atualizado - buscar nome do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', data.assigned_user_id)
          .maybeSingle();
        const userName = profile?.full_name || profile?.email || 'Usuário';

        setConversations(prev => prev.map(c => {
          const cTel = (c.phoneNumber || c.id).replace(/[^0-9]/g, '');
          if (cTel === tel) {
            return {
              ...c,
              assignedUser: { id: data.assigned_user_id, name: userName },
              responsavel: data.assigned_user_id
            };
          }
          return c;
        }));
      }
    }).subscribe();

    return () => { supabase.removeChannel(assignChannel); };
  }, [userCompanyId]);


  useEffect(() => {
    if (userCompanyId && !loadingConversations) {
      const syncTimer = setInterval(() => {
        console.log('🔄 [MULTIUSER-SYNC] Sincronização backup (30s)...');
        loadInitialConversations();
      }, 30000);
      return () => clearInterval(syncTimer);
    }
  }, [userCompanyId, loadingConversations]);

  // Form states
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickContent, setNewQuickContent] = useState("");
  const [newQuickCategory, setNewQuickCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newQuickMessageType, setNewQuickMessageType] = useState<"text" | "image" | "video" | "audio" | "document">("text");
  const [newQuickMediaFile, setNewQuickMediaFile] = useState<File | null>(null);
  const [newQuickMediaPreview, setNewQuickMediaPreview] = useState<string | null>(null);
  // Estados para edição
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editMessageTitle, setEditMessageTitle] = useState("");
  const [editMessageContent, setEditMessageContent] = useState("");
  const [editMessageCategory, setEditMessageCategory] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editMessageType, setEditMessageType] = useState<"text" | "image" | "video" | "audio" | "document">("text");
  const [editMessageMediaFile, setEditMessageMediaFile] = useState<File | null>(null);
  const [editMessageMediaPreview, setEditMessageMediaPreview] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDatetime, setReminderDatetime] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderMessage, setReminderMessage] = useState(""); // Mensagem a ser enviada
  const [reminderDestinatario, setReminderDestinatario] = useState<"lead" | "responsavel" | "ambos">("lead"); // Destinatário
  const [reminderEnviar, setReminderEnviar] = useState(true); // Se deve enviar mensagem
  const [reminderRecorrencia, setReminderRecorrencia] = useState<"" | "semanal" | "quinzenal" | "mensal">(""); // Recorrência
  const [reminderMediaFile, setReminderMediaFile] = useState<File | null>(null);
  const [reminderMediaPreview, setReminderMediaPreview] = useState<string | null>(null);
  const [reminderLembretesAntecipados, setReminderLembretesAntecipados] = useState<LembreteAntecipado[]>([]);
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingData, setMeetingData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meetingHoraInicio, setMeetingHoraInicio] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingTipoServico, setMeetingTipoServico] = useState("reuniao");
  const [meetingCustoEstimado, setMeetingCustoEstimado] = useState("");
  const [meetingDuracao, setMeetingDuracao] = useState("30");
  const [meetingDescricao, setMeetingDescricao] = useState("");
  const [meetingHorarioComercial, setMeetingHorarioComercial] = useState<any>({
    manha: {
      inicio: "08:00",
      fim: "12:00",
      ativo: true
    },
    tarde: {
      inicio: "14:00",
      fim: "18:00",
      ativo: true
    },
    noite: {
      inicio: "19:00",
      fim: "23:00",
      ativo: false
    },
    intervalo_almoco: {
      inicio: "12:00",
      fim: "14:00",
      ativo: true
    }
  });
  const [meetingCompromissosExistentes, setMeetingCompromissosExistentes] = useState<any[]>([]);
  const [meetingAgendaSelecionada, setMeetingAgendaSelecionada] = useState<any>(null);
  const [meetingTodasAgendas, setMeetingTodasAgendas] = useState<any[]>([]);
  const [meetingAgendaIdSelecionada, setMeetingAgendaIdSelecionada] = useState<string>("");
  const [enviarConfirmacaoReuniao, setEnviarConfirmacaoReuniao] = useState(true); // ⚡ Enviar confirmação por padrão
  const [enviarLembreteReuniao, setEnviarLembreteReuniao] = useState(true); // ⚡ Enviar lembrete por padrão
  const [horasAntecedenciaReuniaoHoras, setHorasAntecedenciaReuniaoHoras] = useState("1"); // ⚡ 1 hora padrão
  const [horasAntecedenciaReuniaoMinutos, setHorasAntecedenciaReuniaoMinutos] = useState("0"); // ⚡ 0 minutos padrão
  const [newTag, setNewTag] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState("");
  const [newResponsavel, setNewResponsavel] = useState("");
  const [newProduto, setNewProduto] = useState("");
  const [newValor, setNewValor] = useState("");
  const [newAnotacoes, setNewAnotacoes] = useState("");

  // Usuários da empresa (para Transferir Atendimento / Responsáveis)
  const [companyUsers, setCompanyUsers] = useState<{
    id: string;
    name: string;
  }[]>([]);
  // Filas de atendimento
  const [queues, setQueues] = useState<any[]>([]);
  // Fila selecionada e seus membros
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [queueMembers, setQueueMembers] = useState<{
    id: string;
    name: string;
  }[]>([]);
  // Dialog de transferência no header
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Estados para tarefas do lead
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("media");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Estados para funis e etapas do banco
  const [funis, setFunis] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState("");
  const [etapasFiltradas, setEtapasFiltradas] = useState<any[]>([]);
  const funnelStages = ["Novo", "Qualificado", "Em Negociação", "Fechado", "Perdido"];

  // Carregar funis e etapas ao montar o componente e quando userCompanyId mudar
  useEffect(() => {
    if (userCompanyId) {
      carregarFunisEEtapas();
    }
  }, [userCompanyId]);

  // ⚡ CORREÇÃO: Verificar e atualizar lead vinculado quando a conversa selecionada mudar
  useEffect(() => {
    if (selectedConv && userCompanyId) {
      verificarLeadVinculado(selectedConv);
      // 📋 Carregar protocolo ativo ao selecionar conversa
      const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
      if (telefone) {
        loadActiveProtocol(telefone);
      }
    } else {
      setLeadVinculado(null);
      setMostrarBotaoCriarLead(false);
    }
  }, [selectedConv?.id, userCompanyId]);

  // ⚡ CORREÇÃO: Atualizar informações do funil quando funis/etapas forem carregados e lead estiver vinculado
  useEffect(() => {
    if (leadVinculado?.funil_id && funis.length > 0 && etapas.length > 0) {
      const etapaInfo = leadVinculado.etapa_id ? etapas.find(e => e.id === leadVinculado.etapa_id) : null;
      const funilInfo = funis.find(f => f.id === leadVinculado.funil_id);
      console.log('📊 [FUNIL] Verificando exibição do funil:', {
        leadVinculado: !!leadVinculado,
        funil_id: leadVinculado.funil_id,
        etapa_id: leadVinculado.etapa_id,
        funilInfo: funilInfo?.nome || 'não encontrado',
        etapaInfo: etapaInfo?.nome || 'não encontrado',
        funisCarregados: funis.length,
        etapasCarregadas: etapas.length
      });
      if (funilInfo && selectedConv) {
        // Atualizar conversa selecionada com informações do funil
        if (etapaInfo) {
          setSelectedConv(prev => prev ? {
            ...prev,
            funnelStage: etapaInfo.nome
          } : null);
        }
      }
    }
  }, [funis, etapas, leadVinculado?.funil_id, leadVinculado?.etapa_id, selectedConv?.id]);

  // ⚡ CORREÇÃO: Carregar usuários da empresa SEMPRE (não apenas quando painel está aberto)
  useEffect(() => {
    if (!userCompanyId) return; // ⚡ Aguardar company_id estar disponível
    let channel: any;
    const loadCompanyUsers = async () => {
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar todos os usuários (ids) da empresa
        const {
          data: userRoles
        } = await supabase.from('user_roles').select('user_id').eq('company_id', userCompanyId); // ⚡ Usar userCompanyId diretamente

        const ids = (userRoles || []).map((ur: any) => ur.user_id);
        if (ids.length === 0) {
          setCompanyUsers([]);
          return;
        }

        // Buscar perfis para nomes
        const {
          data: profiles
        } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        const users = (profiles || []).map(p => ({
          id: p.id,
          name: (p.full_name || p.email) as string
        })).filter(u => !!u.name);
        console.log('👥 [USERS] Usuários da empresa carregados:', users.length, users);
        setCompanyUsers(users);
      } catch (e) {
        console.error('Erro ao carregar usuários da empresa:', e);
      }
    };
    loadCompanyUsers();

    // Assinatura realtime: alterações em user_roles da empresa → recarregar lista
    channel = supabase.channel(`company-users-realtime`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_roles'
    }, () => loadCompanyUsers()).subscribe();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userCompanyId]); // ⚡ Depender de userCompanyId ao invés de showInfoPanel

  // Assinar compromissos (agenda) em tempo real quando o painel estiver aberto
  useEffect(() => {
    if (!showInfoPanel || !leadVinculado?.id) return;
    const channel = supabase.channel(`compromissos-${leadVinculado.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'compromissos',
      filter: `lead_id=eq.${leadVinculado.id}`
    }, () => {
      // Recarregar reuniões do lead
      loadMeetings();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showInfoPanel, leadVinculado?.id]);

  // Carregar filas da empresa e assinar realtime quando o painel estiver aberto
  useEffect(() => {
    if (!showInfoPanel) return;
    let channel: any;
    const loadQueues = async () => {
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        if (!session) return;
        const {
          data: userRole
        } = await supabase.from('user_roles').select('company_id').eq('user_id', session.user.id).maybeSingle();
        if (!userRole?.company_id) return;
        const {
          data
        } = await supabase.from('support_queues').select('*').eq('company_id', userRole.company_id).eq('is_active', true).order('name', {
          ascending: true
        });
        setQueues(data || []);
      } catch (e) {
        console.error('Erro ao carregar filas:', e);
      }
    };
    loadQueues();
    channel = supabase.channel('support-queues-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_queues'
    }, () => loadQueues()).subscribe();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showInfoPanel]);

  // Auto-resize do textarea quando messageInput mudar
  useEffect(() => {
    if (messageTextareaRef.current) {
      messageTextareaRef.current.style.height = 'auto';
      if (messageInput) {
        messageTextareaRef.current.style.height = Math.min(messageTextareaRef.current.scrollHeight, 200) + 'px';
      }
    }
  }, [messageInput]);

  // Carregar membros da fila selecionada e assinar realtime
  useEffect(() => {
    if (!showInfoPanel || !selectedQueueId) return;
    let channel: any;
    const loadQueueMembers = async () => {
      try {
        // Buscar membros (user_id) da fila
        const {
          data: members
        } = await supabase.from('support_queue_members').select('user_id').eq('queue_id', selectedQueueId);
        const ids = (members || []).map((m: any) => m.user_id);
        if (ids.length === 0) {
          setQueueMembers([]);
          return;
        }
        const {
          data: profiles
        } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        const users = (profiles || []).map(p => ({
          id: p.id,
          name: (p.full_name || p.email) as string
        })).filter(u => !!u.name);
        setQueueMembers(users);
      } catch (e) {
        console.error('Erro ao carregar membros da fila:', e);
      }
    };
    loadQueueMembers();
    channel = supabase.channel(`queue-members-${selectedQueueId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_queue_members',
      filter: `queue_id=eq.${selectedQueueId}`
    }, () => loadQueueMembers()).subscribe();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showInfoPanel, selectedQueueId]);

  // Assinar atribuição da conversa atual (responsável/fila) para refletir transferências em tempo real
  useEffect(() => {
    if (!showInfoPanel || !selectedConv || !userCompanyId) return;
    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    const channel = supabase.channel(`conv-assign-${telefone}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_assignments',
      filter: `telefone_formatado=eq.${telefone}`
    }, async () => {
      // Buscar assignment atual
      const {
        data
      } = await supabase.from('conversation_assignments').select('*').eq('company_id', userCompanyId).eq('telefone_formatado', telefone).maybeSingle();
      if (!data) return;

      // Se houver fila, mostrar "Fila: <nome>", se houver usuário, mostrar o nome do usuário
      if (data.queue_id) {
        const q = queues.find(q => q.id === data.queue_id);
        if (q) {
          setSelectedConv(prev => prev ? {
            ...prev,
            responsavel: `Fila: ${q.name}`
          } : prev);
        }
      } else if (data.assigned_user_id) {
        // Buscar nome do usuário
        const {
          data: profile
        } = await supabase.from('profiles').select('full_name, email').eq('id', data.assigned_user_id).maybeSingle();
        const display = profile?.full_name || profile?.email || 'Agente';
        setSelectedConv(prev => prev ? {
          ...prev,
          responsavel: display
        } : prev);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showInfoPanel, selectedConv?.id, userCompanyId, queues]);
  const assignConversationToUser = async (userId: string, displayName: string) => {
    if (!selectedConv || !userCompanyId) return;
    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    try {
      await supabase.from('conversation_assignments').upsert({
        company_id: userCompanyId,
        telefone_formatado: telefone,
        assigned_user_id: userId,
        queue_id: null
      }, {
        onConflict: 'company_id,telefone_formatado'
      });

      // Atualizar localmente - INCLUIR assignedUser para que o filtro funcione
      setSelectedConv({
        ...selectedConv,
        responsavel: userId,
        // ID do responsável
        assignedUser: {
          id: userId,
          name: displayName
        } // Objeto completo
      });
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? {
        ...c,
        responsavel: userId,
        assignedUser: {
          id: userId,
          name: displayName
        }
      } : c));
      toast.success(`Atendimento transferido para ${displayName}`);
    } catch (e) {
      console.error('Erro ao atribuir conversa ao usuário:', e);
      toast.error('Erro ao transferir atendimento');
    }
  };
  const assignConversationToQueue = async (queueId: string, queueName: string) => {
    if (!selectedConv || !userCompanyId) return;
    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    try {
      await supabase.from('conversation_assignments').upsert({
        company_id: userCompanyId,
        telefone_formatado: telefone,
        queue_id: queueId,
        assigned_user_id: null
      }, {
        onConflict: 'company_id,telefone_formatado'
      });

      // Atualizar localmente - Limpar assignedUser quando vai para fila
      const label = `Fila: ${queueName}`;
      setSelectedConv({
        ...selectedConv,
        responsavel: label,
        assignedUser: undefined // Limpar quando vai para fila
      });
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? {
        ...c,
        responsavel: label,
        assignedUser: undefined
      } : c));
      toast.success(`Atendimento enviado para a fila ${queueName}`);
    } catch (e) {
      console.error('Erro ao atribuir conversa à fila:', e);
      toast.error('Erro ao transferir para fila');
    }
  };

  // Filtrar etapas quando funil é selecionado
  useEffect(() => {
    if (selectedFunilId) {
      const filtered = etapas.filter(e => e.funil_id === selectedFunilId);
      setEtapasFiltradas(filtered);
    } else {
      setEtapasFiltradas([]);
    }
  }, [selectedFunilId, etapas]);
  const carregarFunisEEtapas = async () => {
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) return;
      const {
        data: userRole
      } = await supabase.from("user_roles").select("company_id").eq("user_id", session.user.id).maybeSingle();
      if (!userRole?.company_id) return;

      // Carregar funis
      const {
        data: funisData,
        error: funisError
      } = await supabase.from("funis").select("*").eq("company_id", userRole.company_id).order("criado_em");
      if (!funisError && funisData) {
        console.log('📊 Funis carregados:', funisData.length);
        setFunis(funisData);
      }

      // Carregar etapas
      const {
        data: etapasData,
        error: etapasError
      } = await supabase.from("etapas").select("*").eq("company_id", userRole.company_id).order("posicao");
      if (!etapasError && etapasData) {
        console.log('📍 Etapas carregadas:', etapasData.length);
        setEtapas(etapasData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar funis e etapas:', error);
    }
  };
  const carregarTarefasDoLead = async (leadId: string) => {
    if (!leadId) {
      console.warn('⚠️ [TAREFAS] leadId não fornecido');
      setLeadTasks([]);
      return;
    }
    try {
      console.log('📋 [TAREFAS] Carregando tarefas para lead:', leadId);
      const {
        data: tasks,
        error
      } = await supabase.from('tasks').select('*').eq('lead_id', leadId).order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('❌ Erro ao carregar tarefas:', error);
        toast.error('Erro ao carregar tarefas');
        return;
      }
      console.log('✅ [TAREFAS] Tarefas carregadas:', tasks?.length || 0, tasks);
      console.log('✅ [TAREFAS] Detalhes das tarefas:', tasks?.map(t => ({
        id: t.id,
        title: t.title,
        lead_id: t.lead_id
      })));
      setLeadTasks(tasks || []);
      console.log('✅ [TAREFAS] Estado leadTasks atualizado com', tasks?.length || 0, 'tarefas');
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      toast.error('Erro ao carregar tarefas');
    }
  };

  // Carregar contagem de anexos do lead
  const carregarAttachmentsCount = async (leadId: string) => {
    if (!leadId) {
      setAttachmentsCount(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('lead_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId);
      
      if (!error) {
        setAttachmentsCount(count || 0);
      }
    } catch (err) {
      console.error('Erro ao carregar contagem de anexos:', err);
    }
  };

  const carregarBoardsEColumns = async () => {
    try {
      // Carregar boards
      const {
        data: boardsData,
        error: boardsError
      } = await supabase.from("task_boards").select("*").order("criado_em");
      if (boardsError) throw boardsError;
      setTaskBoards(boardsData || []);

      // Se houver boards, selecionar o primeiro por padrão
      if (boardsData && boardsData.length > 0 && !selectedTaskBoardId) {
        setSelectedTaskBoardId(boardsData[0].id);
      }

      // Carregar colunas
      const {
        data: columnsData,
        error: columnsError
      } = await supabase.from("task_columns").select("*").order("posicao");
      if (columnsError) throw columnsError;
      setTaskColumns(columnsData || []);
    } catch (error) {
      console.error("Erro ao carregar boards e colunas:", error);
      toast.error("Erro ao carregar quadros e etapas");
    }
  };

  // Sincronizar tarefas em tempo real quando o lead muda
  useEffect(() => {
    if (!leadVinculado?.id) {
      setLeadTasks([]);
      return;
    }

    // Carregar tarefas do lead
    carregarTarefasDoLead(leadVinculado.id);
    
    // Carregar contagem de anexos do lead
    carregarAttachmentsCount(leadVinculado.id);

    // Configurar subscrição em tempo real
    const channel = supabase.channel(`tasks-${leadVinculado.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `lead_id=eq.${leadVinculado.id}`
    }, payload => {
      console.log('📡 Atualização de tarefa em tempo real:', payload);
      if (payload.eventType === 'INSERT') {
        setLeadTasks(prev => [payload.new as any, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setLeadTasks(prev => prev.map(task => task.id === payload.new.id ? payload.new as any : task));
      } else if (payload.eventType === 'DELETE') {
        setLeadTasks(prev => prev.filter(task => task.id !== payload.old.id));
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadVinculado?.id]);

  // Função para recarregar dados do lead vinculado
  const recarregarLeadVinculado = async (conversaId: string) => {
    try {
      const conversa = conversations.find(c => c.id === conversaId);
      if (!conversa) return;
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
      if (!userRole?.company_id) return;
      const phoneToSearch = conversa.phoneNumber || conversa.id;
      const phoneFormatted = safeFormatPhoneNumber(phoneToSearch);

      // Buscar lead pelo telefone (incluindo nome do produto)
      const {
        data: leadData,
        error
      } = await supabase.from('leads').select('*, produtos_servicos(nome)').eq('company_id', userRole.company_id).or(`phone.eq.${phoneFormatted},telefone.eq.${phoneFormatted}`).maybeSingle();
      
      // Mapear nome do produto para facilitar acesso
      const leadWithProduto = leadData ? {
        ...leadData,
        produto_nome: (leadData as any).produtos_servicos?.nome || null
      } : null;
      if (error || !leadData) {
        console.error('❌ Erro ao buscar lead:', error);
        return;
      }
      console.log('✅ Lead encontrado:', leadData);

      // Pegar o telefone do lead (pode estar em 'phone' ou 'telefone')
      const leadPhone = leadData.phone || leadData.telefone;
      if (!leadPhone) {
        return;
      }

      // Formatar o telefone removendo caracteres especiais
      const phoneFormatted2 = leadPhone.replace(/\D/g, '');

      // Buscar conversa existente no Supabase (ISOLADO POR EMPRESA)
      const {
        data: conversasData
      } = await supabase.from('conversas').select('*').eq('company_id', userCompanyId).eq('telefone_formatado', phoneFormatted2).order('created_at', {
        ascending: false
      });
      if (conversasData && conversasData.length > 0) {
        // Encontrou conversas, carregar todas e selecionar a primeira
        console.log(`📱 ${conversasData.length} conversa(s) encontrada(s) para o lead`);

        // Agrupar mensagens por número
        const conversationsMap = new Map<string, Conversation>();
        for (const msg of conversasData) {
          const convId = msg.telefone_formatado || msg.numero;
          if (!conversationsMap.has(convId)) {
            const numeroLimpo = String(msg.numero || '').replace(/\D/g, '');
            const isRealGroup = Boolean((msg as any)?.is_group) || numeroLimpo.length >= 17 && /@g\.us$/.test(String(msg.numero || ''));
            conversationsMap.set(convId, {
              id: convId,
              contactName: (() => {
                const rawName = leadData.name || msg.nome_contato || 'Desconhecido';
                const isIg = msg.origem?.toLowerCase() === 'instagram';
                if (isIg && (/^\d{10,}$/.test(rawName) || /^Instagram\s+\d+$/i.test(rawName))) return `Instagram ${(msg.telefone_formatado || msg.numero || '').slice(-6)}`;
                return rawName;
              })(),
              // PRIORIZAR NOME DO LEAD
              channel: msg.origem?.toLowerCase() === 'whatsapp' ? 'whatsapp' : msg.origem?.toLowerCase() === 'instagram' ? 'instagram' : 'facebook',
              status: msg.status === 'Enviada' ? 'answered' : 'waiting',
              lastMessage: msg.mensagem || '',
              unread: 0,
              isGroup: isRealGroup,
              messages: [],
              tags: leadData.tags || [],
              funnelStage: leadData.stage,
              responsavel: 'Sem responsável',
              produto: leadData.servico,
              valor: leadData.value ? `R$ ${Number(leadData.value).toLocaleString('pt-BR')}` : undefined,
              phoneNumber: convId
            });
          }
          const conv = conversationsMap.get(convId)!;

          // Adicionar mensagem
          const isFromMe = msg.fromme === true;
          let sentBy: string | undefined = undefined;

          // ⚡ CORREÇÃO: Buscar nome do usuário que enviou
          if (isFromMe && msg.owner_id) {
            const {
              data: profile
            } = await supabase.from('profiles').select('full_name, email').eq('id', msg.owner_id).single();
            if (profile) {
              sentBy = profile.full_name || profile.email || 'Usuário';
            }
          }
          const msgType = msg.tipo_mensagem === 'image' ? 'image' : msg.tipo_mensagem === 'audio' ? 'audio' : msg.tipo_mensagem === 'video' ? 'video' : msg.tipo_mensagem === 'document' || msg.tipo_mensagem === 'pdf' ? 'pdf' : msg.tipo_mensagem === 'contact' ? 'contact' : 'text';
          const contactDataParsed = msgType === 'contact' ? parseContactData(msg.mensagem || '') : undefined;
          const deliveryState = getMessageDeliveryState(msg);
          const message: Message = {
            id: msg.id,
            content: msgType === 'contact' ? (contactDataParsed ? `📇 Contato: ${contactDataParsed.name}` : msg.mensagem || '') : (msg.mensagem || ''),
            type: msgType,
            sender: isFromMe ? 'user' : 'contact',
            timestamp: new Date(msg.created_at),
            delivered: deliveryState.delivered,
            read: deliveryState.read,
            status: deliveryState.status,
            mediaUrl: msg.midia_url,
            fileName: msg.arquivo_nome,
            fileSize: extractFileSizeFromMediaUrl(msg.midia_url),
            mimeType: msg.tipo_mensagem === 'video' ? 'video/mp4' : msg.tipo_mensagem === 'audio' ? 'audio/mpeg' : msg.tipo_mensagem === 'image' ? 'image/jpeg' : msg.tipo_mensagem === 'document' || msg.tipo_mensagem === 'pdf' ? 'application/pdf' : undefined,
            sentBy: sentBy,
            contactData: contactDataParsed
          };
          conv.messages.push(message);

          // Atualizar última mensagem
          if (new Date(msg.created_at) > new Date(conv.lastMessage)) {
            conv.lastMessage = msg.mensagem || '';
          }
        }

        // Converter para array e ordenar mensagens
        const loadedConversations = Array.from(conversationsMap.values()).map(conv => ({
          ...conv,
          messages: conv.messages.sort((a, b) => {
            // ⚡ CORREÇÃO: Garantir que timestamp seja Date antes de chamar getTime()
            const aTimestamp = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
            const bTimestamp = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
            return aTimestamp.getTime() - bTimestamp.getTime();
          })
        }));

        // Adicionar ou atualizar no estado
        setConversations(prev => {
          const updated = [...prev];
          for (const newConv of loadedConversations) {
            const existingIndex = updated.findIndex(c => c.id === newConv.id);
            if (existingIndex >= 0) {
              updated[existingIndex] = newConv;
            } else {
              updated.unshift(newConv);
            }
          }
          return updated;
        });

        // Selecionar a primeira conversa
        const conversationToSelect = loadedConversations[0];
        setSelectedConv(conversationToSelect);
        setLeadVinculado(leadData);
        toast.success(`Conversa de ${leadData.name} aberta`);
      } else {
        // Não encontrou conversa, criar uma nova
        console.log('📝 Nenhuma conversa encontrada, criando nova...');
        const newConv: Conversation = {
          id: phoneFormatted2,
          contactName: leadData.name,
          channel: "whatsapp",
          status: "waiting",
          lastMessage: "Nova conversa",
          unread: 0,
          messages: [],
          tags: leadData.tags || [],
          funnelStage: leadData.stage,
          responsavel: 'Sem responsável',
          produto: leadData.servico,
          valor: leadData.value ? `R$ ${Number(leadData.value).toLocaleString('pt-BR')}` : undefined,
          phoneNumber: phoneFormatted2
        };
        setConversations(prev => [newConv, ...prev]);
        setSelectedConv(newConv);
        setLeadVinculado(leadData);
        toast.success(`Nova conversa com ${leadData.name} iniciada`);
      }
    } catch (error) {
      console.error('❌ Erro ao recarregar lead vinculado:', error);
    }
  };

  // useEffect para lidar com redirecionamento de leads
  useEffect(() => {
    // FIXME: handleLeadRedirect não definida
    // setTimeout(() => {
    //   handleLeadRedirect();
    // }, 1000);

    // Verificar se veio de um lead (query param - manter compatibilidade)
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    const nameParam = urlParams.get('name');
    if (phoneParam) {
      // Formatar número com +55
      const formattedPhone = phoneParam.startsWith('55') ? phoneParam : '55' + phoneParam;

      // Buscar ou criar conversa com este número
      setTimeout(() => {
        const existingConv = conversations.find(c => c.id === formattedPhone || c.phoneNumber === formattedPhone);
        if (existingConv) {
          setSelectedConv(existingConv);
        } else {
          // Criar nova conversa
          const newConv: Conversation = {
            id: formattedPhone,
            contactName: nameParam || formattedPhone,
            channel: "whatsapp",
            status: "waiting",
            lastMessage: "Nova conversa",
            unread: 0,
            messages: [],
            tags: [],
            phoneNumber: formattedPhone
          };
          setConversations(prev => [newConv, ...prev]);
          setSelectedConv(newConv);
        }

        // Limpar query params
        window.history.replaceState({}, '', '/conversas');
      }, 500);
    }
  }, [location, conversations, userCompanyId]);

  // ⚡ CARREGAMENTO INSTANTÂNEO: Carregar conversas imediatamente
  useEffect(() => {
    // ⚡ PASSO 1: Carregar do banco SEMPRE primeiro para obter userCompanyId
    const loadInitialData = async () => {
      // Se já está carregando ou já carregou, não fazer nada
      if (loadingConversations || initialLoadRef.current) return;
      try {
        // ⚡ CORREÇÃO CRÍTICA: Primeiro obter o company_id do usuário atual
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          console.warn('⚠️ [LOAD] Usuário não autenticado');
          return;
        }
        const {
          data: userRole
        } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
        if (!userRole?.company_id) {
          console.warn('⚠️ [LOAD] Usuário sem empresa associada');
          return;
        }
        const currentCompanyId = userRole.company_id;

        // Buscar segmento e is_master_account da empresa
        const { data: companyData } = await supabase
          .from('companies')
          .select('segmento, is_master_account')
          .eq('id', currentCompanyId)
          .maybeSingle();
        if (companyData) {
          setCompanySegmento(companyData.segmento);
          setIsMasterAccount(!!companyData.is_master_account);
        }

        // ⚡ CORREÇÃO CRÍTICA: Verificar se o cache é da MESMA empresa
        const cachedCompanyId = sessionStorage.getItem(CONVERSATIONS_CACHE_COMPANY_KEY);
        const cachedData = sessionStorage.getItem(CONVERSATIONS_CACHE_KEY);
        const cacheTimestamp = sessionStorage.getItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);

        // Se cache é de outra empresa, LIMPAR TUDO
        if (cachedCompanyId && cachedCompanyId !== currentCompanyId) {
          console.log(`🗑️ [CACHE] Cache de outra empresa (${cachedCompanyId}) - limpando...`);
          sessionStorage.removeItem(CONVERSATIONS_CACHE_KEY);
          sessionStorage.removeItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
          sessionStorage.removeItem(CONVERSATIONS_CACHE_COMPANY_KEY);
        } else if (cachedData && cacheTimestamp && cachedCompanyId === currentCompanyId) {
          // Cache é da mesma empresa, verificar idade
          const age = Date.now() - parseInt(cacheTimestamp, 10);
          if (age < CACHE_MAX_AGE) {
            const cachedConversations = JSON.parse(cachedData);
            const restoredConversations = cachedConversations.map((conv: any) => ({
              ...conv,
              messages: (conv.messages || []).map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
              }))
            }));
            console.log(`⚡ [CACHE] ${restoredConversations.length} conversas carregadas do cache (company: ${currentCompanyId})`);
            setConversations(restoredConversations);
          }
        }

        // Atualizar state com company_id
        setUserCompanyId(currentCompanyId);
        userCompanyIdRef.current = currentCompanyId;

        // Agora carregar do banco
        console.log('⚡ [LOAD] Carregando conversas para company:', currentCompanyId);
        await loadSupabaseConversations();
        initialLoadRef.current = true;
        console.log('✅ [LOAD] Conversas carregadas');
      } catch (error) {
        console.error('❌ [LOAD] Erro ao carregar:', error);
      }
    };
    loadInitialData();
  }, []); // ⚡ Executar apenas uma vez no mount

  // Fallback: polling com jitter enquanto desconectado (OTIMIZADO)
  useEffect(() => {
    // ⚡ CORREÇÃO: Só fazer polling se realmente desconectado E se já carregou inicialmente
    if (realtimeConnectionStatus === 'connected' || !initialLoadRef.current) return;
    const schedule = () => {
      const jitter = 15000 + Math.floor(Math.random() * 5000); // 15-20s (aumentado para reduzir carga)
      pollingTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('⏱️ [FALLBACK] Polling de conversas (jitter)');
          // ⚡ CORREÇÃO: Não chamar loadSupabaseConversations se já está carregando
          if (!loadingConversations) {
            await loadSupabaseConversations();
          }
        } finally {
          if (realtimeConnectionStatus === 'disconnected' || realtimeConnectionStatus === 'error') {
            schedule();
          }
        }
      }, jitter);
    };
    schedule();
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [realtimeConnectionStatus]);
  useEffect(() => {
    scrollToBottom();
  }, [selectedConv?.messages]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };

  // ⚡ HELPER: Atualizar conversas e cache simultaneamente
  const updateConversationsWithCache = useCallback((updater: (prev: Conversation[]) => Conversation[]) => {
    setConversations(prev => {
      const updated = updater(prev);
      // Salvar no cache imediatamente COM company_id
      try {
        sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(updated));
        sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
        // ⚡ CORREÇÃO: Salvar company_id no cache para validação futura
        if (userCompanyIdRef.current) {
          sessionStorage.setItem(CONVERSATIONS_CACHE_COMPANY_KEY, userCompanyIdRef.current);
        }
      } catch (e) {
        // Ignorar erros de cache (pode estar cheio)
      }
      return updated;
    });
  }, []);
  const loadConversations = () => {
    // Não carregar do localStorage - dados vêm apenas do Supabase
    // Manter conversas iniciais apenas como fallback temporário
    setConversations(initialConversations);
  };

  // 🆕 RESTAURAR CONVERSA ANTIGA - Puxa histórico do WhatsApp via Evolution API
  const handleRestoreConversation = async () => {
    if (!selectedConv?.phoneNumber || !userCompanyId) {
      toast.error("Número de telefone ou empresa inválidos");
      return;
    }
    try {
      setRestoringConversation(true);
      setRestoreProgress({ step: 10, label: "Conectando ao WhatsApp..." });
      console.log("🔄 Puxando histórico do WhatsApp:", selectedConv.phoneNumber);
      
      setRestoreProgress({ step: 35, label: "Buscando 200 mensagens..." });
      // Buscar mensagens via edge function (seguro, sem CORS)
      const messages = await evolutionAPI.getMessages(userCompanyId, selectedConv.phoneNumber, 200);
      
      if (messages.length === 0) {
        toast.info("Nenhuma mensagem encontrada no WhatsApp para este número");
        return;
      }
      
      setRestoreProgress({ step: 70, label: `Processando ${messages.length} mensagens encontradas...` });
      await new Promise(r => setTimeout(r, 300)); // pequena pausa visual
      
      setRestoreProgress({ step: 90, label: "Salvando no banco de dados..." });
      // Salvar mensagens no banco
      await evolutionAPI.saveMessagesToDatabase(messages, userCompanyId, leadVinculado?.id);
      
      setRestoreProgress({ step: 100, label: "Concluído!" });
      await new Promise(r => setTimeout(r, 500)); // mostrar 100% por um momento

      const enviadas = messages.filter((m: any) => m.key?.fromMe === true || m._originalFromMe === true).length;
      const recebidas = messages.filter((m: any) => m.key?.fromMe === false && m._originalFromMe !== true).length;
      toast.success(`${messages.length} mensagens restauradas! (${enviadas} enviadas, ${recebidas} recebidas)`);

      // Recarregar conversas para exibir as novas mensagens
      await loadSupabaseConversations();
      setIsContactInactive(false);
    } catch (error) {
      console.error("❌ Erro ao restaurar conversa:", error);
      toast.error("Erro ao restaurar histórico. Verifique a conexão WhatsApp.");
    } finally {
      setRestoringConversation(false);
      setRestoreProgress(null);
    }
  };

  // 🆕 VERIFICAR SE CONTATO ESTÁ INATIVO (30+ DIAS)
  useEffect(() => {
    if (!selectedConv) {
      setIsContactInactive(false);
      return;
    }
    const messages = selectedConv.messages || [];
    if (messages.length === 0) {
      setIsContactInactive(true);
      return;
    }
    const lastMessage = messages[messages.length - 1];
    const lastMessageDate = new Date(lastMessage.timestamp);
    const daysSinceLastMessage = Math.floor((Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));
    setIsContactInactive(daysSinceLastMessage >= 30);
  }, [selectedConv]);
  const loadSupabaseConversations = async (append: boolean = false) => {
    if (loadingConversations) return;

    // ⚡ OTIMIZAÇÃO: NUNCA bloquear a UI com loading spinner
    // Conversas existentes (cache ou já carregadas) são exibidas imediatamente
    try {
      const startTime = performance.now();

      // ⚡ OTIMIZAÇÃO: Usar company_id em cache se disponível
      let companyId = userCompanyId || userCompanyIdRef.current;

      // ETAPA 1: Buscar user e company_id (apenas se não tiver cache)
      let currentUser: any = null;
      if (!companyId) {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Você precisa estar logado');
          setLoadingConversations(false);
          return;
        }
        currentUser = user;
        setCurrentUserId(user.id);
        const {
          data: userRole
        } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
        if (!userRole?.company_id) {
          toast.error('Erro: Usuário sem empresa associada');
          setLoadingConversations(false);
          return;
        }
        companyId = userRole.company_id;
        setUserCompanyId(companyId);
        userCompanyIdRef.current = companyId;

        // Carregar nome do usuário do perfil
        const {
          data: profileData
        } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
        if (profileData) {
          setUserName(profileData.full_name || profileData.email || 'Usuário');
        }
      } else {
        // Se já tem companyId, buscar user para verificar responsável
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          currentUser = user;
          setCurrentUserId(user.id);

          // Carregar nome do usuário se ainda não tiver
          if (!userName) {
            const {
              data: profileData
            } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
            if (profileData) {
              setUserName(profileData.full_name || profileData.email || 'Usuário');
            }
          }
        }
      }

      // ⚡ CORREÇÃO: Buscar instagram_account_id para filtrar ecos de mensagens enviadas
      let instagramPageAccountId: string | null = null;
      try {
        const { data: igConn } = await supabase
          .from('whatsapp_connections')
          .select('instagram_account_id')
          .eq('company_id', companyId)
          .not('instagram_account_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (igConn?.instagram_account_id) {
          instagramPageAccountId = igConn.instagram_account_id;
          console.log('📸 [LOAD] Instagram Page Account ID:', instagramPageAccountId);
        }
      } catch (e) {
        // Silently continue
      }

      // ⚡ OTIMIZAÇÃO: Carregamento balanceado entre velocidade e completude
      const MESSAGES_PER_CONVERSATION = 5; // Reduzido para 5 (carrega mais depois)

      // ⚡ CORREÇÃO CRÍTICA: Aumentar limite para buscar mais mensagens/conversas
      // Para append, buscar 1000 mensagens para garantir que encontre novas conversas
      // Para carga inicial, buscar 500 mensagens
      const MESSAGES_TO_FETCH = append ? 1000 : 500;

      // ⚡ OTIMIZAÇÃO: Query com campos essenciais (midia_url necessário para exibir mídias)
      // ⚡ CORREÇÃO: Incluir campos read e delivered para exibir status de visualização
      let query = supabase.from('conversas').select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, sent_by, owner_id, arquivo_nome, midia_url, read, delivered, origem, origem_api').eq('company_id', companyId).order('created_at', {
        ascending: false
      });

      // ⚡ CORREÇÃO: Para append, usar offset baseado no número de conversas já carregadas
      // Em vez de buscar por data, usar paginação real com offset
      if (append && conversations.length > 0) {
        // Contar quantas mensagens já temos carregadas para usar como offset
        const totalMensagensCarregadas = conversations.reduce((acc, c) => acc + c.messages.length, 0);
        console.log(`📊 [APPEND] Total mensagens já carregadas: ${totalMensagensCarregadas}, usando como offset`);

        // Usar range para paginação real
        query = query.range(totalMensagensCarregadas, totalMensagensCarregadas + MESSAGES_TO_FETCH - 1);
      } else {
        query = query.limit(MESSAGES_TO_FETCH);
      }
      const {
        data: conversasResult,
        error: conversasError
      } = await query;
      let conversasData: any[] = [];
      if (conversasError) {
        console.error('❌ [LOAD] Erro ao carregar conversas:', conversasError);
        // ⚡ CORREÇÃO: Não mostrar toast de erro se for apenas um problema temporário
        // Apenas logar o erro para debug
        console.warn('⚠️ [LOAD] Erro ao carregar conversas do banco, tentando continuar...');
        setLoadingConversations(false);
        // Continuar com array vazio para não quebrar a interface
        conversasData = [];
      } else {
        conversasData = conversasResult || [];
      }

      // ⚡ CORREÇÃO CRÍTICA: Log detalhado para debug
      const mensagensEnviadas = conversasData.filter(c => c.fromme === true || c.fromme === 'true').length;
      const mensagensRecebidas = conversasData.filter(c => c.fromme === false || c.fromme === 'false' || c.fromme === null || c.fromme === undefined).length;
      const mensagensSemFromme = conversasData.filter(c => c.fromme === null || c.fromme === undefined).length;
      console.log(`📊 [LOAD] Carregadas ${conversasData.length} mensagens do banco`, {
        companyId,
        mensagensEnviadas,
        mensagensRecebidas,
        mensagensSemFromme,
        primeiraMensagem: conversasData[0] ? {
          id: conversasData[0].id,
          numero: conversasData[0].numero,
          telefone_formatado: conversasData[0].telefone_formatado,
          fromme: conversasData[0].fromme,
          frommeType: typeof conversasData[0].fromme,
          status: conversasData[0].status,
          mensagem: conversasData[0].mensagem?.substring(0, 50),
          created_at: conversasData[0].created_at
        } : null,
        exemploRecebida: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme) ? {
          id: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.id,
          fromme: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.fromme,
          mensagem: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.mensagem?.substring(0, 50)
        } : null
      });

      // ⚡ CORREÇÃO: Verificar se há mais conversas para carregar
      // Se retornou exatamente o limite, provavelmente há mais mensagens no banco
      const hasMoreMessages = conversasData.length === MESSAGES_TO_FETCH;
      if (!append && hasMoreMessages) {
        console.log(`⚠️ [LOAD] Retornou exatamente ${MESSAGES_TO_FETCH} mensagens - pode haver mais no banco`);
        setHasMoreConversations(true); // Garantir que o botão "carregar mais" apareça
      }

      // ⚡ CORREÇÃO CRÍTICA: FILTROS RIGOROSOS para prevenir bugs e mensagens de outras instâncias
      const validConversas = conversasData.filter(conv => {
        // VALIDAÇÃO 1: company_id DEVE ser exatamente igual (CRÍTICO para prevenir mensagens de outras instâncias)
        // ⚡ CORREÇÃO: Aceitar mensagens sem company_id (mensagens antigas) ou com company_id correto
        if (conv.company_id && conv.company_id !== userCompanyIdRef.current) {
          console.warn(`🚫 [FILTRO CRÍTICO] Mensagem de outra company bloqueada: ${conv.company_id} (esperado: ${userCompanyIdRef.current})`);
          return false;
        }

        // VALIDAÇÃO 2: Número obrigatório
        if (!conv.numero || conv.numero.trim() === '') {
          return false;
        }

        // VALIDAÇÃO 3: BLOQUEAR telefones malformados/corrompidos de outras instâncias
        const telefoneNormalizado = conv.telefone_formatado?.replace(/[^0-9]/g, '') || conv.numero?.replace(/[^0-9]/g, '') || '';

        // ⚡ CORREÇÃO: Filtrar ecos de mensagens do Instagram (page ID como contato)
        if (instagramPageAccountId && telefoneNormalizado === instagramPageAccountId) {
          console.log('🚫 [FILTRO] Eco de Instagram (page account ID) filtrado:', telefoneNormalizado);
          return false;
        }

        // ⚡ CORREÇÃO: Permitir Instagram (IDs numéricos longos) e telefones brasileiros
        // Instagram usa IDs numéricos de 15-20 dígitos como identificador
        const isInstagram = conv.origem === 'Instagram' || conv.origem_api === 'meta' && telefoneNormalizado.length > 13;
        if (telefoneNormalizado.length > 0 && !isInstagram) {
          if (telefoneNormalizado.length < 11 || telefoneNormalizado.length > 13) {
            console.warn(`🚫 [FILTRO CRÍTICO] Telefone malformado/outra instância bloqueado: ${telefoneNormalizado} (${telefoneNormalizado.length} dígitos) - company: ${conv.company_id}`);
            return false;
          }
        }

        // ⚡ VALIDAÇÃO 4: Aceitar mensagens mesmo sem texto (pode ser apenas mídia)
        if (!conv.mensagem || conv.mensagem.trim() === '') {
          // Verificar se tem mídia - se tiver, aceitar mesmo sem texto
          if (conv.midia_url || conv.tipo_mensagem !== 'text') {
            return true; // Aceitar mídia sem texto
          }
          return false; // Rejeitar apenas se não tem nem mensagem nem mídia
        }
        return true; // Aceitar todas as outras mensagens válidas
      });
      console.log(`📊 [LOAD] ${validConversas.length} mensagens válidas de ${conversasData.length} total`, {
        mensagensRecebidas: validConversas.filter(c => c.fromme === false || !c.fromme).length,
        mensagensEnviadas: validConversas.filter(c => c.fromme === true).length,
        porNumero: validConversas.reduce((acc, c) => {
          const num = c.telefone_formatado || c.numero;
          acc[num] = (acc[num] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      // Agrupar conversas por telefone - PRESERVAR TODAS as mensagens (não limitar)
      // ⚡ CORREÇÃO CRÍTICA: Para grupos, SEMPRE usar o numero (JID do grupo) como chave
      // Nunca usar telefone_formatado para grupos, pois pode conter número do integrante
      const conversasMap = new Map<string, any[]>();

      // ⚡ LOG: Debug de agrupamento
      console.log(`📊 [LOAD] Agrupando ${validConversas.length} mensagens válidas...`);

      // Função auxiliar para normalizar número de forma consistente
      const normalizePhoneForGrouping = (num: string | null | undefined): string => {
        if (!num) return '';
        // Remover caracteres não numéricos
        const digits = String(num).replace(/[^0-9]/g, '');
        // Garantir código do país para números brasileiros
        if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
          return `55${digits}`;
        }
        return digits;
      };
      validConversas.forEach(conv => {
        // ⚡ CORREÇÃO CRÍTICA: Detectar se é grupo de MÚLTIPLAS formas
        // Verificar is_group OU se numero contém @g.us em qualquer posição
        const isGroup = Boolean(conv.is_group) === true || /@g\.us/i.test(String(conv.numero || ''));

        // ⚡ CORREÇÃO CRÍTICA: Para grupos, SEMPRE usar numero (JID completo do grupo)
        // Para contatos individuais, normalizar telefone para garantir agrupamento correto
        let key: string;
        if (isGroup) {
          key = String(conv.numero || ''); // SEMPRE usar numero para grupos (contém JID do grupo)
        } else {
          // ⚡ CORREÇÃO: Detectar mensagens do Instagram (não são telefones)
          const isInstagramMsg = conv.origem === 'Instagram' || (conv.origem_api === 'meta' && String(conv.telefone_formatado || conv.numero || '').replace(/[^0-9]/g, '').length > 13);
          
          if (isInstagramMsg) {
            // Instagram usa IDs numéricos como identificador - usar diretamente
            key = `ig_${conv.telefone_formatado || conv.numero || 'unknown'}`;
          } else {
            // ⚡ CORREÇÃO CRÍTICA: Normalizar telefone de forma ULTRA flexível
            const telefoneFormatado = conv.telefone_formatado || '';
            const numeroOriginal = conv.numero || '';
            let telefoneNormalizado = telefoneFormatado ? telefoneFormatado.replace(/[^0-9]/g, '') : numeroOriginal.replace(/[^0-9]/g, '');

            if (telefoneNormalizado.length >= 10) {
              key = telefoneNormalizado.startsWith('55') ? telefoneNormalizado : `55${telefoneNormalizado}`;
            } else if (telefoneNormalizado.length > 0) {
              key = telefoneNormalizado;
            } else {
              key = numeroOriginal || telefoneFormatado || 'unknown';
            }
          }
        }

        // ⚡ LOG: Debug de cada mensagem sendo agrupada
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta (pode ser boolean, string, null, undefined)
        const isReceived = conv.fromme === false || conv.fromme === 'false' || conv.fromme === null || conv.fromme === undefined;
        if (isReceived) {
          console.log('📥 [LOAD] Mensagem RECEBIDA sendo agrupada:', {
            id: conv.id,
            numero: conv.numero,
            telefone_formatado: conv.telefone_formatado,
            key: key,
            nome_contato: conv.nome_contato,
            fromme: conv.fromme,
            frommeType: typeof conv.fromme,
            status: conv.status,
            mensagem: conv.mensagem?.substring(0, 30)
          });
        }
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        const mensagens = conversasMap.get(key)!;
        mensagens.push(conv);
        // ⚡ CORREÇÃO CRÍTICA: NÃO limitar mensagens aqui - preservar todas para não perder histórico
        // Apenas ordenar por data (mais recente primeiro)
        mensagens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      // ⚡ CORREÇÃO: Log de agrupamento para debug
      const conversasAgrupadas = Array.from(conversasMap.entries());
      const grupos = conversasAgrupadas.filter(([k]) => /@g\.us$/.test(k));
      const contatos = conversasAgrupadas.filter(([k]) => !/@g\.us$/.test(k));
      console.log(`📊 [LOAD] Agrupadas ${conversasMap.size} conversas únicas de ${validConversas.length} mensagens`, {
        grupos: grupos.length,
        contatos: contatos.length,
        detalhesContatos: contatos.map(([key, msgs]) => ({
          key,
          totalMensagens: msgs.length,
          mensagensRecebidas: msgs.filter(m => m.fromme === false || !m.fromme).length,
          mensagensEnviadas: msgs.filter(m => m.fromme === true).length,
          primeiraMensagem: msgs[0] ? {
            numero: msgs[0].numero,
            telefone_formatado: msgs[0].telefone_formatado,
            nome_contato: msgs[0].nome_contato,
            fromme: msgs[0].fromme
          } : null
        }))
      });

      // ⚡ CORREÇÃO: Buscar leads de TODOS os telefones encontrados (sem limite)
      // Remover slice para garantir que todos os leads sejam encontrados
      const telefonesUnicos = Array.from(conversasMap.keys()).map(tel => tel.replace(/[^0-9]/g, '')).filter(tel => tel.length >= 10);
      // Removido .slice(0, 50) para buscar leads de TODAS as conversas

      // Buscar leads de forma otimizada usando queries mais eficientes
      let leadsData: any[] = [];
      if (telefonesUnicos.length > 0) {
        // ⚡ OTIMIZAÇÃO: Buscar leads usando .or() com múltiplos telefones de uma vez
        // Construir condições para busca otimizada
        const phoneConditions: string[] = [];
        telefonesUnicos.forEach(tel => {
          if (tel && tel.length >= 10) {
            phoneConditions.push(`phone.ilike.%${tel}%`);
            phoneConditions.push(`telefone.ilike.%${tel}%`);
          }
        });
        if (phoneConditions.length > 0) {
          // ⚡ CORREÇÃO: Buscar leads em lotes maiores para garantir que todos sejam encontrados
          // Processar em lotes de 100 condições para evitar query muito longa
          const BATCH_SIZE = 100;
          let allLeads: any[] = [];
          for (let i = 0; i < phoneConditions.length; i += BATCH_SIZE) {
            const batch = phoneConditions.slice(i, i + BATCH_SIZE);
            const orCondition = batch.join(',');
            const leadsResult = await supabase.from('leads').select('id, phone, name, telefone, tags, profile_picture_url').eq('company_id', companyId).or(orCondition).limit(500); // Limite maior por lote

            if (!leadsResult.error && leadsResult.data) {
              allLeads = [...allLeads, ...leadsResult.data];
            }
          }
          leadsData = allLeads;
        }
      }
      console.log(`📊 [LOAD] ${conversasData.length} mensagens processadas, ${conversasMap.size} conversas únicas, ${leadsData.length} leads encontrados`);

      // ETAPA 3.5: Buscar nomes dos usuários que enviaram mensagens (para exibir quem respondeu)
      const ownerIds = new Set<string>();
      conversasData.forEach(msg => {
        if (msg.owner_id && msg.fromme === true) {
          ownerIds.add(msg.owner_id);
        }
      });
      const ownerNamesMap = new Map<string, string>();

      // ⚡ CORREÇÃO: Sempre adicionar o usuário atual ao mapa
      const {
        data: {
          user: authUser
        }
      } = await supabase.auth.getUser();
      if (authUser) {
        const {
          data: currentProfile
        } = await supabase.from('profiles').select('id, full_name, email').eq('id', authUser.id).single();
        if (currentProfile) {
          ownerNamesMap.set(currentProfile.id, currentProfile.full_name || currentProfile.email || 'Você');
          console.log('✅ [LOAD] Usuário atual adicionado ao mapa:', currentProfile.full_name || currentProfile.email);
        }
      }

      // Buscar nomes dos outros usuários que enviaram mensagens
      if (ownerIds.size > 0) {
        const {
          data: profilesData
        } = await supabase.from('profiles').select('id, full_name, email').in('id', Array.from(ownerIds));
        if (profilesData) {
          profilesData.forEach(profile => {
            ownerNamesMap.set(profile.id, profile.full_name || profile.email || 'Usuário');
          });
        }
        console.log(`👥 [LOAD] ${ownerNamesMap.size} nomes de usuários carregados para mensagens`, {
          usuários: Array.from(ownerNamesMap.entries()).map(([id, nome]) => ({
            id: id.substring(0, 8),
            nome
          }))
        });
      }

      // ⚡ CORREÇÃO CRÍTICA: Deduplicar conversas ANTES de criar leads
      // Estratégia: Agrupar por NOME DE CONTATO primeiro, depois por telefone normalizado
      // Isso garante que mensagens do mesmo contato com números diferentes sejam mescladas

      // ETAPA 1: Criar mapa de nome -> telefones para detectar duplicatas por nome
      const nomeParaTelefones = new Map<string, Set<string>>();
      conversasMap.forEach((msgs, key) => {
        // Pegar nome do contato (ignorar nomes que são apenas o telefone/ID)
        const keyDigits = key.replace(/[^0-9]/g, '');
        const nomeContato = msgs.find(m => {
          const nome = m.nome_contato?.trim();
          if (!nome) return false;
          // Ignorar nomes que são apenas números (telefone/ID)
          const nomeDigits = nome.replace(/[^0-9]/g, '');
          return nome !== key && nome !== keyDigits && !(nomeDigits.length > 8 && nomeDigits === nome);
        })?.nome_contato?.trim();
        if (nomeContato && nomeContato !== key) {
          if (!nomeParaTelefones.has(nomeContato)) {
            nomeParaTelefones.set(nomeContato, new Set());
          }
          nomeParaTelefones.get(nomeContato)!.add(key);
        }
      });

      // ETAPA 2: Detectar telefones que devem ser mesclados (mesmo nome)
      const telefoneMergeMap = new Map<string, string>(); // telefone duplicado -> telefone correto

      nomeParaTelefones.forEach((telefones, nome) => {
        if (telefones.size > 1) {
          const telefonesArray = Array.from(telefones);

          // Priorizar: 1) Telefone sem @lid, 2) Telefone mais curto (sem DDD duplicado)
          const telefoneCorreto = telefonesArray.sort((a, b) => {
            const aLimpo = a.replace(/[^0-9]/g, '');
            const bLimpo = b.replace(/[^0-9]/g, '');

            // Se um tem @lid e outro não, priorizar sem @lid
            const aTemLid = conversasMap.get(a)?.some(m => m.numero?.includes('@lid')) || false;
            const bTemLid = conversasMap.get(b)?.some(m => m.numero?.includes('@lid')) || false;
            if (aTemLid && !bTemLid) return 1; // b vem primeiro (sem @lid)
            if (!aTemLid && bTemLid) return -1; // a vem primeiro (sem @lid)

            // Se ambos têm ou não têm @lid, priorizar o mais curto (sem DDD duplicado)
            return aLimpo.length - bLimpo.length;
          })[0];

          // Mapear todos os outros telefones para o correto
          telefonesArray.forEach(tel => {
            if (tel !== telefoneCorreto) {
              telefoneMergeMap.set(tel, telefoneCorreto);
              console.log(`🔗 [DEDUP] Mesclando "${tel}" → "${telefoneCorreto}" (nome: "${nome}")`);
            }
          });
        }
      });

      // ETAPA 3: Mesclar conversas baseado no mapa
      const conversasDeduplicadas = new Map<string, any[]>();
      conversasMap.forEach((msgs, key) => {
        // Se este telefone deve ser mesclado com outro, usar o telefone correto
        const telefoneCorreto = telefoneMergeMap.get(key) || key;
        if (!conversasDeduplicadas.has(telefoneCorreto)) {
          conversasDeduplicadas.set(telefoneCorreto, []);
        }
        conversasDeduplicadas.get(telefoneCorreto)!.push(...msgs);
      });

      // ETAPA 4: Substituir conversasMap pelas conversas deduplicadas (OTIMIZADO)
      conversasMap.clear();
      conversasDeduplicadas.forEach((msgs, key) => {
        // ⚡ OTIMIZAÇÃO: Deduplicar apenas por ID (mais rápido)
        const uniqueMsgs = Array.from(new Map(msgs.map(m => [m.id, m])).values());
        uniqueMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        conversasMap.set(key, uniqueMsgs);
      });
      console.log(`🔄 [DEDUP] Conversas deduplicadas: ${conversasMap.size} conversas finais`, {
        telefonesMesclados: telefoneMergeMap.size,
        detalhes: Array.from(telefoneMergeMap.entries()).map(([dup, correto]) => ({
          duplicado: dup,
          correto: correto
        }))
      });

      // Criar mapa de leads para buscar nomes
      const leadsMap = new Map<string, {
        name: string;
        leadId: string;
        tags: string[];
        profilePictureUrl?: string;
      }>();
      leadsData.forEach(lead => {
        const phoneRaw = lead.phone || lead.telefone;
        if (!phoneRaw) return;
        const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
        if (phoneKey) {
          const leadEntry = {
            name: lead.name || phoneKey,
            leadId: lead.id,
            tags: lead.tags || [],
            profilePictureUrl: lead.profile_picture_url || undefined
          };
          // Armazenar com chave original
          leadsMap.set(phoneKey, leadEntry);
          // Armazenar também com prefixo ig_ para matching com conversas Instagram
          if (phoneKey.length >= 14) {
            leadsMap.set(`ig_${phoneKey}`, leadEntry);
          }
          // Armazenar também com prefixo 55 para matching com conversas normalizadas
          if (!phoneKey.startsWith('55') && phoneKey.length >= 10 && phoneKey.length <= 13) {
            leadsMap.set(`55${phoneKey}`, leadEntry);
          }
          // E sem o prefixo 55 caso a conversa não tenha
          if (phoneKey.startsWith('55') && phoneKey.length >= 12) {
            leadsMap.set(phoneKey.substring(2), leadEntry);
          }
        }
      });

      // ETAPA 3: Buscar assignments (responsáveis) das conversas
      // Buscar assignments para todos os telefones (para mostrar responsável e filtrar se necessário)
      let assignmentsMap = new Map<string, {
        id: string;
        name: string;
      }>(); // telefone -> {id, nome} do responsável

      // ⚡ CORREÇÃO: Buscar assignments de TODOS os telefones das conversas (sem limite)
      const telefonesParaBuscar = Array.from(conversasMap.keys()).map(tel => tel.replace(/[^0-9]/g, '')).filter(tel => tel.length >= 10);
      // Removido .slice(0, 100) para buscar assignments de TODAS as conversas

      if (telefonesParaBuscar.length > 0) {
        // ⚡ CORREÇÃO: Buscar assignments em lotes para garantir que todos sejam encontrados
        // Processar em lotes de 100 telefones para evitar limite do Supabase
        const ASSIGNMENT_BATCH_SIZE = 100;
        let allAssignments: any[] = [];
        for (let i = 0; i < telefonesParaBuscar.length; i += ASSIGNMENT_BATCH_SIZE) {
          const batch = telefonesParaBuscar.slice(i, i + ASSIGNMENT_BATCH_SIZE);
          const {
            data: assignmentsData
          } = await supabase.from('conversation_assignments').select('telefone_formatado, assigned_user_id').eq('company_id', companyId).in('telefone_formatado', batch);
          if (assignmentsData) {
            allAssignments = [...allAssignments, ...assignmentsData];
          }
        }

        // ⚡ CORREÇÃO: Buscar nomes dos usuários atribuídos
        const assignedUserIds = [...new Set(allAssignments.map(a => a.assigned_user_id).filter(Boolean))];
        const assignedUserNamesMap = new Map<string, string>();
        if (assignedUserIds.length > 0) {
          const {
            data: assignedProfiles
          } = await supabase.from('profiles').select('id, full_name, email').in('id', assignedUserIds);
          if (assignedProfiles) {
            assignedProfiles.forEach(profile => {
              assignedUserNamesMap.set(profile.id, profile.full_name || profile.email || 'Usuário');
            });
          }
        }

        // Processar todos os assignments encontrados - agora com ID e NOME
        allAssignments.forEach((assignment: any) => {
          const telKey = assignment.telefone_formatado?.replace(/[^0-9]/g, '') || '';
          if (telKey && assignment.assigned_user_id) {
            const userName = assignedUserNamesMap.get(assignment.assigned_user_id) || 'Usuário';
            assignmentsMap.set(telKey, {
              id: assignment.assigned_user_id,
              name: userName
            });
          }
        });
        console.log('👥 [LOAD] Responsáveis carregados:', assignmentsMap.size, 'conversas com responsável');
      }

      // ETAPA 4: Criar lista de conversas (otimizado)
      // ⚡ CORREÇÃO CRÍTICA: REMOVER TODOS OS FILTROS - exibir TODAS as conversas SEM EXCEÇÃO
      // Todas as conversas do WhatsApp devem aparecer no CRM, independente de responsável ou admin
      const novasConversas: Conversation[] = Array.from(conversasMap.entries())
      // ⚡ CORREÇÃO CRÍTICA: REMOVIDO filtro de responsável/admin - TODAS as conversas devem aparecer
      // REMOVIDO: .slice(0, INITIAL_LIMIT) - agora todas as conversas são exibidas
      // REMOVIDO: .filter() por responsável - todas as conversas devem ser visíveis
      .map(([telefone, mensagens]) => {
        // ⚡ CORREÇÃO CRÍTICA: Detectar se é grupo de MÚLTIPLAS formas para garantir 100% de precisão
        // 1. Verificar is_group no banco
        // 2. Verificar se o número termina com @g.us (padrão WhatsApp)
        // 3. Verificar se algum número nas mensagens termina com @g.us
        // 4. Verificar se o telefone contém @g.us em qualquer posição
        const hasIsGroupFlag = mensagens.some(m => Boolean(m.is_group) === true);
        const telefoneIsGroup = /@g\.us/i.test(String(telefone || ''));
        const numeroMensagemIsGroup = mensagens.some(m => /@g\.us/i.test(String(m.numero || '')));
        const isGroup = hasIsGroupFlag || telefoneIsGroup || numeroMensagemIsGroup;

        // Log para debug de grupos
        if (isGroup) {
          console.log('📱 [GRUPO DETECTADO]', {
            telefone,
            hasIsGroupFlag,
            telefoneIsGroup,
            numeroMensagemIsGroup,
            primeiroNumero: mensagens[0]?.numero
          });
        }
        // ⚡ CORREÇÃO: Para Instagram, tentar lookup sem prefixo ig_ e também com o ID puro
        let leadInfo = leadsMap.get(telefone);
        if (!leadInfo && telefone.startsWith('ig_')) {
          const igId = telefone.replace(/^ig_/, '').replace(/[^0-9]/g, '');
          leadInfo = leadsMap.get(igId);
        }

        // ⚡ CORREÇÃO: Para GRUPOS, buscar nome real do grupo via API
        let contactName = '';
        if (isGroup) {
          // Para grupos, o campo numero geralmente contém o ID completo do grupo
          // Exemplo: "558787166688-1633483191@g.us"
          // Vamos buscar metadados do grupo para pegar o nome real

          // Por enquanto, usar o nome do primeiro contato que enviou mensagem no grupo
          // mas marcar para buscar o nome real depois
          const mensagensOrdenadas = [...mensagens].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          // Buscar a primeira mensagem que tem nome_contato diferente de telefone
          const primeiraComNome = mensagensOrdenadas.find(m => m.nome_contato && m.nome_contato !== telefone && !/^\d+$/.test(m.nome_contato));

          // ⚡ CORREÇÃO: Para grupos, usar nome da mensagem ou fallback "Grupo"
          // Não usar telefone como fallback para grupos
          contactName = primeiraComNome?.nome_contato || 'Grupo';

          // ⚡ CORREÇÃO CRÍTICA: Validar se nome parece ser um ID de grupo malformado
          // IDs de grupo têm formato específico com @ e números longos
          // Se detectar isso, forçar "Grupo" como nome
          if (/@g\.us$/.test(contactName) || /^\d{15,}/.test(contactName)) {
            contactName = 'Grupo';
          }
        } else {
          // PRIORIDADE 1: Nome do Lead (se existir) - APENAS para contatos individuais
          // ⚡ CORREÇÃO: Rejeitar nomes fallback "Instagram XXXXXX" do lead
          const leadNameRaw = leadInfo?.name || '';
          const isLeadNameFallback = /^Instagram\s+\d+$/i.test(leadNameRaw);
          contactName = (leadNameRaw && !isLeadNameFallback) ? leadNameRaw : '';

          // PRIORIDADE 2: Nome da mensagem (priorizar mensagens mais recentes com nome real)
          const telefoneDigits = telefone.replace(/[^0-9]/g, '');
          if (!contactName || contactName === telefone || contactName === telefoneDigits) {
            // Buscar da mensagem mais recente que tenha um nome real (não número)
            const mensagensComNome = mensagens
              .filter(m => {
                const nome = m.nome_contato?.trim();
                if (!nome) return false;
                const nomeDigits = nome.replace(/[^0-9]/g, '');
                // Rejeitar nomes que são apenas números (telefone/ID do Instagram) ou fallbacks "Instagram XXXX"
                return nome !== telefone && nome !== telefoneDigits && !(nomeDigits.length > 8 && nomeDigits === nome) && !/^Instagram\s+\d+$/i.test(nome);
              })
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (mensagensComNome.length > 0) {
              contactName = mensagensComNome[0].nome_contato!;
            }
          }

          // ⚡ CORREÇÃO CRÍTICA: FALLBACK para contatos individuais
          // Detectar se é Instagram baseado nas mensagens (antes da variável isInstagramConv)
          const isInstagramForName = mensagens.some(m => m.origem === 'Instagram');
          
          if (!contactName || contactName.trim() === '' || contactName === telefone) {
            const cleanTel = telefone.replace(/^ig_/, '');
            const isInstagramNumericId = isInstagramForName && /^\d{10,}$/.test(cleanTel);
            if (isInstagramNumericId) {
              // ⚡ CORREÇÃO: Usar "Contato Instagram" como placeholder mais limpo
              // O nome real será resolvido async via resolve-instagram-name
              contactName = `Contato Instagram`;
            } else {
              contactName = cleanTel;
            }
          } else {
            // ⚡ CORREÇÃO: Se o nome é um ID numérico longo do Instagram, usar placeholder
            if (isInstagramForName && /^\d{10,}$/.test(contactName)) {
              contactName = `Contato Instagram`;
            }
          }
        }

        // ⚡ CORREÇÃO CRÍTICA: Processar TODAS as mensagens (não limitar) para preservar histórico completo
        // Apenas para exibição inicial na lista, mostrar últimas 3, mas manter todas no estado
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta (pode ser boolean, string, null, undefined)
        const todasMensagensFormatadas: Message[] = mensagens.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(m => {
          // ⚡ CORREÇÃO CRÍTICA: Determinar sender baseado em fromme de forma robusta
          // fromme === true ou 'true' → sender: "user" (mensagem enviada)
          // fromme === false, 'false', null, undefined → sender: "contact" (mensagem recebida)
          const isFromMe = m.fromme === true || m.fromme === 'true';
          const sender: "user" | "contact" = isFromMe ? "user" : "contact";

          // ⚡ CORREÇÃO DEFINITIVA: Usar sent_by do banco, com fallback pelo owner_id
          // 1. Primeiro, tenta usar sent_by do banco (já salvo permanentemente)
          // 2. Se não tiver sent_by, busca pelo owner_id no ownerNamesMap
          // 3. Se nenhum funcionar e for mensagem enviada (fromme=true), usa "Equipe"
          let sentBy: string | undefined = m.sent_by || undefined;

          // ⚡ FALLBACK: Se não tiver sent_by mas tiver owner_id, buscar nome do usuário
          if (!sentBy && m.owner_id && isFromMe) {
            sentBy = ownerNamesMap.get(m.owner_id) || "Equipe";
          }
          const msgType2 = (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem === 'image' ? 'image' : m.tipo_mensagem === 'audio' ? 'audio' : m.tipo_mensagem === 'video' ? 'video' : m.tipo_mensagem === 'document' || m.tipo_mensagem === 'pdf' ? 'pdf' : m.tipo_mensagem === 'contact' ? 'contact' : m.tipo_mensagem || 'text') as any;
          const contactDataParsed3 = msgType2 === 'contact' ? parseContactData(m.mensagem || '') : undefined;
          const deliveryState = getMessageDeliveryState(m);
          return {
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: msgType2 === 'contact' ? (contactDataParsed3 ? `📇 Contato: ${contactDataParsed3.name}` : m.mensagem || '') : (m.mensagem || ''),
            type: msgType2,
            sender: sender,
            timestamp: new Date(m.created_at || Date.now()),
            delivered: deliveryState.delivered,
            read: deliveryState.read,
            status: deliveryState.status,
            mediaUrl: m.midia_url,
            fileName: m.arquivo_nome,
            fileSize: extractFileSizeFromMediaUrl(m.midia_url),
            mimeType: m.tipo_mensagem === 'video' ? 'video/mp4' : m.tipo_mensagem === 'audio' ? 'audio/mpeg' : m.tipo_mensagem === 'image' ? 'image/jpeg' : m.tipo_mensagem === 'document' || m.tipo_mensagem === 'pdf' ? 'application/pdf' : undefined,
            sentBy: sentBy,
            contactData: contactDataParsed3
          };
        });

        // ⚡ CORREÇÃO: Para exibição na lista, usar apenas últimas 3 mensagens
        // Mas manter TODAS as mensagens no estado da conversa
        const messagensFormatadas = todasMensagensFormatadas;

        // ⚡ CORREÇÃO: Determinar status baseado na última mensagem
        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";

        // Verificar se há mensagem marcada como resolvida no banco
        const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temMensagemResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem) {
          // Se última mensagem é do usuário = foi respondida
          if (ultimaMensagem.sender === 'user') {
            statusConversa = "answered";
          } else {
            // ⚡ MELHORIA: Verificar se é uma conversa "ao vivo" (interação recente)
            // Se o usuário respondeu recentemente, manter em "Em Atendimento" mesmo com novas mensagens do contato
            const TEMPO_CONVERSA_AO_VIVO = 10 * 60 * 1000; // 10 minutos em ms (aumentado para dar mais margem)
            const agora = Date.now();

            // Buscar última mensagem enviada pelo usuário
            const ultimaMensagemDoUsuario = [...messagensFormatadas].reverse().find(m => m.sender === 'user');
            if (ultimaMensagemDoUsuario) {
              const tempoUltimaMensagemUsuario = ultimaMensagemDoUsuario.timestamp instanceof Date ? ultimaMensagemDoUsuario.timestamp.getTime() : new Date(ultimaMensagemDoUsuario.timestamp).getTime();

              // ⚡ CORREÇÃO: Se o usuário respondeu nos últimos 10 minutos, conversa está "ao vivo"
              // Não precisa que o contato também tenha respondido recentemente
              const usuarioRespondeuRecentemente = agora - tempoUltimaMensagemUsuario < TEMPO_CONVERSA_AO_VIVO;
              if (usuarioRespondeuRecentemente) {
                statusConversa = "answered"; // Manter em "Em Atendimento"
                // Log removido para evitar poluição do console
              } else {
                // Usuário não respondeu recentemente - contato aguardando resposta
                statusConversa = "waiting";
              }
            } else {
              // Sem mensagem do usuário = aguardando primeira resposta
              statusConversa = "waiting";
            }
          }
        }

        // Buscar responsável da conversa (se houver) - agora retorna {id, nome}
        const telKey = telefone.replace(/[^0-9]/g, '');
        const assignedUserData = assignmentsMap.get(telKey); // ⚡ CORRIGIDO: Agora é {id, nome} do usuário

        // Detectar canal baseado na origem das mensagens
        const isInstagramConv = telefone.startsWith('ig_') || mensagens.some(m => {
          const digits = String(m.telefone_formatado || m.numero || '').replace(/[^0-9]/g, '');
          return m.origem === 'Instagram' || (m.origem_api === 'meta' && digits.length >= 15);
        });
        const channelDetected: "whatsapp" | "instagram" | "facebook" = isInstagramConv ? 'instagram' : 'whatsapp';

        // ⚡ CORREÇÃO: Detectar origemApi a partir das mensagens
        const detectedOrigemApi: "evolution" | "meta" | undefined = 
          mensagens.some(m => m.origem_api === 'meta') ? 'meta' : 
          mensagens.some(m => m.origem_api === 'evolution') ? 'evolution' : undefined;

        const conversaCriada = {
          id: telefone,
          contactName,
          channel: channelDetected,
          status: statusConversa,
          lastMessage: messagensFormatadas[messagensFormatadas.length - 1]?.content || '',
          unread: messagensFormatadas.length > 0 && messagensFormatadas[messagensFormatadas.length - 1]?.sender === 'contact' ? 1 : 0,
          messages: messagensFormatadas,
          tags: leadInfo?.tags || [],
          phoneNumber: telefone,
          avatarUrl: isGroup 
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent('Grupo')}&background=10b981&color=fff` 
            : (leadInfo?.profilePictureUrl && !isExpiredWhatsAppUrl(leadInfo.profilePictureUrl) 
              ? leadInfo.profilePictureUrl 
              : channelDetected === 'instagram'
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName.substring(0, 2))}&background=E1306C&color=fff`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName.substring(0, 2))}&background=0ea5e9&color=fff`),
          isGroup: isGroup,
          // ⚡ CORREÇÃO: Incluir assignedUser com id e nome para filtros funcionarem
          responsavel: assignedUserData?.id || undefined,
          // ID do responsável para filtros
          assignedUser: assignedUserData ? {
            id: assignedUserData.id,
            name: assignedUserData.name
          } : undefined, // Objeto completo para exibição
          // ⚡ CORREÇÃO: Definir origemApi para roteamento correto de envio
          origemApi: detectedOrigemApi,
        };

        // ⚡ LOG: Debug de conversa criada
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta
        const temMensagensRecebidas = mensagens.some(m => {
          const isReceived = m.fromme === false || m.fromme === 'false' || m.fromme === null || m.fromme === undefined;
          return isReceived;
        });
        if (temMensagensRecebidas) {
          const mensagensRecebidasCount = mensagens.filter(m => {
            const isReceived = m.fromme === false || m.fromme === 'false' || m.fromme === null || m.fromme === undefined;
            return isReceived;
          }).length;
          const mensagensEnviadasCount = mensagens.filter(m => m.fromme === true || m.fromme === 'true').length;
          console.log('✅ [LOAD] Conversa criada com mensagens RECEBIDAS:', {
            telefone,
            contactName,
            totalMensagens: messagensFormatadas.length,
            mensagensRecebidas: mensagensRecebidasCount,
            mensagensEnviadas: mensagensEnviadasCount,
            status: statusConversa,
            mensagensFormatadasRecebidas: messagensFormatadas.filter(m => m.sender === 'contact').length,
            mensagensFormatadasEnviadas: messagensFormatadas.filter(m => m.sender === 'user').length
          });
        }
        return conversaCriada;
      });
      const loadTime = performance.now() - startTime;
      console.log(`✅ [LOAD] ${novasConversas.length} conversas carregadas em ${loadTime.toFixed(0)}ms`, {
        totalMensagens: conversasData.length,
        conversasUnicas: novasConversas.length,
        mensagensEnviadas: novasConversas.reduce((acc, c) => acc + c.messages.filter(m => m.sender === 'user').length, 0),
        mensagensRecebidas: novasConversas.reduce((acc, c) => acc + c.messages.filter(m => m.sender === 'contact').length, 0)
      });

      // ⚡ MERGE INTELIGENTE: Preservar conversas em tempo real e evitar duplicatas
      if (append) {
        setConversations(prev => {
          // ⚡ CORREÇÃO CRÍTICA: Mesclar mensagens de conversas existentes com novas mensagens
          // Em vez de filtrar conversas duplicadas, mesclar as mensagens
          const conversasMap = new Map<string, any>();

          // Primeiro, adicionar todas as conversas existentes ao mapa
          prev.forEach(conv => {
            const tel = conv.phoneNumber || conv.id;
            conversasMap.set(tel, {
              ...conv
            });
          });

          // Agora, mesclar novas conversas/mensagens
          let conversasNovasCount = 0;
          let mensagensNovasCount = 0;
          novasConversas.forEach(novaConv => {
            const tel = novaConv.phoneNumber || novaConv.id;
            const existente = conversasMap.get(tel);
            if (existente) {
              // Conversa já existe - mesclar mensagens
              const idsExistentes = new Set(existente.messages.map((m: any) => m.id));
              const novasMensagens = novaConv.messages.filter(m => !idsExistentes.has(m.id));
              if (novasMensagens.length > 0) {
                mensagensNovasCount += novasMensagens.length;
                const todasMensagens = [...existente.messages, ...novasMensagens].sort((a, b) => {
                  const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                  const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                  return timeA - timeB;
                });
                conversasMap.set(tel, {
                  ...existente,
                  messages: todasMensagens,
                  lastMessage: todasMensagens[todasMensagens.length - 1]?.content || existente.lastMessage
                });
              }
            } else {
              // Nova conversa - adicionar
              conversasNovasCount++;
              conversasMap.set(tel, novaConv);
            }
          });
          const merged = Array.from(conversasMap.values());
          console.log(`✅ [APPEND] ${conversasNovasCount} conversas novas, ${mensagensNovasCount} mensagens adicionadas a conversas existentes`);

          // Se não encontrou NENHUMA novidade (nem conversas nem mensagens), não há mais para carregar
          if (conversasNovasCount === 0 && mensagensNovasCount === 0) {
            console.log('⚠️ [APPEND] Nenhuma novidade encontrada (todas as conversas e mensagens já estão carregadas)');
            setHasMoreConversations(false);
            toast.info('Todas as conversas já estão carregadas');
            return prev;
          }

          // Salvar no cache COM company_id
          try {
            sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(merged));
            sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
            if (companyId) {
              sessionStorage.setItem(CONVERSATIONS_CACHE_COMPANY_KEY, companyId);
            }
          } catch (e) {
            console.warn('⚠️ [CACHE] Erro ao salvar cache:', e);
          }

          // Verificar se ainda pode ter mais dados
          // Se carregamos menos do que o limite, provavelmente não há mais
          if (novasConversas.length === 0) {
            setHasMoreConversations(false);
          }
          return merged;
        });
        const novasCount = novasConversas.filter(conv => {
          const tel = conv.phoneNumber || conv.id;
          return !conversations.some(c => (c.phoneNumber || c.id) === tel);
        }).length;
        toast.success(`+${novasCount} novas conversas carregadas`);
      } else {
        setConversations(prev => {
          const telefonesDoBanco = new Set(novasConversas.map(c => c.phoneNumber || c.id));
          const conversasRealtime = prev.filter(c => {
            const tel = c.phoneNumber || c.id;
            return !telefonesDoBanco.has(tel);
          });

          // ⚡ CORREÇÃO CRÍTICA: Preservar mensagens existentes quando mesclar conversas
          // Se uma conversa já existe e tem muitas mensagens (histórico completo), preservar todas
          const merged = novasConversas.map(novaConv => {
            const telefoneNova = novaConv.phoneNumber || novaConv.id;
            const conversaExistente = prev.find(c => {
              const tel = c.phoneNumber || c.id;
              return tel === telefoneNova;
            });

            // Se conversa existente tem histórico completo (mais de 3 mensagens), preservar todas
            if (conversaExistente && conversaExistente.messages.length > 3) {
              // Mesclar mensagens: adicionar novas do banco que não existem localmente
              const idsExistentes = new Set(conversaExistente.messages.map(m => m.id));
              const novasMensagens = novaConv.messages.filter(m => !idsExistentes.has(m.id));

              // Combinar mensagens existentes com novas, ordenadas por timestamp
              const todasMensagens = [...conversaExistente.messages, ...novasMensagens].sort((a, b) => {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                return timeA - timeB;
              });

              // ⚡ CORREÇÃO CRÍTICA: Se conversa estava 'resolved' mas tem nova mensagem do contato,
              // ela deve voltar para 'waiting' para aparecer no filtro correto
              let statusFinal = novaConv.status;
              if (conversaExistente.status === 'resolved') {
                // Verificar se a última mensagem é do contato
                const ultimaMensagem = todasMensagens[todasMensagens.length - 1];
                if (ultimaMensagem?.sender === 'contact') {
                  // ⚡ Contato respondeu a uma conversa finalizada = volta para 'waiting'
                  statusFinal = 'waiting';
                  console.log(`🔄 [REATIVAÇÃO] Conversa ${novaConv.contactName} reativada: resolved -> waiting (contato respondeu)`);
                } else {
                  // Preservar 'resolved' se última mensagem não é do contato
                  statusFinal = 'resolved';
                }
              }
              console.log(`🔄 Preservando ${conversaExistente.messages.length} mensagens existentes + ${novasMensagens.length} novas para ${novaConv.contactName}, status: ${statusFinal}`);
              return {
                ...novaConv,
                messages: todasMensagens,
                // Preservar histórico completo
                lastMessage: novaConv.lastMessage,
                // Atualizar última mensagem
                status: statusFinal,
                // ⚡ Status atualizado baseado na última mensagem
                isGroup: conversaExistente.isGroup,
                // ⚡ PRESERVAR flag de grupo
                avatarUrl: conversaExistente.avatarUrl || novaConv.avatarUrl // ⚡ PRESERVAR avatar
              };
            }

            // Se não tem histórico completo, verificar se deve reativar conversa finalizada
            let statusFinal = novaConv.status;
            if (conversaExistente?.status === 'resolved') {
              // Verificar se a última mensagem é do contato
              const ultimaMensagem = novaConv.messages?.[novaConv.messages.length - 1];
              if (ultimaMensagem?.sender === 'contact') {
                statusFinal = 'waiting';
                console.log(`🔄 [REATIVAÇÃO] Conversa ${novaConv.contactName} reativada (sem histórico): resolved -> waiting`);
              } else {
                statusFinal = 'resolved';
              }
            }
            return {
              ...novaConv,
              status: statusFinal,
              // ⚡ Status atualizado baseado na última mensagem
              isGroup: conversaExistente?.isGroup ?? novaConv.isGroup,
              // ⚡ PRESERVAR flag de grupo
              avatarUrl: conversaExistente?.avatarUrl || novaConv.avatarUrl // ⚡ PRESERVAR avatar
            };
          });
          const finalMerged = [...conversasRealtime, ...merged];

          // ⚡ INSTANTÂNEO: Salvar no cache imediatamente COM company_id
          try {
            sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(finalMerged));
            sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
            if (companyId) {
              sessionStorage.setItem(CONVERSATIONS_CACHE_COMPANY_KEY, companyId);
            }
          } catch (e) {
            console.warn('⚠️ [CACHE] Erro ao salvar cache:', e);
          }
          return finalMerged;
        });
        // Não mostrar toast se carregou do cache (já está visível)
      }

      // ⚡ OTIMIZAÇÃO: Carregar métricas em paralelo (não bloqueia)
      // FIXME: loadCompanyMetrics não definida
      // loadCompanyMetrics();

      // ⚡ OTIMIZAÇÃO: Finalizar loading ANTES de carregar avatares
      setLoadingConversations(false);

      // ⚡ DESATIVADO: Carregamento em massa de avatares removido para liberar capacidade das edge functions
      console.log('📸 [REALTIME] Carregamento de avatares em massa DESATIVADO - sob demanda ao clicar');

      // ⚡ LAZY RESOLUTION DE NOMES INSTAGRAM: Resolver nomes "Instagram XXXXXX" ou IDs numéricos
      const conversasComNomeFallback = novasConversas.filter(c => {
        if (c.channel !== 'instagram') return false;
        const nome = c.contactName || '';
        return /^Instagram\s+\d+$/i.test(nome) || /^\d{10,}$/.test(nome);
      });
      if (conversasComNomeFallback.length > 0 && companyId) {
        (async () => {
          const BATCH_SIZE = 3;
          const BATCH_DELAY = 800;
          const resolvedNamesCache = new Set<string>();
          for (let i = 0; i < conversasComNomeFallback.length; i += BATCH_SIZE) {
            const batch = conversasComNomeFallback.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async conv => {
              const igId = (conv.phoneNumber || conv.id || '').replace(/^ig_/, '').replace(/[^0-9]/g, '');
              if (!igId || resolvedNamesCache.has(igId)) return;
              resolvedNamesCache.add(igId);
              try {
                const res = await supabase.functions.invoke('resolve-instagram-name', {
                  body: { company_id: companyId, instagram_user_id: igId }
                });
                const resolvedName = res.data?.name;
                if (resolvedName && !/^Instagram\s+\d+$/i.test(resolvedName) && !/^\d{10,}$/.test(resolvedName)) {
                  console.log(`📸 [INSTAGRAM] Nome resolvido: ${igId} → ${resolvedName}`);
                  setConversations(prev => prev.map(c => {
                    const cIgId = (c.phoneNumber || c.id || '').replace(/^ig_/, '').replace(/[^0-9]/g, '');
                    if (cIgId === igId) {
                      return { ...c, contactName: resolvedName };
                    }
                    return c;
                  }));
                }
              } catch (e) {
                console.warn(`⚠️ [INSTAGRAM] Falha ao resolver nome para ${igId}:`, e);
              }
            }));
            if (i + BATCH_SIZE < conversasComNomeFallback.length) {
              await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
          }
        })().catch(() => {});
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast.error('Erro ao carregar conversas');
      setLoadingConversations(false);
    }
  };
  const loadQuickMessages = async () => {
    try {
      const {
        data: companyData
      } = await supabase.rpc('get_my_company_id');
      if (!companyData) return;
      const {
        data,
        error
      } = await supabase.from('quick_messages').select('*').eq('company_id', companyData).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      const formatted = data?.map(msg => ({
        id: msg.id,
        title: msg.title,
        content: msg.content,
        category: msg.category_id || '',
        type: msg.message_type as 'text' | 'image' | 'video' | 'audio' | 'document',
        mediaUrl: msg.media_url || undefined
      })) || [];
      setQuickMessages(formatted);
    } catch (error) {
      console.error('Erro ao carregar mensagens rápidas:', error);
    }
  };
  const loadQuickCategories = async () => {
    try {
      const {
        data: companyData
      } = await supabase.rpc('get_my_company_id');
      if (!companyData) return;
      const {
        data,
        error
      } = await supabase.from('quick_message_categories').select('*').eq('company_id', companyData).order('created_at', {
        ascending: true
      });
      if (error) throw error;
      const formatted = data?.map(cat => ({
        id: cat.id,
        name: cat.name
      })) || [];
      setQuickCategories(formatted);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      const initialCategories = [{
        id: "1",
        name: "Atendimento"
      }, {
        id: "2",
        name: "Suporte"
      }, {
        id: "3",
        name: "Dúvidas"
      }, {
        id: "4",
        name: "Objeções"
      }, {
        id: "5",
        name: "Preços"
      }, {
        id: "6",
        name: "PIX"
      }];
      setQuickCategories(initialCategories);
      localStorage.setItem(QUICK_CATEGORIES_KEY, JSON.stringify(initialCategories));
    }
  };
  const loadReminders = async () => {
    if (!leadVinculado?.id) return;
    try {
      // CORREÇÃO: Buscar lembretes através dos compromissos do lead
      const {
        data: compromissos,
        error: compError
      } = await supabase.from('compromissos').select('id').eq('lead_id', leadVinculado.id);
      if (compError) throw compError;
      if (!compromissos || compromissos.length === 0) {
        setReminders([]);
        return;
      }
      const compromissoIds = compromissos.map(c => c.id);
      const {
        data,
        error
      } = await supabase.from('lembretes').select(`
          *,
          compromisso:compromissos(
            data_hora_inicio,
            tipo_servico,
            lead_id
          )
        `).in('compromisso_id', compromissoIds).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    }
  };
  const loadMeetings = async () => {
    if (!leadVinculado?.id) {
      setMeetings([]);
      return;
    }
    try {
      const {
        data,
        error
      } = await supabase.from('compromissos').select(`
          *,
          lead:leads(name, phone)
        `).eq('lead_id', leadVinculado.id).order('data_hora_inicio', {
        ascending: false
      });
      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Erro ao carregar reuniões:', error);
    }
  };

  // 📜 Carregar TODO o histórico de mensagens de um contato
  const loadFullConversationHistory = async (phoneNumber: string, contactName: string) => {
    if (!userCompanyId) return;
    setLoadingHistory(true);
    console.log(`📜 Carregando histórico completo para ${contactName} (${phoneNumber})...`);
    try {
      // Normalizar número de telefone para buscar em diferentes formatos
      const telefoneNormalizado = normalizePhoneForWA(phoneNumber);
      const telefoneSemFormatacao = telefoneNormalizado.replace(/\D/g, '');
      const telefoneOriginal = phoneNumber.replace(/\D/g, '');

      // Criar lista de variações para buscar (remover duplicatas)
      const variacoes = Array.from(new Set([phoneNumber, telefoneNormalizado, telefoneSemFormatacao, telefoneOriginal, `${telefoneNormalizado}@s.whatsapp.net`, `${telefoneNormalizado}@c.us`].filter(v => v && v.length > 0)));

      // Buscar TODAS as mensagens do contato (sem limite) - tentar múltiplos formatos
      // ⚡ CORREÇÃO: Construir query corretamente usando .or() do Supabase
      // O formato correto é: "campo1.eq.valor1,campo2.eq.valor2" (sem espaços)
      const conditions: string[] = [];

      // Adicionar condições para telefone_formatado
      variacoes.forEach(v => {
        if (v && v.trim()) {
          conditions.push(`telefone_formatado.eq.${v}`);
        }
      });

      // Adicionar condições para numero
      variacoes.forEach(v => {
        if (v && v.trim()) {
          conditions.push(`numero.eq.${v}`);
        }
      });
      let allMessages, error;
      if (conditions.length > 0) {
        // Construir string de condições no formato correto do Supabase
        const orCondition = conditions.join(',');
        const result = await supabase.from('conversas').select('*').eq('company_id', userCompanyId).or(orCondition).order('created_at', {
          ascending: true
        });
        allMessages = result.data;
        error = result.error;

        // Se não encontrou nada, tentar busca mais ampla
        if ((!allMessages || allMessages.length === 0) && !error) {
          // Tentar buscar apenas pelo número limpo (sem formatação)
          const telefoneLimpo = telefoneSemFormatacao;
          const result2 = await supabase.from('conversas').select('*').eq('company_id', userCompanyId).or(`telefone_formatado.ilike.%${telefoneLimpo}%,numero.ilike.%${telefoneLimpo}%`).order('created_at', {
            ascending: true
          });
          if (result2.data && result2.data.length > 0) {
            allMessages = result2.data;
            error = result2.error;
          }
        }
      } else {
        // Fallback: buscar apenas pelo número original
        const result = await supabase.from('conversas').select('*').eq('company_id', userCompanyId).eq('telefone_formatado', phoneNumber).order('created_at', {
          ascending: true
        });
        allMessages = result.data;
        error = result.error;
      }
      if (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        throw error;
      }
      if (allMessages && allMessages.length > 0) {
        console.log(`✅ ${allMessages.length} mensagens carregadas do histórico`);

        // ⚡ CORREÇÃO: Remover mensagens duplicadas por ID antes de formatar
        const mensagensUnicas = allMessages.filter((m, index, self) => index === self.findIndex(msg => msg.id === m.id));
        console.log(`📊 ${mensagensUnicas.length} mensagens únicas (${allMessages.length - mensagensUnicas.length} duplicadas removidas)`);

        // Formatar todas as mensagens
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta
        const messagensCompletas: Message[] = mensagensUnicas.map(m => {
          // ⚡ CORREÇÃO CRÍTICA: Determinar sender baseado em fromme de forma robusta
          const isFromMe = m.fromme === true || m.fromme === 'true';
          const sender: "user" | "contact" = isFromMe ? "user" : "contact";
          
          // ✅ CORREÇÃO: Incluir sentBy do banco de dados para preservar assinatura permanente
          let sentBy = m.sent_by || undefined;
          
          // Fallback: se não tem sent_by mas é mensagem enviada, usar "WhatsApp" (enviada pelo app)
          // Isso é correto pois mensagens sem sent_by no banco foram enviadas fora do CRM
          if (!sentBy && isFromMe) {
            sentBy = "WhatsApp"; // Indica que foi enviada pelo WhatsApp app, não pelo CRM
          }
          
          const msgType4 = (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem === 'contact' ? 'contact' : m.tipo_mensagem || 'text') as any;
          const contactDataParsed4 = msgType4 === 'contact' ? parseContactData(m.mensagem || '') : undefined;
          const deliveryState = getMessageDeliveryState(m);
          return {
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: msgType4 === 'contact' ? (contactDataParsed4 ? `📇 Contato: ${contactDataParsed4.name}` : m.mensagem || '') : (m.mensagem || ''),
            type: msgType4,
            sender: sender,
            timestamp: new Date(m.created_at || Date.now()),
            delivered: deliveryState.delivered,
            read: deliveryState.read,
            status: deliveryState.status,
            mediaUrl: m.midia_url,
            fileName: m.arquivo_nome,
            sentBy: sentBy,
            contactData: contactDataParsed4
          };
        })
        // Ordenar por timestamp para garantir ordem cronológica correta
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // ⚡ LOG: Debug de mensagens formatadas
        console.log(`📊 [HISTORY] ${messagensCompletas.length} mensagens formatadas:`, {
          recebidas: messagensCompletas.filter(m => m.sender === 'contact').length,
          enviadas: messagensCompletas.filter(m => m.sender === 'user').length
        });

        // ⚡ CORREÇÃO: Remover duplicatas finais por ID e timestamp (caso ainda existam)
        const mensagensFinais = messagensCompletas.filter((m, index, self) => index === self.findIndex(msg => msg.id === m.id || msg.content === m.content && Math.abs(msg.timestamp.getTime() - m.timestamp.getTime()) < 1000));

        // ⚡ CORREÇÃO CRÍTICA: Mesclar mensagens do histórico com mensagens em tempo real
        // Em vez de substituir, combinar ambas e deduplicar por ID
        setSelectedConv(prev => {
          if (prev && prev.phoneNumber === phoneNumber) {
            // Combinar mensagens do histórico com as existentes (que incluem as de tempo real)
            const existingIds = new Set(mensagensFinais.map(m => m.id));
            const realtimeOnly = prev.messages.filter(m => !existingIds.has(m.id));
            const merged = [...mensagensFinais, ...realtimeOnly].sort((a, b) => {
              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
              return timeA - timeB;
            });
            // Deduplicar por ID (última ocorrência ganha)
            const seenIds = new Set<string>();
            const deduped = merged.filter(m => { if (seenIds.has(m.id)) return false; seenIds.add(m.id); return true; });
            return {
              ...prev,
              messages: deduped
            };
          }
          return prev;
        });

        // Atualizar conversa na lista (mesclar também)
        setConversations(prev => prev.map(conv => {
          if (conv.phoneNumber === phoneNumber) {
            const existingIds = new Set(mensagensFinais.map(m => m.id));
            const realtimeOnly = conv.messages.filter(m => !existingIds.has(m.id));
            const merged = [...mensagensFinais, ...realtimeOnly].sort((a, b) => {
              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
              return timeA - timeB;
            });
            const seenIds2 = new Set<string>();
            const deduped = merged.filter(m => { if (seenIds2.has(m.id)) return false; seenIds2.add(m.id); return true; });
            return { ...conv, messages: deduped };
          }
          return conv;
        }));

        // Estatísticas
        setHistoryStats(prev => ({
          ...prev,
          [phoneNumber]: {
            total: mensagensFinais.length,
            loaded: mensagensFinais.length
          }
        }));

        // Scroll
        setTimeout(() => messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth'
        }), 100);
        toast.success(`📜 ${mensagensFinais.length} mensagens carregadas`);
      } else {
        toast.info('Nenhum histórico anterior encontrado');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingHistory(false);
    }
  };
  const loadAiMode = async () => {
    if (!userCompanyId) return;
    try {
      const { data } = await supabase
        .from('conversation_ai_settings')
        .select('conversation_id, ai_mode')
        .eq('company_id', userCompanyId);
      if (data) {
        const modes: Record<string, string> = {};
        data.forEach((row: any) => { 
          modes[row.conversation_id] = row.ai_mode;
          // Mapear também para formatos com prefixo para garantir lookup
          modes[`conv-${row.conversation_id}`] = row.ai_mode;
        });
        setAiMode(modes);
      }
    } catch (e) {
      console.error('Erro ao carregar AI modes:', e);
    }
  };
  const saveConversations = (updated: Conversation[]) => {
    // Não salvar no localStorage para evitar QuotaExceededError
    // Os dados são persistidos no Supabase
    setConversations(updated);
  };
  const saveQuickMessages = (updated: QuickMessage[]) => {
    // Apenas atualiza estado local - o save real acontece no addQuickMessage
    setQuickMessages(updated);
  };
  const saveQuickCategories = (updated: QuickMessageCategory[]) => {
    // Apenas atualiza estado local - o save real acontece no addQuickCategory
    setQuickCategories(updated);
  };
  const getConversationPhoneKey = (conv: Conversation): string => {
    // Extrair apenas o número do telefone, sem prefixo "conv-"
    const raw = conv.phoneNumber || conv.id;
    return raw.replace(/[^0-9]/g, '');
  };
  const setConversationAIMode = async (convId: string, mode: string) => {
    if (!userCompanyId || !currentUserId) return;
    // Usar telefone normalizado como chave (mesmo formato do webhook)
    const conv = conversations.find(c => c.id === convId);
    const phoneKey = conv ? getConversationPhoneKey(conv) : convId.replace(/[^0-9]/g, '');
    try {
      const { error } = await supabase
        .from('conversation_ai_settings')
        .upsert({
          conversation_id: phoneKey,
          company_id: userCompanyId,
          ai_mode: mode,
          activated_by: currentUserId,
        }, { onConflict: 'conversation_id,company_id' });
      
      if (error) throw error;
      
      // Salvar no state com ambas as chaves para garantir lookup
      setAiMode(prev => ({ ...prev, [convId]: mode, [phoneKey]: mode }));
      const labels: Record<string, string> = {
        off: 'IA desativada para este contato',
        atendimento: 'IA Atendimento ativada para este contato',
        agendamento: 'IA Agendamento ativada para este contato',
        fluxo: 'Fluxo/URA ativado para este contato',
        all: 'Todas as IAs ativadas para este contato',
      };
      toast.success(labels[mode] || 'Modo IA alterado');
    } catch (e) {
      console.error('Erro ao salvar AI mode:', e);
      toast.error('Erro ao salvar modo IA');
    }
  };
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />;
      case "instagram":
        return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  // Função auxiliar para download de mídias (data: URIs e URLs normais)
  const downloadMedia = (url: string, fileName: string) => {
    try {
      if (url.startsWith('data:')) {
        // Converter data: URI para blob e baixar
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], {
          type: mime
        });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        // URL normal - abrir em nova aba
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Erro ao baixar mídia:', error);
      toast.error("Não foi possível baixar o arquivo");
    }
  };

  // MELHORIA: Função auxiliar para atualizar status de transcrição
  const updateTranscriptionStatus = (messageId: string, status: "pending" | "processing" | "completed" | "error", transcription?: string) => {
    setTranscriptionStatuses(prev => ({
      ...prev,
      [messageId]: status
    }));

    // Atualizar status na mensagem
    const updateMessage = (msg: Message) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          transcriptionStatus: status,
          ...(transcription !== undefined && {
            transcricao: transcription
          })
        };
      }
      return msg;
    };

    // Atualizar na conversa selecionada
    setSelectedConv(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map(updateMessage)
      };
    });

    // Atualizar na lista de conversas
    setConversations(prevConvs => prevConvs.map(conv => ({
      ...conv,
      messages: conv.messages.map(updateMessage)
    })));
  };

  // MELHORIA: Limpar polling e timeout
  const clearTranscriptionPolling = (messageId: string) => {
    const refs = transcriptionPollingRefs.current[messageId];
    if (refs) {
      if (refs.interval) clearInterval(refs.interval);
      if (refs.timeout) clearTimeout(refs.timeout);
      delete transcriptionPollingRefs.current[messageId];
    }
  };

  // MELHORIA: Polling para verificar status de transcrição
  const pollTranscriptionStatus = async (messageId: string, transcriptionId?: string, audioUrl?: string, maxPolls: number = 30, pollInterval: number = 1000): Promise<void> => {
    let pollCount = 0;
    const pollIntervalId = setInterval(async () => {
      pollCount++;
      try {
        // Se tiver transcriptionId, verificar status
        if (transcriptionId) {
          // Aqui você pode implementar verificação de status se a Edge Function retornar um ID
          // Por enquanto, vamos apenas aguardar e verificar se a transcrição foi concluída
          console.log(`🔄 [TRANSCRIBE] Polling status (${pollCount}/${maxPolls}) para mensagem ${messageId}`);
        }

        // Se exceder o número máximo de polls, marcar como erro
        if (pollCount >= maxPolls) {
          clearInterval(pollIntervalId);
          updateTranscriptionStatus(messageId, "error");
          toast.error("Timeout: Transcrição demorou muito para processar. Tente novamente.");
          clearTranscriptionPolling(messageId);
        }
      } catch (error) {
        console.error(`❌ [TRANSCRIBE] Erro ao verificar status:`, error);
      }
    }, pollInterval);
    transcriptionPollingRefs.current[messageId] = {
      ...transcriptionPollingRefs.current[messageId],
      interval: pollIntervalId
    };
  };
  const transcreverAudio = async (messageId: string, audioUrl: string, retry: boolean = false) => {
    try {
      // Limpar polling anterior se existir
      clearTranscriptionPolling(messageId);

      // Se não for retry e já tiver status, não fazer nada
      if (!retry && transcriptionStatuses[messageId] === "processing") {
        console.log(`⏸️ [TRANSCRIBE] Transcrição já em processamento para mensagem ${messageId}`);
        return;
      }

      // Atualizar status para "processing"
      updateTranscriptionStatus(messageId, "processing");
      console.log(`🎤 [TRANSCRIBE] Iniciando transcrição para mensagem ${messageId}`);
      toast.info("Transcrevendo áudio...", {
        duration: 2000
      });

      // Resolver URL real do áudio (pode ser JSON de metadados)
      let resolvedAudioUrl = audioUrl;
      
      // Verificar se é JSON de metadados (Evolution/Meta API)
      try {
        const parsed = JSON.parse(audioUrl);
        if (parsed.url || parsed.media_id || parsed.messageId) {
          console.log('🔄 [TRANSCRIBE] Resolvendo URL de mídia via mediaLoader...');
          resolvedAudioUrl = await getMediaUrl(messageId, 'audio');
          console.log('✅ [TRANSCRIBE] URL resolvida:', resolvedAudioUrl.substring(0, 60));
        }
      } catch {
        // Não é JSON, usar URL direta
      }

      // Baixar o áudio
      const audioResponse = await fetch(resolvedAudioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Erro ao baixar áudio: ${audioResponse.statusText}`);
      }
      const audioBlob = await audioResponse.blob();

      // Converter para base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (base64) {
            resolve(base64);
          } else {
            reject(new Error("Não foi possível converter áudio para base64"));
          }
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo de áudio"));
        reader.readAsDataURL(audioBlob);
      });
      if (!userCompanyId) {
        throw new Error("Company ID não encontrado");
      }

      // MELHORIA: Usar função com retry e timeout de 30s
      const TRANSCRIPTION_TIMEOUT = 30000; // 30 segundos
      const timeoutId = setTimeout(() => {
        // Verificar status atual sem depender do closure
        setTranscriptionStatuses(prev => {
          const currentStatus = prev[messageId];
          if (currentStatus === "processing" || currentStatus === "pending") {
            // Atualizar status diretamente aqui para evitar problemas de callback
            setTimeout(() => {
              updateTranscriptionStatus(messageId, "error");
              clearTranscriptionPolling(messageId);
              toast.error("Timeout: Transcrição demorou mais de 30 segundos. Tente novamente.");
            }, 0);
            return {
              ...prev,
              [messageId]: "error"
            };
          }
          return prev;
        });
      }, TRANSCRIPTION_TIMEOUT);
      transcriptionPollingRefs.current[messageId] = {
        ...transcriptionPollingRefs.current[messageId],
        timeout: timeoutId
      };

      // Chamar a Edge Function com retry
      const result = await transcribeAudioWithRetry({
        audioUrl,
        audioBase64: base64Audio,
        company_id: userCompanyId
      });

      // Limpar timeout já que recebemos resposta
      clearTimeout(timeoutId);

      // Verificar resultado
      if (result.status === 'error' || !result.transcription && result.status !== 'pending') {
        // Limpar polling em caso de erro
        clearTranscriptionPolling(messageId);
        updateTranscriptionStatus(messageId, "error");
        toast.error("Erro ao transcrever áudio. Você pode tentar novamente clicando em 'Reenviar Transcrição'.");
        return;
      }

      // Se status for "pending", ainda está processando
      if (result.status === 'pending') {
        console.log(`⏳ [TRANSCRIBE] Transcrição pendente, iniciando polling...`);
        updateTranscriptionStatus(messageId, "pending");
        // Iniciar polling - o timeout já foi limpo acima
        pollTranscriptionStatus(messageId, undefined, audioUrl, 15, 2000).catch(error => {
          console.error('❌ [TRANSCRIBE] Erro no polling:', error);
          updateTranscriptionStatus(messageId, "error");
        });
        return;
      }

      // Limpar polling já que temos resultado
      clearTranscriptionPolling(messageId);

      // Se status for "completed" ou tiver transcrição, salvar
      const transcriptionText = result.transcription;
      if (transcriptionText && transcriptionText !== '[Transcrição pendente - erro ao processar áudio]') {
        // Salvar transcrição no banco de dados (se a coluna existir)
        try {
          await supabase.from('conversas').update({
            transcricao: transcriptionText
          } as any).eq('id', messageId);
          console.log(`✅ [TRANSCRIBE] Transcrição salva no banco de dados`);
        } catch (dbError) {
          console.warn('⚠️ [TRANSCRIBE] Coluna transcricao não encontrada na tabela conversas. Salvando apenas localmente.', dbError);
        }

        // Atualizar status e transcrição
        updateTranscriptionStatus(messageId, "completed", transcriptionText);
        toast.success("✅ Áudio transcrito com sucesso!");
        console.log(`✅ [TRANSCRIBE] Transcrição concluída para mensagem ${messageId}`);
      } else {
        updateTranscriptionStatus(messageId, "error");
        toast.error("Transcrição não disponível. Tente novamente.");
      }
    } catch (error: any) {
      console.error('❌ [TRANSCRIBE] Erro ao transcrever áudio:', error);
      updateTranscriptionStatus(messageId, "error");
      clearTranscriptionPolling(messageId);
      
      // Verificar se é mídia expirada
      if (error instanceof MediaExpiredError || error?.message === 'MEDIA_EXPIRED') {
        toast.error("O áudio expirou e não pode mais ser transcrito. Mídias do WhatsApp expiram após alguns dias.");
        return;
      }
      
      const errorMessage = error?.message || "Não foi possível transcrever o áudio";
      toast.error(`Erro ao transcrever: ${errorMessage}. Você pode tentar novamente.`);
    }
  };

  // Funções de mensagem
  const handleReply = (messageId: string) => {
    const message = selectedConv?.messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(messageId);
      toast.success("Digite sua resposta abaixo");
    }
  };
  const handleEdit = async (messageId: string, newContent: string) => {
    if (!selectedConv) return;
    
    // Atualização otimista na UI
    const updated = conversations.map(conv => conv.id === selectedConv.id ? {
      ...conv,
      messages: conv.messages.map(msg => msg.id === messageId ? {
        ...msg,
        content: newContent,
        edited: true
      } : msg)
    } : conv);
    saveConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.map(msg => msg.id === messageId ? {
        ...msg,
        content: newContent,
        edited: true
      } : msg)
    });

    // Enviar edição para o WhatsApp E atualizar no banco via edge function
    try {
      const companyId = userCompanyId || (await getCompanyId());
      if (!companyId) {
        toast.error('Company ID não encontrado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('editar-mensagem-whatsapp', {
        body: {
          message_id: messageId,
          new_content: newContent,
          company_id: companyId,
        }
      });

      if (error) {
        console.error('❌ Erro ao editar mensagem:', error);
        toast.error('Erro ao editar mensagem');
        return;
      }

      if (data?.edited_on_whatsapp) {
        toast.success("✅ Mensagem editada no WhatsApp e no CRM!");
      } else {
        toast.success("Mensagem editada no CRM");
        if (data?.error) {
          console.warn('⚠️ Não foi possível editar no WhatsApp:', data.error);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      toast.error('Erro ao salvar edição');
    }
  };
  const handleDelete = (messageId: string, forEveryone: boolean) => {
    if (!selectedConv) return;
    const updated = conversations.map(conv => conv.id === selectedConv.id ? {
      ...conv,
      messages: conv.messages.filter(msg => msg.id !== messageId)
    } : conv);
    saveConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.filter(msg => msg.id !== messageId)
    });
    toast.success(forEveryone ? "Mensagem excluída para todos" : "Mensagem excluída para você");
  };
  const handleReact = async (messageId: string, emoji: string) => {
    if (!selectedConv) return;
    console.log('🎭 Reação adicionada:', emoji, 'Mensagem:', messageId);
    const updated = conversations.map(conv => conv.id === selectedConv.id ? {
      ...conv,
      messages: conv.messages.map(msg => msg.id === messageId ? {
        ...msg,
        reaction: emoji
      } : msg)
    } : conv);
    setConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.map(msg => msg.id === messageId ? {
        ...msg,
        reaction: emoji
      } : msg)
    });

    // Enviar reação para o cliente com referência à mensagem
    try {
      const targetMsg = selectedConv.messages.find(m => m.id === messageId);
      const {
        data,
        error
      } = await enviarWhatsApp({
        numero: selectedConv.id,
        tipo_mensagem: 'reaction',
        reaction: {
          emoji,
          messageId
        },
        mensagem: `Reagiu com ${emoji} à mensagem: "${targetMsg?.content || ''}"`,
        quoted: targetMsg ? {
          key: {
            id: messageId
          },
          message: {
            conversation: targetMsg.content || ''
          }
        } : undefined
      });
      if (error) {
        console.error('Erro ao enviar reação:', error);
      } else {
        // Persistir no histórico como texto informativo
        const {
          data: userRole
        } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        const {
          data: userProfile
        } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : {
          data: null
        };
        const isGroup = /@g\.us$/.test(String(selectedConv.id));
        const telefone_formatado = isGroup ? null : normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
        await supabase.from('conversas').insert([{
          numero: selectedConv.id,
          telefone_formatado,
          mensagem: `Reagiu com ${emoji} à mensagem: "${targetMsg?.content || ''}"`,
          origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
          status: 'Enviada',
          tipo_mensagem: 'text',
          nome_contato: selectedConv.contactName?.replace(/^ig_/, '') || selectedConv.contactName,
          company_id: userRole?.company_id,
          owner_id: user?.id,
          sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
          fromme: true,
          delivered: true,
          read: false
        }]);
      }
    } catch (err) {
      console.error('Erro ao processar reação:', err);
    }
    toast.success(`Reação ${emoji} enviada!`);
  };
  const handleSendMedia = async (file: File, caption: string, type: string) => {
    if (!selectedConv) return;

    // Áudio anexado deve seguir o pipeline robusto (normalização + confirmação do provedor)
    if (type === 'audio') {
      await handleSendAudio(file);
      return;
    }

    setSyncStatus('syncing');
    
    // ⚡ CORREÇÃO: Sanitizar nome do arquivo imediatamente para evitar erro InvalidKey
    const sanitizeFileName = (name: string): string => {
      const withoutAccents = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return withoutAccents.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    };
    const sanitizedFileName = sanitizeFileName(file.name);
    
    // Criar novo File com nome sanitizado
    const sanitizedFile = new File([file], sanitizedFileName, { type: file.type });
    
    try {
      console.log('🚀 [INICIO] Processo de envio de mídia:', {
        fileName: file.name,
        sanitizedFileName: sanitizedFileName,
        fileSize: file.size,
        fileType: type,
        mimeType: file.type
      });

      // ⚡ VALIDAÇÃO CRÍTICA: Verificar se arquivo não está vazio
      if (file.size === 0) {
        console.error('❌ [CRITICAL] Arquivo está vazio (0 bytes)!');
        toast.error('O arquivo está vazio. Por favor, selecione outro arquivo.');
        return;
      }

      // FASE 1: Obter informações do usuário
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // FASE 2: Converter arquivo para base64 PRIMEIRO
      console.log('🔄 [FASE 2] Convertendo arquivo para base64...', {
        nome: file.name,
        tipo: type,
        tamanho: file.size,
        mimeType: file.type
      });
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          console.log('📊 [FASE 2] FileReader onloadend:', {
            hasResult: !!result,
            resultType: typeof result,
            resultLength: result?.length || 0,
            inicio: result?.substring(0, 100)
          });
          if (!result) {
            console.error('❌ FileReader retornou resultado vazio');
            reject(new Error('Erro ao ler arquivo'));
            return;
          }

          // Extrair base64 (remover prefixo data:...)
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          console.log('📊 [FASE 2] Após extração do base64:', {
            temVirgula: result.includes(','),
            tamanhoAntes: result.length,
            tamanhoDepois: base64.length,
            inicio: base64.substring(0, 50),
            vazio: !base64 || base64.length === 0
          });
          if (!base64 || base64.length === 0) {
            console.error('❌ Base64 vazio após extração');
            reject(new Error('Erro ao converter arquivo'));
            return;
          }
          console.log('✅ [FASE 2] Conversão concluída:', {
            tamanhoOriginal: file.size,
            tamanhoBase64: base64.length,
            tipo: type,
            primeirosCaracteres: base64.substring(0, 30)
          });
          resolve(base64);
        };
        reader.onerror = error => {
          console.error('❌ Erro no FileReader:', error);
          reject(new Error('Erro ao ler arquivo'));
        };
        reader.readAsDataURL(file);
      });

      // FASE 3: Upload para Supabase Storage
      console.log('📤 [FASE 3] Fazendo upload para Storage...');
      const timestamp = Date.now();
      
      console.log('📝 [FASE 3] Nome sanitizado:', { original: file.name, sanitizado: sanitizedFileName });
      
      const filePath = `${userRole?.company_id}/${userId}/${timestamp}_${sanitizedFileName}`;
      const {
        data: uploadData,
        error: uploadError
      } = await supabase.storage.from('conversation-media').upload(filePath, sanitizedFile, {
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) {
        console.error('❌ Erro ao fazer upload:', uploadError);
        throw new Error('Erro ao fazer upload da mídia');
      }
      console.log('✅ [FASE 3] Upload concluído:', uploadData.path);

      // Gerar URL pública
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('conversation-media').getPublicUrl(uploadData.path);
      console.log('📍 [FASE 3] URL pública:', publicUrl);

      // FASE 4: Enviar via API correta (Instagram ou WhatsApp)
      const isInstagramChannel = selectedConv.channel === 'instagram';
      const rawPhoneOrId = selectedConv.phoneNumber || selectedConv.id;
      const numeroNormalizado = isInstagramChannel 
        ? rawPhoneOrId.replace(/^ig_/, '').replace(/[^0-9]/g, '') 
        : normalizePhoneForWA(rawPhoneOrId);
      
      console.log('📤 [FASE 4] Enviando via', isInstagramChannel ? 'Instagram' : 'WhatsApp', '...', {
        numero: numeroNormalizado,
        tipo: type,
        fileName: file.name,
        mimeType: file.type,
        temBase64: !!base64Data,
        tamanhoBase64: base64Data.length,
        caption: caption || '[sem legenda]',
        inicio: base64Data.substring(0, 50)
      });
      const quotedPayload = replyingTo && selectedConv.messages.find(m => m.id === replyingTo) ? {
        quoted: {
          key: {
            id: replyingTo
          },
          message: {
            conversation: selectedConv.messages.find(m => m.id === replyingTo)?.content || ''
          }
        },
        quotedMessageId: replyingTo
      } : {};

      let data: any = null;
      let error: any = null;

      if (isInstagramChannel) {
        // 📸 INSTAGRAM: Enviar mídia via edge function dedicada
        console.log('📸 [FASE 4] Enviando mídia via Instagram API...', { publicUrl, type });
        const companyId = userRole?.company_id || (await getCompanyId());
        const res = await supabase.functions.invoke('enviar-instagram', {
          body: {
            recipient_id: numeroNormalizado,
            mensagem: caption || '',
            company_id: companyId,
            tipo_mensagem: type,
            media_url: publicUrl,
          }
        });
        data = res.data;
        error = res.error || (res.data && !res.data.success ? { message: res.data.error || 'Erro ao enviar' } : null);
      } else {
        // 📱 WHATSAPP: Enviar via Evolution/Meta API
        const result = await enviarWhatsApp({
          numero: numeroNormalizado,
          mensagem: caption || '',
          tipo_mensagem: type,
          mediaBase64: base64Data,
          fileName: file.name,
          mimeType: file.type,
          caption: caption || '',
          company_id: userRole?.company_id,
          ...quotedPayload
        });
        data = result.data;
        error = result.error;
      }

      if (error) {
        const canalNome = isInstagramChannel ? 'Instagram' : 'WhatsApp';
        console.error(`❌ Erro ao enviar mídia via ${canalNome}:`, error);
        toast.error(`Erro ao enviar ${type}: ${error.message || 'Erro desconhecido'}`);
        throw error;
      }
      console.log('✅ [FASE 4] Enviado com sucesso');

      // FASE 5: Salvar no banco com URL do Storage
      const {
        data: userProfile
      } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const {
        data: inserted,
        error: dbError
      } = await supabase.from('conversas').insert({
        numero: isInstagramChannel ? numeroNormalizado : numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem: caption || '[Mídia]',
        origem: isInstagramChannel ? 'Instagram' : 'WhatsApp',
        origem_api: isInstagramChannel ? 'meta' : (selectedConv.origemApi || undefined),
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName?.replace(/^ig_/, '') || selectedConv.contactName,
        arquivo_nome: file.name,
        midia_url: publicUrl,
        company_id: userRole?.company_id,
        owner_id: userId,
        sent_by: userProfile?.full_name,
        fromme: true,
        delivered: true,
        read: false
      }).select('id, midia_url').single();

      // ⚡ Log detalhado para debugging
      console.log('📊 [MEDIA-SEND] Tentativa de salvar no banco:', {
        numeroNormalizado,
        type,
        fileName: file.name,
        hasStorageUrl: !!publicUrl,
        storageUrlLength: publicUrl?.length || 0,
        companyId: userRole?.company_id,
        contactName: selectedConv.contactName
      });
      if (dbError) {
        console.error('❌ [MEDIA-SEND] Erro detalhado ao salvar mensagem:', {
          error: dbError,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code
        });
        toast.error('Erro ao salvar mensagem no histórico');
        // Não bloquear o envio mesmo com erro no banco
        console.warn('⚠️ Mídia enviada mas com problema ao salvar no banco');
      } else {
        console.log('✅ [MEDIA-SEND] Mensagem salva no banco:', inserted);
      }

      // ⚡ FASE 3: Usar URL do Storage para exibição
      const newMessage: Message = {
        id: (inserted?.id || Date.now()).toString(),
        content: caption || '[Mídia]',
        type: type as "image" | "audio" | "pdf" | "video",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        mediaUrl: publicUrl,
        // ⚡ FASE 3: Usar URL do Storage
        fileName: file.name,
        mimeType: file.type,
        sentBy: userProfile?.full_name || userName || "Equipe"
      };

      // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp após adicionar nova mensagem
      const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
        return [...messages].sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      };

      // ⚡ CORREÇÃO: Calcular status dinamicamente
      const sortedMessagesWithNew = sortMessagesByTimestamp([...selectedConv.messages, newMessage]);
      const newStatus = calculateConversationStatus(sortedMessagesWithNew);
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        messages: sortedMessagesWithNew,
        lastMessage: newMessage.content,
        status: newStatus,
        unread: 0
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        messages: sortedMessagesWithNew,
        status: newStatus
      });

      // Atualizar status no banco de dados para sincronização em tempo real
      try {
        const telefoneFormatado = selectedConv.phoneNumber?.replace(/[^0-9]/g, '') || selectedConv.id.replace(/[^0-9]/g, '');
        const {
          error: updateError
        } = await supabase.from('conversas').update({
          status: 'Enviada'
        }).eq('telefone_formatado', telefoneFormatado).eq('company_id', userCompanyId);
        if (updateError) {
          console.error('❌ Erro ao atualizar status no banco:', updateError);
        } else {
          console.log('✅ Status atualizado no banco para "Enviada"');
        }
      } catch (error) {
        console.error('❌ Erro ao sincronizar status:', error);
      }

      // já salvo acima

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);

      // Não mostrar notificação ao enviar mídia - apenas logs
      console.log('✅ Mídia enviada com sucesso');
    } catch (error) {
      console.error("❌ Erro ao enviar mídia:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      toast.error("Erro ao enviar mídia");
    }
  };
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!selectedConv) return;
    setSyncStatus('syncing');

    let tempId: string | null = null;
    let localBlobUrl: string | null = null;

    try {
      console.log('🎤 Enviando áudio instantaneamente...');

      const rawMime = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase();
      const { normalizeAudioForMeta } = await import('@/utils/audioConverter');
      const finalAudioBlob = await normalizeAudioForMeta(audioBlob);

      const audioMimeType = (finalAudioBlob.type || 'audio/mpeg').split(';')[0].trim().toLowerCase();
      const audioExtension = audioMimeType.includes('ogg') ? 'ogg' : audioMimeType.includes('mp4') ? 'm4a' : audioMimeType.includes('mpeg') ? 'mp3' : 'webm';
      const storageFileName = `outgoing/${Date.now()}-audio.${audioExtension}`;

      localBlobUrl = URL.createObjectURL(audioBlob);
      tempId = `temp-audio-${Date.now()}`;

      const optimisticMessage: Message = {
        id: tempId,
        content: "[Áudio]",
        type: "audio",
        sender: "user",
        timestamp: new Date(),
        delivered: false,
        read: false,
        mediaUrl: localBlobUrl,
        sentBy: userName || "Equipe"
      };

      const sortMessagesByTimestamp = (messages: Message[]): Message[] => [...messages].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });

      const sortedWithOptimistic = sortMessagesByTimestamp([...selectedConv.messages, optimisticMessage]);
      const newStatus = calculateConversationStatus(sortedWithOptimistic);
      const updatedConvsOptimistic = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        messages: sortedWithOptimistic,
        lastMessage: "[Áudio]",
        status: newStatus,
        unread: 0
      } : conv);
      saveConversations(updatedConvsOptimistic);
      setSelectedConv({ ...selectedConv, messages: sortedWithOptimistic, status: newStatus });
      setSyncStatus('synced');

      const [storageResult, base64, authResult] = await Promise.all([
        supabase.storage.from('conversation-media').upload(storageFileName, finalAudioBlob, {
          contentType: finalAudioBlob.type || audioMimeType,
          upsert: false
        }),
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = (reader.result as string)?.split(',')[1];
            if (!b64) return reject(new Error('Base64 vazio'));
            resolve(b64);
          };
          reader.onerror = () => reject(new Error('Erro ao ler áudio'));
          reader.readAsDataURL(finalAudioBlob);
        }),
        supabase.auth.getUser()
      ]);

      if (storageResult.error) throw new Error('Falha no upload do áudio');

      const { data: urlData } = supabase.storage.from('conversation-media').getPublicUrl(storageFileName);
      const storageUrl = urlData.publicUrl;
      const userId = authResult.data.user?.id;
      const { data: userRole } = await supabase.from('user_roles').select('company_id').eq('user_id', userId).single();

      const isInstagramChannel = selectedConv.channel === 'instagram';
      const rawPhoneOrId = selectedConv.phoneNumber || selectedConv.id;
      const numeroNormalizado = isInstagramChannel ? rawPhoneOrId.replace(/^ig_/, '').replace(/[^0-9]/g, '') : normalizePhoneForWA(rawPhoneOrId);
      const quotedPayload = replyingTo && selectedConv.messages.find(m => m.id === replyingTo)
        ? { quoted: { key: { id: replyingTo }, message: { conversation: selectedConv.messages.find(m => m.id === replyingTo)?.content || '' } }, quotedMessageId: replyingTo }
        : {};

      const { data: userProfile } = userId ? await supabase.from('profiles').select('full_name, email').eq('id', userId).single() : { data: null };

      const apiResult = await (async () => {
        if (isInstagramChannel) {
          const companyId = userRole?.company_id || (await getCompanyId());
          const res = await supabase.functions.invoke('enviar-instagram', {
            body: { recipient_id: numeroNormalizado, mensagem: '', company_id: companyId, tipo_mensagem: 'audio', media_url: storageUrl }
          });
          return { data: res.data, error: res.error || (res.data && !res.data.success ? { message: res.data.error } : null) };
        }

        const result = await enviarWhatsApp({
          numero: numeroNormalizado,
          mensagem: '',
          tipo_mensagem: 'audio',
          mediaBase64: base64,
          fileName: `audio.${audioExtension}`,
          mimeType: finalAudioBlob.type || audioMimeType,
          caption: '',
          company_id: userRole?.company_id,
          ...quotedPayload
        });
        return { data: result.data, error: result.error };
      })();

      if (apiResult.error) throw new Error(apiResult.error?.message || 'Erro ao enviar áudio');

      const whatsappMessageId = apiResult.data?.message_id || apiResult.data?.data?.messages?.[0]?.id || apiResult.data?.data?.key?.id || null;
      if (!isInstagramChannel && !whatsappMessageId) throw new Error('Envio sem confirmação do provedor (message_id ausente).');

      const dbResult = await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem: '[Áudio]',
        origem: isInstagramChannel ? 'Instagram' : 'WhatsApp',
        origem_api: isInstagramChannel ? 'meta' : (selectedConv.origemApi || undefined),
        status: 'Enviada',
        tipo_mensagem: 'audio',
        nome_contato: selectedConv.contactName?.replace(/^ig_/, '') || selectedConv.contactName,
        arquivo_nome: `audio.${audioExtension}`,
        midia_url: storageUrl,
        company_id: userRole?.company_id,
        owner_id: userId,
        sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
        whatsapp_message_id: whatsappMessageId,
        fromme: true,
        delivered: false,
        read: false
      }]).select('id, midia_url').single();

      const inserted = dbResult.data;
      const finalMessage: Message = {
        id: (inserted?.id || tempId).toString(),
        content: '[Áudio]',
        type: 'audio',
        sender: 'user',
        timestamp: new Date(),
        delivered: false,
        read: false,
        mediaUrl: storageUrl,
        sentBy: userName || 'Equipe'
      };

      const finalMessages = sortMessagesByTimestamp(selectedConv.messages.filter(m => m.id !== tempId).concat(finalMessage));
      const finalStatus = calculateConversationStatus(finalMessages);
      const finalConvs = conversations.map(conv => conv.id === selectedConv.id ? { ...conv, messages: finalMessages, lastMessage: '[Áudio]', status: finalStatus, unread: 0 } : conv);
      saveConversations(finalConvs);
      setSelectedConv(prev => prev?.id === selectedConv.id ? { ...prev, messages: finalMessages, status: finalStatus } : prev);

      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);

      // Não iniciar transcrição automática para áudio enviado pelo usuário
      // (evita erro de transcrição ser confundido com erro de envio).

      setTimeout(() => setSyncStatus('idle'), 1000);
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);

      if (tempId && selectedConv) {
        const cleanedMessages = selectedConv.messages.filter(m => m.id !== tempId);
        const updatedConvs = conversations.map(conv => conv.id === selectedConv.id ? { ...conv, messages: cleanedMessages, lastMessage: (cleanedMessages.length > 0 ? cleanedMessages[cleanedMessages.length - 1]?.content : '') || '' } : conv);
        saveConversations(updatedConvs);
        setSelectedConv(prev => prev?.id === selectedConv.id ? { ...prev, messages: cleanedMessages } : prev);
      }

      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);

      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar áudio';
      toast.error(errorMessage || 'Erro ao enviar áudio');
      return;
    }
  };

  // 📁 DRAG-AND-DROP: Handlers para arrastar e soltar arquivos
  const getFileType = (file: File): string => {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
    
    // Planilhas (Excel, CSV, ODS)
    const spreadsheetMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
      'text/comma-separated-values'
    ];
    const spreadsheetExtensions = ['xlsx', 'xls', 'csv', 'ods'];
    if (spreadsheetMimes.includes(mimeType) || spreadsheetExtensions.includes(extension || '')) {
      return 'document'; // WhatsApp envia planilhas como documento
    }
    
    return 'document';
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    if (!selectedConv) {
      toast.error("Selecione uma conversa primeiro");
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Processar cada arquivo
    for (const file of files) {
      // Validar tamanho (máximo 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Arquivo "${file.name}" é muito grande. Máximo: 20MB`);
        continue;
      }

      const fileType = getFileType(file);
      console.log('📁 [DROP] Arquivo solto:', { name: file.name, type: fileType, size: file.size });
      
      try {
        await handleSendMedia(file, '', fileType);
        toast.success(`Arquivo "${file.name}" enviado!`);
      } catch (err) {
        console.error('❌ [DROP] Erro ao enviar arquivo:', err);
        toast.error(`Erro ao enviar "${file.name}"`);
      }
    }
  }, [selectedConv, handleSendMedia]);

  // ⚡ FUNÇÃO PARA CALCULAR STATUS BASEADO NA ÚLTIMA MENSAGEM
  const calculateConversationStatus = (messages: Message[]): "waiting" | "answered" | "resolved" => {
    if (!messages || messages.length === 0) return "waiting";

    // Ordenar mensagens por timestamp para garantir que pegamos a última
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    const ultimaMensagem = sortedMessages[sortedMessages.length - 1];

    // Se a última mensagem foi do contato, está aguardando resposta
    if (ultimaMensagem.sender === "contact") {
      return "waiting";
    }

    // Se a última mensagem foi do usuário, foi respondida
    if (ultimaMensagem.sender === "user") {
      return "answered";
    }
    return "waiting";
  };
  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    let messageContent = content || messageInput.trim();
    if (!messageContent || !selectedConv) return;
    if (sendingMessageRef.current) return;

    sendingMessageRef.current = true;
    setIsSendingMessage(true);

    const conversationSnapshot = {
      id: selectedConv.id,
      phoneNumber: selectedConv.phoneNumber,
      contactName: selectedConv.contactName,
      channel: selectedConv.channel,
      origemApi: selectedConv.origemApi,
      messages: selectedConv.messages,
    };
    const currentReplyingTo = replyingTo;

    try {
      const telefoneFormatado = (conversationSnapshot.phoneNumber || conversationSnapshot.id).replace(/[^0-9]/g, '');

      void (async () => {
        try {
          await startOrRefreshAttendance(telefoneFormatado);
          await createProtocol(telefoneFormatado, {
            startedBy: 'humano',
            contactName: conversationSnapshot.contactName || undefined,
          });
          console.log('✅ [ATTENDANCE] Atendimento e protocolo registrados para:', telefoneFormatado);
        } catch (err) {
          console.error('❌ [ATTENDANCE] Erro ao registrar atendimento:', err);
        }
      })();

      if (autoCorrectEnabled && type === "text" && messageContent.length >= 5 && !content) {
        try {
          setIsCorrectingText(true);
          console.log('🔤 [CORREÇÃO] Iniciando correção automática do texto...');

          const { data, error } = await supabase.functions.invoke('corrigir-texto', {
            body: { texto: messageContent }
          });

          if (!error && data?.textoCorrigido) {
            if (data.corrigido) {
              console.log('✅ [CORREÇÃO] Texto corrigido:', data.textoCorrigido.substring(0, 50) + '...');
            }
            messageContent = data.textoCorrigido;
          } else {
            console.warn('⚠️ [CORREÇÃO] Erro ou sem resposta, usando texto original');
          }
        } catch (err) {
          console.error('❌ [CORREÇÃO] Erro ao corrigir texto:', err);
        } finally {
          setIsCorrectingText(false);
        }
      }

      if (includeSignature && type === "text" && userName) {
        messageContent = `*Atendente - ${userName}*\n\n${messageContent}`;
        console.log('✍️ [ASSINATURA] Assinatura adicionada no topo: *Atendente -', userName, '*');
      }

      console.log('📤 [ENVIO] Iniciando envio de mensagem:', {
        conteudo: messageContent.substring(0, 50),
        tipo: type,
        conversaId: conversationSnapshot.id,
        timestamp: new Date().toISOString()
      });

      if (conversationSnapshot.channel !== 'instagram') {
        try {
          const phoneToValidate = conversationSnapshot.phoneNumber || conversationSnapshot.id;
          const formattedPhone = formatPhoneNumber(phoneToValidate);
          console.log('✅ [VALIDAÇÃO] Número validado:', formattedPhone);
        } catch (error: any) {
          console.error('❌ [VALIDAÇÃO] Erro ao validar número:', error);
          toast.error('Número de telefone inválido. Selecione outra conversa ou atualize a página.');
          return;
        }
      } else {
        console.log('📸 [VALIDAÇÃO] Instagram - pulando validação de telefone');
      }

      setMessageInput("");

      void supabase
        .from('conversas')
        .update({ status: 'Enviada' })
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userCompanyId)
        .then(({ error }) => {
          if (error) console.error('❌ Erro ao sincronizar status:', error);
        });

      const mensagemParaEnviar = currentReplyingTo && conversationSnapshot.messages.find(m => m.id === currentReplyingTo) ? {
        mensagem: messageContent,
        quoted: {
          key: { id: currentReplyingTo },
          message: {
            conversation: conversationSnapshot.messages.find(m => m.id === currentReplyingTo)?.content || ''
          }
        }
      } : {
        mensagem: messageContent
      };

      const isInstagramConv = conversationSnapshot.channel === 'instagram';
      const rawPhoneOrId = conversationSnapshot.phoneNumber || conversationSnapshot.id;
      const instagramId = rawPhoneOrId.replace(/^ig_/, '').replace(/[^0-9]/g, '');
      const numeroNormalizado = isInstagramConv ? instagramId : normalizePhoneForWA(rawPhoneOrId);
      let mensagemSalva = false;
      let insertedMsgId: string | null = null;

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (user) {
          const [{ data: userProfile }, { data: userRole }] = await Promise.all([
            supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
            supabase.from('user_roles').select('company_id').eq('user_id', user.id).single(),
          ]);

          const sentByName = userProfile?.full_name || userProfile?.email || 'Equipe';
          const repliedMessage = currentReplyingTo ? conversationSnapshot.messages.find(m => m.id === currentReplyingTo)?.content : null;
          const numeroOriginal = isInstagramConv ? instagramId : (conversationSnapshot.phoneNumber || conversationSnapshot.id);

          if (userRole?.company_id) {
            const { data: insertedMsg, error: dbError } = await supabase
              .from('conversas')
              .insert([{
                numero: numeroOriginal,
                telefone_formatado: numeroNormalizado,
                mensagem: messageContent,
                origem: conversationSnapshot.channel === 'instagram' ? 'Instagram' : 'WhatsApp',
                origem_api: conversationSnapshot.channel === 'instagram' ? 'meta' : (conversationSnapshot.origemApi || undefined),
                status: 'Enviada',
                tipo_mensagem: type,
                nome_contato: conversationSnapshot.contactName?.replace(/^ig_/, '') || conversationSnapshot.contactName,
                company_id: userRole.company_id,
                owner_id: user.id,
                sent_by: sentByName,
                fromme: true,
                replied_to_message: repliedMessage || null,
                delivered: true,
                read: false
              }])
              .select('id')
              .single();

            if (!dbError && insertedMsg) {
              mensagemSalva = true;
              insertedMsgId = insertedMsg.id;
              console.log('✅ [ENVIO] Mensagem salva no banco com sucesso (UI liberada antes da entrega), id:', insertedMsgId);
            } else {
              console.error('❌ [ENVIO] Erro ao salvar mensagem no banco:', dbError);
            }
          }
        }
      } catch (saveError) {
        console.error('❌ [ENVIO] Erro ao salvar mensagem no banco:', saveError);
      }

      if (currentReplyingTo) {
        setReplyingTo(null);
      }

      void (async () => {
        try {
          let data: any = null;
          let error: any = null;

          if (conversationSnapshot.channel === 'instagram') {
            console.log('📸 [ENVIO-INSTAGRAM] Enviando via Instagram API...');
            const companyId = await getCompanyId();
            const res = await supabase.functions.invoke('enviar-instagram', {
              body: {
                recipient_id: instagramId,
                mensagem: messageContent,
                company_id: companyId,
              }
            });
            data = res.data;
            error = res.error || (res.data && !res.data.success ? { message: res.data.error || 'Erro ao enviar' } : null);
          } else {
            const result = await enviarWhatsApp({
              numero: numeroNormalizado,
              ...mensagemParaEnviar,
              quotedMessageId: currentReplyingTo || undefined,
              tipo_mensagem: type,
              force_provider: conversationSnapshot.origemApi,
            });
            data = result.data;
            error = result.error;
          }

          const whatsappMsgId = (data as any)?.message_id || (data as any)?.data?.messages?.[0]?.id || (data as any)?.data?.key?.id;
          if (whatsappMsgId && insertedMsgId) {
            const { error: updateErr } = await supabase
              .from('conversas')
              .update({ whatsapp_message_id: whatsappMsgId })
              .eq('id', insertedMsgId);

            if (updateErr) console.error('❌ Erro ao salvar whatsapp_message_id:', updateErr);
          }

          if (error) {
            const canalNome = conversationSnapshot.channel === 'instagram' ? 'Instagram' : 'WhatsApp';
            console.error(`❌ [ENVIO] Erro ao enviar mensagem via ${canalNome}:`, error);
            if (mensagemSalva) {
              toast.warning(`Mensagem salva, mas pode não ter sido enviada. Verifique a conexão ${canalNome}.`);
              setTimeout(() => {
                void loadSupabaseConversations();
              }, 500);
            } else {
              toast.error(`Erro ao enviar mensagem: ${error.message || 'Erro desconhecido'}`);
            }
            return;
          }

          if (!mensagemSalva) {
            console.log('⚠️ [ENVIO] Mensagem não foi salva antes, salvando agora...');
            const {
              data: { user }
            } = await supabase.auth.getUser();

            if (user) {
              const [{ data: userProfile }, { data: userRole }] = await Promise.all([
                supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
                supabase.from('user_roles').select('company_id').eq('user_id', user.id).single(),
              ]);

              if (userRole?.company_id) {
                const repliedMessage = currentReplyingTo ? conversationSnapshot.messages.find(m => m.id === currentReplyingTo)?.content : null;
                const sentByName = userProfile?.full_name || userProfile?.email || 'Equipe';
                const numeroOriginal = isInstagramConv ? instagramId : (conversationSnapshot.phoneNumber || conversationSnapshot.id);

                await supabase.from('conversas').insert([{
                  numero: numeroOriginal,
                  telefone_formatado: numeroNormalizado,
                  mensagem: messageContent,
                  origem: conversationSnapshot.channel === 'instagram' ? 'Instagram' : 'WhatsApp',
                  origem_api: conversationSnapshot.channel === 'instagram' ? 'meta' : (conversationSnapshot.origemApi || undefined),
                  status: 'Enviada',
                  tipo_mensagem: type,
                  nome_contato: conversationSnapshot.contactName?.replace(/^ig_/, '') || conversationSnapshot.contactName,
                  company_id: userRole.company_id,
                  owner_id: user.id,
                  sent_by: sentByName,
                  fromme: true,
                  replied_to_message: repliedMessage || null,
                  delivered: true,
                  read: false
                }]);
              }
            }
          }

          if (mensagemSalva) {
            setTimeout(() => {
              void loadSupabaseConversations();
            }, 500);
          }
        } catch (backgroundError) {
          console.error('❌ [ENVIO] Erro em background ao concluir envio:', backgroundError);
          toast.error('A mensagem foi registrada, mas houve erro ao concluir o envio.');
        }
      })();
    } finally {
      sendingMessageRef.current = false;
      setIsSendingMessage(false);
    }
  };
  const handleFileAttach = (type: "image" | "audio" | "pdf") => {
    toast.info(`Anexando ${type}...`);
    setTimeout(() => {
      handleSendMessage(`Arquivo ${type} anexado`, type);
    }, 1000);
  };

  // Função para converter arquivo para base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };
  const addQuickMessage = async () => {
    if (!newQuickTitle || !newQuickCategory) {
      toast.error("Preencha título e selecione uma categoria");
      return;
    }

    // Validar conteúdo baseado no tipo
    if (newQuickMessageType === "text" && !newQuickContent.trim()) {
      toast.error("Digite a mensagem de texto");
      return;
    }
    if ((newQuickMessageType === "image" || newQuickMessageType === "video" || newQuickMessageType === "audio" || newQuickMessageType === "document") && !newQuickMediaFile) {
      toast.error("Selecione um arquivo de mídia");
      return;
    }
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      const {
        data: companyData
      } = await supabase.rpc('get_my_company_id');
      if (!companyData) throw new Error('Company não encontrada');
      let mediaUrl = "";

      // Converter mídia para base64 se houver
      if (newQuickMediaFile) {
        try {
          mediaUrl = await convertFileToBase64(newQuickMediaFile);
        } catch (error) {
          toast.error("Erro ao processar arquivo de mídia");
          return;
        }
      }
      const {
        error
      } = await supabase.from('quick_messages').insert({
        company_id: companyData,
        owner_id: user.id,
        title: newQuickTitle,
        content: newQuickContent || (newQuickMessageType === "image" ? "[Imagem]" : newQuickMessageType === "video" ? "[Vídeo]" : newQuickMessageType === "audio" ? "[Áudio]" : newQuickMessageType === "document" ? "[Documento]" : ""),
        category_id: newQuickCategory,
        message_type: newQuickMessageType,
        media_url: mediaUrl || null
      });
      if (error) throw error;
      await loadQuickMessages();
      setNewQuickTitle("");
      setNewQuickContent("");
      setNewQuickCategory("");
      setNewQuickMessageType("text");
      setNewQuickMediaFile(null);
      setNewQuickMediaPreview(null);
      toast.success("Mensagem rápida criada!");
    } catch (error) {
      console.error('Erro ao criar mensagem rápida:', error);
      toast.error("Erro ao criar mensagem rápida");
    }
  };
  const addQuickCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      const {
        data: companyData
      } = await supabase.rpc('get_my_company_id');
      if (!companyData) throw new Error('Company não encontrada');
      const {
        error
      } = await supabase.from('quick_message_categories').insert({
        company_id: companyData,
        owner_id: user.id,
        name: newCategoryName
      });
      if (error) throw error;
      await loadQuickCategories();
      setNewCategoryName("");
      toast.success("Categoria criada!");
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast.error("Erro ao criar categoria");
    }
  };
  const deleteQuickMessage = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('quick_messages').delete().eq('id', id);
      if (error) throw error;
      await loadQuickMessages();
      toast.success("Mensagem rápida removida!");
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      toast.error("Erro ao remover mensagem");
    }
  };
  const deleteQuickCategory = async (id: string) => {
    // Verificar se há mensagens usando esta categoria
    const messagesInCategory = quickMessages.filter(m => m.category === id);
    if (messagesInCategory.length > 0) {
      toast.error("Não é possível excluir categoria com mensagens vinculadas");
      return;
    }
    try {
      const {
        error
      } = await supabase.from('quick_message_categories').delete().eq('id', id);
      if (error) throw error;
      await loadQuickCategories();
      toast.success("Categoria removida!");
    } catch (error) {
      console.error('Erro ao deletar categoria:', error);
      toast.error("Erro ao remover categoria");
    }
  };
  const sendQuickMessage = async (message: QuickMessage) => {
    if (message.type === "image" || message.type === "video" || message.type === "audio" || message.type === "document") {
      // Enviar mídia
      if (!message.mediaUrl) {
        toast.error("Mídia não encontrada na mensagem rápida");
        return;
      }
      try {
        // Detectar mimeType da data URL (formato: data:image/jpeg;base64,...)
        let mimeType = message.mimeType || (message.type === 'audio' ? 'audio/mpeg' : message.type === 'document' ? 'application/pdf' : 'image/jpeg');
        let base64Data = message.mediaUrl;
        if (message.mediaUrl.includes('data:') && message.mediaUrl.includes(';base64,')) {
          const mimeMatch = message.mediaUrl.match(/data:([^;]+);base64,/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          base64Data = message.mediaUrl.split(',')[1];
        } else if (message.mediaUrl.includes(',')) {
          base64Data = message.mediaUrl.split(',')[1];
        }
        if (!base64Data) {
          toast.error("Formato de mídia inválido");
          return;
        }

        // Criar arquivo temporário a partir do base64
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: mimeType
        });

        // Gerar nome de arquivo baseado no tipo
        const extMap: Record<string, string> = { image: 'jpg', video: 'mp4', audio: 'mp3', document: 'pdf' };
        const extension = mimeType.split('/')[1] || extMap[message.type] || 'bin';
        const fileName = message.fileName || `quick_media_${Date.now()}.${extension}`;
        const file = new File([blob], fileName, {
          type: mimeType
        });
        console.log('📤 [QUICK-MESSAGE] Enviando mídia:', {
          type: message.type,
          mimeType,
          fileName,
          size: file.size
        });

        // Enviar mídia usando handleSendMedia
        await handleSendMedia(file, message.content, message.type);
      } catch (error) {
        console.error('❌ Erro ao processar mídia da mensagem rápida:', error);
        toast.error("Erro ao processar mídia. Verifique se o arquivo está correto.");
      }
    } else {
      // Enviar texto
      handleSendMessage(message.content);
    }
  };

  // Função para editar mensagem rápida
  const editQuickMessage = (id: string) => {
    const message = quickMessages.find(m => m.id === id);
    if (message) {
      setEditingMessageId(id);
      setEditMessageTitle(message.title);
      setEditMessageContent(message.content);
      setEditMessageCategory(message.category);
      setEditMessageType(message.type || "text");
      setEditMessageMediaPreview(message.mediaUrl || null);
      setEditMessageMediaFile(null); // Resetar arquivo novo
    }
  };

  // Função para salvar edição de mensagem
  const saveEditedMessage = async () => {
    if (!editingMessageId || !editMessageTitle || !editMessageCategory) {
      toast.error("Preencha título e selecione uma categoria");
      return;
    }

    // Validar conteúdo baseado no tipo
    if (editMessageType === "text" && !editMessageContent.trim()) {
      toast.error("Digite a mensagem de texto");
      return;
    }
    if ((editMessageType === "image" || editMessageType === "video") && !editMessageMediaFile && !editMessageMediaPreview) {
      toast.error("Selecione um arquivo de mídia ou mantenha o existente");
      return;
    }
    try {
      let mediaUrl = editMessageMediaPreview || "";

      // Se houver novo arquivo, converter para base64
      if (editMessageMediaFile) {
        try {
          mediaUrl = await convertFileToBase64(editMessageMediaFile);
        } catch (error) {
          toast.error("Erro ao processar arquivo de mídia");
          return;
        }
      }
      const {
        error
      } = await supabase.from('quick_messages').update({
        title: editMessageTitle,
        content: editMessageContent || (editMessageType === "image" ? "[Imagem]" : editMessageType === "video" ? "[Vídeo]" : ""),
        category_id: editMessageCategory,
        message_type: editMessageType,
        media_url: mediaUrl || null
      }).eq('id', editingMessageId);
      if (error) throw error;
      await loadQuickMessages();
      setEditingMessageId(null);
      setEditMessageTitle("");
      setEditMessageContent("");
      setEditMessageCategory("");
      setEditMessageType("text");
      setEditMessageMediaFile(null);
      setEditMessageMediaPreview(null);
      toast.success("Mensagem editada com sucesso!");
    } catch (error) {
      console.error('Erro ao editar mensagem:', error);
      toast.error("Erro ao editar mensagem");
    }
  };

  // Função para cancelar edição de mensagem
  // Função para cancelar edição de mensagem
  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditMessageTitle("");
    setEditMessageContent("");
    setEditMessageCategory("");
    setEditMessageType("text");
    setEditMessageMediaFile(null);
    setEditMessageMediaPreview(null);
  };

  // Função para editar categoria
  const editQuickCategory = (id: string) => {
    const category = quickCategories.find(c => c.id === id);
    if (category) {
      setEditingCategoryId(id);
      setEditCategoryName(category.name);
    }
  };

  // Função para salvar edição de categoria
  const saveEditedCategory = async () => {
    if (!editingCategoryId || !editCategoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    try {
      const {
        error
      } = await supabase.from('quick_message_categories').update({
        name: editCategoryName
      }).eq('id', editingCategoryId);
      if (error) throw error;
      await loadQuickCategories();
      setEditingCategoryId(null);
      setEditCategoryName("");
      toast.success("Categoria editada com sucesso!");
    } catch (error) {
      console.error('Erro ao editar categoria:', error);
      toast.error("Erro ao editar categoria");
    }
  };

  // Função para cancelar edição de categoria
  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName("");
  };

  // Função para mover mensagem para cima
  const moveMessageUp = (id: string, categoryId: string) => {
    // Obter todas as mensagens da categoria na ordem atual
    const categoryMessages = quickMessages.filter(m => m.category === categoryId);
    const otherMessages = quickMessages.filter(m => m.category !== categoryId);
    const currentIndex = categoryMessages.findIndex(m => m.id === id);
    if (currentIndex <= 0) return; // Já está no topo

    // Reordenar mensagens da categoria
    const reordered = [...categoryMessages];
    [reordered[currentIndex], reordered[currentIndex - 1]] = [reordered[currentIndex - 1], reordered[currentIndex]];

    // Reconstruir array completo mantendo ordem: outras categorias + categoria reordenada
    const updated = [...otherMessages, ...reordered];
    saveQuickMessages(updated);
    toast.success("Mensagem movida para cima!");
  };

  // Função para mover mensagem para baixo
  const moveMessageDown = (id: string, categoryId: string) => {
    // Obter todas as mensagens da categoria na ordem atual
    const categoryMessages = quickMessages.filter(m => m.category === categoryId);
    const otherMessages = quickMessages.filter(m => m.category !== categoryId);
    const currentIndex = categoryMessages.findIndex(m => m.id === id);
    if (currentIndex >= categoryMessages.length - 1) return; // Já está no final

    // Reordenar mensagens da categoria
    const reordered = [...categoryMessages];
    [reordered[currentIndex], reordered[currentIndex + 1]] = [reordered[currentIndex + 1], reordered[currentIndex]];

    // Reconstruir array completo mantendo ordem: outras categorias + categoria reordenada
    const updated = [...otherMessages, ...reordered];
    saveQuickMessages(updated);
    toast.success("Mensagem movida para baixo!");
  };

  // Função para mover categoria para cima
  const moveCategoryUp = (id: string) => {
    const currentIndex = quickCategories.findIndex(c => c.id === id);
    if (currentIndex <= 0) return; // Já está no topo

    const updated = [...quickCategories];
    [updated[currentIndex], updated[currentIndex - 1]] = [updated[currentIndex - 1], updated[currentIndex]];
    saveQuickCategories(updated);
    toast.success("Categoria movida para cima!");
  };

  // Função para mover categoria para baixo
  const moveCategoryDown = (id: string) => {
    const currentIndex = quickCategories.findIndex(c => c.id === id);
    if (currentIndex >= quickCategories.length - 1) return; // Já está no final

    const updated = [...quickCategories];
    [updated[currentIndex], updated[currentIndex + 1]] = [updated[currentIndex + 1], updated[currentIndex]];
    saveQuickCategories(updated);
    toast.success("Categoria movida para baixo!");
  };
  const addReminder = async () => {
    if (!selectedConv || !reminderTitle.trim() || !reminderDatetime) {
      toast.error("Preencha o título e a data/hora");
      return;
    }

    // Se enviar está ativado, precisa ter mensagem
    if (reminderEnviar && !reminderMessage.trim()) {
      toast.error("Por favor, escreva a mensagem que será enviada");
      return;
    }

    // ⚠️ IMPORTANTE: Não criar lead automaticamente
    // Lead só será criado quando usuário clicar em "Adicionar ao CRM"
    if (!leadVinculado?.id) {
      console.log('ℹ️ Lead não vinculado - aguardando ação manual do usuário');
      toast.error("Por favor, adicione o contato ao CRM antes de criar um compromisso");
      return;
    }
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do lead vinculado
      const companyId = leadVinculado.company_id;
      if (!companyId) {
        toast.error("Lead sem company_id associado");
        return;
      }

      // Verificar se a data já passou
      const dataHoraCompromisso = new Date(reminderDatetime);
      const agora = new Date();
      if (dataHoraCompromisso <= agora) {
        toast.error("A data/hora do lembrete já passou. Por favor, escolha uma data futura.");
        return;
      }

      // Buscar dados do responsável (usuário atual)
      const {
        data: profile
      } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();

      // Criar compromisso
      const {
        data: compromisso,
        error: compromissoError
      } = await supabase.from('compromissos').insert({
        lead_id: leadVinculado.id as string,
        usuario_responsavel_id: user.id,
        owner_id: user.id,
        company_id: companyId,
        data_hora_inicio: dataHoraCompromisso.toISOString(),
        data_hora_fim: new Date(dataHoraCompromisso.getTime() + 60 * 60 * 1000).toISOString(),
        tipo_servico: reminderTitle,
        observacoes: reminderNotes,
        status: 'agendado'
      }).select().single();
      if (compromissoError) throw compromissoError;

      // Se envio de mensagem está ativado, criar o(s) lembrete(s)
      if (reminderEnviar) {
        const dataEnvio = new Date(reminderDatetime);
        const telefoneDestino = leadVinculado.phone || leadVinculado.telefone || null;

        // Upload de mídia se existir
        let midiaUrl: string | null = null;
        if (reminderMediaFile) {
          try {
            const fileExt = reminderMediaFile.name.split('.').pop();
            const fileName = `reminder_${Date.now()}.${fileExt}`;
            const filePath = `${companyId}/${fileName}`;
            const {
              data: uploadData,
              error: uploadError
            } = await supabase.storage.from('conversation-media').upload(filePath, reminderMediaFile);
            if (uploadError) {
              console.error('Erro ao fazer upload da mídia:', uploadError);
              toast.warning("Lembrete será criado sem mídia - erro no upload");
            } else {
              const {
                data: urlData
              } = supabase.storage.from('conversation-media').getPublicUrl(filePath);
              midiaUrl = urlData.publicUrl;
              console.log('✅ Mídia do lembrete uploaded:', midiaUrl);
            }
          } catch (uploadErr) {
            console.error('Erro ao fazer upload:', uploadErr);
          }
        }

        // Criar lembretes baseado no destinatário escolhido
        const lembretesCriar = [];

        // Lembrete para o Lead
        if (reminderDestinatario === 'lead' || reminderDestinatario === 'ambos') {
          if (telefoneDestino) {
            lembretesCriar.push({
              compromisso_id: compromisso.id,
              canal: 'whatsapp',
              horas_antecedencia: 0,
              data_envio: dataEnvio.toISOString(),
              data_hora_envio: dataEnvio.toISOString(),
              proxima_data_envio: dataEnvio.toISOString(),
              mensagem: reminderMessage,
              midia_url: midiaUrl,
              status_envio: 'pendente',
              destinatario: 'lead',
              telefone_responsavel: telefoneDestino,
              company_id: companyId,
              recorrencia: reminderRecorrencia || null,
              ativo: true
            });
          } else {
            toast.warning("Lead sem telefone cadastrado - lembrete para lead não será enviado");
          }
        }

        // Lembrete para o Responsável
        if (reminderDestinatario === 'responsavel' || reminderDestinatario === 'ambos') {
          // Buscar telefone do responsável no perfil do profissional
          const {
            data: profissional
          } = await supabase.from('profissionais').select('telefone').eq('user_id', user.id).maybeSingle();
          const telefoneResponsavel = profissional?.telefone || null;
          if (telefoneResponsavel) {
            // Mensagem personalizada para o responsável
            const mensagemResponsavel = `🔔 Lembrete: ${reminderTitle}\n\nCliente: ${leadVinculado.name}\n\n${reminderMessage}`;
            lembretesCriar.push({
              compromisso_id: compromisso.id,
              canal: 'whatsapp',
              horas_antecedencia: 0,
              data_envio: dataEnvio.toISOString(),
              data_hora_envio: dataEnvio.toISOString(),
              proxima_data_envio: dataEnvio.toISOString(),
              mensagem: mensagemResponsavel,
              midia_url: midiaUrl,
              status_envio: 'pendente',
              destinatario: 'responsavel',
              telefone_responsavel: telefoneResponsavel,
              company_id: companyId,
              recorrencia: reminderRecorrencia || null,
              ativo: true
            });
          } else {
            toast.warning("Responsável sem telefone cadastrado - lembrete não será enviado para você");
          }
        }

        // Inserir lembretes principais
        if (lembretesCriar.length > 0) {
          const {
            data: lembretePrincipal,
            error: lembreteError
          } = await supabase.from('lembretes').insert(lembretesCriar).select();
          
          if (lembreteError) {
            console.error('Erro ao criar lembrete:', lembreteError);
            toast.warning("Compromisso criado, mas houve erro ao criar lembrete de envio");
          } else if (lembretePrincipal && lembretePrincipal.length > 0) {
            // Criar lembretes antecipados se configurados
            const lembretesAntecipados = reminderLembretesAntecipados.filter(la => la.ativo);
            
            if (lembretesAntecipados.length > 0) {
              const lembretesAntecipCriar = lembretesAntecipados.map((la, index) => {
                const dataEnvioAntecipado = new Date(reminderDatetime);
                dataEnvioAntecipado.setDate(dataEnvioAntecipado.getDate() - la.dias);
                
                return {
                  compromisso_id: compromisso.id,
                  canal: 'whatsapp',
                  horas_antecedencia: la.dias * 24,
                  data_envio: dataEnvioAntecipado.toISOString(),
                  data_hora_envio: dataEnvioAntecipado.toISOString(),
                  proxima_data_envio: dataEnvioAntecipado.toISOString(),
                  mensagem: la.mensagem,
                  midia_url: null,
                  status_envio: 'pendente',
                  destinatario: reminderDestinatario,
                  telefone_responsavel: lembretesCriar[0].telefone_responsavel,
                  company_id: companyId,
                  recorrencia: null,
                  ativo: true,
                  lembrete_principal_id: lembretePrincipal[0].id,
                  dias_antecedencia: la.dias,
                  sequencia_envio: index + 1,
                  tipo_lembrete: 'antecipado'
                };
              });

              const { error: antecipError } = await supabase.from('lembretes').insert(lembretesAntecipCriar);
              if (antecipError) {
                console.error('Erro ao criar lembretes antecipados:', antecipError);
                toast.warning("Lembrete principal criado, mas houve erro nos lembretes antecipados");
              } else {
                console.log(`✅ ${lembretesAntecipados.length} lembretes antecipados criados`);
              }
            }
          }
        }
      }

      // Limpar campos
      setReminderTitle("");
      setReminderDatetime("");
      setReminderNotes("");
      setReminderMessage("");
      setReminderDestinatario("lead");
      setReminderEnviar(true);
      setReminderRecorrencia("");
      setReminderMediaFile(null);
      setReminderMediaPreview(null);
      setReminderLembretesAntecipados([]);
      
      const totalLembretes = 1 + reminderLembretesAntecipados.filter(la => la.ativo).length;
      const mensagemSucesso = reminderEnviar 
        ? `Lembrete criado! ${totalLembretes > 1 ? `${totalLembretes} mensagens serão enviadas` : 'Mensagem será enviada'} na(s) data(s) programada(s).` 
        : "Lembrete criado! (sem envio de mensagem)";
      toast.success(mensagemSucesso);
      loadReminders();
    } catch (error) {
      console.error('Erro ao criar lembrete:', error);
      toast.error("Erro ao criar lembrete");
    }
  };
  const scheduleMessage = async () => {
    if (!selectedConv || !scheduledContent.trim() || !scheduledDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    try {
      const scheduledDate = new Date(scheduledDatetime);
      const now = new Date();

      // Validar se a data está no futuro (sem restrição mínima de tempo)
      if (scheduledDate <= now) {
        toast.error("A data deve ser no futuro");
        return;
      }
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }
      const {
        data: userRole
      } = await supabase.from("user_roles").select("company_id").eq("user_id", session.user.id).maybeSingle();
      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }
      const phoneNumber = selectedConv.phoneNumber || selectedConv.id;
      const {
        error
      } = await supabase.from('scheduled_whatsapp_messages').insert([{
        company_id: userRole.company_id,
        owner_id: session.user.id,
        conversation_id: selectedConv.id,
        phone_number: phoneNumber,
        contact_name: selectedConv.contactName,
        message_content: includeSignature && userName 
          ? `*Atendente - ${userName}*\n\n${scheduledContent}` 
          : scheduledContent,
        scheduled_datetime: scheduledDate.toISOString(),
        status: 'pending'
      }]);
      if (error) {
        console.error('❌ Erro ao agendar mensagem:', error);
        toast.error('Erro ao agendar mensagem');
        return;
      }

      // Calcular tempo até o envio
      const minutosAteEnvio = Math.round((scheduledDate.getTime() - now.getTime()) / (1000 * 60));
      const horasAteEnvio = Math.floor(minutosAteEnvio / 60);
      const minutosRestantes = minutosAteEnvio % 60;
      let tempoMensagem = "";
      if (horasAteEnvio > 0) {
        tempoMensagem = `em ${horasAteEnvio}h${minutosRestantes > 0 ? ` e ${minutosRestantes}min` : ''}`;
      } else {
        tempoMensagem = `em ${minutosRestantes} minuto${minutosRestantes !== 1 ? 's' : ''}`;
      }
      console.log('✅ Mensagem agendada com sucesso para:', scheduledDate.toISOString());
      toast.success(`Mensagem agendada para ser enviada ${tempoMensagem}!`);
      setScheduledContent("");
      setScheduledDatetime("");

      // Recarregar lista de mensagens agendadas
      await carregarMensagensAgendadas();
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao agendar mensagem');
    }
  };
  const carregarMensagensAgendadas = async () => {
    if (!selectedConv) return;
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) return;
      const {
        data: userRole
      } = await supabase.from("user_roles").select("company_id").eq("user_id", session.user.id).maybeSingle();
      if (!userRole?.company_id) return;
      const phoneNumber = selectedConv.phoneNumber || selectedConv.id;
      const {
        data,
        error
      } = await supabase.from('scheduled_whatsapp_messages').select('*').eq('company_id', userRole.company_id).eq('phone_number', phoneNumber).order('scheduled_datetime', {
        ascending: true
      });
      if (!error && data) {
        console.log('📅 Mensagens agendadas:', data.length);
        setScheduledMessages(data);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens agendadas:', error);
    }
  };
  const cancelarMensagemAgendada = async (messageId: string) => {
    try {
      const {
        error
      } = await supabase.from('scheduled_whatsapp_messages').delete().eq('id', messageId);
      if (error) {
        console.error('❌ Erro ao cancelar mensagem:', error);
        toast.error('Erro ao cancelar mensagem');
        return;
      }
      toast.success('Mensagem cancelada');
      await carregarMensagensAgendadas();
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao cancelar mensagem');
    }
  };

  // Sincronizar mensagens agendadas em tempo real
  useEffect(() => {
    if (!selectedConv) return;
    carregarMensagensAgendadas();
    const channel = supabase.channel('scheduled-messages-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'scheduled_whatsapp_messages'
    }, payload => {
      console.log('📡 Atualização de mensagem agendada:', payload);
      carregarMensagensAgendadas();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id]);

  // Carregar horário comercial e compromissos quando a data mudar
  useEffect(() => {
    if (reunioesDialogOpen) {
      carregarMeetingTodasAgendas();
    }
  }, [reunioesDialogOpen]);

  // Carregar horário comercial e compromissos quando a data ou agenda selecionada mudar
  useEffect(() => {
    if (meetingData && meetingAgendaIdSelecionada) {
      carregarMeetingHorarioComercialPorAgenda(meetingAgendaIdSelecionada);
      carregarMeetingCompromissosPorAgenda(meetingAgendaIdSelecionada);
    }
  }, [meetingData, meetingAgendaIdSelecionada]);

  const carregarMeetingTodasAgendas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Buscar todas as agendas da empresa
      const { data: agendas, error } = await supabase
        .from("agendas")
        .select("id, nome, tipo, responsavel_id, tempo_medio_servico, disponibilidade, permite_simultaneo, capacidade_simultanea")
        .eq("company_id", userRole.company_id)
        .order("tipo", { ascending: false }) // Principal primeiro
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar agendas:", error);
        return;
      }

      console.log('📅 [Conversas] Agendas carregadas:', agendas?.length || 0);
      setMeetingTodasAgendas(agendas || []);

      // Selecionar agenda principal por padrão
      const agendaPrincipal = agendas?.find(a => a.tipo === 'principal');
      if (agendaPrincipal) {
        setMeetingAgendaIdSelecionada(agendaPrincipal.id);
      } else if (agendas && agendas.length > 0) {
        setMeetingAgendaIdSelecionada(agendas[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar agendas:", error);
    }
  };

  const carregarMeetingHorarioComercialPorAgenda = async (agendaId: string) => {
    try {
      const agenda = meetingTodasAgendas.find(a => a.id === agendaId);
      
      if (!agenda) {
        // Se não encontrar na lista, buscar do banco
        const { data: agendaDB } = await supabase
          .from("agendas")
          .select("*")
          .eq("id", agendaId)
          .single();
        
        if (agendaDB) {
          processarMeetingAgenda(agendaDB);
        }
        return;
      }

      processarMeetingAgenda(agenda);
    } catch (error) {
      console.error("Erro ao carregar horário comercial:", error);
    }
  };

  const processarMeetingAgenda = (agenda: any) => {
    setMeetingAgendaSelecionada(agenda);
    
    if (agenda.disponibilidade && typeof agenda.disponibilidade === 'object') {
      const disp = agenda.disponibilidade as any;
      const periodos = disp.periodos || disp;
      
      if (periodos.manha && periodos.tarde) {
        setMeetingHorarioComercial({
          manha: {
            inicio: periodos.manha.inicio || "08:00",
            fim: periodos.manha.fim || "12:00",
            ativo: periodos.manha.ativo !== false
          },
          tarde: {
            inicio: periodos.tarde.inicio || "14:00",
            fim: periodos.tarde.fim || "18:00",
            ativo: periodos.tarde.ativo !== false
          },
          noite: {
            inicio: periodos.noite?.inicio || "19:00",
            fim: periodos.noite?.fim || "23:00",
            ativo: periodos.noite?.ativo === true
          },
          intervalo_almoco: {
            inicio: periodos.intervalo_almoco?.inicio || "12:00",
            fim: periodos.intervalo_almoco?.fim || "14:00",
            ativo: periodos.intervalo_almoco?.ativo !== false
          }
        });
      } else {
        setMeetingHorarioComercial({
          manha: {
            inicio: disp.horario_inicio || "08:00",
            fim: "12:00",
            ativo: true
          },
          tarde: {
            inicio: "14:00",
            fim: disp.horario_fim || "18:00",
            ativo: true
          },
          noite: {
            inicio: "19:00",
            fim: "23:00",
            ativo: false
          },
          intervalo_almoco: {
            inicio: "12:00",
            fim: "14:00",
            ativo: true
          }
        });
      }
    }
  };

  const carregarMeetingCompromissosPorAgenda = async (agendaId: string) => {
    try {
      const dataInicio = new Date(meetingData + "T00:00:00");
      const dataFim = new Date(meetingData + "T23:59:59");

      const { data: compromissos } = await supabase
        .from("compromissos")
        .select("id, data_hora_inicio, data_hora_fim, agenda_id")
        .gte("data_hora_inicio", dataInicio.toISOString())
        .lte("data_hora_inicio", dataFim.toISOString())
        .or(`agenda_id.eq.${agendaId},agenda_id.is.null`);
      
      console.log('📅 [Conversas] Compromissos carregados para agenda:', agendaId, compromissos?.length || 0);
      setMeetingCompromissosExistentes(compromissos || []);
    } catch (error) {
      console.error("Erro ao carregar compromissos:", error);
    }
  };
  const handleSelecionarMeetingHorario = (horario: string) => {
    setMeetingHoraInicio(horario);
    // Também atualizar meetingDatetime para compatibilidade com código existente
    setMeetingDatetime(`${meetingData}T${horario}`);
  };
  const scheduleMeeting = async () => {
    if (!selectedConv || !meetingTipoServico.trim() || !meetingData || !meetingHoraInicio) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // ⚠️ IMPORTANTE: Não criar lead automaticamente
    if (!leadVinculado?.id) {
      toast.error("Por favor, adicione o contato ao CRM antes de criar um compromisso");
      return;
    }
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do lead vinculado
      const companyId = leadVinculado.company_id;
      if (!companyId) {
        toast.error("Lead sem company_id associado");
        return;
      }

      // Criar compromisso/reunião com parse correto da data e hora
      const dataHoraInicio = new Date(`${meetingData}T${meetingHoraInicio}`);
      const duracaoMinutos = parseInt(meetingDuracao) || 30;
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60 * 1000);
      const {
        data: compromisso,
        error
      } = await supabase.from('compromissos').insert({
        lead_id: leadVinculado.id,
        usuario_responsavel_id: user.id,
        owner_id: user.id,
        company_id: companyId,
        agenda_id: meetingAgendaIdSelecionada || null,
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        tipo_servico: meetingTipoServico,
        observacoes: meetingDescricao || meetingNotes,
        status: 'agendado',
        custo_estimado: meetingCustoEstimado ? parseFloat(meetingCustoEstimado) : null
      }).select().single();
      if (error) throw error;
      console.log('✅ [COMPROMISSO] Compromisso criado com sucesso:', compromisso?.id);

      // ⚡ ENVIAR MENSAGEM DE CONFIRMAÇÃO IMEDIATA
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Estado enviarConfirmacaoReuniao:', enviarConfirmacaoReuniao);
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Lead vinculado:', leadVinculado);
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Compromisso criado:', compromisso);
      if (enviarConfirmacaoReuniao && compromisso && leadVinculado) {
        try {
          const telefone = leadVinculado.phone || leadVinculado.telefone;
          console.log('🔍 [DEBUG-CONFIRMAÇÃO] Telefone do lead:', telefone);
          if (telefone) {
            const telefoneNormalizado = normalizePhoneForWA(telefone);
            console.log('🔍 [DEBUG-CONFIRMAÇÃO] Telefone normalizado:', telefoneNormalizado);
            if (telefoneNormalizado) {
              // Mensagem de confirmação formatada e personalizada
              const tipoServicoFormatado = meetingTipoServico.trim() ? meetingTipoServico.charAt(0).toUpperCase() + meetingTipoServico.slice(1) : 'Compromisso';
              const observacoes = meetingDescricao || meetingNotes;
              const mensagemConfirmacao = `✅ *Compromisso Confirmado!*\n\n` + `Olá ${leadVinculado.name}! Seu compromisso foi agendado com sucesso.\n\n` + `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", {
                locale: ptBR
              })}\n` + `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", {
                locale: ptBR
              })} às ${format(dataHoraFim, "HH:mm", {
                locale: ptBR
              })}\n` + `📋 *Tipo:* ${tipoServicoFormatado}\n` + (observacoes ? `\n💬 *Observações:*\n${observacoes}\n` : '') + `\n✅ *Status:* Agendado\n\n` + `Aguardamos você no dia e horário agendados!\n\n` + `_Esta é uma confirmação automática do seu agendamento._`;
              console.log('📱 [CONFIRMAÇÃO] Enviando mensagem de confirmação imediata...');
              console.log('📱 [CONFIRMAÇÃO] Dados do envio:', {
                numero: telefoneNormalizado,
                company_id: companyId,
                mensagemLength: mensagemConfirmacao.length
              });
              const {
                data: resultConfirmacao,
                error: confirmacaoError
              } = await supabase.functions.invoke('enviar-whatsapp', {
                body: {
                  numero: telefoneNormalizado,
                  mensagem: mensagemConfirmacao,
                  company_id: companyId
                }
              });
              console.log('📱 [CONFIRMAÇÃO] Resposta da edge function:', {
                data: resultConfirmacao,
                error: confirmacaoError
              });
              if (confirmacaoError) {
                console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', confirmacaoError);
                toast.warning("Compromisso criado, mas não foi possível enviar a confirmação imediata.");
              } else {
                console.log('✅ [CONFIRMAÇÃO] Mensagem de confirmação enviada com sucesso!');

                // Salvar mensagem de confirmação na tabela conversas para ficar visível no CRM
                try {
                  const {
                    data: {
                      user
                    }
                  } = await supabase.auth.getUser();
                  const {
                    data: userProfile
                  } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : {
                    data: null
                  };
                  const {
                    error: dbError
                  } = await supabase.from('conversas').insert([{
                    numero: telefoneNormalizado,
                    telefone_formatado: telefoneNormalizado,
                    mensagem: mensagemConfirmacao,
                    origem: 'WhatsApp',
                    status: 'Enviada',
                    tipo_mensagem: 'text',
                    nome_contato: leadVinculado.name || leadVinculado.nome,
                    company_id: companyId,
                    lead_id: leadVinculado.id,
                    owner_id: user?.id,
                    sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
                    fromme: true,
                    delivered: true,
                    read: false
                  }]);
                  if (dbError) {
                    console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', dbError);
                  } else {
                    console.log('✅ [CONFIRMAÇÃO] Mensagem salva no banco de dados com sucesso!');
                  }
                } catch (saveError) {
                  console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', saveError);
                }
                toast.success("Compromisso criado e confirmação enviada ao cliente!");
              }
            } else {
              console.warn('⚠️ [CONFIRMAÇÃO] Telefone normalizado está vazio');
              toast.warning("Compromisso criado, mas telefone inválido para envio.");
            }
          } else {
            console.warn('⚠️ [CONFIRMAÇÃO] Lead sem telefone');
            toast.warning("Compromisso criado, mas lead sem telefone para enviar confirmação.");
          }
        } catch (error: any) {
          console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', error);
          toast.error(`Erro ao enviar confirmação: ${error?.message || 'Erro desconhecido'}`);
        }
      } else {
        console.log('ℹ️ [CONFIRMAÇÃO] Confirmação não será enviada. Motivos:', {
          enviarConfirmacaoReuniao,
          temCompromisso: !!compromisso,
          temLead: !!leadVinculado
        });
      }

      // ⚡ CRIAR LEMBRETE AUTOMÁTICO
      if (enviarLembreteReuniao && compromisso) {
        try {
          console.log('📝 [LEMBRETE] Criando lembrete para compromisso:', compromisso.id);
          const {
            data: profile
          } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

          // Validar e processar horas de antecedência (converter horas e minutos para decimal)
          const horas = parseInt(horasAntecedenciaReuniaoHoras || "0", 10);
          const minutos = parseInt(horasAntecedenciaReuniaoMinutos || "0", 10);
          if (horas === 0 && minutos === 0) {
            toast.error("Por favor, informe o tempo de antecedência para o lembrete");
            return;
          }
          if (horas < 0 || minutos < 0 || minutos >= 60) {
            toast.error("Valores inválidos para horas ou minutos");
            return;
          }

          // Converter horas e minutos para formato decimal (horas + minutos/60)
          const horasAntecedencia = horas + minutos / 60;

          // Calcular data de envio do lembrete
          const dataEnvio = new Date(dataHoraInicio);
          dataEnvio.setHours(dataEnvio.getHours() - horasAntecedencia);
          const lembreteData = {
            compromisso_id: compromisso.id,
            canal: 'whatsapp',
            horas_antecedencia: horasAntecedencia,
            mensagem: `Olá ${leadVinculado.name}! Lembramos do seu compromisso agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR
            })}.`,
            status_envio: 'pendente',
            data_envio: dataEnvio.toISOString(),
            destinatario: 'lead',
            telefone_responsavel: leadVinculado?.phone || leadVinculado?.telefone || null,
            company_id: companyId
          };
          console.log('📝 [LEMBRETE] Dados do lembrete:', {
            ...lembreteData,
            mensagem: '[oculta]'
          });
          const {
            error: lembreteError
          } = await supabase.from('lembretes').insert(lembreteData);
          if (lembreteError) {
            console.error('❌ [LEMBRETE] Erro ao criar lembrete:', lembreteError);
            toast.warning("Compromisso criado, mas houve erro ao criar o lembrete.");
          } else {
            console.log('✅ [LEMBRETE] Lembrete criado com sucesso!');
          }
        } catch (error) {
          console.error('❌ [LEMBRETE] Erro ao criar lembrete:', error);
        }
      }
      setMeetingTitle("");
      setMeetingDatetime("");
      setMeetingNotes("");
      setEnviarConfirmacaoReuniao(true); // Reset para padrão
      setEnviarLembreteReuniao(true); // Reset para padrão
      setHorasAntecedenciaReuniaoHoras("0"); // Reset para padrão
      setHorasAntecedenciaReuniaoMinutos("0"); // Reset para padrão

      if (!enviarConfirmacaoReuniao) {
        toast.success("Reunião agendada e sincronizada com Agenda!");
      }

      // Recarregar reuniões após criar
      await loadMeetings();
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      toast.error("Erro ao agendar reunião");
    }
  };
  const addTag = async () => {
    if (!selectedConv || !newTag.trim()) {
      toast.error("Digite uma tag");
      return;
    }

    // Verificar se a tag já existe
    if (selectedConv.tags?.includes(newTag.trim())) {
      toast.error("Esta tag já foi adicionada");
      return;
    }
    try {
      setSyncStatus('syncing');

      // Buscar lead existente (não criar automaticamente)
      const leadData = leadVinculado || await findLead(selectedConv);
      
      // 🔒 CORREÇÃO: Tags só podem ser adicionadas a leads vinculados
      if (!leadData) {
        setSyncStatus('error');
        toast.error('Crie o lead no CRM antes de adicionar tags');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      }
      
      // Atualizar tags no Supabase
      const updatedTags = [...(leadData.tags || []), newTag.trim()];
      const {
        error
      } = await supabase.from('leads').update({
        tags: updatedTags
      }).eq('id', leadData.id);
      if (error) {
        console.error('Erro ao atualizar tags no Supabase:', error);
        setSyncStatus('error');
        toast.error('Erro ao salvar tag');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      }
      console.log('✅ Tag adicionada no Supabase');
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);

      // Atualizar localmente (será sincronizado via realtime)
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        tags: updatedTags
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        tags: updatedTags
      });
      
      // Atualizar lead vinculado
      setLeadVinculado({
        ...leadData,
        tags: updatedTags
      });
      
      setNewTag("");
      await refreshTags(); // Atualizar lista de tags disponíveis
      toast.success("Tag adicionada!");
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar tag');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };
  const addExistingTag = async (tag: string) => {
    if (!selectedConv) return;

    // Verificar se a tag já existe
    if (selectedConv.tags?.includes(tag)) {
      return;
    }
    try {
      setSyncStatus('syncing');

      // Buscar lead existente (não criar automaticamente)
      const leadData = leadVinculado || await findLead(selectedConv);
      
      // 🔒 CORREÇÃO: Tags só podem ser adicionadas a leads vinculados
      if (!leadData) {
        setSyncStatus('error');
        toast.error('Crie o lead no CRM antes de adicionar tags');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      }
      
      // Atualizar tags no Supabase
      const updatedTags = [...(leadData.tags || []), tag];
      const {
        error
      } = await supabase.from('leads').update({
        tags: updatedTags
      }).eq('id', leadData.id);
      if (error) {
        console.error('Erro ao atualizar tags no Supabase:', error);
        setSyncStatus('error');
        toast.error('Erro ao salvar tag');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      }
      console.log('✅ Tag adicionada no Supabase');
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);

      // Atualizar localmente
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        tags: updatedTags
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        tags: updatedTags
      });

      // Atualizar lead vinculado
      setLeadVinculado({
        ...leadData,
        tags: updatedTags
      });
      
      toast.success("Tag adicionada!");
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar tag');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };
  const removeTag = async (tag: string) => {
    if (!selectedConv) return;
    try {
      setSyncStatus('syncing');

      // Usar leadVinculado primeiro para evitar nova busca
      const leadData = leadVinculado || await findLead(selectedConv);
      
      if (leadData) {
        // Remover tag do array
        const updatedTags = (leadData.tags || []).filter(t => t !== tag);
        const {
          error
        } = await supabase.from('leads').update({
          tags: updatedTags
        }).eq('id', leadData.id);
        if (error) {
          console.error('Erro ao remover tag no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao remover tag');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        console.log('✅ Tag removida no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
        
        // Atualizar localmente
        const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
          ...conv,
          tags: updatedTags
        } : conv);
        saveConversations(updatedConversations);
        setSelectedConv({
          ...selectedConv,
          tags: updatedTags
        });

        // Atualizar lead vinculado
        setLeadVinculado({
          ...leadData,
          tags: updatedTags
        });
        
        toast.success("Tag removida!");
      } else {
        // Se não há lead, remover apenas localmente (não deveria acontecer)
        const updatedTags = (selectedConv.tags || []).filter(t => t !== tag);
        const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
          ...conv,
          tags: updatedTags
        } : conv);
        saveConversations(updatedConversations);
        setSelectedConv({
          ...selectedConv,
          tags: updatedTags
        });
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      }
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao remover tag');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };
  const addToFunnel = async () => {
    if (!selectedConv || !selectedFunilId || !selectedFunnel) {
      toast.error("Selecione o funil e a etapa");
      return;
    }
    try {
      setSyncStatus('syncing');

      // Buscar lead existente
      let leadData = await findLead(selectedConv);
      
      // ✅ CORREÇÃO: Se não encontrou lead, criar automaticamente
      if (!leadData) {
        console.log('📝 [addToFunnel] Lead não encontrado - criando automaticamente...');
        leadData = await createLeadManually(selectedConv);
        if (!leadData) {
          setSyncStatus('error');
          toast.error('Erro ao criar lead no CRM. Tente salvar o lead primeiro.');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        console.log('✅ [addToFunnel] Lead criado automaticamente:', leadData.id);
      }
      
      // Atualizar funil e etapa no Supabase
      console.log('[addToFunnel] Atualizando lead:', {
        leadId: leadData.id,
        funilId: selectedFunilId,
        etapaId: selectedFunnel
      });
      
      const { error } = await supabase.from('leads').update({
        funil_id: selectedFunilId,
        etapa_id: selectedFunnel
      }).eq('id', leadData.id);
      
      if (error) {
        console.error('Erro ao atualizar funil no Supabase:', error);
        setSyncStatus('error');
        toast.error('Erro ao salvar no funil');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      }
      
      console.log('✅ Lead adicionado ao funil no Supabase');
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);

      // Buscar nome da etapa para exibição local
      const etapaSelecionada = etapas.find(e => e.id === selectedFunnel);
      const nomeEtapa = etapaSelecionada?.nome || "Adicionado";

      // Atualizar localmente (será sincronizado via realtime)
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        funnelStage: nomeEtapa
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        funnelStage: nomeEtapa
      });
      setSelectedFunilId("");
      setSelectedFunnel("");

      // Recarregar dados do lead vinculado
      await recarregarLeadVinculado(selectedConv.id);
      toast.success(`Lead adicionado ao funil com sucesso!`);
    } catch (error) {
      console.error('Erro ao adicionar ao funil:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar ao funil');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };
  const updateResponsavel = async () => {
    if (!selectedConv || !newResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }
    try {
      setSyncStatus('syncing');

      // Buscar lead existente (não criar automaticamente)
      const leadData = await findLead(selectedConv);
      if (leadData) {
        // Por enquanto, salvamos o nome do responsável em notes ou company
        // Em produção, você pode ter uma tabela de usuários e usar responsavel_id
        const {
          error
        } = await supabase.from('leads').update({
          notes: `Responsável: ${newResponsavel}${leadData.notes ? '\n' + leadData.notes : ''}`
        }).eq('id', leadData.id);
        if (error) {
          console.error('Erro ao atualizar responsável no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar responsável');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        console.log('✅ Responsável atualizado no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      }

      // Atualizar localmente
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        responsavel: newResponsavel
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        responsavel: newResponsavel
      });
      setNewResponsavel("");
      toast.success("Responsável atualizado!");
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
      setSyncStatus('error');
      toast.error('Erro ao atualizar responsável');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  // Criar tarefa vinculada ao lead
  const criarTarefaDoLead = async () => {
    if (!selectedConv || !newTaskTitle.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    // Garantir lead automaticamente e aguardar atualização do estado
    let leadIdFinal = leadVinculado?.id;
    if (!leadIdFinal) {
      toast.error("Por favor, adicione o contato ao CRM antes de criar uma tarefa");
      return;
    }
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }
      const {
        data: userRole
      } = await supabase.from("user_roles").select("company_id").eq("user_id", session.user.id).maybeSingle();
      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      // SOLUÇÃO DEFINITIVA: Usar apenas campos que existem na tabela
      // Garantir que o lead_id seja sempre o do lead vinculado
      const leadIdParaTarefa = leadIdFinal || leadVinculado?.id;
      if (!leadIdParaTarefa) {
        toast.error("Erro: Lead não encontrado");
        return;
      }
      console.log('📋 [TAREFAS] Criando tarefa com lead_id:', leadIdParaTarefa);
      const taskData: any = {
        title: newTaskTitle,
        description: newTaskDescription || null,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        status: 'pendente',
        lead_id: leadIdParaTarefa,
        company_id: userRole.company_id,
        owner_id: session.user.id,
        // Incluir board_id e column_id apenas se fornecidos
        board_id: selectedTaskBoardId && selectedTaskBoardId.trim() ? selectedTaskBoardId : null,
        column_id: selectedTaskColumnId && selectedTaskColumnId.trim() ? selectedTaskColumnId : null
      };

      // Inserir tarefa e obter o resultado
      let createdTask = null;
      let insertError = null;
      try {
        const result = await supabase.from('tasks').insert([taskData]).select().single(); // Usar .single() para obter a tarefa criada

        insertError = result.error;
        createdTask = result.data;
      } catch (insertException: any) {
        // Capturar qualquer exceção que possa ser lançada durante o insert
        console.error('❌ Exceção ao inserir tarefa:', insertException);

        // Verificar se é um erro de Edge Function
        if (insertException?.message?.includes('Edge Function') || insertException?.message?.includes('non-2xx')) {
          // Erro de Edge Function - provavelmente da busca de foto
          // Ignorar e continuar, pois a tarefa pode ter sido criada mesmo assim
          console.warn('⚠️ Erro de Edge Function detectado (provavelmente da busca de foto) - ignorando');
        } else {
          // Outro tipo de erro - propagar
          throw insertException;
        }
      }
      if (insertError) {
        console.error('❌ Erro ao criar tarefa:', insertError);
        console.error('❌ Detalhes do erro:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        toast.error(`Erro ao criar tarefa: ${insertError.message || 'Erro desconhecido'}`);
        return;
      }
      console.log('✅ Tarefa criada com sucesso:', createdTask);
      console.log('📋 [TAREFAS] Lead vinculado:', leadVinculado?.id);
      console.log('📋 [TAREFAS] Lead_id da tarefa:', createdTask?.lead_id);
      console.log('📋 [TAREFAS] LeadIdFinal:', leadIdFinal);
      toast.success('Tarefa criada!');

      // CORREÇÃO DEFINITIVA: SEMPRE adicionar tarefa à lista imediatamente
      if (createdTask) {
        const leadIdTarefa = createdTask.lead_id;
        const leadIdParaBuscar = leadIdTarefa || leadIdFinal || leadVinculado?.id;
        console.log('📋 [TAREFAS] Adicionando tarefa à lista. Lead_id tarefa:', leadIdTarefa, 'Lead_id buscar:', leadIdParaBuscar);

        // SEMPRE adicionar à lista imediatamente (otimista)
        setLeadTasks(prev => {
          const existe = prev.find(t => t.id === createdTask.id);
          if (existe) {
            console.log('📋 [TAREFAS] Tarefa já está na lista, atualizando');
            return prev.map(t => t.id === createdTask.id ? createdTask : t);
          }
          console.log('📋 [TAREFAS] Adicionando nova tarefa. Total antes:', prev.length);
          const novaLista = [createdTask, ...prev];
          console.log('📋 [TAREFAS] Total depois:', novaLista.length, 'Tarefas:', novaLista.map(t => ({
            id: t.id,
            title: t.title,
            lead_id: t.lead_id
          })));
          return novaLista;
        });

        // Mudar para aba "Histórico" imediatamente
        setTarefasTabValue("historico");

        // Recarregar lista em background para garantir sincronização
        if (leadIdParaBuscar) {
          console.log('📋 [TAREFAS] Recarregando lista em background para sincronização');
          // Usar setTimeout para não bloquear a UI
          setTimeout(async () => {
            await carregarTarefasDoLead(leadIdParaBuscar);
          }, 100);
        }
      } else {
        // Se não conseguiu criar, recarregar lista do lead vinculado
        const leadIdParaBuscar = leadIdFinal || leadVinculado?.id;
        if (leadIdParaBuscar) {
          console.log('📋 [TAREFAS] Tarefa não criada, recarregando lista');
          await carregarTarefasDoLead(leadIdParaBuscar);
          setTarefasTabValue("historico");
        }
      }

      // Limpar campos
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("media");
      setNewTaskDueDate("");
      // CORREÇÃO: Manter board_id selecionado, mas limpar column_id
      setSelectedTaskColumnId("");
    } catch (error: any) {
      console.error('❌ Erro ao criar tarefa:', error);
      console.error('❌ Stack trace:', error?.stack);
      const errorMessage = error?.message || error?.error?.message || 'Erro desconhecido ao criar tarefa';
      toast.error(`Erro ao criar tarefa: ${errorMessage}`);
    }
  };
  const deletarTarefa = async (taskId: string) => {
    try {
      const {
        error
      } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) {
        console.error('❌ Erro ao deletar tarefa:', error);
        toast.error('Erro ao deletar tarefa');
        return;
      }
      console.log('✅ Tarefa deletada');
    } catch (error) {
      console.error('❌ Erro ao deletar tarefa:', error);
      toast.error('Erro ao deletar tarefa');
    }
  };
  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
      const {
        error
      } = await supabase.from('tasks').update({
        status: newStatus
      }).eq('id', taskId);
      if (error) {
        console.error('❌ Erro ao atualizar status:', error);
        toast.error('Erro ao atualizar status');
        return;
      }
      console.log('✅ Status atualizado');
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };
  const updateLeadInfo = async () => {
    if (!selectedConv) return;
    try {
      setSyncStatus('syncing');

      // Buscar lead existente (não criar automaticamente)
      const leadData = await findLead(selectedConv);
      if (leadData) {
        // Preparar dados para atualização
        const updateData: any = {};
        if (newProduto) updateData.servico = newProduto;
        if (newValor) {
          // Extrair valor numérico
          const numericValue = parseFloat(newValor.replace(/[^\d,]/g, '').replace(',', '.'));
          if (!isNaN(numericValue)) {
            updateData.value = numericValue;
          }
        }
        if (newAnotacoes !== undefined && newAnotacoes !== '') {
          updateData.notes = newAnotacoes;
        }

        // Atualizar no Supabase
        const {
          error
        } = await supabase.from('leads').update(updateData).eq('id', leadData.id);
        if (error) {
          console.error('Erro ao atualizar informações no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar informações');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        console.log('✅ Informações atualizadas no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      }

      // Atualizar localmente (será sincronizado via realtime)
      const updatedConversations = conversations.map(conv => conv.id === selectedConv.id ? {
        ...conv,
        produto: newProduto || conv.produto,
        valor: newValor || conv.valor,
        anotacoes: newAnotacoes !== undefined ? newAnotacoes : conv.anotacoes
      } : conv);
      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        produto: newProduto || selectedConv.produto,
        valor: newValor || selectedConv.valor,
        anotacoes: newAnotacoes !== undefined ? newAnotacoes : selectedConv.anotacoes
      });
      setNewProduto("");
      setNewValor("");
      setNewAnotacoes("");
      toast.success("Informações atualizadas!");
    } catch (error) {
      console.error('Erro ao atualizar informações:', error);
      setSyncStatus('error');
      toast.error('Erro ao atualizar informações');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  // Função auxiliar para buscar ou criar lead no Supabase
  // MELHORIA: Função auxiliar para validar e normalizar número de telefone
  const validateAndNormalizePhone = (phone: string): {
    normalized: string;
    isValid: boolean;
    variations: string[];
  } => {
    if (!phone || typeof phone !== 'string') {
      console.warn('⚠️ [LEAD] Telefone inválido: não é uma string', phone);
      return {
        normalized: '',
        isValid: false,
        variations: []
      };
    }

    // Normalizar: remover todos os caracteres não numéricos
    const normalized = phone.replace(/[^0-9]/g, '');

    // Validar se é um número brasileiro válido (12 ou 13 dígitos)
    const isValid = normalized.length >= 12 && normalized.length <= 13;
    if (!isValid) {
      console.warn('⚠️ [LEAD] Telefone inválido: tamanho incorreto', {
        original: phone,
        normalized,
        length: normalized.length
      });
      return {
        normalized,
        isValid: false,
        variations: []
      };
    }

    // Gerar variações do número para busca
    const variations = [normalized,
    // Número limpo
    phone,
    // Número original
    safeFormatPhoneNumber(phone),
    // Número formatado (se disponível)
    phone.replace(/\s+/g, ''),
    // Sem espaços
    phone.replace(/[()]/g, '') // Sem parênteses
    ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Remover duplicatas

    console.log('✅ [LEAD] Telefone validado e normalizado:', {
      original: phone,
      normalized,
      isValid,
      variations: variations.length
    });
    return {
      normalized,
      isValid,
      variations
    };
  };

  // 🎯 APENAS buscar lead existente - NÃO criar automaticamente
  const findLead = async (conversation: Conversation) => {
    try {
      console.log('🔍 [LEAD] Buscando lead existente para conversa:', {
        contactName: conversation.contactName,
        phoneNumber: conversation.phoneNumber,
        conversationId: conversation.id
      });

      // Validar número de telefone antes de buscar lead
      const phoneRaw = conversation.phoneNumber || conversation.id;
      const {
        normalized: phoneNormalized,
        isValid,
        variations
      } = validateAndNormalizePhone(phoneRaw);
      if (!isValid || !phoneNormalized) {
        console.warn('⚠️ [LEAD] Telefone inválido - não é possível buscar lead:', phoneRaw);
        return null;
      }

      // Buscar user_id do usuário autenticado
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ [LEAD] Usuário não autenticado');
        return null;
      }

      // Buscar company_id do usuário
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
      if (!userRole?.company_id) {
        console.warn('⚠️ [LEAD] Usuário sem company_id');
        return null;
      }
      console.log('📞 [LEAD] Buscando lead com variações de telefone:', {
        variations,
        companyId: userRole.company_id
      });

      // Buscar lead por telefone exato e variações
      const phoneConditions = variations.map(v => `phone.eq.${v},telefone.eq.${v}`).join(',');
      const {
        data: existingLead,
        error: searchError
      } = await supabase.from('leads').select('*').eq('company_id', userRole.company_id).or(phoneConditions).maybeSingle();
      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ [LEAD] Erro ao buscar lead:', {
          error: searchError,
          phoneConditions,
          variations
        });
        return null;
      }

      // Se encontrou, vincular conversa ao lead
      if (existingLead) {
        console.log('✅ [LEAD] Lead encontrado:', {
          leadId: existingLead.id,
          leadName: existingLead.name,
          phoneMatched: existingLead.phone || existingLead.telefone,
          searchedVariations: variations.length
        });

        // Vincular conversa ao lead encontrado
        const phoneKey = conversation.phoneNumber || conversation.id;
        const formatted = safeFormatPhoneNumber(phoneKey);
        setLeadsVinculados(prev => {
          const newMap = {
            ...prev
          };
          // Adicionar todas as variações ao mapeamento
          variations.forEach(v => {
            newMap[v] = existingLead.id;
          });
          newMap[phoneKey] = existingLead.id;
          if (formatted) {
            newMap[formatted] = existingLead.id;
          }
          return newMap;
        });
        console.log('✅ [LEAD] Conversa vinculada ao lead existente');
        return existingLead;
      }

      // ✅ NÃO criar automaticamente - apenas retornar null
      console.log('ℹ️ [LEAD] Lead não encontrado - aguardando criação manual pelo usuário');
      return null;
    } catch (error) {
      console.error('❌ [LEAD] Erro em findLead:', {
        error: error instanceof Error ? error.message : String(error),
        conversation: conversation?.id
      });
      return null;
    }
  };

  // 🎯 Criar lead MANUALMENTE quando usuário clicar em "Adicionar ao CRM"
  const createLeadManually = async (conversation: Conversation) => {
    try {
      console.log('📝 [LEAD] Criando lead manualmente:', conversation.contactName);

      // Validar número de telefone
      const phoneRaw = conversation.phoneNumber || conversation.id;
      const {
        normalized: phoneNormalized,
        isValid,
        variations
      } = validateAndNormalizePhone(phoneRaw);
      if (!isValid || !phoneNormalized) {
        toast.error('Número de telefone inválido. Não é possível criar lead.');
        return null;
      }

      // 🔒 Verificar se lead já existe antes de criar
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('Usuário não autenticado');
        return null;
      }
      const { data: existingUserRole } = await supabase.from('user_roles').select('company_id').eq('user_id', currentUser.id).maybeSingle();
      if (existingUserRole?.company_id) {
        const phoneVariationsToCheck = variations.length > 0 ? variations : [phoneNormalized];
        const orConditions = phoneVariationsToCheck.map(v => `phone.eq.${v},telefone.eq.${v}`).join(',');
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('id, name, phone, telefone')
          .eq('company_id', existingUserRole.company_id)
          .is('lead_origem_id', null)
          .or(orConditions)
          .limit(1);
        
        if (existingLeads && existingLeads.length > 0) {
          const existingLead = existingLeads[0];
          console.log('⚠️ [LEAD] Lead já existe no CRM:', existingLead.id, existingLead.name);
          toast.info(`Este contato já está salvo no CRM como "${existingLead.name}"`);
          // Vincular conversa ao lead existente
          const phoneKey = conversation.phoneNumber || conversation.id;
          const formatted = safeFormatPhoneNumber(phoneKey);
          setLeadsVinculados(prev => {
            const newMap = { ...prev };
            phoneVariationsToCheck.forEach(v => { newMap[v] = existingLead.id; });
            newMap[phoneKey] = existingLead.id;
            if (formatted) newMap[formatted] = existingLead.id;
            return newMap;
          });
          return existingLead as any;
        }
      }

      // Buscar user_id do usuário autenticado
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return null;
      }

      // Buscar company_id do usuário
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
      if (!userRole?.company_id) {
        toast.error('Erro: Configuração de empresa não encontrada');
        return null;
      }

      // Preparar dados do novo lead
      const newLeadData = {
        name: conversation.contactName || 'Contato sem nome',
        phone: phoneNormalized,
        telefone: phoneNormalized,
        company_id: userRole.company_id,
        owner_id: user.id,
        status: 'novo',
        stage: conversation.funnelStage?.toLowerCase() || 'prospeccao',
        value: conversation.valor ? parseFloat(conversation.valor.replace(/[^\d,]/g, '').replace(',', '.')) : 0,
        tags: conversation.tags || [],
        notes: conversation.anotacoes || null,
        servico: conversation.produto || null,
        source: `Conversa ${conversation.channel}`
      };
      console.log('📦 [LEAD] Dados do novo lead:', newLeadData);
      const {
        data: newLead,
        error: createError
      } = await supabase.from('leads').insert(newLeadData).select().single();
      if (createError) {
        console.error('❌ [LEAD] Erro ao criar lead:', createError);
        toast.error(`Erro ao criar lead: ${createError.message}`);
        return null;
      }
      console.log('✅ [LEAD] Novo lead criado manualmente:', {
        leadId: newLead.id,
        leadName: newLead.name,
        phone: newLead.phone
      });

      // Vincular conversa ao lead criado
      const phoneKey = conversation.phoneNumber || conversation.id;
      const formatted = safeFormatPhoneNumber(phoneKey);
      setLeadsVinculados(prev => {
        const newMap = {
          ...prev
        };
        variations.forEach(v => {
          newMap[v] = newLead.id;
        });
        newMap[phoneKey] = newLead.id;
        if (formatted) {
          newMap[formatted] = newLead.id;
        }
        return newMap;
      });
      toast.success(`Lead "${conversation.contactName}" adicionado ao CRM com sucesso!`);
      return newLead;
    } catch (error) {
      console.error('❌ [LEAD] Erro em findOrCreateLead:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversation: {
          id: conversation.id,
          contactName: conversation.contactName,
          phoneNumber: conversation.phoneNumber
        }
      });
      toast.error('Erro ao processar lead');
      return null;
    }
  };

  // MELHORIA: Função para verificar se existe lead vinculado com validação e logs aprimorados
  const verificarLeadVinculado = async (conversation: Conversation) => {
    try {
      setMostrarBotaoCriarLead(false);
      console.log('🔍 [LEAD] Verificando lead vinculado para conversa:', {
        contactName: conversation.contactName,
        phoneNumber: conversation.phoneNumber,
        conversationId: conversation.id
      });
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ [LEAD] Usuário não autenticado - não é possível verificar lead');
        return;
      }
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
      if (!userRole?.company_id) {
        console.warn('⚠️ [LEAD] Usuário sem company_id - não é possível verificar lead');
        return;
      }

      // MELHORIA 1 e 2: Validar e normalizar número de telefone
      const phoneRaw = conversation.phoneNumber || conversation.id;
      const {
        normalized: phoneNormalized,
        isValid,
        variations
      } = validateAndNormalizePhone(phoneRaw);
      if (!isValid || !phoneNormalized) {
        console.warn('⚠️ [LEAD] Telefone inválido - não é possível verificar lead:', phoneRaw);
        setLeadVinculado(null);
        setMostrarBotaoCriarLead(true);
        return;
      }
      console.log('📞 [LEAD] Buscando lead com variações de telefone:', {
        variations,
        companyId: userRole.company_id
      });

      // MELHORIA 3: Buscar lead por telefone exato e variações
      const phoneConditions = variations.map(v => `phone.eq.${v},telefone.eq.${v}`).join(',');
      const {
        data: existingLead,
        error
      } = await supabase.from('leads').select('*').eq('company_id', userRole.company_id).or(phoneConditions).maybeSingle();

      // MELHORIA 6: Logs detalhados para debug
      if (error && error.code !== 'PGRST116') {
        console.error('❌ [LEAD] Erro ao buscar lead:', {
          error,
          phoneConditions,
          variations,
          companyId: userRole.company_id
        });
      }
      if (existingLead) {
        console.log('✅ [LEAD] Lead vinculado encontrado:', {
          leadId: existingLead.id,
          leadName: existingLead.name,
          phoneMatched: existingLead.phone || existingLead.telefone,
          searchedVariations: variations.length,
          funil_id: existingLead.funil_id,
          etapa_id: existingLead.etapa_id
        });
        setLeadVinculado(existingLead);
        setMostrarBotaoCriarLead(false);

        // MELHORIA 5: Atualizar mapeamento de leads vinculados com todas as variações
        const phoneKey = conversation.phoneNumber || conversation.id;
        const formatted = safeFormatPhoneNumber(phoneKey);
        setLeadsVinculados(prev => {
          const newMap = {
            ...prev
          };
          // Adicionar todas as variações ao mapeamento
          variations.forEach(v => {
            newMap[v] = existingLead.id;
          });
          newMap[phoneKey] = existingLead.id;
          if (formatted) {
            newMap[formatted] = existingLead.id;
          }
          return newMap;
        });

        // ⚡ SINCRONIZAÇÃO: Atualizar informações do funil na conversa
        // Atualizar conversa com informações do lead (tags, valor, etc)
        setConversations(prev => prev.map(conv => conv.id === conversation.id ? {
          ...conv,
          tags: existingLead.tags || conv.tags,
          responsavel: (existingLead as any).responsavel?.full_name || conv.responsavel,
          valor: existingLead.value ? `R$ ${Number(existingLead.value).toLocaleString('pt-BR')}` : conv.valor
        } : conv));

        // Atualizar conversa selecionada se for a mesma
        if (selectedConv?.id === conversation.id) {
          setSelectedConv(prev => prev ? {
            ...prev,
            tags: existingLead.tags || prev.tags,
            valor: existingLead.value ? `R$ ${Number(existingLead.value).toLocaleString('pt-BR')}` : prev.valor
          } : null);
        }

        // Se o lead tem funil, buscar informações do funil e etapa
        if (existingLead.funil_id && existingLead.etapa_id) {
          // Aguardar um pouco para garantir que funis/etapas foram carregados
          setTimeout(() => {
            const etapaInfo = etapas.find(e => e.id === existingLead.etapa_id);
            const funilInfo = funis.find(f => f.id === existingLead.funil_id);
            const nomeEtapa = etapaInfo?.nome || "Etapa não definida";
            const nomeFunil = funilInfo?.nome || "Funil";
            console.log('📊 [FUNIL] Atualizando informações do funil:', {
              funil_id: existingLead.funil_id,
              etapa_id: existingLead.etapa_id,
              nomeFunil,
              nomeEtapa,
              funisCarregados: funis.length,
              etapasCarregadas: etapas.length
            });

            // Atualizar conversa com informações do funil
            setConversations(prev => prev.map(conv => conv.id === conversation.id ? {
              ...conv,
              funnelStage: nomeEtapa
            } : conv));

            // Atualizar conversa selecionada se for a mesma
            if (selectedConv?.id === conversation.id) {
              setSelectedConv(prev => prev ? {
                ...prev,
                funnelStage: nomeEtapa
              } : null);
            }
          }, 100);
        }
        console.log('✅ [LEAD] Mapeamento de leads vinculados atualizado');
      } else {
        console.log('ℹ️ [LEAD] Nenhum lead vinculado encontrado para este contato:', {
          phoneNormalized,
          variations: variations.length
        });
        setLeadVinculado(null);
        setMostrarBotaoCriarLead(true);
      }
    } catch (error) {
      console.error('❌ [LEAD] Erro ao verificar lead vinculado:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversation: {
          id: conversation.id,
          contactName: conversation.contactName,
          phoneNumber: conversation.phoneNumber
        }
      });
      setLeadVinculado(null);
      setMostrarBotaoCriarLead(false);
    }
  };

  // Função para criar lead manualmente
  const criarLeadManualmente = async () => {
    if (!selectedConv) return;
    try {
      setSyncStatus('syncing');

      // Primeiro tentar encontrar lead existente
      let lead = await findLead(selectedConv);

      // Se não encontrou, criar novo lead
      if (!lead) {
        console.log('📝 [LEAD] Lead não encontrado - criando novo lead...');
        lead = await createLeadManually(selectedConv);
        if (!lead) {
          toast.error('Erro ao criar lead no CRM');
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        toast.success('Lead criado com sucesso!');
      }

      // Vincular lead à conversa
      setLeadVinculado(lead);
      setMostrarBotaoCriarLead(false);

      // Atualizar mapeamento de leads vinculados
      const phoneKey = selectedConv.phoneNumber || selectedConv.id;
      const formatted = safeFormatPhoneNumber(phoneKey);
      setLeadsVinculados(prev => ({
        ...prev,
        [phoneKey]: lead.id,
        ...(formatted ? {
          [formatted]: lead.id
        } : {})
      }));
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      toast.error('Erro ao processar lead');
    }
  };

  // ✅ Salvar valor da venda rapidamente (sem abrir formulário completo)
  const handleSalvarValorVenda = async () => {
    if (!leadVinculado?.id) {
      toast.error('Salve o lead no CRM primeiro');
      return;
    }
    
    setSalvandoValor(true);
    // Parsear valor no formato brasileiro: 1.500,00 → 1500.00
    const valorNumerico = valorVendaInput 
      ? parseFloat(valorVendaInput.replace(/\./g, '').replace(',', '.')) 
      : 0;
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ value: valorNumerico })
        .eq('id', leadVinculado.id);
      
      if (error) throw error;
      
      // Atualizar estado local
      setLeadVinculado({ ...leadVinculado, value: valorNumerico });
      
      // Atualizar a conversa selecionada
      if (selectedConv) {
        setSelectedConv(prev => prev ? {
          ...prev,
          valor: valorNumerico ? `R$ ${Number(valorNumerico).toLocaleString('pt-BR')}` : undefined
        } : null);
      }
      
      setValorVendaDialogOpen(false);
      toast.success('Valor atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar valor:', err);
      toast.error('Erro ao salvar valor');
    } finally {
      setSalvandoValor(false);
    }
  };

  // ✅ Carregar produtos para seleção
  const carregarProdutos = async () => {
    if (!userCompanyId) return;
    
    setLoadingProdutos(true);
    try {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, preco_sugerido, categoria, subcategoria")
        .eq("company_id", userCompanyId)
        .eq("ativo", true)
        .order("categoria")
        .order("subcategoria")
        .order("nome");

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoadingProdutos(false);
    }
  };

  // ✅ Salvar produto selecionado no lead
  const handleSalvarProduto = async (produtoId: string, produto?: { id: string; nome: string; categoria: string | null; subcategoria: string | null; preco_sugerido: number | null }) => {
    if (!leadVinculado?.id) {
      toast.error('Salve o lead no CRM primeiro');
      return;
    }
    
    setSalvandoProduto(true);
    try {
      const produtoSelecionado = produto || produtos.find(p => p.id === produtoId);
      
      const { error } = await supabase
        .from('leads')
        .update({ produto_id: produtoId || null })
        .eq('id', leadVinculado.id);
      
      if (error) throw error;
      
      // Atualizar estado local com todas as informações do produto
      setLeadVinculado({ 
        ...leadVinculado, 
        produto_id: produtoId || null,
        produto_nome: produtoSelecionado?.nome || null,
        produto_categoria: produtoSelecionado?.categoria || null,
        produto_subcategoria: produtoSelecionado?.subcategoria || null
      });
      
      setProdutoDialogOpen(false);
      toast.success(produtoId ? `Produto "${produtoSelecionado?.nome}" associado!` : 'Produto removido');
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
      toast.error('Erro ao salvar produto');
    } finally {
      setSalvandoProduto(false);
    }
  };

  const handleEditName = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const novoNome = prompt("Digite o novo nome do contato:", conv.contactName);
    if (!novoNome || novoNome.trim() === "") return;
    try {
      // Atualizar no Supabase (contatos: por telefone_formatado; grupos: por numero JID)
      const isGroup = /@g\.us$/.test(String(conv.id));
      const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
      const query = supabase.from('conversas').update({
        nome_contato: novoNome.trim()
      }).eq('company_id', userCompanyId);
      const {
        error
      } = await (isGroup ? query.eq('numero', conv.id) : query.eq('telefone_formatado', numeroNormalizado!));
      if (error) throw error;

      // ⚡ CORREÇÃO: Atualizar também o lead - primeiro por ID vinculado, depois por telefone
      let leadId = leadsVinculados[conversationId] || leadsVinculados[safeFormatPhoneNumber(conversationId)];
      
      // Se não encontrou lead vinculado, buscar pelo telefone
      if (!leadId && numeroNormalizado) {
        console.log('🔍 Buscando lead pelo telefone:', numeroNormalizado);
        const { data: leadByPhone } = await supabase
          .from('leads')
          .select('id')
          .eq('company_id', userCompanyId)
          .or(`phone.eq.${numeroNormalizado},telefone.eq.${numeroNormalizado}`)
          .limit(1)
          .maybeSingle();
        
        if (leadByPhone) {
          leadId = leadByPhone.id;
          console.log('✅ Lead encontrado pelo telefone:', leadId);
        }
      }
      
      if (leadId) {
        console.log('🔄 Atualizando nome do lead vinculado:', leadId);
        const {
          error: leadError
        } = await supabase.from('leads').update({
          name: novoNome.trim()
        }).eq('id', leadId);
        if (leadError) {
          console.error('❌ Erro ao atualizar nome do lead:', leadError);
          toast.error("Nome da conversa atualizado, mas erro ao atualizar o lead");
        } else {
          console.log('✅ Nome do lead atualizado com sucesso');
        }
      } else {
        console.log('ℹ️ Nenhum lead encontrado para atualizar - nome salvo apenas na conversa');
      }

      // Atualizar localmente
      const updated = conversations.map(c => c.id === conversationId ? {
        ...c,
        contactName: novoNome.trim()
      } : c);
      setConversations(updated);
      if (selectedConv?.id === conversationId) {
        setSelectedConv({
          ...selectedConv,
          contactName: novoNome.trim()
        });
      }
      saveConversations(updated);
      toast.success("Nome atualizado com sucesso!");
    } catch (error) {
      console.error('Erro ao editar nome:', error);
      toast.error("Erro ao atualizar nome");
    }
  };
  const handleCreateLead = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    try {
      setSyncStatus('syncing');

      // Selecionar a conversa antes de criar o lead
      setSelectedConv(conv);

      // Aguardar um pouco para o state atualizar
      await new Promise(resolve => setTimeout(resolve, 100));

      // 🎯 USAR FUNÇÃO MANUAL para criar lead (não buscar automaticamente)
      const lead = await createLeadManually(conv);
      if (lead) {
        // Atualizar o mapeamento de leads vinculados
        const formatted = safeFormatPhoneNumber(conv.id);
        setLeadsVinculados(prev => ({
          ...prev,
          [conv.id]: lead.id,
          ...(formatted ? {
            [formatted]: lead.id
          } : {})
        }));
        setLeadVinculado(lead);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      toast.error("Erro ao criar lead");
    }
  };
  const handleDeleteConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const confirmar = window.confirm(`Tem certeza que deseja excluir a conversa com ${conv.contactName}?`);
    if (!confirmar) return;
    try {
      // Deletar no Supabase (contatos: por telefone_formatado; grupos: por numero JID)
      const isGroup = /@g\.us$/.test(String(conv.id));
      const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
      const base = supabase.from('conversas').delete().eq('company_id', userCompanyId);
      const {
        error
      } = await (isGroup ? base.eq('numero', conv.id) : base.eq('telefone_formatado', numeroNormalizado!));
      if (error) throw error;

      // Remover localmente
      const updated = conversations.filter(c => c.id !== conversationId);
      setConversations(updated);

      // Remover do mapeamento de leads vinculados
      setLeadsVinculados(prev => {
        const newMap = {
          ...prev
        };
        delete newMap[conv.id];
        const formatted = safeFormatPhoneNumber(conv.id);
        if (formatted) {
          delete newMap[formatted];
        }
        return newMap;
      });
      if (selectedConv?.id === conversationId) {
        setSelectedConv(null);
        setLeadVinculado(null);
      }
      saveConversations(updated);
      toast.success("Conversa excluída com sucesso!");
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      toast.error("Erro ao excluir conversa");
    }
  };

  // ✅ REMOVIDO: Declaração duplicada de filteredConversations (já existe na linha 459 com useMemo)

  const openConversationWithContact = (name: string, phone: string) => {
    const normalized = normalizePhoneForWA(phone);
    const existente = conversations.find(c => c.id === normalized || c.phoneNumber === normalized);
    if (existente) {
      setSelectedConv(existente);
      toast.success('Conversa aberta');
      return;
    }
    const novaConversa: Conversation = {
      id: normalized || phone || Date.now().toString(),
      contactName: name || 'Contato',
      channel: 'whatsapp',
      status: 'waiting',
      lastMessage: 'Nova conversa',
      unread: 0,
      messages: [],
      tags: [],
      phoneNumber: normalized || phone
    };
    const updated = [novaConversa, ...conversations];
    setConversations(updated);
    setSelectedConv(novaConversa);
    saveConversations(updated);
    toast.success(`Conversa com ${name} criada`);
  };

  // Utilitário: garantir company_id e enviar via Edge Function
  const getCompanyId = async (): Promise<string | null> => {
    if (userCompanyId) return userCompanyId;
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    if (!session) return null;
    const {
      data: userRole
    } = await supabase.from('user_roles').select('company_id').eq('user_id', session.user.id).maybeSingle();
    if (userRole?.company_id) setUserCompanyId(userRole.company_id);
    return userRole?.company_id || null;
  };
  const enviarWhatsApp = async (body: any) => {
    console.log('📞 [ENVIAR-WHATSAPP] Iniciando envio:', {
      numero: body.numero,
      tipo: body.tipo_mensagem,
      temMensagem: !!body.mensagem
    });
    const companyId = await getCompanyId();
    if (!companyId) {
      console.error('❌ [ENVIAR-WHATSAPP] Company ID não encontrado!');
      return {
        data: null,
        error: {
          message: 'Company ID não encontrado. Faça login novamente.'
        }
      } as const;
    }
    console.log('📞 [ENVIAR-WHATSAPP] Company ID obtido:', companyId);

    // Usar wrapper com retry/timeout e retornar no formato compatível (data/error)
    const result = await sendWhatsAppWithRetry({
      company_id: companyId,
      ...body
    });
    console.log('📞 [ENVIAR-WHATSAPP] Resultado do sendWhatsAppWithRetry:', {
      success: result?.success,
      errorCode: result?.errorCode,
      message: result?.message
    });
    if (result && result.success) {
      return {
        data: result,
        error: null
      } as const;
    }
    return {
      data: result,
      error: {
        message: result?.message || 'Falha ao enviar mensagem'
      }
    } as const;
  };

  // Normaliza destino: preserva JID de grupo (@g.us). Para contatos, mantém apenas dígitos com prefixo 55.
  const normalizePhoneForWA = (raw: string | undefined | null): string => {
    const value = String(raw || '');
    if (/@g\.us$/.test(value)) return value; // grupo
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
  };

  // Função para limpar histórico de conversas
  const handleCleanHistory = async () => {
    setCleaningHistory(true);
    setCleaningProgress(0);
    setCleaningStats({
      deleted: 0,
      total: 0
    });
    try {
      const result = await cleanAllConversationsHistory(userCompanyId || undefined, (progress, deleted, total) => {
        setCleaningProgress(progress);
        setCleaningStats({
          deleted,
          total
        });
      });
      if (result.success) {
        // ⚡ CORREÇÃO: Limpar APENAS o histórico de conversas, sem afetar outras funcionalidades
        // Não chamar loadSupabaseConversations() para evitar reinicialização desnecessária
        setConversations([]);
        setSelectedConv(null);
        setLeadVinculado(null);
        setLeadsVinculados({});

        // Limpar cache do hook de conversas também
        if (syncConversations) {
          await syncConversations(true); // Force refresh do cache
        }
        toast.success(`✅ Histórico limpo! ${result.supabaseResult?.deletedCount || 0} mensagens removidas. Todas as outras configurações foram preservadas.`, {
          duration: 5000
        });
        setCleanHistoryDialogOpen(false);
        console.log('✅ [CLEAN] Histórico limpo sem afetar funcionalidades:', {
          leadsPreservados: result.diagnosis?.leads.count,
          tarefasPreservadas: result.diagnosis?.tasks.count,
          funisPreservados: result.diagnosis?.funis.count,
          etapasPreservadas: result.diagnosis?.etapas.count,
          whatsappPreservado: result.diagnosis?.whatsappConnections.count
        });
      } else {
        toast.error(`❌ Erro ao limpar histórico: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('❌ Erro ao limpar histórico:', error);
      toast.error(`❌ Erro ao limpar histórico: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setCleaningHistory(false);
      setCleaningProgress(0);
      setCleaningStats({
        deleted: 0,
        total: 0
      });
    }
  };
  const finalizarAtendimento = async (mensagem: string) => {
    if (!selectedConv) return;
    try {
      // Enviar mensagem de finalização
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const {
        data,
        error
      } = await enviarWhatsApp({
        numero: numeroNormalizado,
        mensagem,
        tipo_mensagem: 'text'
      });
      if (error || !data?.success) {
        // Wrapper já exibiu o toast de erro específico
        return;
      }

      // Persistir no histórico
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();

      // CORREÇÃO: Inserir mensagem de finalização com status Resolvida e fromme: true
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      const {
        data: userProfile
      } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : {
        data: null
      };
      await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem,
        origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
        status: 'Resolvida',
        tipo_mensagem: 'text',
        nome_contato: selectedConv.contactName?.replace(/^ig_/, '') || selectedConv.contactName,
        company_id: userRole?.company_id,
        owner_id: user?.id,
        sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
        fromme: true, // ⚡ CRÍTICO: Marcar como mensagem enviada para aparecer no lado direito
        delivered: true,
        read: false
      }]);

      // CORREÇÃO: Atualizar TODAS as mensagens anteriores desta conversa para status Resolvida
      const telefoneFormatado = numeroNormalizado.replace(/[^0-9]/g, '');
      await supabase.from('conversas').update({
        status: 'Resolvida'
      }).eq('telefone_formatado', telefoneFormatado).eq('company_id', userRole?.company_id).neq('status', 'Resolvida'); // Só atualizar as que ainda não estão resolvidas

      // Limpar conversation_assignments para desbloquear fluxo futuro
      await supabase
        .from('conversation_assignments')
        .delete()
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userRole?.company_id);

      console.log('✅ Conversa marcada como resolvida e assignment removido');

      // Atualizar estados localmente
      const updatedConv: Conversation = {
        ...selectedConv,
        status: 'resolved',
        lastMessage: mensagem
      };
      const updatedList = conversations.map(c => c.id === selectedConv.id ? updatedConv : c);
      saveConversations(updatedList);
      setConversations(updatedList);
      setSelectedConv(updatedConv);
      toast.success('Atendimento finalizado e mensagem enviada');
    } catch (e) {
      console.error('❌ Erro ao finalizar atendimento:', e);
      toast.error('Erro ao finalizar atendimento');
    }
  };

  // 🆕 NOVO: Finalizar atendimento SEM enviar mensagem
  const finalizarAtendimentoSilent = async () => {
    if (!selectedConv) return;
    try {
      // Obter dados do usuário
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      // Atualizar TODAS as mensagens desta conversa para status Resolvida
      const telefoneFormatado = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
      
      await supabase
        .from('conversas')
        .update({ status: 'Resolvida' })
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userRole?.company_id)
        .neq('status', 'Resolvida');

      // Limpar conversation_assignments para desbloquear fluxo futuro
      await supabase
        .from('conversation_assignments')
        .delete()
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userRole?.company_id);

      console.log('✅ Conversa marcada como resolvida e assignment removido (sem mensagem)');

      // Atualizar estados localmente
      const updatedConv: Conversation = {
        ...selectedConv,
        status: 'resolved',
      };
      const updatedList = conversations.map(c => c.id === selectedConv.id ? updatedConv : c);
      saveConversations(updatedList);
      setConversations(updatedList);
      setSelectedConv(updatedConv);
      
      toast.success('Atendimento finalizado');
    } catch (e) {
      console.error('❌ Erro ao finalizar atendimento:', e);
      toast.error('Erro ao finalizar atendimento');
    }
  };
  return <div className="flex w-full bg-background overflow-hidden" style={{ height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)' }}>
      {/* Sidebar esquerda - tema cinza claro */}
      {/* No mobile: esconder quando uma conversa está selecionada */}
      <div className={`${isMobile ? (selectedConv ? 'hidden' : 'w-full') : 'w-[380px]'} flex-shrink-0 bg-muted/30 border-r border-border flex flex-col overflow-hidden`}>
        {/* Header - Fixo, não move com scroll */}
        <div className="px-3 py-4 bg-background border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Bate-Papo Multicanal </h1>
            <div className="flex gap-2 items-center">
              <NovaConversaDialog onNovaConversa={async (nome, numero) => {
              try {
                // Normalizar número para comparação (garante formato 55DDDXXXXXXXX)
                const numeroNormalizado = normalizePhoneForComparison(numero);
                console.log('📱 [NovaConversa] Verificando existência:', {
                  numeroRecebido: numero,
                  numeroNormalizado
                });

                // Verificar se já existe conversa com esse número (comparação normalizada)
                const existente = conversations.find(c => {
                  const idNorm = normalizePhoneForComparison(c.id);
                  const phoneNorm = normalizePhoneForComparison(c.phoneNumber);
                  return idNorm === numeroNormalizado || phoneNorm === numeroNormalizado;
                });
                if (existente) {
                  setSelectedConv(existente);
                  toast.info("Conversa já existe!");
                  return;
                }

                // Salvar conversa no banco de dados primeiro
                const {
                  data: {
                    user
                  }
                } = await supabase.auth.getUser();
                if (!user) {
                  toast.error('Usuário não autenticado');
                  return;
                }
                const {
                  data: userRole
                } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
                if (!userRole?.company_id) {
                  toast.error('Configuração de empresa não encontrada');
                  return;
                }

                // 🔥 CORREÇÃO CRÍTICA: Verificar se já existe lead com este número
                // Preparar variações do número para busca abrangente
                const numeroSem55 = numeroNormalizado.startsWith('55') ? numeroNormalizado.substring(2) : numeroNormalizado;
                const numeroCom55 = numeroNormalizado.startsWith('55') ? numeroNormalizado : `55${numeroNormalizado}`;
                
                console.log('📱 [NovaConversa] Buscando lead existente:', {
                  numeroNormalizado,
                  numeroSem55,
                  numeroCom55
                });

                // Buscar lead existente por qualquer variação do número
                const { data: existingLead } = await supabase
                  .from('leads')
                  .select('id, name')
                  .eq('company_id', userRole.company_id)
                  .or(`telefone.eq.${numeroNormalizado},telefone.eq.${numeroSem55},telefone.eq.${numeroCom55},phone.eq.${numeroNormalizado},phone.eq.${numeroSem55},phone.eq.${numeroCom55}`)
                  .limit(1)
                  .maybeSingle();

                let leadId = existingLead?.id || null;

                // Se não existe lead, criar um novo
                if (!leadId) {
                  console.log('📝 [NovaConversa] Criando novo lead para:', nome);
                  const { data: newLead, error: leadError } = await supabase
                    .from('leads')
                    .insert({
                      name: nome,
                      phone: numeroNormalizado,
                      telefone: numeroNormalizado,
                      company_id: userRole.company_id,
                      source: 'manual',
                      status: 'novo',
                      stage: 'prospeccao'
                    })
                    .select('id')
                    .single();

                  if (leadError) {
                    console.error('Erro ao criar lead:', leadError);
                    // Não retornar erro, continuar mesmo sem lead
                  } else {
                    leadId = newLead?.id;
                    console.log('✅ [NovaConversa] Lead criado com sucesso:', leadId);
                  }
                } else {
                  console.log('✅ [NovaConversa] Lead existente encontrado:', {
                    leadId,
                    leadName: existingLead?.name
                  });
                }

                // Inserir conversa no banco com número normalizado e lead_id vinculado
                const {
                  error: insertError
                } = await supabase.from('conversas').insert({
                  numero: numeroNormalizado,
                  nome_contato: nome,
                  mensagem: 'Nova conversa criada',
                  telefone_formatado: numeroNormalizado,
                  company_id: userRole.company_id,
                  owner_id: user.id,
                  lead_id: leadId, // 🔥 CRÍTICO: Vincular ao lead para evitar duplicação
                  fromme: true,
                  status: 'Enviada',
                  origem: 'WhatsApp',
                  delivered: true,
                  read: false
                });
                if (insertError) {
                  console.error('Erro ao salvar conversa:', insertError);
                  toast.error('Erro ao salvar contato no banco de dados');
                  return;
                }
                console.log('✅ [NovaConversa] Conversa salva com número:', numeroNormalizado, 'lead_id:', leadId);

                // Criar conversa local com número normalizado
                const novaConversa: Conversation = {
                  id: numeroNormalizado,
                  contactName: nome,
                  channel: "whatsapp",
                  status: "waiting",
                  lastMessage: "Nova conversa",
                  unread: 0,
                  messages: [],
                  tags: [],
                  phoneNumber: numeroNormalizado,
                  leadId: leadId || undefined
                };
                const updated = [novaConversa, ...conversations];
                setConversations(updated);
                setSelectedConv(novaConversa);
                saveConversations(updated);
                toast.success(`Contato ${nome} salvo com sucesso!`);
              } catch (error) {
                console.error('Erro ao criar contato:', error);
                toast.error('Erro ao criar contato');
              }
            }} />
              {/* 📊 Botão Produtividade - apenas para gestores/admins */}
              {canViewProductivity && (
                <Button size="icon" variant="outline" onClick={() => setProductivityPanelOpen(true)} className="gap-0" aria-label="Produtividade" title="Relatório de Produtividade">
                  <BarChart3 className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="outline" onClick={async () => {
                console.log('📸 Botão Atualizar Fotos clicado');
                toast.info('Buscando fotos de perfil em massa...');
                try {
                  const { data, error } = await supabase.functions.invoke('batch-profile-pictures', {
                    body: { company_id: userCompanyId }
                  });
                  if (error) throw error;
                  toast.success(`Fotos atualizadas: ${data?.updated || 0} de ${data?.total || 0}`);
                  // Recarregar conversas para mostrar novas fotos
                  if (data?.updated > 0) {
                    avatarCacheRef.current.clear();
                    loadSupabaseConversations();
                  }
                } catch (err) {
                  console.error('Erro ao atualizar fotos:', err);
                  toast.error('Erro ao buscar fotos de perfil');
                }
              }} className="gap-0" aria-label="Atualizar fotos" title="Buscar fotos de perfil em massa">
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => {
              console.log('🔄 Botão Recarregar clicado');
              loadSupabaseConversations();
              toast.success('Recarregando conversas...');
            }} className="gap-0" aria-label="Recarregar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={cleanHistoryDialogOpen} onOpenChange={setCleanHistoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline" className="gap-0 text-destructive hover:text-destructive" aria-label="Limpar histórico" title="Limpar histórico de conversas">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      Limpar Histórico de Conversas
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Esta ação irá <strong>permanentemente</strong> remover:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                      <li>Todas as mensagens da tabela <code className="bg-muted px-1 rounded">conversas</code> no banco de dados</li>
                      <li>Todos os caches de conversas no navegador (localStorage)</li>
                    </ul>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm font-semibold mb-1">⚠️ Esta ação NÃO pode ser desfeita!</p>
                      <p className="text-xs text-muted-foreground">
                        Após a limpeza, apenas novas mensagens recebidas/enviadas aparecerão no sistema.
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-100">✅ Dados preservados:</p>
                      <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-2">
                        <li>• Funil de Vendas (leads, kanban)</li>
                        <li>• Tarefas</li>
                        <li>• Agenda</li>
                        <li>• Todas as outras funcionalidades</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCleanHistoryDialogOpen(false)} disabled={cleaningHistory}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleCleanHistory} disabled={cleaningHistory}>
                      {cleaningHistory ? <div className="flex items-center gap-2">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Limpando... {cleaningProgress}%</span>
                          <span className="text-xs opacity-70">({cleaningStats.deleted}/{cleaningStats.total})</span>
                        </div> : <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Limpar Histórico
                        </>}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="🔍 Buscar conversa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-background" />
          </div>

          {/* ✅ FASE 4: Indicadores de Sincronização */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Status de conexão realtime */}
              <div className={`flex items-center gap-1 text-xs ${realtimeConnectionStatus === 'connected' ? 'text-green-500' : realtimeConnectionStatus === 'connecting' ? 'text-yellow-500' : 'text-red-500'}`}>
                <div className={`w-2 h-2 rounded-full ${realtimeConnectionStatus === 'connected' ? 'bg-green-500' : realtimeConnectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="hidden sm:inline">
                  {realtimeConnectionStatus === 'connected' ? 'Conectado' : realtimeConnectionStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </span>
              </div>
              
              {/* Indicador de sincronização */}
              {cacheSyncing && <div className="flex items-center gap-1 text-xs text-blue-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span className="hidden sm:inline">Sincronizando...</span>
                </div>}
            </div>
            
            {/* Última sincronização */}
            {cacheLastSync > 0 && <span className="text-xs text-muted-foreground hidden md:inline">
                Atualizado: {format(new Date(cacheLastSync), "HH:mm:ss", {
              locale: ptBR
            })}
              </span>}
          </div>
          
          {/* Filters */}
          <div className="flex gap-1 flex-wrap">
            <Button variant={filter === "all" ? "default" : "ghost"} size="sm" onClick={() => setFilter("all")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="secondary" className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {conversations.filter(c => !c.isGroup || !blockedGroups.has(c.phoneNumber || c.id)).length}
              </Badge>
              <span className="text-xs">Todos</span>
            </Button>
            <Button variant={filter === "waiting" ? "default" : "ghost"} size="sm" onClick={() => setFilter("waiting")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {waitingCount}
              </Badge>
              <span className="text-xs">Esperando</span>
            </Button>
            <Button variant={filter === "answered" ? "default" : "ghost"} size="sm" onClick={() => setFilter("answered")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {answeredCount}
              </Badge>
              <span className="text-xs">Em Atend.</span>
            </Button>
            <Button variant={filter === "resolved" ? "default" : "ghost"} size="sm" onClick={() => setFilter("resolved")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="secondary" className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {conversations.filter(c => !c.isGroup && c.status === 'resolved').length}
              </Badge>
              <span className="text-xs">Finalizados</span>
            </Button>
            {/* 🔐 Filtro de Grupos - APENAS SUPER ADMIN */}
            {isSuperAdmin && (
              <Button variant={filter === "group" ? "default" : "ghost"} size="sm" onClick={() => setFilter("group")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
                <Badge variant="secondary" className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                  {conversations.filter(c => c.isGroup === true).length}
                </Badge>
                <span className="text-xs">Grupos</span>
              </Button>
            )}
            <Button variant={filter === "instagram" ? "default" : "ghost"} size="sm" onClick={() => setFilter("instagram")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="secondary" className="bg-pink-500 hover:bg-pink-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {conversations.filter(c => c.channel === 'instagram').length}
              </Badge>
              <span className="text-xs flex items-center gap-0.5"><Instagram className="h-3 w-3" />Instagram</span>
            </Button>
            <Button variant={filter === "responsible" ? "default" : "ghost"} size="sm" onClick={() => setFilter("responsible")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="secondary" className="bg-green-500 hover:bg-green-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {responsibleCount}
              </Badge>
              <span className="text-xs">Responsável</span>
            </Button>
            <Button variant={filter === "transferred" ? "default" : "ghost"} size="sm" onClick={() => setFilter("transferred")} className="relative flex flex-col items-center gap-0.5 h-auto py-1 px-2">
              <Badge variant="secondary" className="bg-purple-500 hover:bg-purple-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs">
                {conversations.filter(c => !c.isGroup && c.assignedUser?.id === currentUserId).length}
              </Badge>
              <span className="text-xs">Transferidos</span>
            </Button>
            
            {/* 🆕 Botão Filtros Avançados */}
            <ConversasAdvancedFilter
              companyId={userCompanyId}
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              allTags={allTags}
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {/* ✅ MELHORADO: Estados de loading e busca */}
          {conversations.length === 0 && !loadingConversations && !isSearching && debouncedSearchTerm.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Buscando "{searchTerm}"...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              {debouncedSearchTerm.trim().length >= 2 ? (
                <>
                  <p className="text-sm text-muted-foreground">Nenhum contato encontrado para "{debouncedSearchTerm}"</p>
                  <p className="text-xs text-muted-foreground/70">Tente buscar por nome ou número de telefone</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
              )}
            </div>
          ) : filteredConversations.map(conv => <ConversationListItem key={conv.id} contactName={conv.contactName} channel={conv.channel} lastMessage={conv.lastMessage} timestamp={new Date(conv.messages[conv.messages.length - 1]?.timestamp)} unread={conv.unread} isSelected={selectedConv?.id === conv.id} avatarUrl={conv.avatarUrl} tags={conv.tags} responsavel={conv.responsavel || conv.assignedUser?.name} funnelStage={conv.funnelStage} valor={conv.valor} conversationId={conv.id} leadId={conv.leadId || leadsVinculados[conv.id] || leadsVinculados[safeFormatPhoneNumber(conv.id)]} isGroup={conv.isGroup} isBlocked={blockedGroups.has(conv.phoneNumber || conv.id)} assignedUser={conv.assignedUser} status={conv.status} origemApi={conv.origemApi} isPinned={pinnedConversations.has(conv.id) || pinnedConversations.has(conv.phoneNumber || '')} onTogglePin={() => togglePinConversation(conv.id)} attendingUser={getAttendingUser((conv.phoneNumber || conv.id).replace(/[^0-9]/g, ''))} lastRespondedBy={(() => {
          // ⚡ Buscar última mensagem enviada pelo usuário para mostrar quem respondeu
          const userMessages = conv.messages.filter(m => m.sender === "user");
          if (userMessages.length > 0) {
            const lastUserMsg = userMessages[userMessages.length - 1];
            // Se tem sentBy, usar o nome do usuário
            // Se não tem sentBy mas é mensagem enviada (fromme=true), significa que veio do WhatsApp celular
            if (lastUserMsg.sentBy) {
              return lastUserMsg.sentBy;
            }
            // Mensagem enviada sem sentBy = enviada pelo WhatsApp do celular
            return "WhatsApp";
          }
          return undefined;
        })()} onToggleBlock={conv.isGroup ? () => {
          const groupId = conv.phoneNumber || conv.id;
          const isBlocked = blockedGroups.has(groupId);
          toggleBlockGroup(groupId, conv.contactName, !isBlocked);
        } : () => {
          console.log('⚠️ Tentativa de bloquear contato individual - operação não suportada');
        }} onEditName={() => handleEditName(conv.id)} onCreateLead={() => handleCreateLead(conv.id)} onDeleteConversation={() => handleDeleteConversation(conv.id)} onClick={async () => {
          console.log('🔍 Conversa selecionada:', conv.id, 'Mensagens:', conv.messages.length);

          // CORREÇÃO: Garantir que userCompanyId está disponível antes de usar
          if (!userCompanyId) {
            const {
              data: userRole
            } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
            if (userRole?.company_id) {
              setUserCompanyId(userRole.company_id);
            }
          }

          // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp antes de selecionar
          const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
            return [...messages].sort((a, b) => {
              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
              return timeA - timeB;
            });
          };

          // Marcar mensagens como lidas e visualizadas
          // CRÍTICO: Preservar avatarUrl ao atualizar e ordenar mensagens por timestamp
          const sortedMessages = sortMessagesByTimestamp(conv.messages);
          const updatedConv = {
            ...conv,
            unread: 0,
            avatarUrl: conv.avatarUrl,
            // Garantir que avatar não seja perdido
            messages: sortedMessages.map(msg => ({
              ...msg,
              read: true
            }))
          };
          console.log('📸 [AVATAR-DEBUG] Selecionando conversa:', {
            id: conv.id,
            name: conv.contactName,
            avatarUrl: conv.avatarUrl?.substring(0, 50)
          });
          setSelectedConv(updatedConv);

          // 📜 Carregar histórico completo automaticamente
          if (conv.phoneNumber && userCompanyId) {
            const stats = historyStats[conv.phoneNumber];
            // Se não tem stats ou tem poucas mensagens carregadas, buscar histórico
            if (!stats || conv.messages.length < 20) {
              loadFullConversationHistory(conv.phoneNumber, conv.contactName);
            }
          }

          // Verificar se existe lead vinculado
          verificarLeadVinculado(conv);

          // Atualizar estado e localStorage - CRÍTICO: Preservar avatars
          const updated = conversations.map(c => c.id === conv.id ? updatedConv : {
            ...c,
            avatarUrl: c.avatarUrl
          });
          setConversations(updated); // Atualizar estado React
          saveConversations(updated); // Salvar no localStorage

          console.log('📸 [AVATAR-DEBUG] Conversas atualizadas, avatars preservados:', {
            total: updated.length,
            comAvatar: updated.filter(c => c.avatarUrl).length
          });

          // Persistir no Supabase: marcar mensagens recebidas como 'Lida'
          try {
            const isGroup = /@g\.us$/.test(String(conv.id));
            const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
            // CORREÇÃO: Buscar company_id corretamente
            let companyIdToUse = userCompanyId;
            if (!companyIdToUse) {
              const {
                data: userRole
              } = await supabase.from('user_roles').select('company_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
              companyIdToUse = userRole?.company_id || null;
              if (companyIdToUse) {
                setUserCompanyId(companyIdToUse);
              }
            }
            if (companyIdToUse) {
              const base = supabase.from('conversas').update({
                status: 'Lida'
              }).eq('company_id', companyIdToUse).eq('status', 'Recebida');
              await (isGroup ? base.eq('numero', conv.id) : base.eq('telefone_formatado', numeroNormalizado!));
            }
          } catch (err) {
            console.error('Erro ao marcar mensagens como lidas no Supabase:', err);
          }

          // Mostrar toast de visualizado
          if (conv.unread > 0) {
            toast.success('✔️ Mensagens visualizadas');
          }
        }} />)}
          
          {/* ⚡ Botão Carregar Mais Conversas */}
          {!loadingConversations && filteredConversations.length > 0 && hasMoreConversations && <div className="p-4 flex justify-center">
              <Button variant="outline" onClick={async () => {
            setLoadingMore(true);
            await loadSupabaseConversations(true); // Append mode
            setLoadingMore(false);
          }} disabled={loadingMore} className="w-full">
                {loadingMore ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando mais...
                  </> : <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Carregar Mais Conversas
                  </>}
              </Button>
            </div>}
        </ScrollArea>
      </div>

      {/* Chat Area - Estrutura com header e input fixos */}
      {/* No mobile: mostrar apenas quando uma conversa está selecionada */}
      <div className={`${isMobile && !selectedConv ? 'hidden' : 'flex-1'} flex flex-col min-w-0`} style={{
        height: '100%',
        maxHeight: '100vh',
        overflow: 'hidden'
      }}>
        {selectedConv ? <>
            {/* Header - FIXO NO TOPO */}
            <div className="flex-shrink-0 bg-background border-b z-10">
              <ConversationHeader contactName={selectedConv.contactName} channel={selectedConv.channel} avatarUrl={selectedConv.avatarUrl} produto={selectedConv.produto} valor={selectedConv.valor || (leadVinculado?.value && leadVinculado.value > 0 ? `R$ ${Number(leadVinculado.value).toLocaleString('pt-BR')}` : undefined)} responsavel={selectedConv.responsavel || leadExtraInfo.responsavelNome} tags={selectedConv.tags || leadVinculado?.tags} funnelStage={selectedConv.funnelStage || (leadExtraInfo.etapaNome ? (leadExtraInfo.funilNome ? `${leadExtraInfo.funilNome} → ${leadExtraInfo.etapaNome}` : leadExtraInfo.etapaNome) : undefined)} showInfoPanel={showInfoPanel} onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)} syncStatus={syncStatus} leadVinculado={leadVinculado} mostrarBotaoCriarLead={mostrarBotaoCriarLead} onCriarLead={criarLeadManualmente} onFinalizeAtendimento={finalizarAtendimento} onFinalizeAtendimentoSilent={finalizarAtendimentoSilent} onTransferAtendimento={() => setTransferDialogOpen(true)} onChangeAIMode={(mode) => setConversationAIMode(selectedConv.id, mode)} currentAIMode={(aiMode[selectedConv.id] as any) || 'off'} onlineStatus={onlineStatus[selectedConv.id] || 'unknown'} isContactInactive={isContactInactive} onRestoreConversation={handleRestoreConversation} restoringConversation={restoringConversation} restoreProgress={restoreProgress} showBackButton={isMobile} onBack={() => setSelectedConv(null)} protocolNumber={activeProtocol?.protocol_number} protocolStatus={activeProtocol?.status} contactPhone={(selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '')} companyId={userCompanyId} />
            </div>
            
            {/* Dialog de Transferir Atendimento */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir Atendimento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {/* Filas */}
                  {queues.length > 0 && <div className="space-y-2">
                      <h4 className="text-sm font-medium">Filas</h4>
                      {queues.map(q => <Button key={q.id} variant="outline" className="w-full justify-start" onClick={() => {
                  assignConversationToQueue(q.id, q.name);
                  setTransferDialogOpen(false);
                }}>
                          📥 {q.name}
                        </Button>)}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Ver membros da fila:</span>
                        <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione uma fila" />
                          </SelectTrigger>
                          <SelectContent>
                            {queues.map(q => <SelectItem key={`sel-header-${q.id}`} value={q.id}>{q.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>}
                  {/* Agentes */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Agentes</h4>
                    {companyUsers.length === 0 ? <p className="text-xs text-muted-foreground">Carregando usuários...</p> : companyUsers.map(user => <Button key={user.id} variant="outline" className="w-full justify-start" onClick={() => {
                  assignConversationToUser(user.id, user.name);
                  setTransferDialogOpen(false);
                }}>
                          👤 {user.name}
                        </Button>)}
                  </div>
                  {/* Membros da fila selecionada */}
                  {selectedQueueId && <div className="space-y-2">
                      <h4 className="text-sm font-medium">Membros da Fila</h4>
                      {queueMembers.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum membro na fila selecionada.</p> : queueMembers.map(m => <Button key={`m-header-${m.id}`} variant="outline" className="w-full justify-start" onClick={() => {
                  assignConversationToUser(m.id, m.name);
                  setTransferDialogOpen(false);
                }}>
                            👤 {m.name}
                          </Button>)}
                    </div>}
                </div>
              </DialogContent>
            </Dialog>

            {/* Container principal: mensagens + input - usa flex-1 para ocupar espaço restante */}
            <div 
              className="flex flex-1 min-h-0 overflow-hidden relative" 
              style={{ flex: '1 1 0%' }}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Overlay de arrastar arquivo */}
              {isDraggingFile && (
                <div className="absolute inset-0 z-50 bg-primary/20 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
                  <div className="bg-background/95 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileUp className="h-8 w-8 text-primary animate-bounce" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">Solte os arquivos aqui</p>
                      <p className="text-sm text-muted-foreground">Imagens, PDFs, documentos e vídeos</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Messages Area + Input */}
              <div className="flex-1 flex flex-col overflow-hidden relative" style={{ minHeight: 0 }}>
                {/* Pasted Image Preview Overlay */}
                {pastedImageFile && (
                  <PastedImagePreview
                    imageFile={pastedImageFile}
                    onSend={async (file, caption) => {
                      await handleSendMedia(file, caption, 'image');
                      setPastedImageFile(null);
                    }}
                    onCancel={() => setPastedImageFile(null)}
                  />
                )}
                {/* Messages - ÚNICA ÁREA COM SCROLL */}
                <div id="messages-scroll-container" className="flex-1 overflow-y-auto p-2 md:p-3 bg-[#e5ddd5] messages-scroll-area" style={{
                  backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
                  WebkitOverflowScrolling: 'touch',
                  minHeight: 0
                } as React.CSSProperties}>
                  {/* Indicador de histórico */}
                  {selectedConv.phoneNumber && historyStats[selectedConv.phoneNumber] && <div className="flex justify-center mb-4">
                      <Badge variant="secondary" className="gap-2">
                        📜 {historyStats[selectedConv.phoneNumber].loaded} mensagens do histórico
                      </Badge>
                    </div>}
                  {loadingHistory && <div className="flex justify-center items-center gap-2 mb-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Carregando histórico completo...</span>
                    </div>}
                  
                  <div className="space-y-2 pb-4">
                     {selectedConv.messages.length === 0 ? <div className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </div> : selectedConv.messages.map(msg => <MessageItem key={msg.id} message={msg as any} allMessages={selectedConv.messages as any} onDownload={downloadMedia} onTranscribe={transcreverAudio} onImageClick={(url, name) => {
                  setSelectedMedia({
                    url,
                    name
                  });
                  setImageModalOpen(true);
                }} onPdfClick={(url, name) => {
                  setSelectedMedia({
                    url,
                    name
                  });
                  setPdfModalOpen(true);
                }} isTranscribing={transcriptionStatuses[msg.id] === "processing"} transcriptionStatus={msg.transcriptionStatus} onRetryTranscribe={msg.transcriptionStatus === "error" ? () => transcreverAudio(msg.id, msg.mediaUrl!, true) : undefined} onReply={handleReply} onEdit={handleEdit} onDelete={handleDelete} onReact={handleReact} onForward={(id, content, type, mediaUrl, fileName) => {
                  setForwardData({
                    open: true,
                    content,
                    type: type as any,
                    mediaUrl,
                    fileName
                  });
                }} onOpenContactConversation={openConversationWithContact} />)}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input Area - FIXO NO BOTTOM */}
                <div className="bg-background border-t border-border p-2 flex-shrink-0" style={{ minHeight: '60px', maxHeight: '180px' }}>
                  {replyingTo && <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                              Respondendo mensagem
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {selectedConv?.messages.find(m => m.id === replyingTo)?.content || ''}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)} className="flex-shrink-0 h-7 w-7 p-0">
                          ✕
                        </Button>
                      </div>
                    </div>}
                  <div className="flex items-end gap-2">
                    <MediaUpload onFileSelected={handleSendMedia} />
                    <Textarea ref={messageTextareaRef} placeholder="Escreva sua mensagem..." value={messageInput} onChange={e => {
                  setMessageInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }} onKeyPress={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }} onPaste={async e => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      e.preventDefault();
                      const blob = items[i].getAsFile();
                      if (blob) {
                        setPastedImageFile(blob);
                      }
                      break;
                    }
                  }
                }} className="flex-1 min-h-[40px] max-h-[200px] resize-none overflow-y-auto" rows={1} />
                    <AudioRecorder onSendAudio={handleSendAudio} />
                    
                    {/* Botão de Correção Automática */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className={`${autoCorrectEnabled ? 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 bg-green-50/50' : 'text-muted-foreground hover:text-foreground border-border'}`}
                      title={autoCorrectEnabled ? "Correção automática ativada (clique para desativar)" : "Correção automática desativada (clique para ativar)"}
                      onClick={() => {
                        const newValue = !autoCorrectEnabled;
                        setAutoCorrectEnabled(newValue);
                        localStorage.setItem(AUTO_CORRECT_KEY, JSON.stringify(newValue));
                        toast.success(newValue ? "Correção automática ativada" : "Correção automática desativada");
                      }}
                    >
                      {isCorrectingText ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <SpellCheck className="h-5 w-5" />
                      )}
                    </Button>
                    
                    {/* Botão de Assinatura na Mensagem */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className={`${includeSignature 
                        ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 bg-blue-50/50' 
                        : 'text-muted-foreground hover:text-foreground border-border'}`}
                      title={includeSignature 
                        ? `Assinatura ativada: "Atendente - ${userName}"` 
                        : "Incluir assinatura na mensagem"}
                      onClick={() => {
                        const newValue = !includeSignature;
                        setIncludeSignature(newValue);
                        localStorage.setItem(INCLUDE_SIGNATURE_KEY, JSON.stringify(newValue));
                        toast.success(newValue 
                          ? `Assinatura ativada: "Atendente - ${userName}"` 
                          : "Assinatura desativada");
                      }}
                    >
                      <PenLine className="h-5 w-5" />
                    </Button>
                    
                    {/* Botão de Respostas Rápidas */}
                    <Dialog open={showQuickRepliesPopup} onOpenChange={setShowQuickRepliesPopup}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-300" title="Respostas Rápidas">
                          <Zap className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-500" />
                            Respostas Rápidas
                          </DialogTitle>
                        </DialogHeader>
                        
                        {/* Mensagens por Categoria */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Mensagens por Categoria:</h4>
                          {quickCategories.length === 0 ? <div className="text-center py-8 text-muted-foreground border rounded-lg">
                              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p>Nenhuma categoria criada</p>
                              <p className="text-sm">Use o botão "Mensagens Rápidas" no painel lateral para criar</p>
                            </div> : <Accordion type="single" collapsible className="w-full">
                              {quickCategories.map(category => {
                          const categoryMessages = quickMessages.filter(msg => msg.category === category.id).sort((a, b) => {
                            const indexA = quickMessages.findIndex(m => m.id === a.id);
                            const indexB = quickMessages.findIndex(m => m.id === b.id);
                            return indexA - indexB;
                          });
                          return <AccordionItem key={category.id} value={category.id}>
                                    <AccordionTrigger className="hover:no-underline">
                                      <div className="flex items-center justify-between w-full pr-4">
                                        <span className="font-medium">{category.name}</span>
                                        <Badge variant="secondary">{categoryMessages.length}</Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      {categoryMessages.length === 0 ? <p className="text-sm text-muted-foreground py-2 px-4">
                                          Nenhuma mensagem nesta categoria
                                        </p> : <div className="space-y-2">
                                          {categoryMessages.map(qm => <div key={qm.id} className="flex items-start justify-between p-3 bg-background rounded border">
                                              <div className="flex-1 min-w-0 mr-3">
                                                <p className="font-medium text-sm mb-1">{qm.title}</p>
                                                {qm.type === "text" ? <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                                    {qm.content}
                                                  </p> : <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    {qm.type === "image" ? <>
                                                        <ImageIcon className="h-4 w-4" />
                                                        <span>[Imagem]</span>
                                                        {qm.mediaUrl && <img src={qm.mediaUrl} alt="Preview" className="h-12 w-12 object-cover rounded border" />}
                                                      </> : qm.type === "audio" ? <>
                                                        <Music className="h-4 w-4" />
                                                        <span>[Áudio]</span>
                                                        {qm.mediaUrl && <audio src={qm.mediaUrl} controls className="h-8 max-w-[200px]" />}
                                                      </> : qm.type === "document" ? <>
                                                        <FileText className="h-4 w-4 text-red-500" />
                                                        <span>[Documento PDF]</span>
                                                      </> : <>
                                                        <Video className="h-4 w-4" />
                                                        <span>[Vídeo]</span>
                                                      </>}
                                                    {qm.content && qm.content !== "[Imagem]" && qm.content !== "[Vídeo]" && qm.content !== "[Áudio]" && qm.content !== "[Documento]" && (
                                                      <span className="text-xs italic">"{qm.content}"</span>
                                                    )}
                                                  </div>}
                                              </div>
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <Button size="sm" onClick={() => {
                                      sendQuickMessage(qm);
                                      setShowQuickRepliesPopup(false);
                                    }} className="bg-primary hover:bg-primary/90">
                                                  Enviar
                                                </Button>
                                              </div>
                                            </div>)}
                                        </div>}
                                    </AccordionContent>
                                  </AccordionItem>;
                        })}
                            </Accordion>}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    {/* 🛒 Botão flutuante de Novo Pedido */}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setPedidoModalOpen(true)}
                      className="bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-md"
                      title="Novo Pedido (Cardápio)"
                    >
                      <ShoppingCart className="h-5 w-5" />
                    </Button>

                    <Button onClick={() => {
                  handleSendMessage();
                  setReplyingTo(null);
                }} size="icon" className="bg-[#25D366] hover:bg-[#128C7E] text-white" disabled={!messageInput.trim() || isCorrectingText || isSendingMessage}>
                      {isCorrectingText || isSendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info Panel - COM SCROLL */}
              {showInfoPanel && <div className="w-[340px] bg-background border-l border-border flex flex-col flex-shrink-0 overflow-hidden">
                  <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-32">
                    {/* Contact Info - Apenas informações básicas do contato */}
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 overflow-hidden">
                        {selectedConv.avatarUrl ? (
                          <img src={selectedConv.avatarUrl} alt={selectedConv.contactName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="text-foreground font-medium text-lg">{selectedConv.contactName}</h3>
                      <p className="text-muted-foreground text-sm capitalize">{selectedConv.channel}</p>
                      {selectedConv.phoneNumber && (
                        <p className="text-muted-foreground text-xs mt-2 flex items-center justify-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedConv.phoneNumber}
                        </p>
                      )}
                    </div>

                    {/* Botão Editar Informações do Contato */}
                    {leadVinculado && (
                      <EditarLeadDialog
                        lead={{
                          id: leadVinculado.id,
                          name: leadVinculado.name || selectedConv.contactName,
                          email: leadVinculado.email || "",
                          phone: leadVinculado.phone || leadVinculado.telefone || selectedConv.phoneNumber || "",
                          status: leadVinculado.status || "novo",
                          source: leadVinculado.source || leadVinculado.origem || "whatsapp",
                          tags: leadVinculado.tags || [],
                          value: leadVinculado.value || 0,
                          notes: leadVinculado.notes || "",
                        } as any}
                        onLeadUpdated={async () => {
                          if (selectedConv.phoneNumber || selectedConv.id) {
                            const telefoneFormatado = safeFormatPhoneNumber(selectedConv.phoneNumber || selectedConv.id);
                            const { data } = await supabase.from('leads').select('*').eq('telefone', telefoneFormatado).maybeSingle();
                            if (data) setLeadVinculado(data);
                          }
                        }}
                      />
                    )}

                    {/* LTV + Programa de Fidelidade */}
                    <ClienteLTVFidelidadePanel
                      leadId={leadVinculado?.id || null}
                      companyId={userCompanyId}
                    />
                  </div>
                </div>}
            </div>
          </> : <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Selecione uma conversa para começar</p>
            </div>
          </div>}
      </div>
      
      {/* Modal de Visualização de Imagem */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2 flex items-center justify-center">
          <div className="relative flex items-center justify-center w-full h-full">
            <img 
              src={selectedMedia?.url} 
              alt={selectedMedia?.name || "Imagem"} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg" 
              style={{ maxWidth: '90vw', maxHeight: '85vh' }}
            />
            <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={() => selectedMedia && downloadMedia(selectedMedia.url, `${selectedMedia.name}.jpg`)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização de PDF */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle>{selectedMedia?.name || 'Documento PDF'}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh] w-full">
            <iframe src={selectedMedia?.url} className="w-full h-full border-0 rounded" title="PDF Viewer" />
          </div>
          <div className="px-4 pb-2">
            <Button variant="secondary" size="sm" onClick={() => selectedMedia && downloadMedia(selectedMedia.url, selectedMedia.name || 'documento.pdf')}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais de Agenda e Tarefa com lead pré-selecionado */}
      {leadVinculado && selectedConv && <>
          <AgendaModal open={agendaModalOpen} onOpenChange={setAgendaModalOpen} lead={{
        id: leadVinculado.id,
        nome: leadVinculado.name || selectedConv.contactName,
        telefone: leadVinculado.phone || leadVinculado.telefone || selectedConv.phoneNumber
      }} onAgendamentoCriado={() => {
        setAgendaModalOpen(false);
        loadMeetings();
        toast.success('Compromisso criado e vinculado ao lead!');
      }} />

          <TarefaModal open={tarefaModalOpen} onOpenChange={setTarefaModalOpen} lead={{
        id: leadVinculado.id,
        nome: leadVinculado.name || selectedConv.contactName
      }} onTarefaCriada={() => {
        setTarefaModalOpen(false);
        if (leadVinculado?.id) {
          carregarTarefasDoLead(leadVinculado.id);
        }
        toast.success('Tarefa criada e vinculada ao lead!');
      }} />

          {/* Modal de Prontuário / Ficha Técnica */}
          <LeadAttachments
            open={attachmentsOpen}
            onOpenChange={(o) => {
              setAttachmentsOpen(o);
              if (!o && leadVinculado?.id) {
                carregarAttachmentsCount(leadVinculado.id);
              }
            }}
            leadId={leadVinculado.id}
            companyId={userCompanyId || ''}
            leadName={leadVinculado.name || selectedConv.contactName}
          />
        </>}

      {/* Dialog: Valor da Venda Rápido */}
      <Dialog open={valorVendaDialogOpen} onOpenChange={setValorVendaDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Valor da Venda / Negociação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="valorVendaConversas">Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                <Input
                  id="valorVendaConversas"
                  type="text"
                  inputMode="numeric"
                  placeholder="1.500,00"
                  value={valorVendaInput}
                  onChange={(e) => {
                    // Remover tudo que não for número
                    let rawValue = e.target.value.replace(/\D/g, '');
                    
                    // Limitar a 15 dígitos para evitar overflow
                    if (rawValue.length > 15) {
                      rawValue = rawValue.slice(0, 15);
                    }
                    
                    // Formatar como moeda brasileira (centavos)
                    if (rawValue === '') {
                      setValorVendaInput('');
                      return;
                    }
                    
                    // Converter para número e formatar
                    const numericValue = parseInt(rawValue, 10);
                    const formatted = new Intl.NumberFormat('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(numericValue / 100);
                    
                    setValorVendaInput(formatted);
                  }}
                  className="text-lg font-medium pl-10"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Digite o valor estimado ou fechado da negociação
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setValorVendaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSalvarValorVenda}
                className="bg-green-600 hover:bg-green-700"
                disabled={salvandoValor}
              >
                {salvandoValor ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Salvar Valor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Selecionar Produto */}
      {/* Dialog de seleção de produto com filtros e pesquisa */}
      <ProdutoSelectorDialog
        open={produtoDialogOpen}
        onOpenChange={setProdutoDialogOpen}
        companyId={userCompanyId || ""}
        selectedProductId={leadVinculado?.produto_id}
        onSelectProduct={handleSalvarProduto}
        saving={salvandoProduto}
      />

      {/* Dialog: Finalizar Negociação (Ganho/Perdido) */}
      {leadVinculado && (
        <FinalizarNegociacaoDialog
          lead={{
            id: leadVinculado.id,
            name: leadVinculado.name || selectedConv?.contactName,
            value: leadVinculado.value,
            status: leadVinculado.status
          }}
          open={finalizarNegociacaoOpen}
          onOpenChange={setFinalizarNegociacaoOpen}
          defaultAction={finalizarNegociacaoAction}
          onUpdated={async () => {
            // Recarregar informações do lead após atualização
            if (selectedConv && (selectedConv.phoneNumber || selectedConv.id)) {
              const telefoneFormatado = safeFormatPhoneNumber(selectedConv.phoneNumber || selectedConv.id);
              const { data: leadAtualizado } = await supabase
                .from('leads')
                .select('*')
                .or(`phone.eq.${telefoneFormatado},telefone.eq.${telefoneFormatado}`)
                .maybeSingle();
              if (leadAtualizado) {
                setLeadVinculado(leadAtualizado);
              }
            }
          }}
        />
      )}

      {/* Dialog: Encaminhar Mensagem */}
      <ForwardMessageDialog
        open={forwardData.open}
        onOpenChange={(open) => setForwardData(prev => ({ ...prev, open }))}
        messageContent={forwardData.content}
        messageType={forwardData.type}
        mediaUrl={forwardData.mediaUrl}
        fileName={forwardData.fileName}
        companyId={userCompanyId || ""}
      />

      {/* 📊 Painel de Produtividade */}
      <ProductivityPanel
        open={productivityPanelOpen}
        onOpenChange={setProductivityPanelOpen}
        companyId={userCompanyId || ""}
      />

      {/* 🛒 Modal de novo pedido direto da conversa (cardápio) */}
      {userCompanyId && (
        <PedidoChatModal
          open={pedidoModalOpen}
          onOpenChange={setPedidoModalOpen}
          companyId={userCompanyId}
          leadId={leadVinculado?.id || null}
          clienteNome={leadVinculado?.name || selectedConv?.contactName || ""}
          clienteTelefone={selectedConv?.phoneNumber || selectedConv?.id || leadVinculado?.phone || leadVinculado?.telefone || ""}
        />
      )}
    </div>;
}
export default Conversas;
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Usb,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  PlugZap,
  Power,
  FileText,
  Settings2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Tipos simplificados
type PrinterStatus = "disconnected" | "connecting" | "connected" | "error";

type PrinterConfig = {
  auto_print: boolean;
  print_copies: number;
  paper_width: "58mm" | "80mm";
  show_logo: boolean;
  show_qrcode: boolean;
  footer_message: string;
  order_copy_title?: string;
  kitchen_copy_title?: string;
  print_order_copy?: boolean;
  print_kitchen_copy?: boolean;
  show_customer_phone?: boolean;
  show_delivery_address?: boolean;
  show_payment?: boolean;
  show_prices_on_kitchen?: boolean;
  print_density?: number;
};

type Pedido = any;

type StoreInfo = {
  nome_loja: string;
  endereco_loja?: string;
  telefone_loja?: string;
};

// ESC/POS helpers
const ESC = 0x1b;
const GS = 0x1d;
const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  FONT_NORMAL: [ESC, 0x21, 0x00],
  FONT_DOUBLE_H: [ESC, 0x21, 0x10],
  FONT_DOUBLE: [ESC, 0x21, 0x30],
  FONT_SMALL: [ESC, 0x21, 0x01],
  LINE_FEED: [0x0a],
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x01],
  FEED_4: [ESC, 0x64, 0x04],
};

function textToBytes(text: string): number[] {
  return Array.from(text).map((c) => {
    const code = c.charCodeAt(0);
    if (code < 128) return code;
    // fallback basic mapping
    const map: Record<string, number> = { 'ç': 0x87, 'Ç': 0x80, 'á': 0xa0, 'Á': 0xb5 };
    return map[c] ?? 0x3f;
  });
}
function str(text: string) { return textToBytes(text); }
function lf() { return CMD.LINE_FEED; }
function br(n = 1) { return Array(n).fill(0x0a); }
function line(char = '-', cols = 48) { return str(char.repeat(cols)); }
function padRight(text: string, total: number) { return text.length >= total ? text.slice(0, total) : text + ' '.repeat(total - text.length); }
function cols2(left: string, right: string, total = 48) { const maxLeft = total - right.length - 1; const l = left.length > maxLeft ? left.slice(0, maxLeft - 1) + '.' : left; return str(padRight(l, total - right.length) + right); }
function formatBRL(value: number) { return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`; }
function formatDate(iso: string) { try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; } }

function buildCupom(pedido: Pedido, store: StoreInfo, config: PrinterConfig, copy = 1, totalCopies = 1) {
  const COLS = config.paper_width === '58mm' ? 32 : 48;
  const bytes: number[] = [];
  const push = (...chunks: Array<number | number[]>) => chunks.forEach(c => Array.isArray(c) ? bytes.push(...c) : bytes.push(c));
  push(CMD.INIT);
  push(CMD.ALIGN_CENTER);
  push(CMD.FONT_DOUBLE, ...str((store.nome_loja||'').toUpperCase()), ...lf(), CMD.FONT_NORMAL);
  if (store.endereco_loja) push(...str(store.endereco_loja), ...lf());
  if (store.telefone_loja) push(...str(`Tel: ${store.telefone_loja}`), ...lf());
  push(...br(1));
  push(CMD.ALIGN_LEFT, ...line('-', COLS), ...lf());
  push(CMD.BOLD_ON, ...str('PEDIDO'), CMD.BOLD_OFF, ...str(` #${pedido?.codigo_pedido || ''}`), ...lf());
  push(...str(formatDate(pedido?.created_at || new Date().toISOString())), ...lf());
  push(...br(1));
  push(...line('=', COLS), ...lf());
  push(CMD.ALIGN_CENTER, ...str(config.footer_message || 'Obrigado!'), ...lf());
  push(CMD.FEED_4, CMD.CUT_PARTIAL);
  return new Uint8Array(bytes);
}

function buildTesteCupom(store: StoreInfo, config: PrinterConfig) {
  return buildCupom({ codigo_pedido: 'TESTE-001', created_at: new Date().toISOString(), cliente_nome: 'Teste' } as any, store, config);
}

// Hook de Web Serial com detecção de portas
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function printTesteViaWindows(store: StoreInfo, config: PrinterConfig) {
  const receiptText = generatePreviewText(store, config);
  const width = config.paper_width === '58mm' ? '58mm' : '80mm';
  const win = window.open('', '_blank', 'width=420,height=640');

  if (!win) {
    toast.error('O navegador bloqueou a janela de impressao.');
    return;
  }

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Cupom de teste</title>
        <style>
          @page { size: ${width} auto; margin: 3mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", monospace;
            font-size: ${config.paper_width === '58mm' ? '10px' : '11px'};
            line-height: 1.25;
          }
          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
        </style>
      </head>
      <body><pre>${escapeHtml(receiptText)}</pre></body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function useSerialPrinter() {
  const portRef = useRef<any | null>(null);
  const writerRef = useRef<any | null>(null);
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [portInfo, setPortInfo] = useState('');
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);
  const [selectedPortIndex, setSelectedPortIndex] = useState<number | null>(null);
  const [detectingPorts, setDetectingPorts] = useState(false);
  const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  // Detectar portas seriais disponíveis
  const detectPorts = async () => {
    if (!isSupported) return;
    setDetectingPorts(true);
    try {
      const ports = await (navigator as any).serial.getPorts();
      setAvailablePorts(ports);
      if (ports.length === 0) {
        toast.info('Nenhuma porta serial detectada. Conecte a impressora via USB.');
      } else {
        toast.success(`${ports.length} porta(s) serial(is) detectada(s).`);
      }
    } catch (err: any) {
      console.error('Erro ao detectar portas:', err);
      toast.error(`Erro ao detectar portas: ${err?.message}`);
    } finally {
      setDetectingPorts(false);
    }
  };

  // Conectar em porta específica ou permitir seleção
  const connect = async (portIndex?: number) => {
    if (!isSupported) { toast.error('Seu navegador não suporta Web Serial. Use Chrome/Edge.'); return; }
    setStatus('connecting');
    try {
      let port = portIndex !== undefined ? availablePorts[portIndex] : null;
      
      if (!port) {
        // Se não há porta selecionada, tentar requestPort (mostra diálogo)
        if (availablePorts.length === 0) {
          port = await (navigator as any).serial.requestPort({ filters: [] });
          setAvailablePorts([port]);
          setSelectedPortIndex(0);
        } else {
          toast.error('Selecione uma porta ou conecte a impressora via USB.');
          setStatus('disconnected');
          return;
        }
      }

      if (!port.writable) {
        await port.open({ baudRate: 115200 });
      }
      
      portRef.current = port;
      writerRef.current = port.writable.getWriter();
      const info = port.getInfo();
      const vendorId = info.usbVendorId?.toString(16).toUpperCase() || '????';
      const productId = info.usbProductId?.toString(16).toUpperCase() || '????';
      setPortInfo(`VID: 0x${vendorId} | PID: 0x${productId}`);
      setStatus('connected');
      toast.success('Impressora conectada com sucesso!');
    } catch (err: any) {
      setStatus('error');
      const msg = err?.message || '';
      if (msg.includes('No port selected')) {
        toast.error('Nenhuma porta selecionada. Conecte a impressora via USB e tente novamente.');
      } else {
        toast.error(`Erro ao conectar: ${msg}`);
      }
      console.error('[Printer Connect Error]', err);
    }
  };

  const disconnect = async () => {
    try { writerRef.current?.releaseLock(); await portRef.current?.close(); } catch {};
    setStatus('disconnected'); setPortInfo(''); setSelectedPortIndex(null); toast.info('Impressora desconectada');
  };

  const print = async (data: Uint8Array) => {
    if (!writerRef.current) { toast.error('Impressora não conectada'); return false; }
    try { await writerRef.current.write(data); return true; } catch (err: any) { setStatus('error'); toast.error(`Erro ao imprimir: ${err?.message}`); return false; }
  };

  useEffect(() => { return () => { try { writerRef.current?.releaseLock(); portRef.current?.close(); } catch {} }; }, []);
  
  return { status, portInfo, isSupported, connect, disconnect, print, availablePorts, selectedPortIndex, setSelectedPortIndex, detectPorts, detectingPorts };
}

export default function ImpressorasConfig() {
  const { status, portInfo, isSupported, connect, disconnect, print, availablePorts, selectedPortIndex, setSelectedPortIndex, detectPorts, detectingPorts } = useSerialPrinter();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [store, setStore] = useState<StoreInfo>({ nome_loja: 'Rosh Pizzaria', endereco_loja: '', telefone_loja: '' });
  const [config, setConfig] = useState<PrinterConfig>({
    auto_print: false,
    print_copies: 2,
    paper_width: '80mm',
    show_logo: false,
    show_qrcode: false,
    footer_message: 'Obrigado pela preferencia! Volte sempre!',
    order_copy_title: 'PEDIDO',
    kitchen_copy_title: 'COZINHA',
    print_order_copy: true,
    print_kitchen_copy: true,
    show_customer_phone: true,
    show_delivery_address: true,
    show_payment: true,
    show_prices_on_kitchen: false,
    print_density: 2,
  });

  useEffect(() => {
    const load = async () => {
      setLoadingConfig(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: roleRow } = await (supabase.from('user_roles') as any).select('company_id').eq('user_id', user.id).maybeSingle();
        const cid = (roleRow as any)?.company_id;
        if (!cid) return;
        setCompanyId(cid);
        const { data: lojaData } = await (supabase.from('loja_configuracoes') as any).select('nome_loja, endereco_loja, telefone_loja, impressora_config').eq('company_id', cid).maybeSingle();
        const loja = lojaData as any;
        if (loja) {
          setStore({ nome_loja: loja.nome_loja || store.nome_loja, endereco_loja: loja.endereco_loja || '', telefone_loja: loja.telefone_loja || '' });
          if (loja.impressora_config) setConfig((p) => ({ ...p, ...(loja.impressora_config as any) }));
        }
      } catch (err) {
        console.error('[ImpressorasConfig] erro ao carregar:', err);
      } finally { setLoadingConfig(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!config.auto_print || !companyId || status !== 'connected') return;
    const channel = supabase.channel(`pedidos-impressao-${companyId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `company_id=eq.${companyId}` }, async (payload) => {
      const pedido = payload.new as Pedido;
      const { data: itens } = await supabase.from('pedido_itens').select('produto_nome, quantidade, valor_unitario, valor_total, observacoes').eq('pedido_id', pedido.id);
      const pedidoCompleto = { ...pedido, itens: itens || [] };
      for (let i = 1; i <= config.print_copies; i++) {
        const bytes = buildCupom(pedidoCompleto, store, config, i, config.print_copies);
        await print(bytes);
        if (i < config.print_copies) await new Promise(r => setTimeout(r, 500));
      }
      toast.success(`Pedido #${pedido.codigo_pedido} impresso automaticamente`);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [config.auto_print, companyId, status, config.print_copies, store, print, config]);

  const saveConfig = async () => {
    if (!companyId) return;
    setSavingConfig(true);
    try {
      const { error } = await (supabase.from('loja_configuracoes') as any).update({ impressora_config: config } as any).eq('company_id', companyId);
      if (error) throw error;
      toast.success('Configurações salvas!');
    } catch (err: any) { toast.error(`Erro ao salvar: ${err?.message}`); } finally { setSavingConfig(false); }
  };

  if (loadingConfig) return (<div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>);

  return (
    <div className="space-y-6 max-w-2xl">
      {!isSupported && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Navegador incompatível</p>
            <p className="mt-1 text-amber-700">A impressão USB requer <strong>Chrome/Edge</strong> no Windows.</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Usb className="h-5 w-5 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Conexão USB</h3></div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status === 'connected' ? 'bg-emerald-100 text-emerald-700' : status === 'error' ? 'bg-red-100 text-red-700' : status === 'connecting' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
            {status === 'connected' ? <CheckCircle2 className="h-3.5 w-3.5" /> : status === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === 'error' ? <XCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {status === 'connected' ? 'Conectada' : status === 'connecting' ? 'Conectando...' : status === 'error' ? 'Erro' : 'Desconectada'}
          </span>
        </div>
        
        {status === 'connected' && portInfo && (<div className="rounded-md bg-neutral-50 border border-neutral-100 px-3 py-2 text-xs text-neutral-500 font-mono">{portInfo}</div>)}
        
        {/* Seção de Detecção de Portas */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Portas disponíveis</Label>
            <Button variant="outline" size="sm" onClick={detectPorts} disabled={detectingPorts || !isSupported} className="gap-2">
              {detectingPorts && <Loader2 className="h-3 w-3 animate-spin" />}
              {detectingPorts ? 'Detectando...' : 'Detectar'}
            </Button>
          </div>
          
          {availablePorts.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-neutral-500">{availablePorts.length} porta(s) detectada(s):</div>
              <div className="flex flex-col gap-2">
                {availablePorts.map((port, idx) => {
                  const info = port.getInfo?.();
                  const vid = info?.usbVendorId?.toString(16).padStart(4, '0').toUpperCase() || '????';
                  const pid = info?.usbProductId?.toString(16).padStart(4, '0').toUpperCase() || '????';
                  const label = `Porta ${idx + 1} (VID: ${vid}, PID: ${pid})`;
                  const isSelected = selectedPortIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPortIndex(isSelected ? null : idx)}
                      className={`rounded-md px-3 py-2 text-sm font-medium text-left transition-colors ${isSelected ? 'bg-primary/10 border border-primary text-primary' : 'bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                    >
                      {isSelected && '✓ '}{label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 p-3 bg-neutral-50 rounded-md">
              Nenhuma porta serial detectada. Se a impressora aparece no Windows como USB/TMUSB, use "Teste pelo Windows" ou instale o driver de porta COM/serial do fabricante.
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-3 pt-2">
          {status !== 'connected' ? (
            <>
              <Button 
                onClick={() => connect(selectedPortIndex !== null ? selectedPortIndex : undefined)} 
                disabled={!isSupported || status === 'connecting' || (availablePorts.length > 0 && selectedPortIndex === null)}
                className="gap-2 flex-1"
              >
                {status === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} 
                {status === 'connecting' ? 'Conectando...' : 'Conectar impressora'}
              </Button>
              {availablePorts.length === 0 && <Button variant="outline" size="sm" onClick={detectPorts} disabled={detectingPorts}>🔍 Detectar</Button>}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => connect(selectedPortIndex !== null ? selectedPortIndex : undefined)} className="gap-2 flex-1"><RefreshCw className="h-4 w-4" />Reconectar</Button>
              <Button variant="outline" onClick={disconnect} className="gap-2 text-red-600 border-red-200 hover:bg-red-50"><Power className="h-4 w-4" />Desconectar</Button>
            </>
          )}
          <Button variant="outline" onClick={async () => { setPrinting(true); try { const bytes = buildTesteCupom(store, config); const ok = await print(bytes); if (ok) toast.success('Cupom de teste impresso!'); } finally { setPrinting(false); } }} disabled={status !== 'connected' || printing} className="gap-2">{printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Imprimir teste</Button>
          <Button variant="outline" onClick={() => printTesteViaWindows(store, config)} className="gap-2">
            <Printer className="h-4 w-4" />
            Teste pelo Windows
          </Button>
        </div>
        
        <div className="text-xs text-neutral-400 space-y-1"><p>• Web Serial detecta apenas impressoras expostas como porta COM/serial.</p><p>• Impressoras instaladas como USB/TMUSB aparecem no Windows, mas não aparecem no pop-up serial do Chrome.</p><p>• Para TMUSB/USB, use "Teste pelo Windows" e selecione a impressora no diálogo de impressão.</p><p>• Para conexão direta sem diálogo, instale o driver Virtual COM/Serial do fabricante.</p></div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2"><Printer className="h-5 w-5 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Impressão automática</h3>{config.auto_print && status === 'connected' && (<Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs ml-auto">Ativa</Badge>)}</div>
        <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-sm font-medium">Imprimir ao receber pedido</Label><p className="text-xs text-neutral-500">Imprime automaticamente quando um novo pedido chegar pelo cardápio digital</p></div><Switch checked={config.auto_print} onCheckedChange={(v) => setConfig((c) => ({ ...c, auto_print: v }))} disabled={status !== 'connected'} /></div>
        {config.auto_print && status !== 'connected' && (<div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4 flex-shrink-0" />Conecte a impressora para ativar a impressão automática</div>)}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-neutral-500" />
            <h3 className="font-semibold text-neutral-950">Modelo da nota</h3>
          </div>
          <Badge variant="outline" className="w-fit border-orange-200 bg-orange-50 text-orange-700">Pedido + cozinha</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-neutral-700">Largura do papel</Label>
            <Select value={config.paper_width} onValueChange={(v) => setConfig((c) => ({ ...c, paper_width: v as any }))}>
              <SelectTrigger className="border-neutral-300 bg-neutral-950 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="80mm">80mm (padrão restaurante)</SelectItem><SelectItem value="58mm">58mm (compacta)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-neutral-700">Densidade da impressão</Label>
            <Select value={String(config.print_density || 2)} onValueChange={(v) => setConfig((c) => ({ ...c, print_density: Number(v) }))}>
              <SelectTrigger className="border-neutral-300 bg-neutral-950 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">Compacta</SelectItem><SelectItem value="2">Padrão</SelectItem><SelectItem value="3">Grande</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-sm font-semibold text-neutral-900">Nota do pedido</div><div className="text-xs text-neutral-500">Via com cliente, entrega e pagamento.</div></div>
              <Switch checked={config.print_order_copy !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, print_order_copy: v }))} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-neutral-600">Título da via</Label><input value={config.order_copy_title || ''} onChange={(e) => setConfig((c) => ({ ...c, order_copy_title: e.target.value.toUpperCase() }))} maxLength={24} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:ring-2 focus:ring-orange-200" /></div>
            <label className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-neutral-700"><span>Telefone do cliente</span><Switch checked={config.show_customer_phone !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, show_customer_phone: v }))} /></label>
            <label className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-neutral-700"><span>Endereço de entrega</span><Switch checked={config.show_delivery_address !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, show_delivery_address: v }))} /></label>
            <label className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-neutral-700"><span>Pagamento e totais</span><Switch checked={config.show_payment !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, show_payment: v }))} /></label>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-sm font-semibold text-neutral-900">Via da cozinha</div><div className="text-xs text-neutral-500">Via limpa para preparo dos itens.</div></div>
              <Switch checked={config.print_kitchen_copy !== false} onCheckedChange={(v) => setConfig((c) => ({ ...c, print_kitchen_copy: v }))} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-medium text-neutral-600">Título da via</Label><input value={config.kitchen_copy_title || ''} onChange={(e) => setConfig((c) => ({ ...c, kitchen_copy_title: e.target.value.toUpperCase() }))} maxLength={24} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:ring-2 focus:ring-orange-200" /></div>
            <label className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm text-neutral-700"><span>Mostrar preços na cozinha</span><Switch checked={!!config.show_prices_on_kitchen} onCheckedChange={(v) => setConfig((c) => ({ ...c, show_prices_on_kitchen: v }))} /></label>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-neutral-700">Mensagem de rodapé</Label>
          <input type="text" value={config.footer_message} onChange={(e) => setConfig((c) => ({ ...c, footer_message: e.target.value }))} maxLength={80} placeholder="Ex: Obrigado pela preferencia! Volte sempre!" className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:ring-2 focus:ring-orange-200" />
          <p className="text-xs text-neutral-500">{config.footer_message.length}/80 caracteres</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-neutral-700">Preview da nota do pedido</Label><div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 font-mono text-[11px] text-neutral-800 leading-5 whitespace-pre-wrap overflow-x-auto" style={{ maxWidth: config.paper_width === '58mm' ? '280px' : '380px' }}>{generatePreviewText(store, config, 'pedido')}</div></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-neutral-700">Preview da cozinha</Label><div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 font-mono text-[11px] text-neutral-800 leading-5 whitespace-pre-wrap overflow-x-auto" style={{ maxWidth: config.paper_width === '58mm' ? '280px' : '380px' }}>{generatePreviewText(store, config, 'cozinha')}</div></div>
        </div>
      </div>

      <div className="hidden">
        <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Configurações do cupom</h3></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm">Largura do papel</Label><Select value={config.paper_width} onValueChange={(v) => setConfig((c) => ({ ...c, paper_width: v as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="80mm">80mm (padrão restaurante)</SelectItem><SelectItem value="58mm">58mm (compacta)</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-sm">Número de vias</Label><Select value={String(config.print_copies)} onValueChange={(v) => setConfig((c) => ({ ...c, print_copies: Number(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 via</SelectItem><SelectItem value="2">2 vias (caixa + cozinha)</SelectItem><SelectItem value="3">3 vias</SelectItem></SelectContent></Select></div>
        </div>
        <div className="space-y-1.5"><Label className="text-sm">Mensagem de rodapé</Label><input type="text" value={config.footer_message} onChange={(e) => setConfig((c) => ({ ...c, footer_message: e.target.value }))} maxLength={80} placeholder="Ex: Obrigado pela preferencia! Volte sempre!" className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" /><p className="text-xs text-neutral-400">{config.footer_message.length}/80 caracteres</p></div>
        <div className="space-y-1.5"><Label className="text-sm text-neutral-500">Preview do cupom</Label><div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4 font-mono text-[11px] text-neutral-700 leading-5 whitespace-pre overflow-x-auto" style={{ maxWidth: config.paper_width === '58mm' ? '260px' : '360px' }}>{generatePreviewText(store, config)}</div></div>
      </div>

      <div className="flex justify-end gap-3 pt-2"><Button variant="outline" onClick={() => window.location.reload()} className="gap-2"><RefreshCw className="h-4 w-4" />Resetar</Button><Button onClick={saveConfig} disabled={savingConfig} className="gap-2 min-w-[120px]">{savingConfig && <Loader2 className="h-4 w-4 animate-spin" />}{savingConfig ? 'Salvando...' : 'Salvar configurações'}</Button></div>
    </div>
  );
}

function generatePreviewText(store: StoreInfo, config: PrinterConfig, copy: 'pedido' | 'cozinha' = 'pedido'): string {
  const COLS = config.paper_width === '58mm' ? 32 : 48;
  const sep = '-'.repeat(COLS);
  const sep2 = '='.repeat(COLS);
  const center = (text: string) => { const pad = Math.max(0, Math.floor((COLS - text.length) / 2)); return ' '.repeat(pad) + text; };
  const c2 = (l: string, r: string) => { const max = COLS - r.length; const left = l.length > max ? l.slice(0, max - 1) + '.' : l; return left + ' '.repeat(Math.max(0, COLS - left.length - r.length)) + r; };
  const title = copy === 'cozinha' ? (config.kitchen_copy_title || 'COZINHA') : (config.order_copy_title || 'PEDIDO');
  const showPrices = copy === 'pedido' || !!config.show_prices_on_kitchen;
  const lines: string[] = [
    center(store.nome_loja.toUpperCase()),
    store.endereco_loja ? center(store.endereco_loja) : '',
    store.telefone_loja ? center(`Tel: ${store.telefone_loja}`) : '',
    '',
    sep,
    center(title.toUpperCase()),
    'Pedido #TESTE-001',
    new Date().toLocaleString('pt-BR'),
    '',
    'CLIENTE',
    'Cliente Teste',
    copy === 'pedido' && config.show_customer_phone !== false ? '(87) 99999-9999' : '',
    copy === 'pedido' && config.show_delivery_address !== false ? 'Rua Exemplo, 123 - Centro' : '',
    sep,
    showPrices ? c2('ITEM', 'TOTAL') : 'ITEM',
    sep,
    showPrices ? c2('1x Pizza Grande Frango', 'R$ 45,00') : '1x Pizza Grande Frango',
    showPrices ? c2('1x Coca-Cola 2L', 'R$ 10,00') : '1x Coca-Cola 2L',
    'Obs: Sem cebola',
    sep,
    copy === 'pedido' && config.show_payment !== false ? ' '.repeat(COLS - 'Subtotal: R$ 55,00'.length) + 'Subtotal: R$ 55,00' : '',
    copy === 'pedido' && config.show_payment !== false ? ' '.repeat(COLS - 'Taxa entrega: R$ 5,00'.length) + 'Taxa entrega: R$ 5,00' : '',
    copy === 'pedido' && config.show_payment !== false ? ' '.repeat(COLS - 'TOTAL: R$ 60,00'.length) + 'TOTAL: R$ 60,00' : '',
    copy === 'pedido' && config.show_payment !== false ? 'Pagamento: PIX' : '',
    sep2,
    center(config.footer_message || 'Obrigado! Volte sempre!'),
    '',
  ].filter(Boolean);
  return lines.join('\n');
}

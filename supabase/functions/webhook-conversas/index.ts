// v2 - redeploy para limpar BOOT_ERROR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Helper function to upload media to Storage
async function uploadMediaToStorage(
  supabase: any,
  base64Data: string,
  mimetype: string,
  messageId: string
): Promise<string | null> {
  try {
    console.log('📤 [UPLOAD] Iniciando upload:', {
      messageId,
      mimetype,
      base64Length: base64Data?.length,
      base64Preview: base64Data?.substring(0, 50)
    });
    
    // Extract clean base64 content
    const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
    
    console.log('📤 [UPLOAD] Base64 limpo:', {
      cleanBase64Length: cleanBase64.length,
      cleanBase64Preview: cleanBase64.substring(0, 50)
    });
    
    // Convert base64 to binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('📤 [UPLOAD] Bytes convertidos:', {
      bytesLength: bytes.length,
      mimetype
    });
    
    // Determine file extension from mimetype
    const extension = mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `${messageId}-${Date.now()}.${extension}`;
    const filePath = `incoming/${fileName}`;
    
    console.log('📤 [UPLOAD] Fazendo upload para Storage:', {
      fileName,
      filePath,
      bucket: 'conversation-media'
    });
    
    // Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('conversation-media')
      .upload(filePath, bytes, {
        contentType: mimetype,
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ [UPLOAD] Erro ao fazer upload para Storage:', {
        error: uploadError,
        errorMessage: uploadError.message,
        errorCode: uploadError.statusCode,
        filePath,
        bytesLength: bytes.length
      });
      return null;
    }
    
    console.log('✅ [UPLOAD] Upload bem-sucedido:', uploadData);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('conversation-media')
      .getPublicUrl(filePath);
    
    console.log('✅ [UPLOAD] Mídia enviada para Storage:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ [UPLOAD] Erro ao processar upload:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      messageId,
      mimetype
    });
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// Input validation schemas - mais permissivo e com grupos
const webhookPayloadSchema = z.object({
  // Aceita dígitos (contato) ou JIDs completos (contato @s.whatsapp.net / grupo @g.us)
  numero: z.string(),
  mensagem: z.string().min(1).max(4096, 'Mensagem muito longa'),
  origem: z.string().default('WhatsApp'),
  tipo_mensagem: z.string().default('text'),
  midia_url: z.string().nullable().optional(),
  nome_contato: z.string().max(100).nullable().optional(),
  arquivo_nome: z.string().max(255).nullable().optional(),
  company_id: z.string().uuid().optional(),
  replied_to_message: z.string().nullable().optional(),
  status: z.string().optional().default('Recebida'), // Status da mensagem
  is_group: z.boolean().optional(),
  fromMe: z.boolean().optional(),
  remoteJidAlt: z.string().nullable().optional(), // 🔥 Número alternativo real da Evolution API
});

// Verify webhook signature for security
async function verifyWebhookSignature(
  payload: string, 
  signature: string | null, 
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return expectedSignature === signature;
  } catch {
    return false;
  }
}

// Detectar se o payload é da Evolution API
function isEvolutionAPIPayload(body: any): boolean {
  const event = (body.event || '').toLowerCase();
  return event === 'messages.upsert' && body.data?.key?.remoteJid;
}

// Transformar payload da Evolution API para formato do CRM
async function transformEvolutionPayload(body: any, supabase: any) {
  const data = body.data;
  
  // Extrair JID remoto (contato ou grupo)
  const remoteJid = data.key.remoteJid as string;
  
  // ⚡ CORREÇÃO CRÍTICA: Detectar @lid (Local ID temporário do WhatsApp)
  // Quando o WhatsApp usa @lid, o número NÃO é confiável
  const isLid = remoteJid.includes('@lid');
  
  if (isLid) {
    console.log('⚠️ [WEBHOOK] Detectado @lid (número temporário não confiável):', {
      remoteJid,
      pushName: data.pushName,
      fromMe: data.key.fromMe
    });
  }
  
  // DETECTAR SE A MENSAGEM FOI ENVIADA PELO USUÁRIO (fromMe) OU RECEBIDA
  const fromMe = data.key.fromMe === true;
  const status = fromMe ? 'Enviada' : 'Recebida';
  
  console.log(`📱 Mensagem ${status} - fromMe: ${fromMe}`, {
    remoteJid: data.key.remoteJid,
    fromMe: data.key.fromMe,
    messageId: data.key.id
  });

  // Ignorar apenas status/broadcast
  if (remoteJid.includes('@broadcast') || remoteJid.includes('status@')) {
    throw new Error('IGNORE: Mensagem de status/broadcast não será salva');
  }

  // ⚡ CORREÇÃO CRÍTICA: Detectar grupos de forma mais robusta (case insensitive)
  const isGroup = /@g\.us/i.test(remoteJid);
  
  // ⚠️ Grupos agora são controlados por configuração da company
  // A verificação será feita no handler principal após identificar a company
  if (isGroup) {
    console.log('👥 [WEBHOOK] Mensagem de grupo detectada, será verificada a permissão:', {
      remoteJid,
      pushName: data.pushName,
      fromMe: data.key.fromMe
    });
  }
  
  // ⚡ CORREÇÃO CRÍTICA: Para @lid, NÃO extrair número do remoteJid
  // O @lid é um identificador temporário não confiável
  let numero: string;
  if (isGroup) {
    numero = remoteJid; // usar JID completo para grupos
  } else if (isLid) {
    // Para @lid: usar o pushName como identificador temporário
    // O número real será encontrado buscando pelo nome do contato
    numero = remoteJid; // Manter o JID completo para referência
    console.log('⚠️ [WEBHOOK] Usando JID @lid como referência temporária:', numero);
  } else {
    // contato: limpar e normalizar
    const cleaned = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/[^0-9]/g, '');
    numero = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    
    // ✅ LOG CRÍTICO: Ver exatamente o que está sendo extraído
    console.log('📡 [TRANSFORM] Extração de número:', {
      remoteJid_original: remoteJid,
      cleaned: cleaned,
      numero_final: numero,
      tamanho_cleaned: cleaned.length,
      tamanho_final: numero.length
    });
  }
  
  // Extrair mensagem e tipo
  let mensagem = '';
  let tipo_mensagem = 'text';
  let midia_url = null;
  let arquivo_nome = null;
  let replied_to_message = null;
  
  // CRÍTICO: Para mensagens enviadas (fromMe=true), NÃO usar pushName
  // pois ele contém o nome do remetente, não do destinatário
  let nome_contato = null;
  if (!fromMe) {
    // Mensagem recebida: usar pushName do contato
    nome_contato = data.pushName || null;
  }
  // Para mensagens enviadas: deixar nome_contato como null para ser
  // preenchido posteriormente com o nome do lead ou número
  
  if (data.message.conversation) {
    mensagem = data.message.conversation;
    tipo_mensagem = 'texto';
  } else if (data.message.extendedTextMessage?.text) {
    mensagem = data.message.extendedTextMessage.text;
    tipo_mensagem = 'texto';
    
    // Capturar mensagem citada
    if (data.message.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = data.message.extendedTextMessage.contextInfo.quotedMessage;
      replied_to_message = quoted.conversation || 
                          quoted.extendedTextMessage?.text || 
                          quoted.imageMessage?.caption ||
                          '[Mensagem citada]';
    }
  } else if (data.message.imageMessage) {
    const img = data.message.imageMessage;
    mensagem = img.caption || '[Imagem]';
    tipo_mensagem = 'image';
    const base64Content = data.message.base64 || img.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        img.mimetype || 'image/jpeg',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (img.url) {
      // Salvar messageId para download via Evolution API
      midia_url = JSON.stringify({
        url: img.url,
        mediaKey: img.mediaKey,
        messageId: data.key.id,
        mimetype: img.mimetype || 'image/jpeg',
        type: 'image'
      });
    }
  } else if (data.message.audioMessage) {
    const audio = data.message.audioMessage;
    mensagem = '[Áudio]';
    tipo_mensagem = 'audio';
    const base64Content = data.message.base64 || audio.base64;
    
    console.log('🎤 [WEBHOOK] Processando áudio:', {
      hasBase64: !!base64Content,
      base64Length: base64Content?.length,
      hasUrl: !!audio.url,
      hasMediaKey: !!audio.mediaKey,
      messageId: data.key.id,
      mimetype: audio.mimetype
    });
    
    if (base64Content) {
      try {
        // Upload to Storage instead of saving BASE64
        const storageUrl = await uploadMediaToStorage(
          supabase,
          base64Content,
          audio.mimetype || 'audio/ogg',
          data.key.id
        );
        
        if (storageUrl) {
          midia_url = storageUrl;
          console.log('✅ [WEBHOOK] Áudio salvo no Storage:', storageUrl);
        } else {
          console.error('❌ [WEBHOOK] Upload para Storage falhou, salvando metadados como fallback');
          // Fallback: salvar metadados se upload falhar
          if (audio.url || audio.mediaKey) {
            midia_url = JSON.stringify({
              url: audio.url,
              mediaKey: audio.mediaKey,
              messageId: data.key.id,
              mimetype: audio.mimetype || 'audio/ogg; codecs=opus',
              type: 'audio'
            });
            console.log('📦 [WEBHOOK] Áudio salvo como metadados (fallback):', midia_url);
          } else {
            console.error('❌ [WEBHOOK] Upload falhou e não tem metadados - áudio será perdido');
          }
        }
      } catch (uploadError) {
        console.error('❌ [WEBHOOK] Erro ao fazer upload de áudio:', uploadError);
        // Fallback: salvar metadados se upload falhar
        if (audio.url || audio.mediaKey) {
          midia_url = JSON.stringify({
            url: audio.url,
            mediaKey: audio.mediaKey,
            messageId: data.key.id,
            mimetype: audio.mimetype || 'audio/ogg; codecs=opus',
            type: 'audio'
          });
          console.log('📦 [WEBHOOK] Áudio salvo como metadados após erro:', midia_url);
        } else {
          console.error('❌ [WEBHOOK] Erro de upload e não tem metadados - áudio será perdido');
        }
      }
    } else if (audio.url || audio.mediaKey) {
      // Salvar metadados para download posterior via Evolution API
      midia_url = JSON.stringify({
        url: audio.url,
        mediaKey: audio.mediaKey,
        messageId: data.key.id,
        mimetype: audio.mimetype || 'audio/ogg; codecs=opus',
        type: 'audio'
      });
      console.log('📦 [WEBHOOK] Áudio salvo como metadados para download:', midia_url);
    } else {
      console.error('❌ [WEBHOOK] Áudio sem base64 e sem URL/mediaKey - não pode ser processado');
    }
  } else if (data.message.videoMessage) {
    const video = data.message.videoMessage;
    mensagem = video.caption || '[Vídeo]';
    tipo_mensagem = 'video';
    const base64Content = data.message.base64 || video.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        video.mimetype || 'video/mp4',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (video.url) {
      midia_url = JSON.stringify({
        url: video.url,
        mediaKey: video.mediaKey,
        messageId: data.key.id,
        mimetype: video.mimetype || 'video/mp4',
        type: 'video'
      });
    }
  } else if (data.message.documentMessage) {
    const doc = data.message.documentMessage;
    arquivo_nome = doc.fileName || 'arquivo';
    mensagem = `[Documento: ${arquivo_nome}]`;
    tipo_mensagem = 'document';
    const base64Content = data.message.base64 || doc.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        doc.mimetype || 'application/pdf',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (doc.url) {
      midia_url = JSON.stringify({
        url: doc.url,
        mediaKey: doc.mediaKey,
        messageId: data.key.id,
        mimetype: doc.mimetype || 'application/pdf',
        type: 'document'
      });
    }
  } else if (data.message.templateMessage) {
    // Template message da Evolution API
    const template = data.message.templateMessage;
    const templateName = template.hydratedTemplate?.hydratedTitleText || 
                         template.hydratedFourRowTemplate?.hydratedTitleText ||
                         'Template';
    const templateBody = template.hydratedTemplate?.hydratedContentText || 
                         template.hydratedFourRowTemplate?.hydratedContentText ||
                         '';
    mensagem = templateBody ? `*${templateName}*\n\n${templateBody}` : `[Template: ${templateName}]`;
    tipo_mensagem = 'template';
  } else if (data.message.contactMessage) {
    // Mensagem de contato (vCard individual)
    const vcard = data.message.contactMessage.vcard || '';
    const displayName = data.message.contactMessage.displayName || '';
    // Extrair telefone do vCard
    const telMatch = vcard.match(/TEL[^:]*:([^\n\r]+)/i);
    const phone = telMatch ? telMatch[1].replace(/[^0-9+]/g, '') : '';
    const nameMatch = vcard.match(/FN:([^\n\r]+)/i);
    const contactName = nameMatch ? nameMatch[1].trim() : displayName || 'Contato';
    mensagem = JSON.stringify({ type: 'contact', name: contactName, phone: phone, vcard: vcard });
    tipo_mensagem = 'contact';
  } else if (data.message.contactsArrayMessage) {
    // Mensagem com múltiplos contatos (vCard array)
    const contacts = data.message.contactsArrayMessage.contacts || [];
    const parsedContacts = contacts.map((c: any) => {
      const vcard = c.vcard || '';
      const telMatch = vcard.match(/TEL[^:]*:([^\n\r]+)/i);
      const phone = telMatch ? telMatch[1].replace(/[^0-9+]/g, '') : '';
      const nameMatch = vcard.match(/FN:([^\n\r]+)/i);
      const contactName = nameMatch ? nameMatch[1].trim() : c.displayName || 'Contato';
      return { name: contactName, phone: phone };
    });
    mensagem = JSON.stringify({ type: 'contacts', contacts: parsedContacts });
    tipo_mensagem = 'contact';
  } else if (data.message.buttonsResponseMessage) {
    // Resposta de botão
    mensagem = data.message.buttonsResponseMessage.selectedDisplayText || '[Resposta de botão]';
    tipo_mensagem = 'text';
  } else if (data.message.listResponseMessage) {
    // Resposta de lista
    mensagem = data.message.listResponseMessage.title || '[Resposta de lista]';
    tipo_mensagem = 'text';
  } else {
    mensagem = '[Mensagem não suportada]';
    tipo_mensagem = 'text';
  }
  
  // Retornar com campos e STATUS (Enviada ou Recebida)
  return {
    numero,
    mensagem,
    origem: 'WhatsApp',
    tipo_mensagem,
    midia_url,
    nome_contato, // Null para mensagens enviadas, pushName para recebidas
    arquivo_nome,
    replied_to_message,
    status, // 'Enviada' se fromMe=true, 'Recebida' se fromMe=false
    is_group: isGroup,
    fromMe,
    remoteJidAlt: data.key.remoteJidAlt || null, // 🔥 Número alternativo real da Evolution API
  };
}

// ==============================
// MAIN WEBHOOK HANDLER
// ==============================

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
      
      // Log completo do payload recebido para debug de routing
      console.log('📡 [WEBHOOK] PAYLOAD RAW COMPLETO:', JSON.stringify(body, null, 2));
      
      // ✅ LOG CRÍTICO: Dados de número específicos
      if (body.data) {
        console.log('📡 [WEBHOOK] DADOS DO NÚMERO:', {
          'key.remoteJid': body.data.key?.remoteJid,
          'key.id': body.data.key?.id,
          'key.fromMe': body.data.key?.fromMe,
          'pushName': body.data.pushName,
          'message.conversation': body.data.message?.conversation,
          'messageType': body.data.messageType,
          'instanceName': body.instance,
          'event': body.event
        });
      }
    } catch {
      console.error('❌ JSON inválido recebido');
      return new Response(
        JSON.stringify({ error: 'Formato de dados inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature');
      const isValidSignature = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      
      if (!isValidSignature) {
        console.error('❌ Assinatura de webhook inválida');
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Detectar origem do payload
    const isEvolutionAPI = isEvolutionAPIPayload(body);
    
    // ⚡ NOVO: Processar eventos de conexão/desconexão da Evolution API
    if ((body.event || '').toLowerCase() === 'connection.update') {
      console.log('🔌 [WEBHOOK] Evento de conexão recebido:', {
        event: body.event,
        instance: body.instance,
        state: body.data?.state || body.state
      });
      
      try {
        const instanceName = body.instance;
        const connectionState = body.data?.state || body.state || 'unknown';
        
        // 🔒 CORREÇÃO: Só atualizar status para CONECTADO (open/connected)
        // A desconexão deve ser MANUAL - não desconectar automaticamente
        // Isso evita que falhas temporárias da API desativem a conexão
        if (connectionState === 'open' || connectionState === 'connected') {
          console.log(`🔄 [WEBHOOK] Atualizando status da instância ${instanceName}: ${connectionState} -> connected`);
          
          const { error: updateError } = await supabase
            .from('whatsapp_connections')
            .update({ 
              status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('instance_name', instanceName);
          
          if (updateError) {
            console.error('❌ [WEBHOOK] Erro ao atualizar status:', updateError);
          } else {
            console.log(`✅ [WEBHOOK] Status da instância ${instanceName} atualizado para: connected`);
          }
        } else if (connectionState === 'close' || connectionState === 'closed' || connectionState === 'disconnected') {
          // 🔄 AUTO-RECONEXÃO: Tentar reconectar automaticamente em vez de apenas ignorar
          console.log(`⚠️ [WEBHOOK] Instância ${instanceName} recebeu estado ${connectionState} - Tentando auto-reconexão...`);
          
          // Buscar dados da conexão para reconectar
          const { data: connData } = await supabase
            .from('whatsapp_connections')
            .select('evolution_api_url, evolution_api_key')
            .eq('instance_name', instanceName)
            .single();
          
          if (connData?.evolution_api_url && connData?.evolution_api_key) {
            const evoBaseUrl = connData.evolution_api_url.replace(/\/(manager|api|v1|v2)?\/?$/i, '').replace(/\/$/, '');
            const evoApiKey = connData.evolution_api_key;
            
            try {
              // Aguardar um momento antes de reconectar (pode ser apenas transitório)
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Tentar restart - Evolution v2 usa POST, v1 usa PUT
              let restartOk = false;
              for (const method of ['POST', 'PUT']) {
                const restartRes = await fetch(`${evoBaseUrl}/instance/restart/${instanceName}`, {
                  method,
                  headers: { "apikey": evoApiKey, "Content-Type": "application/json" },
                });
                if (restartRes.ok) {
                  console.log(`✅ [WEBHOOK] Auto-restart (${method}) solicitado para ${instanceName}`);
                  restartOk = true;
                  break;
                }
              }
              
              if (!restartOk) {
                // Tentar connect como fallback
                const connectRes = await fetch(`${evoBaseUrl}/instance/connect/${instanceName}`, {
                  method: "GET",
                  headers: { "apikey": evoApiKey },
                });
                console.log(`🔄 [WEBHOOK] Auto-connect para ${instanceName}: ${connectRes.status}`);
              }
            } catch (reconnectErr) {
              console.warn(`⚠️ [WEBHOOK] Falha na auto-reconexão de ${instanceName}:`, reconnectErr);
            }
          }
          // NÃO atualizar status para 'disconnected' no banco
        
        } else {
          // Para estados transitórios (connecting), apenas LOGAR
          console.log(`⚠️ [WEBHOOK] Estado de conexão ${connectionState} para ${instanceName} - IGNORADO (estado transitório)`);
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Connection event processed', state: connectionState }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('❌ [WEBHOOK] Erro ao processar connection.update:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao processar atualização de conexão' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // ⚡ CORREÇÃO: Processar eventos de status (delivered, read) da Evolution API
    if ((body.event || '').toLowerCase() === 'messages.update') {
      console.log('📊 [WEBHOOK] Evento de atualização de status recebido:', {
        event: body.event,
        instance: body.instance,
        dataArray: body.data
      });
      
      try {
        // body.data pode ser um array de updates
        const updates = Array.isArray(body.data) ? body.data : [body.data];
        
        for (const update of updates) {
          const messageId = update.key?.id;
          const status = update.status;
          
          if (!messageId || !status) {
            console.log('⏭️ [WEBHOOK] Update sem messageId ou status:', update);
            continue;
          }
          
          console.log('📊 [WEBHOOK] Processando status update:', {
            messageId,
            status,
            remoteJid: update.key?.remoteJid,
            fromMe: update.key?.fromMe
          });
          
          // Mapear status da Evolution API para nosso formato
          // Status possíveis: PENDING (0), SENT (1), DELIVERY_ACK (2), READ (3), PLAYED (4)
          let delivered = false;
          let read = false;
          
          if (status === 'DELIVERY_ACK' || status === 2 || status === 'delivered') {
            delivered = true;
            read = false;
          } else if (status === 'READ' || status === 3 || status === 'read' || 
                     status === 'PLAYED' || status === 4 || status === 'played') {
            delivered = true;
            read = true;
          }
          
          if (!delivered && !read) {
            console.log('⏭️ [WEBHOOK] Status não requer atualização:', status);
            continue;
          }
          
          // Buscar mensagem no banco pelo messageId (pode estar em diferentes campos)
          // O ID da mensagem pode estar em 'id' diretamente ou precisamos buscar
          const { data: mensagens, error: searchError } = await supabase
            .from('conversas')
            .select('id, delivered, read')
            .or(`id.eq.${messageId}`)
            .limit(5);
          
          if (searchError) {
            console.error('❌ [WEBHOOK] Erro ao buscar mensagem:', searchError);
            continue;
          }
          
          // Se não encontrou pela ID direta, tentar buscar pelo número + timestamp aproximado
          if (!mensagens || mensagens.length === 0) {
            console.log('⚠️ [WEBHOOK] Mensagem não encontrada pelo ID, tentando buscar pelo número...');
            
            // Extrair número do remoteJid
            const remoteJid = update.key?.remoteJid || '';
            const numero = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/[^0-9]/g, '');
            const numeroNormalizado = numero.startsWith('55') ? numero : `55${numero}`;
            
            // Buscar mensagens recentes enviadas (fromMe=true) para esse número
            const { data: mensagensRecentes, error: recentError } = await supabase
              .from('conversas')
              .select('id, delivered, read')
              .eq('fromme', true)
              .or(`numero.eq.${numeroNormalizado},numero.eq.${numero},telefone_formatado.eq.${numeroNormalizado}`)
              .order('created_at', { ascending: false })
              .limit(10);
            
            if (recentError || !mensagensRecentes || mensagensRecentes.length === 0) {
              console.log('⚠️ [WEBHOOK] Nenhuma mensagem encontrada para atualizar status');
              continue;
            }
            
            // Atualizar as mensagens encontradas que ainda não têm esse status
            for (const msg of mensagensRecentes) {
              // Só atualizar se o novo status for "melhor" que o atual
              const shouldUpdate = (read && !msg.read) || (delivered && !msg.delivered && !msg.read);
              
              if (shouldUpdate) {
                const updateData: any = {};
                if (delivered) updateData.delivered = true;
                if (read) updateData.read = true;
                
                const { error: updateError } = await supabase
                  .from('conversas')
                  .update(updateData)
                  .eq('id', msg.id);
                
                if (updateError) {
                  console.error('❌ [WEBHOOK] Erro ao atualizar status da mensagem:', updateError);
                } else {
                  console.log('✅ [WEBHOOK] Status atualizado:', {
                    messageId: msg.id,
                    delivered,
                    read
                  });
                }
              }
            }
          } else {
            // Encontrou mensagem pelo ID direto
            for (const msg of mensagens) {
              const shouldUpdate = (read && !msg.read) || (delivered && !msg.delivered && !msg.read);
              
              if (shouldUpdate) {
                const updateData: any = {};
                if (delivered) updateData.delivered = true;
                if (read) updateData.read = true;
                
                const { error: updateError } = await supabase
                  .from('conversas')
                  .update(updateData)
                  .eq('id', msg.id);
                
                if (updateError) {
                  console.error('❌ [WEBHOOK] Erro ao atualizar status:', updateError);
                } else {
                  console.log('✅ [WEBHOOK] Status atualizado:', {
                    messageId: msg.id,
                    delivered,
                    read
                  });
                }
              }
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Status atualizado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (statusError) {
        console.error('❌ [WEBHOOK] Erro ao processar status update:', statusError);
        return new Response(
          JSON.stringify({ success: true, message: 'Erro ao processar status, mas OK' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('📩 Webhook recebido:', {
      origem: isEvolutionAPI ? 'Evolution API (direto)' : 'N8N',
      evento: body.event || 'unknown'
    });

    // Transformar payload se vier da Evolution API
    let payload = body;
    if (isEvolutionAPI) {
      try {
        payload = await transformEvolutionPayload(body, supabase);
        console.log('✅ Payload transformado');
      } catch (transformError: any) {
        // Se for mensagem de grupo/status, retornar sucesso sem salvar
        if (transformError.message?.startsWith('IGNORE:')) {
          console.log('⏭️', transformError.message);
          return new Response(
            JSON.stringify({ success: true, message: 'Mensagem ignorada' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('❌ Erro ao transformar payload da Evolution API:', transformError);
        return new Response(
          JSON.stringify({ error: 'Erro ao processar payload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Validate input with Zod (after transformation)
    let validatedData;
    try {
      validatedData = webhookPayloadSchema.parse(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Dados de entrada inválidos:', error.errors);
        // Log the actual payload for debugging
        console.log('Payload recebido:', JSON.stringify(payload, null, 2));
        return new Response(
          JSON.stringify({ 
            error: 'Dados inválidos fornecidos',
            code: 'VALIDATION_ERROR'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Extrair instanceName do body original da Evolution API
    const instanceName = body.instance || null;

    // Buscar company_id baseado na instância primeiro
    let companyId = validatedData.company_id || null;
    let leadId = null;

    // Se temos o nome da instância, buscar company por ela
    if (instanceName && !companyId) {
      console.log('🔍 Buscando company pela instância:', instanceName);
      
      // Primeiro tentar buscar instância conectada
      let { data: whatsappConnection } = await supabase
        .from('whatsapp_connections')
        .select('company_id')
        .eq('instance_name', instanceName)
        .eq('status', 'connected')
        .single();
      
      // Se não encontrou como "connected", tentar buscar sem filtrar por status
      // (pode estar conectada mas não marcada corretamente)
      if (!whatsappConnection) {
        console.log('⚠️ Instância não encontrada como "connected", tentando buscar sem filtro de status...');
        const { data: connectionWithoutStatus } = await supabase
          .from('whatsapp_connections')
          .select('company_id, status')
          .eq('instance_name', instanceName)
          .limit(1)
          .single();
        
        if (connectionWithoutStatus) {
          whatsappConnection = connectionWithoutStatus;
          console.log('✅ Instância encontrada (status:', connectionWithoutStatus.status, ')');
        }
      }
      
      if (whatsappConnection) {
        companyId = whatsappConnection.company_id;
        console.log('✅ Company encontrada pela instância:', companyId);
      } else {
        console.warn('⚠️ Instância não encontrada:', instanceName);
        // CORREÇÃO: Não retornar erro imediatamente, tentar outras formas de identificar company
      }
    }

    // ⚡ CORREÇÃO CRÍTICA: Detectar se é grupo de forma mais robusta
    // Verificar is_group OU se o número contém @g.us em qualquer posição (case insensitive)
    const isGroup = validatedData.is_group === true || /@g\.us/i.test(validatedData.numero);
    
    // 🔒 VERIFICAR PERMISSÃO DE GRUPOS: Só continuar se a company permitir mensagens de grupos
    if (isGroup && companyId) {
      console.log('👥 [WEBHOOK] Verificando permissão de grupos para company:', companyId);
      
      const { data: companySettings, error: companyError } = await supabase
        .from('companies')
        .select('allow_group_messages')
        .eq('id', companyId)
        .single();
      
      if (companyError) {
        console.error('❌ [WEBHOOK] Erro ao verificar permissão de grupos:', companyError);
      }
      
      const allowGroupMessages = companySettings?.allow_group_messages === true;
      
      if (!allowGroupMessages) {
        console.log('🚫 [WEBHOOK] Mensagem de grupo BLOQUEADA - Company não permite:', {
          companyId,
          groupJid: validatedData.numero,
          allowGroupMessages
        });
        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem de grupo ignorada - funcionalidade não habilitada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ [WEBHOOK] Mensagem de grupo PERMITIDA - Company autorizada:', {
        companyId,
        groupJid: validatedData.numero
      });
    } else if (isGroup && !companyId) {
      // Se não identificamos a company, bloquear grupos por segurança
      console.log('🚫 [WEBHOOK] Mensagem de grupo BLOQUEADA - Company não identificada');
      return new Response(
        JSON.stringify({ success: true, message: 'Mensagem de grupo ignorada - company não identificada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let numeroLimpo = isGroup ? null : validatedData.numero.replace(/[^0-9]/g, '');
    
    if (!isGroup && numeroLimpo) {
      console.log('🔍 Número antes da normalização:', numeroLimpo);
      
      // ⚡ VALIDAÇÃO ATUALIZADA: Aceitar números normais E LIDs do WhatsApp
      // Números normais brasileiros: 
      // - 10 dígitos: DDD (2) + número (8 dígitos) - formato antigo
      // - 11 dígitos: DDD (2) + número (9 dígitos) - formato local atual
      // - 13 dígitos: 55 + DDD (2) + número (9 dígitos) - formato internacional
      // LIDs (LinkedIn IDs do WhatsApp): até 20 dígitos
      // Exemplo: 55149783293472816 (17 dígitos) - são IDs válidos do WhatsApp
      if (numeroLimpo.length < 10 || numeroLimpo.length > 20) {
        console.warn('⚠️ Número inválido após limpeza:', numeroLimpo, 'Tamanho:', numeroLimpo.length);
        return new Response(
          JSON.stringify({ success: true, message: 'Número inválido ignorado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ Número validado:', numeroLimpo, 'Tamanho:', numeroLimpo.length);
      
      // Normalizar: Se o número tem 10 ou 11 dígitos e não começa com 55, adicionar código do país
      // Para LIDs (números com mais de 13 dígitos), não normalizar - já são IDs completos
      if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11 && !numeroLimpo.startsWith('55')) {
        numeroLimpo = `55${numeroLimpo}`;
        console.log('✅ Número normalizado com código do país:', numeroLimpo);
      } else if (numeroLimpo.length > 13) {
        console.log('ℹ️ LID detectado (não normalizado):', numeroLimpo);
      }
      
      console.log('🔍 Número normalizado final (contato):', numeroLimpo);
    } else if (isGroup) {
      console.log('👥 Mensagem de grupo detectada (PERMITIDA). JID:', validatedData.numero);
    }

    // Se temos company_id, buscar lead apenas nessa company
    if (companyId && !isGroup && numeroLimpo) {
      // ⚠️ CORREÇÃO CRÍTICA: Detectar @lid e usar remoteJidAlt ou buscar por nome
      const isLidNumber = validatedData.numero.includes('@lid');
      const remoteJidAlt = validatedData.remoteJidAlt; // 🔥 Número alternativo real da Evolution API
      let numeroReal: string | null = null;
      
      if (isLidNumber) {
        console.log('⚠️ [WEBHOOK @LID] Detectado número @lid:', {
          remoteJid: validatedData.numero,
          remoteJidAlt: remoteJidAlt,
          pushName: validatedData.nome_contato,
          fromMe: validatedData.fromMe
        });
        
        // 🔥 PRIORIDADE 1: Usar remoteJidAlt se disponível (número real da Evolution API)
        if (remoteJidAlt && !remoteJidAlt.includes('@lid')) {
          const numeroRealAlt = remoteJidAlt.replace(/@.*/, '');
          if (numeroRealAlt && numeroRealAlt.length >= 10) {
            numeroLimpo = numeroRealAlt;
            console.log('✅ [WEBHOOK @LID] Usando remoteJidAlt (número REAL da Evolution):', {
              numeroAnterior: validatedData.numero,
              numeroREAL: numeroLimpo,
              lidDescartado: validatedData.numero,
              fromMe: validatedData.fromMe
            });
            
            // ✅ Se é mensagem enviada (fromMe) E temos número real via remoteJidAlt,
            // pular busca de lead por nome - usar o número real diretamente
            if (validatedData.fromMe === true) {
              console.log('📱 [WEBHOOK @LID + fromMe] Mensagem ENVIADA com número real - continuando sem buscar lead');
              // Buscar lead por número real para vincular
              const { data: leadByPhone } = await supabase
                .from('leads')
                .select('id, name, phone, telefone')
                .eq('company_id', companyId)
                .or(`phone.eq.${numeroLimpo},telefone.eq.${numeroLimpo}`)
                .limit(1)
                .maybeSingle();
              
              if (leadByPhone) {
                leadId = leadByPhone.id;
                console.log('✅ [WEBHOOK @LID + fromMe] Lead encontrado por número real:', {
                  leadId,
                  nome: leadByPhone.name,
                  numeroReal: numeroLimpo
                });
              }
              // Não bloquear se não encontrar lead - mensagem enviada pode ser para contato novo
            }
          }
        }
        
        // 🔥 PRIORIDADE 2: Se não tem remoteJidAlt OU não é mensagem enviada, buscar lead por NOME
        if (validatedData.nome_contato && numeroLimpo && numeroLimpo.length < 12 && validatedData.fromMe !== true) {
          console.log('🔍 [WEBHOOK @LID] remoteJidAlt não disponível - Buscando lead por NOME:', {
            nome: validatedData.nome_contato,
            numeroLid: numeroLimpo
          });
          
          const { data: leadByName, error: nameSearchError } = await supabase
            .from('leads')
            .select('id, company_id, phone, telefone, name')
            .eq('company_id', companyId)
            .ilike('name', validatedData.nome_contato)
            .limit(1)
            .maybeSingle();
          
          if (leadByName && !nameSearchError) {
            leadId = leadByName.id;
            // ✅ USAR O NÚMERO REAL DO LEAD
            numeroReal = leadByName.phone || leadByName.telefone;
            if (numeroReal) {
              numeroLimpo = numeroReal;
              console.log('✅ [WEBHOOK @LID] Lead encontrado por NOME - Usando número REAL do lead:', {
                leadId,
                nome: leadByName.name,
                numeroAnterior: validatedData.numero,
                numeroREAL: numeroLimpo,
                lidDescartado: validatedData.numero
              });
            }
          } else {
            console.log('⚠️ [WEBHOOK @LID] Lead não encontrado por nome');
            // ⚠️ APENAS bloquear se for mensagem RECEBIDA sem lead
            // Mensagens ENVIADAS podem ser para contatos novos
            if (!validatedData.fromMe) {
              console.log('🚫 [WEBHOOK @LID] BLOQUEANDO mensagem RECEBIDA - número @lid não confiável');
              return new Response(JSON.stringify({
                success: true,
                message: 'Número @lid não confiável - aguardando número real',
                blocked: true
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
              });
            } else {
              console.log('✅ [WEBHOOK @LID + fromMe] Permitindo mensagem ENVIADA mesmo sem lead encontrado');
            }
          }
        } else if (!validatedData.nome_contato && !validatedData.fromMe) {
          // ⚠️ APENAS bloquear mensagens RECEBIDAS sem nome
          console.log('🚫 [WEBHOOK @LID] Nome do contato ausente em mensagem RECEBIDA - BLOQUEANDO');
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Número @lid sem nome - aguardando número real',
            blocked: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
      
      // Se não encontrou por nome ou não é @lid, buscar por número
      if (!leadId && numeroLimpo) {
        // Preparar variações do número para busca (com e sem código do país)
        const numeroVariations = [numeroLimpo];
        if (numeroLimpo.startsWith('55') && numeroLimpo.length === 13) {
          // Se tem código do país, também buscar sem ele
          numeroVariations.push(numeroLimpo.substring(2));
        } else if (!numeroLimpo.startsWith('55') && numeroLimpo.length >= 10) {
          // Se não tem código do país, também buscar com ele
          numeroVariations.push(`55${numeroLimpo}`);
        }
        
        const telefoneConditions = numeroVariations.map(n => `telefone.eq.${n}`).join(',');
        const phoneConditions = numeroVariations.map(n => `phone.eq.${n}`).join(',');
        
        const { data: existingLead, error: leadSearchError } = await supabase
          .from('leads')
          .select('id, company_id')
          .eq('company_id', companyId)
          .or(`${telefoneConditions},${phoneConditions}`)
          .limit(1)
          .maybeSingle(); // Usar maybeSingle() ao invés de single() para não retornar erro se não encontrar
        
        if (existingLead && !leadSearchError) {
          leadId = existingLead.id;
          console.log('📌 Lead encontrado na company:', { leadId, companyId, numeroBuscado: numeroLimpo });
        } else if (leadSearchError) {
          console.warn('⚠️ Erro ao buscar lead:', leadSearchError);
        } else {
          console.log('ℹ️ Lead não encontrado para o número:', numeroLimpo, 'na company:', companyId);
        }
      }
    } else if (!isGroup && numeroLimpo) {
      // ✅ CORREÇÃO DEFINITIVA: Buscar lead com TODAS as variações possíveis do número
      // Isso resolve o problema de números salvos com formatos diferentes
      const numeroVariations = [numeroLimpo];
      
      // Remover possível DDI duplicado (5515... -> 15...)
      if (numeroLimpo.startsWith('5515') && numeroLimpo.length > 12) {
        numeroVariations.push(numeroLimpo.substring(2)); // Remove os dois primeiros 55
      }
      
      // Se tem código do país (55), também buscar sem ele
      if (numeroLimpo.startsWith('55') && numeroLimpo.length === 13) {
        numeroVariations.push(numeroLimpo.substring(2)); // Remove 55
      } else if (!numeroLimpo.startsWith('55') && numeroLimpo.length >= 10) {
        // Se não tem código do país, também buscar com ele
        numeroVariations.push(`55${numeroLimpo}`);
      }
      
      // Adicionar variação sem DDD (últimos 8 ou 9 dígitos)
      if (numeroLimpo.length >= 10) {
        const somenteNumero = numeroLimpo.slice(-9); // Últimos 9 dígitos (com 9 inicial do celular)
        numeroVariations.push(somenteNumero);
      }
      
      console.log('🔍 Buscando lead com variações:', numeroVariations);
      
      const telefoneConditions = numeroVariations.map(n => `telefone.eq.${n}`).join(',');
      const phoneConditions = numeroVariations.map(n => `phone.eq.${n}`).join(',');
      
      const { data: existingLead, error: leadSearchError } = await supabase
        .from('leads')
        .select('id, company_id')
        .or(`${telefoneConditions},${phoneConditions}`)
        .limit(1)
        .maybeSingle(); // Usar maybeSingle() ao invés de single() para não retornar erro se não encontrar

      if (existingLead && !leadSearchError) {
        companyId = existingLead.company_id;
        leadId = existingLead.id;
        console.log('📌 Lead encontrado:', { leadId, companyId, numeroBuscado: numeroLimpo });
      } else if (leadSearchError) {
        console.warn('⚠️ Erro ao buscar lead:', leadSearchError);
      } else {
        console.log('ℹ️ Lead não encontrado para o número:', numeroLimpo);
      }
    }

    // ⚡ CORREÇÃO CRÍTICA: Se ainda não tem company_id mas é mensagem recebida
    // E veio de @lid, tentar buscar lead por NOME em QUALQUER company
    if (!companyId && validatedData.fromMe !== true && validatedData.numero.includes('@lid') && validatedData.nome_contato) {
      console.log('🔍 [WEBHOOK @LID SEM COMPANY] Tentando encontrar lead por NOME em qualquer company:', {
        nome: validatedData.nome_contato
      });
      
      const { data: leadByName } = await supabase
        .from('leads')
        .select('id, company_id, phone, telefone, name')
        .ilike('name', validatedData.nome_contato)
        .limit(1)
        .maybeSingle();
      
      if (leadByName) {
        companyId = leadByName.company_id;
        leadId = leadByName.id;
        // ✅ USAR O NÚMERO REAL DO LEAD - NUNCA USAR @LID
        const numeroReal = leadByName.phone || leadByName.telefone;
        if (numeroReal) {
          // ⚡ CRÍTICO: SUBSTITUIR numeroLimpo pelo número REAL
          numeroLimpo = numeroReal;
          console.log('✅ [WEBHOOK @LID SEM COMPANY] Lead e company encontrados por NOME - SUBSTITUINDO número @lid pelo REAL:', {
            leadId,
            companyId,
            nome: leadByName.name,
            numeroAnterior: validatedData.numero,
            numeroREAL: numeroLimpo,
            lidDescartado: validatedData.numero
          });
        }
      } else {
        // Se não encontrou lead com @lid, NÃO criar nova conversa
        console.log('🚫 [WEBHOOK @LID] Bloqueando criação de conversa com número @lid não confiável (sem company)');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Número @lid sem lead correspondente - mensagem ignorada para evitar duplicação' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Se ainda não encontrou company, tentar fallback adicional
    if (!companyId) {
      console.warn('⚠️ Company não identificada pelas formas padrão, tentando fallback...');
      
      // FALLBACK 1: Se temos instanceName, buscar sem filtro de status e case-insensitive
      if (instanceName) {
        console.log('🔄 Fallback: Buscando instância case-insensitive:', instanceName);
        const { data: fallbackConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .ilike('instance_name', instanceName)
          .limit(1)
          .single();
        
        if (fallbackConnection) {
          companyId = fallbackConnection.company_id;
          console.log('✅ Company encontrada via fallback (case-insensitive):', companyId);
        }
      }
      
      // FALLBACK 2: Se ainda não encontrou e temos número, tentar buscar pela primeira instância ativa
      // (apenas para mensagens recebidas, para evitar problemas de segurança)
      if (!companyId && !isGroup && numeroLimpo && validatedData.fromMe !== true) {
        console.log('🔄 Fallback: Buscando primeira instância ativa para mensagem recebida...');
        const { data: activeConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .in('status', ['connected', 'connecting'])
          .limit(1)
          .maybeSingle();
        
        if (activeConnection) {
          companyId = activeConnection.company_id;
          console.log('✅ Company encontrada via fallback (primeira instância ativa):', companyId);
        }
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, SEMPRE salvar mesmo sem company_id
      // Usar fallback final: buscar QUALQUER instância ativa ou a primeira empresa disponível
      if (!companyId && validatedData.fromMe !== true) {
        console.log('🔄 Fallback FINAL: Buscando qualquer instância ativa para mensagem recebida...');
        const { data: anyConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .limit(1)
          .maybeSingle();
        
        if (anyConnection) {
          companyId = anyConnection.company_id;
          console.log('✅ Company encontrada via fallback FINAL (qualquer instância):', companyId);
        }
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, NUNCA rejeitar - sempre salvar
      // Se ainda não encontrou company_id mas é mensagem recebida, usar fallback de emergência
      if (!companyId && validatedData.fromMe !== true) {
        console.warn('⚠️ [CRÍTICO] Company não identificada para mensagem RECEBIDA, usando fallback de emergência');
        
        // FALLBACK DE EMERGÊNCIA: Buscar primeira empresa do sistema
        const { data: firstCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (firstCompany) {
          companyId = firstCompany.id;
          console.log('✅ Company encontrada via fallback de emergência:', companyId);
        } else {
          // ÚLTIMO RECURSO: Se não tem empresa, ainda assim salvar a mensagem
          // Isso garante que mensagens recebidas NUNCA sejam perdidas
          console.error('❌ [CRÍTICO] Nenhuma empresa encontrada no sistema, mas salvando mensagem recebida mesmo assim');
          // Continuar sem company_id - a mensagem será salva e pode ser vinculada depois
        }
      }
      
      // ⚡ CORREÇÃO: Apenas rejeitar mensagens ENVIADAS sem company_id (segurança)
      // Mensagens RECEBIDAS sempre devem ser salvas
      if (!companyId && validatedData.fromMe === true) {
        console.error('❌ Company não identificada para mensagem ENVIADA', {
          instanceName,
          numeroLimpo,
          fromMe: validatedData.fromMe,
          isGroup
        });
        return new Response(
          JSON.stringify({ 
            error: 'Empresa não identificada para a mensagem enviada',
            code: 'COMPANY_NOT_RESOLVED',
            details: {
              instanceName: instanceName || 'não fornecido',
              numero: numeroLimpo || 'não disponível'
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====================================================================
    // MELHORIA CRÍTICA: Buscar conversa/lead existente ANTES de criar novos
    // ====================================================================
    
    // 🔥 VALIDAÇÃO CRÍTICA: NUNCA criar lead com número @lid ou inválido
    const isStillLidNumber = numeroLimpo && (numeroLimpo.length < 10 || validatedData.numero.includes('@lid'));
    
    // 🔥 CORREÇÃO: Buscar conversa existente pelo telefone_formatado normalizado
    // Isso evita criar duplicatas quando o número chega com formato diferente
    if (!leadId && !isGroup && numeroLimpo && companyId && !isStillLidNumber) {
      console.log('🔍 [WEBHOOK] Buscando conversa existente para evitar duplicação:', numeroLimpo);
      
      // Preparar variações do número para busca mais abrangente
      const numeroBusca = numeroLimpo;
      const numeroSem55 = numeroBusca.startsWith('55') ? numeroBusca.substring(2) : numeroBusca;
      const numeroCom55 = numeroBusca.startsWith('55') ? numeroBusca : `55${numeroBusca}`;
      
      const { data: conversaExistente } = await supabase
        .from('conversas')
        .select('id, lead_id, nome_contato, telefone_formatado')
        .eq('company_id', companyId)
        .or(`telefone_formatado.eq.${numeroBusca},telefone_formatado.eq.${numeroSem55},telefone_formatado.eq.${numeroCom55}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (conversaExistente?.lead_id) {
        leadId = conversaExistente.lead_id;
        console.log('✅ [WEBHOOK] Conversa existente encontrada! Usando lead_id:', {
          leadId,
          nome_contato: conversaExistente.nome_contato,
          telefone_formatado: conversaExistente.telefone_formatado,
          numeroBuscado: numeroBusca
        });
      } else if (conversaExistente) {
        console.log('⚠️ [WEBHOOK] Conversa existente encontrada mas sem lead_id:', {
          telefone_formatado: conversaExistente.telefone_formatado
        });
      } else {
        console.log('ℹ️ [WEBHOOK] Nenhuma conversa existente encontrada para:', {
          numeroBuscado: numeroBusca,
          variacoes: [numeroBusca, numeroSem55, numeroCom55]
        });
      }
    }
    
    // Se não tem lead e não é grupo, tentar criar automaticamente
    if (!leadId && !isGroup && numeroLimpo && companyId && !isStillLidNumber) {
      console.log('🔄 Tentando criar lead automaticamente para:', numeroLimpo);
      
      // Para mensagens RECEBIDAS: criar com nome do contato
      // Para mensagens ENVIADAS: criar com o telefone (será atualizado depois)
      const leadName = validatedData.fromMe 
        ? numeroLimpo 
        : (validatedData.nome_contato || numeroLimpo);
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: leadName,
          phone: numeroLimpo,
          telefone: numeroLimpo,
          company_id: companyId,
          source: 'whatsapp',
          status: 'novo',
          stage: 'prospeccao'
        })
        .select('id')
        .single();
      
      if (!leadError && newLead) {
        leadId = newLead.id;
        console.log('✅ Lead criado automaticamente:', leadId);
      } else if (leadError) {
        console.error('❌ Erro ao criar lead:', leadError);
      }
    } else if (!leadId && !isGroup && isStillLidNumber) {
      console.log('🚫 [WEBHOOK] BLOQUEANDO criação de lead com número @lid inválido:', numeroLimpo);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Número @lid inválido - não pode criar lead',
        blocked: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // CORREÇÃO: Buscar nome do lead SEMPRE que tiver lead vinculado
    let nomeContatoFinal = validatedData.nome_contato;
    
    if (leadId) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .single();
      
      if (leadData?.name) {
        nomeContatoFinal = leadData.name;
        console.log('✅ Nome do lead usado:', nomeContatoFinal);
      }
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Garantir que SEMPRE tenha um nome_contato
    // Se ainda não tem nome, usar número como fallback (para contatos individuais)
    if (!nomeContatoFinal && !isGroup && numeroLimpo) {
      nomeContatoFinal = numeroLimpo;
      console.log('⚠️ Usando telefone como nome:', nomeContatoFinal);
    }
    
    // Para grupos, usar o JID como nome se não tiver outro
    if (!nomeContatoFinal && isGroup) {
      nomeContatoFinal = validatedData.numero;
      console.log('👥 Usando JID do grupo como nome');
    }
    
    // ⚡ GARANTIA FINAL: Se ainda não tem nome (caso extremo), usar o número original
    if (!nomeContatoFinal) {
      nomeContatoFinal = validatedData.numero || numeroLimpo || 'Contato Desconhecido';
      console.log('⚠️ [FALLBACK] Usando número original como nome:', nomeContatoFinal);
    }
    
    // 🔥 VALIDAÇÃO FINAL CRÍTICA: BLOQUEAR salvamento se telefone_formatado ainda contém @lid
    const telefoneFormatadoFinal = isGroup ? null : numeroLimpo;
    
    // 🔥 CRÍTICO: Substituir TAMBÉM o campo 'numero' original para remover @lid
    const numeroFinal = validatedData.numero.includes('@lid') && numeroLimpo 
      ? numeroLimpo 
      : validatedData.numero;
    
    if (telefoneFormatadoFinal && (telefoneFormatadoFinal.includes('@lid') || telefoneFormatadoFinal.length < 10)) {
      console.error('🚫 [WEBHOOK] BLOQUEIO FINAL - telefone_formatado ainda contém @lid ou é inválido:', {
        telefone_formatado: telefoneFormatadoFinal,
        numero_original: validatedData.numero,
        nome_contato: nomeContatoFinal
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Bloqueado: telefone_formatado inválido (@lid ou < 10 dígitos)',
        blocked: true,
        telefone_formatado: telefoneFormatadoFinal
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // ⚡ LOG CRÍTICO: Detectar mensagem recebida antes de salvar
    const isReceivedMessage = validatedData.fromMe !== true;
    if (isReceivedMessage) {
      console.log('📥 [WEBHOOK] ⚠️ MENSAGEM RECEBIDA DETECTADA!', {
        numero: validatedData.numero,
        numeroLimpo,
        telefone_formatado: isGroup ? null : numeroLimpo,
        nome_contato: nomeContatoFinal,
        mensagem: validatedData.mensagem?.substring(0, 50),
        company_id: companyId,
        lead_id: leadId,
        fromMe: validatedData.fromMe,
        isGroup: isGroup,
        status: validatedData.status
      });
    } else {
      console.log('📤 [WEBHOOK] Mensagem enviada detectada', {
        numero: validatedData.numero,
        numeroLimpo,
        telefone_formatado: isGroup ? null : numeroLimpo,
        fromMe: validatedData.fromMe,
        isGroup: isGroup
      });
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Garantir que mensagens recebidas SEMPRE sejam salvas
    // Se não tem company_id mas é mensagem recebida, tentar encontrar uma última vez
    if (!companyId && validatedData.fromMe !== true) {
      console.warn('⚠️ [CRÍTICO] Tentando encontrar company_id uma última vez antes de salvar mensagem recebida...');
      
      // Tentar buscar pela instância mais recente ou ativa
      const { data: recentConnection } = await supabase
        .from('whatsapp_connections')
        .select('company_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentConnection?.company_id) {
        companyId = recentConnection.company_id;
        console.log('✅ Company encontrada via instância mais recente:', companyId);
      }
      
      // Se ainda não encontrou, buscar QUALQUER empresa do sistema
      if (!companyId) {
        const { data: anyCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (anyCompany?.id) {
          companyId = anyCompany.id;
          console.log('✅ Company encontrada via fallback de emergência (qualquer empresa):', companyId);
        }
      }
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Se AINDA não tem company_id, é um problema crítico
    // Mas para mensagens recebidas, vamos tentar salvar mesmo assim (pode falhar se banco exigir)
    if (!companyId && validatedData.fromMe !== true) {
      console.error('❌ [CRÍTICO] Nenhuma company_id encontrada após todos os fallbacks para mensagem recebida!');
      console.error('⚠️ Tentando salvar mesmo assim - pode falhar se banco exigir company_id');
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Se ainda não tem company_id mas é mensagem recebida, 
    // criar um objeto de inserção sem company_id (se o banco permitir) ou usar null
    // Isso garante que mensagens recebidas NUNCA sejam perdidas
    const insertData: any = {
      numero: numeroFinal, // 🔥 CRÍTICO: Usar numeroFinal (sem @lid) ao invés de validatedData.numero
      telefone_formatado: telefoneFormatadoFinal,
      mensagem: validatedData.mensagem,
      origem: validatedData.origem,
      status: validatedData.status, // Usar status detectado (Enviada ou Recebida)
      tipo_mensagem: validatedData.tipo_mensagem,
      midia_url: validatedData.midia_url,
      nome_contato: nomeContatoFinal, // Nome correto baseado no contexto
      arquivo_nome: validatedData.arquivo_nome,
      lead_id: leadId,
      replied_to_message: validatedData.replied_to_message || null,
      is_group: isGroup,
      fromme: validatedData.fromMe === true, // CORREÇÃO: fromme minúsculo (PostgreSQL converte para lowercase)
      origem_api: 'evolution', // 🔥 IDENTIFICAÇÃO: Marcar como Evolution API (não oficial)
      // ⚡ CORREÇÃO: Inicializar campos de status de entrega/leitura
      delivered: validatedData.fromMe === true ? true : false, // Mensagens enviadas começam como entregues
      read: false, // Mensagens começam como não lidas
      whatsapp_message_id: body?.data?.key?.id || null, // 🔥 Salvar ID da mensagem do WhatsApp para edição/exclusão
    };
    
    // ⚡ CORREÇÃO DEFINITIVA: Se mensagem foi enviada (fromMe = true), verificar se já existe no banco
    // Isso evita duplicação quando o CRM já salvou a mensagem antes do webhook receber
    if (validatedData.fromMe === true && companyId) {
      // Verificar se mensagem já existe (salva pelo CRM)
      const mensagemTexto = validatedData.mensagem?.substring(0, 100) || '';
      const { data: mensagemExistente } = await supabase
        .from('conversas')
        .select('id, sent_by, owner_id')
        .eq('company_id', companyId)
        .eq('telefone_formatado', telefoneFormatadoFinal)
        .eq('fromme', true)
        .ilike('mensagem', `${mensagemTexto.substring(0, 50)}%`)
        .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Últimos 60 segundos
        .limit(1)
        .maybeSingle();
      
      if (mensagemExistente) {
        console.log('⚠️ [WEBHOOK] Mensagem enviada já existe no banco (salva pelo CRM), atualizando whatsapp_message_id:', {
          id: mensagemExistente.id,
          sent_by: mensagemExistente.sent_by,
          whatsapp_message_id: body?.data?.key?.id
        });
        // 🔥 Atualizar whatsapp_message_id para permitir edição futura
        if (body?.data?.key?.id) {
          await supabase
            .from('conversas')
            .update({ whatsapp_message_id: body.data.key.id })
            .eq('id', mensagemExistente.id);
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem já existe, whatsapp_message_id atualizado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // ⚡ CORREÇÃO: Mensagem enviada pelo WhatsApp App/Web (fora do CRM)
      // Marcar como "WhatsApp" para diferenciar de mensagens enviadas pelo CRM
      insertData.sent_by = "WhatsApp";
      console.log('📱 [WEBHOOK] Mensagem enviada pelo WhatsApp App/Web detectada, usando assinatura "WhatsApp"');
    }
    
    // ⚡ CORREÇÃO: Adicionar company_id apenas se existir
    // Se não existir mas for mensagem recebida, tentar salvar mesmo assim
    if (companyId) {
      insertData.company_id = companyId;
    } else if (validatedData.fromMe !== true) {
      // Para mensagens recebidas sem company_id, logar mas tentar salvar
      console.error('❌ [CRÍTICO] Tentando salvar mensagem recebida SEM company_id - pode falhar se banco exigir');
    }
    
    // ⚡ LOG ANTES DE SALVAR para debug
    console.log('💾 [WEBHOOK] TENTANDO SALVAR CONVERSA:', {
      isReceivedMessage,
      fromMe: validatedData.fromMe,
      tipo_mensagem: validatedData.tipo_mensagem,
      midia_url_validatedData: validatedData.midia_url,
      arquivo_nome_validatedData: validatedData.arquivo_nome,
      insertData: {
        ...insertData,
        mensagem: insertData.mensagem?.substring(0, 50) + '...',
        midia_url: insertData.midia_url,
        arquivo_nome: insertData.arquivo_nome
      }
    });
    
    // Salvar conversa no Supabase com telefone normalizado e STATUS correto
    const { data, error } = await supabase
      .from('conversas')
      .insert([insertData])
      .select()
      .single();
    
    // ⚡ LOG APÓS INSERÇÃO para debug
    console.log('💾 [WEBHOOK] RESULTADO DA INSERÇÃO:', {
      sucesso: !error,
      erro: error?.message,
      errorCode: error?.code,
      data: data ? { id: data.id, fromme: data.fromme } : null
    });

    if (error) {
      console.error('❌ [CRÍTICO] Erro ao salvar conversa:', error, {
        isReceived: isReceivedMessage,
        fromMe: validatedData.fromMe,
        company_id: companyId,
        lead_id: leadId,
        telefone_formatado: insertData.telefone_formatado,
        nome_contato: insertData.nome_contato,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
        insertData: {
          numero: insertData.numero,
          telefone_formatado: insertData.telefone_formatado,
          nome_contato: insertData.nome_contato,
          company_id: insertData.company_id,
          lead_id: insertData.lead_id,
          fromme: insertData.fromme,
          status: insertData.status
        }
      });
      
      // ⚡ CORREÇÃO CRÍTICA: Se erro for por falta de company_id e for mensagem recebida,
      // tentar encontrar company_id e salvar novamente
      if (isReceivedMessage && (!companyId || error.message?.includes('company_id') || error.code === '23502')) {
        console.warn('⚠️ [CRÍTICO] Erro ao salvar mensagem recebida - tentando encontrar company_id e salvar novamente...');
        
        // Última tentativa: buscar qualquer empresa
        const { data: emergencyCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (emergencyCompany?.id) {
          companyId = emergencyCompany.id;
          insertData.company_id = companyId;
          
          console.log('✅ Company encontrada em emergência, tentando salvar novamente...');
          
          // Tentar salvar novamente com company_id
          const { data: retryData, error: retryError } = await supabase
            .from('conversas')
            .insert([insertData])
            .select()
            .single();
          
          if (!retryError && retryData) {
            console.log('✅ [SUCESSO] Mensagem recebida salva após retry com company_id de emergência!');
            // Continuar com o fluxo normal usando retryData
            const data = retryData;
            // Pular para o log de sucesso
            if (isReceivedMessage) {
              console.log('✅ [WEBHOOK] Mensagem RECEBIDA salva com sucesso!', {
                id: data.id,
                numero: validatedData.numero,
                fromme: data.fromme,
                status: data.status,
                company_id: data.company_id
              });
            }
            // Continuar com o fluxo normal
          } else {
            console.error('❌ [CRÍTICO] Erro ao salvar mesmo após retry:', retryError);
            // Continuar com tratamento de erro normal
          }
        }
      }
      
      // ⚡ CORREÇÃO: Para mensagens recebidas, NUNCA retornar erro 500
      // Sempre retornar sucesso para não bloquear o webhook
      if (isReceivedMessage) {
        console.error('❌ [CRÍTICO] Erro ao salvar mensagem recebida, mas retornando sucesso para não bloquear webhook');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Mensagem recebida processada (pode ter erro ao salvar)',
            warning: 'Erro ao salvar no banco, mas webhook processado'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Map database errors to user-friendly messages
      let errorMessage = 'Erro ao processar conversa';
      let errorCode = 'INTERNAL_ERROR';
      
      if (error.message?.includes('violates')) {
        errorMessage = 'Dados inválidos fornecidos';
        errorCode = 'VALIDATION_ERROR';
      } else if (error.message?.includes('row-level security')) {
        errorMessage = 'Você não tem permissão para esta ação';
        errorCode = 'FORBIDDEN';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚡ LOG CRÍTICO: Confirmar que mensagem recebida foi salva
    if (isReceivedMessage) {
      console.log('✅ [WEBHOOK] Mensagem RECEBIDA salva com sucesso!', {
        id: data.id,
        numero: validatedData.numero,
        fromme: data.fromme,
        status: data.status,
        company_id: data.company_id
      });
    } else {
      console.log('✅ [WEBHOOK] Mensagem enviada salva com sucesso', {
        id: data.id,
        fromme: data.fromme
      });
    }

    // ROTEAMENTO AUTOMÁTICO: tentar atribuir conversa a um colaborador disponível (apenas para contatos)
    // TODO: Implementar autoRouteConversation
    /*
    if (!isGroup && numeroLimpo) {
      try {
        await autoRouteConversation({
          supabase,
          companyId: companyId!,
          numeroLimpo,
          conversaId: data.id,
        });
      } catch (routeError) {
        console.warn('⚠️ Falha ao rotear automaticamente:', routeError);
      }
    }
    */

    // ========================
    // 🤖 INTEGRAÇÃO COM FLUXO DE AUTOMAÇÃO + IA
    // ========================
    if (isReceivedMessage && !isGroup && companyId && numeroLimpo) {
      try {
        console.log('🔄 [WEBHOOK-FLOW] Verificando fluxo de automação ativo...');
        
        // 1. Verificar se existe estado de fluxo ativo para este número
        const { data: flowState } = await supabase
          .from('conversation_flow_state')
          .select('*')
          .eq('conversation_number', numeroLimpo)
          .eq('company_id', companyId)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        
        // 🔑 PRIORIDADE: Verificar se a mensagem é uma palavra-chave de algum fluxo ANTES de continuar fluxo existente
        // 🔑 Buscar parent_company_id para também verificar fluxos da company mãe
        let parentCompanyId: string | null = null;
        {
          const { data: companyData } = await supabase
            .from('companies')
            .select('parent_company_id')
            .eq('id', companyId)
            .single();
          parentCompanyId = companyData?.parent_company_id || null;
          if (parentCompanyId) {
            console.log(`🏢 [WEBHOOK-FLOW] Subconta detectada, parent_company_id: ${parentCompanyId}`);
          }
        }

        // REGRA: Cada empresa usa SOMENTE seus próprios fluxos (individual e isolado)
        // NÃO herdar fluxos da empresa mãe - cada conta deve criar seus próprios fluxos
        const companyIdsToSearch = [companyId];

        let keywordOverride = false;
        if (flowState) {
          const { data: allActiveFlows } = await supabase
            .from('automation_flows')
            .select('id, nodes, company_id')
            .in('company_id', companyIdsToSearch)
            .eq('active', true);
          
          if (allActiveFlows) {
            for (const flow of allActiveFlows) {
              const nodes = (flow.nodes as any[]) || [];
              const kwTrigger = nodes.find((n: any) => 
                n.type === 'trigger' && n.data?.triggerType === 'palavra_chave' && n.data?.keyword
              );
              if (kwTrigger) {
                const kw = kwTrigger.data.keyword.toLowerCase().trim();
                const msg = (validatedData.mensagem || '').toLowerCase().trim();
                if (msg.includes(kw)) {
                  console.log(`🔑 [WEBHOOK-FLOW] Palavra-chave "${kw}" detectada! Resetando estado anterior e iniciando novo fluxo. (flow company: ${flow.company_id})`);
                  // Limpar estado antigo
                  await supabase.from('conversation_flow_state')
                    .delete()
                    .eq('conversation_number', numeroLimpo)
                    .eq('company_id', companyId);
                  keywordOverride = true;
                  break;
                }
              }
            }
          }
        }

        if (flowState && !keywordOverride) {
          console.log('✅ [WEBHOOK-FLOW] Estado de fluxo ativo encontrado:', {
            flowId: flowState.flow_id,
            currentNode: flowState.current_node_id,
            waitingForInput: flowState.waiting_for_input
          });
          
          // Continuar fluxo de onde parou
          const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
          const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          
          fetch(`${supabaseUrlEnv}/functions/v1/executar-fluxo`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKeyEnv}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              flowId: flowState.flow_id,
              leadId: flowState.context_data?.leadId || leadId,
              conversationId: data.id,
              conversationNumber: numeroLimpo,
              companyId,
              currentNodeId: flowState.current_node_id,
              userResponse: validatedData.mensagem,
              triggerData: {
                message: validatedData.mensagem,
                tipo_mensagem: validatedData.tipo_mensagem,
                midia_url: validatedData.midia_url,
              }
            })
          }).then(async (r) => {
            const result = await r.json();
            console.log('✅ [WEBHOOK-FLOW] Fluxo continuado:', result);
          }).catch((e) => {
            console.error('❌ [WEBHOOK-FLOW] Erro ao continuar fluxo:', e);
          });
          
          // Não chamar IA - o fluxo já está tratando
        } else {
          // 1.5. Verificar se conversa foi transferida (conversation_assignment ativo)
          let hasActiveAssignment = false;
          if (telefoneFormatadoFinal || numeroLimpo) {
            const telCheck = telefoneFormatadoFinal || numeroLimpo;
            const { data: assignment } = await supabase
              .from('conversation_assignments')
              .select('id')
              .eq('telefone_formatado', telCheck)
              .eq('company_id', companyId)
              .not('assigned_user_id', 'is', null)
              .maybeSingle();
            
            if (assignment) {
              hasActiveAssignment = true;
              console.log('🚫 [WEBHOOK-FLOW] Conversa transferida - fluxo BLOQUEADO:', {
                telefone: telCheck,
                assignmentId: assignment.id
              });
            }
          }
          
          if (hasActiveAssignment) {
            console.log('⏭️ [WEBHOOK-FLOW] Pulando inicialização de fluxo - conversa sob atendimento humano');
          } else {
          // 2. Verificar se empresa tem fluxo ativo com gatilho "nova_mensagem"
          const { data: activeFlows } = await supabase
            .from('automation_flows')
            .select('id, nodes, company_id, settings')
            .in('company_id', companyIdsToSearch)
            .eq('active', true);
          
          let flowStarted = false;
          
          if (activeFlows && activeFlows.length > 0) {
            console.log(`🔍 [WEBHOOK-FLOW] ${activeFlows.length} fluxo(s) ativo(s) encontrado(s), mensagem: "${validatedData.mensagem}"`);
            for (const flow of activeFlows) {
              const nodes = (flow.nodes as any[]) || [];
              const flowSettings = (flow as any).settings || {};
              
              // ===== CHECK: Blocked tags =====
              const excludeTags: string[] = flowSettings?.filters?.excludeTags || [];
              if (excludeTags.length > 0 && leadId) {
                const { data: leadData } = await supabase
                  .from('leads')
                  .select('tags')
                  .eq('id', leadId)
                  .maybeSingle();
                
                const leadTags: string[] = leadData?.tags || [];
                const hasBlockedTag = leadTags.some((tag: string) => 
                  excludeTags.some((bt: string) => bt.toLowerCase().trim() === tag.toLowerCase().trim())
                );
                
                if (hasBlockedTag) {
                  console.log(`🚫 [WEBHOOK-FLOW] Lead tem tag bloqueada, pulando fluxo ${flow.id}`, { leadTags, excludeTags });
                  continue;
                }
              }
              
              // ===== CHECK: Schedule (horário de funcionamento) =====
              const schedule = flowSettings?.schedule;
              if (schedule?.enabled) {
                const now = new Date();
                // Convert to Brasilia time (UTC-3)
                const brasiliaOffset = -3 * 60;
                const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
                const brasiliaDate = new Date(utcMs + (brasiliaOffset * 60000));
                
                const dayMap: Record<number, string> = {
                  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
                  4: 'thursday', 5: 'friday', 6: 'saturday'
                };
                const currentDay = dayMap[brasiliaDate.getDay()];
                const currentTime = `${String(brasiliaDate.getHours()).padStart(2, '0')}:${String(brasiliaDate.getMinutes()).padStart(2, '0')}`;
                
                const allowedDays: string[] = schedule.days || [];
                const startTime: string = schedule.startTime || '09:00';
                const endTime: string = schedule.endTime || '18:00';
                
                const isAllowedDay = allowedDays.length === 0 || allowedDays.includes(currentDay);
                const isWithinTime = currentTime >= startTime && currentTime <= endTime;
                
                if (!isAllowedDay || !isWithinTime) {
                  console.log(`🕐 [WEBHOOK-FLOW] Fora do horário de funcionamento do fluxo ${flow.id}`, { currentDay, currentTime, allowedDays, startTime, endTime });
                  
                  // Send out-of-hours message if configured
                  const outOfHoursMessage = flowSettings?.schedule?.outOfHoursMessage;
                  if (outOfHoursMessage && numeroLimpo) {
                    console.log('📩 [WEBHOOK-FLOW] Enviando mensagem fora de horário');
                    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
                    const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                    
                    try {
                      await fetch(`${supabaseUrlEnv}/functions/v1/enviar-whatsapp`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${supabaseKeyEnv}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          numero: numeroLimpo,
                          mensagem: outOfHoursMessage,
                          companyId
                        })
                      });
                      
                      // Persist message in CRM
                      const telefoneFormatado = numeroLimpo.replace(/\D/g, '');
                      await supabase.from('conversas').insert({
                        numero: telefoneFormatado,
                        mensagem: outOfHoursMessage,
                        fromme: true,
                        origem: 'automacao',
                        status: 'sent',
                        company_id: companyId,
                        lead_id: leadId || null,
                        nome_contato: nomeContatoFinal || null,
                        telefone_formatado: telefoneFormatado,
                        sent_by: 'bot',
                        tipo_mensagem: 'text'
                      });
                    } catch (e) {
                      console.error('❌ [WEBHOOK-FLOW] Erro ao enviar msg fora de horário:', e);
                    }
                  }
                  
                  flowStarted = true; // Prevent IA from also responding
                  break;
                }
              }
              
              // Check for keyword trigger first (more specific)
              const keywordTrigger = nodes.find((n: any) => 
                n.type === 'trigger' && n.data?.triggerType === 'palavra_chave' && n.data?.keyword
              );
              
              let matchedTriggerType = 'nova_mensagem';
              
              if (keywordTrigger) {
                const keyword = keywordTrigger.data.keyword.toLowerCase().trim();
                const msg = (validatedData.mensagem || '').toLowerCase().trim();
                console.log(`🔑 [WEBHOOK-FLOW] Verificando palavra-chave: "${keyword}" na mensagem: "${msg}"`);
                if (!msg.includes(keyword)) {
                  console.log(`⏭️ [WEBHOOK-FLOW] Palavra-chave "${keyword}" NÃO encontrada, pulando fluxo`);
                  continue;
                }
                console.log(`✅ [WEBHOOK-FLOW] Palavra-chave "${keyword}" encontrada!`);
                matchedTriggerType = 'palavra_chave';
              } else {
                // Only activate if flow has nova_mensagem trigger
                const hasNovaMensagem = nodes.some((n: any) => 
                  n.type === 'trigger' && n.data?.triggerType === 'nova_mensagem'
                );
                if (!hasNovaMensagem) {
                  console.log(`⏭️ [WEBHOOK-FLOW] Fluxo ${flow.id} não tem gatilho nova_mensagem nem palavra_chave`);
                  continue;
                }
              }
              
              console.log('🚀 [WEBHOOK-FLOW] Iniciando fluxo:', flow.id, 'triggerType:', matchedTriggerType);
              
              const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
              const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              
              fetch(`${supabaseUrlEnv}/functions/v1/executar-fluxo`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKeyEnv}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  flowId: flow.id,
                  leadId,
                  conversationId: data.id,
                  conversationNumber: numeroLimpo,
                  companyId,
                  triggerType: matchedTriggerType,
                  triggerData: {
                    message: validatedData.mensagem,
                    tipo_mensagem: validatedData.tipo_mensagem,
                    midia_url: validatedData.midia_url,
                    nome_contato: nomeContatoFinal,
                  }
                })
              }).then(async (r) => {
                const result = await r.json();
                console.log('✅ [WEBHOOK-FLOW] Fluxo iniciado:', result);
              }).catch((e) => {
                console.error('❌ [WEBHOOK-FLOW] Erro ao iniciar fluxo:', e);
              });
                
              flowStarted = true;
              break; // Usar apenas o primeiro fluxo com gatilho correspondente
            }
          }
          
          // 3. Se nenhum fluxo foi iniciado, verificar modo IA por conversa
          if (!flowStarted && leadId) {
            console.log('🤖 [WEBHOOK-IA] Nenhum fluxo ativo, verificando IA...');
            
            // ⚡ VERIFICAR SE HUMANO ESTÁ EM ATENDIMENTO ATIVO
            // Se sim, pausar IA automaticamente para não interferir
            let humanIsAttending = false;
            if (telefoneFormatadoFinal) {
              const { data: activeAttendance } = await supabase
                .from('active_attendances')
                .select('id, attending_user_name, expires_at')
                .eq('telefone_formatado', telefoneFormatadoFinal)
                .eq('company_id', companyId)
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();
              
              if (activeAttendance) {
                humanIsAttending = true;
                console.log('👤 [WEBHOOK-IA] Humano em atendimento ativo - IA PAUSADA:', {
                  attendant: activeAttendance.attending_user_name,
                  expires: activeAttendance.expires_at,
                  telefone: telefoneFormatadoFinal
                });
              }
            }
            
            if (humanIsAttending) {
              console.log('⛔ [WEBHOOK-IA] IA pausada - humano está atendendo este contato');
            } else {
            
            // Consultar conversation_ai_settings para modo por conversa
            let aiModeForConversation: string | null = null;
            const telefoneParaBusca = telefoneFormatadoFinal || numeroLimpo;
            
            if (telefoneParaBusca) {
              const { data: aiSetting } = await supabase
                .from('conversation_ai_settings')
                .select('ai_mode')
                .eq('conversation_id', telefoneParaBusca)
                .eq('company_id', companyId)
                .maybeSingle();
              
              if (aiSetting) {
                aiModeForConversation = aiSetting.ai_mode;
                console.log('🎯 [WEBHOOK-IA] Modo IA por conversa encontrado:', aiModeForConversation);
              }
            }
            
            // Se modo = 'off', não fazer nada
            if (aiModeForConversation === 'off') {
              console.log('⛔ [WEBHOOK-IA] IA desativada para esta conversa');
            }
            // Se modo = 'fluxo', não chamar IA (apenas fluxos, já tratados acima)
            else if (aiModeForConversation === 'fluxo') {
              console.log('🔄 [WEBHOOK-IA] Modo fluxo - IA não será chamada');
            }
            // Se modo = 'atendimento', chamar só ia-atendimento
            else if (aiModeForConversation === 'atendimento') {
              console.log('🤖 [WEBHOOK-IA] Modo atendimento - chamando ia-atendimento...');
              const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
              const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              
              const { data: leadDataForIA } = await supabase
                .from('leads').select('*').eq('id', leadId).single();
              
              fetch(`${supabaseUrlEnv}/functions/v1/ia-atendimento`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: data.id, message: validatedData.mensagem, numero: numeroLimpo, leadData: leadDataForIA, companyId })
              }).then(async (r) => {
                const result = await r.json();
                if (result.response) {
                  const delay = result.suggestedDelay || 2000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                  console.log(`⏱️ [WEBHOOK-IA] Delay de ${delay}ms aplicado para humanização`);
                  await fetch(`${supabaseUrlEnv}/functions/v1/enviar-whatsapp`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numero: numeroLimpo, mensagem: result.response, tipo_mensagem: 'text', company_id: companyId })
                  });
                  // 💾 Salvar resposta da IA no CRM para ficar visível
                  await supabase.from('conversas').insert({
                    numero: numeroFinal,
                    telefone_formatado: telefoneFormatadoFinal,
                    mensagem: result.response,
                    origem: 'WhatsApp',
                    status: 'Enviada',
                    tipo_mensagem: 'texto',
                    nome_contato: nomeContatoFinal,
                    lead_id: leadId,
                    company_id: companyId,
                    fromme: true,
                    sent_by: 'IA Atendimento',
                    delivered: true,
                    read: false,
                  });
                  console.log('💾 [WEBHOOK-IA] Resposta da IA salva no CRM');
                }
              }).catch(e => console.error('❌ [WEBHOOK-IA] Erro ia-atendimento:', e));
            }
            // Se modo = 'agendamento', chamar só ia-agendamento
            else if (aiModeForConversation === 'agendamento') {
              console.log('📅 [WEBHOOK-IA] Modo agendamento - chamando ia-agendamento...');
              const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
              const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              
              const { data: leadDataForIA } = await supabase
                .from('leads').select('*').eq('id', leadId).single();
              
              fetch(`${supabaseUrlEnv}/functions/v1/ia-agendamento`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: data.id, message: validatedData.mensagem, numero: numeroLimpo, leadData: leadDataForIA, companyId })
              }).then(async (r) => {
                const result = await r.json();
                if (result.response) {
                  const delay = result.suggestedDelay || 2000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                  console.log(`⏱️ [WEBHOOK-IA] Delay de ${delay}ms aplicado para humanização`);
                  await fetch(`${supabaseUrlEnv}/functions/v1/enviar-whatsapp`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numero: numeroLimpo, mensagem: result.response, tipo_mensagem: 'text', company_id: companyId })
                  });
                  // 💾 Salvar resposta da IA no CRM para ficar visível
                  await supabase.from('conversas').insert({
                    numero: numeroFinal,
                    telefone_formatado: telefoneFormatadoFinal,
                    mensagem: result.response,
                    origem: 'WhatsApp',
                    status: 'Enviada',
                    tipo_mensagem: 'texto',
                    nome_contato: nomeContatoFinal,
                    lead_id: leadId,
                    company_id: companyId,
                    fromme: true,
                    sent_by: 'IA Agendamento',
                    delivered: true,
                    read: false,
                  });
                  console.log('💾 [WEBHOOK-IA] Resposta da IA Agendamento salva no CRM');
                }
              }).catch(e => console.error('❌ [WEBHOOK-IA] Erro ia-agendamento:', e));
            }
            else if (aiModeForConversation === 'garcom') {
              console.log('[WEBHOOK-IA] Modo garcom - chamando ia-garcom...');
              const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
              const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              const canalGarcom = validatedData.origem === 'Instagram' ? 'instagram' : 'whatsapp';
              const enviarEndpoint = canalGarcom === 'instagram' ? 'enviar-instagram' : 'enviar-whatsapp';
              const { data: leadDataForIA } = await supabase
                .from('leads').select('*').eq('id', leadId).single();

              fetch(`${supabaseUrlEnv}/functions/v1/ia-garcom`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  conversationId: telefoneParaBusca || data.id,
                  message: validatedData.mensagem,
                  numero: numeroLimpo,
                  leadData: leadDataForIA,
                  companyId,
                  canal: canalGarcom,
                })
              }).then(async (r) => {
                const result = await r.json();
                if (result.response) {
                  const delay = 1500 + Math.random() * 1500;
                  await new Promise(resolve => setTimeout(resolve, delay));
                  await fetch(`${supabaseUrlEnv}/functions/v1/${enviarEndpoint}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numero: numeroLimpo, mensagem: result.response, tipo_mensagem: 'text', company_id: companyId })
                  });
                  await supabase.from('conversas').insert({
                    numero: numeroFinal,
                    telefone_formatado: telefoneFormatadoFinal,
                    mensagem: result.response,
                    origem: validatedData.origem,
                    status: 'Enviada',
                    tipo_mensagem: 'texto',
                    nome_contato: nomeContatoFinal,
                    lead_id: leadId,
                    company_id: companyId,
                    fromme: true,
                    sent_by: 'Garcom IA',
                    delivered: true,
                    read: false,
                  });
                  if (result.pedidoCriado) {
                    console.log('[WEBHOOK-IA] Pedido criado pelo Garcom IA:', result.pedidoCriado.id);
                  }
                }
              }).catch(e => console.error('[WEBHOOK-IA] Erro ia-garcom:', e));
            }            // Se modo = 'all' ou sem registro, usar lógica atual (orchestrator/global)
            else {
              // Comportamento padrão: verificar ia_configurations global
              const { data: iaConfig } = await supabase
                .from('ia_configurations')
                .select('learning_mode, custom_prompts')
                .eq('company_id', companyId)
                .maybeSingle();
              
              // Ativar se modo = 'all' OU se learning_mode global estiver ativo (sem registro por conversa)
              const shouldActivateIA = aiModeForConversation === 'all' || (!aiModeForConversation && iaConfig?.learning_mode);
              
              if (shouldActivateIA) {
                console.log('✅ [WEBHOOK] IA ativada - processando mensagem:', companyId, 'modo:', aiModeForConversation || 'global');
                
                const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
                const supabaseKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                
                const { data: leadDataForIA } = await supabase
                  .from('leads').select('*').eq('id', leadId).single();
                
                fetch(`${supabaseUrlEnv}/functions/v1/ia-orchestrator`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ conversationId: data.id, message: validatedData.mensagem, numero: numeroLimpo, leadData: leadDataForIA, companyId })
                }).then(async (iaResponse) => {
                  if (!iaResponse.ok) { console.log('⚠️ [WEBHOOK-IA] IA não respondeu'); return; }
                  const iaResult = await iaResponse.json();
                  if (!iaResult.active || iaResult.shouldTransfer) return;
                  if (iaResult.response) {
                    const delay = iaResult.suggestedDelay || 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`⏱️ [WEBHOOK-IA] Delay de ${delay}ms aplicado para humanização`);
                    console.log('🤖 [WEBHOOK-IA] Enviando resposta da IA...');
                    await fetch(`${supabaseUrlEnv}/functions/v1/enviar-whatsapp`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${supabaseKeyEnv}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ numero: numeroLimpo, mensagem: iaResult.response, tipo_mensagem: 'text', company_id: companyId })
                    });
                    // 💾 Salvar resposta da IA no CRM para ficar visível
                    await supabase.from('conversas').insert({
                      numero: numeroLimpo,
                      telefone_formatado: telefoneFormatadoFinal,
                      mensagem: iaResult.response,
                      origem: 'WhatsApp',
                      status: 'Enviada',
                      tipo_mensagem: 'texto',
                      nome_contato: nomeContatoFinal,
                      lead_id: leadId,
                      company_id: companyId,
                      fromme: true,
                      sent_by: 'IA Orquestrador',
                      delivered: true,
                      read: false,
                    });
                    console.log('💾 [WEBHOOK-IA] Resposta do Orquestrador salva no CRM');
                  }
                }).catch((iaError) => { console.error('❌ [WEBHOOK-IA] Erro:', iaError); });
              } else {
                console.log('⚠️ [WEBHOOK] IA desativada para empresa:', companyId);
              }
            }
            } // fim do else humanIsAttending
          }
          } // fim do else hasActiveAssignment
        }
      } catch (flowError) {
        console.error('❌ [WEBHOOK-FLOW] Erro ao processar fluxo/IA:', flowError);
      }
    }
    // ========================

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conversa registrada com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao processar requisição',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
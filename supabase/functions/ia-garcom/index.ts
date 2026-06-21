import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { criarPedidoFinal } from "../_shared/criar-pedido.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Produto = {
  id: string;
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  preco_sugerido?: number | null;
};

function montarSystemPromptGarcom(
  companyName: string,
  cardapio: Produto[],
  pizzaTamanhos: any[],
  pizzaBordas: any[],
  carrinhoAtual: any[],
  clienteContext: string,
) {
  return `Voce e o garcom virtual da ${companyName}. Atende pelo WhatsApp, Instagram e Cardapio Digital como um garcom de verdade atenderia por texto.

CARDAPIO DISPONIVEL:
${cardapio.map((p) => `- ID ${p.id} | ${p.nome} (${p.categoria || "sem categoria"}): R$${Number(p.preco_sugerido || 0).toFixed(2)} - ${p.descricao || ""}`).join("\n")}

${pizzaTamanhos.length ? `TAMANHOS DE PIZZA:\n${pizzaTamanhos.map((t) => `- ${t.nome} (ate ${t.max_sabores || 1} sabores)`).join("\n")}\n` : ""}
${pizzaBordas.length ? `BORDAS RECHEADAS DISPONIVEIS:\n${pizzaBordas.map((b) => `- ${b.nome}`).join("\n")}\n` : ""}

CARRINHO ATUAL:
${carrinhoAtual.length ? carrinhoAtual.map((i) => `- ${i.quantidade}x ${i.produto_nome} (R$${Number(i.valor_unitario || 0).toFixed(2)} cada) ${i.observacoes || ""}`).join("\n") : "Vazio ainda."}

${clienteContext}

COMO VOCE DEVE SE COMPORTAR:
1. Seja simpatico, direto e natural. Nao diga que e IA.
2. Frases curtas, no maximo 2 ou 3 por mensagem.
3. Confirme cada item antes de seguir.
4. Pergunte se e entrega ou retirada. Se entrega, peca endereco completo.
5. Pergunte forma de pagamento: pix, cartao ou dinheiro.
6. Antes de finalizar, resuma pedido, valores, entrega/retirada e pagamento.
7. NUNCA finalize sem confirmacao explicita do cliente.
8. Se sair do escopo de pedido, use [TRANSFERIR_HUMANO].

ACOES INTERNAS: coloque no maximo UMA por resposta, no final, entre colchetes. O cliente nunca vera isso.
[ADD_ITEM:produto_id|quantidade|observacao]
[REMOVE_ITEM:produto_id]
[SET_ENTREGA:endereco_completo]
[SET_RETIRADA]
[SET_PAGAMENTO:pix|dinheiro|cartao]
[CONFIRMAR_PEDIDO]
[TRANSFERIR_HUMANO]

Use sempre o ID real do produto ao adicionar item.`;
}

function parseAction(aiResponse: string) {
  const actionPattern = /\[\s*(ADD_ITEM|REMOVE_ITEM|SET_ENTREGA|SET_RETIRADA|SET_PAGAMENTO|CONFIRMAR_PEDIDO|TRANSFERIR_HUMANO)\s*(?::\s*([^\]]*))?\s*\]/i;
  const match = actionPattern.exec(aiResponse);
  return {
    action: match?.[1]?.toUpperCase() || null,
    params: match?.[2]?.trim() || null,
    cleanResponse: aiResponse.replace(actionPattern, "").trim(),
  };
}

async function getOrCreateCarrinho(supabase: any, body: any) {
  const { data: existing } = await supabase
    .from("garcom_carrinhos")
    .select("*")
    .eq("company_id", body.companyId)
    .eq("conversation_id", body.conversationId)
    .eq("status", "aberto")
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("garcom_carrinhos")
    .insert({
      company_id: body.companyId,
      conversation_id: body.conversationId,
      canal: body.canal || "whatsapp",
      cliente_nome: body.leadData?.name || body.leadData?.nome || null,
      cliente_telefone: body.numero || body.leadData?.phone || body.leadData?.telefone || null,
      itens: [],
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nao configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { conversationId, message, numero, leadData, companyId, canal = "whatsapp" } = body;
    if (!conversationId || !message || !companyId) throw new Error("conversationId, message e companyId sao obrigatorios");

    const carrinho = await getOrCreateCarrinho(supabase, body);

    const [{ data: produtos }, { data: pizzaTamanhos }, { data: pizzaBordas }, { data: company }] = await Promise.all([
      supabase.from("produtos_servicos")
        .select("id, nome, categoria, descricao, preco_sugerido")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .eq("ativo_cardapio", true)
        .neq("tipo_produto", "insumo")
        .order("nome"),
      supabase.from("pizza_tamanhos").select("*").eq("company_id", companyId).eq("ativo", true),
      supabase.from("pizza_bordas").select("*").eq("company_id", companyId).eq("ativo", true),
      supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    ]);

    let clienteContext = "";
    const phone = numero || leadData?.phone || leadData?.telefone;
    if (phone) {
      const tel = String(phone).replace(/\D/g, "");
      const { data: lead } = await supabase
        .from("leads")
        .select("endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade")
        .eq("company_id", companyId)
        .or(`phone.eq.${tel},telefone.eq.${tel}`)
        .maybeSingle();

      if (lead?.endereco_logradouro) {
        clienteContext = `ENDERECO JA CADASTRADO: ${lead.endereco_logradouro}, ${lead.endereco_numero || ""} - ${lead.endereco_bairro || ""} ${lead.endereco_cidade || ""}. Pergunte se entrega nesse mesmo endereco.`;
      }
    }

    const { data: historico } = await supabase
      .from("conversas")
      .select("mensagem, fromme, created_at")
      .eq("company_id", companyId)
      .or(`telefone_formatado.eq.${conversationId},numero.eq.${conversationId}`)
      .order("created_at", { ascending: false })
      .limit(10);

    const systemPrompt = montarSystemPromptGarcom(
      company?.name || "a pizzaria",
      produtos || [],
      pizzaTamanhos || [],
      pizzaBordas || [],
      carrinho.itens || [],
      clienteContext,
    );

    const messagesArray = [
      { role: "system", content: systemPrompt },
      ...((historico || []).reverse().map((m: any) => ({
        role: m.fromme ? "assistant" : "user",
        content: m.mensagem,
      }))),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messagesArray,
        max_tokens: 350,
      }),
    });

    if (!response.ok) throw new Error(`Erro da IA: ${response.status}`);

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "";
    const { action, params, cleanResponse } = parseAction(aiResponse);

    let pedidoCriado = null;
    let carrinhoAtualizado = carrinho;

    const updateCarrinho = async (patch: Record<string, unknown>) => {
      const { data: updated, error } = await supabase
        .from("garcom_carrinhos")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", carrinho.id)
        .select("*")
        .single();
      if (error) throw error;
      carrinhoAtualizado = updated;
      return updated;
    };

    if (action === "ADD_ITEM" && params) {
      const [produtoIdRaw, qtdRaw, ...obsParts] = params.split("|");
      const produtoId = produtoIdRaw?.trim();
      const produto = (produtos || []).find((p: any) => p.id === produtoId);
      if (produto) {
        const novosItens = [...(carrinho.itens || []), {
          produto_id: produto.id,
          produto_nome: produto.nome,
          quantidade: Math.max(1, Number(qtdRaw || 1)),
          valor_unitario: Number(produto.preco_sugerido || 0),
          observacoes: obsParts.join("|").trim() || null,
        }];
        await updateCarrinho({ itens: novosItens });
      }
    } else if (action === "REMOVE_ITEM" && params) {
      const novosItens = (carrinho.itens || []).filter((i: any) => i.produto_id !== params.trim());
      await updateCarrinho({ itens: novosItens });
    } else if (action === "SET_ENTREGA" && params) {
      await updateCarrinho({ tipo_atendimento: "entrega", endereco: params.trim() });
    } else if (action === "SET_RETIRADA") {
      await updateCarrinho({ tipo_atendimento: "retirada", endereco: null });
    } else if (action === "SET_PAGAMENTO" && params) {
      await updateCarrinho({ forma_pagamento: params.trim().toLowerCase() });
    } else if (action === "CONFIRMAR_PEDIDO") {
      const { data: carrinhoFinal } = await supabase
        .from("garcom_carrinhos")
        .select("*")
        .eq("id", carrinho.id)
        .single();

      if (carrinhoFinal?.itens?.length && carrinhoFinal.tipo_atendimento) {
        pedidoCriado = await criarPedidoFinal(supabase, companyId, {
          cliente_nome: carrinhoFinal.cliente_nome || leadData?.name || "Cliente",
          cliente_telefone: carrinhoFinal.cliente_telefone || numero || leadData?.phone || leadData?.telefone,
          itens: carrinhoFinal.itens,
          tipo_atendimento: carrinhoFinal.tipo_atendimento,
          endereco: carrinhoFinal.endereco,
          forma_pagamento: carrinhoFinal.forma_pagamento,
        }, canal, { origem: "ia-garcom", enviarConfirmacaoWhatsapp: canal === "whatsapp" });

        await supabase
          .from("garcom_carrinhos")
          .update({ status: "confirmado", updated_at: new Date().toISOString() })
          .eq("id", carrinho.id);
      }
    }

    if (action === "TRANSFERIR_HUMANO") {
      await supabase
        .from("conversation_ai_settings")
        .upsert({
          company_id: companyId,
          conversation_id: conversationId,
          ai_mode: "off",
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id,conversation_id" });
    }

    return new Response(JSON.stringify({
      response: cleanResponse,
      action,
      pedidoCriado,
      carrinho: carrinhoAtualizado?.itens || carrinho.itens || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ia-garcom]", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro desconhecido",
      response: "Tive um probleminha aqui para montar seu pedido. Vou chamar alguem da equipe para te ajudar.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

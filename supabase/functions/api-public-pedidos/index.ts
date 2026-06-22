import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { criarPedidoFinal } from "../_shared/criar-pedido.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MenuRequest = {
  action: "menu" | "create" | "customer" | "marketplace";
  telefone?: string;
  slug?: string;
  customer?: {
    nome: string;
    telefone: string;
    tipo_atendimento: string;
    forma_pagamento: string;
    observacoes?: string;
    endereco?: string;
  };
  items?: Array<{
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
    observacoes?: string;
  }>;
};

function normalizePhone(phone?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? `55${digits}` : digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as MenuRequest;

    if (body.action === "marketplace") {
      const storeFields = "slug, nome_loja, descricao_loja, logo_url, banner_url, pedido_minimo, taxa_entrega, aceita_entrega, aceita_retirada, endereco_loja, cor_primaria, categoria_marketplace, visivel_marketplace, tempo_preparo_min";
      let { data: stores, error } = await supabase
        .from("loja_configuracoes")
        .select(storeFields)
        .not("slug", "is", null)
        .eq("aceita_pedidos", true)
        .order("nome_loja");

      if (error) {
        const fallback = await supabase
          .from("loja_configuracoes")
          .select("slug, nome_loja, descricao_loja, logo_url, banner_url, pedido_minimo, taxa_entrega, aceita_entrega, aceita_retirada, endereco_loja, cor_primaria, tempo_preparo_min")
          .not("slug", "is", null)
          .order("nome_loja");
        if (fallback.error) throw fallback.error;
        stores = (fallback.data || []).map((s: any) => ({ ...s, categoria_marketplace: "restaurante", visivel_marketplace: true }));
      }

      const visible = (stores || []).filter((s: any) => s.visivel_marketplace !== false && s.slug);

      return new Response(JSON.stringify({ success: true, stores: visible }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.slug) {
      return new Response(JSON.stringify({ success: false, error: "Slug da loja é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: store, error: storeError } = await supabase
      .from("loja_configuracoes")
      .select("*")
      .eq("slug", body.slug)
      .maybeSingle();

    if (storeError || !store) {
      return new Response(JSON.stringify({ success: false, error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "menu") {
      const { data: products, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, descricao, descricao_curta, descricao_completa, preco_sugerido, categoria, imagem_url, destaque_cardapio, permite_observacao, permite_meio_a_meio, ordem_exibicao, tipo_produto, combo_items, combo_min_selecoes, combo_max_selecoes, promocao_ativa, promocao_preco, promocao_inicio, promocao_fim, promocao_flash, promocao_nota")
        .eq("company_id", store.company_id)
        .eq("ativo", true)
        .eq("ativo_cardapio", true)
        .neq("tipo_produto", "insumo")
        .order("ordem_exibicao")
        .order("nome");

      if (error) throw error;

      const { data: pizzaSizes } = await supabase
        .from("pizza_tamanhos")
        .select("id, nome, slug, multiplicador, max_sabores, fatias, descricao, ordem")
        .eq("company_id", store.company_id)
        .eq("ativo", true)
        .order("ordem");

      const { data: pizzaBordas } = await supabase
        .from("pizza_bordas")
        .select("id, nome, descricao, ordem")
        .eq("company_id", store.company_id)
        .eq("ativo", true)
        .order("ordem");

      const bordaIds = (pizzaBordas || []).map((b: any) => b.id);
      const { data: pizzaBordaPrecos } = bordaIds.length
        ? await supabase
            .from("pizza_borda_precos")
            .select("borda_id, tamanho_id, preco")
            .in("borda_id", bordaIds)
        : { data: [] };

      return new Response(JSON.stringify({
        success: true,
        store,
        products: products || [],
        pizzaSizes: pizzaSizes || [],
        pizzaBordas: pizzaBordas || [],
        pizzaBordaPrecos: pizzaBordaPrecos || [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "customer") {
      const tel = normalizePhone(body.telefone);
      if (!tel) {
        return new Response(JSON.stringify({ success: false, error: "Telefone obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("total, status, cliente_nome")
        .eq("company_id", store.company_id)
        .eq("cliente_telefone", tel);
      const validos = (pedidos || []).filter((p: any) => p.status !== "cancelado");
      const total = validos.reduce((s: number, p: any) => s + Number(p.total || 0), 0);

      // Buscar lead com endereço
      const { data: lead } = await supabase
        .from("leads")
        .select("name, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
        .eq("company_id", store.company_id)
        .or(`phone.eq.${tel},telefone.eq.${tel}`)
        .maybeSingle();

      // Fallback: último pedido_enderecos
      let enderecoSalvo: any = null;
      if (lead?.endereco_logradouro) {
        enderecoSalvo = {
          logradouro: lead.endereco_logradouro,
          numero: lead.endereco_numero,
          complemento: lead.endereco_complemento,
          bairro: lead.endereco_bairro,
          cidade: lead.endereco_cidade,
          estado: lead.endereco_estado,
          cep: lead.endereco_cep,
        };
      } else {
        const { data: lastEnd } = await supabase
          .from("pedido_enderecos")
          .select("logradouro, numero, complemento, bairro, cidade, estado, cep")
          .eq("company_id", store.company_id)
          .eq("telefone_contato", tel)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastEnd?.logradouro) enderecoSalvo = lastEnd;
      }

      const nomeCliente = lead?.name || (validos[0] as any)?.cliente_nome || "";

      return new Response(JSON.stringify({
        success: true,
        pedidos: validos.length,
        total,
        nome: nomeCliente,
        endereco: enderecoSalvo,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (body.action === "create") {
      if (!body.customer?.nome || !body.customer?.telefone || !body.items?.length) {
        return new Response(JSON.stringify({ success: false, error: "Cliente, telefone e itens são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pedidoCriado = await criarPedidoFinal(supabase, store.company_id, {
        cliente_nome: body.customer.nome,
        cliente_telefone: body.customer.telefone,
        itens: body.items,
        tipo_atendimento: body.customer.tipo_atendimento,
        endereco: body.customer.endereco || null,
        forma_pagamento: body.customer.forma_pagamento,
        observacoes: body.customer.observacoes || null,
      }, "cardapio", {
        slug: body.slug,
        origem: "cardapio-digital",
        enviarConfirmacaoWhatsapp: true,
      });

      return new Response(JSON.stringify({
        success: true,
        pedido_id: pedidoCriado.id,
        codigo_pedido: pedidoCriado.codigo_pedido,
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      const subtotal = body.items.reduce(
        (sum, item) => sum + Number(item.valor_unitario || 0) * Number(item.quantidade || 1),
        0,
      );
      const deliveryFee = body.customer.tipo_atendimento === "entrega" ? Number(store.taxa_entrega || 0) : 0;
      const total = subtotal + deliveryFee;

      if (total < Number(store.pedido_minimo || 0)) {
        return new Response(JSON.stringify({ success: false, error: "Pedido abaixo do mínimo da loja" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let leadId: string | null = null;
      const telefone = normalizePhone(body.customer.telefone);

      if (telefone) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("company_id", store.company_id)
          .or(`phone.eq.${telefone},telefone.eq.${telefone}`)
          .maybeSingle();

        if (lead?.id) {
          leadId = lead.id;
        } else {
          const { data: leadCreated } = await supabase
            .from("leads")
            .insert({
              company_id: store.company_id,
              name: body.customer.nome,
              phone: telefone,
              telefone: telefone,
              source: "cardapio-digital",
              status: "novo",
              stage: "novo_pedido",
            })
            .select("id")
            .single();
          leadId = leadCreated?.id || null;
        }
      }

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          company_id: store.company_id,
          lead_id: leadId,
          cliente_nome: body.customer.nome,
          cliente_telefone: telefone || body.customer.telefone,
          canal: "cardapio",
          tipo_atendimento: body.customer.tipo_atendimento,
          forma_pagamento: body.customer.forma_pagamento,
          subtotal,
          taxa_entrega: deliveryFee,
          total,
          observacoes: body.customer.observacoes || null,
          origem_publica: {
            slug: body.slug,
            endereco: body.customer.endereco || null,
          },
        })
        .select("*")
        .single();

      if (pedidoError) throw pedidoError;

      for (const item of body.items) {
        const { error: itemError } = await supabase.rpc("registrar_item_pedido_com_custo", {
          p_pedido_id: pedido.id,
          p_company_id: store.company_id,
          p_produto_id: item.produto_id || null,
          p_produto_nome: item.produto_nome,
          p_quantidade: Number(item.quantidade || 1),
          p_valor_unitario: Number(item.valor_unitario || 0),
          p_observacoes: item.observacoes || null,
        });
        if (itemError) throw itemError;
      }

      if (body.customer.endereco) {
        await supabase.from("pedido_enderecos").insert({
          pedido_id: pedido.id,
          company_id: store.company_id,
          nome_contato: body.customer.nome,
          telefone_contato: telefone || body.customer.telefone,
          logradouro: body.customer.endereco,
        });
        if (leadId) {
          await supabase.from("leads")
            .update({ endereco_logradouro: body.customer.endereco })
            .eq("id", leadId);
        }
      }


      await supabase.from("pedido_eventos").insert({
        pedido_id: pedido.id,
        company_id: store.company_id,
        status: "novo",
        descricao: "Pedido criado pelo cardápio digital",
        metadata: {
          slug: body.slug,
          forma_pagamento: body.customer.forma_pagamento,
        },
      });

      if (store.impressao_automatica) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/print-pedido`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ pedidoId: pedido.id }),
          });
        } catch (printError) {
          console.error("[api-public-pedidos] erro ao disparar impressão:", printError);
        }
      }

      // Enviar mensagem de confirmação via WhatsApp
      try {
        const telefoneEnvio = telefone || String(body.customer.telefone || "").replace(/\D/g, "");
        if (telefoneEnvio && telefoneEnvio.length >= 10) {
          const itensTexto = body.items
            .map((it) => `• ${it.quantidade}x ${it.produto_nome} - R$ ${(Number(it.valor_unitario) * Number(it.quantidade)).toFixed(2)}`)
            .join("\n");
          const tipoAtend = body.customer.tipo_atendimento === "entrega" ? "🛵 Entrega" : "🏠 Retirada";
          const enderecoLinha = body.customer.endereco ? `\n📍 *Endereço:* ${body.customer.endereco}` : "";
          const taxaLinha = deliveryFee > 0 ? `\nTaxa de entrega: R$ ${deliveryFee.toFixed(2)}` : "";
          const mensagem = `🍕 *Pedido confirmado!*\n\nOlá ${body.customer.nome}, recebemos seu pedido *${pedido.codigo_pedido}* na ${store.nome_loja || "nossa loja"}.\n\n*Itens:*\n${itensTexto}\n\nSubtotal: R$ ${subtotal.toFixed(2)}${taxaLinha}\n*Total: R$ ${total.toFixed(2)}*\n\n${tipoAtend}\n💳 *Pagamento:* ${body.customer.forma_pagamento}${enderecoLinha}\n\nAssim que seu pedido for aceito, avisaremos por aqui. Obrigado pela preferência! 🧡`;

          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              company_id: store.company_id,
              numero: telefoneEnvio,
              mensagem,
              origem: "cardapio-digital",
            }),
          });
        }
      } catch (msgError) {
        console.error("[api-public-pedidos] erro ao enviar confirmação WhatsApp:", msgError);
      }

      return new Response(JSON.stringify({
        success: true,
        pedido_id: pedido.id,
        codigo_pedido: pedido.codigo_pedido,
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[api-public-pedidos]", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

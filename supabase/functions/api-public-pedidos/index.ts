import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MenuRequest = {
  action: "menu" | "create";
  slug: string;
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
        .select("id, nome, descricao, preco_sugerido, categoria, imagem_url, destaque_cardapio, permite_observacao, ordem_exibicao")
        .eq("company_id", store.company_id)
        .eq("ativo", true)
        .eq("ativo_cardapio", true)
        .neq("tipo_produto", "insumo")
        .order("ordem_exibicao")
        .order("nome");

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        store,
        products: products || [],
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

      const itemsPayload = body.items.map((item) => ({
        pedido_id: pedido.id,
        company_id: store.company_id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade: Number(item.quantidade || 1),
        valor_unitario: Number(item.valor_unitario || 0),
        valor_total: Number(item.valor_unitario || 0) * Number(item.quantidade || 1),
        observacoes: item.observacoes || null,
      }));

      const { error: itemsError } = await supabase.from("pedido_itens").insert(itemsPayload);
      if (itemsError) throw itemsError;

      if (body.customer.endereco) {
        await supabase.from("pedido_enderecos").insert({
          pedido_id: pedido.id,
          company_id: store.company_id,
          nome_contato: body.customer.nome,
          telefone_contato: telefone || body.customer.telefone,
          logradouro: body.customer.endereco,
        });
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

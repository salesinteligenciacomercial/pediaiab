export type CriarPedidoItem = {
  produto_id?: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  observacoes?: string | null;
};

export type CriarPedidoCarrinho = {
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  itens: CriarPedidoItem[];
  tipo_atendimento: string;
  endereco?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
};

export function normalizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? `55${digits}` : digits;
}

type CriarPedidoOptions = {
  slug?: string | null;
  origem?: string;
  enviarConfirmacaoWhatsapp?: boolean;
};

export async function criarPedidoFinal(
  supabase: any,
  companyId: string,
  carrinho: CriarPedidoCarrinho,
  canal: string,
  options: CriarPedidoOptions = {},
) {
  const itens = Array.isArray(carrinho.itens) ? carrinho.itens : [];
  const subtotal = itens.reduce(
    (sum, item) => sum + Number(item.valor_unitario || 0) * Number(item.quantidade || 1),
    0,
  );

  const { data: lojaConfig } = await supabase
    .from("loja_configuracoes")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  const deliveryFee = carrinho.tipo_atendimento === "entrega"
    ? Number(lojaConfig?.taxa_entrega || 0)
    : 0;
  const total = subtotal + deliveryFee;

  if (lojaConfig?.pedido_minimo && total < Number(lojaConfig.pedido_minimo || 0)) {
    throw new Error("Pedido abaixo do minimo da loja");
  }

  let leadId: string | null = null;
  const telefone = normalizePhone(carrinho.cliente_telefone);

  if (telefone) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .or(`phone.eq.${telefone},telefone.eq.${telefone}`)
      .maybeSingle();

    if (lead?.id) {
      leadId = lead.id;
    } else {
      const { data: leadCreated } = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          name: carrinho.cliente_nome || `Cliente ${canal}`,
          phone: telefone,
          telefone,
          source: canal,
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
      company_id: companyId,
      lead_id: leadId,
      cliente_nome: carrinho.cliente_nome || "Cliente",
      cliente_telefone: telefone || carrinho.cliente_telefone || "",
      canal,
      tipo_atendimento: carrinho.tipo_atendimento,
      forma_pagamento: carrinho.forma_pagamento || "a_combinar",
      subtotal,
      taxa_entrega: deliveryFee,
      total,
      observacoes: carrinho.observacoes || null,
      origem_publica: {
        canal,
        slug: options.slug || null,
        origem: options.origem || "ia-garcom",
        endereco: carrinho.endereco || null,
      },
    })
    .select("*")
    .single();

  if (pedidoError) throw pedidoError;

  for (const item of itens) {
    const { error: itemError } = await supabase.rpc("registrar_item_pedido_com_custo", {
      p_pedido_id: pedido.id,
      p_company_id: companyId,
      p_produto_id: item.produto_id || null,
      p_produto_nome: item.produto_nome,
      p_quantidade: Number(item.quantidade || 1),
      p_valor_unitario: Number(item.valor_unitario || 0),
      p_observacoes: item.observacoes || null,
    });
    if (itemError) throw itemError;
  }

  if (carrinho.tipo_atendimento === "entrega" && carrinho.endereco) {
    await supabase.from("pedido_enderecos").insert({
      pedido_id: pedido.id,
      company_id: companyId,
      nome_contato: carrinho.cliente_nome || "Cliente",
      telefone_contato: telefone || carrinho.cliente_telefone || null,
      logradouro: carrinho.endereco,
    });

    if (leadId) {
      await supabase.from("leads")
        .update({ endereco_logradouro: carrinho.endereco })
        .eq("id", leadId);
    }
  }

  await supabase.from("pedido_eventos").insert({
    pedido_id: pedido.id,
    company_id: companyId,
    status: "novo",
    descricao: options.origem === "cardapio-digital"
      ? "Pedido criado pelo cardapio digital"
      : `Pedido criado pelo Garcom IA via ${canal}`,
  });

  if (lojaConfig?.impressao_automatica) {
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
      console.error("[criar-pedido] erro ao disparar impressao:", printError);
    }
  }

  if (options.enviarConfirmacaoWhatsapp && telefone) {
    try {
      const itensTexto = itens
        .map((it) => `- ${it.quantidade}x ${it.produto_nome} - R$ ${(Number(it.valor_unitario) * Number(it.quantidade)).toFixed(2)}`)
        .join("\n");
      const tipoAtend = carrinho.tipo_atendimento === "entrega" ? "Entrega" : "Retirada";
      const enderecoLinha = carrinho.endereco ? `\nEndereco: ${carrinho.endereco}` : "";
      const taxaLinha = deliveryFee > 0 ? `\nTaxa de entrega: R$ ${deliveryFee.toFixed(2)}` : "";
      const mensagem = `Pedido confirmado!\n\nOla ${carrinho.cliente_nome || "cliente"}, recebemos seu pedido ${pedido.codigo_pedido} na ${lojaConfig?.nome_loja || "nossa loja"}.\n\nItens:\n${itensTexto}\n\nSubtotal: R$ ${subtotal.toFixed(2)}${taxaLinha}\nTotal: R$ ${total.toFixed(2)}\n\n${tipoAtend}\nPagamento: ${carrinho.forma_pagamento || "a combinar"}${enderecoLinha}`;

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          company_id: companyId,
          numero: telefone,
          mensagem,
          origem: canal,
        }),
      });
    } catch (msgError) {
      console.error("[criar-pedido] erro ao enviar confirmacao WhatsApp:", msgError);
    }
  }

  return pedido;
}

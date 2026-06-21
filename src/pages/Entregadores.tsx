import { useCallback, useEffect, useState } from "react";
import EntregadoresView from "@/components/pedidos/EntregadoresView";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";

type PedidoStatus = "novo" | "aceito" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";

type Pedido = {
  id: string;
  codigo_pedido: string;
  status: PedidoStatus;
  total: number;
  created_at: string;
  entregador_id?: string | null;
  valor_comissao?: number | null;
};

type Entregador = {
  id: string;
  company_id: string;
  nome: string;
  telefone: string | null;
  veiculo: string;
  status: string;
  pct_comissao: number;
  pix_chave: string | null;
  avaliacao_media: number;
  online: boolean;
};

const PEDIDOS_STATUS: PedidoStatus[] = ["novo", "aceito", "em_producao", "pronto", "saiu_entrega", "entregue"];

export default function Entregadores() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const appUrl = `${window.location.origin}/entregador`;

  const loadEntregadores = useCallback(async (cid: string) => {
    const { data, error } = await (supabase.from("entregadores" as any) as any)
      .select("*")
      .eq("company_id", cid)
      .eq("status", "ativo")
      .order("nome");

    if (error) {
      console.error("[Entregadores] erro ao carregar entregadores", error);
      return;
    }

    setEntregadores(data || []);
  }, []);

  const loadPedidos = useCallback(async (cid: string) => {
    const { data, error } = await (supabase.from("pedidos" as any) as any)
      .select("id, codigo_pedido, status, total, created_at, entregador_id, valor_comissao")
      .eq("company_id", cid)
      .in("status", PEDIDOS_STATUS)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Entregadores] erro ao carregar pedidos", error);
      return;
    }

    setPedidos(data || []);
  }, []);

  const load = useCallback(async (cid: string) => {
    await Promise.all([loadEntregadores(cid), loadPedidos(cid)]);
  }, [loadEntregadores, loadPedidos]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cid, error } = await supabase.rpc("get_my_company_id");

      if (error) {
        console.error("[Entregadores] erro ao buscar empresa", error);
      }

      if (!cid) {
        setLoading(false);
        return;
      }

      setCompanyId(cid);
      await load(cid);
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`entregadores-page-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entregadores", filter: `company_id=eq.${companyId}` },
        () => loadEntregadores(companyId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` },
        () => loadPedidos(companyId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadEntregadores, loadPedidos]);

  if (loading) {
    return <div className="flex justify-center py-16">Carregando entregadores...</div>;
  }

  if (!companyId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        Nao foi possivel localizar a empresa para carregar os entregadores.
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-hidden rounded-lg border border-border bg-[#0a0a0f]">
      <div className="border-b border-[#1f1f28] px-5 py-4">
        <h1 className="text-2xl font-bold text-foreground">Entregadores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro e gestao dos entregadores, comissoes, Pix e status operacional.
        </p>
      </div>
      <div className="border-b border-[#1f1f28] bg-[#0d0d16] px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#1a1a2e] p-2 text-[#4ade80]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">App instalavel do entregador</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Envie esta URL para o entregador criar acesso, vincular pelo telefone cadastrado e pegar pedidos prontos.
              </div>
              <div className="mt-2 break-all rounded-md border border-[#1f1f28] bg-[#0a0a0f] px-3 py-2 font-mono text-xs text-[#4ade80]">
                {appUrl}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(appUrl);
                toast.success("Link do app copiado");
              }}
              className="border-[#2a2a3e] bg-[#111118] text-foreground hover:bg-[#1a1a2e]"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar link
            </Button>
            <Button
              type="button"
              onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
              className="bg-[#4ade80] text-[#052e16] hover:bg-[#22c55e]"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir app
            </Button>
          </div>
        </div>
      </div>
      <EntregadoresView
        entregadores={entregadores}
        pedidos={pedidos}
        companyId={companyId}
        onReload={() => load(companyId)}
      />
    </div>
  );
}

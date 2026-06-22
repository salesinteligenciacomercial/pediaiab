import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Package, ImagePlus, Trash2, Edit2 } from 'lucide-react';
import { PizzaTamanhosManager } from '@/components/produtos/PizzaTamanhosManager';
import { PizzaBordasManager } from '@/components/produtos/PizzaBordasManager';
import { supabase } from '@/integrations/supabase/client';

type TipoProduto = 'produto' | 'insumo' | 'combo' | 'adicional';

type Produto = {
  id: string;
  company_id?: string;
  nome: string;
  categoria: string;
  subcategoria: string | null;
  descricao: string | null;
  preco_sugerido: number;
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  imagem_url: string | null;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  estoque_maximo?: number | null;
  unidade_medida: string | null;
  controla_estoque?: boolean;
  custo_unitario?: number | null;
  fornecedor_nome?: string | null;
  fornecedor_contato?: string | null;
  codigo_interno?: string | null;
  grupos: number;
  combo_items: ComboItem[];
  combo_min_selecoes: number | null;
  combo_max_selecoes: number | null;
  promocao_ativa: boolean;
  promocao_preco: number | null;
  promocao_inicio: string | null;
  promocao_fim: string | null;
  promocao_flash: boolean;
  promocao_nota: string | null;
};

type ProdutoForm = {
  nome: string;
  categoria: string;
  subcategoria: string;
  descricao: string;
  preco_sugerido: string;
  margem_pct: string;
  modo_calculo: 'por_margem' | 'manual';
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: string;
  estoque_minimo: string;
  estoque_maximo: string;
  unidade_medida: string;
  controla_estoque: boolean;
  custo_unitario: string;
  fornecedor_nome: string;
  fornecedor_contato: string;
  codigo_interno: string;
  grupos: string;
  combo_items: ComboItem[];
  combo_min_selecoes: string;
  combo_max_selecoes: string;
  promocao_ativa: boolean;
  promocao_preco: string;
  promocao_inicio: string;
  promocao_fim: string;
  promocao_flash: boolean;
  promocao_nota: string;
};

type Opcao = {
  id: number;
  nome: string;
  preco_adicional: number;
  ativo: boolean;
};

type ComboItem = {
  id: string;
  produtoId: string;
  nome: string;
  quantidade: number;
  obrigatorio: boolean;
};

type Movimentacao = {
  id: string;
  company_id: string;
  produto_id: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'perda' | 'producao';
  quantidade: number;
  quantidade_anterior: number | null;
  quantidade_posterior: number | null;
  motivo: string | null;
  pedido_id: string | null;
  custo_unitario: number | null;
  valor_total: number | null;
  observacao: string | null;
  created_at: string;
  produto_nome?: string;
};

type Composicao = {
  id: string;
  produto_id: string;
  insumo_id: string;
  quantidade: number;
  unidade_medida: string;
  insumo_nome?: string;
  insumo_unidade?: string;
};

type AlertaEstoque = {
  id: string;
  produto_id: string;
  tipo: 'abaixo_minimo' | 'zerado' | 'acima_maximo';
  resolvido: boolean;
  created_at: string;
  produto_nome?: string;
};

type CategoryItem = {
  nome: string;
  subcategorias: string[];
};

type ProdutoLucro = {
  produto_id: string;
  produto_nome: string;
  categoria: string | null;
  quantidade_vendida: number;
  receita_total: number;
  custo_total: number;
  lucro_total: number;
  margem_media_pct: number;
};

const PRODUCT_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'produto', label: 'Produtos' },
  { key: 'combo', label: 'Combos' },
  { key: 'adicional', label: 'Adicionais' },
  { key: 'insumo', label: 'Insumos' },
  { key: 'precificacao', label: 'Precificação' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'composicao', label: 'Receitas' },
  { key: 'lucro', label: 'Lucro' },
  { key: 'opcoes', label: 'Opções' },
  { key: 'tamanhos', label: 'Tamanhos' },
  { key: 'bordas', label: 'Bordas' },
];

const CSS = `
:root{--bg:#0f0f11;--surface:#17171a;--surface2:#1e1e22;--surface3:#252529;--border:rgba(255,255,255,0.08);--border-hover:rgba(255,255,255,0.16);--text:#f0f0f0;--text2:#9999aa;--text3:#666677;--accent:#ff6b35;--accent2:#ff9a1e;--accent-dim:rgba(255,107,53,0.12);--radius:14px;--radius-sm:10px;--mono: 'JetBrains Mono', monospace}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{min-height:100%}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,Arial,Helvetica,sans-serif}
.page{padding:28px;max-width:1240px;margin:0 auto}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:24px}
.page-title{font-size:26px;font-weight:700}
.page-sub{color:var(--text2);font-size:14px;margin-top:6px;max-width:680px}
.header-actions{display:flex;gap:10px;flex-wrap:wrap}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px}
.kpi-card{background:var(--surface);border:1px solid var(--border);padding:16px;border-radius:18px;min-height:94px}
.kpi-label{font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.kpi-value{font-size:28px;font-weight:700}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tab-trigger{padding:10px 16px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer}
.tab-trigger[data-state='active']{background:var(--accent);color:#fff;border-color:transparent}
.filter-bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.search-input{width:320px;min-width:220px;max-width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text)}
.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.prod-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 30px rgba(0,0,0,0.12)}
.prod-card.destaque{border-color:var(--accent);box-shadow:0 18px 40px rgba(255,107,53,0.18)}
.prod-image-wrap{position:relative;height:160px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));display:flex;align-items:center;justify-content:center}
.image-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:42px;}
.badge{position:absolute;top:14px;left:14px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(0,0,0,0.45);color:#fff}
.prod-body{padding:18px;display:flex;flex-direction:column;gap:10px}
.prod-name{font-size:18px;font-weight:700}
.prod-category{font-size:12px;color:var(--text3);font-family:var(--mono);letter-spacing:.02em}
.prod-desc{color:var(--text2);font-size:13px;line-height:1.5}
.prod-meta{display:flex;justify-content:space-between;align-items:center;padding:16px;border-top:1px solid rgba(255,255,255,0.06);background:var(--surface2)}
.prod-meta span{font-size:13px;color:var(--text2)}
.toggle{width:36px;height:20px;background:var(--surface3);border-radius:999px;cursor:pointer}
.toggle.on{background:var(--accent)}
.prod-actions{display:flex;gap:10px;padding:16px;border-top:1px solid rgba(255,255,255,0.06);background:var(--surface2)}
.action-btn{flex:1;min-width:0;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer}
.action-btn.danger{border-color:rgba(255,107,53,0.22);color:var(--accent)}
.modal-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:200}
.modal-shell{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:min(760px,95%);max-height:90vh;overflow:auto}
.modal-header{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center}
.modal-title{font-size:18px;font-weight:700}
.modal-body{padding:20px;display:grid;gap:16px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-grid-full{grid-column:span 2}
.form-input,
.form-textarea{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface2);color:var(--text)}
.form-textarea{min-height:110px;resize:vertical}
.image-upload-box{border:1px dashed rgba(255,255,255,0.16);border-radius:16px;padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:rgba(255,255,255,0.03)}
.image-upload-label{font-size:14px;color:var(--text2)}
.empty-state{padding:40px 22px;border-radius:18px;background:var(--surface2);border:1px dashed rgba(255,255,255,0.08);color:var(--text2);text-align:center}
`; 

const mockProducts: Produto[] = [
  { id: '1', nome: 'Pizza Calabresa', categoria: 'Pizzas Tradicionais', subcategoria: 'Salgadas', descricao: 'Molho, mussarela e calabresa', preco_sugerido: 49.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 12, estoque_minimo: 2, unidade_medida: 'un', grupos: 2, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: '2', nome: 'Pizza 4 Queijos', categoria: 'Pizzas Especiais', subcategoria: 'Salgadas', descricao: 'Mussarela, parmesão, catupiry e gorgonzola', preco_sugerido: 62.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 8, estoque_minimo: 1, unidade_medida: 'un', grupos: 2, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: '5', nome: 'Combo Família', categoria: 'Combos', subcategoria: null, descricao: '2 pizzas grandes + 2 refrigerantes 2L', preco_sugerido: 119.9, tipo_produto: 'combo', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: null, estoque_minimo: null, unidade_medida: null, grupos: 0, combo_items: [
      { id: '1', produtoId: '1', nome: 'Pizza Calabresa', quantidade: 1, obrigatorio: true },
      { id: '2', produtoId: '2', nome: 'Pizza 4 Queijos', quantidade: 1, obrigatorio: true }
    ], combo_min_selecoes: 2, combo_max_selecoes: 4, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: '8', nome: 'Farinha de Trigo 5kg', categoria: 'Insumos', subcategoria: null, descricao: 'Farinha tipo 1', preco_sugerido: 0, tipo_produto: 'insumo', ativo: true, ativo_cardapio: false, imagem_url: null, destaque_cardapio: false, permite_observacao: false, estoque_atual: 34, estoque_minimo: 5, unidade_medida: 'kg', grupos: 0, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
];

const mockOptions: Opcao[] = [
  { id: 1, nome: 'Borda recheada', preco_adicional: 7.5, ativo: true },
  { id: 2, nome: 'Extra catupiry', preco_adicional: 5.0, ativo: true },
];

const EMPTY_FORM: ProdutoForm = {
  nome: '',
  categoria: '',
  subcategoria: '',
  descricao: '',
  preco_sugerido: '0',
  margem_pct: '50',
  modo_calculo: 'manual',
  tipo_produto: 'produto',
  ativo: true,
  ativo_cardapio: true,
  destaque_cardapio: false,
  permite_observacao: true,
  estoque_atual: '',
  estoque_minimo: '',
  estoque_maximo: '',
  unidade_medida: '',
  controla_estoque: false,
  custo_unitario: '',
  fornecedor_nome: '',
  fornecedor_contato: '',
  codigo_interno: '',
  grupos: '0',
  combo_items: [],
  combo_min_selecoes: '0',
  combo_max_selecoes: '0',
  promocao_ativa: false,
  promocao_preco: '0',
  promocao_inicio: '',
  promocao_fim: '',
  promocao_flash: false,
  promocao_nota: '',
};

function GestorMargens({ companyId, categorias }: { companyId: string; categorias: string[] }) {
  const [margens, setMargens] = useState<Record<string, number>>({});

  const loadMargens = useCallback(async () => {
    const { data } = await (supabase.from('categoria_margens' as any) as any)
      .select('categoria, margem_padrao_pct')
      .eq('company_id', companyId);
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((item: any) => {
      map[item.categoria] = Number(item.margem_padrao_pct || 0);
    });
    setMargens(map);
  }, [companyId]);

  useEffect(() => {
    void loadMargens();
  }, [loadMargens]);

  const handleSalvar = useCallback(async (categoria: string, valor: number) => {
    const margem = Math.min(95, Math.max(0, Number(valor) || 0));
    const { error } = await (supabase.from('categoria_margens' as any) as any).upsert({
      company_id: companyId,
      categoria,
      margem_padrao_pct: margem,
    }, { onConflict: 'company_id,categoria' });

    if (error) {
      toast.error(`Erro ao salvar margem: ${error.message}`);
      return;
    }
    setMargens((prev) => ({ ...prev, [categoria]: margem }));
    toast.success(`Margem padrao de ${categoria} atualizada`);
  }, [companyId]);

  if (!categorias.length) {
    return <div className="empty-state">Cadastre categorias para configurar margens padrao.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {categorias.map((categoria) => (
        <div key={categoria} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13 }}>{categoria}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min="0"
              max="95"
              defaultValue={margens[categoria] ?? 50}
              onBlur={(event) => void handleSalvar(categoria, Number(event.target.value))}
              style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface3)', color: 'var(--text)', textAlign: 'right' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [tipoTab, setTipoTab] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoForm>({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const [opcoes, setOpcoes] = useState<Opcao[]>(mockOptions);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Opcao | null>(null);
  const [optionForm, setOptionForm] = useState({ nome: '', preco_adicional: '0', ativo: true });

  const [comboProductId, setComboProductId] = useState<string>('');
  const [comboProductQty, setComboProductQty] = useState('1');
  const [comboProductObrigatorio, setComboProductObrigatorio] = useState(true);

  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [alertas, setAlertas] = useState<AlertaEstoque[]>([]);
  const [modalMovOpen, setModalMovOpen] = useState(false);
  const [produtoMovendo, setProdutoMovendo] = useState<Produto | null>(null);
  const [movForm, setMovForm] = useState({ tipo: 'entrada', quantidade: '', motivo: 'compra', custo_unitario: '', observacao: '' });
  const [loadingMov, setLoadingMov] = useState(false);
  const [filtroMovProduto, setFiltroMovProduto] = useState<string>('');
  const [periodoMov, setPeriodoMov] = useState<'hoje' | 'semana' | 'mes'>('semana');
  const [produtoReceita, setProdutoReceita] = useState<string>('');
  const [composicoesProduto, setComposicoesProduto] = useState<Composicao[]>([]);
  const [novoInsumo, setNovoInsumo] = useState({ insumo_id: '', quantidade: '', unidade_medida: 'un' });
  const [periodoLucro, setPeriodoLucro] = useState<'hoje' | 'semana' | 'mes' | 'tudo'>('mes');
  const [produtosLucro, setProdutosLucro] = useState<ProdutoLucro[]>([]);
  const [loadingLucro, setLoadingLucro] = useState(false);

  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [subcategoryParent, setSubcategoryParent] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');

  const normalizeProduto = useCallback((p: any): Produto => ({
    ...p,
    preco_sugerido: Number(p.preco_sugerido || 0),
    estoque_atual: p.estoque_atual == null ? null : Number(p.estoque_atual),
    estoque_minimo: p.estoque_minimo == null ? null : Number(p.estoque_minimo),
    estoque_maximo: p.estoque_maximo == null ? null : Number(p.estoque_maximo),
    custo_unitario: p.custo_unitario == null ? null : Number(p.custo_unitario),
    grupos: Number(p.grupos || 0),
    combo_items: Array.isArray(p.combo_items) ? p.combo_items : [],
    combo_min_selecoes: p.combo_min_selecoes == null ? null : Number(p.combo_min_selecoes),
    combo_max_selecoes: p.combo_max_selecoes == null ? null : Number(p.combo_max_selecoes),
    promocao_preco: p.promocao_preco == null ? null : Number(p.promocao_preco),
  }), []);

  const loadProdutos = useCallback(async (cid: string) => {
    setLoadingProdutos(true);
    const { data, error } = await (supabase.from('produtos_servicos' as any) as any)
      .select('*')
      .eq('company_id', cid)
      .order('nome');

    if (error) {
      console.error('[Produtos] erro ao carregar produtos', error);
      toast.error('Erro ao carregar produtos');
    } else {
      setProdutos((data || []).map(normalizeProduto));
    }
    setLoadingProdutos(false);
  }, [normalizeProduto]);

  const loadMovimentacoes = useCallback(async (cid: string) => {
    const desde = periodoMov === 'hoje'
      ? new Date().toISOString().slice(0, 10)
      : periodoMov === 'semana'
        ? new Date(Date.now() - 7 * 864e5).toISOString()
        : new Date(Date.now() - 30 * 864e5).toISOString();

    let query = (supabase.from('estoque_movimentacoes' as any) as any)
      .select('*, produtos_servicos(nome, unidade_medida)')
      .eq('company_id', cid)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filtroMovProduto) query = query.eq('produto_id', filtroMovProduto);
    const { data } = await query;
    if (data) {
      setMovimentacoes(data.map((m: any) => ({
        ...m,
        quantidade: Number(m.quantidade || 0),
        quantidade_anterior: m.quantidade_anterior == null ? null : Number(m.quantidade_anterior),
        quantidade_posterior: m.quantidade_posterior == null ? null : Number(m.quantidade_posterior),
        custo_unitario: m.custo_unitario == null ? null : Number(m.custo_unitario),
        valor_total: m.valor_total == null ? null : Number(m.valor_total),
        produto_nome: m.produtos_servicos?.nome,
      })));
    }
  }, [periodoMov, filtroMovProduto]);

  const loadAlertas = useCallback(async (cid: string) => {
    const { data } = await (supabase.from('estoque_alertas' as any) as any)
      .select('*, produtos_servicos(nome)')
      .eq('company_id', cid)
      .eq('resolvido', false)
      .order('created_at', { ascending: false });
    if (data) setAlertas(data.map((a: any) => ({ ...a, produto_nome: a.produtos_servicos?.nome })));
  }, []);

  const loadLucroPorProduto = useCallback(async (cid: string) => {
    setLoadingLucro(true);
    const desde = periodoLucro === 'hoje'
      ? new Date().toISOString().slice(0, 10)
      : periodoLucro === 'semana'
        ? new Date(Date.now() - 7 * 864e5).toISOString()
        : periodoLucro === 'mes'
          ? new Date(Date.now() - 30 * 864e5).toISOString()
          : new Date(0).toISOString();

    const { data, error } = await (supabase.from('pedido_itens' as any) as any)
      .select('produto_id, produto_nome, quantidade, valor_total, custo_total_momento, lucro_item, produtos_servicos(categoria)')
      .eq('company_id', cid)
      .gte('created_at', desde)
      .not('lucro_item', 'is', null);

    if (error) {
      console.error('[Produtos] erro ao carregar lucro por produto', error);
      toast.error('Erro ao carregar lucro por produto');
      setLoadingLucro(false);
      return;
    }

    const agrupado = new Map<string, ProdutoLucro>();
    (data || []).forEach((item: any) => {
      const key = item.produto_id || item.produto_nome;
      const atual = agrupado.get(key) || {
        produto_id: key,
        produto_nome: item.produto_nome,
        categoria: item.produtos_servicos?.categoria || null,
        quantidade_vendida: 0,
        receita_total: 0,
        custo_total: 0,
        lucro_total: 0,
        margem_media_pct: 0,
      };
      atual.quantidade_vendida += Number(item.quantidade || 0);
      atual.receita_total += Number(item.valor_total || 0);
      atual.custo_total += Number(item.custo_total_momento || 0);
      atual.lucro_total += Number(item.lucro_item || 0);
      agrupado.set(key, atual);
    });

    const lista = Array.from(agrupado.values()).map((produto) => ({
      ...produto,
      margem_media_pct: produto.receita_total > 0 ? (produto.lucro_total / produto.receita_total) * 100 : 0,
    }));
    lista.sort((a, b) => b.lucro_total - a.lucro_total);
    setProdutosLucro(lista);
    setLoadingLucro(false);
  }, [periodoLucro]);

  const verificarAlertas = useCallback(async (cid: string) => {
    const { data: criticos } = await (supabase.from('produtos_servicos' as any) as any)
      .select('id, nome, estoque_atual, estoque_minimo')
      .eq('company_id', cid)
      .eq('controla_estoque', true)
      .not('estoque_minimo', 'is', null);

    for (const p of (criticos || [])) {
      const atual = Number(p.estoque_atual || 0);
      const minimo = Number(p.estoque_minimo || 0);
      if (atual === 0) {
        await (supabase.from('estoque_alertas' as any) as any).upsert({
          company_id: cid, produto_id: p.id, tipo: 'zerado', resolvido: false
        }, { onConflict: 'produto_id,tipo', ignoreDuplicates: true });
      } else if (atual <= minimo) {
        await (supabase.from('estoque_alertas' as any) as any).upsert({
          company_id: cid, produto_id: p.id, tipo: 'abaixo_minimo', resolvido: false
        }, { onConflict: 'produto_id,tipo', ignoreDuplicates: true });
      }
    }
    await loadAlertas(cid);
  }, [loadAlertas]);

  const filteredProdutos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const specialTabs = ['opcoes', 'tamanhos', 'bordas', 'estoque', 'composicao', 'lucro', 'precificacao'];
    if (specialTabs.includes(tipoTab)) return [];
    return produtos.filter((p) => {
      const byType = tipoTab === 'todos' ? true : p.tipo_produto === tipoTab;
      const bySearch = !q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || (p.subcategoria || '').toLowerCase().includes(q);
      return byType && bySearch;
    });
  }, [produtos, deferredSearch, tipoTab]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    produtos.forEach((p) => {
      const cat = p.categoria?.trim();
      if (!cat) return;
      if (!map.has(cat)) map.set(cat, new Set());
      const sub = p.subcategoria?.trim();
      if (sub) map.get(cat)?.add(sub);
    });
    categoryItems.forEach((item) => {
      if (!map.has(item.nome)) map.set(item.nome, new Set());
      item.subcategorias.forEach((sub) => {
        if (sub) map.get(item.nome)?.add(sub);
      });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nome, subSet]) => ({ nome, subcategorias: Array.from(subSet).sort((a, b) => a.localeCompare(b)) }));
  }, [produtos, categoryItems]);

  useEffect(() => {
    (async () => {
      const { data: cid, error } = await supabase.rpc('get_my_company_id');
      if (error || !cid) {
        setLoadingProdutos(false);
        toast.error('NÃ£o foi possÃ­vel identificar a empresa');
        return;
      }
      setCompanyId(cid);
      await loadProdutos(cid);
      await loadMovimentacoes(cid);
      await loadAlertas(cid);
    })();
  }, [loadProdutos, loadMovimentacoes, loadAlertas]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`produtos-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos_servicos', filter: `company_id=eq.${companyId}` }, () => loadProdutos(companyId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_movimentacoes', filter: `company_id=eq.${companyId}` }, () => loadMovimentacoes(companyId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_alertas', filter: `company_id=eq.${companyId}` }, () => loadAlertas(companyId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, loadProdutos, loadMovimentacoes, loadAlertas]);

  useEffect(() => {
    if (companyId) loadMovimentacoes(companyId);
  }, [companyId, loadMovimentacoes]);

  useEffect(() => {
    if (companyId && tipoTab === 'lucro') loadLucroPorProduto(companyId);
  }, [companyId, tipoTab, loadLucroPorProduto]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(editing?.imagem_url ?? '');
    }
  }, [editing, imageFile]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleOpenCreate = useCallback((tipo: TipoProduto) => {
    setEditing(null);
    setFormData({ ...EMPTY_FORM, tipo_produto: tipo, controla_estoque: tipo === 'insumo', unidade_medida: tipo === 'insumo' ? 'kg' : 'un', margem_pct: '50', modo_calculo: 'por_margem' });
    setComboProductId('');
    setComboProductQty('1');
    setComboProductObrigatorio(true);
    setImageFile(null);
    setImagePreview('');
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((produto: Produto) => {
    setEditing(produto);
    setFormData({
      nome: produto.nome,
      categoria: produto.categoria,
      subcategoria: produto.subcategoria ?? '',
      descricao: produto.descricao ?? '',
      preco_sugerido: produto.preco_sugerido.toString(),
      margem_pct: produto.preco_sugerido > 0 && produto.custo_unitario != null
        ? (((produto.preco_sugerido - produto.custo_unitario) / produto.preco_sugerido) * 100).toFixed(1)
        : '50',
      modo_calculo: 'manual',
      tipo_produto: produto.tipo_produto,
      ativo: produto.ativo,
      ativo_cardapio: produto.ativo_cardapio,
      destaque_cardapio: produto.destaque_cardapio,
      permite_observacao: produto.permite_observacao,
      estoque_atual: produto.estoque_atual?.toString() ?? '',
      estoque_minimo: produto.estoque_minimo?.toString() ?? '',
      estoque_maximo: produto.estoque_maximo?.toString() ?? '',
      unidade_medida: produto.unidade_medida ?? 'un',
      controla_estoque: !!produto.controla_estoque,
      custo_unitario: produto.custo_unitario?.toString() ?? '',
      fornecedor_nome: produto.fornecedor_nome ?? '',
      fornecedor_contato: produto.fornecedor_contato ?? '',
      codigo_interno: produto.codigo_interno ?? '',
      grupos: produto.grupos.toString(),
      combo_items: produto.combo_items ?? [],
      combo_min_selecoes: produto.combo_min_selecoes?.toString() ?? '0',
      combo_max_selecoes: produto.combo_max_selecoes?.toString() ?? '0',
      promocao_ativa: produto.promocao_ativa,
      promocao_preco: produto.promocao_preco?.toString() ?? '0',
      promocao_inicio: produto.promocao_inicio ?? '',
      promocao_fim: produto.promocao_fim ?? '',
      promocao_flash: produto.promocao_flash,
      promocao_nota: produto.promocao_nota ?? '',
    });
    setImageFile(null);
    setImagePreview(produto.imagem_url ?? '');
    setDialogOpen(true);
  }, []);

  const handleOpenOptionCreate = useCallback(() => {
    setEditingOption(null);
    setOptionForm({ nome: '', preco_adicional: '0', ativo: true });
    setOptionDialogOpen(true);
  }, []);

  const handleOpenEditOption = useCallback((option: Opcao) => {
    setEditingOption(option);
    setOptionForm({ nome: option.nome, preco_adicional: option.preco_adicional.toString(), ativo: option.ativo });
    setOptionDialogOpen(true);
  }, []);

  const handleAddComboItem = useCallback(() => {
    const selected = produtos.find((p) => p.id === comboProductId && p.tipo_produto !== 'combo');
    if (!selected) {
      toast.error('Selecione um produto válido para o combo');
      return;
    }
    if (formData.combo_items.some((item) => item.produtoId === selected.id)) {
      toast.error('Produto já adicionado ao combo');
      return;
    }
    const quantidade = Number(comboProductQty) || 1;
    const item: ComboItem = {
      id: String(Date.now()),
      produtoId: selected.id,
      nome: selected.nome,
      quantidade,
      obrigatorio: comboProductObrigatorio,
    };
    setFormData((prev) => ({
      ...prev,
      combo_items: [...prev.combo_items, item],
    }));
    setComboProductId('');
    setComboProductQty('1');
    setComboProductObrigatorio(true);
  }, [comboProductId, comboProductQty, comboProductObrigatorio, formData.combo_items, produtos]);

  const handleRemoveComboItem = useCallback((itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      combo_items: prev.combo_items.filter((item) => item.id !== itemId),
    }));
  }, []);

  const handleSaveOption = useCallback(() => {
    if (!optionForm.nome.trim()) {
      toast.error('Nome da opção é obrigatório');
      return;
    }
    const preco = Number(optionForm.preco_adicional);
    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Preço da opção deve ser zero ou maior');
      return;
    }
    const option: Opcao = {
      id: editingOption?.id ?? Date.now(),
      nome: optionForm.nome.trim(),
      preco_adicional: preco,
      ativo: optionForm.ativo,
    };
    setOpcoes((prev) => {
      if (editingOption) {
        return prev.map((opt) => (opt.id === editingOption.id ? option : opt));
      }
      return [option, ...prev];
    });
    setOptionDialogOpen(false);
    setEditingOption(null);
    toast.success('Opção salva com sucesso');
  }, [editingOption, optionForm]);

  const handleDeleteOption = useCallback((optionId: number) => {
    setOpcoes((prev) => prev.filter((opt) => opt.id !== optionId));
    toast.success('Opção removida');
  }, []);

  const revokePreview = useCallback(() => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleImageChange = useCallback((file: File | null) => {
    revokePreview();
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(editing?.imagem_url ?? '');
    }
  }, [editing, revokePreview]);

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadProductImage = useCallback(async (): Promise<string | null> => {
    if (!imageFile) {
      return editing?.imagem_url ?? null;
    }
    return await fileToDataUrl(imageFile);
  }, [editing, fileToDataUrl, imageFile]);

  const handleSave = useCallback(async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const preco = Number(formData.preco_sugerido);
    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Preço não pode ser negativo');
      return;
    }

    const imagem_url = await uploadProductImage();
    const produto: Produto = {
      id: editing?.id ?? String(Date.now()),
      nome: formData.nome.trim(),
      categoria: formData.categoria.trim(),
      subcategoria: formData.subcategoria.trim() || null,
      descricao: formData.descricao.trim() || null,
      preco_sugerido: preco,
      tipo_produto: formData.tipo_produto,
      ativo: formData.ativo,
      ativo_cardapio: formData.ativo_cardapio,
      imagem_url,
      destaque_cardapio: formData.destaque_cardapio,
      permite_observacao: formData.permite_observacao,
      estoque_atual: formData.estoque_atual.trim() ? Number(formData.estoque_atual) : null,
      estoque_minimo: formData.estoque_minimo.trim() ? Number(formData.estoque_minimo) : null,
      unidade_medida: formData.unidade_medida.trim() || null,
      grupos: Number(formData.grupos) || 0,
      combo_items: formData.tipo_produto === 'combo' ? formData.combo_items : [],
      combo_min_selecoes: formData.tipo_produto === 'combo' ? (Number(formData.combo_min_selecoes) || null) : null,
      combo_max_selecoes: formData.tipo_produto === 'combo' ? (Number(formData.combo_max_selecoes) || null) : null,
      promocao_ativa: formData.promocao_ativa,
      promocao_preco: formData.promocao_preco.trim() ? Number(formData.promocao_preco) : null,
      promocao_inicio: formData.promocao_inicio.trim() || null,
      promocao_fim: formData.promocao_fim.trim() || null,
      promocao_flash: formData.promocao_flash,
      promocao_nota: formData.promocao_nota.trim() || null,
    };

    setProdutos((prev) => {
      if (editing) {
        return prev.map((p) => (p.id === editing.id ? produto : p));
      }
      return [produto, ...prev];
    });
    setDialogOpen(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview('');
    toast.success('Produto salvo com sucesso');
  }, [editing, formData, uploadProductImage]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setProdutos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('Produto excluído');
  }, [deleteTarget]);

  const handleSaveSupabase = useCallback(async () => {
    if (!companyId) {
      toast.error('Empresa nao carregada');
      return;
    }
    if (!formData.nome.trim()) {
      toast.error('Nome e obrigatorio');
      return;
    }
    const preco = Number(formData.preco_sugerido);
    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Preco nao pode ser negativo');
      return;
    }

    const imagem_url = await uploadProductImage();
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      company_id: companyId,
      nome: formData.nome.trim(),
      categoria: formData.categoria.trim(),
      subcategoria: formData.subcategoria.trim() || null,
      descricao: formData.descricao.trim() || null,
      preco_sugerido: preco,
      tipo_produto: formData.tipo_produto,
      ativo: formData.ativo,
      ativo_cardapio: formData.ativo_cardapio,
      imagem_url,
      destaque_cardapio: formData.destaque_cardapio,
      permite_observacao: formData.permite_observacao,
      controla_estoque: formData.controla_estoque,
      estoque_atual: formData.estoque_atual.trim() ? Number(formData.estoque_atual) : null,
      estoque_minimo: formData.estoque_minimo.trim() ? Number(formData.estoque_minimo) : null,
      estoque_maximo: formData.estoque_maximo.trim() ? Number(formData.estoque_maximo) : null,
      unidade_medida: formData.unidade_medida.trim() || 'un',
      custo_unitario: formData.custo_unitario.trim() ? Number(formData.custo_unitario) : null,
      fornecedor_nome: formData.fornecedor_nome.trim() || null,
      fornecedor_contato: formData.fornecedor_contato.trim() || null,
      codigo_interno: formData.codigo_interno.trim() || null,
      combo_min_selecoes: formData.tipo_produto === 'combo' ? (Number(formData.combo_min_selecoes) || null) : null,
      combo_max_selecoes: formData.tipo_produto === 'combo' ? (Number(formData.combo_max_selecoes) || null) : null,
      promocao_ativa: formData.promocao_ativa,
      promocao_preco: formData.promocao_preco.trim() ? Number(formData.promocao_preco) : null,
      promocao_inicio: formData.promocao_inicio.trim() || null,
      promocao_fim: formData.promocao_fim.trim() || null,
      promocao_flash: formData.promocao_flash,
      promocao_nota: formData.promocao_nota.trim() || null,
    };

    const { error } = await (supabase.from('produtos_servicos' as any) as any).upsert(payload);
    if (error) {
      console.error('[Produtos] erro ao salvar', error);
      toast.error(`Erro ao salvar produto: ${error.message}`);
      return;
    }

    await loadProdutos(companyId);
    setDialogOpen(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview('');
    toast.success('Produto salvo com sucesso');
  }, [companyId, editing, formData, loadProdutos, uploadProductImage]);

  const confirmDeleteSupabase = useCallback(async () => {
    if (!deleteTarget || !companyId) return;
    const { error } = await (supabase.from('produtos_servicos' as any) as any)
      .delete()
      .eq('id', deleteTarget.id)
      .eq('company_id', companyId);
    if (error) {
      toast.error(`Erro ao excluir produto: ${error.message}`);
      return;
    }
    await loadProdutos(companyId);
    setDeleteTarget(null);
    toast.success('Produto excluido');
  }, [companyId, deleteTarget, loadProdutos]);

  const handleToggleProduto = useCallback(async (produto: Produto, field: 'ativo' | 'ativo_cardapio') => {
    if (!companyId) return;
    const nextValue = !produto[field];
    setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, [field]: nextValue } : p));
    const { error } = await (supabase.from('produtos_servicos' as any) as any)
      .update({ [field]: nextValue })
      .eq('id', produto.id)
      .eq('company_id', companyId);
    if (error) {
      toast.error('Erro ao atualizar produto');
      await loadProdutos(companyId);
    }
  }, [companyId, loadProdutos]);

  const abrirMovimentacao = useCallback((produto: Produto, tipo = 'entrada') => {
    setProdutoMovendo(produto);
    setMovForm({ tipo, quantidade: '', motivo: tipo === 'entrada' ? 'compra' : 'venda', custo_unitario: produto.custo_unitario?.toString() ?? '', observacao: '' });
    setModalMovOpen(true);
  }, []);

  const handleRegistrarMovimentacao = useCallback(async () => {
    if (!produtoMovendo || !companyId || !movForm.quantidade) return;
    setLoadingMov(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.rpc('registrar_movimentacao_estoque' as any, {
      p_company_id: companyId,
      p_produto_id: produtoMovendo.id,
      p_tipo: movForm.tipo,
      p_quantidade: Number(movForm.quantidade),
      p_motivo: movForm.motivo || null,
      p_pedido_id: null,
      p_custo: movForm.custo_unitario ? Number(movForm.custo_unitario) : null,
      p_observacao: movForm.observacao || null,
      p_criado_por: userData.user?.id || null,
    });

    if (error) {
      toast.error(`Erro ao registrar movimentacao: ${error.message}`);
    } else {
      toast.success('Movimentacao registrada e estoque atualizado');
      setModalMovOpen(false);
      setMovForm({ tipo: 'entrada', quantidade: '', motivo: 'compra', custo_unitario: '', observacao: '' });
      await loadProdutos(companyId);
      await loadMovimentacoes(companyId);
      await verificarAlertas(companyId);
    }
    setLoadingMov(false);
  }, [companyId, loadMovimentacoes, loadProdutos, movForm, produtoMovendo, verificarAlertas]);

  const loadComposicoes = useCallback(async (produtoId: string) => {
    const { data } = await (supabase.from('produto_composicoes' as any) as any)
      .select('*, insumo:insumo_id(nome, unidade_medida)')
      .eq('produto_id', produtoId);
    if (data) {
      setComposicoesProduto(data.map((c: any) => ({
        ...c,
        quantidade: Number(c.quantidade || 0),
        insumo_nome: c.insumo?.nome,
        insumo_unidade: c.insumo?.unidade_medida,
      })));
    }
  }, []);

  const handleSalvarComposicao = useCallback(async () => {
    if (!produtoReceita || !novoInsumo.insumo_id || !novoInsumo.quantidade || !companyId) return;
    const { error } = await (supabase.from('produto_composicoes' as any) as any).upsert({
      company_id: companyId,
      produto_id: produtoReceita,
      insumo_id: novoInsumo.insumo_id,
      quantidade: Number(novoInsumo.quantidade),
      unidade_medida: novoInsumo.unidade_medida || 'un',
    }, { onConflict: 'produto_id,insumo_id' });
    if (error) {
      toast.error(`Erro ao salvar receita: ${error.message}`);
      return;
    }
    toast.success('Receita salva');
    setNovoInsumo({ insumo_id: '', quantidade: '', unidade_medida: 'un' });
    await loadComposicoes(produtoReceita);
  }, [companyId, loadComposicoes, novoInsumo, produtoReceita]);

  const handleRemoverComposicao = useCallback(async (id: string) => {
    if (!produtoReceita) return;
    await (supabase.from('produto_composicoes' as any) as any).delete().eq('id', id);
    await loadComposicoes(produtoReceita);
    toast.success('Insumo removido da receita');
  }, [loadComposicoes, produtoReceita]);

  useEffect(() => {
    if (produtoReceita) loadComposicoes(produtoReceita);
    else setComposicoesProduto([]);
  }, [loadComposicoes, produtoReceita]);

  const estoqueProdutos = useMemo(() => produtos.filter((p) => p.controla_estoque), [produtos]);
  const estoqueBaixo = useMemo(() => estoqueProdutos.filter((p) => (p.estoque_atual ?? 0) > 0 && p.estoque_minimo != null && (p.estoque_atual ?? 0) <= p.estoque_minimo), [estoqueProdutos]);
  const estoqueZerado = useMemo(() => estoqueProdutos.filter((p) => (p.estoque_atual ?? 0) === 0), [estoqueProdutos]);
  const estoqueOk = useMemo(() => estoqueProdutos.filter((p) => (p.estoque_atual ?? 0) > (p.estoque_minimo ?? -1)), [estoqueProdutos]);
  const custoTotalEstoque = useMemo(() => estoqueProdutos.reduce((total, p) => total + ((p.estoque_atual ?? 0) * (p.custo_unitario ?? 0)), 0), [estoqueProdutos]);
  const produtosReceitaOptions = useMemo(() => produtos.filter((p) => p.tipo_produto === 'produto' || p.tipo_produto === 'combo'), [produtos]);
  const insumosOptions = useMemo(() => produtos.filter((p) => p.tipo_produto === 'insumo' || p.controla_estoque), [produtos]);
  const curvaABC = useMemo(() => {
    if (produtosLucro.length === 0) return [];
    const totalLucro = produtosLucro.reduce((total, produto) => total + Math.max(produto.lucro_total, 0), 0);
    if (totalLucro === 0) {
      return produtosLucro.map((produto) => ({ ...produto, classe: 'C' as const, percentualAcumulado: 0 }));
    }

    let acumulado = 0;
    return produtosLucro
      .slice()
      .sort((a, b) => b.lucro_total - a.lucro_total)
      .map((produto) => {
        acumulado += Math.max(produto.lucro_total, 0);
        const percentualAcumulado = (acumulado / totalLucro) * 100;
        const classe = percentualAcumulado <= 80 ? 'A' : percentualAcumulado <= 95 ? 'B' : 'C';
        return { ...produto, classe, percentualAcumulado };
      });
  }, [produtosLucro]);

  const calcularPrecoPorMargem = useCallback((custo: number, margemPct: number): number => {
    if (margemPct >= 100) return 0;
    return custo / (1 - margemPct / 100);
  }, []);

  const calcularMargemPorPreco = useCallback((custo: number, preco: number): number => {
    if (preco <= 0) return 0;
    return ((preco - custo) / preco) * 100;
  }, []);

  const handleCustoChange = useCallback((valor: string) => {
    setFormData((prev) => {
      const custo = Number(valor) || 0;
      if (prev.modo_calculo === 'por_margem' && prev.margem_pct) {
        const precoSugerido = calcularPrecoPorMargem(custo, Number(prev.margem_pct));
        return { ...prev, custo_unitario: valor, preco_sugerido: precoSugerido.toFixed(2) };
      }
      const preco = Number(prev.preco_sugerido) || 0;
      return { ...prev, custo_unitario: valor, margem_pct: calcularMargemPorPreco(custo, preco).toFixed(1) };
    });
  }, [calcularMargemPorPreco, calcularPrecoPorMargem]);

  const handleMargemChange = useCallback((valor: string) => {
    setFormData((prev) => {
      const margem = Number(valor) || 0;
      const custo = Number(prev.custo_unitario) || 0;
      const precoSugerido = calcularPrecoPorMargem(custo, margem);
      return { ...prev, margem_pct: valor, modo_calculo: 'por_margem', preco_sugerido: precoSugerido.toFixed(2) };
    });
  }, [calcularPrecoPorMargem]);

  const handlePrecoManualChange = useCallback((valor: string) => {
    setFormData((prev) => {
      const preco = Number(valor) || 0;
      const custo = Number(prev.custo_unitario) || 0;
      const margemCalculada = calcularMargemPorPreco(custo, preco);
      return { ...prev, preco_sugerido: valor, modo_calculo: 'manual', margem_pct: margemCalculada.toFixed(1) };
    });
  }, [calcularMargemPorPreco]);

  const aplicarMargemPadraoCategoria = useCallback(async (categoria: string) => {
    if (!companyId || !categoria) return;
    const { data } = await (supabase.from('categoria_margens' as any) as any)
      .select('margem_padrao_pct')
      .eq('company_id', companyId)
      .eq('categoria', categoria)
      .maybeSingle();

    if (data?.margem_padrao_pct) {
      setFormData((prev) => {
        const margem = String(data.margem_padrao_pct);
        const custo = Number(prev.custo_unitario) || 0;
        const precoSugerido = calcularPrecoPorMargem(custo, Number(margem));
        return { ...prev, margem_pct: margem, modo_calculo: 'por_margem', preco_sugerido: custo > 0 ? precoSugerido.toFixed(2) : prev.preco_sugerido };
      });
    }
  }, [calcularPrecoPorMargem, companyId]);

  const onChangeForm = useCallback((key: keyof ProdutoForm, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="page">
      <style>{CSS}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Produtos</div>
          <div className="page-sub">Cadastre pizzas, bebidas, combos, adicionais e insumos com visual moderno e controles fechados.</div>
        </div>
        <div className="header-actions">
          <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>📂 Categorias</Button>
          <Button variant="secondary" onClick={() => handleOpenCreate('insumo')}>🍳 Novo Insumo</Button>
          <Button variant="outline" onClick={() => handleOpenCreate('combo')}>🎁 Novo Combo</Button>
          <Button variant="secondary" onClick={() => handleOpenCreate('adicional')}>＋ Novo Adicional</Button>
          <Button onClick={() => handleOpenCreate('produto')}>＋ Novo Produto</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total de itens</div><div className="kpi-value">{produtos.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">No cardápio</div><div className="kpi-value">{produtos.filter((p) => p.ativo_cardapio).length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Promoções ativas</div><div className="kpi-value">{produtos.filter((p) => p.promocao_ativa && p.promocao_preco != null && (() => {
              const now = Date.now();
              const start = p.promocao_inicio ? Date.parse(p.promocao_inicio) : null;
              const end = p.promocao_fim ? Date.parse(p.promocao_fim) : null;
              return (!start || now >= start) && (!end || now <= end);
            })()).length}</div></div>
      </div>

      <Tabs value={tipoTab} onValueChange={setTipoTab}>
        <TabsList className="tabs">
          {PRODUCT_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="tab-trigger">{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <div className="filter-bar">
          <Input placeholder="Buscar por nome, categoria..." value={search} onChange={(event) => setSearch(event.target.value)} className="search-input" />
          <Button variant="outline" onClick={() => setSearch('')}>Limpar</Button>
        </div>

        <TabsContent value="todos">
          {filteredProdutos.length ? (
            <div className="product-grid">
              {filteredProdutos.map((produto) => (
                <div className={`prod-card ${produto.destaque_cardapio ? 'destaque' : ''}`} key={produto.id}>
                  <div className="prod-image-wrap">
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    ) : (
                      <div className="image-placeholder"><Package size={42} /></div>
                    )}
                    <span className="badge">{produto.tipo_produto}</span>
                  </div>
                  <div className="prod-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="prod-name">{produto.nome}</div>
                      {produto.destaque_cardapio && <span className="badge" style={{ top: 14, right: 14, left: 'auto', background: 'var(--accent)', position: 'absolute' }}>DESTAQUE</span>}
                    </div>
                    <div className="prod-category">{[produto.categoria, produto.subcategoria].filter(Boolean).join(' / ')}</div>
                    {produto.descricao && <div className="prod-desc">{produto.descricao}</div>}
                    {produto.controla_estoque && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '8px 10px', borderRadius: 10,
                        background: produto.estoque_atual === 0 ? 'rgba(239,68,68,0.12)' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'rgba(245,166,35,0.12)' : 'rgba(46,204,143,0.08)',
                        border: `1px solid ${produto.estoque_atual === 0 ? 'rgba(239,68,68,0.3)' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'rgba(245,166,35,0.3)' : 'rgba(46,204,143,0.2)'}`,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: produto.estoque_atual === 0 ? '#EF4444' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? '#F5A623' : '#2ECC8F' }}>
                          {produto.estoque_atual === 0 ? 'ZERADO' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'Estoque baixo' : 'Em estoque'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                          {produto.estoque_atual ?? 0} {produto.unidade_medida ?? 'un'}{produto.estoque_minimo != null ? ` / min ${produto.estoque_minimo}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="prod-meta">
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                      <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                        <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => handleToggleProduto(produto, 'ativo')} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                        <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => handleToggleProduto(produto, 'ativo_cardapio')} />
                      </div>
                    </div>
                  </div>
                  <div className="prod-actions">
                    {produto.controla_estoque && <button className="action-btn" type="button" onClick={() => abrirMovimentacao(produto)}>Entrada / saida</button>}
                    <button className="action-btn" type="button" onClick={() => handleOpenEdit(produto)}><Edit2 size={16} /> Editar</button>
                    <button className="action-btn" type="button" onClick={() => setDeleteTarget(produto)}><Trash2 size={16} /> Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Nenhum produto encontrado para esta seleção.</div>
          )}
        </TabsContent>

        <TabsContent value="precificacao">
          {produtos.length ? (
            <div className="product-grid">
              {produtos.map((produto) => {
                const custo = produto.custo_unitario ?? 0;
                const preco = produto.preco_sugerido ?? 0;
                const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
                return (
                  <div className={`prod-card ${produto.destaque_cardapio ? 'destaque' : ''}`} key={produto.id}>
                    <div className="prod-image-wrap">
                      {produto.imagem_url ? (
                        <img src={produto.imagem_url} alt={produto.nome} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      ) : (
                        <div className="image-placeholder"><Package size={42} /></div>
                      )}
                      <span className="badge">{produto.tipo_produto}</span>
                    </div>
                    <div className="prod-body">
                      <div className="prod-name">{produto.nome}</div>
                      <div className="prod-category">{[produto.categoria, produto.subcategoria].filter(Boolean).join(' / ')}</div>
                      {produto.descricao && <div className="prod-desc">{produto.descricao}</div>}
                    </div>
                    <div className="prod-meta">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{preco > 0 ? preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                        <span>{custo > 0 ? `Custo: ${custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Custo não informado'}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>Margem</div>
                        <div style={{ fontWeight: 700, color: margem >= 30 ? '#2ECC8F' : '#F5A623' }}>{preco > 0 ? `${margem.toFixed(1)}%` : '—'}</div>
                      </div>
                    </div>
                    <div className="prod-actions">
                      {produto.controla_estoque && <button className="action-btn" type="button" onClick={() => abrirMovimentacao(produto)}>Entrada / saida</button>}
                      <button className="action-btn" type="button" onClick={() => handleOpenEdit(produto)}><Edit2 size={16} /> Editar</button>
                      <button className="action-btn" type="button" onClick={() => setDeleteTarget(produto)}><Trash2 size={16} /> Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">Nenhum produto encontrado para esta seleção.</div>
          )}
        </TabsContent>

        {PRODUCT_TABS.filter((tab) => !['todos', 'precificacao', 'opcoes', 'tamanhos', 'bordas', 'estoque', 'composicao', 'lucro'].includes(tab.key)).map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            {filteredProdutos.length ? (
              <div className="product-grid">
                {filteredProdutos.map((produto) => (
                  <div className="prod-card" key={produto.id}>
                    <div className="prod-image-wrap">
                      {produto.imagem_url ? (
                        <img src={produto.imagem_url} alt={produto.nome} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      ) : (
                        <div className="image-placeholder"><Package size={42} /></div>
                      )}
                      <span className="badge">{produto.tipo_produto}</span>
                    </div>
                    <div className="prod-body">
                      <div className="prod-name">{produto.nome}</div>
                      <div className="prod-category">{[produto.categoria, produto.subcategoria].filter(Boolean).join(' / ')}</div>
                      {produto.descricao && <div className="prod-desc">{produto.descricao}</div>}
                      {produto.controla_estoque && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          padding: '8px 10px', borderRadius: 10,
                          background: produto.estoque_atual === 0 ? 'rgba(239,68,68,0.12)' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'rgba(245,166,35,0.12)' : 'rgba(46,204,143,0.08)',
                          border: `1px solid ${produto.estoque_atual === 0 ? 'rgba(239,68,68,0.3)' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'rgba(245,166,35,0.3)' : 'rgba(46,204,143,0.2)'}`,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: produto.estoque_atual === 0 ? '#EF4444' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? '#F5A623' : '#2ECC8F' }}>
                            {produto.estoque_atual === 0 ? 'ZERADO' : produto.estoque_minimo != null && (produto.estoque_atual ?? 0) <= produto.estoque_minimo ? 'Estoque baixo' : 'Em estoque'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                            {produto.estoque_atual ?? 0} {produto.unidade_medida ?? 'un'}{produto.estoque_minimo != null ? ` / min ${produto.estoque_minimo}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="prod-meta">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                        <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                          <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => handleToggleProduto(produto, 'ativo')} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                          <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => handleToggleProduto(produto, 'ativo_cardapio')} />
                        </div>
                      </div>
                    </div>
                    <div className="prod-actions">
                      {produto.controla_estoque && <button className="action-btn" type="button" onClick={() => abrirMovimentacao(produto)}>Entrada / saida</button>}
                      <button className="action-btn" type="button" onClick={() => handleOpenEdit(produto)}><Edit2 size={16} /> Editar</button>
                      <button className="action-btn" type="button" onClick={() => setDeleteTarget(produto)}><Trash2 size={16} /> Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhum produto encontrado para esta seleção.</div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="estoque">
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-label">Em estoque normal</div><div className="kpi-value">{estoqueOk.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Estoque baixo</div><div className="kpi-value" style={{ color: '#F5A623' }}>{estoqueBaixo.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Zerados</div><div className="kpi-value" style={{ color: '#EF4444' }}>{estoqueZerado.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Custo em estoque</div><div className="kpi-value">{custoTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div></div>
          </div>

          {alertas.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', marginBottom: 8 }}>
                {alertas.length} alerta{alertas.length > 1 ? 's' : ''} de estoque
              </div>
              {alertas.map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                  <span style={{ fontSize: 12 }}>{a.produto_nome}</span>
                  <span style={{ fontSize: 11, color: a.tipo === 'zerado' ? '#EF4444' : '#F5A623', fontWeight: 700 }}>
                    {a.tipo === 'zerado' ? 'ZERADO' : 'Abaixo do minimo'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ padding: 18, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Posicao de estoque</div>
                <div style={{ color: 'var(--text2)', marginTop: 4 }}>Produtos e insumos com controle ativo.</div>
              </div>
              <Button onClick={() => companyId && verificarAlertas(companyId)}>Atualizar alertas</Button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                <thead>
                  <tr style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'left' }}>
                    {['Produto', 'Tipo', 'Unidade', 'Atual', 'Min', 'Max', 'Status', 'Custo unit.', 'Valor', 'Acoes'].map((h) => <th key={h} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {estoqueProdutos.map((p) => {
                    const baixo = p.estoque_minimo != null && (p.estoque_atual ?? 0) <= p.estoque_minimo;
                    const zerado = (p.estoque_atual ?? 0) === 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: 12, fontWeight: 700 }}>{p.nome}</td>
                        <td style={{ padding: 12, color: 'var(--text2)' }}>{p.tipo_produto}</td>
                        <td style={{ padding: 12 }}>{p.unidade_medida ?? 'un'}</td>
                        <td style={{ padding: 12 }}>{p.estoque_atual ?? 0}</td>
                        <td style={{ padding: 12 }}>{p.estoque_minimo ?? '-'}</td>
                        <td style={{ padding: 12 }}>{p.estoque_maximo ?? '-'}</td>
                        <td style={{ padding: 12, color: zerado ? '#EF4444' : baixo ? '#F5A623' : '#2ECC8F', fontWeight: 700 }}>{zerado ? 'Zerado' : baixo ? 'Baixo' : 'OK'}</td>
                        <td style={{ padding: 12 }}>{(p.custo_unitario ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td style={{ padding: 12 }}>{(((p.estoque_atual ?? 0) * (p.custo_unitario ?? 0))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button size="sm" variant="outline" onClick={() => abrirMovimentacao(p, 'entrada')}>Entrada</Button>
                            <Button size="sm" variant="outline" onClick={() => abrirMovimentacao(p, 'saida')}>Saida</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {estoqueProdutos.length === 0 && <div className="empty-state">Nenhum item com controle de estoque ativo.</div>}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Historico de movimentacoes</div>
                <div style={{ color: 'var(--text2)', marginTop: 4 }}>Entradas, saidas, perdas e ajustes.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={periodoMov} onChange={(e) => setPeriodoMov(e.target.value as 'hoje' | 'semana' | 'mes')} className="form-input">
                  <option value="hoje">Hoje</option>
                  <option value="semana">7 dias</option>
                  <option value="mes">30 dias</option>
                </select>
                <select value={filtroMovProduto} onChange={(e) => setFiltroMovProduto(e.target.value)} className="form-input">
                  <option value="">Todos os produtos</option>
                  {estoqueProdutos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {movimentacoes.map((m) => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 90px 130px 1fr 110px', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--surface2)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                  <strong>{m.produto_nome ?? 'Produto'}</strong>
                  <span style={{ color: m.tipo === 'entrada' ? '#2ECC8F' : m.tipo === 'saida' ? '#EF4444' : m.tipo === 'perda' ? '#F5A623' : '#4A9EFF', fontWeight: 700 }}>{m.tipo}</span>
                  <span>{m.quantidade}</span>
                  <span>{`${m.quantidade_anterior ?? '-'} -> ${m.quantidade_posterior ?? '-'}`}</span>
                  <span style={{ color: 'var(--text2)' }}>{m.motivo ?? '-'}</span>
                  <span>{(m.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              ))}
              {movimentacoes.length === 0 && <div className="empty-state">Nenhuma movimentacao no periodo.</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="composicao">
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Receitas / ficha tecnica</div>
            <div style={{ color: 'var(--text2)', marginTop: 6, marginBottom: 18 }}>Defina quais insumos cada pizza, produto ou combo consome.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) minmax(220px,1fr) 120px 120px auto', gap: 12, alignItems: 'end' }}>
              <div>
                <Label>Produto final</Label>
                <select value={produtoReceita} onChange={(e) => setProdutoReceita(e.target.value)} className="form-input">
                  <option value="">Selecione</option>
                  {produtosReceitaOptions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <Label>Insumo</Label>
                <select value={novoInsumo.insumo_id} onChange={(e) => setNovoInsumo((prev) => ({ ...prev, insumo_id: e.target.value }))} className="form-input">
                  <option value="">Selecione</option>
                  {insumosOptions.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <Label>Qtd.</Label>
                <Input type="number" min="0" step="0.001" value={novoInsumo.quantidade} onChange={(e) => setNovoInsumo((prev) => ({ ...prev, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label>Unidade</Label>
                <select value={novoInsumo.unidade_medida} onChange={(e) => setNovoInsumo((prev) => ({ ...prev, unidade_medida: e.target.value }))} className="form-input">
                  {['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'pc'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <Button onClick={handleSalvarComposicao} disabled={!produtoReceita || !novoInsumo.insumo_id || !novoInsumo.quantidade}>Adicionar</Button>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {composicoesProduto.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--surface2)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.insumo_nome}</div>
                    <div style={{ color: 'var(--text2)', fontSize: 12 }}>{c.quantidade} {c.unidade_medida || c.insumo_unidade || 'un'} por unidade produzida</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleRemoverComposicao(c.id)}>Remover</Button>
                </div>
              ))}
              {produtoReceita && composicoesProduto.length === 0 && <div className="empty-state">Nenhum insumo nessa receita ainda.</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lucro">
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['hoje', 'semana', 'mes', 'tudo'] as const).map((periodo) => (
                <button
                  key={periodo}
                  type="button"
                  onClick={() => setPeriodoLucro(periodo)}
                  className="tab-trigger"
                  data-state={periodoLucro === periodo ? 'active' : undefined}
                >
                  {periodo === 'hoje' ? 'Hoje' : periodo === 'semana' ? '7 dias' : periodo === 'mes' ? '30 dias' : 'Tudo'}
                </button>
              ))}
              <Button variant="outline" onClick={() => companyId && loadLucroPorProduto(companyId)} disabled={loadingLucro}>
                {loadingLucro ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Receita total</div>
                <div className="kpi-value">{produtosLucro.reduce((sum, p) => sum + p.receita_total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Custo total (CMV)</div>
                <div className="kpi-value" style={{ color: '#F5A623' }}>{produtosLucro.reduce((sum, p) => sum + p.custo_total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Lucro real</div>
                <div className="kpi-value" style={{ color: '#2ECC8F' }}>{produtosLucro.reduce((sum, p) => sum + p.lucro_total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Margem media</div>
                <div className="kpi-value">
                  {produtosLucro.length > 0
                    ? (produtosLucro.reduce((sum, p) => sum + p.margem_media_pct, 0) / produtosLucro.length).toFixed(1)
                    : '0'}%
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Ranking de lucro por produto</div>
                <div style={{ color: 'var(--text2)', marginTop: 4 }}>Produtos ordenados por contribuicao real de lucro no periodo.</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Produto', 'Qtd vendida', 'Receita', 'Custo (CMV)', 'Lucro', 'Margem'].map((header, index) => (
                        <th key={header} style={{ padding: 12, textAlign: index === 0 ? 'left' : 'right', fontSize: 12, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {produtosLucro.map((produto, index) => (
                      <tr key={produto.produto_id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: 12, fontSize: 13, fontWeight: 700 }}>
                          {index < 3 && <span style={{ marginRight: 6, color: 'var(--accent)' }}>#{index + 1}</span>}
                          {produto.produto_nome}
                          {produto.categoria && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{produto.categoria}</div>}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>{produto.quantidade_vendida}</td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>{produto.receita_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13, color: 'var(--text2)' }}>{produto.custo_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 700, color: produto.lucro_total >= 0 ? '#2ECC8F' : '#EF4444' }}>
                          {produto.lucro_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background: produto.margem_media_pct >= 40 ? 'rgba(46,204,143,0.15)' : produto.margem_media_pct >= 20 ? 'rgba(245,166,35,0.15)' : 'rgba(239,68,68,0.15)',
                            color: produto.margem_media_pct >= 40 ? '#2ECC8F' : produto.margem_media_pct >= 20 ? '#F5A623' : '#EF4444',
                          }}>
                            {produto.margem_media_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {produtosLucro.length === 0 && !loadingLucro && (
                      <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Nenhuma venda com custo registrado neste periodo.</td></tr>
                    )}
                    {loadingLucro && (
                      <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Carregando lucro por produto...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {(['A', 'B', 'C'] as const).map((classe) => {
                const produtosClasse = curvaABC.filter((produto) => produto.classe === classe);
                const cor = classe === 'A' ? '#2ECC8F' : classe === 'B' ? '#F5A623' : '#EF4444';
                const desc = classe === 'A' ? 'Geram 80% do lucro' : classe === 'B' ? 'Geram os 15% seguintes' : 'Baixa contribuicao';
                return (
                  <div key={classe} style={{ background: 'var(--surface)', border: `1px solid ${cor}40`, borderRadius: 'var(--radius)', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${cor}20`, color: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{classe}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Classe {classe}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: cor }}>{produtosClasse.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>produtos - {desc}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 16, fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, borderLeft: '3px solid var(--accent)' }}>
              <strong style={{ color: 'var(--text)' }}>Classe A:</strong> produtos prioritarios, manter sempre em estoque.{' '}
              <strong style={{ color: 'var(--text)' }}>Classe B:</strong> produtos relevantes para acompanhar.{' '}
              <strong style={{ color: 'var(--text)' }}>Classe C:</strong> candidatos a reprecificacao ou retirada do cardapio.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="opcoes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Opções de produto</div>
              <div style={{ color: 'var(--text2)', marginTop: 6 }}>Adicione complementos e opções que podem ser aplicados nos produtos.</div>
            </div>
            <Button onClick={handleOpenOptionCreate}>＋ Nova Opção</Button>
          </div>
          {opcoes.length ? (
            <div className="product-grid">
              {opcoes.map((opcao) => (
                <div className="prod-card" key={opcao.id} style={{ position: 'relative' }}>
                  <div className="prod-body" style={{ paddingBottom: 12 }}>
                    <div className="prod-name">{opcao.nome}</div>
                    <div className="prod-category">{`+ ${opcao.preco_adicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</div>
                  </div>
                  <div className="prod-actions">
                    <button className="action-btn" type="button" onClick={() => handleOpenEditOption(opcao)}><Edit2 size={16} /> Editar</button>
                    <button className="action-btn danger" type="button" onClick={() => handleDeleteOption(opcao.id)}><Trash2 size={16} /> Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Nenhuma opção cadastrada ainda.</div>
          )}
        </TabsContent>
        <TabsContent value="tamanhos">
          <PizzaTamanhosManager />
        </TabsContent>
        <TabsContent value="bordas">
          <PizzaBordasManager />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Excluir "{deleteTarget?.nome}" permanentemente?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteSupabase}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editing ? 'Editar produto' : 'Novo produto'}</div>
              </div>
              <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); setImageFile(null); setImagePreview(''); }}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={formData.nome} onChange={(event) => onChangeForm('nome', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    list="categoria-list"
                    value={formData.categoria}
                    onChange={(event) => {
                      onChangeForm('categoria', event.target.value);
                      void aplicarMargemPadraoCategoria(event.target.value);
                    }}
                    placeholder="Digite ou escolha uma categoria"
                  />
                  <datalist id="categoria-list">
                    {categoryOptions.map((category) => (
                      <option key={category.nome} value={category.nome} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Input
                    id="subcategoria"
                    list="subcategoria-list"
                    value={formData.subcategoria}
                    onChange={(event) => onChangeForm('subcategoria', event.target.value)}
                    placeholder="Digite ou escolha uma subcategoria"
                  />
                  <datalist id="subcategoria-list">
                    {(categoryOptions.find((c) => c.nome === formData.categoria)?.subcategorias || []).map((sub) => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="tipo_produto">Tipo de item</Label>
                  <select
                    id="tipo_produto"
                    value={formData.tipo_produto}
                    onChange={(event) => onChangeForm('tipo_produto', event.target.value as TipoProduto)}
                    className="form-input"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}
                  >
                    <option value="produto">Produto</option>
                    <option value="combo">Combo</option>
                    <option value="adicional">Adicional</option>
                    <option value="insumo">Insumo</option>
                  </select>
                </div>
                <div className="form-grid-full" style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'grid', gap: 12, border: '1px solid var(--border)' }}>
                  <Label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Precificacao</Label>
                  <div className="form-grid">
                    <div>
                      <Label htmlFor="custo" style={{ fontSize: 12, color: 'var(--text2)' }}>Custo unitario (R$)</Label>
                      <Input id="custo" type="number" step="0.01" min="0" value={formData.custo_unitario} onChange={(event) => handleCustoChange(event.target.value)} placeholder="Ex: 12.50" />
                    </div>
                    <div>
                      <Label htmlFor="margem" style={{ fontSize: 12, color: 'var(--text2)' }}>Margem desejada (%)</Label>
                      <Input id="margem" type="number" step="1" min="0" max="95" value={formData.margem_pct} onChange={(event) => handleMargemChange(event.target.value)} placeholder="Ex: 60" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="preco" style={{ fontSize: 12, color: 'var(--text2)' }}>Preco de venda (R$)</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.preco_sugerido}
                      onChange={(event) => handlePrecoManualChange(event.target.value)}
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        borderColor: formData.modo_calculo === 'por_margem' ? 'var(--accent)' : 'var(--border)',
                      }}
                    />
                  </div>
                  {Number(formData.custo_unitario) > 0 && Number(formData.preco_sugerido) > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: calcularMargemPorPreco(Number(formData.custo_unitario), Number(formData.preco_sugerido)) >= 30 ? 'rgba(46,204,143,0.1)' : 'rgba(245,166,35,0.1)',
                      border: `1px solid ${calcularMargemPorPreco(Number(formData.custo_unitario), Number(formData.preco_sugerido)) >= 30 ? 'rgba(46,204,143,0.25)' : 'rgba(245,166,35,0.25)'}`,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Lucro por unidade</span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: calcularMargemPorPreco(Number(formData.custo_unitario), Number(formData.preco_sugerido)) >= 30 ? '#2ECC8F' : '#F5A623',
                      }}>
                        {(Number(formData.preco_sugerido) - Number(formData.custo_unitario)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        {' '}({calcularMargemPorPreco(Number(formData.custo_unitario), Number(formData.preco_sugerido)).toFixed(1)}% margem)
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-grid-full">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" value={formData.descricao} onChange={(event) => onChangeForm('descricao', event.target.value)} />
                </div>
                <div className="form-grid-full" style={{ border: '1px solid rgba(255,107,53,0.18)', borderRadius: 18, padding: 16, background: 'rgba(255,107,53,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: formData.controla_estoque ? 14 : 0 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Controlar estoque</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>Ativa quantidade, alertas e historico de entrada/saida.</div>
                    </div>
                    <div
                      onClick={() => onChangeForm('controla_estoque', !formData.controla_estoque)}
                      style={{ width: 44, height: 24, borderRadius: 999, background: formData.controla_estoque ? 'var(--accent)' : 'var(--surface3)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 3, left: formData.controla_estoque ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                  {formData.controla_estoque && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <Label>Estoque inicial</Label>
                        <Input type="number" min="0" step="0.001" value={formData.estoque_atual} onChange={(e) => onChangeForm('estoque_atual', e.target.value)} />
                      </div>
                      <div>
                        <Label>Estoque minimo</Label>
                        <Input type="number" min="0" step="0.001" value={formData.estoque_minimo} onChange={(e) => onChangeForm('estoque_minimo', e.target.value)} />
                      </div>
                      <div>
                        <Label>Estoque maximo</Label>
                        <Input type="number" min="0" step="0.001" value={formData.estoque_maximo} onChange={(e) => onChangeForm('estoque_maximo', e.target.value)} />
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <select value={formData.unidade_medida} onChange={(e) => onChangeForm('unidade_medida', e.target.value)} className="form-input">
                          <option value="un">un</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">L</option>
                          <option value="ml">ml</option>
                          <option value="cx">cx</option>
                          <option value="pct">pct</option>
                          <option value="pc">pc</option>
                        </select>
                      </div>
                      <div>
                        <Label>Codigo interno</Label>
                        <Input value={formData.codigo_interno} onChange={(e) => onChangeForm('codigo_interno', e.target.value)} />
                      </div>
                      <div>
                        <Label>Fornecedor</Label>
                        <Input value={formData.fornecedor_nome} onChange={(e) => onChangeForm('fornecedor_nome', e.target.value)} />
                      </div>
                      <div>
                        <Label>Contato fornecedor</Label>
                        <Input value={formData.fornecedor_contato} onChange={(e) => onChangeForm('fornecedor_contato', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Label htmlFor="destaque" style={{ minWidth: 100 }}>Destaque</Label>
                  <input
                    id="destaque"
                    type="checkbox"
                    checked={formData.destaque_cardapio}
                    onChange={(event) => onChangeForm('destaque_cardapio', event.target.checked)}
                  />
                </div>
                {formData.tipo_produto === 'combo' && (
                  <div className="form-grid-full" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>Itens do combo</div>
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 80px 120px 120px' }}>
                      <div>
                        <Label htmlFor="comboProduto">Produto</Label>
                        <select
                          id="comboProduto"
                          value={comboProductId}
                          onChange={(event) => setComboProductId(event.target.value)}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}
                        >
                          <option value="">Selecione um produto</option>
                          {produtos
                            .filter((p) => p.tipo_produto !== 'combo' && p.id !== editing?.id)
                            .map((produto) => (
                              <option key={produto.id} value={produto.id}>{produto.nome}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="comboQuantidade">Qtd.</Label>
                        <Input id="comboQuantidade" type="number" min="1" value={comboProductQty} onChange={(event) => setComboProductQty(event.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="comboObrigatorio">Obrig.</Label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                          <input id="comboObrigatorio" type="checkbox" checked={comboProductObrigatorio} onChange={(event) => setComboProductObrigatorio(event.target.checked)} />
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Obrigatório</span>
                        </div>
                      </div>
                      <Button type="button" onClick={handleAddComboItem} style={{ alignSelf: 'end' }}>Adicionar</Button>
                    </div>
                    {formData.combo_items.length > 0 ? (
                      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                        {formData.combo_items.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 14, background: 'var(--surface)' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.nome}</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{item.quantidade}x • {item.obrigatorio ? 'Obrigatório' : 'Opcional'}</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleRemoveComboItem(item.id)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 14, color: 'var(--text2)' }}>Adicione produtos para montar o combo.</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                      <div>
                        <Label htmlFor="comboMin">Mín. seleções</Label>
                        <Input id="comboMin" type="number" min="0" value={formData.combo_min_selecoes} onChange={(event) => onChangeForm('combo_min_selecoes', event.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="comboMax">Máx. seleções</Label>
                        <Input id="comboMax" type="number" min="0" value={formData.combo_max_selecoes} onChange={(event) => onChangeForm('combo_max_selecoes', event.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-grid-full" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Promoção e regras</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={formData.promocao_ativa} onChange={(event) => onChangeForm('promocao_ativa', event.target.checked)} />
                      Ativar promoção
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={formData.promocao_flash} onChange={(event) => onChangeForm('promocao_flash', event.target.checked)} />
                      Flash sale
                    </label>
                  </div>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <Label htmlFor="precoPromocional">Preço promocional</Label>
                      <Input id="precoPromocional" type="number" step="0.01" min="0" value={formData.promocao_preco} onChange={(event) => onChangeForm('promocao_preco', event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="promocaoInicio">Início</Label>
                      <Input id="promocaoInicio" type="date" value={formData.promocao_inicio} onChange={(event) => onChangeForm('promocao_inicio', event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="promocaoFim">Fim</Label>
                      <Input id="promocaoFim" type="date" value={formData.promocao_fim} onChange={(event) => onChangeForm('promocao_fim', event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="promocaoNota">Observação</Label>
                      <Input id="promocaoNota" value={formData.promocao_nota} onChange={(event) => onChangeForm('promocao_nota', event.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="form-grid-full">
                  <div className="image-upload-box">
                    <div>
                      <div className="image-upload-label">Imagem do produto</div>
                      <div style={{ marginTop: 8, color: 'var(--text2)' }}>Selecione um arquivo para mostrar no card.</div>
                    </div>
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ImagePlus size={18} />
                      <span>Selecionar</span>
                      <input type="file" accept="image/*" hidden onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                  {imagePreview && (
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={imagePreview} alt="Pré-visualização" style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={() => { setDialogOpen(false); setEditing(null); setImageFile(null); setImagePreview(''); }}>Cancelar</Button>
                <Button type="button" onClick={handleSaveSupabase}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMovOpen && produtoMovendo && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal-shell" style={{ width: 'min(520px,95%)' }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Movimentacao de estoque</div>
                <div style={{ color: 'var(--text2)', marginTop: 4 }}>{produtoMovendo.nome}</div>
              </div>
              <Button variant="ghost" onClick={() => setModalMovOpen(false)}>Fechar</Button>
            </div>
            <div style={{ padding: '14px 20px', background: 'var(--surface2)', display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Estoque atual</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: produtoMovendo.estoque_atual === 0 ? '#EF4444' : 'var(--text)' }}>
                  {produtoMovendo.estoque_atual ?? 0} <span style={{ fontSize: 13, color: 'var(--text2)' }}>{produtoMovendo.unidade_medida ?? 'un'}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Minimo</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text2)' }}>{produtoMovendo.estoque_minimo ?? '-'}</div>
              </div>
            </div>
            <div className="modal-body">
              <div>
                <Label>Tipo de movimentacao</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {[
                    { value: 'entrada', label: 'Entrada', color: '#2ECC8F' },
                    { value: 'saida', label: 'Saida', color: '#EF4444' },
                    { value: 'ajuste', label: 'Ajuste', color: '#4A9EFF' },
                    { value: 'perda', label: 'Perda', color: '#F5A623' },
                  ].map((op) => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setMovForm((prev) => ({ ...prev, tipo: op.value, motivo: op.value === 'entrada' ? 'compra' : op.value === 'perda' ? 'desperdicio' : 'inventario' }))}
                      style={{
                        padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `1px solid ${movForm.tipo === op.value ? op.color : 'var(--border)'}`,
                        background: movForm.tipo === op.value ? `${op.color}22` : 'transparent',
                        color: movForm.tipo === op.value ? op.color : 'var(--text2)',
                        fontWeight: 700,
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min="0" step="0.001" value={movForm.quantidade} onChange={(e) => setMovForm((prev) => ({ ...prev, quantidade: e.target.value }))} />
                </div>
                <div>
                  <Label>Custo unitario</Label>
                  <Input type="number" min="0" step="0.01" value={movForm.custo_unitario} onChange={(e) => setMovForm((prev) => ({ ...prev, custo_unitario: e.target.value }))} />
                </div>
                <div className="form-grid-full">
                  <Label>Motivo</Label>
                  <select value={movForm.motivo} onChange={(e) => setMovForm((prev) => ({ ...prev, motivo: e.target.value }))} className="form-input">
                    <option value="compra">Compra de fornecedor</option>
                    <option value="venda">Venda / pedido</option>
                    <option value="producao">Producao interna</option>
                    <option value="inventario">Inventario fisico</option>
                    <option value="desperdicio">Desperdicio</option>
                    <option value="vencimento">Vencimento</option>
                    <option value="correcao">Correcao</option>
                  </select>
                </div>
                <div className="form-grid-full">
                  <Label>Observacao</Label>
                  <Textarea rows={2} value={movForm.observacao} onChange={(e) => setMovForm((prev) => ({ ...prev, observacao: e.target.value }))} />
                </div>
              </div>
              {movForm.quantidade && (
                <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text2)' }}>Novo estoque</span>
                  <strong style={{ color: 'var(--accent)' }}>
                    {(movForm.tipo === 'entrada' || movForm.tipo === 'ajuste'
                      ? (produtoMovendo.estoque_atual ?? 0) + Number(movForm.quantidade)
                      : (produtoMovendo.estoque_atual ?? 0) - Number(movForm.quantidade)
                    ).toLocaleString('pt-BR')} {produtoMovendo.unidade_medida ?? 'un'}
                  </strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" onClick={() => setModalMovOpen(false)} style={{ flex: 1 }}>Cancelar</Button>
                <Button onClick={handleRegistrarMovimentacao} disabled={!movForm.quantidade || loadingMov} style={{ flex: 2 }}>
                  {loadingMov ? 'Registrando...' : 'Confirmar movimentacao'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {categoryManagerOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">Gerenciar categorias</div>
                <div style={{ color: 'var(--text2)', marginTop: 6 }}>Crie, edite e exclua categorias e subcategorias para os produtos.</div>
              </div>
              <Button variant="ghost" onClick={() => setCategoryManagerOpen(false)}>Fechar</Button>
            </div>
            <div className="modal-body">
              {companyId && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--surface)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Margem padrao por categoria</div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>Usada como sugestao automatica ao selecionar a categoria no cadastro.</div>
                  <GestorMargens companyId={companyId} categorias={categoryOptions.map((category) => category.nome)} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Categorias</div>
                <Button onClick={() => { setEditingCategory(null); setCategoryName(''); setCategoryDialogOpen(true); }}>＋ Nova categoria</Button>
              </div>
              {categoryOptions.length ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  {categoryOptions.map((category) => (
                    <div key={category.nome} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, background: 'var(--surface2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{category.nome}</div>
                          <div style={{ color: 'var(--text2)', fontSize: 13 }}>{category.subcategorias.length} subcategorias</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button variant="outline" size="sm" onClick={() => { setEditingCategory(category.nome); setCategoryName(category.nome); setCategoryDialogOpen(true); }}>Editar</Button>
                          <Button variant="destructive" size="sm" onClick={() => {
                            setCategoryItems((prev) => prev.filter((item) => item.nome !== category.nome));
                            setProdutos((prev) => prev.map((produto) => produto.categoria === category.nome ? { ...produto, categoria: '' } : produto));
                            toast.success('Categoria removida');
                          }}>
                            Excluir
                          </Button>
                          <Button onClick={() => { setSubcategoryParent(category.nome); setEditingSubcategory(null); setSubcategoryName(''); setSubcategoryDialogOpen(true); }}>
                            + Subcategoria
                          </Button>
                        </div>
                      </div>
                      {category.subcategorias.length > 0 && (
                        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                          {category.subcategorias.map((sub) => (
                            <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, background: 'var(--surface)' }}>
                              <span>{sub}</span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <Button variant="outline" size="sm" onClick={() => { setSubcategoryParent(category.nome); setEditingSubcategory(sub); setSubcategoryName(sub); setSubcategoryDialogOpen(true); }}>
                                  Editar
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => {
                                  setCategoryItems((prev) => prev.map((item) => item.nome === category.nome ? {
                                    ...item,
                                    subcategorias: item.subcategorias.filter((s) => s !== sub)
                                  } : item));
                                  setProdutos((prev) => prev.map((produto) => produto.categoria === category.nome && produto.subcategoria === sub ? { ...produto, subcategoria: '' } : produto));
                                  toast.success('Subcategoria removida');
                                }}>
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Nenhuma categoria cadastrada ainda.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {categoryDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingCategory ? 'Editar categoria' : 'Nova categoria'}</div>
              </div>
              <Button variant="ghost" onClick={() => setCategoryDialogOpen(false)}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid-full">
                <Label htmlFor="categoryName">Nome da categoria</Label>
                <Input id="categoryName" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => {
                  if (!categoryName.trim()) {
                    toast.error('Nome da categoria é obrigatório');
                    return;
                  }
                  const trimmed = categoryName.trim();
                  if (editingCategory) {
                    setCategoryItems((prev) => {
                      const idx = prev.findIndex((item) => item.nome === editingCategory);
                      if (idx >= 0) {
                        return prev.map((item) => item.nome === editingCategory ? { ...item, nome: trimmed } : item);
                      }
                      const productSubcats = produtos
                        .filter((p) => p.categoria === editingCategory)
                        .map((p) => p.subcategoria)
                        .filter((p): p is string => !!p);
                      return [...prev, { nome: trimmed, subcategorias: Array.from(new Set(productSubcats)).sort((a, b) => a.localeCompare(b)) }];
                    });
                    setProdutos((prev) => prev.map((produto) => produto.categoria === editingCategory ? { ...produto, categoria: trimmed } : produto));
                    toast.success('Categoria atualizada');
                  } else {
                    const exists = categoryOptions.some((item) => item.nome.toLowerCase() === trimmed.toLowerCase());
                    if (exists) {
                      toast.error('Categoria já existe');
                      return;
                    }
                    setCategoryItems((prev) => [...prev, { nome: trimmed, subcategorias: [] }].sort((a, b) => a.nome.localeCompare(b.nome)));
                    toast.success('Categoria criada');
                  }
                  setCategoryDialogOpen(false);
                  setEditingCategory(null);
                  setCategoryName('');
                }}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subcategoryDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingSubcategory ? 'Editar subcategoria' : 'Nova subcategoria'}</div>
                <div style={{ color: 'var(--text2)', marginTop: 6 }}>Categoria pai: {subcategoryParent}</div>
              </div>
              <Button variant="ghost" onClick={() => setSubcategoryDialogOpen(false)}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid-full">
                <Label htmlFor="subcategoryName">Nome da subcategoria</Label>
                <Input id="subcategoryName" value={subcategoryName} onChange={(event) => setSubcategoryName(event.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => setSubcategoryDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => {
                  if (!subcategoryName.trim()) {
                    toast.error('Nome da subcategoria é obrigatório');
                    return;
                  }
                  const trimmed = subcategoryName.trim();
                  setCategoryItems((prev) => {
                    const idx = prev.findIndex((item) => item.nome === subcategoryParent);
                    if (idx >= 0) {
                      return prev.map((item) => {
                        if (item.nome !== subcategoryParent) return item;
                        const existing = item.subcategorias.find((sub) => sub.toLowerCase() === trimmed.toLowerCase());
                        if (editingSubcategory && editingSubcategory !== trimmed) {
                          return {
                            ...item,
                            subcategorias: item.subcategorias.map((sub) => sub === editingSubcategory ? trimmed : sub).sort((a, b) => a.localeCompare(b))
                          };
                        }
                        if (!existing) {
                          return {
                            ...item,
                            subcategorias: [...item.subcategorias.filter((sub) => sub !== editingSubcategory), trimmed].sort((a, b) => a.localeCompare(b))
                          };
                        }
                        return item;
                      });
                    }
                    const productSubcats = produtos
                      .filter((p) => p.categoria === subcategoryParent)
                      .map((p) => p.subcategoria)
                      .filter((p): p is string => !!p);
                    const newSubcategories = Array.from(new Set([...productSubcats, trimmed])).sort((a, b) => a.localeCompare(b));
                    return [...prev, { nome: subcategoryParent, subcategorias: newSubcategories }];
                  });
                  if (editingSubcategory) {
                    setProdutos((prev) => prev.map((produto) => produto.categoria === subcategoryParent && produto.subcategoria === editingSubcategory ? { ...produto, subcategoria: trimmed } : produto));
                    toast.success('Subcategoria atualizada');
                  } else {
                    toast.success('Subcategoria criada');
                  }
                  setSubcategoryDialogOpen(false);
                  setEditingSubcategory(null);
                  setSubcategoryName('');
                }}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {optionDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingOption ? 'Editar opção' : 'Nova opção'}</div>
              </div>
              <Button variant="ghost" onClick={() => { setOptionDialogOpen(false); setEditingOption(null); }}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-grid-full">
                  <Label htmlFor="optionName">Nome da opção</Label>
                  <Input id="optionName" value={optionForm.nome} onChange={(event) => setOptionForm((prev) => ({ ...prev, nome: event.target.value }))} />
                </div>
                <div className="form-grid-full">
                  <Label htmlFor="optionPrice">Preço adicional</Label>
                  <Input id="optionPrice" type="number" step="0.01" min="0" value={optionForm.preco_adicional} onChange={(event) => setOptionForm((prev) => ({ ...prev, preco_adicional: event.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Label htmlFor="optionActive" style={{ minWidth: 100 }}>Ativa</Label>
                  <input id="optionActive" type="checkbox" checked={optionForm.ativo} onChange={(event) => setOptionForm((prev) => ({ ...prev, ativo: event.target.checked }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => { setOptionDialogOpen(false); setEditingOption(null); }}>Cancelar</Button>
                <Button onClick={handleSaveOption}>{editingOption ? 'Salvar' : 'Criar'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

type TipoProduto = 'produto' | 'insumo' | 'combo' | 'adicional';

type Produto = {
  id: number;
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
  unidade_medida: string | null;
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
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: string;
  estoque_minimo: string;
  unidade_medida: string;
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
  id: number;
  produtoId: number;
  nome: string;
  quantidade: number;
  obrigatorio: boolean;
};

type CategoryItem = {
  nome: string;
  subcategorias: string[];
};

const PRODUCT_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'produto', label: 'Produtos' },
  { key: 'combo', label: 'Combos' },
  { key: 'adicional', label: 'Adicionais' },
  { key: 'insumo', label: 'Insumos' },
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
  { id: 1, nome: 'Pizza Calabresa', categoria: 'Pizzas Tradicionais', subcategoria: 'Salgadas', descricao: 'Molho, mussarela e calabresa', preco_sugerido: 49.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 12, estoque_minimo: 2, unidade_medida: 'un', grupos: 2, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: 2, nome: 'Pizza 4 Queijos', categoria: 'Pizzas Especiais', subcategoria: 'Salgadas', descricao: 'Mussarela, parmesão, catupiry e gorgonzola', preco_sugerido: 62.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 8, estoque_minimo: 1, unidade_medida: 'un', grupos: 2, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: 5, nome: 'Combo Família', categoria: 'Combos', subcategoria: null, descricao: '2 pizzas grandes + 2 refrigerantes 2L', preco_sugerido: 119.9, tipo_produto: 'combo', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: null, estoque_minimo: null, unidade_medida: null, grupos: 0, combo_items: [
      { id: 1, produtoId: 1, nome: 'Pizza Calabresa', quantidade: 1, obrigatorio: true },
      { id: 2, produtoId: 2, nome: 'Pizza 4 Queijos', quantidade: 1, obrigatorio: true }
    ], combo_min_selecoes: 2, combo_max_selecoes: 4, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
  { id: 8, nome: 'Farinha de Trigo 5kg', categoria: 'Insumos', subcategoria: null, descricao: 'Farinha tipo 1', preco_sugerido: 0, tipo_produto: 'insumo', ativo: true, ativo_cardapio: false, imagem_url: null, destaque_cardapio: false, permite_observacao: false, estoque_atual: 34, estoque_minimo: 5, unidade_medida: 'kg', grupos: 0, combo_items: [], combo_min_selecoes: null, combo_max_selecoes: null, promocao_ativa: false, promocao_preco: null, promocao_inicio: null, promocao_fim: null, promocao_flash: false, promocao_nota: null },
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
  tipo_produto: 'produto',
  ativo: true,
  ativo_cardapio: true,
  destaque_cardapio: false,
  permite_observacao: true,
  estoque_atual: '',
  estoque_minimo: '',
  unidade_medida: '',
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

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>(mockProducts);
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

  const [comboProductId, setComboProductId] = useState<number>(0);
  const [comboProductQty, setComboProductQty] = useState('1');
  const [comboProductObrigatorio, setComboProductObrigatorio] = useState(true);

  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [subcategoryParent, setSubcategoryParent] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');

  const filteredProdutos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const specialTabs = ['opcoes', 'tamanhos', 'bordas'];
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
    setFormData({ ...EMPTY_FORM, tipo_produto: tipo });
    setComboProductId(0);
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
      tipo_produto: produto.tipo_produto,
      ativo: produto.ativo,
      ativo_cardapio: produto.ativo_cardapio,
      destaque_cardapio: produto.destaque_cardapio,
      permite_observacao: produto.permite_observacao,
      estoque_atual: produto.estoque_atual?.toString() ?? '',
      estoque_minimo: produto.estoque_minimo?.toString() ?? '',
      unidade_medida: produto.unidade_medida ?? '',
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
      id: Date.now(),
      produtoId: selected.id,
      nome: selected.nome,
      quantidade,
      obrigatorio: comboProductObrigatorio,
    };
    setFormData((prev) => ({
      ...prev,
      combo_items: [...prev.combo_items, item],
    }));
    setComboProductId(0);
    setComboProductQty('1');
    setComboProductObrigatorio(true);
  }, [comboProductId, comboProductQty, comboProductObrigatorio, formData.combo_items, produtos]);

  const handleRemoveComboItem = useCallback((itemId: number) => {
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
      id: editing?.id ?? Date.now(),
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
                  </div>
                  <div className="prod-meta">
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                      <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                        <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo: !p.ativo } : p))} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                        <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo_cardapio: !p.ativo_cardapio } : p))} />
                      </div>
                    </div>
                  </div>
                  <div className="prod-actions">
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

        {PRODUCT_TABS.filter((tab) => !['todos', 'opcoes', 'tamanhos', 'bordas'].includes(tab.key)).map((tab) => (
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
                    </div>
                    <div className="prod-meta">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                        <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                          <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo: !p.ativo } : p))} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                          <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo_cardapio: !p.ativo_cardapio } : p))} />
                        </div>
                      </div>
                    </div>
                    <div className="prod-actions">
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Excluir</AlertDialogAction>
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
                    onChange={(event) => onChangeForm('categoria', event.target.value)}
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
                <div>
                  <Label htmlFor="preco">Preço sugerido</Label>
                  <Input id="preco" type="number" step="0.01" min="0" value={formData.preco_sugerido} onChange={(event) => onChangeForm('preco_sugerido', event.target.value)} />
                </div>
                <div className="form-grid-full">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" value={formData.descricao} onChange={(event) => onChangeForm('descricao', event.target.value)} />
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
                          onChange={(event) => setComboProductId(Number(event.target.value))}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}
                        >
                          <option value={0}>Selecione um produto</option>
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
                <Button type="button" onClick={handleSave}>Salvar</Button>
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

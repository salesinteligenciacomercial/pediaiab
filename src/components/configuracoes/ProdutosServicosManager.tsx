import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, DollarSign, Loader2, Search } from "lucide-react";

type TipoProduto = 'produto' | 'insumo' | 'combo' | 'adicional';

interface ProdutoServico {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number;
  categoria: string | null;
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  unidade_medida: string | null;
  combo_min_selecoes: number | null;
  combo_max_selecoes: number | null;
  promocao_ativa: boolean;
  promocao_preco: number | null;
  promocao_inicio: string | null;
  promocao_fim: string | null;
  promocao_flash: boolean;
  promocao_nota: string | null;
  created_at: string;
}

interface ProdutoServicoForm {
  nome: string;
  descricao: string;
  preco_sugerido: string;
  categoria: string;
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: string;
  estoque_minimo: string;
  unidade_medida: string;
  combo_min_selecoes: string;
  combo_max_selecoes: string;
  promocao_ativa: boolean;
  promocao_preco: string;
  promocao_inicio: string;
  promocao_fim: string;
  promocao_flash: boolean;
  promocao_nota: string;
}

const EMPTY_FORM: ProdutoServicoForm = {
  nome: "",
  descricao: "",
  preco_sugerido: "",
  categoria: "",
  tipo_produto: 'produto',
  ativo: true,
  ativo_cardapio: true,
  destaque_cardapio: false,
  permite_observacao: true,
  estoque_atual: "",
  estoque_minimo: "",
  unidade_medida: "",
  combo_min_selecoes: "",
  combo_max_selecoes: "",
  promocao_ativa: false,
  promocao_preco: "",
  promocao_inicio: "",
  promocao_fim: "",
  promocao_flash: false,
  promocao_nota: "",
};

export function ProdutosServicosManager() {
  const [produtos, setProdutos] = useState<ProdutoServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<ProdutoServico | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProdutoServicoForm>({ ...EMPTY_FORM });

  useEffect(() => {
    loadCompanyAndProdutos();
  }, []);

  const loadCompanyAndProdutos = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return;

      const { data: role } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (role?.company_id) {
        setCompanyId(role.company_id);
        await loadProdutos(role.company_id);
      }
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProdutos = async (companyIdParam?: string) => {
    const cid = companyIdParam || companyId;
    if (!cid) return;

    const { data, error } = await supabase
      .from('produtos_servicos')
      .select('*')
      .eq('company_id', cid)
      .order('nome');

    if (error) {
      toast.error('Erro ao carregar produtos');
      return;
    }

    setProdutos((data || []) as any);
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingProduto(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (produto: ProdutoServico) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      descricao: produto.descricao || "",
      preco_sugerido: produto.preco_sugerido?.toString() || "",
      categoria: produto.categoria || "",
      tipo_produto: produto.tipo_produto || 'produto',
      ativo: produto.ativo,
      ativo_cardapio: produto.ativo_cardapio,
      destaque_cardapio: produto.destaque_cardapio,
      permite_observacao: produto.permite_observacao,
      estoque_atual: produto.estoque_atual?.toString() || "",
      estoque_minimo: produto.estoque_minimo?.toString() || "",
      unidade_medida: produto.unidade_medida || "",
      combo_min_selecoes: produto.combo_min_selecoes?.toString() || "",
      combo_max_selecoes: produto.combo_max_selecoes?.toString() || "",
      promocao_ativa: produto.promocao_ativa,
      promocao_preco: produto.promocao_preco?.toString() || "",
      promocao_inicio: produto.promocao_inicio || "",
      promocao_fim: produto.promocao_fim || "",
      promocao_flash: produto.promocao_flash,
      promocao_nota: produto.promocao_nota || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!companyId) {
      toast.error('Empresa não encontrada');
      return;
    }

    setSaving(true);

    const produtoData = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || null,
      tipo_produto: formData.tipo_produto,
      preco_sugerido: formData.preco_sugerido ? parseFloat(formData.preco_sugerido) : 0,
      categoria: formData.categoria.trim() || null,
      ativo: formData.ativo,
      ativo_cardapio: formData.ativo_cardapio,
      destaque_cardapio: formData.destaque_cardapio,
      permite_observacao: formData.permite_observacao,
      estoque_atual: formData.estoque_atual.trim() ? parseFloat(formData.estoque_atual) : null,
      estoque_minimo: formData.estoque_minimo.trim() ? parseFloat(formData.estoque_minimo) : null,
      unidade_medida: formData.unidade_medida.trim() || null,
      combo_min_selecoes: formData.combo_min_selecoes.trim() ? parseInt(formData.combo_min_selecoes, 10) : null,
      combo_max_selecoes: formData.combo_max_selecoes.trim() ? parseInt(formData.combo_max_selecoes, 10) : null,
      promocao_ativa: formData.promocao_ativa,
      promocao_preco: formData.promocao_preco.trim() ? parseFloat(formData.promocao_preco) : null,
      promocao_inicio: formData.promocao_inicio.trim() || null,
      promocao_fim: formData.promocao_fim.trim() || null,
      promocao_flash: formData.promocao_flash,
      promocao_nota: formData.promocao_nota.trim() || null,
      company_id: companyId
    };

    try {
      if (editingProduto) {
        const { error } = await supabase
          .from('produtos_servicos')
          .update(produtoData)
          .eq('id', editingProduto.id);

        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase
          .from('produtos_servicos')
          .insert(produtoData);

        if (error) throw error;
        toast.success('Produto criado!');
      }

      setDialogOpen(false);
      resetForm();
      loadProdutos();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (produto: ProdutoServico) => {
    if (!confirm(`Excluir "${produto.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('produtos_servicos')
        .delete()
        .eq('id', produto.id);

      if (error) throw error;
      toast.success('Produto excluído');
      loadProdutos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const toggleAtivo = async (produto: ProdutoServico) => {
    try {
      const { error } = await supabase
        .from('produtos_servicos')
        .update({ ativo: !produto.ativo })
        .eq('id', produto.id);

      if (error) throw error;
      loadProdutos();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    }
  };

  const filteredProdutos = produtos.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos e Serviços
            </CardTitle>
            <CardDescription>
              Cadastre os produtos/serviços que sua empresa oferece para usar nas vendas
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduto ? 'Editar Produto/Serviço' : 'Novo Produto/Serviço'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Consultoria Premium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição do produto ou serviço..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_produto">Tipo</Label>
                    <select
                      id="tipo_produto"
                      value={formData.tipo_produto}
                      onChange={(e) => setFormData({ ...formData, tipo_produto: e.target.value as TipoProduto })}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2"
                    >
                      <option value="produto">Produto</option>
                      <option value="insumo">Insumo</option>
                      <option value="combo">Combo</option>
                      <option value="adicional">Adicional</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ativo_cardapio">Ativo no cardápio</Label>
                    <Switch
                      id="ativo_cardapio"
                      checked={formData.ativo_cardapio}
                      onCheckedChange={(checked) => setFormData({ ...formData, ativo_cardapio: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="destaque_cardapio">Destaque no cardápio</Label>
                    <Switch
                      id="destaque_cardapio"
                      checked={formData.destaque_cardapio}
                      onCheckedChange={(checked) => setFormData({ ...formData, destaque_cardapio: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="permite_observacao">Permite observação</Label>
                    <Switch
                      id="permite_observacao"
                      checked={formData.permite_observacao}
                      onCheckedChange={(checked) => setFormData({ ...formData, permite_observacao: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estoque_atual">Estoque atual</Label>
                    <Input
                      id="estoque_atual"
                      value={formData.estoque_atual}
                      onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
                    <Input
                      id="estoque_minimo"
                      value={formData.estoque_minimo}
                      onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidade_medida">Unidade</Label>
                    <Input
                      id="unidade_medida"
                      value={formData.unidade_medida}
                      onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                      placeholder="un, kg, g"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="combo_min_selecoes">Mínimo combo</Label>
                    <Input
                      id="combo_min_selecoes"
                      type="number"
                      min="0"
                      value={formData.combo_min_selecoes}
                      onChange={(e) => setFormData({ ...formData, combo_min_selecoes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="combo_max_selecoes">Máximo combo</Label>
                    <Input
                      id="combo_max_selecoes"
                      type="number"
                      min="0"
                      value={formData.combo_max_selecoes}
                      onChange={(e) => setFormData({ ...formData, combo_max_selecoes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t border-muted/50 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="promocao_ativa">Promoção ativa</Label>
                      <p className="text-xs text-muted-foreground">Habilita preço e datas promocionais.</p>
                    </div>
                    <Switch
                      id="promocao_ativa"
                      checked={formData.promocao_ativa}
                      onCheckedChange={(checked) => setFormData({ ...formData, promocao_ativa: checked })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="promocao_preco">Preço promocional</Label>
                      <Input
                        id="promocao_preco"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.promocao_preco}
                        onChange={(e) => setFormData({ ...formData, promocao_preco: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promocao_inicio">Início</Label>
                      <Input
                        id="promocao_inicio"
                        type="date"
                        value={formData.promocao_inicio}
                        onChange={(e) => setFormData({ ...formData, promocao_inicio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promocao_fim">Fim</Label>
                      <Input
                        id="promocao_fim"
                        type="date"
                        value={formData.promocao_fim}
                        onChange={(e) => setFormData({ ...formData, promocao_fim: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="promocao_flash">Flash sale</Label>
                      <Switch
                        id="promocao_flash"
                        checked={formData.promocao_flash}
                        onCheckedChange={(checked) => setFormData({ ...formData, promocao_flash: checked })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promocao_nota">Nota de promoção</Label>
                      <Input
                        id="promocao_nota"
                        value={formData.promocao_nota}
                        onChange={(e) => setFormData({ ...formData, promocao_nota: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preco">Preço Sugerido</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="preco"
                        type="number"
                        step="0.01"
                        value={formData.preco_sugerido}
                        onChange={(e) => setFormData({ ...formData, preco_sugerido: e.target.value })}
                        placeholder="0,00"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ex: Consultoria"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="ativo">Produto ativo</Label>
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingProduto ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {produtos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto cadastrado</p>
            <p className="text-sm">Clique em "Novo Produto" para começar</p>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProdutos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{produto.nome}</p>
                        {produto.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {produto.descricao}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {produto.categoria && (
                        <Badge variant="outline">{produto.categoria}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(produto.preco_sugerido)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={produto.ativo}
                        onCheckedChange={() => toggleAtivo(produto)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(produto)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(produto)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

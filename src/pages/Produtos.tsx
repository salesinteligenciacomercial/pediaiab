import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Package, Plus, ImagePlus, CookingPot, Boxes, Settings2, Pizza } from "lucide-react";
import { PizzaTamanhosManager } from "@/components/produtos/PizzaTamanhosManager";

type TipoProduto = "produto" | "insumo" | "combo" | "adicional";

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  preco_sugerido: number | null;
  categoria: string | null;
  subcategoria: string | null;
  ativo: boolean | null;
  tipo_produto: TipoProduto;
  imagem_url: string | null;
  sku: string | null;
  peso_gramas: number | null;
  tempo_preparo_min: number | null;
  ativo_cardapio: boolean;
  ordem_exibicao: number;
  permite_observacao: boolean;
  controla_estoque: boolean;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  unidade_medida: string | null;
  destaque_cardapio: boolean;
};

type GrupoOpcao = {
  id: string;
  produto_id: string;
  nome: string;
  tipo_grupo: string;
  obrigatorio: boolean;
  minimo_escolhas: number;
  maximo_escolhas: number;
  ativo: boolean;
};

type Opcao = {
  id: string;
  grupo_id: string;
  nome: string;
  descricao: string | null;
  preco_adicional: number;
  ativo: boolean;
};

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  descricao_curta: "",
  descricao_completa: "",
  preco_sugerido: "",
  categoria: "",
  subcategoria: "",
  tipo_produto: "produto" as TipoProduto,
  sku: "",
  peso_gramas: "",
  tempo_preparo_min: "",
  ativo: true,
  ativo_cardapio: true,
  ordem_exibicao: "0",
  permite_observacao: true,
  controla_estoque: false,
  estoque_atual: "",
  estoque_minimo: "",
  unidade_medida: "",
  destaque_cardapio: false,
};

export default function Produtos() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpcao[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);

  const [search, setSearch] = useState("");
  const [tipoTab, setTipoTab] = useState("produto");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const [grupoDialogOpen, setGrupoDialogOpen] = useState(false);
  const [opcaoDialogOpen, setOpcaoDialogOpen] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>("");
  const [grupoForm, setGrupoForm] = useState({
    nome: "",
    tipo_grupo: "opcional",
    obrigatorio: false,
    minimo_escolhas: "0",
    maximo_escolhas: "1",
  });
  const [opcaoForm, setOpcaoForm] = useState({
    nome: "",
    descricao: "",
    preco_adicional: "0",
  });

  const loadCompany = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_company_id");
    setCompanyId(data);
    return data;
  }, []);

  const loadData = useCallback(async (cid?: string | null) => {
    const company = cid || companyId;
    if (!company) return;

    setLoading(true);
    try {
      const [prodRes, gruposRes, opcoesRes] = await Promise.all([
        supabase.from("produtos_servicos").select("*").eq("company_id", company).order("ordem_exibicao").order("nome"),
        supabase.from("produto_grupos_opcoes" as any).select("*").eq("company_id", company).order("ordem"),
        supabase.from("produto_opcoes" as any).select("*").eq("company_id", company).order("ordem"),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (gruposRes.error) throw gruposRes.error;
      if (opcoesRes.error) throw opcoesRes.error;

      setProdutos((prodRes.data || []) as unknown as Produto[]);
      setGrupos((gruposRes.data || []) as unknown as GrupoOpcao[]);
      setOpcoes((opcoesRes.data || []) as unknown as Opcao[]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    (async () => {
      const cid = await loadCompany();
      await loadData(cid);
    })();
  }, [loadCompany, loadData]);

  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      const byType = tipoTab === "todos" ? true : p.tipo_produto === tipoTab;
      const q = search.toLowerCase();
      const bySearch =
        p.nome.toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q) ||
        (p.subcategoria || "").toLowerCase().includes(q);
      return byType && bySearch;
    });
  }, [produtos, search, tipoTab]);

  const produtosFinais = useMemo(() => produtos.filter((p) => p.tipo_produto !== "insumo"), [produtos]);

  const resetForm = () => {
    setEditing(null);
    setImageFile(null);
    setImagePreview("");
    setFormData({ ...EMPTY_FORM });
  };

  const openCreate = (tipo: TipoProduto = "produto") => {
    resetForm();
    setFormData((prev) => ({ ...prev, tipo_produto: tipo }));
    setDialogOpen(true);
  };

  const openEdit = (produto: Produto) => {
    setEditing(produto);
    setImagePreview(produto.imagem_url || "");
    setImageFile(null);
    setFormData({
      nome: produto.nome || "",
      descricao: produto.descricao || "",
      descricao_curta: produto.descricao_curta || "",
      descricao_completa: produto.descricao_completa || "",
      preco_sugerido: produto.preco_sugerido?.toString() || "",
      categoria: produto.categoria || "",
      subcategoria: produto.subcategoria || "",
      tipo_produto: produto.tipo_produto,
      sku: produto.sku || "",
      peso_gramas: produto.peso_gramas?.toString() || "",
      tempo_preparo_min: produto.tempo_preparo_min?.toString() || "",
      ativo: produto.ativo ?? true,
      ativo_cardapio: produto.ativo_cardapio ?? false,
      ordem_exibicao: String(produto.ordem_exibicao || 0),
      permite_observacao: produto.permite_observacao ?? true,
      controla_estoque: produto.controla_estoque ?? false,
      estoque_atual: produto.estoque_atual?.toString() || "",
      estoque_minimo: produto.estoque_minimo?.toString() || "",
      unidade_medida: produto.unidade_medida || "",
      destaque_cardapio: produto.destaque_cardapio ?? false,
    });
    setDialogOpen(true);
  };

  const uploadProductImage = async () => {
    if (!imageFile || !companyId) return imagePreview || null;
    setUploading(true);
    try {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, imageFile, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadProductImage();
      const payload = {
        company_id: companyId,
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        descricao_curta: formData.descricao_curta.trim() || null,
        descricao_completa: formData.descricao_completa.trim() || null,
        preco_sugerido: formData.preco_sugerido ? Number(formData.preco_sugerido) : 0,
        categoria: formData.categoria.trim() || null,
        subcategoria: formData.subcategoria.trim() || null,
        tipo_produto: formData.tipo_produto,
        sku: formData.sku.trim() || null,
        imagem_url: imageUrl || null,
        peso_gramas: formData.peso_gramas ? Number(formData.peso_gramas) : null,
        tempo_preparo_min: formData.tempo_preparo_min ? Number(formData.tempo_preparo_min) : null,
        ativo: formData.ativo,
        ativo_cardapio: formData.ativo_cardapio,
        ordem_exibicao: Number(formData.ordem_exibicao || 0),
        permite_observacao: formData.permite_observacao,
        controla_estoque: formData.controla_estoque,
        estoque_atual: formData.estoque_atual ? Number(formData.estoque_atual) : null,
        estoque_minimo: formData.estoque_minimo ? Number(formData.estoque_minimo) : null,
        unidade_medida: formData.unidade_medida.trim() || null,
        destaque_cardapio: formData.destaque_cardapio,
      } as any;

      const query = editing
        ? supabase.from("produtos_servicos").update(payload).eq("id", editing.id)
        : supabase.from("produtos_servicos").insert(payload);
      const { error } = await query;
      if (error) throw error;

      toast.success(editing ? "Produto atualizado" : "Produto criado");
      setDialogOpen(false);
      resetForm();
      await loadData(companyId);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (produto: Produto, field: "ativo" | "ativo_cardapio") => {
    try {
      const { error } = await supabase
        .from("produtos_servicos")
        .update({ [field]: !produto[field] } as any)
        .eq("id", produto.id);
      if (error) throw error;
      await loadData();
    } catch {
      toast.error("Erro ao atualizar produto");
    }
  };

  const handleDelete = async (produto: Produto) => {
    if (!confirm(`Excluir "${produto.nome}"?`)) return;
    try {
      const { error } = await supabase.from("produtos_servicos").delete().eq("id", produto.id);
      if (error) throw error;
      toast.success("Produto excluído");
      await loadData();
    } catch {
      toast.error("Erro ao excluir produto");
    }
  };

  const saveGrupo = async () => {
    if (!companyId || !selectedProdutoId || !grupoForm.nome.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("produto_grupos_opcoes" as any).insert({
        company_id: companyId,
        produto_id: selectedProdutoId,
        nome: grupoForm.nome.trim(),
        tipo_grupo: grupoForm.tipo_grupo,
        obrigatorio: grupoForm.obrigatorio,
        minimo_escolhas: Number(grupoForm.minimo_escolhas || 0),
        maximo_escolhas: Number(grupoForm.maximo_escolhas || 1),
      });
      if (error) throw error;
      toast.success("Grupo de opções criado");
      setGrupoDialogOpen(false);
      setGrupoForm({ nome: "", tipo_grupo: "opcional", obrigatorio: false, minimo_escolhas: "0", maximo_escolhas: "1" });
      await loadData();
    } catch {
      toast.error("Erro ao criar grupo");
    } finally {
      setSaving(false);
    }
  };

  const saveOpcao = async () => {
    if (!companyId || !selectedGrupoId || !opcaoForm.nome.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("produto_opcoes" as any).insert({
        company_id: companyId,
        grupo_id: selectedGrupoId,
        nome: opcaoForm.nome.trim(),
        descricao: opcaoForm.descricao.trim() || null,
        preco_adicional: Number(opcaoForm.preco_adicional || 0),
      });
      if (error) throw error;
      toast.success("Opção criada");
      setOpcaoDialogOpen(false);
      setOpcaoForm({ nome: "", descricao: "", preco_adicional: "0" });
      await loadData();
    } catch {
      toast.error("Erro ao criar opção");
    } finally {
      setSaving(false);
    }
  };

  const productGroups = (produtoId: string) => grupos.filter((g) => g.produto_id === produtoId);
  const groupOptions = (grupoId: string) => opcoes.filter((o) => o.grupo_id === grupoId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Cadastre pizzas, bebidas, adicionais e insumos da operação.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => openCreate("produto")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
          <Button variant="outline" onClick={() => openCreate("insumo")}>
            <CookingPot className="h-4 w-4 mr-2" />
            Novo Insumo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Itens</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{produtos.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">No cardápio</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{produtos.filter((p) => p.ativo_cardapio).length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Insumos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{produtos.filter((p) => p.tipo_produto === "insumo").length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Com opções</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{grupos.length}</CardContent></Card>
      </div>

      <Tabs value={tipoTab} onValueChange={setTipoTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="produto">Produtos</TabsTrigger>
          <TabsTrigger value="combo">Combos</TabsTrigger>
          <TabsTrigger value="adicional">Adicionais</TabsTrigger>
          <TabsTrigger value="insumo">Insumos</TabsTrigger>
          <TabsTrigger value="opcoes">Grupos e opções</TabsTrigger>
          <TabsTrigger value="tamanhos"><Pizza className="h-4 w-4 mr-1" /> Tamanhos de Pizza</TabsTrigger>
        </TabsList>

        <TabsContent value={tipoTab} className="space-y-4">
          {tipoTab !== "opcoes" && (
            <>
              <Input placeholder="Buscar por nome, categoria ou subcategoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Card>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredProdutos.map((produto) => (
                        <Card key={produto.id} className="border-muted">
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                {produto.imagem_url ? (
                                  <img src={produto.imagem_url} alt={produto.nome} className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-8 w-8 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold truncate">{produto.nome}</h3>
                                  <Badge variant="outline">{produto.tipo_produto}</Badge>
                                  {produto.destaque_cardapio && <Badge>Destaque</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">{produto.descricao_curta || produto.descricao || "Sem descrição"}</p>
                                <div className="text-sm mt-2">
                                  {produto.categoria && <span className="mr-2">{produto.categoria}</span>}
                                  {produto.subcategoria && <span className="text-muted-foreground">/ {produto.subcategoria}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-lg font-bold text-primary">
                                  {Number(produto.preco_sugerido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {produto.tempo_preparo_min ? `${produto.tempo_preparo_min} min` : "Sem tempo de preparo"}{produto.peso_gramas ? ` • ${produto.peso_gramas}g` : ""}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <div className="flex items-center gap-2 text-xs">
                                  <span>Ativo</span>
                                  <Switch checked={!!produto.ativo} onCheckedChange={() => toggleActive(produto, "ativo")} />
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span>Cardápio</span>
                                  <Switch checked={!!produto.ativo_cardapio} onCheckedChange={() => toggleActive(produto, "ativo_cardapio")} />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(produto)}>Editar</Button>
                              <Button variant="outline" size="sm" onClick={() => { setSelectedProdutoId(produto.id); setGrupoDialogOpen(true); }}>Opções</Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDelete(produto)}>Excluir</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tipoTab === "opcoes" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {produtosFinais.map((produto) => (
                <Card key={produto.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span>{produto.nome}</span>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedProdutoId(produto.id); setGrupoDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-1" />
                        Grupo
                      </Button>
                    </CardTitle>
                    <CardDescription>{produto.categoria || "Sem categoria"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-72">
                      <div className="space-y-3 pr-4">
                        {productGroups(produto.id).length === 0 && <p className="text-sm text-muted-foreground">Sem grupos de opções.</p>}
                        {productGroups(produto.id).map((grupo) => (
                          <Card key={grupo.id} className="border-dashed">
                            <CardContent className="pt-4 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">{grupo.nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {grupo.tipo_grupo} • {grupo.obrigatorio ? "obrigatório" : "opcional"} • min {grupo.minimo_escolhas} / max {grupo.maximo_escolhas}
                                  </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => { setSelectedGrupoId(grupo.id); setOpcaoDialogOpen(true); }}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Opção
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {groupOptions(grupo.id).length === 0 && <p className="text-xs text-muted-foreground">Sem opções.</p>}
                                {groupOptions(grupo.id).map((opcao) => (
                                  <div key={opcao.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                                    <div>
                                      <div className="font-medium">{opcao.nome}</div>
                                      {opcao.descricao && <div className="text-xs text-muted-foreground">{opcao.descricao}</div>}
                                    </div>
                                    <Badge variant="secondary">
                                      {Number(opcao.preco_adicional || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tamanhos" className="space-y-4">
          <PizzaTamanhosManager />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo_produto} onValueChange={(v) => setFormData({ ...formData, tipo_produto: v as TipoProduto })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="combo">Combo</SelectItem>
                    <SelectItem value="adicional">Adicional</SelectItem>
                    <SelectItem value="insumo">Insumo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Categoria</Label><Input value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} /></div>
              <div className="space-y-2"><Label>Subcategoria</Label><Input value={formData.subcategoria} onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })} /></div>
              <div className="space-y-2"><Label>SKU</Label><Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} /></div>
            </div>

            <div className="space-y-2"><Label>Descrição curta</Label><Input value={formData.descricao_curta} onChange={(e) => setFormData({ ...formData, descricao_curta: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição completa</Label><Textarea rows={4} value={formData.descricao_completa} onChange={(e) => setFormData({ ...formData, descricao_completa: e.target.value })} /></div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Preço</Label><Input type="number" step="0.01" value={formData.preco_sugerido} onChange={(e) => setFormData({ ...formData, preco_sugerido: e.target.value })} /></div>
              <div className="space-y-2"><Label>Peso (g)</Label><Input type="number" value={formData.peso_gramas} onChange={(e) => setFormData({ ...formData, peso_gramas: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preparo (min)</Label><Input type="number" value={formData.tempo_preparo_min} onChange={(e) => setFormData({ ...formData, tempo_preparo_min: e.target.value })} /></div>
              <div className="space-y-2"><Label>Ordem no cardápio</Label><Input type="number" value={formData.ordem_exibicao} onChange={(e) => setFormData({ ...formData, ordem_exibicao: e.target.value })} /></div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Estoque atual</Label><Input type="number" step="0.001" value={formData.estoque_atual} onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })} /></div>
              <div className="space-y-2"><Label>Estoque mínimo</Label><Input type="number" step="0.001" value={formData.estoque_minimo} onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })} /></div>
              <div className="space-y-2"><Label>Unidade</Label><Input placeholder="un, g, kg, ml" value={formData.unidade_medida} onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <Label>Imagem do produto</Label>
              <div className="flex gap-4 items-center">
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  if (file) setImagePreview(URL.createObjectURL(file));
                }} />
                {imagePreview && <img src={imagePreview} alt="preview" className="h-20 w-20 object-cover rounded-md border" />}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Ativo</span><Switch checked={formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} /></div>
              <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Disponível no cardápio</span><Switch checked={formData.ativo_cardapio} onCheckedChange={(v) => setFormData({ ...formData, ativo_cardapio: v })} /></div>
              <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Permite observação</span><Switch checked={formData.permite_observacao} onCheckedChange={(v) => setFormData({ ...formData, permite_observacao: v })} /></div>
              <div className="flex items-center justify-between border rounded-lg p-3"><span className="text-sm">Controla estoque</span><Switch checked={formData.controla_estoque} onCheckedChange={(v) => setFormData({ ...formData, controla_estoque: v })} /></div>
              <div className="flex items-center justify-between border rounded-lg p-3 md:col-span-2"><span className="text-sm">Destaque no cardápio</span><Switch checked={formData.destaque_cardapio} onCheckedChange={(v) => setFormData({ ...formData, destaque_cardapio: v })} /></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || uploading}>
                {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={grupoDialogOpen} onOpenChange={setGrupoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo grupo de opções</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} placeholder="Ex: Tamanho, Borda, Adicionais" /></div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={grupoForm.tipo_grupo} onValueChange={(v) => setGrupoForm({ ...grupoForm, tipo_grupo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tamanho">Tamanho</SelectItem>
                  <SelectItem value="massa">Massa</SelectItem>
                  <SelectItem value="borda">Borda</SelectItem>
                  <SelectItem value="adicional">Adicional</SelectItem>
                  <SelectItem value="opcional">Opcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Mínimo</Label><Input type="number" value={grupoForm.minimo_escolhas} onChange={(e) => setGrupoForm({ ...grupoForm, minimo_escolhas: e.target.value })} /></div>
              <div className="space-y-2"><Label>Máximo</Label><Input type="number" value={grupoForm.maximo_escolhas} onChange={(e) => setGrupoForm({ ...grupoForm, maximo_escolhas: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between border rounded-md p-3"><span className="text-sm">Obrigatório</span><Switch checked={grupoForm.obrigatorio} onCheckedChange={(v) => setGrupoForm({ ...grupoForm, obrigatorio: v })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGrupoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveGrupo} disabled={saving}>Salvar grupo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={opcaoDialogOpen} onOpenChange={setOpcaoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova opção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={opcaoForm.nome} onChange={(e) => setOpcaoForm({ ...opcaoForm, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={opcaoForm.descricao} onChange={(e) => setOpcaoForm({ ...opcaoForm, descricao: e.target.value })} /></div>
            <div className="space-y-2"><Label>Preço adicional</Label><Input type="number" step="0.01" value={opcaoForm.preco_adicional} onChange={(e) => setOpcaoForm({ ...opcaoForm, preco_adicional: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpcaoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveOpcao} disabled={saving}>Salvar opção</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

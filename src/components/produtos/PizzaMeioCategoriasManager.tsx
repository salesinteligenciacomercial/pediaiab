import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Layers, Plus, Trash2, Pencil } from "lucide-react";

type Categoria = {
  id: string;
  company_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
};

const EMPTY = { nome: "", slug: "", descricao: "", ativo: true, ordem: "0" };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function PizzaMeioCategoriasManager() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;
      const { data, error } = await supabase
        .from("pizza_meio_categorias" as any)
        .select("*")
        .eq("company_id", cid)
        .order("ordem");
      if (error) throw error;
      setItems((data || []) as unknown as Categoria[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, ordem: String(items.length + 1) });
    setOpen(true);
  };

  const openEdit = (t: Categoria) => {
    setEditing(t);
    setForm({
      nome: t.nome,
      slug: t.slug,
      descricao: t.descricao || "",
      ativo: t.ativo,
      ordem: String(t.ordem),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!companyId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        nome: form.nome.trim(),
        slug: form.slug.trim() || slugify(form.nome),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
        ordem: Number(form.ordem) || 0,
      };
      const query = editing
        ? supabase.from("pizza_meio_categorias" as any).update(payload).eq("id", editing.id)
        : supabase.from("pizza_meio_categorias" as any).insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta categoria? As pizzas vinculadas ficarão sem categoria meio a meio.")) return;
    const { error } = await supabase.from("pizza_meio_categorias" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Categoria excluída");
    await load();
  };

  const seedDefaults = async () => {
    if (!companyId) return;
    const defaults = [
      { nome: "Salgadas", slug: "salgadas", descricao: "Pizzas salgadas tradicionais", ordem: 1 },
      { nome: "Doces", slug: "doces", descricao: "Pizzas doces e sobremesas", ordem: 2 },
      { nome: "Especiais", slug: "especiais", descricao: "Sabores premium / da casa", ordem: 3 },
    ].map((d) => ({ ...d, company_id: companyId, ativo: true }));
    const { error } = await supabase.from("pizza_meio_categorias" as any).upsert(defaults, { onConflict: "company_id,slug" });
    if (error) { toast.error("Erro ao criar padrões"); return; }
    toast.success("Categorias padrão criadas");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Categorias Meio a Meio</CardTitle>
              <CardDescription>
                Agrupe sabores que podem ser combinados em pizzas meio a meio (ex.: só salgadas com salgadas, só doces com doces).
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {items.length === 0 && (
                <Button variant="outline" onClick={seedDefaults}>Criar padrões</Button>
              )}
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova categoria</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma categoria cadastrada. Clique em "Criar padrões" para começar com Salgadas, Doces e Especiais.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <Card key={t.id} className={t.ativo ? "" : "opacity-60"}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold">{t.nome}</div>
                        <div className="text-xs text-muted-foreground">{t.descricao}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Slug: <code>{t.slug}</code></span>
                      <span>Ordem: {t.ordem}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value, slug: form.slug || slugify(e.target.value) })} placeholder="Ex: Salgadas" />
              </div>
              <div className="space-y-2">
                <Label>Slug (identificador)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="salgadas" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Pizzas salgadas tradicionais" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <span className="text-sm">Ativo</span>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Use essas categorias para restringir quais sabores podem ser combinados em uma pizza meio a meio.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

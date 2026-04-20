import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pizza, Plus, Trash2, Pencil } from "lucide-react";

type Tamanho = {
  id: string;
  company_id: string;
  nome: string;
  slug: string;
  multiplicador: number;
  max_sabores: number;
  fatias: number;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
};

const EMPTY = {
  nome: "",
  slug: "",
  multiplicador: "1",
  max_sabores: "1",
  fatias: "4",
  descricao: "",
  ativo: true,
  ordem: "0",
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function PizzaTamanhosManager() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<Tamanho[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tamanho | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;
      const { data, error } = await supabase
        .from("pizza_tamanhos" as any)
        .select("*")
        .eq("company_id", cid)
        .order("ordem");
      if (error) throw error;
      setItems((data || []) as unknown as Tamanho[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar tamanhos");
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

  const openEdit = (t: Tamanho) => {
    setEditing(t);
    setForm({
      nome: t.nome,
      slug: t.slug,
      multiplicador: String(t.multiplicador),
      max_sabores: String(t.max_sabores),
      fatias: String(t.fatias),
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
        multiplicador: Number(form.multiplicador) || 1,
        max_sabores: Number(form.max_sabores) || 1,
        fatias: Number(form.fatias) || 1,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
        ordem: Number(form.ordem) || 0,
      };
      const query = editing
        ? supabase.from("pizza_tamanhos" as any).update(payload).eq("id", editing.id)
        : supabase.from("pizza_tamanhos" as any).insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editing ? "Tamanho atualizado" : "Tamanho criado");
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
    if (!confirm("Excluir este tamanho?")) return;
    const { error } = await supabase.from("pizza_tamanhos" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Tamanho excluído");
    await load();
  };

  const seedDefaults = async () => {
    if (!companyId) return;
    const defaults = [
      { nome: "Brotinho", slug: "brotinho", multiplicador: 0.625, max_sabores: 1, fatias: 1, descricao: "Pizza com 1 sabor e 1 fatia", ordem: 1 },
      { nome: "Pequena", slug: "pequena", multiplicador: 1.0, max_sabores: 2, fatias: 4, descricao: "Pizza com até 2 sabores e 4 fatias", ordem: 2 },
      { nome: "Média", slug: "media", multiplicador: 1.343, max_sabores: 2, fatias: 6, descricao: "Pizza com até 2 sabores e 6 fatias", ordem: 3 },
      { nome: "Grande", slug: "grande", multiplicador: 1.5, max_sabores: 3, fatias: 8, descricao: "Pizza com até 3 sabores e 8 fatias", ordem: 4 },
      { nome: "Gigante", slug: "gigante", multiplicador: 1.875, max_sabores: 3, fatias: 12, descricao: "Pizza com até 3 sabores e 12 fatias", ordem: 5 },
    ].map((d) => ({ ...d, company_id: companyId, ativo: true }));
    const { error } = await supabase.from("pizza_tamanhos" as any).upsert(defaults, { onConflict: "company_id,slug" });
    if (error) { toast.error("Erro ao criar padrões"); return; }
    toast.success("Tamanhos padrão criados");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Pizza className="h-5 w-5" /> Tamanhos das Pizzas</CardTitle>
              <CardDescription>
                Configure os tamanhos disponíveis. O preço final é calculado pela média dos sabores × multiplicador do tamanho.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {items.length === 0 && (
                <Button variant="outline" onClick={seedDefaults}>Criar padrões</Button>
              )}
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo tamanho</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum tamanho cadastrado. Clique em "Criar padrões" para começar com Brotinho, Pequena, Média, Grande e Gigante.
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
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-muted p-2 text-center">
                        <div className="text-muted-foreground">Multiplicador</div>
                        <div className="font-semibold">{Number(t.multiplicador).toFixed(3)}x</div>
                      </div>
                      <div className="rounded bg-muted p-2 text-center">
                        <div className="text-muted-foreground">Sabores</div>
                        <div className="font-semibold">{t.max_sabores}</div>
                      </div>
                      <div className="rounded bg-muted p-2 text-center">
                        <div className="text-muted-foreground">Fatias</div>
                        <div className="font-semibold">{t.fatias}</div>
                      </div>
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
            <DialogTitle>{editing ? "Editar tamanho" : "Novo tamanho"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value, slug: form.slug || slugify(e.target.value) })} placeholder="Ex: Média" />
              </div>
              <div className="space-y-2">
                <Label>Slug (identificador)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="media" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Pizza com até 2 sabores e 6 fatias" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Multiplicador de preço</Label>
                <Input type="number" step="0.001" value={form.multiplicador} onChange={(e) => setForm({ ...form, multiplicador: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Máx. de sabores</Label>
                <Input type="number" value={form.max_sabores} onChange={(e) => setForm({ ...form, max_sabores: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fatias</Label>
                <Input type="number" value={form.fatias} onChange={(e) => setForm({ ...form, fatias: e.target.value })} />
              </div>
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
              💡 O preço final = (média do preço dos sabores escolhidos) × multiplicador. Exemplo: Pequena = 1.0, Grande = 1.5.
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

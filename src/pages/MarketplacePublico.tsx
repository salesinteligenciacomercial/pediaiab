import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import {
  APP_NAME,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_SUBTITLE,
  MARKETPLACE_TITLE,
} from "@/config/branding";

type MarketplaceStore = {
  slug: string;
  nome_loja: string | null;
  descricao_loja: string | null;
  logo_url: string | null;
  banner_url: string | null;
  pedido_minimo: number | null;
  taxa_entrega: number | null;
  aceita_entrega: boolean | null;
  aceita_retirada: boolean | null;
  endereco_loja: string | null;
  cor_primaria: string | null;
  categoria_marketplace?: string | null;
  visivel_marketplace?: boolean | null;
  tempo_preparo_min?: number | null;
};

const MARKETPLACE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&display=swap');
.marketplace-root *{box-sizing:border-box}
.marketplace-root{
  --fire:#FF4500;--fire2:#FF6B1A;--fire3:#FFB347;--cream:#FFF8F0;
  --dark:#0D0A08;--dark2:#1A1410;--dark3:#251E17;--dark4:#322820;
  --border:rgba(255,180,100,0.12);--border2:rgba(255,180,100,0.22);
  --text:#F5EAD8;--text2:#B8A898;--text3:#7A6A5A;
  --green:#2EC98A;--font-display:'Playfair Display',serif;--font:'Outfit',sans-serif;
  background:var(--dark);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.6;
  min-height:100vh;overflow-x:hidden;position:relative;
}
.marketplace-root::before{content:'';position:fixed;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events:none;z-index:0;opacity:.6}
.m-header{position:sticky;top:0;z-index:100;background:rgba(13,10,8,0.94);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);padding:0 16px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.m-logo{display:flex;align-items:center;gap:10px;min-width:0;text-decoration:none;color:inherit}
.m-logo-flame{font-size:24px;filter:drop-shadow(0 0 8px rgba(255,107,26,.7))}
.m-logo-text{font-family:var(--font-display);font-size:17px;font-weight:700;line-height:1.15;
  background:linear-gradient(135deg,var(--fire3),var(--fire2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.m-logo-sub{font-size:10px;color:var(--text3);letter-spacing:.06em;text-transform:uppercase}
.m-admin-link{font-size:12px;color:var(--text2);text-decoration:none;padding:8px 14px;border-radius:100px;
  border:1px solid var(--border);transition:all .2s;white-space:nowrap}
.m-admin-link:hover{border-color:var(--fire2);color:var(--fire2);background:rgba(255,107,26,.08)}
.m-hero{position:relative;overflow:hidden;padding:28px 16px 32px;max-width:960px;margin:0 auto}
.m-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,#1a0a00 0%,#2d1200 45%,#0d0a08 100%)}
.m-hero-glow{position:absolute;right:-80px;top:-60px;width:320px;height:320px;
  background:radial-gradient(circle,rgba(255,107,26,.2) 0%,transparent 65%);border-radius:50%}
.m-hero-inner{position:relative;z-index:1}
.m-hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,69,0,.12);
  border:1px solid rgba(255,69,0,.35);border-radius:100px;padding:5px 12px;
  font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--fire2);margin-bottom:14px}
.m-hero-title{font-family:var(--font-display);font-size:clamp(28px,6vw,44px);font-weight:900;line-height:1.05;letter-spacing:-1px;margin-bottom:10px}
.m-hero-title em{font-style:italic;background:linear-gradient(135deg,var(--fire3),var(--fire));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.m-hero-sub{color:var(--text2);font-size:14px;max-width:480px;line-height:1.65;margin-bottom:18px}
.m-hero-stats{display:flex;gap:20px;flex-wrap:wrap}
.m-stat-val{font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--fire2)}
.m-stat-lbl{font-size:10px;color:var(--text3);letter-spacing:.04em;text-transform:uppercase}
.m-search-wrap{padding:0 16px 12px;max-width:960px;margin:0 auto;position:relative;z-index:1}
.m-search-inner{position:relative}
.m-search-input{width:100%;background:var(--dark3);border:1.5px solid var(--border2);border-radius:100px;
  color:var(--text);font-family:var(--font);font-size:14px;padding:12px 18px 12px 42px;outline:none;transition:all .2s}
.m-search-input:focus{border-color:var(--fire2);box-shadow:0 0 0 4px rgba(255,107,26,.12)}
.m-search-input::placeholder{color:var(--text3)}
.m-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}
.m-pills{overflow-x:auto;scrollbar-width:none;padding:8px 16px 14px;display:flex;gap:7px;max-width:960px;margin:0 auto}
.m-pills::-webkit-scrollbar{display:none}
.m-pill{flex-shrink:0;padding:7px 14px;border-radius:100px;border:1.5px solid var(--border);
  background:transparent;font-family:var(--font);font-size:12.5px;font-weight:500;color:var(--text2);
  cursor:pointer;transition:all .18s;white-space:nowrap;display:flex;align-items:center;gap:6px}
.m-pill:hover{border-color:var(--border2);color:var(--text)}
.m-pill.active{background:var(--fire);border-color:var(--fire);color:#fff;font-weight:600;box-shadow:0 4px 16px rgba(255,69,0,.3)}
.m-main{max-width:960px;margin:0 auto;padding:8px 16px 80px;position:relative;z-index:1}
.m-section-title{font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.m-grid{display:grid;gap:14px}
@media(min-width:640px){.m-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:900px){.m-grid{grid-template-columns:repeat(3,1fr)}}
.m-card{display:flex;flex-direction:column;background:var(--dark2);border:1px solid var(--border);border-radius:16px;
  overflow:hidden;text-decoration:none;color:inherit;transition:all .22s;cursor:pointer}
.m-card:hover{transform:translateY(-3px);border-color:rgba(255,107,26,.45);box-shadow:0 12px 32px rgba(0,0,0,.45)}
.m-card-banner{height:110px;background:var(--dark3);position:relative;overflow:hidden}
.m-card-banner img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.m-card:hover .m-card-banner img{transform:scale(1.05)}
.m-card-banner-ph{display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;
  background:linear-gradient(135deg,var(--dark3),var(--dark4))}
.m-card-logo{position:absolute;bottom:-18px;left:14px;width:52px;height:52px;border-radius:12px;
  border:3px solid var(--dark2);background:var(--dark3);object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,.4)}
.m-card-logo-ph{position:absolute;bottom:-18px;left:14px;width:52px;height:52px;border-radius:12px;
  border:3px solid var(--dark2);background:var(--dark4);display:flex;align-items:center;justify-content:center;font-size:22px}
.m-card-body{padding:26px 14px 14px;flex:1;display:flex;flex-direction:column;gap:8px}
.m-card-name{font-size:16px;font-weight:700;line-height:1.25}
.m-card-desc{font-size:12.5px;color:var(--text2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.m-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.m-tag{font-size:10.5px;padding:3px 8px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text2)}
.m-tag.green{color:var(--green);border-color:rgba(46,201,138,.35);background:rgba(46,201,138,.08)}
.m-card-footer{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--border);
  background:rgba(0,0,0,.15);font-size:12px;color:var(--text3)}
.m-card-cta{color:var(--fire2);font-weight:600;font-size:12.5px}
.m-empty{text-align:center;padding:48px 20px;color:var(--text2)}
.m-empty-icon{font-size:48px;margin-bottom:12px}
.m-loading{display:flex;align-items:center;justify-content:center;padding:80px 20px;color:var(--text2);gap:10px}
`;

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function categoryEmoji(cat?: string | null) {
  const found = MARKETPLACE_CATEGORIES.find((c) => c.id === cat);
  return found?.icon || "🍽️";
}

export default function MarketplacePublico() {
  const [stores, setStores] = useState<MarketplaceStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "marketplace" },
        });
        if (!error && data?.success && Array.isArray(data.stores)) {
          setStores(data.stores);
          return;
        }

        const { data: rows, error: dbError } = await supabase
          .from("loja_configuracoes" as any)
          .select("slug, nome_loja, descricao_loja, logo_url, banner_url, pedido_minimo, taxa_entrega, aceita_entrega, aceita_retirada, endereco_loja, cor_primaria, tempo_preparo_min")
          .not("slug", "is", null)
          .order("nome_loja");

        if (dbError) throw dbError;
        setStores((rows as MarketplaceStore[]) || []);
      } catch (e) {
        console.error("marketplace load:", e);
        setStores([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (category !== "todos" && s.categoria_marketplace !== category) return false;
      if (!q) return true;
      const name = (s.nome_loja || "").toLowerCase();
      const desc = (s.descricao_loja || "").toLowerCase();
      const addr = (s.endereco_loja || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || addr.includes(q);
    });
  }, [stores, search, category]);

  return (
    <div className="marketplace-root">
      <style>{MARKETPLACE_CSS}</style>

      <header className="m-header">
        <Link to="/marketplace" className="m-logo">
          <span className="m-logo-flame">🔥</span>
          <div>
            <div className="m-logo-text">{MARKETPLACE_TITLE}</div>
            <div className="m-logo-sub">{MARKETPLACE_SUBTITLE}</div>
          </div>
        </Link>
        <a className="m-admin-link" href="/auth">Área do restaurante</a>
      </header>

      <section className="m-hero">
        <div className="m-hero-bg" />
        <div className="m-hero-glow" />
        <div className="m-hero-inner">
          <div className="m-hero-badge">🛵 Marketplace local</div>
          <h1 className="m-hero-title">
            Peça de vários <em>restaurantes</em> em um só lugar
          </h1>
          <p className="m-hero-sub">
            Escolha o restaurante, abra o cardápio individual e faça seu pedido com entrega ou retirada — como no iFood, no {APP_NAME}.
          </p>
          <div className="m-hero-stats">
            <div>
              <div className="m-stat-val">{stores.length}</div>
              <div className="m-stat-lbl">Restaurantes</div>
            </div>
            <div>
              <div className="m-stat-val">24h</div>
              <div className="m-stat-lbl">Pedidos online</div>
            </div>
            <div>
              <div className="m-stat-val">Águas Bela</div>
              <div className="m-stat-lbl">Região</div>
            </div>
          </div>
        </div>
      </section>

      <div className="m-search-wrap">
        <div className="m-search-inner">
          <span className="m-search-icon">🔍</span>
          <input
            className="m-search-input"
            placeholder="Buscar restaurante, pizza, lanche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="m-pills">
        {MARKETPLACE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`m-pill ${category === cat.id ? "active" : ""}`}
            onClick={() => setCategory(cat.id)}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <main className="m-main">
        <h2 className="m-section-title">
          <span>🏪</span>
          Restaurantes disponíveis
          <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>
            ({filtered.length})
          </span>
        </h2>

        {loading ? (
          <div className="m-loading">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando restaurantes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="m-empty">
            <div className="m-empty-icon">🍽️</div>
            <p>
              {stores.length === 0
                ? "Nenhum restaurante publicado ainda. Configure o cardápio digital em cada loja para aparecer aqui."
                : "Nenhum restaurante encontrado com essa busca."}
            </p>
          </div>
        ) : (
          <div className="m-grid">
            {filtered.map((store) => {
              const min = Number(store.pedido_minimo || 0);
              const taxa = Number(store.taxa_entrega || 0);
              const emoji = categoryEmoji(store.categoria_marketplace);
              return (
                <Link key={store.slug} to={`/cardapio/${store.slug}`} className="m-card">
                  <div className="m-card-banner">
                    {store.banner_url ? (
                      <img src={store.banner_url} alt="" />
                    ) : (
                      <div className="m-card-banner-ph">{emoji}</div>
                    )}
                    {store.logo_url ? (
                      <img className="m-card-logo" src={store.logo_url} alt="" />
                    ) : (
                      <div className="m-card-logo-ph">{emoji}</div>
                    )}
                  </div>
                  <div className="m-card-body">
                    <div className="m-card-name">{store.nome_loja || store.slug}</div>
                    {store.descricao_loja && (
                      <div className="m-card-desc">{store.descricao_loja}</div>
                    )}
                    <div className="m-card-meta">
                      {store.aceita_entrega && <span className="m-tag green">🛵 Entrega</span>}
                      {store.aceita_retirada && <span className="m-tag">🏪 Retirada</span>}
                      {min > 0 && <span className="m-tag">Mín. {fmtMoney(min)}</span>}
                      {taxa > 0 && <span className="m-tag">Taxa {fmtMoney(taxa)}</span>}
                    </div>
                  </div>
                  <div className="m-card-footer">
                    <span>{store.endereco_loja || "Águas Bela"}</span>
                    <span className="m-card-cta">Ver cardápio →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

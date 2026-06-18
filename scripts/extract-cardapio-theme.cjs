const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "../src/pages/CardapioPublico.tsx");
const outPath = path.join(__dirname, "../src/styles/cardapioTheme.ts");
const src = fs.readFileSync(srcPath, "utf8");
const start = src.indexOf("const CARDAPIO_CSS = `");
const end = src.indexOf("`;", start);
if (start === -1 || end === -1) throw new Error("CARDAPIO_CSS block not found");
const css = src.slice(start + "const CARDAPIO_CSS = `".length, end);

const chatCss = `
.cardapio-chat-root{min-height:0;height:100%;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;position:relative}
.cardapio-chat-root::before{position:absolute}
.cardapio-chat-root .c-header{position:relative;flex-shrink:0}
.cardapio-chat-root .c-nav-pills{position:relative;top:0;flex-shrink:0}
.cardapio-chat-body{flex:1;display:flex;min-height:0;overflow:hidden;position:relative;z-index:1}
.cardapio-chat-menu{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.cardapio-chat-menu .c-main{flex:1;overflow-y:auto;padding-bottom:24px;max-width:none;margin:0}
.cardapio-chat-cart{width:min(360px,36%);display:flex;flex-direction:column;background:var(--dark2);border-left:1px solid var(--border);min-height:0;position:relative;z-index:1}
.cardapio-chat-cart .c-cart-body{flex:1;overflow-y:auto;padding:14px 16px}
.cardapio-chat-cart .c-cart-foot{padding:14px 16px;border-top:1px solid var(--border);background:var(--dark2)}
.cardapio-chat-loading{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text2)}
.cardapio-chat-checkout{flex:1;overflow-y:auto;padding:20px 22px;position:relative;z-index:1}
.cardapio-chat-checkout .c-cart-title{margin-bottom:16px}
.cardapio-chat-actions{display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--border);background:var(--dark2);position:relative;z-index:1}
.cardapio-chat-back{flex:1;height:46px;border-radius:12px;border:1.5px solid var(--border2);background:transparent;color:var(--text);font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer}
.cardapio-chat-back:hover{border-color:var(--fire2);color:var(--fire2)}
.cardapio-chat-root .c-modal-overlay{z-index:500}
@media(max-width:900px){
  .cardapio-chat-body{flex-direction:column}
  .cardapio-chat-cart{width:100%;max-height:42%;border-left:none;border-top:1px solid var(--border)}
}
`;

const out = `export const CARDAPIO_CSS = \`${css}\`;

export const CARDAPIO_CHAT_CSS = \`${chatCss}\`;

export const categoryEmoji = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("tradicional")) return "🍕";
  if (c.includes("especi")) return "✨";
  if (c.includes("doce")) return "🍫";
  if (c.includes("combo")) return "🎁";
  if (c.includes("bebida")) return "🥤";
  if (c.includes("salgad")) return "🥟";
  if (c.includes("burger") || c.includes("hambur")) return "🍔";
  return "🍽️";
};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath);

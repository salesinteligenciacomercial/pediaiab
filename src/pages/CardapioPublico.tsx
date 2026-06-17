import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, User, Star, LogOut } from "lucide-react";
import { toast } from "sonner";

// ───────────────────────────────────────────────────────────────
// CSS extracted from the approved mockup (dark theme, mobile-first)
// ───────────────────────────────────────────────────────────────
const CARDAPIO_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&display=swap');
.cardapio-root *{box-sizing:border-box}
.cardapio-root{
  --fire:#FF4500;--fire2:#FF6B1A;--fire3:#FFB347;--cream:#FFF8F0;
  --dark:#0D0A08;--dark2:#1A1410;--dark3:#251E17;--dark4:#322820;
  --border:rgba(255,180,100,0.12);--border2:rgba(255,180,100,0.22);
  --text:#F5EAD8;--text2:#B8A898;--text3:#7A6A5A;
  --gold:#D4A853;--gold2:#F0C878;--green:#2EC98A;
  --font-display:'Playfair Display',serif;--font:'Outfit',sans-serif;
  background:var(--dark);color:var(--text);font-family:var(--font);font-size:15px;line-height:1.6;
  min-height:100vh;overflow-x:hidden;position:relative;
}
.cardapio-root::before{content:'';position:fixed;inset:0;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events:none;z-index:0;opacity:.6}
.cardapio-root img{display:block}

.c-header{position:sticky;top:0;z-index:100;background:rgba(13,10,8,0.92);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);padding:0 16px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.c-logo-wrap{display:flex;align-items:center;gap:9px;min-width:0}
.c-logo-flame{font-size:22px;filter:drop-shadow(0 0 8px rgba(255,107,26,.7))}
.c-logo-text{font-family:var(--font-display);font-size:18px;font-weight:700;
  background:linear-gradient(135deg,var(--fire3),var(--fire2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55vw}
.c-header-actions{display:flex;gap:6px;align-items:center}
.c-icon-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;
  transition:all .2s;text-decoration:none;flex-shrink:0}
.c-icon-btn:hover{background:rgba(255,107,26,.15);border-color:rgba(255,107,26,.4);color:var(--fire2)}
.c-cart-btn{display:flex;align-items:center;gap:8px;background:var(--fire);border:none;border-radius:100px;
  padding:8px 14px;color:#fff;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;
  transition:all .2s;box-shadow:0 4px 20px rgba(255,69,0,.35)}
.c-cart-btn:hover{background:var(--fire2)}
.c-cart-count{background:rgba(255,255,255,.25);border-radius:100px;padding:1px 7px;font-size:12px;font-weight:700}

.c-hero{position:relative;overflow:hidden;min-height:340px;display:flex;align-items:flex-end}
.c-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,#1a0a00 0%,#2d1200 50%,#0d0a08 100%)}
.c-hero-blur{position:absolute;right:-60px;top:-40px;width:420px;height:420px;
  background:radial-gradient(circle,rgba(255,107,26,.18) 0%,transparent 65%);border-radius:50%}
.c-hero-glow{position:absolute;left:10%;bottom:0;width:280px;height:120px;
  background:radial-gradient(ellipse,rgba(255,69,0,.2) 0%,transparent 70%)}
.c-hero-emoji{position:absolute;right:4%;top:50%;transform:translateY(-50%);
  font-size:clamp(110px,22vw,190px);filter:drop-shadow(0 0 40px rgba(255,107,26,.5));
  animation:c-float 4s ease-in-out infinite;user-select:none;pointer-events:none}
@keyframes c-float{0%,100%{transform:translateY(-50%) rotate(-5deg)}50%{transform:translateY(calc(-50% - 14px)) rotate(2deg)}}
.c-hero-content{position:relative;z-index:2;padding:32px 20px 36px;max-width:560px}
.c-hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,69,0,.15);
  border:1px solid rgba(255,69,0,.35);border-radius:100px;padding:5px 12px;
  font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--fire2);margin-bottom:16px}
.c-hero-badge i{width:7px;height:7px;background:var(--green);border-radius:50%;animation:c-pulse 1.5s ease-in-out infinite;display:inline-block}
@keyframes c-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}
.c-hero-title{font-family:var(--font-display);font-size:clamp(30px,7vw,52px);font-weight:900;line-height:1.05;letter-spacing:-1.5px;margin-bottom:12px}
.c-hero-title em{font-style:italic;background:linear-gradient(135deg,var(--fire3),var(--fire));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.c-hero-sub{color:var(--text2);font-size:14px;font-weight:300;margin-bottom:20px;max-width:340px;line-height:1.65}
.c-hero-stats{display:flex;gap:24px;flex-wrap:wrap}
.c-stat-val{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--fire2)}
.c-stat-lbl{font-size:10px;color:var(--text3);letter-spacing:.04em;text-transform:uppercase}

.c-status-bar{background:var(--dark2);border-bottom:1px solid var(--border);padding:10px 16px;
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;position:relative;z-index:1}
.c-status-open{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600}
.c-dot-green{width:8px;height:8px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);
  flex-shrink:0;animation:c-pulse 1.8s ease-in-out infinite;display:inline-block}
.c-status-chips{display:flex;gap:6px;flex-wrap:wrap}
.c-chip{font-size:11.5px;padding:4px 10px;border-radius:100px;background:rgba(255,255,255,.05);
  border:1px solid var(--border);color:var(--text2);white-space:nowrap}
.c-chip.hot{background:rgba(255,69,0,.1);border-color:rgba(255,69,0,.3);color:var(--fire2)}

.c-search-wrap{padding:12px 16px;background:var(--dark);border-bottom:1px solid var(--border);position:relative;z-index:1}
.c-search-inner{max-width:600px;margin:0 auto;position:relative}
.c-search-input{width:100%;background:var(--dark3);border:1.5px solid var(--border2);border-radius:100px;
  color:var(--text);font-family:var(--font);font-size:14px;padding:11px 18px 11px 42px;outline:none;transition:all .2s}
.c-search-input:focus{border-color:var(--fire2);box-shadow:0 0 0 4px rgba(255,107,26,.12)}
.c-search-input::placeholder{color:var(--text3)}
.c-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}

.c-nav-pills{overflow-x:auto;scrollbar-width:none;padding:12px 16px;display:flex;gap:7px;
  border-bottom:1px solid var(--border);background:var(--dark);position:sticky;top:60px;z-index:90}
.c-nav-pills::-webkit-scrollbar{display:none}
.c-pill{flex-shrink:0;padding:7px 15px;border-radius:100px;border:1.5px solid var(--border);
  background:transparent;font-family:var(--font);font-size:12.5px;font-weight:500;color:var(--text2);
  cursor:pointer;transition:all .18s;white-space:nowrap;display:flex;align-items:center;gap:6px}
.c-pill:hover{border-color:var(--border2);color:var(--text)}
.c-pill.active{background:var(--fire);border-color:var(--fire);color:#fff;font-weight:600;box-shadow:0 4px 16px rgba(255,69,0,.3)}
.c-pill-count{background:rgba(255,255,255,.2);border-radius:100px;padding:0 6px;font-size:10.5px;font-weight:700}

.c-main{max-width:900px;margin:0 auto;padding:22px 16px 140px;position:relative;z-index:1}
.c-section-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;gap:10px}
.c-section-title{font-family:var(--font-display);font-size:20px;font-weight:700;letter-spacing:-.5px}
.c-section-sub{font-size:11px;color:var(--text3);letter-spacing:.04em;text-transform:uppercase}

.c-destaques-scroll{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;
  padding:0 16px 6px;margin:0 -16px}
.c-destaques-scroll::-webkit-scrollbar{display:none}
.c-destaque-card{flex-shrink:0;width:150px;background:var(--dark2);border:1px solid var(--border);
  border-radius:14px;overflow:hidden;cursor:pointer;transition:all .22s;position:relative}
.c-destaque-card:hover{transform:translateY(-3px);border-color:rgba(255,107,26,.4);
  box-shadow:0 10px 28px rgba(0,0,0,.5)}
.c-destaque-img{width:100%;height:100px;object-fit:cover;background:var(--dark3);transition:transform .4s}
.c-destaque-img-ph{width:100%;height:100px;display:flex;align-items:center;justify-content:center;font-size:42px;
  background:repeating-linear-gradient(45deg,var(--dark3) 0,var(--dark3) 10px,var(--dark4) 10px,var(--dark4) 20px)}
.c-destaque-card:hover .c-destaque-img{transform:scale(1.08)}
.c-destaque-badge{position:absolute;top:8px;left:8px;background:var(--fire);color:#fff;font-size:9px;
  font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:100px}
.c-destaque-body{padding:9px 11px}
.c-destaque-name{font-size:12.5px;font-weight:600;line-height:1.3;margin-bottom:4px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text)}
.c-destaque-price{font-size:14px;font-weight:700;background:linear-gradient(135deg,var(--fire3),var(--fire2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

.c-category-section{margin-bottom:34px;scroll-margin-top:140px}
.c-cat-label{font-family:var(--font-display);font-size:17px;font-weight:700;letter-spacing:-.3px;
  margin-bottom:13px;padding-bottom:10px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:10px}
.c-cat-label small{font-size:12px;color:var(--text3);font-family:var(--font);font-weight:400}
.c-prod-list{display:flex;flex-direction:column;gap:10px}
.c-prod-item{background:var(--dark2);border:1px solid var(--border);border-radius:14px;overflow:hidden;
  display:flex;cursor:pointer;transition:all .2s;position:relative;text-align:left;width:100%;
  font-family:inherit;color:inherit;padding:0}
.c-prod-item:hover{border-color:rgba(255,107,26,.35);box-shadow:0 6px 24px rgba(0,0,0,.4);transform:translateX(3px)}
.c-prod-info{flex:1;padding:14px;min-width:0;display:flex;flex-direction:column;gap:5px}
.c-prod-name{font-size:14.5px;font-weight:600;line-height:1.3;color:var(--text)}
.c-prod-desc{font-size:12px;color:var(--text2);line-height:1.55;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.c-prod-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}
.c-prod-price-from{font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}
.c-prod-price{font-size:17px;font-weight:700;background:linear-gradient(135deg,var(--fire3),var(--fire));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.5px}
.c-half-badge{background:rgba(255,179,71,.12);color:var(--fire3);border:1px solid rgba(255,179,71,.3);
  font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;white-space:nowrap}
.c-prod-img-wrap{width:100px;flex-shrink:0;position:relative;overflow:hidden;background:var(--dark3)}
.c-prod-img{width:100%;height:100%;object-fit:cover;min-height:100px;transition:transform .4s}
.c-prod-item:hover .c-prod-img{transform:scale(1.1)}
.c-prod-img-ph{width:100%;height:100%;min-height:100px;display:flex;align-items:center;justify-content:center;
  font-size:38px;background:repeating-linear-gradient(45deg,var(--dark3) 0,var(--dark3) 10px,var(--dark4) 10px,var(--dark4) 20px)}
.c-add-circle{position:absolute;bottom:7px;right:7px;width:30px;height:30px;border-radius:50%;
  background:var(--fire);color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:300;box-shadow:0 2px 10px rgba(255,69,0,.5);line-height:1}

/* MODAL */
.c-modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);
  display:flex;align-items:flex-end;justify-content:center;animation:c-fade .25s ease}
@keyframes c-fade{from{opacity:0}to{opacity:1}}
.c-modal{background:var(--dark2);border:1px solid var(--border2);border-bottom:none;
  border-radius:22px 22px 0 0;width:100%;max-width:540px;max-height:94vh;overflow-y:auto;
  scrollbar-width:thin;animation:c-slideup .3s cubic-bezier(.32,0,.15,1);color:var(--text);font-family:var(--font)}
@keyframes c-slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.c-modal-img{width:100%;height:200px;object-fit:cover;flex-shrink:0}
.c-modal-img-ph{width:100%;height:160px;display:flex;align-items:center;justify-content:center;font-size:72px;
  background:linear-gradient(135deg,var(--dark3),var(--dark4))}
.c-modal-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;
  background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:none;color:#fff;font-size:17px;
  display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10}
.c-modal-body{padding:18px}
.c-modal-name{font-family:var(--font-display);font-size:21px;font-weight:700;letter-spacing:-.5px;margin-bottom:6px;line-height:1.2}
.c-modal-desc{color:var(--text2);font-size:13px;line-height:1.6;margin-bottom:14px}
.c-modal-price{font-size:24px;font-weight:700;background:linear-gradient(135deg,var(--fire3),var(--fire));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-1px;margin-bottom:18px}
.c-sub2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--fire2);
  margin-bottom:10px;display:flex;align-items:center;gap:6px}
.c-sub2 .c-hint{color:var(--text3);font-weight:400;font-size:10.5px;letter-spacing:.02em;text-transform:none}

.c-sizes-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:18px}
@media(max-width:480px){.c-sizes-grid{grid-template-columns:repeat(3,1fr)}}
.c-size-btn{border:2px solid var(--border2);border-radius:11px;background:transparent;padding:8px 4px;
  text-align:center;cursor:pointer;transition:all .18s;font-family:var(--font);color:var(--text)}
.c-size-btn:hover{border-color:rgba(255,107,26,.4);background:rgba(255,107,26,.06)}
.c-size-btn.active{border-color:var(--fire);background:rgba(255,69,0,.12);box-shadow:0 0 0 3px rgba(255,69,0,.12)}
.c-size-name{font-size:11.5px;font-weight:700;margin-bottom:2px}
.c-size-info{font-size:9.5px;color:var(--text3);line-height:1.3}
.c-size-price{font-size:11.5px;font-weight:700;color:var(--fire2);margin-top:3px}

.c-flavor-search{background:var(--dark3);border:1.5px solid var(--border2);border-radius:10px;
  padding:10px 13px;color:var(--text);font-family:var(--font);font-size:13px;width:100%;outline:none;margin-bottom:10px}
.c-flavor-search:focus{border-color:var(--fire2)}
.c-flavor-list{max-height:200px;overflow-y:auto;scrollbar-width:thin;display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.c-flavor-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;
  background:var(--dark3);border:1.5px solid var(--border);cursor:pointer;transition:all .15s;
  font-family:inherit;color:inherit;text-align:left;width:100%}
.c-flavor-item:hover{border-color:rgba(255,107,26,.35);background:rgba(255,107,26,.06)}
.c-flavor-item.selected{border-color:var(--fire);background:rgba(255,69,0,.1)}
.c-flavor-check{width:20px;height:20px;border-radius:6px;border:2px solid var(--border2);flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff}
.c-flavor-item.selected .c-flavor-check{background:var(--fire);border-color:var(--fire)}
.c-flavor-text{flex:1;min-width:0}
.c-flavor-name{font-size:13px;font-weight:600;line-height:1.2;color:var(--text)}
.c-flavor-desc{font-size:11px;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-flavor-price-tag{font-size:11.5px;font-weight:700;color:var(--fire2);flex-shrink:0}

.c-bordas-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px}
.c-borda-btn{padding:10px 11px;border-radius:10px;border:1.5px solid var(--border);background:transparent;
  cursor:pointer;text-align:left;transition:all .15s;font-family:var(--font);color:var(--text)}
.c-borda-btn:hover{border-color:rgba(255,107,26,.35)}
.c-borda-btn.active{border-color:var(--fire);background:rgba(255,69,0,.1)}
.c-borda-name{font-size:12.5px;font-weight:600}
.c-borda-price{font-size:10.5px;color:var(--fire2);margin-top:2px;font-weight:600}

.c-obs-input{width:100%;background:var(--dark3);border:1.5px solid var(--border);border-radius:10px;
  color:var(--text);font-family:var(--font);font-size:13px;padding:10px 13px;resize:none;outline:none}
.c-obs-input:focus{border-color:var(--fire2)}
.c-obs-input::placeholder{color:var(--text3)}

.c-modal-footer{display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid var(--border);
  background:var(--dark2);position:sticky;bottom:0}
.c-qty-ctrl{display:flex;align-items:center;gap:6px}
.c-qty-btn{width:34px;height:34px;border-radius:50%;border:1.5px solid var(--border2);background:transparent;
  color:var(--text);font-size:18px;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1}
.c-qty-btn:hover{border-color:var(--fire);background:rgba(255,69,0,.1);color:var(--fire2)}
.c-qty-val{font-size:16px;font-weight:700;min-width:24px;text-align:center}
.c-add-btn{flex:1;height:46px;border-radius:12px;border:none;
  background:linear-gradient(135deg,var(--fire2),var(--fire));color:#fff;font-family:var(--font);
  font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(255,69,0,.4);
  display:flex;align-items:center;justify-content:center;gap:8px}
.c-add-btn:hover{transform:translateY(-1px);box-shadow:0 6px 28px rgba(255,69,0,.5)}
.c-add-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

/* CART DRAWER */
.c-cart-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);animation:c-fade .25s}
.c-cart-drawer{position:fixed;bottom:0;right:0;left:0;top:0;max-width:460px;margin-left:auto;
  background:var(--dark2);border-left:1px solid var(--border2);z-index:301;display:flex;flex-direction:column;
  animation:c-slidex .3s cubic-bezier(.32,0,.15,1);color:var(--text);font-family:var(--font)}
@keyframes c-slidex{from{transform:translateX(100%)}to{transform:translateX(0)}}
.c-cart-head{padding:18px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;background:var(--dark2)}
.c-cart-title{font-family:var(--font-display);font-size:19px;font-weight:700}
.c-cart-body{flex:1;overflow-y:auto;padding:14px 18px;scrollbar-width:thin}
.c-cart-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)}
.c-cart-item-info{flex:1;min-width:0}
.c-cart-item-name{font-size:13.5px;font-weight:600;line-height:1.3;margin-bottom:3px;color:var(--text)}
.c-cart-item-obs{font-size:11.5px;color:var(--text3);margin-bottom:6px}
.c-cart-item-price{font-size:14px;font-weight:700;color:var(--fire2)}
.c-cq-wrap{display:flex;align-items:center;gap:6px;margin-top:7px}
.c-cq-btn{width:26px;height:26px;border-radius:8px;border:1px solid var(--border2);background:transparent;
  color:var(--text2);font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1}
.c-cq-btn:hover{border-color:var(--fire);color:var(--fire2)}
.c-cq-val{font-size:13px;font-weight:600;min-width:18px;text-align:center}

.c-empty-cart{text-align:center;padding:50px 20px}
.c-empty-icon{font-size:56px;margin-bottom:12px;opacity:.4}
.c-empty-text{color:var(--text3);font-size:14px}

.c-cart-form{padding:14px 18px;border-top:1px solid var(--border);background:var(--dark2)}
.c-form-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:11px}
.c-form-field{display:flex;flex-direction:column;gap:5px}
.c-form-label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text3)}
.c-form-input,.c-form-textarea,.c-form-select{background:var(--dark3);border:1.5px solid var(--border);
  border-radius:10px;color:var(--text);font-family:var(--font);font-size:13px;padding:9px 12px;
  outline:none;width:100%}
.c-form-input:focus,.c-form-textarea:focus,.c-form-select:focus{border-color:var(--fire2)}
.c-form-input::placeholder,.c-form-textarea::placeholder{color:var(--text3)}
.c-form-textarea{resize:none}
.c-form-select{cursor:pointer}

.c-total-box{background:var(--dark3);border-radius:12px;padding:13px;margin-bottom:13px}
.c-total-row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--text2);margin-bottom:5px}
.c-total-final{display:flex;justify-content:space-between;font-size:16px;font-weight:700;padding-top:7px;border-top:1px solid var(--border);color:var(--text)}
.c-total-val{color:var(--fire2)}

.c-submit-btn{width:100%;height:50px;border-radius:14px;border:none;
  background:linear-gradient(135deg,var(--fire2),var(--fire));color:#fff;font-family:var(--font);
  font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 24px rgba(255,69,0,.4);
  display:flex;align-items:center;justify-content:center;gap:10px}
.c-submit-btn:hover{transform:translateY(-1px);box-shadow:0 6px 32px rgba(255,69,0,.5)}
.c-submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

/* STICKY CART */
.c-sticky-cart{position:fixed;bottom:0;inset-inline:0;z-index:99;padding:12px 14px;
  background:linear-gradient(transparent,rgba(13,10,8,.97) 35%);pointer-events:none}
.c-sticky-cart-btn{pointer-events:all;width:100%;max-width:500px;margin:0 auto;display:flex;
  height:54px;border-radius:16px;border:none;background:linear-gradient(135deg,var(--fire2),var(--fire));
  color:#fff;font-family:var(--font);font-size:14.5px;font-weight:700;cursor:pointer;
  box-shadow:0 6px 28px rgba(255,69,0,.45);align-items:center;justify-content:space-between;padding:0 16px}
.c-cart-left{display:flex;align-items:center;gap:10px}
.c-cart-pill{background:rgba(255,255,255,.25);border-radius:100px;width:26px;height:26px;
  display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700}

.c-wa-btn{position:fixed;right:16px;bottom:84px;z-index:98;width:50px;height:50px;border-radius:50%;
  background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:22px;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,.4);transition:transform .2s}
.c-wa-btn:hover{transform:scale(1.1)}

@keyframes c-fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.c-fade-up{animation:c-fadeUp .4s ease both}

@media(max-width:500px){
  .c-destaque-card{width:140px}
  .c-hero-emoji{opacity:.85}
  .c-hero-content{padding-right:140px}
}
`;

type Product = {
  id: string;
  nome: string;
  descricao_curta?: string | null;
  descricao_completa?: string | null;
  descricao?: string | null;
  preco_sugerido: number;
  categoria?: string | null;
  imagem_url?: string | null;
  destaque_cardapio?: boolean;
  permite_observacao?: boolean;
  permite_meio_a_meio?: boolean;
};

type StoreConfig = {
  nome_loja?: string | null;
  descricao_loja?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  telefone_loja?: string | null;
  endereco_loja?: string | null;
  pedido_minimo?: number | null;
  taxa_entrega?: number | null;
  aceita_retirada?: boolean;
  aceita_entrega?: boolean;
  mensagem_loja?: string | null;
  horario_funcionamento?: Record<string, string>;
  horario_abertura?: string | null;
  aberto?: boolean;
};

type CartItem = { product: Product; quantity: number; observations: string };

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categoryEmoji = (cat: string) => {
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

export default function CardapioPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [config, setConfig] = useState<StoreConfig>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [pizzaSizes, setPizzaSizes] = useState<Array<{ id: string; nome: string; slug: string; multiplicador: number; max_sabores: number; fatias: number; descricao?: string | null }>>([]);
  const [pizzaBordas, setPizzaBordas] = useState<Array<{ id: string; nome: string; descricao?: string | null; ordem?: number }>>([]);
  const [pizzaBordaPrecos, setPizzaBordaPrecos] = useState<Array<{ borda_id: string; tamanho_id: string; preco: number }>>([]);
  const [selectedBordaId, setSelectedBordaId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedObs, setSelectedObs] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [extraFlavors, setExtraFlavors] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [flavorSearch, setFlavorSearch] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activePill, setActivePill] = useState<string>("destaques");

  const CUSTOMER_STORAGE_KEY = `cardapio_customer_${slug || "default"}`;
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [customer, setCustomer] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(`cardapio_customer_${slug || "default"}`) : null;
      if (saved) {
        const p = JSON.parse(saved);
        return {
          nome: p.nome || "",
          telefone: p.telefone || "",
          tipo_atendimento: p.tipo_atendimento || "entrega",
          forma_pagamento: p.forma_pagamento || "pix",
          observacoes: "",
          endereco: p.endereco || "",
        };
      }
    } catch {/* ignore */}
    return { nome: "", telefone: "", tipo_atendimento: "entrega", forma_pagamento: "pix", observacoes: "", endereco: "" };
  });

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountData, setAccountData] = useState<{ pedidos: number; total: number; pontos: number } | null>(null);
  const isLogged = !!(customer.nome && customer.telefone);

  // 🔐 "Login" automático por telefone: ao informar telefone válido, busca dados salvos
  const lastFetchedPhone = useRef<string>("");
  useEffect(() => {
    const tel = String(customer.telefone || "").replace(/\D/g, "");
    if (tel.length < 10 || tel === lastFetchedPhone.current) return;
    lastFetchedPhone.current = tel;
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "customer", slug, telefone: tel },
        });
        if (data?.success) {
          setCustomer((prev) => {
            const next = { ...prev };
            if (!prev.nome && data.nome) next.nome = data.nome;
            if (!prev.endereco && data.endereco?.logradouro) {
              const e = data.endereco;
              next.endereco = [e.logradouro, e.numero, e.bairro, e.cidade]
                .filter(Boolean).join(", ");
            }
            // Persistir no localStorage para próximas visitas
            try {
              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                nome: next.nome, telefone: next.telefone,
                tipo_atendimento: next.tipo_atendimento,
                forma_pagamento: next.forma_pagamento,
                endereco: next.endereco,
              }));
            } catch {/* ignore */}
            return next;
          });
          if (data.nome || data.endereco?.logradouro) {
            toast.success("Bem-vindo de volta! Seus dados foram preenchidos.");
          }
        }
      } catch (e) { console.error("auto-login customer:", e); }
    }, 500);
    return () => clearTimeout(timer);
  }, [customer.telefone, slug]);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
          body: { action: "menu", slug },
        });
        if (error) throw error;
        if (!data?.success) { setNotFound(true); return; }
        setConfig(data.store || {});
        setProducts(data.products || []);
        setPizzaSizes(data.pizzaSizes || []);
        setPizzaBordas(data.pizzaBordas || []);
        setPizzaBordaPrecos(data.pizzaBordaPrecos || []);
      } catch (error) {
        console.error(error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const isPizzaProduct = (product?: Product | null) => {
    if (!product) return false;
    const n = (product.nome || "").toLowerCase();
    const c = (product.categoria || "").toLowerCase();
    return !!product.permite_meio_a_meio || n.includes("pizza") || c.includes("pizza");
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.descricao_curta || "").toLowerCase().includes(q) ||
        (p.descricao || "").toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const categories = useMemo(
    () => Array.from(new Set(filteredProducts.map((p) => p.categoria || "Outros"))),
    [filteredProducts]
  );

  const destaques = useMemo(
    () => products.filter((p) => p.destaque_cardapio).slice(0, 10),
    [products]
  );
  const topShown = destaques.length > 0 ? destaques : products.slice(0, 8);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.preco_sugerido || 0) * item.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const deliveryFee = customer.tipo_atendimento === "entrega" ? Number(config.taxa_entrega || 0) : 0;
  const total = subtotal + deliveryFee;

  const DEFAULT_SIZES = [
    { id: "brotinho", label: "Brotinho", multiplier: 0.625, maxFlavors: 1, slices: 4, descricao: "1 sabor" },
    { id: "pequena", label: "Pequena", multiplier: 1, maxFlavors: 2, slices: 6, descricao: "Até 2 sabores" },
    { id: "media", label: "Média", multiplier: 1.343, maxFlavors: 2, slices: 8, descricao: "Até 2 sabores" },
    { id: "grande", label: "Grande", multiplier: 1.5, maxFlavors: 3, slices: 10, descricao: "Até 3 sabores" },
    { id: "gigante", label: "Gigante", multiplier: 1.875, maxFlavors: 4, slices: 12, descricao: "Até 4 sabores" },
  ];

  const SIZE_OPTIONS = useMemo(() => {
    if (pizzaSizes.length > 0) {
      return pizzaSizes.map((s) => ({
        id: s.slug, tamanhoId: s.id, label: s.nome,
        multiplier: Number(s.multiplicador) || 1,
        maxFlavors: s.max_sabores || 1, slices: s.fatias || 1,
        descricao: s.descricao || "",
      }));
    }
    return DEFAULT_SIZES.map((d) => ({ ...d, tamanhoId: "" }));
  }, [pizzaSizes]);

  useEffect(() => {
    if (!selectedProduct) return;
    setFlavorSearch("");
    if (isPizzaProduct(selectedProduct)) {
      setSelectedSize(""); setExtraFlavors([]); setSelectedBordaId("");
      return;
    }
    if (SIZE_OPTIONS.length > 0 && !SIZE_OPTIONS.find((s) => s.id === selectedSize)) {
      setSelectedSize(SIZE_OPTIONS[Math.min(1, SIZE_OPTIONS.length - 1)].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const selectedPizzaSize = selectedSize ? SIZE_OPTIONS.find((s) => s.id === selectedSize) : undefined;

  const getBordaPriceForSize = (bordaId: string, tamanhoId: string) => {
    const p = pizzaBordaPrecos.find((x) => x.borda_id === bordaId && x.tamanho_id === tamanhoId);
    return Number(p?.preco || 0);
  };
  const selectedBorda = pizzaBordas.find((b) => b.id === selectedBordaId);

  const computePizzaPrice = (mainProduct: Product, extraIds: string[], sizeMultiplier: number) => {
    const prices = [Number(mainProduct.preco_sugerido || 0)];
    extraIds.forEach((id) => {
      const f = products.find((p) => p.id === id);
      if (f) prices.push(Number(f.preco_sugerido || 0));
    });
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return Math.round(avg * sizeMultiplier * 100) / 100;
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    let productToAdd: Product = selectedProduct;
    let obs = selectedObs;
    const isPizza = isPizzaProduct(selectedProduct);

    if (isPizza && !selectedPizzaSize) {
      toast.error("Selecione o tamanho da pizza");
      return;
    }

    if (isPizza && selectedPizzaSize) {
      const validExtras = extraFlavors.filter(Boolean).slice(0, selectedPizzaSize.maxFlavors - 1);
      const flavorObjs = validExtras.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
      const basePrice = computePizzaPrice(selectedProduct, validExtras, selectedPizzaSize.multiplier);
      const bordaPrice = selectedBorda && selectedPizzaSize.tamanhoId ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId) : 0;
      const finalPrice = Math.round((basePrice + bordaPrice) * 100) / 100;
      const allNames = [selectedProduct.nome, ...flavorObjs.map((f) => f.nome)];
      const totalFlavors = allNames.length;
      const fraction = totalFlavors === 2 ? "½" : totalFlavors === 3 ? "⅓" : totalFlavors === 4 ? "¼" : "";
      const baseName = totalFlavors === 1
        ? `${selectedProduct.nome} (${selectedPizzaSize.label})`
        : `${allNames.map((n) => `${fraction} ${n}`).join(" / ")} (${selectedPizzaSize.label})`;
      const composedName = selectedBorda ? `${baseName} • Borda ${selectedBorda.nome}` : baseName;
      productToAdd = {
        ...selectedProduct,
        id: `${selectedProduct.id}__${selectedPizzaSize.id}__${validExtras.join("_")}__${selectedBorda?.id || "noborda"}`,
        nome: composedName, preco_sugerido: finalPrice,
      };
      if (totalFlavors > 1) obs = obs ? `${totalFlavors} sabores. ${obs}` : `${totalFlavors} sabores`;
      if (selectedBorda) obs = obs ? `Borda ${selectedBorda.nome}. ${obs}` : `Borda ${selectedBorda.nome}`;
    }

    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === productToAdd.id && it.observations === obs);
      if (existing) return prev.map((it) => it === existing ? { ...it, quantity: it.quantity + selectedQty } : it);
      return [...prev, { product: productToAdd, quantity: selectedQty, observations: obs.trim() }];
    });
    setSelectedProduct(null);
    setSelectedObs(""); setSelectedQty(1); setExtraFlavors([]); setSelectedSize(""); setSelectedBordaId("");
    toast.success("Item adicionado ao carrinho");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => prev.map((it, i) => i === index ? { ...it, quantity: it.quantity + delta } : it).filter((it) => it.quantity > 0));
  };

  const submitOrder = async () => {
    if (!cart.length) { toast.error("Adicione itens ao carrinho"); return; }
    if (!customer.nome.trim() || !customer.telefone.trim()) { toast.error("Informe nome e WhatsApp"); return; }
    if (customer.tipo_atendimento === "entrega" && !customer.endereco.trim()) { toast.error("Informe o endereço de entrega"); return; }
    if (total < Number(config.pedido_minimo || 0)) { toast.error("Pedido abaixo do mínimo da loja"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-public-pedidos", {
        body: {
          action: "create", slug, customer,
          items: cart.map((it) => ({
            produto_id: String(it.product.id).split("__")[0],
            produto_nome: it.product.nome,
            quantidade: it.quantity,
            valor_unitario: it.product.preco_sugerido,
            observacoes: it.observations,
          })),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao criar pedido");
      toast.success(`Pedido enviado! Código ${data.codigo_pedido}`);
      try {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
          nome: customer.nome, telefone: customer.telefone,
          tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
          endereco: customer.endereco,
        }));
      } catch {/* ignore */}
      setCart([]); setCartOpen(false);
      setCustomer((prev) => ({ ...prev, observacoes: "" }));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const openAccount = async () => {
    setAccountOpen(true);
    if (!customer.telefone) return;
    setAccountLoading(true);
    try {
      const { data } = await supabase.functions.invoke("api-public-pedidos", {
        body: { action: "customer", slug, telefone: customer.telefone },
      });
      if (data?.success) {
        const t = Number(data.total || 0);
        setAccountData({ pedidos: Number(data.pedidos || 0), total: t, pontos: Math.floor(t / 10) });
      }
    } catch (e) { console.error(e); }
    finally { setAccountLoading(false); }
  };

  const logoutAccount = () => {
    try { localStorage.removeItem(CUSTOMER_STORAGE_KEY); } catch {/* ignore */}
    setCustomer({ nome: "", telefone: "", tipo_atendimento: "entrega", forma_pagamento: "pix", observacoes: "", endereco: "" });
    setAccountData(null); setAccountOpen(false);
    toast.success("Cadastro removido deste dispositivo");
  };

  const scrollToSection = (id: string) => {
    setActivePill(id);
    document.getElementById(`c-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="cardapio-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{CARDAPIO_CSS}</style>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF6B1A" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="cardapio-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <style>{CARDAPIO_CSS}</style>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Playfair Display',serif" }}>Cardápio não encontrado</h1>
          <p style={{ color: "#B8A898", marginTop: 6 }}>Verifique o link da loja.</p>
        </div>
      </div>
    );
  }

  const nomeLoja = config.nome_loja || "Rosh Pizzaria";
  const telWa = (config.telefone_loja || "").replace(/\D/g, "");
  const aberto = config.aberto !== false;
  const minimo = Number(config.pedido_minimo || 0);
  const taxa = Number(config.taxa_entrega || 0);

  // filtered flavors for pizza picker
  const availableFlavorsBase = products.filter((p) => isPizzaProduct(p) && p.id !== selectedProduct?.id);
  const visibleFlavors = flavorSearch.trim()
    ? availableFlavorsBase.filter((p) => p.nome.toLowerCase().includes(flavorSearch.toLowerCase()))
    : availableFlavorsBase;

  const selectedExtraIds = extraFlavors.filter(Boolean);
  const maxExtras = (selectedPizzaSize?.maxFlavors || 1) - 1;
  const toggleFlavor = (id: string) => {
    setExtraFlavors((prev) => {
      const cleaned = prev.filter(Boolean);
      if (cleaned.includes(id)) return cleaned.filter((x) => x !== id);
      if (cleaned.length >= maxExtras) {
        toast.error(`Você pode escolher até ${maxExtras} sabor(es) adicional(is)`);
        return cleaned;
      }
      return [...cleaned, id];
    });
  };

  const finalModalPrice = (() => {
    if (!selectedProduct) return 0;
    if (isPizzaProduct(selectedProduct) && selectedPizzaSize) {
      const base = computePizzaPrice(selectedProduct, selectedExtraIds, selectedPizzaSize.multiplier);
      const bordaPrice = selectedBorda && selectedPizzaSize.tamanhoId ? getBordaPriceForSize(selectedBorda.id, selectedPizzaSize.tamanhoId) : 0;
      return Math.round((base + bordaPrice) * 100) / 100;
    }
    return Number(selectedProduct.preco_sugerido || 0);
  })();

  return (
    <div className="cardapio-root">
      <style>{CARDAPIO_CSS}</style>

      {/* HEADER */}
      <header className="c-header">
        <div className="c-logo-wrap">
          <span className="c-logo-flame">🔥</span>
          <span className="c-logo-text">{nomeLoja}</span>
        </div>
        <div className="c-header-actions">
          <a className="c-icon-btn" href="https://instagram.com/roshpizzaria" target="_blank" rel="noopener noreferrer" title="Instagram">📸</a>
          <a className="c-icon-btn" href="https://maps.app.goo.gl/c1MTAgZpNjRQSVKCA" target="_blank" rel="noopener noreferrer" title="Localização">📍</a>
          <button className="c-icon-btn" onClick={() => { setSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 60); }} title="Buscar">🔍</button>
          <button className="c-icon-btn" onClick={openAccount} title="Minha conta" aria-label="Minha conta">
            <User size={16} />
          </button>
          {cartCount > 0 && (
            <button className="c-cart-btn" onClick={() => setCartOpen(true)}>
              🛒 <span className="c-cart-count">{cartCount}</span>
            </button>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="c-hero">
        <div className="c-hero-bg" />
        <div className="c-hero-blur" />
        <div className="c-hero-glow" />
        <div className="c-hero-emoji">🍕</div>
        <div className="c-hero-content">
          <div className="c-hero-badge">
            <i /> {aberto ? "Aberto agora" : "Fechado"}{config.horario_funcionamento ? " · Até 23h" : ""}
          </div>
          <h1 className="c-hero-title">
            Pizza que faz<br /><em>você sonhar</em>
          </h1>
          <p className="c-hero-sub">
            {config.descricao_loja || "Massa artesanal fermentada 24h, ingredientes frescos e entrega ultrarrápida. Peça agora."}
          </p>
          <div className="c-hero-stats">
            <div><div className="c-stat-val">4.9★</div><div className="c-stat-lbl">Avaliação</div></div>
            <div><div className="c-stat-val">30min</div><div className="c-stat-lbl">Entrega</div></div>
            <div><div className="c-stat-val">+2k</div><div className="c-stat-lbl">Pedidos/mês</div></div>
          </div>
        </div>
      </section>

      {/* STATUS BAR */}
      <div className="c-status-bar">
        <div className="c-status-open">
          <span className="c-dot-green" />
          {aberto ? "Aberto agora" : "Fechado"}{aberto ? " — Fecha às 23:00" : ""}
        </div>
        <div className="c-status-chips">
          {taxa > 0 && <span className="c-chip hot">🛵 Entrega {formatBRL(taxa)}</span>}
          {minimo > 0 && <span className="c-chip">Mín {formatBRL(minimo)}</span>}
          <span className="c-chip">Pix · Cartão · Dinheiro</span>
        </div>
      </div>

      {/* SEARCH */}
      {searchOpen && (
        <div className="c-search-wrap c-fade-up">
          <div className="c-search-inner">
            <span className="c-search-icon">🔍</span>
            <input
              ref={searchRef}
              className="c-search-input"
              placeholder="Buscar pizza, bebida, combo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* NAV PILLS */}
      <div className="c-nav-pills">
        {topShown.length > 0 && (
          <button
            className={`c-pill ${activePill === "destaques" ? "active" : ""}`}
            onClick={() => scrollToSection("destaques")}
          >
            ⭐ Mais pedidos
          </button>
        )}
        {categories.map((cat) => {
          const count = filteredProducts.filter((p) => (p.categoria || "Outros") === cat).length;
          const id = cat.replace(/\s+/g, "-");
          return (
            <button
              key={cat}
              className={`c-pill ${activePill === id ? "active" : ""}`}
              onClick={() => scrollToSection(id)}
            >
              {categoryEmoji(cat)} {cat} <span className="c-pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN */}
      <main className="c-main">
        {topShown.length > 0 && (
          <section id="c-sec-destaques" className="c-category-section c-fade-up">
            <div className="c-section-header">
              <h2 className="c-section-title">🔥 Os mais pedidos</h2>
              <span className="c-section-sub">Campeões de venda</span>
            </div>
            <div className="c-destaques-scroll">
              {topShown.map((p) => (
                <div key={p.id} className="c-destaque-card" onClick={() => setSelectedProduct(p)}>
                  <span className="c-destaque-badge">★ Popular</span>
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} className="c-destaque-img" loading="lazy" />
                    : <div className="c-destaque-img-ph">🍕</div>}
                  <div className="c-destaque-body">
                    <div className="c-destaque-name">{p.nome}</div>
                    <div className="c-destaque-price">{formatBRL(p.preco_sugerido)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {categories.map((cat) => {
          const items = filteredProducts.filter((p) => (p.categoria || "Outros") === cat);
          if (!items.length) return null;
          const id = cat.replace(/\s+/g, "-");
          return (
            <section key={cat} id={`c-sec-${id}`} className="c-category-section c-fade-up">
              <div className="c-cat-label">
                {categoryEmoji(cat)} {cat} <small>({items.length} {items.length === 1 ? "item" : "itens"})</small>
              </div>
              <div className="c-prod-list">
                {items.map((p) => (
                  <button key={p.id} className="c-prod-item" onClick={() => setSelectedProduct(p)}>
                    <div className="c-prod-info">
                      <div className="c-prod-name">{p.nome}</div>
                      <div className="c-prod-desc">{p.descricao || p.descricao_curta || p.descricao_completa || "—"}</div>
                      <div className="c-prod-footer">
                        <div>
                          <div className="c-prod-price-from">A partir de</div>
                          <div className="c-prod-price">{formatBRL(p.preco_sugerido)}</div>
                        </div>
                        {isPizzaProduct(p) && <span className="c-half-badge">½ + ½</span>}
                      </div>
                    </div>
                    <div className="c-prod-img-wrap">
                      {p.imagem_url
                        ? <img src={p.imagem_url} alt={p.nome} className="c-prod-img" loading="lazy" />
                        : <div className="c-prod-img-ph">{categoryEmoji(cat)}</div>}
                      <div className="c-add-circle">+</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {filteredProducts.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 20px" }}>
            Nenhum item encontrado.
          </div>
        )}
      </main>

      {/* STICKY CART BAR */}
      {cartCount > 0 && (
        <div className="c-sticky-cart">
          <button className="c-sticky-cart-btn" onClick={() => setCartOpen(true)}>
            <div className="c-cart-left">
              <div className="c-cart-pill">{cartCount}</div>
              <span>Ver meu pedido</span>
            </div>
            <span>{formatBRL(subtotal)}</span>
          </button>
        </div>
      )}

      {/* WHATSAPP */}
      {telWa && (
        <a className="c-wa-btn" href={`https://api.whatsapp.com/send/?phone=${telWa}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
          💬
        </a>
      )}

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <div className="c-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <div className="c-modal">
            <div style={{ position: "relative" }}>
              {selectedProduct.imagem_url
                ? <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="c-modal-img" />
                : <div className="c-modal-img-ph">{categoryEmoji(selectedProduct.categoria || "")}</div>}
              <button className="c-modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="c-modal-body">
              <div className="c-modal-name">{selectedProduct.nome}</div>
              <div className="c-modal-desc">
                {selectedProduct.descricao || selectedProduct.descricao_completa || selectedProduct.descricao_curta || "Sem descrição."}
              </div>
              <div className="c-modal-price">{formatBRL(finalModalPrice)}</div>

              {isPizzaProduct(selectedProduct) && (
                <>
                  <div className="c-sub2">📏 Escolha o tamanho</div>
                  <div className="c-sizes-grid">
                    {SIZE_OPTIONS.map((s) => {
                      const price = computePizzaPrice(selectedProduct, [], s.multiplier);
                      const active = selectedSize === s.id;
                      return (
                        <button
                          key={s.id}
                          className={`c-size-btn ${active ? "active" : ""}`}
                          onClick={() => { setSelectedSize(s.id); setExtraFlavors((prev) => prev.slice(0, s.maxFlavors - 1)); }}
                          title={s.descricao || ""}
                        >
                          <div className="c-size-name">{s.label}</div>
                          <div className="c-size-info">{s.maxFlavors} sab · {s.slices} fat</div>
                          <div className="c-size-price">{formatBRL(price)}</div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                    <>
                      <div className="c-sub2">
                        🍕 Sabores adicionais
                        <span className="c-hint">(até {maxExtras} · {selectedExtraIds.length} selecionado{selectedExtraIds.length !== 1 ? "s" : ""})</span>
                      </div>
                      <input
                        className="c-flavor-search"
                        placeholder="Pesquisar sabor..."
                        value={flavorSearch}
                        onChange={(e) => setFlavorSearch(e.target.value)}
                      />
                      <div className="c-flavor-list">
                        {visibleFlavors.map((f) => {
                          const sel = selectedExtraIds.includes(f.id);
                          return (
                            <button key={f.id} className={`c-flavor-item ${sel ? "selected" : ""}`} onClick={() => toggleFlavor(f.id)}>
                              <div className="c-flavor-check">{sel ? "✓" : ""}</div>
                              <div className="c-flavor-text">
                                <div className="c-flavor-name">{f.nome}</div>
                                <div className="c-flavor-desc">{f.descricao || f.descricao_curta || ""}</div>
                              </div>
                              <div className="c-flavor-price-tag">{formatBRL(f.preco_sugerido)}</div>
                            </button>
                          );
                        })}
                        {visibleFlavors.length === 0 && (
                          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: 12 }}>Nenhum sabor encontrado.</div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedPizzaSize && pizzaBordas.length > 0 && (
                    <>
                      <div className="c-sub2">🥯 Borda recheada <span className="c-hint">(opcional)</span></div>
                      <div className="c-bordas-grid">
                        <button
                          className={`c-borda-btn ${!selectedBordaId ? "active" : ""}`}
                          onClick={() => setSelectedBordaId("")}
                        >
                          <div className="c-borda-name">Sem borda</div>
                          <div className="c-borda-price">Grátis</div>
                        </button>
                        {pizzaBordas.map((b) => {
                          const price = selectedPizzaSize.tamanhoId ? getBordaPriceForSize(b.id, selectedPizzaSize.tamanhoId) : 0;
                          return (
                            <button
                              key={b.id}
                              className={`c-borda-btn ${selectedBordaId === b.id ? "active" : ""}`}
                              onClick={() => setSelectedBordaId(b.id)}
                            >
                              <div className="c-borda-name">{b.nome}</div>
                              <div className="c-borda-price">+ {formatBRL(price)}</div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              <div style={{ marginBottom: 14 }}>
                <div className="c-sub2">📝 Observações <span className="c-hint">(opcional)</span></div>
                <textarea
                  className="c-obs-input"
                  rows={2}
                  placeholder="Ex: sem cebola, bem assada, molho extra..."
                  value={selectedObs}
                  onChange={(e) => setSelectedObs(e.target.value)}
                />
              </div>
            </div>
            <div className="c-modal-footer">
              <div className="c-qty-ctrl">
                <button className="c-qty-btn" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="c-qty-val">{selectedQty}</span>
                <button className="c-qty-btn" onClick={() => setSelectedQty((q) => q + 1)}>+</button>
              </div>
              <button
                className="c-add-btn"
                onClick={addToCart}
                disabled={isPizzaProduct(selectedProduct) && !selectedPizzaSize}
              >
                🛒 Adicionar {formatBRL(finalModalPrice * selectedQty)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="c-cart-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
          <div className="c-cart-drawer">
            <div className="c-cart-head">
              <div className="c-cart-title">🛒 Meu pedido</div>
              <button className="c-icon-btn" onClick={() => setCartOpen(false)}>✕</button>
            </div>
            <div className="c-cart-body">
              {cart.length === 0 ? (
                <div className="c-empty-cart">
                  <div className="c-empty-icon">🛒</div>
                  <div className="c-empty-text">Seu carrinho está vazio</div>
                </div>
              ) : (
                cart.map((it, idx) => (
                  <div key={`${it.product.id}-${idx}`} className="c-cart-item">
                    <div className="c-cart-item-info">
                      <div className="c-cart-item-name">{it.product.nome}</div>
                      {it.observations && <div className="c-cart-item-obs">{it.observations}</div>}
                      <div className="c-cart-item-price">{formatBRL(it.product.preco_sugerido * it.quantity)}</div>
                      <div className="c-cq-wrap">
                        <button className="c-cq-btn" onClick={() => updateQuantity(idx, -1)}>−</button>
                        <span className="c-cq-val">{it.quantity}</span>
                        <button className="c-cq-btn" onClick={() => updateQuantity(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="c-cart-form">
                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Nome</label>
                    <input className="c-form-input" placeholder="Seu nome" value={customer.nome}
                      onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">WhatsApp</label>
                    <input className="c-form-input" placeholder="(00) 00000-0000" inputMode="tel" value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} />
                  </div>
                </div>
                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Atendimento</label>
                    <select className="c-form-select" value={customer.tipo_atendimento}
                      onChange={(e) => setCustomer({ ...customer, tipo_atendimento: e.target.value })}>
                      {config.aceita_entrega !== false && <option value="entrega">🛵 Entrega</option>}
                      {config.aceita_retirada !== false && <option value="retirada">🏃 Retirada</option>}
                    </select>
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Pagamento</label>
                    <select className="c-form-select" value={customer.forma_pagamento}
                      onChange={(e) => setCustomer({ ...customer, forma_pagamento: e.target.value })}>
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </div>
                </div>
                {customer.tipo_atendimento === "entrega" && (
                  <div className="c-form-field" style={{ marginBottom: 11 }}>
                    <label className="c-form-label">Endereço de entrega</label>
                    <textarea className="c-form-textarea" rows={2} placeholder="Rua, nº, bairro, ponto de referência"
                      value={customer.endereco}
                      onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
                  </div>
                )}
                <div className="c-form-field" style={{ marginBottom: 13 }}>
                  <label className="c-form-label">Observações do pedido</label>
                  <textarea className="c-form-textarea" rows={2} placeholder="Alguma instrução especial?"
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })} />
                </div>
                <div className="c-total-box">
                  <div className="c-total-row"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
                  <div className="c-total-row"><span>Taxa de entrega</span><span>{formatBRL(deliveryFee)}</span></div>
                  <div className="c-total-final"><span>Total</span><span className="c-total-val">{formatBRL(total)}</span></div>
                </div>
                <button className="c-submit-btn" onClick={submitOrder} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "🚀"} Confirmar pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minha Conta */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-md w-[calc(100%-1rem)] rounded-2xl bg-[#1A1410] border-[rgba(255,180,100,0.22)] text-[#F5EAD8]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display',serif" }}>
              <User className="h-5 w-5" style={{ color: "#FF6B1A" }} />
              {isLogged ? "Minha conta" : "Meu cadastro"}
            </DialogTitle>
          </DialogHeader>
          {!isLogged ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm" style={{ color: "#B8A898" }}>
                Cadastro rápido — acumule pontos e não precise digitar seus dados a cada pedido.
              </p>
              <div>
                <label className="c-form-label">Nome</label>
                <input className="c-form-input" placeholder="Seu nome"
                  value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} />
              </div>
              <div>
                <label className="c-form-label">WhatsApp</label>
                <input className="c-form-input" inputMode="tel" placeholder="(00) 00000-0000"
                  value={customer.telefone} onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })} />
              </div>
              <div>
                <label className="c-form-label">Endereço</label>
                <textarea className="c-form-textarea" rows={2} placeholder="Rua, nº, bairro"
                  value={customer.endereco} onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
              </div>
              <button className="c-submit-btn" onClick={() => {
                if (!customer.nome.trim() || !customer.telefone.trim()) { toast.error("Informe nome e WhatsApp"); return; }
                try {
                  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                    nome: customer.nome, telefone: customer.telefone,
                    tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
                    endereco: customer.endereco,
                  }));
                } catch {/* ignore */}
                toast.success("Cadastro salvo!");
                openAccount();
              }}>Salvar cadastro</button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#FF6B1A,#FF4500)" }}>
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Star className="h-4 w-4 fill-current" /> Programa de fidelidade
                </div>
                <div className="mt-2 text-3xl font-extrabold">
                  {accountLoading ? "…" : (accountData?.pontos ?? 0)} <span className="text-base font-medium opacity-90">pontos</span>
                </div>
                <div className="text-xs opacity-90 mt-1">
                  {accountLoading ? "Carregando..." : `${accountData?.pedidos ?? 0} pedido(s) • ${formatBRL(accountData?.total ?? 0)} acumulados`}
                </div>
                <div className="text-[11px] opacity-80 mt-2">A cada R$ 10,00 em pedidos você ganha 1 ponto.</div>
              </div>
              <div className="rounded-xl border p-3 space-y-2 text-sm" style={{ borderColor: "rgba(255,180,100,0.12)" }}>
                <div className="flex justify-between"><span style={{ color: "#B8A898" }}>Nome</span><span>{customer.nome}</span></div>
                <div className="flex justify-between"><span style={{ color: "#B8A898" }}>WhatsApp</span><span>{customer.telefone}</span></div>
                {customer.endereco && (
                  <div className="flex justify-between gap-3"><span style={{ color: "#B8A898" }} className="shrink-0">Endereço</span><span className="text-right">{customer.endereco}</span></div>
                )}
              </div>
              <div className="space-y-2">
                <label className="c-form-label">Editar endereço</label>
                <textarea className="c-form-textarea" rows={2} value={customer.endereco}
                  onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })} />
                <button className="c-submit-btn" style={{ height: 42, fontSize: 13 }} onClick={() => {
                  try {
                    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
                      nome: customer.nome, telefone: customer.telefone,
                      tipo_atendimento: customer.tipo_atendimento, forma_pagamento: customer.forma_pagamento,
                      endereco: customer.endereco,
                    }));
                    toast.success("Dados atualizados");
                  } catch {/* ignore */}
                }}>Atualizar dados</button>
              </div>
              <button onClick={logoutAccount} className="w-full text-sm py-2 rounded-lg flex items-center justify-center gap-2"
                style={{ color: "#ff6b6b", background: "rgba(255,107,107,.08)" }}>
                <LogOut className="h-4 w-4" /> Sair deste dispositivo
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

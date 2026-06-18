export const CARDAPIO_CSS = `
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

.c-install-banner{position:fixed;left:12px;right:12px;bottom:72px;z-index:97;animation:c-fadeUp .35s ease both}
.c-install-banner-inner{display:flex;align-items:center;gap:10px;background:rgba(26,20,16,.97);
  border:1px solid var(--border2);border-radius:14px;padding:10px 12px;backdrop-filter:blur(12px);
  box-shadow:0 8px 32px rgba(0,0,0,.45)}
.c-install-banner-icon{font-size:22px;flex-shrink:0}
.c-install-banner-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.c-install-banner-text strong{font-size:12.5px;font-weight:700;color:var(--text)}
.c-install-banner-text span{font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-install-banner-btn{flex-shrink:0;border:none;border-radius:100px;padding:8px 14px;font-family:var(--font);
  font-size:12px;font-weight:700;background:linear-gradient(135deg,var(--fire2),var(--fire));color:#fff;cursor:pointer}
.c-install-banner-close{flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,.06);
  color:var(--text3);cursor:pointer;font-size:13px;line-height:1}

.c-install-ios-overlay{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);
  display:flex;align-items:flex-end;justify-content:center;animation:c-fade .25s ease}
.c-install-ios-sheet{background:var(--dark2);border:1px solid var(--border2);border-radius:20px 20px 0 0;
  width:100%;max-width:480px;padding:22px 20px 28px;color:var(--text);font-family:var(--font)}
.c-install-ios-title{font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:14px}
.c-install-ios-steps{margin:0 0 18px 18px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--text2);line-height:1.5}
.c-install-ios-steps strong{color:var(--text)}
.c-ios-share{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;
  background:rgba(255,255,255,.08);font-size:14px;vertical-align:middle}
.c-install-ios-ok{width:100%;height:44px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--fire2),var(--fire));
  color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer}
`;

export const CARDAPIO_CHAT_CSS = `
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

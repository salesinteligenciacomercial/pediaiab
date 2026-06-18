const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/components/conversas/PedidoChatModal.tsx");
const src = fs.readFileSync(filePath, "utf8");
const marker = "  return (";
const idx = src.lastIndexOf(marker);
if (idx === -1) throw new Error("return marker not found");

const head = src.slice(0, idx);

const tail = `  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 gap-0 border-0 bg-transparent shadow-none overflow-hidden [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>Novo Pedido — {clienteNome || "Cliente"}</DialogTitle>
        </VisuallyHidden>
        <style>{CARDAPIO_CSS}{CARDAPIO_CHAT_CSS}</style>
        <div className="cardapio-root cardapio-chat-root">
          <header className="c-header">
            <div className="c-logo-wrap">
              <span className="c-logo-flame">🍕</span>
              <span className="c-logo-text">Novo Pedido — {clienteNome || "Cliente"}</span>
            </div>
            <div className="c-header-actions">
              <span className="c-chip" style={{ fontSize: 11 }}>{nomeLoja}</span>
              <button type="button" className="c-icon-btn" onClick={() => onOpenChange(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
          </header>

          {loading ? (
            <div className="cardapio-chat-loading">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : step === "cardapio" ? (
            <>
              <div className="c-status-bar">
                <div className="c-status-open">
                  <span className="c-dot-green" />
                  Pedido via chat · {clienteTelefone || "sem telefone"}
                </div>
                <div className="c-status-chips">
                  {taxa > 0 && <span className="c-chip hot">🛵 Entrega {formatBRL(taxa)}</span>}
                  {minimo > 0 && <span className="c-chip">Mín {formatBRL(minimo)}</span>}
                  <span className="c-chip">Pix · Cartão · Dinheiro</span>
                </div>
              </div>

              <div className="cardapio-chat-body">
                <div className="cardapio-chat-menu">
                  <div className="c-search-wrap">
                    <div className="c-search-inner">
                      <span className="c-search-icon">🔍</span>
                      <input
                        className="c-search-input"
                        placeholder="Buscar pizza, bebida, combo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="c-nav-pills">
                    {topShown.length > 0 && (
                      <button
                        type="button"
                        className={\`c-pill \${activePill === "destaques" ? "active" : ""}\`}
                        onClick={() => scrollToSection("destaques")}
                      >
                        ⭐ Mais pedidos
                      </button>
                    )}
                    {categories.map((cat) => {
                      const count = filteredProducts.filter((p) => (p.categoria || "Outros") === cat).length;
                      const id = cat.replace(/\\s+/g, "-");
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={\`c-pill \${activePill === id ? "active" : ""}\`}
                          onClick={() => scrollToSection(id)}
                        >
                          {categoryEmoji(cat)} {cat} <span className="c-pill-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  <main className="c-main" ref={menuScrollRef}>
                    {topShown.length > 0 && (
                      <section id="c-sec-destaques" className="c-category-section c-fade-up">
                        <div className="c-section-header">
                          <h2 className="c-section-title">🔥 Os mais pedidos</h2>
                          <span className="c-section-sub">Campeões de venda</span>
                        </div>
                        <div className="c-destaques-scroll">
                          {topShown.map((p) => (
                            <div key={p.id} className="c-destaque-card" onClick={() => openProduct(p)}>
                              <span className="c-destaque-badge">★ Popular</span>
                              {p.imagem_url ? (
                                <img src={p.imagem_url} alt={p.nome} className="c-destaque-img" loading="lazy" />
                              ) : (
                                <div className="c-destaque-img-ph">🍕</div>
                              )}
                              <div className="c-destaque-body">
                                <div className="c-destaque-name">{p.nome}</div>
                                <div className="c-destaque-price">{formatBRL(Number(p.preco_sugerido || 0))}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {categories.map((cat) => {
                      const items = filteredProducts.filter((p) => (p.categoria || "Outros") === cat);
                      if (!items.length) return null;
                      const id = cat.replace(/\\s+/g, "-");
                      return (
                        <section key={cat} id={\`c-sec-\${id}\`} className="c-category-section c-fade-up">
                          <div className="c-cat-label">
                            {categoryEmoji(cat)} {cat}{" "}
                            <small>({items.length} {items.length === 1 ? "item" : "itens"})</small>
                          </div>
                          <div className="c-prod-list">
                            {items.map((p) => (
                              <button key={p.id} type="button" className="c-prod-item" onClick={() => openProduct(p)}>
                                <div className="c-prod-info">
                                  <div className="c-prod-name">{p.nome}</div>
                                  <div className="c-prod-desc">
                                    {p.descricao || p.descricao_curta || p.descricao_completa || "—"}
                                  </div>
                                  <div className="c-prod-footer">
                                    <div>
                                      <div className="c-prod-price-from">A partir de</div>
                                      <div className="c-prod-price">{formatBRL(Number(p.preco_sugerido || 0))}</div>
                                    </div>
                                    {isPizzaProduct(p) && <span className="c-half-badge">½ + ½</span>}
                                  </div>
                                </div>
                                <div className="c-prod-img-wrap">
                                  {p.imagem_url ? (
                                    <img src={p.imagem_url} alt={p.nome} className="c-prod-img" loading="lazy" />
                                  ) : (
                                    <div className="c-prod-img-ph">{categoryEmoji(cat)}</div>
                                  )}
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
                </div>

                <aside className="cardapio-chat-cart">
                  <div className="c-cart-head">
                    <div className="c-cart-title">🛒 Meu pedido ({cartCount})</div>
                  </div>
                  <div className="c-cart-body">
                    {cart.length === 0 ? (
                      <div className="c-empty-cart">
                        <div className="c-empty-icon">🛒</div>
                        <div className="c-empty-text">Seu carrinho está vazio.<br />Adicione itens do cardápio.</div>
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={\`\${item.product.id}-\${idx}\`} className="c-cart-item">
                          <div className="c-cart-item-info">
                            <div className="c-cart-item-name">{item.product.nome}</div>
                            {item.observations && <div className="c-cart-item-obs">{item.observations}</div>}
                            <div className="c-cart-item-price">
                              {formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}
                            </div>
                            <textarea
                              className="c-obs-input"
                              rows={1}
                              placeholder="Obs: sem cebola..."
                              value={item.observations}
                              onChange={(e) => updateObs(idx, e.target.value)}
                              style={{ marginTop: 8, fontSize: 12 }}
                            />
                            <div className="c-cq-wrap">
                              <button type="button" className="c-cq-btn" onClick={() => updateQty(idx, -1)}>−</button>
                              <span className="c-cq-val">{item.quantity}</span>
                              <button type="button" className="c-cq-btn" onClick={() => updateQty(idx, 1)}>+</button>
                              <button
                                type="button"
                                className="c-cq-btn"
                                onClick={() => removeItem(idx)}
                                style={{ marginLeft: 8, color: "var(--fire2)" }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="cardapio-chat-cart c-cart-foot">
                    <div className="c-total-box" style={{ marginBottom: 12 }}>
                      <div className="c-total-row">
                        <span>Subtotal</span>
                        <span>{formatBRL(subtotal)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="c-submit-btn"
                      disabled={!cart.length}
                      onClick={() => setStep("checkout")}
                    >
                      Continuar → {formatBRL(subtotal)}
                    </button>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="cardapio-chat-checkout">
                <div className="c-cart-title">📋 Finalizar pedido</div>

                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Nome do cliente</label>
                    <input
                      className="c-form-input"
                      value={customer.nome}
                      onChange={(e) => setCustomer({ ...customer, nome: e.target.value })}
                    />
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Telefone</label>
                    <input
                      className="c-form-input"
                      value={customer.telefone}
                      onChange={(e) => setCustomer({ ...customer, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="c-form-row">
                  <div className="c-form-field">
                    <label className="c-form-label">Tipo de atendimento</label>
                    <select
                      className="c-form-select"
                      value={customer.tipo_atendimento}
                      onChange={(e) => setCustomer({ ...customer, tipo_atendimento: e.target.value })}
                    >
                      <option value="entrega">🛵 Delivery</option>
                      <option value="retirada">🏃 Retirada no balcão</option>
                      <option value="mesa">🍽️ Mesa / Local</option>
                    </select>
                  </div>
                  <div className="c-form-field">
                    <label className="c-form-label">Forma de pagamento</label>
                    <select
                      className="c-form-select"
                      value={customer.forma_pagamento}
                      onChange={(e) => setCustomer({ ...customer, forma_pagamento: e.target.value })}
                    >
                      <option value="pix">Pix</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                    </select>
                  </div>
                </div>

                {customer.forma_pagamento === "dinheiro" && (
                  <div className="c-form-field" style={{ marginBottom: 11 }}>
                    <label className="c-form-label">Troco para (opcional)</label>
                    <input
                      className="c-form-input"
                      type="number"
                      placeholder="Ex: 100"
                      value={customer.troco_para}
                      onChange={(e) => setCustomer({ ...customer, troco_para: e.target.value })}
                    />
                  </div>
                )}

                {customer.tipo_atendimento === "entrega" && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="c-sub2" style={{ marginBottom: 10 }}>
                      📍 Endereço de entrega
                      {enderecoSalvo && <span className="c-hint"> · endereço salvo do cliente</span>}
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field" style={{ gridColumn: "span 2" }}>
                        <label className="c-form-label">Rua / Logradouro</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco}
                          onChange={(e) => setCustomer({ ...customer, endereco: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">Número</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_numero}
                          onChange={(e) => setCustomer({ ...customer, endereco_numero: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field">
                        <label className="c-form-label">Bairro</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_bairro}
                          onChange={(e) => setCustomer({ ...customer, endereco_bairro: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">Complemento</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_complemento}
                          onChange={(e) => setCustomer({ ...customer, endereco_complemento: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="c-form-row">
                      <div className="c-form-field">
                        <label className="c-form-label">Cidade</label>
                        <input
                          className="c-form-input"
                          value={customer.endereco_cidade}
                          onChange={(e) => setCustomer({ ...customer, endereco_cidade: e.target.value })}
                        />
                      </div>
                      <div className="c-form-field">
                        <label className="c-form-label">UF</label>
                        <input
                          className="c-form-input"
                          maxLength={2}
                          value={customer.endereco_estado}
                          onChange={(e) =>
                            setCustomer({ ...customer, endereco_estado: e.target.value.toUpperCase() })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="c-form-field" style={{ marginBottom: 14 }}>
                  <label className="c-form-label">Observações do pedido</label>
                  <textarea
                    className="c-form-textarea"
                    rows={2}
                    placeholder="Ex: tirar a cebola da pizza..."
                    value={customer.observacoes}
                    onChange={(e) => setCustomer({ ...customer, observacoes: e.target.value })}
                  />
                </div>

                <div className="c-total-box">
                  <div className="c-sub2" style={{ marginBottom: 10 }}>Resumo</div>
                  {cart.map((item, idx) => (
                    <div key={idx} className="c-total-row">
                      <span>{item.quantity}x {item.product.nome}</span>
                      <span>{formatBRL(Number(item.product.preco_sugerido || 0) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="c-total-row">
                    <span>Taxa de entrega</span>
                    <span>{formatBRL(deliveryFee)}</span>
                  </div>
                  <div className="c-total-final">
                    <span>TOTAL</span>
                    <span className="c-total-val">{formatBRL(total)}</span>
                  </div>
                </div>
              </div>

              <div className="cardapio-chat-actions">
                <button type="button" className="cardapio-chat-back" onClick={() => setStep("cardapio")}>
                  ← Voltar ao cardápio
                </button>
                <button type="button" className="c-submit-btn" style={{ flex: 1 }} disabled={submitting} onClick={submitOrder}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : \`Confirmar pedido · \${formatBRL(total)}\`}
                </button>
              </div>
            </>
          )}

          {selectedProduct && (
            <div
              className="c-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) resetSelection();
              }}
            >
              <div className="c-modal">
                <div style={{ position: "relative" }}>
                  {selectedProduct.imagem_url ? (
                    <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="c-modal-img" />
                  ) : (
                    <div className="c-modal-img-ph">{categoryEmoji(selectedProduct.categoria || "")}</div>
                  )}
                  <button type="button" className="c-modal-close" onClick={resetSelection}>
                    ✕
                  </button>
                </div>
                <div className="c-modal-body">
                  <div className="c-modal-name">{selectedProduct.nome}</div>
                  <div className="c-modal-desc">
                    {selectedProduct.descricao ||
                      selectedProduct.descricao_completa ||
                      selectedProduct.descricao_curta ||
                      "Sem descrição."}
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
                              type="button"
                              className={\`c-size-btn \${active ? "active" : ""}\`}
                              onClick={() => {
                                setSelectedSize(s.id);
                                setExtraFlavors((prev) => prev.slice(0, s.maxFlavors - 1));
                                setSelectedBordaId("");
                              }}
                              title={s.descricao || ""}
                            >
                              <div className="c-size-name">{s.label}</div>
                              <div className="c-size-info">
                                {s.maxFlavors} sab · {s.slices} fat
                              </div>
                              <div className="c-size-price">{formatBRL(price)}</div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedPizzaSize && selectedPizzaSize.maxFlavors > 1 && (
                        <>
                          <div className="c-sub2">
                            🍕 Sabores adicionais
                            <span className="c-hint">
                              (até {maxExtras} · {selectedExtraIds.length} selecionado
                              {selectedExtraIds.length !== 1 ? "s" : ""})
                            </span>
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
                                <button
                                  key={f.id}
                                  type="button"
                                  className={\`c-flavor-item \${sel ? "selected" : ""}\`}
                                  onClick={() => toggleFlavor(f.id)}
                                >
                                  <div className="c-flavor-check">{sel ? "✓" : ""}</div>
                                  <div className="c-flavor-text">
                                    <div className="c-flavor-name">{f.nome}</div>
                                    <div className="c-flavor-desc">{f.descricao || f.descricao_curta || ""}</div>
                                  </div>
                                  <div className="c-flavor-price-tag">{formatBRL(Number(f.preco_sugerido || 0))}</div>
                                </button>
                              );
                            })}
                            {visibleFlavors.length === 0 && (
                              <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 12, padding: 12 }}>
                                Nenhum sabor encontrado.
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {selectedPizzaSize && pizzaBordas.length > 0 && (
                        <>
                          <div className="c-sub2">
                            🥯 Borda recheada <span className="c-hint">(opcional)</span>
                          </div>
                          <div className="c-bordas-grid">
                            <button
                              type="button"
                              className={\`c-borda-btn \${!selectedBordaId ? "active" : ""}\`}
                              onClick={() => setSelectedBordaId("")}
                            >
                              <div className="c-borda-name">Sem borda</div>
                              <div className="c-borda-price">Grátis</div>
                            </button>
                            {pizzaBordas.map((b) => {
                              const price = selectedPizzaSize.tamanhoId
                                ? getBordaPriceForSize(b.id, selectedPizzaSize.tamanhoId)
                                : 0;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  className={\`c-borda-btn \${selectedBordaId === b.id ? "active" : ""}\`}
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
                    <div className="c-sub2">
                      📝 Observações <span className="c-hint">(opcional)</span>
                    </div>
                    <textarea
                      className="c-obs-input"
                      rows={2}
                      placeholder="Ex: sem cebola, bem assada..."
                      value={selectedObs}
                      onChange={(e) => setSelectedObs(e.target.value)}
                    />
                  </div>
                </div>
                <div className="c-modal-footer">
                  <div className="c-qty-ctrl">
                    <button type="button" className="c-qty-btn" onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}>
                      −
                    </button>
                    <span className="c-qty-val">{selectedQty}</span>
                    <button type="button" className="c-qty-btn" onClick={() => setSelectedQty((q) => q + 1)}>
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="c-add-btn"
                    onClick={addPizzaToCart}
                    disabled={isPizzaProduct(selectedProduct) && !selectedPizzaSize}
                  >
                    🛒 Adicionar {formatBRL(finalModalPrice * selectedQty)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
`;

fs.writeFileSync(filePath, head + tail);
console.log("Patched", filePath);

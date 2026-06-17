type CardapioInstallBannerProps = {
  storeName: string;
  isIos: boolean;
  iosHintOpen: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onCloseIosHint: () => void;
};

export function CardapioInstallBanner({
  storeName,
  isIos,
  iosHintOpen,
  onInstall,
  onDismiss,
  onCloseIosHint,
}: CardapioInstallBannerProps) {
  return (
    <>
      <div className="c-install-banner" role="region" aria-label="Instalar cardápio">
        <div className="c-install-banner-inner">
          <div className="c-install-banner-icon">📲</div>
          <div className="c-install-banner-text">
            <strong>Instalar cardápio</strong>
            <span>Acesse {storeName} direto da tela inicial</span>
          </div>
          <button type="button" className="c-install-banner-btn" onClick={onInstall}>
            {isIos ? "Como instalar" : "Instalar"}
          </button>
          <button type="button" className="c-install-banner-close" onClick={onDismiss} aria-label="Fechar">
            ✕
          </button>
        </div>
      </div>

      {iosHintOpen && (
        <div className="c-install-ios-overlay" onClick={onCloseIosHint}>
          <div className="c-install-ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="c-install-ios-title">Instalar no iPhone</div>
            <ol className="c-install-ios-steps">
              <li>Toque no botão <strong>Compartilhar</strong> <span className="c-ios-share">⎋</span> do Safari</li>
              <li>Role e toque em <strong>Adicionar à Tela de Início</strong></li>
              <li>Confirme tocando em <strong>Adicionar</strong></li>
            </ol>
            <button type="button" className="c-install-ios-ok" onClick={onCloseIosHint}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

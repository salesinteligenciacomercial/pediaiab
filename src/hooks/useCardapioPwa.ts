import { useCallback, useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type UseCardapioPwaOptions = {
  slug?: string;
  storeName?: string;
  logoUrl?: string | null;
  themeColor?: string;
  enabled?: boolean;
};

const DEFAULT_THEME = "#FF4500";
const DEFAULT_BG = "#0D0A08";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobileDevice() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function buildIcons(logoUrl?: string | null) {
  const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [
    { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
  if (logoUrl?.startsWith("http")) {
    icons.unshift(
      { src: logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
    );
  }
  return icons;
}

function applyHeadMeta(storeName: string, themeColor: string, logoUrl?: string | null) {
  document.title = storeName;

  const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMeta("theme-color", themeColor);
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", storeName.slice(0, 12));
  setMeta("mobile-web-app-capable", "yes");

  const appleIcon = logoUrl?.startsWith("http") ? logoUrl : "/pwa/icon-192.png";
  let linkApple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!linkApple) {
    linkApple = document.createElement("link");
    linkApple.rel = "apple-touch-icon";
    document.head.appendChild(linkApple);
  }
  linkApple.href = appleIcon;
}

export function useCardapioPwa({
  slug,
  storeName,
  logoUrl,
  themeColor = DEFAULT_THEME,
  enabled = true,
}: UseCardapioPwaOptions) {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const manifestUrlRef = useRef<string | null>(null);

  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [isIos] = useState(isIosDevice);
  const [isMobile] = useState(isMobileDevice);
  const [dismissed, setDismissed] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);

  const dismissKey = slug ? `cardapio_pwa_dismiss_${slug}` : null;

  useEffect(() => {
    if (!dismissKey) return;
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      /* ignore */
    }
  }, [dismissKey]);

  useEffect(() => {
    if (!enabled || !slug || !storeName) return;

    applyHeadMeta(storeName, themeColor, logoUrl);

    const startUrl = `/cardapio/${slug}`;
    const manifest = {
      id: `/cardapio/${slug}`,
      name: storeName,
      short_name: storeName.slice(0, 12),
      description: `Cardápio digital de ${storeName}`,
      start_url: startUrl,
      scope: `/cardapio/${slug}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: DEFAULT_BG,
      theme_color: themeColor,
      lang: "pt-BR",
      categories: ["food", "shopping"],
      icons: buildIcons(logoUrl),
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (manifestUrlRef.current) URL.revokeObjectURL(manifestUrlRef.current);
    manifestUrlRef.current = url;
    link.href = url;

    return () => {
      if (manifestUrlRef.current) {
        URL.revokeObjectURL(manifestUrlRef.current);
        manifestUrlRef.current = null;
      }
    };
  }, [enabled, slug, storeName, logoUrl, themeColor]);

  useEffect(() => {
    if (!enabled) return;

    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
    };

    const onDisplayMode = () => setIsInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
    };
  }, [enabled]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    if (dismissKey) {
      try {
        localStorage.setItem(dismissKey, "1");
      } catch {
        /* ignore */
      }
    }
  }, [dismissKey]);

  const promptInstall = useCallback(async () => {
    if (isIos) {
      setIosHintOpen(true);
      return false;
    }
    const prompt = deferredPrompt.current;
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    if (outcome === "accepted") {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [isIos]);

  const showBanner =
    enabled &&
    isMobile &&
    !isInstalled &&
    !dismissed &&
    !!slug &&
    !!storeName &&
    (canInstall || isIos);

  return {
    canInstall,
    isInstalled,
    isIos,
    isMobile,
    showBanner,
    iosHintOpen,
    setIosHintOpen,
    promptInstall,
    dismissBanner,
  };
}

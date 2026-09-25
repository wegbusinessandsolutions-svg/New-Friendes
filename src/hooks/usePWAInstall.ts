import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // 1. Detect if already running in standalone mode (installed as PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsInstalled(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !standalone;
    setIsIOS(isIOSDevice);

    // 3. Listen to beforeinstallprompt event (Chromium, Android, Edge, Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user dismissed prompt recently (2 days suppression)
      const dismissedUntil = localStorage.getItem('pwa_prompt_dismissed_until');
      const now = Date.now();
      const isDismissed = dismissedUntil && Number(dismissedUntil) > now;

      if (!standalone && !isDismissed) {
        // Suggest installation after a brief delay for smooth UX
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
      localStorage.removeItem('pwa_prompt_dismissed_until');
      console.log('[PWA] Aplicativo instalado com sucesso na tela inicial!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If on iOS and not standalone and not dismissed, show guided prompt
    if (isIOSDevice && !standalone) {
      const dismissedUntil = localStorage.getItem('pwa_prompt_dismissed_until');
      const now = Date.now();
      if (!dismissedUntil || Number(dismissedUntil) <= now) {
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        setIsInstalling(true);
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowBanner(false);
          setDeferredPrompt(null);
        } else {
          // User cancelled native dialog, dismiss banner for 2 days
          localStorage.setItem('pwa_prompt_dismissed_until', String(Date.now() + 2 * 24 * 60 * 60 * 1000));
          setShowBanner(false);
        }
      } catch (err) {
        console.error('[PWA] Erro ao disparar instalação:', err);
      } finally {
        setIsInstalling(false);
      }
    }
  }, [deferredPrompt]);

  const dismissBanner = useCallback((days = 2) => {
    setShowBanner(false);
    localStorage.setItem('pwa_prompt_dismissed_until', String(Date.now() + days * 24 * 60 * 60 * 1000));
  }, []);

  const openInstall = useCallback(() => {
    setShowBanner(true);
  }, []);

  return {
    deferredPrompt,
    isInstallable: !!deferredPrompt || isIOS,
    isInstalled,
    isIOS,
    showBanner,
    isInstalling,
    promptInstall,
    dismissBanner,
    openInstall
  };
}

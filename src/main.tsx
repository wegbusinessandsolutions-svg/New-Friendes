import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker in production for PWA offline capabilities
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: false,
      onNeedRefresh() {
        console.log('[PWA] Nova versão disponível');
      },
      onOfflineReady() {
        console.log('[PWA] Aplicativo pronto para uso offline');
      },
    });
  }).catch((err) => {
    console.warn('[PWA] Service worker registration ignored:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

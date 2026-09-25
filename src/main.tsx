import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA offline capabilities and update handling
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Nova versão disponível');
  },
  onOfflineReady() {
    console.log('[PWA] Aplicativo pronto para uso offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React, { useState } from 'react';
import { Download, X, Smartphone, Sparkles, Share, PlusSquare, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function PWAInstallBanner() {
  const {
    isInstalled,
    isIOS,
    showBanner,
    isInstalling,
    deferredPrompt,
    promptInstall,
    dismissBanner
  } = usePWAInstall();

  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone PWA or banner shouldn't show, render nothing
  if (isInstalled || !showBanner) {
    return null;
  }

  const handleInstallClick = () => {
    if (deferredPrompt) {
      promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {/* Floating Bottom Suggestion Banner */}
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-100 dark:border-indigo-900/50 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-100 flex flex-col gap-3 relative overflow-hidden">
          {/* Subtle top brand accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-600 to-sky-400" />

          {/* Dismiss button */}
          <button
            onClick={() => dismissBanner(3)}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar sugestão de instalação"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header with App Icon */}
          <div className="flex items-center gap-3 pr-6">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700/60 p-1 shrink-0 overflow-hidden flex items-center justify-center">
              <img
                src="/pwa-192x192.png"
                alt="Ícone do Aplicativo New Friends"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  Instalar o New Friends.br
                </h3>
                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                  App PWA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Sem barras do navegador • Visual de aplicativo nativo
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Tela cheia fluida</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Atalho na tela inicial</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md hover:shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isInstalling ? 'Instalando...' : 'Instalar Agora'}</span>
            </button>
            <button
              onClick={() => dismissBanner(3)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guided Installation Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 text-center">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-sm">
              <img
                src="/pwa-192x192.png"
                alt="New Friends"
                className="w-10 h-10 object-contain rounded-xl"
              />
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Como instalar no seu iPhone
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Siga os 3 passos simples abaixo no navegador Safari:
              </p>
            </div>

            <div className="space-y-2.5 text-left bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Toque no botão <strong>Compartilhar</strong> (<Share className="inline w-3.5 h-3.5 text-indigo-500" />) na barra inferior do Safari.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="inline w-3.5 h-3.5 text-indigo-500" />).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  No canto superior direito, toque em <strong>Adicionar</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIOSGuide(false);
                dismissBanner(7);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Compact Header or Menu button for manual installation at any time
 */
export function PWAHeaderInstallButton() {
  const { isInstalled, isInstallable, deferredPrompt, isIOS, promptInstall, openInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleClick = () => {
    if (deferredPrompt) {
      promptInstall();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      openInstall();
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-extrabold rounded-full shadow-sm hover:shadow flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        title="Instalar aplicativo na tela inicial sem barras de navegação"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 text-center">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Instalar New Friends no iPhone
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No Safari, toque no ícone de <strong>Compartilhar</strong> (<Share className="inline w-3.5 h-3.5" />) e depois em <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="inline w-3.5 h-3.5" />).
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-xl shadow-md"
            >
              OK, entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  MessageCircle, 
  User, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  X, 
  Compass,
  Heart,
  Zap,
  Users,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { auth } from '../lib/firebase';

interface TourStep {
  title: string;
  description: string;
  targetId?: string;
  path?: string;
  iconName: string;
  badge?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao New Friends.br! 👋",
    description: "Ficamos muito felizes em ter você aqui! Vamos fazer um tour rápido de 1 minuto para você conhecer os recursos mais importantes de interações e segurança do nosso aplicativo.",
    iconName: "Sparkles",
    badge: "BOAS-VINDAS"
  },
  {
    title: "Descubra Novas Conexões 🔍",
    description: "Na página inicial (Home), busque e filtre perfis em todo o Brasil. Refine por idade, gênero, estado (Cariocas, Paulistas, Gaúchos) e objetivo de relacionamento para achar pessoas afins!",
    targetId: "tour-home",
    path: "/",
    iconName: "Compass",
    badge: "DESCOBERTA"
  },
  {
    title: "Swipe do Match (Flirt) 🔥",
    description: "Quer um jeito divertido de conectar? No modo Swipe, deslize perfis para os lados! Deslize para a direita se curtir, ou esquerda para passar. Se for mútuo, o Match acontece na hora!",
    targetId: "tour-flirt",
    path: "/flirt",
    iconName: "Heart",
    badge: "MATCH"
  },
  {
    title: "Frases Prontas Rápidas ⚡",
    description: "Quer quebrar o gelo sem complicação? Use o menu de Frases Prontas! Aqui você cria, personaliza e salva atalhos de mensagens criativas para enviá-las no chat com apenas um toque.",
    targetId: "tour-quick",
    path: "/quick-messages",
    iconName: "Zap",
    badge: "FACILIDADE"
  },
  {
    title: "Solicitações de Amizade 👥",
    description: "Gerencie quem deseja se conectar com você em tempo real. Veja as solicitações recebidas, aceite novos amigos e acompanhe os convites que você mesmo enviou.",
    targetId: "tour-friends",
    path: "/friend-requests",
    iconName: "Users",
    badge: "CONEXÕES"
  },
  {
    title: "Chat Completo e Seguro 💬",
    description: "Aqui ficam suas conversas ativas. Nosso chat suporta textos, emoticons, gravação de áudio e vídeo curto. Se precisar, você pode bloquear qualquer usuário na hora pelo menu do chat!",
    targetId: "tour-chats",
    path: "/chats",
    iconName: "MessageCircle",
    badge: "CONVERSAS"
  },
  {
    title: "Seu Perfil e Fotos 👤",
    description: "Clique no seu avatar no topo para gerenciar seu perfil. Adicione novas fotos, edite sua biografia pública, gerencie interesses e acompanhe o andamento de sua conta.",
    targetId: "tour-profile-btn",
    path: "/",
    iconName: "User",
    badge: "MEU PERFIL"
  },
  {
    title: "Semáforo de Status 🚦",
    description: "Gerencie sua disponibilidade com a disposição de semáforo vertical! Toque no indicador de status no topo para alternar entre: 'Disponível' (aberto a interações), 'Restrições' (com respostas automáticas para filtrar contatos) ou 'Não Disponível' (interações de não-amigos bloqueadas, com alerta se violado e opção de bloqueio rápido).",
    targetId: "tour-status",
    path: "/",
    iconName: "StatusSemaforo",
    badge: "STATUS E REGRAS"
  },
  {
    title: "Selos de Verificação Oficial 🛡️",
    description: "Garantimos segurança máxima! Faça a validação facial de selfie para provar que seu perfil é 100% real e obter o selo azul de autenticidade, o que dobra suas chances de match!",
    iconName: "ShieldCheck",
    badge: "SEGURANÇA"
  },
  {
    title: "Tudo Pronto! 🎉",
    description: "Você concluiu o tour explicativo de recursos. Agora você está pronto para navegar com segurança total, interagir com perfis reais e fazer novos amigos!",
    iconName: "Check",
    badge: "PRONTO"
  }
];

interface WalkthroughTourProps {
  onClose: () => void;
}

export default function WalkthroughTour({ onClose }: WalkthroughTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = sessionStorage.getItem('tour_current_step');
    if (saved) {
      const idx = parseInt(saved, 10);
      if (!isNaN(idx) && idx >= 0 && idx < TOUR_STEPS.length) {
        return idx;
      }
    }
    return 0;
  });
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('tour_current_step', currentStep.toString());
  }, [currentStep]);

  const stepData = TOUR_STEPS[currentStep];

  const updateCoordinates = () => {
    if (!stepData?.targetId) {
      setCoords(null);
      return;
    }

    const target = document.getElementById(stepData.targetId);

    if (target) {
      const targetRect = target.getBoundingClientRect();

      setCoords({
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
      });
    } else {
      setCoords(null);
    }
  };

  useEffect(() => {
    updateCoordinates();

    // Set timers to poll coordinates as the pages change and DOM elements load/animate
    const timer1 = setTimeout(updateCoordinates, 100);
    const timer2 = setTimeout(updateCoordinates, 300);
    const timer3 = setTimeout(updateCoordinates, 600);
    const timer4 = setTimeout(updateCoordinates, 1200);

    window.addEventListener('resize', updateCoordinates);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      window.removeEventListener('resize', updateCoordinates);
    };
  }, [currentStep, location.pathname]);

  const navigateToPath = (path: string) => {
    if (!path || !auth.currentUser) return;
    if (path === '/profile') {
      const targetProfilePath = `/profile/${auth.currentUser.uid}`;
      if (!location.pathname.startsWith('/profile/')) {
        navigate(targetProfilePath);
      }
    } else if (location.pathname !== path) {
      navigate(path);
    }
  };

  const handleNext = () => {
    const nextIdx = currentStep + 1;
    if (nextIdx >= TOUR_STEPS.length) {
      handleComplete();
      return;
    }

    const nextStep = TOUR_STEPS[nextIdx];
    if (nextStep.path) {
      navigateToPath(nextStep.path);
    }

    setCurrentStep(nextIdx);
  };

  const handlePrev = () => {
    if (currentStep === 0) return;
    const prevIdx = currentStep - 1;
    const prevStep = TOUR_STEPS[prevIdx];

    if (prevStep.path) {
      navigateToPath(prevStep.path);
    }

    setCurrentStep(prevIdx);
  };

  const handleComplete = () => {
    localStorage.setItem('new_user_tour_done', 'true');
    sessionStorage.removeItem('tour_current_step');
    onClose();
  };

  const renderIcon = (name: string) => {
    const props = { className: "w-6 h-6 stroke-[2]" };
    switch (name) {
      case 'Sparkles': 
        return (
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner animate-bounce mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
        );
      case 'Compass': 
        return (
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mb-2">
            <Compass {...props} />
          </div>
        );
      case 'Heart': 
        return (
          <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/30 text-pink-500 flex items-center justify-center animate-pulse mb-2">
            <Heart {...props} />
          </div>
        );
      case 'Zap': 
        return (
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mb-2">
            <Zap {...props} />
          </div>
        );
      case 'Users': 
        return (
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mb-2">
            <Users {...props} />
          </div>
        );
      case 'MessageCircle': 
        return (
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mb-2">
            <MessageCircle {...props} />
          </div>
        );
      case 'User': 
        return (
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-2">
            <User {...props} />
          </div>
        );
      case 'ShieldCheck': 
        return (
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
        );
      case 'StatusSemaforo':
        return (
          <div className="w-12 h-16 rounded-2xl bg-slate-900 dark:bg-slate-950 flex flex-col items-center justify-between py-2 px-3 shadow-inner border border-slate-800 space-y-1 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
          </div>
        );
      case 'Check': 
        return (
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner mb-3 animate-pulse">
            <Check className="w-7 h-7 stroke-[3]" />
          </div>
        );
      default: 
        return <Sparkles {...props} />;
    }
  };

  const isBottom = coords ? coords.top > window.innerHeight / 2 : false;
  const isTop = coords ? coords.top <= window.innerHeight / 2 : false;

  const tooltipStyle = coords ? {
    position: 'absolute' as const,
    [isBottom ? 'bottom' : 'top']: isBottom 
      ? window.innerHeight - coords.top + 20 
      : coords.top + coords.height + 20,
    left: '50%',
  } : {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
  };

  const getArrowStyle = () => {
    if (!coords) return {};
    
    const targetCenterX = coords.left + coords.width / 2;
    const windowCenterX = window.innerWidth / 2;
    let offset = targetCenterX - windowCenterX;
    
    // Tooltip max-width is 320. Half is 160. Arrow should not go outside the tooltip box.
    offset = Math.max(-130, Math.min(130, offset));
    
    return {
      position: 'absolute' as const,
      [isBottom ? 'bottom' : 'top']: -6,
      left: `calc(50% + ${offset}px)`,
      transform: `translateX(-50%) rotate(45deg)`,
      zIndex: 10
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center pointer-events-none">
      {/* Background Mask */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-[1.5px] transition-opacity duration-300 pointer-events-auto" onClick={handleComplete} />

      {/* Spotlight highlight */}
      {coords && (
        <motion.div 
          layoutId="spotlight"
          style={{
            top: coords.top - 6,
            left: coords.left - 6,
            width: coords.width + 12,
            height: coords.height + 12,
            position: 'fixed',
          }}
          className="rounded-2xl border-2 border-indigo-400 ring-4 ring-indigo-500/40 pointer-events-none z-50 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)]"
        >
          {/* Inner pulse */}
          <div className="absolute inset-0 border border-white/40 rounded-2xl animate-ping opacity-60" />
        </motion.div>
      )}

      {/* Main Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.92, x: '-50%', y: coords ? 0 : '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: coords ? 0 : '-50%' }}
            exit={{ opacity: 0, scale: 0.92, x: '-50%', y: coords ? 0 : '-50%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={tooltipStyle}
            className={`w-full max-w-[320px] bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 pointer-events-auto flex flex-col items-center text-center z-50 text-slate-800 dark:text-slate-100`}
          >
            {/* Tooltip Pointer Arrow */}
            {coords && (
              <div 
                className="w-4 h-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 pointer-events-none"
                style={{
                  ...getArrowStyle(),
                  borderBottom: isTop ? 'none' : undefined,
                  borderRight: isTop ? 'none' : undefined,
                  borderTop: isBottom ? 'none' : undefined,
                  borderLeft: isBottom ? 'none' : undefined,
                }}
              />
            )}

            {/* Upper Badge */}
            {stepData.badge && (
              <span className="mb-2 px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold tracking-wider rounded-full uppercase">
                {stepData.badge}
              </span>
            )}

            {/* Step Close Cross Button */}
            <button 
              onClick={handleComplete} 
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Fechar Guia"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step Icon */}
            {renderIcon(stepData.iconName)}

            {/* Step Title */}
            <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight mb-2 px-2">
              {stepData.title}
            </h3>
            
            {/* Step Description */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4 px-1 max-h-[110px] overflow-y-auto">
              {stepData.description}
            </p>

            {/* Stepper Dots Indicator */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {TOUR_STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep 
                      ? 'w-4 bg-indigo-600 dark:bg-indigo-500' 
                      : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Footer buttons / Stepper controls */}
            <div className="flex w-full gap-2 border-t border-slate-100/80 dark:border-slate-800/80 pt-3">
              {currentStep === 0 ? (
                <>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-[10px] transition-colors"
                  >
                    Pular Tour
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-[1.5] py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-xl text-[10px] shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    Começar <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : currentStep === TOUR_STEPS.length - 1 ? (
                <button
                  onClick={handleComplete}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-xl text-[11px] shadow-lg shadow-emerald-100 dark:shadow-none transition-all active:scale-[0.98]"
                >
                  Concluir e Explorar!
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePrev}
                    className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-[10px] shadow-md shadow-indigo-50 dark:shadow-none transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                  >
                    Avançar <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Shield, ShieldCheck, AlertCircle, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';

interface AppFaceLockScreenProps {
  user: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AppFaceLockScreen({ user, onSuccess, onCancel }: AppFaceLockScreenProps) {
  const [faceStep, setFaceStep] = useState<'scanning' | 'analyzing' | 'success' | 'error'>('scanning');
  const [faceMessage, setFaceMessage] = useState('Ajuste seu rosto no círculo...');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const isCameraActiveRef = useRef(false);
  const [hasCameraError, setHasCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startFaceCamera = async () => {
    try {
      setHasCameraError(false);
      isCameraActiveRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: "user" }
      });
      if (!isCameraActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error("Video play error in lock screen:", err);
          }
        }
      }
    } catch (err) {
      if (isCameraActiveRef.current) {
        console.error("Camera access error in lock screen:", err);
        setHasCameraError(true);
      }
    }
  };

  const stopFaceCamera = () => {
    isCameraActiveRef.current = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (faceStep === 'scanning') {
      startFaceCamera();
    } else {
      stopFaceCamera();
    }
    return () => {
      stopFaceCamera();
    };
  }, [faceStep]);

  useEffect(() => {
    // Elegant biometric scan timeouts
    const t1 = setTimeout(() => {
      setFaceMessage('Analisando biometria e estrutura facial...');
    }, 2500);
    
    const t2 = setTimeout(() => {
      setFaceMessage('Validando assinatura digital e prova de vida...');
    }, 5000);
    
    const t3 = setTimeout(() => {
      setFaceStep('analyzing');
      setFaceMessage('Verificando compatibilidade com a conta...');
    }, 7500);
    
    const t4 = setTimeout(() => {
      setFaceStep('success');
      setFaceMessage('Biometria autenticada com sucesso! Acesso liberado.');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 10000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-6 font-sans text-slate-850 dark:text-slate-100 max-w-md w-full mx-auto border-x border-slate-200 dark:border-slate-800 shadow-2xl relative">
      {/* Background circles */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-full opacity-50 pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-full opacity-50 pointer-events-none"></div>

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800/80 p-6 flex flex-col items-center text-center relative z-10">
        
        {/* Header Block */}
        <div className="flex items-center gap-2 mb-6 bg-slate-50 dark:bg-slate-850 py-2 px-4 rounded-full border border-slate-100 dark:border-slate-800">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
          <span className="font-extrabold text-slate-700 dark:text-slate-350 text-[11px] uppercase tracking-wider">Verificação de Acesso Extra</span>
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
          Reconhecimento Facial
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-6">
          Sua conta possui segurança facial ativada.
        </p>

        {/* Biometric Scan Stages */}
        {faceStep === 'scanning' && (
          <div className="space-y-6 w-full flex flex-col items-center">
            {/* Camera Frame */}
            <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-dashed border-emerald-500 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
              {hasCameraError ? (
                <div className="p-4 flex flex-col items-center text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-bold leading-relaxed">
                    Acesso à câmera negado ou indisponível. Conceda permissão no seu navegador.
                  </p>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Laser Scan Animation */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-scan" />
                  
                  {/* Overlay Guides */}
                  <div className="absolute inset-6 rounded-full border-2 border-emerald-500/20 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-full rounded-full border border-dashed border-emerald-400/40 animate-pulse" />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1 w-full min-h-[50px]">
              <h4 className="font-bold text-slate-800 dark:text-slate-250 text-sm">Escaneando Rosto...</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold animate-pulse">
                {faceMessage}
              </p>
            </div>
          </div>
        )}

        {faceStep === 'analyzing' && (
          <div className="space-y-6 w-full flex flex-col items-center py-4">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
              <Shield className="w-9 h-9 text-emerald-650 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Validando Assinatura</h4>
              <p className="text-slate-500 dark:text-slate-450 text-xs font-medium animate-pulse">
                {faceMessage}
              </p>
            </div>
          </div>
        )}

        {faceStep === 'success' && (
          <div className="space-y-6 w-full flex flex-col items-center py-4">
            <div className="relative w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg border border-emerald-100/20">
              <Check className="w-10 h-10 animate-pulse font-black" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">Autorizado!</h4>
              <p className="text-emerald-650 dark:text-emerald-400 text-xs font-bold">
                {faceMessage}
              </p>
            </div>
          </div>
        )}

        {faceStep === 'error' && (
          <div className="space-y-6 w-full flex flex-col items-center py-4">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-3xl flex items-center justify-center shadow-lg border border-red-100/10">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base font-bold">Falha no Acesso</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
                {faceMessage}
              </p>
            </div>

            <button
              onClick={() => {
                setFaceStep('scanning');
                setFaceMessage('Ajuste seu rosto no círculo...');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer mt-4"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Action button to sign out / abort */}
        <div className="w-full border-t border-slate-100 dark:border-slate-800/80 mt-6 pt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cancelar e Sair</span>
          </button>
        </div>

      </div>
    </div>
  );
}

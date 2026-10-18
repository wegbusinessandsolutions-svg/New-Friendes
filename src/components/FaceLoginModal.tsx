import React, { useState, useEffect, useRef } from 'react';
import { Camera, ShieldCheck, AlertCircle, CheckCircle2, X, RefreshCw, Lock, Sparkles, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FaceLoginModalProps {
  isOpen: boolean;
  email: string;
  storedFaceUrl: string;
  userData: any;
  onClose: () => void;
  onSuccess: (linkedPassword?: string) => Promise<void>;
  onError: (message: string) => void;
}

export default function FaceLoginModal({
  isOpen,
  email,
  storedFaceUrl,
  userData,
  onClose,
  onSuccess,
  onError,
}: FaceLoginModalProps) {
  const [step, setStep] = useState<'camera' | 'comparing' | 'success' | 'failure' | 'link_password'>('camera');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<{ isMatch: boolean; confidence: number; reason: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('Posicione seu rosto dentro da moldura circular...');
  const [linkingPassword, setLinkingPassword] = useState('');
  const [linkingError, setLinkingError] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isCameraActiveRef = useRef(false);

  // Initialize camera when modal opens
  const startCamera = async () => {
    try {
      setCameraError(null);
      isCameraActiveRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user',
        },
      });

      if (!isCameraActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr instanceof Error && playErr.name !== 'AbortError') {
            console.warn('Erro ao reproduzir vídeo:', playErr);
          }
        }
      }
    } catch (err: any) {
      console.warn('Erro de acesso à câmera no login facial:', err);
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões do seu navegador.');
    }
  };

  const stopCamera = () => {
    isCameraActiveRef.current = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('camera');
      setComparisonResult(null);
      setLinkingError('');
      setLinkingPassword('');
      setStatusMessage('Posicione seu rosto dentro da moldura circular...');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Capture current video frame as base64
  const captureFrame = (): string | null => {
    if (!videoRef.current) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 480;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Video is mirrored on screen, flip it horizontally for natural comparison
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch (err) {
      console.error('Erro ao capturar frame da câmera:', err);
      return null;
    }
  };

  // Perform facial comparison against database
  const handlePerformComparison = async (capturedBase64?: string) => {
    const liveImg = capturedBase64 || captureFrame();
    if (!liveImg) {
      setCameraError('Não foi possível capturar a imagem do seu rosto. Tente novamente.');
      return;
    }

    setStep('comparing');
    setStatusMessage('Comparando suas características faciais com o banco de dados do New Friends.br...');

    try {
      const response = await fetch('/api/verify-face-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          liveImageBase64: liveImg,
          storedImageBase64: storedFaceUrl,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar validação biométrica facial.');
      }

      const data: { isMatch: boolean; confidence: number; reason: string } = await response.json();
      setComparisonResult(data);

      if (data.isMatch) {
        stopCamera();
        setStep('success');
        setStatusMessage(`Identidade confirmada! ${data.confidence}% de correspondência biométrica.`);

        // Check if device already has cached password for this user
        const cachedStr =
          localStorage.getItem(`face_login_credentials_${email.trim().toLowerCase()}`) ||
          localStorage.getItem('face_login_credentials');

        let cachedPassword = '';
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            if (parsed.email?.toLowerCase() === email.trim().toLowerCase() && parsed.password) {
              cachedPassword = parsed.password;
            }
          } catch (e) {
            console.warn('Erro ao ler credencial facial em cache:', e);
          }
        }

        setTimeout(async () => {
          if (cachedPassword) {
            // Instant seamless passwordless login!
            try {
              await onSuccess(cachedPassword);
            } catch (authErr: any) {
              console.warn('Erro ao autenticar com senha em cache:', authErr);
              setStep('link_password');
            }
          } else {
            // First time on this browser: ask password once to permanently link device
            setStep('link_password');
          }
        }, 1200);
      } else {
        setStep('failure');
        setStatusMessage(data.reason || 'As características do rosto apresentado não correspondem ao titular.');
      }
    } catch (err: any) {
      console.error('Erro na comparação facial:', err);
      setStep('failure');
      setStatusMessage(err.message || 'Falha ao conectar com o serviço de autenticação biométrica.');
    }
  };

  // Handle first-time browser password link
  const handleLinkPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingError('');
    if (!linkingPassword) {
      setLinkingError('Digite a senha da sua conta para concluir.');
      return;
    }

    setIsSubmittingLink(true);
    try {
      await onSuccess(linkingPassword);
      // Save for subsequent 100% passwordless logins
      localStorage.setItem(
        `face_login_credentials_${email.trim().toLowerCase()}`,
        JSON.stringify({
          email: email.trim().toLowerCase(),
          password: linkingPassword,
          linkedAt: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      console.error('Erro ao vincular senha:', err);
      setLinkingError(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Senha incorreta para este e-mail. Tente novamente.'
          : err.message || 'Erro ao autenticar com esta senha.'
      );
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // Fallback selfie upload if user is in restricted environment
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        handlePerformComparison(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                <span>Reconhecimento Facial</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">
                  IA Biometria
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                New Friends.br Segurança
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User identification badge */}
        <div className="px-5 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-100/50 dark:border-indigo-900/40 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400">Validando conta:</span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[220px]">
            {email}
          </span>
        </div>

        {/* Body content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* STEP: CAMERA VIEW */}
          {step === 'camera' && (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl bg-slate-950 flex items-center justify-center">
                {cameraError ? (
                  <div className="p-4 flex flex-col items-center text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <p className="text-xs text-slate-300 leading-tight">{cameraError}</p>
                    <label className="mt-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Enviar Foto do Rosto
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
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
                    {/* Laser Scanner animation */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-scan" />
                    {/* Oval guideline */}
                    <div className="absolute inset-5 rounded-full border border-dashed border-emerald-400/50 pointer-events-none" />
                  </>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                  Apresente seu rosto na câmera
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs leading-relaxed">
                  {statusMessage}
                </p>
              </div>

              {!cameraError && (
                <button
                  type="button"
                  onClick={() => handlePerformComparison()}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>Capturar e Comparar Biometria</span>
                </button>
              )}
            </div>
          )}

          {/* STEP: COMPARING */}
          {step === 'comparing' && (
            <div className="py-8 w-full flex flex-col items-center space-y-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950 border-t-emerald-600 animate-spin"></div>
                <ShieldCheck className="w-10 h-10 text-emerald-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  Processando Biometria com IA
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold animate-pulse max-w-xs leading-relaxed">
                  {statusMessage}
                </p>
              </div>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === 'success' && (
            <div className="py-6 w-full flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg border border-emerald-100 dark:border-emerald-800/60 relative">
                <CheckCircle2 className="w-10 h-10" />
                <span className="absolute -top-2 -right-2 text-xl">✨</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  Rosto Reconhecido com Sucesso!
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  {comparisonResult?.confidence}% de correspondência biométrica
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs">
                  Certificado: você é o titular desta conta no New Friends.br.
                </p>
              </div>
            </div>
          )}

          {/* STEP: FAILURE */}
          {step === 'failure' && (
            <div className="py-4 w-full flex flex-col items-center space-y-4">
              <div className="w-18 h-18 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-3xl flex items-center justify-center shadow-md border border-rose-100 dark:border-rose-800/60">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  Rosto Não Reconhecido
                </h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold leading-relaxed px-4">
                  {comparisonResult?.reason || statusMessage}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  O rosto apresentado não correspondeu aos dados biométricos gravados no banco de dados.
                </p>
              </div>

              <div className="flex gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('camera');
                    startCamera();
                  }}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Entrar com Senha
                </button>
              </div>
            </div>
          )}

          {/* STEP: LINK PASSWORD (FIRST TIME IN THIS BROWSER) */}
          {step === 'link_password' && (
            <form onSubmit={handleLinkPasswordSubmit} className="py-2 w-full space-y-4 text-left">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  <strong>Biometria validada com sucesso!</strong>
                  <br />
                  Para vincular com segurança o Login Facial neste dispositivo, digite sua senha atual uma única vez.
                </div>
              </div>

              {linkingError && (
                <div className="p-2.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200">
                  {linkingError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha da conta
                </label>
                <input
                  required
                  type="password"
                  value={linkingPassword}
                  onChange={(e) => setLinkingPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">
                  Nas próximas vezes, bastará apresentar seu rosto para entrar instantaneamente!
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLink}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingLink ? 'Concluindo Acesso...' : 'Confirmar e Entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { sendEmailVerification, signOut, updateEmail, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Mail, CheckCircle, ArrowRight, HelpCircle, RefreshCw, AlertTriangle, Edit3, ShieldCheck } from 'lucide-react';

export default function VerifyEmail({ user, onVerified }: { user: any; onVerified?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Edit email state
  const [showEditEmail, setShowEditEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Handle resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      auth.languageCode = 'pt';
      await sendEmailVerification(user);
      setSent(true);
      setSuccessMsg('Um novo link de confirmação foi enviado! Lembre-se de checar a pasta de Spam ou Lixo Eletrônico.');
      setCountdown(30); // 30 seconds cooldown
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError('Muitas solicitações enviadas em curto período. Por favor, aguarde alguns instantes antes de reenviar.');
        setCountdown(30);
      } else {
        setError(err.message || 'Erro ao enviar o e-mail de confirmação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkVerified = async () => {
    setError('');
    setSuccessMsg('');
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        if (onVerified) {
          onVerified();
        } else {
          window.location.reload(); 
        }
        return;
      }

      // Also check if admin verified in Firestore
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.emailVerified || data.verified || data.profile?.verified) {
          sessionStorage.setItem(`skip_email_verify_${user.uid}`, 'true');
          if (onVerified) {
            onVerified();
          } else {
            window.location.reload();
          }
          return;
        }
      }

      setError('E-mail ainda não detectado como verificado. Certifique-se de clicar no link azul recebido ou ative abaixo.');
    } catch (err: any) {
      setError('Erro ao verificar status. Tente novamente em alguns segundos.');
    }
  };

  // Direct activation fallback if Firebase email delivery is blocked by ISP spam filters
  const handleDirectActivation = async () => {
    setActivating(true);
    setError('');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        emailVerified: true,
        verified: true,
        emailVerifiedAt: serverTimestamp(),
        profile: {
          verified: true
        }
      }, { merge: true });

      sessionStorage.setItem(`skip_email_verify_${user.uid}`, 'true');
      setSuccessMsg('Conta ativada com sucesso! Redirecionando...');
      setTimeout(() => {
        if (onVerified) {
          onVerified();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err: any) {
      console.error("Erro na ativação direta:", err);
      setError('Não foi possível ativar a conta no momento. Tente novamente.');
    } finally {
      setActivating(false);
    }
  };

  // Handle updating email if user typed it wrong during initial signup
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail.trim() === '' || newEmail.trim() === user.email) {
      setShowEditEmail(false);
      return;
    }
    setUpdatingEmail(true);
    setError('');
    setSuccessMsg('');
    try {
      const trimmed = newEmail.trim().toLowerCase();
      // Try verifyBeforeUpdateEmail or updateEmail
      try {
        await verifyBeforeUpdateEmail(user, trimmed);
      } catch (e1) {
        await updateEmail(user, trimmed);
        await sendEmailVerification(user);
      }

      await setDoc(doc(db, 'users', user.uid), {
        email: trimmed,
        emailAtualizadoEm: serverTimestamp()
      }, { merge: true });

      setShowEditEmail(false);
      setSuccessMsg(`Endereço de e-mail atualizado para ${trimmed}! Um novo link de confirmação foi disparado.`);
      setCountdown(30);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Por segurança, saia da conta e entre novamente antes de alterar o e-mail.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este endereço de e-mail já está cadastrado em outra conta.');
      } else if (err.code === 'auth/invalid-email') {
        setError('O formato do e-mail digitado é inválido.');
      } else {
        setError(err.message || 'Erro ao atualizar o e-mail.');
      }
    } finally {
      setUpdatingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 font-sans text-slate-800 dark:text-slate-100">
      <div className="flex flex-col items-center text-center space-y-5 max-w-md w-full bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        
        {/* Decorative ambient background accents */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-rose-500/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="relative z-10 w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-100 dark:border-indigo-900/50">
          <Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-bounce" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <span className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full uppercase tracking-wider border border-indigo-200/50 dark:border-indigo-800/40">
            Etapa de Confirmação
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Confirme seu E-mail
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
            Para habilitar o uso do aplicativo, enviamos um link de confirmação para o endereço abaixo:
          </p>

          <div className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 select-all font-mono break-all max-w-full">
            <span>{user.email}</span>
            <button
              onClick={() => setShowEditEmail(!showEditEmail)}
              title="Corrigir e-mail digitado"
              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 shrink-0 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal / Inline form to correct mistyped email */}
        {showEditEmail && (
          <form onSubmit={handleUpdateEmail} className="relative z-10 w-full bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2.5 animate-in fade-in">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Corrigir endereço de e-mail:</span>
              <button 
                type="button" 
                onClick={() => setShowEditEmail(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
            </label>
            <input 
              type="email" 
              required
              value={newEmail} 
              onChange={(e) => setNewEmail(e.target.value)} 
              placeholder="seu-email-correto@exemplo.com"
              className="w-full text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={updatingEmail || !newEmail || newEmail.trim() === user.email}
              className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {updatingEmail ? 'Atualizando...' : 'Atualizar e reenviar confirmação'}
            </button>
          </form>
        )}

        {error && (
          <div className="relative z-10 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium border border-red-200 dark:border-red-900/50 break-words w-full text-left flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="relative z-10 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium border border-emerald-200 dark:border-emerald-900/50 w-full flex items-start gap-2 text-left">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Primary actions */}
        <div className="w-full flex flex-col gap-2.5 relative z-10 pt-1">
          <button 
            onClick={checkVerified}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <span>Já confirmei o e-mail</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleResend}
            disabled={loading || countdown > 0}
            className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-[0.98] transition-all disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {loading ? 'Reenviando...' : countdown > 0 ? `Aguarde ${countdown}s para reenviar` : 'Reenviar link de confirmação'}
            </span>
          </button>
        </div>

        {/* Important delivery guide */}
        <div className="relative z-10 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-left space-y-2 w-full">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 text-xs">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>O e-mail não chegou na sua Caixa de Entrada?</span>
          </div>
          <p className="leading-relaxed">
            • <strong>Remetente oficial:</strong> O e-mail é disparado por <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px] font-mono text-slate-800 dark:text-slate-200 break-all">noreply@gen-lang-client-0417371710.firebaseapp.com</code>.
          </p>
          <p className="leading-relaxed">
            • <strong>Cheque o Spam:</strong> É muito frequente filtros do Gmail, Outlook, Hotmail ou Yahoo direcionarem para <strong>Spam</strong>, <strong>Lixo Eletrônico</strong> ou aba <strong>Promoções</strong>.
          </p>
          <p className="leading-relaxed">
            • <strong>Dica de busca:</strong> Digite <em>"Firebase"</em> ou <em>"noreply"</em> na barra de pesquisa do seu aplicativo de e-mail.
          </p>
        </div>

        {/* Direct activation alternative if email is blocked by provider */}
        <div className="relative z-10 w-full pt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button 
            onClick={handleDirectActivation}
            disabled={activating}
            className="w-full py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{activating ? 'Ativando acesso...' : 'Não recebi o e-mail: Ativar conta e entrar agora'}</span>
          </button>
        </div>

        <button 
          onClick={() => signOut(auth)}
          className="relative z-10 text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors uppercase tracking-wider cursor-pointer"
        >
          Sair ou usar outro e-mail
        </button>
      </div>
    </div>
  );
}

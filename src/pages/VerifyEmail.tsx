import { useState } from 'react';
import { auth } from '../lib/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { Mail, CheckCircle, ArrowRight, HelpCircle } from 'lucide-react';

export default function VerifyEmail({ user, onVerified }: { user: any; onVerified?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      // Force language to portuguese before sending
      auth.languageCode = 'pt';
      await sendEmailVerification(user);
      setSent(true);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError('Muitas solicitações enviadas em curto período. Por favor, aguarde um momento antes de reenviar.');
      } else {
        setError(err.message || 'Erro ao enviar o e-mail de confirmação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkVerified = async () => {
    setError('');
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        if (onVerified) {
          onVerified();
        } else {
          window.location.reload(); 
        }
      } else {
        setError('E-mail ainda não verificado. Certifique-se de clicar no link de confirmação no e-mail recebido.');
      }
    } catch (err: any) {
      setError('Erro ao atualizar status. Tente novamente em alguns segundos.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-6 font-sans text-slate-800">
      <div className="flex flex-col items-center text-center space-y-6 max-w-md w-full bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
        
        {/* Decorative ambient blobs */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full opacity-50"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-50 rounded-full opacity-50"></div>

        <div className="relative z-10 w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-md mb-2">
          <Mail className="w-8 h-8 text-indigo-600 animate-bounce" />
        </div>
        
        <div className="relative z-10 space-y-3">
          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
            Etapa 1: Confirmação de E-mail
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Cadastro Concluído!
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed px-2">
            Você terminou o seu cadastro, e para habilitar o uso do aplicativo, confirme o seu endereço de e-mail, clicando no link que foi enviado ao e-mail informado no início do cadastramento do usuário.
          </p>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 select-all font-mono break-all max-w-full">
            {user.email}
          </div>
        </div>

        {error && (
          <div className="relative z-10 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100 break-words w-full">
            ⚠️ {error}
          </div>
        )}
        
        {sent && (
          <div className="relative z-10 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100 w-full flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Um novo link de ativação em português foi enviado!</span>
          </div>
        )}

        <div className="w-full flex flex-col gap-3 relative z-10 pt-2">
          <button 
            onClick={checkVerified}
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>Já confirmei o e-mail</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleResend}
            disabled={loading}
            className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'Reenviando...' : 'Reenviar link de confirmação'}
          </button>
        </div>

        <div className="relative z-10 bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] text-slate-400 text-left space-y-1.5 w-full">
          <div className="flex items-center gap-1 font-bold text-slate-600 text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Instruções Importantes</span>
          </div>
          <p>
            1. Abra seu leitor de e-mail e procure pela mensagem enviada pelo aplicativo.
          </p>
          <p>
            2. O assunto do e-mail estará em português e conterá um link oficial do Firebase para ativação.
          </p>
          <p>
            3. Caso não encontre na Caixa de Entrada, certifique-se de checar as pastas de <strong className="text-slate-500">Spam</strong> ou <strong className="text-slate-500">Lixo Eletrônico</strong>.
          </p>
        </div>

        <button 
          onClick={() => signOut(auth)}
          className="relative z-10 text-xs text-slate-400 hover:text-red-500 font-bold mt-2 transition-colors uppercase tracking-wider"
        >
          Sair ou usar outro e-mail
        </button>
      </div>
    </div>
  );
}

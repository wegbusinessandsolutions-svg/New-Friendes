import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import RecentActivity from '../components/RecentActivity';
import { ShieldCheck, Lock, Eye, EyeOff, Activity, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function RecentActivities() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) {
      setError('Sessão expirada. Por favor, faça login novamente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Re-authenticate user by signing in again with current email & typed password
      await signInWithEmailAndPassword(auth, auth.currentUser.email, password);
      setIsVerified(true);
    } catch (err: any) {
      console.error("Verification failed:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Senha incorreta. Por favor, tente novamente.');
      } else {
        setError('Não foi possível verificar a senha. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isVerified) {
    return (
      <div className="flex flex-col font-sans p-6 min-h-[75vh] justify-center items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 text-center"
        >
          {/* Header Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-55 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md">
            <Lock className="w-8 h-8" />
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Área Segura
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Por motivos de segurança, por favor confirme sua senha de cadastro para visualizar as suas atividades recentes.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-500 text-left bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  // Once password is verified, show the full activities page
  return (
    <div className="flex flex-col font-sans p-4 space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-full transition-colors cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Atividades Recentes
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Sua trilha de interações e flertes
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <RecentActivity />
      </motion.div>
    </div>
  );
}

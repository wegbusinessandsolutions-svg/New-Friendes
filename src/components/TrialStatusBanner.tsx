import React from 'react';
import { Sparkles, Shield, Clock, ChevronRight, Zap } from 'lucide-react';
import { SubscriptionEvaluation, formatCurrencyBRL } from '../utils/subscription';

interface TrialStatusBannerProps {
  evaluation: SubscriptionEvaluation;
  onOpenUpgradeModal: () => void;
}

export default function TrialStatusBanner({
  evaluation,
  onOpenUpgradeModal
}: TrialStatusBannerProps) {
  // If user is lifetime exempt or admin, don't crowd the top UI
  if (evaluation.status === 'lifetime_exempt') {
    return null;
  }

  // Active annual subscription
  if (evaluation.status === 'active') {
    const formattedDate = evaluation.expiresAtDate
      ? evaluation.expiresAtDate.toLocaleDateString('pt-BR')
      : '1 ano';

    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border-b border-emerald-200/60 dark:border-emerald-800/40 px-3 py-1.5 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
          <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Assinatura Anual Ativa • Válida até <strong className="font-bold">{formattedDate}</strong>
          </span>
        </div>
        <button
          onClick={onOpenUpgradeModal}
          className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-0.5"
        >
          <span>Ver Plano</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Trial expired
  if (evaluation.status === 'trial_expired' || evaluation.status === 'renewal_due') {
    return (
      <div className="bg-rose-500 text-white px-3 py-2 flex items-center justify-between text-xs font-bold shrink-0 shadow-sm animate-pulse">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-white" />
          <span>
            {evaluation.status === 'renewal_due' 
              ? 'Anuidade vencida (+50% para renovação)' 
              : 'Seu período de teste de 30 dias expirou'}
          </span>
        </div>
        <button
          onClick={onOpenUpgradeModal}
          className="bg-white text-rose-600 px-3 py-1 rounded-full text-[11px] font-black hover:bg-rose-50 shadow transition-all cursor-pointer"
        >
          Pagar {evaluation.amountFormatted}
        </button>
      </div>
    );
  }

  // In 30 days trial
  const daysLeft = evaluation.trialDaysRemaining;
  const genderPrice = evaluation.amountFormatted;

  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-pink-950/40 border-b border-indigo-100 dark:border-indigo-900/40 px-3.5 py-1.5 flex items-center justify-between text-[11px] shrink-0">
      <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
        <span>
          <strong className="font-bold text-indigo-700 dark:text-indigo-300">
            {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
          </strong> de teste 100% grátis
        </span>
      </div>

      <button
        onClick={onOpenUpgradeModal}
        className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-0.5 rounded-full transition-all shadow-sm cursor-pointer active:scale-95"
      >
        <span>Anuidade {genderPrice}</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

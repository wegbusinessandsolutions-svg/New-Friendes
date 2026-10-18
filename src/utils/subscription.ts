/**
 * Subscription, Pricing and Trial Utilities for New Friends.br
 * 
 * Rules:
 * - 30 days of 100% free usage from account registration.
 * - After trial period:
 *   - Female: R$ 36,50 (1 year access)
 *   - Male: R$ 73,00 (1 year access)
 * - Annual Renewal:
 *   - After 1 year of paid usage, renewals include a 50% increase:
 *     - Female: R$ 54,75 (R$ 36,50 + 50%)
 *     - Male: R$ 109,50 (R$ 73,00 + 50%)
 * - Payment Gateway: Mercado Pago (PIX, Cartão de Crédito, Boleto)
 * - Managed through Admin CRM
 */

export const TRIAL_DAYS_DEFAULT = 30;

export const BASE_PRICES = {
  FEMALE: 36.50,
  MALE: 73.00,
  OTHER: 73.00,
};

export const RENEWAL_SURCHARGE_PERCENT = 50; // +50% on renewals after 1st year

export const RENEWAL_PRICES = {
  FEMALE: 54.75, // 36.50 * 1.5
  MALE: 109.50,  // 73.00 * 1.5
  OTHER: 109.50,
};

export type SubscriptionStatus = 
  | 'trial'            // Within 30 days free trial
  | 'trial_expired'    // 30 days passed, has not paid yet
  | 'active'           // Paid 1-year access is active
  | 'renewal_due'      // 1 year paid access has passed, needs +50% renewal
  | 'lifetime_exempt'; // Admins or special VIPs exempt from payment

export interface UserSubscriptionData {
  status?: string;
  plan?: string;
  year?: number;
  amount?: number;
  paidAt?: any;
  expiresAt?: any;
  paymentMethod?: string;
  paymentId?: string;
  isRenewal?: boolean;
  trialExtensionDays?: number;
  exempt?: boolean;
  notes?: string;
}

export interface SubscriptionEvaluation {
  status: SubscriptionStatus;
  isBlocked: boolean;
  isTrial: boolean;
  trialDaysTotal: number;
  trialDaysUsed: number;
  trialDaysRemaining: number;
  isRenewal: boolean;
  amountToPay: number;
  amountFormatted: string;
  expiresAtDate: Date | null;
  daysUntilExpiration: number | null;
  genderCategory: 'female' | 'male' | 'other';
  reasonText: string;
}

/**
 * Normalizes gender string from profile
 */
export function getGenderCategory(sexo?: string): 'female' | 'male' | 'other' {
  if (!sexo) return 'male';
  const clean = sexo.toLowerCase().trim();
  if (clean.includes('fem') || clean === 'f' || clean.includes('mulher')) {
    return 'female';
  }
  if (clean.includes('masc') || clean === 'm' || clean.includes('homem')) {
    return 'male';
  }
  return 'other';
}

/**
 * Get pricing for user depending on gender and whether it's the initial year or renewal
 */
export function calculateSubscriptionPrice(gender: 'female' | 'male' | 'other', isRenewal: boolean = false): number {
  if (isRenewal) {
    if (gender === 'female') return RENEWAL_PRICES.FEMALE;
    return RENEWAL_PRICES.MALE;
  }
  if (gender === 'female') return BASE_PRICES.FEMALE;
  return BASE_PRICES.MALE;
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Evaluates the user subscription status and trial period
 */
export function evaluateUserSubscription(userDocData: any, userEmail?: string | null): SubscriptionEvaluation {
  const adminEmails = [
    'ceo@newfriends.com',
    'sac@wegbusiness.com',
    'ceo@wegbusiness.com',
    'wegbusinessandsolutions@gmail.com'
  ];

  // 1. Admin / CEO email is always lifetime exempt
  if (userEmail && adminEmails.includes(userEmail.toLowerCase().trim())) {
    return {
      status: 'lifetime_exempt',
      isBlocked: false,
      isTrial: false,
      trialDaysTotal: TRIAL_DAYS_DEFAULT,
      trialDaysUsed: 0,
      trialDaysRemaining: 999,
      isRenewal: false,
      amountToPay: 0,
      amountFormatted: 'R$ 0,00',
      expiresAtDate: null,
      daysUntilExpiration: null,
      genderCategory: 'male',
      reasonText: 'Acesso Administrativo Vitalício'
    };
  }

  // 2. Explicit role check
  if (userDocData?.role === 'Admin' || userDocData?.subscription?.exempt === true) {
    return {
      status: 'lifetime_exempt',
      isBlocked: false,
      isTrial: false,
      trialDaysTotal: TRIAL_DAYS_DEFAULT,
      trialDaysUsed: 0,
      trialDaysRemaining: 999,
      isRenewal: false,
      amountToPay: 0,
      amountFormatted: 'R$ 0,00',
      expiresAtDate: null,
      daysUntilExpiration: null,
      genderCategory: 'other',
      reasonText: 'Isenção Especial Ativa'
    };
  }

  const rawSexo = userDocData?.profile?.sexo || userDocData?.sexo;
  const genderCategory = getGenderCategory(rawSexo);
  const now = Date.now();

  const sub = userDocData?.subscription as UserSubscriptionData | undefined;

  // 3. Check if user has an existing active paid subscription
  if (sub && sub.expiresAt) {
    let expTime = 0;
    if (typeof sub.expiresAt === 'number') {
      expTime = sub.expiresAt;
    } else if (sub.expiresAt?.toMillis) {
      expTime = sub.expiresAt.toMillis();
    } else if (sub.expiresAt?.seconds) {
      expTime = sub.expiresAt.seconds * 1000;
    } else {
      const parsed = new Date(sub.expiresAt).getTime();
      if (!isNaN(parsed)) expTime = parsed;
    }

    if (expTime > 0) {
      const diffMs = expTime - now;
      const daysUntilExp = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs > 0) {
        // Active subscription!
        return {
          status: 'active',
          isBlocked: false,
          isTrial: false,
          trialDaysTotal: TRIAL_DAYS_DEFAULT,
          trialDaysUsed: 30,
          trialDaysRemaining: 0,
          isRenewal: Boolean(sub.isRenewal || (sub.year && sub.year > 1)),
          amountToPay: 0,
          amountFormatted: formatCurrencyBRL(sub.amount || calculateSubscriptionPrice(genderCategory, false)),
          expiresAtDate: new Date(expTime),
          daysUntilExpiration: daysUntilExp,
          genderCategory,
          reasonText: `Assinatura Anual Ativa (${daysUntilExp} dias restantes)`
        };
      } else {
        // Paid year has ended! Requires renewal with +50%
        const renewalPrice = calculateSubscriptionPrice(genderCategory, true);
        return {
          status: 'renewal_due',
          isBlocked: true,
          isTrial: false,
          trialDaysTotal: TRIAL_DAYS_DEFAULT,
          trialDaysUsed: 30,
          trialDaysRemaining: 0,
          isRenewal: true,
          amountToPay: renewalPrice,
          amountFormatted: formatCurrencyBRL(renewalPrice),
          expiresAtDate: new Date(expTime),
          daysUntilExpiration: 0,
          genderCategory,
          reasonText: `Anuidade vencida. Renovação necessária (+50%: ${formatCurrencyBRL(renewalPrice)})`
        };
      }
    }
  }

  // 4. Calculate free trial period (30 days from creation + any extension granted by Admin)
  let createdAtMs = now;
  const rawCreatedAt = userDocData?.createdAt || userDocData?.criadoEm;
  if (rawCreatedAt) {
    if (typeof rawCreatedAt === 'number') {
      createdAtMs = rawCreatedAt;
    } else if (rawCreatedAt?.toMillis) {
      createdAtMs = rawCreatedAt.toMillis();
    } else if (rawCreatedAt?.seconds) {
      createdAtMs = rawCreatedAt.seconds * 1000;
    } else {
      const parsed = new Date(rawCreatedAt).getTime();
      if (!isNaN(parsed)) createdAtMs = parsed;
    }
  }

  const extensionDays = sub?.trialExtensionDays || 0;
  const totalTrialDays = TRIAL_DAYS_DEFAULT + extensionDays;
  const trialDurationMs = totalTrialDays * 24 * 60 * 60 * 1000;
  const trialEndMs = createdAtMs + trialDurationMs;
  const diffFromEnd = trialEndMs - now;

  const trialDaysUsed = Math.min(
    totalTrialDays,
    Math.max(0, Math.floor((now - createdAtMs) / (1000 * 60 * 60 * 24)))
  );
  const trialDaysRemaining = Math.max(0, Math.ceil(diffFromEnd / (1000 * 60 * 60 * 24)));

  const basePrice = calculateSubscriptionPrice(genderCategory, false);

  if (diffFromEnd > 0) {
    // Within 30-day free trial!
    return {
      status: 'trial',
      isBlocked: false,
      isTrial: true,
      trialDaysTotal: totalTrialDays,
      trialDaysUsed,
      trialDaysRemaining,
      isRenewal: false,
      amountToPay: basePrice,
      amountFormatted: formatCurrencyBRL(basePrice),
      expiresAtDate: new Date(trialEndMs),
      daysUntilExpiration: trialDaysRemaining,
      genderCategory,
      reasonText: `Período de Teste Gratuito (${trialDaysRemaining} dias restantes de ${totalTrialDays})`
    };
  }

  // 5. 30 days free trial expired! User must pay annual symbolic fee
  return {
    status: 'trial_expired',
    isBlocked: true,
    isTrial: false,
    trialDaysTotal: totalTrialDays,
    trialDaysUsed: totalTrialDays,
    trialDaysRemaining: 0,
    isRenewal: false,
    amountToPay: basePrice,
    amountFormatted: formatCurrencyBRL(basePrice),
    expiresAtDate: new Date(trialEndMs),
    daysUntilExpiration: 0,
    genderCategory,
    reasonText: `Período de teste de 30 dias expirou. Anuidade de ${formatCurrencyBRL(basePrice)} necessária.`
  };
}

/**
 * Builds formatted WhatsApp message for Admin to send payment or renewal notice
 */
export function buildWhatsAppPaymentMessage(
  userName: string,
  userGender: 'female' | 'male' | 'other',
  status: SubscriptionStatus,
  amount: number,
  daysRemaining?: number
): string {
  const firstName = userName?.split(' ')[0] || 'Usuário(a)';
  const formattedVal = formatCurrencyBRL(amount);

  if (status === 'trial') {
    return (
      `Olá, *${firstName}*! 😊\n\n` +
      `Esperamos que esteja aproveitando muito o *New Friends.br*! ` +
      `Você ainda tem *${daysRemaining || 0} dias gratuitos* de teste no seu plano de 30 dias.\n\n` +
      `Após o término do teste, sua anuidade para 1 ano inteiro de conexões seguras, chat e botão SOS com localização será de apenas *${formattedVal}*.\n\n` +
      `Caso queira garantir sua vaga antecipadamente pelo Mercado Pago (PIX ou Cartão), responda a esta mensagem ou acerte diretamente no aplicativo! ✨`
    );
  }

  if (status === 'renewal_due') {
    return (
      `Olá, *${firstName}*! Tudo bem? 🌟\n\n` +
      `Seu 1º ano de assinatura no *New Friends.br* foi concluído com muito sucesso! Parabéns por fazer parte da nossa comunidade.\n\n` +
      `Para renovar seu acesso por mais 1 ano completo (365 dias adicionais), o valor com o acréscimo de renovação de 50% é de *${formattedVal}*.\n\n` +
      `Você pode renovar instantaneamente via Mercado Pago (PIX ou Cartão) diretamente no app.\n\n` +
      `Qualquer dúvida, estamos à disposição por aqui! Abraços, Equipe New Friends / W.E.G. Business.`
    );
  }

  // trial_expired
  return (
    `Olá, *${firstName}*! Tudo bem? 😊\n\n` +
    `Seu período de teste gratuito de 30 dias no aplicativo *New Friends.br* chegou ao fim.\n\n` +
    `Para continuar usando todas as funções exclusivas (encontrar pessoas próximas, chat ilimitado, localização em tempo real e botão de emergência SOS), o valor simbólico anual é de apenas *${formattedVal}* (válido por 1 ano inteiro!).\n\n` +
    `O pagamento pode ser feito de forma rápida e 100% segura pelo *Mercado Pago* (PIX com aprovação imediata ou Cartão de Crédito) direto pelo app.\n\n` +
    `Abra o aplicativo ou nos envie uma mensagem aqui caso precise de auxílio! Abraços, Equipe New Friends / W.E.G. Business.`
  );
}

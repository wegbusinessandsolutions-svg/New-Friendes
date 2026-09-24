/**
 * Utilitário para definição e identificação de Signos do Zodíaco.
 * 
 * Regra e Tabela oficial:
 * - Áries: 21 de março a 19 de abril
 * - Touro: 20 de abril a 20 de maio
 * - Gêmeos: 21 de maio a 20 de junho
 * - Câncer: 21 de junho a 22 de julho
 * - Leão: 23 de julho a 22 de agosto
 * - Virgem: 23 de agosto a 22 de setembro
 * - Libra: 23 de setembro a 22 de outubro
 * - Escorpião: 23 de outubro a 21 de novembro
 * - Sagitário: 22 de novembro a 21 de dezembro
 * - Capricórnio: 22 de dezembro a 19 de janeiro
 * - Aquário: 20 de janeiro a 18 de fevereiro
 * - Peixes: 19 de fevereiro a 20 de março
 */

export interface ZodiacSignInfo {
  id: string;
  name: string;
  symbol: string;
  element: 'Fogo' | 'Terra' | 'Ar' | 'Água';
  period: string;
  shortPeriod: string;
  color: string;
  badgeBg: string;
  borderClass: string;
  textClass: string;
}

export const ZODIAC_SIGNS: Record<string, ZodiacSignInfo> = {
  aries: {
    id: 'aries',
    name: 'Áries',
    symbol: '♈',
    element: 'Fogo',
    period: '21 de março a 19 de abril',
    shortPeriod: '21/03 a 19/04',
    color: '#EF4444',
    badgeBg: 'bg-rose-500/90 dark:bg-rose-600/90 text-white',
    borderClass: 'border-rose-400/30',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  touro: {
    id: 'touro',
    name: 'Touro',
    symbol: '♉',
    element: 'Terra',
    period: '20 de abril a 20 de maio',
    shortPeriod: '20/04 a 20/05',
    color: '#10B981',
    badgeBg: 'bg-emerald-600/90 text-white',
    borderClass: 'border-emerald-400/30',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  gemeos: {
    id: 'gemeos',
    name: 'Gêmeos',
    symbol: '♊',
    element: 'Ar',
    period: '21 de maio a 20 de junho',
    shortPeriod: '21/05 a 20/06',
    color: '#F59E0B',
    badgeBg: 'bg-amber-500/90 text-white',
    borderClass: 'border-amber-400/30',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  cancer: {
    id: 'cancer',
    name: 'Câncer',
    symbol: '♋',
    element: 'Água',
    period: '21 de junho a 22 de julho',
    shortPeriod: '21/06 a 22/07',
    color: '#06B6D4',
    badgeBg: 'bg-cyan-600/90 text-white',
    borderClass: 'border-cyan-400/30',
    textClass: 'text-cyan-600 dark:text-cyan-400',
  },
  leao: {
    id: 'leao',
    name: 'Leão',
    symbol: '♌',
    element: 'Fogo',
    period: '23 de julho a 22 de agosto',
    shortPeriod: '23/07 a 22/08',
    color: '#F97316',
    badgeBg: 'bg-orange-500/90 text-white',
    borderClass: 'border-orange-400/30',
    textClass: 'text-orange-600 dark:text-orange-400',
  },
  virgem: {
    id: 'virgem',
    name: 'Virgem',
    symbol: '♍',
    element: 'Terra',
    period: '23 de agosto a 22 de setembro',
    shortPeriod: '23/08 a 22/09',
    color: '#84CC16',
    badgeBg: 'bg-lime-600/90 text-white',
    borderClass: 'border-lime-400/30',
    textClass: 'text-lime-600 dark:text-lime-400',
  },
  libra: {
    id: 'libra',
    name: 'Libra',
    symbol: '♎',
    element: 'Ar',
    period: '23 de setembro a 22 de outubro',
    shortPeriod: '23/09 a 22/10',
    color: '#8B5CF6',
    badgeBg: 'bg-purple-600/90 text-white',
    borderClass: 'border-purple-400/30',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  escorpiao: {
    id: 'escorpiao',
    name: 'Escorpião',
    symbol: '♏',
    element: 'Água',
    period: '23 de outubro a 21 de novembro',
    shortPeriod: '23/10 a 21/11',
    color: '#9333EA',
    badgeBg: 'bg-fuchsia-700/90 text-white',
    borderClass: 'border-fuchsia-400/30',
    textClass: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  sagitario: {
    id: 'sagitario',
    name: 'Sagitário',
    symbol: '♐',
    element: 'Fogo',
    period: '22 de novembro a 21 de dezembro',
    shortPeriod: '22/11 a 21/12',
    color: '#3B82F6',
    badgeBg: 'bg-blue-600/90 text-white',
    borderClass: 'border-blue-400/30',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  capricornio: {
    id: 'capricornio',
    name: 'Capricórnio',
    symbol: '♑',
    element: 'Terra',
    period: '22 de dezembro a 19 de janeiro',
    shortPeriod: '22/12 a 19/01',
    color: '#64748B',
    badgeBg: 'bg-slate-700/90 text-white',
    borderClass: 'border-slate-400/30',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
  aquario: {
    id: 'aquario',
    name: 'Aquário',
    symbol: '♒',
    element: 'Ar',
    period: '20 de janeiro a 18 de fevereiro',
    shortPeriod: '20/01 a 18/02',
    color: '#0284C7',
    badgeBg: 'bg-sky-600/90 text-white',
    borderClass: 'border-sky-400/30',
    textClass: 'text-sky-600 dark:text-sky-400',
  },
  peixes: {
    id: 'peixes',
    name: 'Peixes',
    symbol: '♓',
    element: 'Água',
    period: '19 de fevereiro a 20 de março',
    shortPeriod: '19/02 a 20/03',
    color: '#14B8A6',
    badgeBg: 'bg-teal-600/90 text-white',
    borderClass: 'border-teal-400/30',
    textClass: 'text-teal-600 dark:text-teal-400',
  },
};

export const ZODIAC_LIST: ZodiacSignInfo[] = Object.values(ZODIAC_SIGNS);

/**
 * Calcula o Signo do Zodíaco a partir do dia e mês de nascimento.
 */
export function getZodiacSignByDayMonth(day: number, month: number): ZodiacSignInfo | null {
  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  // Áries: 21 de março a 19 de abril
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
    return ZODIAC_SIGNS.aries;
  }
  // Touro: 20 de abril a 20 de maio
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
    return ZODIAC_SIGNS.touro;
  }
  // Gêmeos: 21 de maio a 20 de junho
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return ZODIAC_SIGNS.gemeos;
  }
  // Câncer: 21 de junho a 22 de julho
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
    return ZODIAC_SIGNS.cancer;
  }
  // Leão: 23 de julho a 22 de agosto
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
    return ZODIAC_SIGNS.leao;
  }
  // Virgem: 23 de agosto a 22 de setembro
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
    return ZODIAC_SIGNS.virgem;
  }
  // Libra: 23 de setembro a 22 de outubro
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
    return ZODIAC_SIGNS.libra;
  }
  // Escorpião: 23 de outubro a 21 de novembro
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
    return ZODIAC_SIGNS.escorpiao;
  }
  // Sagitário: 22 de novembro a 21 de dezembro
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
    return ZODIAC_SIGNS.sagitario;
  }
  // Capricórnio: 22 de dezembro a 19 de janeiro
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
    return ZODIAC_SIGNS.capricornio;
  }
  // Aquário: 20 de janeiro a 18 de fevereiro
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
    return ZODIAC_SIGNS.aquario;
  }
  // Peixes: 19 de fevereiro a 20 de março
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) {
    return ZODIAC_SIGNS.peixes;
  }

  return null;
}

/**
 * Extrai dia e mês de uma string ou objeto Date e calcula o signo.
 * Suporta formatos:
 * - "DD-MM-AAAA" (ex: "23-09-1996")
 * - "DD/MM/AAAA"
 * - "AAAA-MM-DD"
 * - "DD-MM" (durante digitação interativa)
 * - Objeto Date
 */
export function getZodiacSignFromDate(dateInput: string | Date | null | undefined): ZodiacSignInfo | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return getZodiacSignByDayMonth(dateInput.getDate(), dateInput.getMonth() + 1);
  }

  if (typeof dateInput !== 'string') return null;
  const str = dateInput.trim();
  if (!str) return null;

  // Formato ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return getZodiacSignByDayMonth(day, month);
  }

  // Formato Brasileiro: DD-MM-YYYY ou DD/MM/YYYY ou DD-MM durante digitação
  const brMatch = str.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    return getZodiacSignByDayMonth(day, month);
  }

  return null;
}

/**
 * Busca signo pelo nome, id ou símbolo (ex: 'Áries', 'aries', 'Áries ♈', '♈', etc.)
 */
export function getZodiacSignByName(nameOrSymbol: string | null | undefined): ZodiacSignInfo | null {
  if (!nameOrSymbol || typeof nameOrSymbol !== 'string') return null;
  const clean = nameOrSymbol.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos

  for (const sign of ZODIAC_LIST) {
    const signClean = sign.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (
      clean === sign.id ||
      clean === signClean ||
      clean.includes(signClean) ||
      clean.includes(sign.id) ||
      nameOrSymbol.includes(sign.symbol)
    ) {
      return sign;
    }
  }

  return null;
}

/**
 * Determina o signo de um usuário ou perfil de forma automática.
 * Prioriza a data de nascimento; se indisponível, busca pelo campo 'signo' já registrado.
 */
export function resolveUserZodiac(userOrProfile: any): ZodiacSignInfo | null {
  if (!userOrProfile) return null;

  const profile = userOrProfile.profile || userOrProfile;

  // 1. Tentar pela data de nascimento
  const dob = profile.dataNascimento || userOrProfile.dataNascimento;
  if (dob) {
    const fromDob = getZodiacSignFromDate(dob);
    if (fromDob) return fromDob;
  }

  // 2. Tentar pelo campo 'signo' existente
  const signoField = profile.signo || userOrProfile.signo;
  if (signoField) {
    const fromName = getZodiacSignByName(signoField);
    if (fromName) return fromName;
  }

  // 3. Fallback de demonstração caso usuário não tenha data preenchida
  // Baseado na idade ou hash do ID para ter sempre um signo estético e consistente
  const seed = (userOrProfile.userId || userOrProfile.id || profile.nome || '').toString();
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % ZODIAC_LIST.length;
    return ZODIAC_LIST[idx];
  }

  return null;
}

import React from 'react';
import { ZodiacSignInfo, resolveUserZodiac, getZodiacSignByName, getZodiacSignFromDate } from '../utils/zodiac';

interface ZodiacBadgeProps {
  user?: any;
  sign?: string | ZodiacSignInfo | null;
  date?: string | Date | null;
  variant?: 'image-badge' | 'inline' | 'card' | 'avatar-badge' | 'pill';
  className?: string;
  showPeriod?: boolean;
}

export default function ZodiacBadge({
  user,
  sign,
  date,
  variant = 'image-badge',
  className = '',
  showPeriod = false,
}: ZodiacBadgeProps) {
  let info: ZodiacSignInfo | null = null;

  if (typeof sign === 'object' && sign !== null && 'symbol' in sign) {
    info = sign as ZodiacSignInfo;
  } else if (typeof sign === 'string' && sign) {
    info = getZodiacSignByName(sign);
  } else if (date) {
    info = getZodiacSignFromDate(date);
  } else if (user) {
    info = resolveUserZodiac(user);
  }

  if (!info) return null;

  // 1. Image Floating Badge (usado sobreposto à foto do perfil)
  if (variant === 'image-badge') {
    return (
      <div 
        className={`bg-slate-950/80 hover:bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20 tracking-wide transition-all select-none ${className}`}
        title={`Signo: ${info.name}`}
      >
        <span className="text-xs text-amber-300 drop-shadow-xs leading-none">{info.symbol}</span>
        <span className="font-bold text-[10px] text-white/95 leading-tight">{info.name}</span>
      </div>
    );
  }

  // 2. Avatar Corner Badge (posicionado no canto inferior do avatar circular)
  if (variant === 'avatar-badge') {
    return (
      <div 
        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] text-amber-300 shadow-md ${className}`}
        title={`Signo: ${info.name}`}
      >
        <span className="leading-none">{info.symbol}</span>
      </div>
    );
  }

  // 3. Inline Badge (ao lado do nome ou na linha de informações)
  if (variant === 'inline') {
    return (
      <span 
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-2xs ${className}`}
        title={`Signo: ${info.name}`}
      >
        <span className="text-xs leading-none">{info.symbol}</span>
        <span>{info.name}</span>
      </span>
    );
  }

  // 4. Pill Badge (usado em cabeçalhos de perfil)
  if (variant === 'pill') {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-md backdrop-blur-md bg-slate-900/85 hover:bg-slate-900 text-white border border-amber-400/30 transition-transform active:scale-95 cursor-default ${className}`}
        title={`Signo: ${info.name}`}
      >
        <span className="text-sm text-amber-300 leading-none">{info.symbol}</span>
        <span className="tracking-wide text-white">{info.name}</span>
      </div>
    );
  }

  // 5. Card Completo
  return (
    <div className={`p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-slate-800 dark:to-slate-850 border border-amber-200/70 dark:border-slate-700 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-bold shadow-sm">
          {info.symbol}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{info.name}</h4>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              {info.element}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {info.period}
          </p>
        </div>
      </div>
    </div>
  );
}

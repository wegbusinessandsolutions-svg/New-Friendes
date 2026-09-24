import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function getTheme(): Theme {
  return 'light';
}

export function setTheme(_theme?: Theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', 'light');
  applyTheme('light');
  window.dispatchEvent(new Event('theme-changed'));
}

export function applyTheme(_theme?: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark');
  document.body.classList.remove('dark');
}

export function useTheme() {
  const [theme] = useState<Theme>('light');
  const [isDark] = useState<boolean>(false);

  useEffect(() => {
    // Always enforce the default theme across the application
    localStorage.setItem('theme', 'light');
    applyTheme('light');
  }, []);

  return {
    theme,
    setTheme,
    isDark: false
  };
}


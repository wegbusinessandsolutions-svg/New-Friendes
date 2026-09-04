import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as Theme) || 'system';
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', theme);
  applyTheme(theme);
  window.dispatchEvent(new Event('theme-changed'));
}

export function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setInternalTheme] = useState<Theme>(getTheme);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const t = getTheme();
    return t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const updateTheme = () => {
      const current = getTheme();
      setInternalTheme(current);
      
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const darkActive = current === 'dark' || (current === 'system' && systemDark);
      
      setIsDark(darkActive);
      
      if (darkActive) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };

    // Apply on mount
    updateTheme();

    const handleThemeChange = () => {
      updateTheme();
    };

    // Listen to manual changes
    window.addEventListener('theme-changed', handleThemeChange);

    // Listen to system changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return {
    theme,
    setTheme,
    isDark
  };
}

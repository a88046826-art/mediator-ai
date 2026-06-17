'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function ThemeApplier() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    if (theme === 'meditor') {
      document.documentElement.setAttribute('data-theme', 'meditor');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);
  return null;
}

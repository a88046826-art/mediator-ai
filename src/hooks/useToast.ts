'use client';

import { useAppStore } from '@/store/useAppStore';

export function useToast() {
  const showToast = useAppStore((s) => s.showToast);
  return { showToast };
}

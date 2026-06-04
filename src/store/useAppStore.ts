'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CodeType, TeamMember, TestResult, Message } from '@/types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  testResult: TestResult | null;
  teamMembers: TeamMember[];
  messages: Message[];
  meetingContext: string;
  toast: Toast | null;

  setTestResult: (result: TestResult) => void;
  clearTestResult: () => void;

  addTeamMember: (member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  clearTeamMembers: () => void;

  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  setMeetingContext: (ctx: string) => void;

  showToast: (message: string, type?: Toast['type']) => void;
  hideToast: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      testResult: null,
      teamMembers: [],
      messages: [],
      meetingContext: '',
      toast: null,

      setTestResult: (result) => set({ testResult: result }),
      clearTestResult: () => set({ testResult: null }),

      addTeamMember: (member) =>
        set((s) => ({
          teamMembers: s.teamMembers.find((m) => m.id === member.id)
            ? s.teamMembers
            : [...s.teamMembers, member],
        })),
      removeTeamMember: (id) =>
        set((s) => ({ teamMembers: s.teamMembers.filter((m) => m.id !== id) })),
      clearTeamMembers: () => set({ teamMembers: [] }),

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),

      setMeetingContext: (ctx) => set({ meetingContext: ctx }),

      showToast: (message, type = 'info') => {
        const id = Date.now().toString();
        set({ toast: { id, message, type } });
        setTimeout(() => set({ toast: null }), 3000);
      },
      hideToast: () => set({ toast: null }),
    }),
    {
      name: 'mediator-ai-store',
      partialize: (s) => ({
        testResult: s.testResult,
        teamMembers: s.teamMembers,
      }),
    }
  )
);

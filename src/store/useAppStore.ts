'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeamMember, Message, MeetingRecord } from '@/types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppState {
  teamMembers: TeamMember[];
  messages: Message[];
  meetingContext: string;
  meetingHistory: MeetingRecord[];
  toast: Toast | null;
  theme: 'dark' | 'meditor';

  addTeamMember: (member: TeamMember) => void;
  removeTeamMember: (id: string) => void;
  clearTeamMembers: () => void;

  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  setMeetingContext: (ctx: string) => void;

  saveMeeting: (record: Omit<MeetingRecord, 'id' | 'date'>) => void;
  deleteMeeting: (id: string) => void;

  showToast: (message: string, type?: Toast['type']) => void;
  hideToast: () => void;

  setTheme: (theme: 'dark' | 'meditor') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      teamMembers: [],
      messages: [],
      meetingContext: '',
      meetingHistory: [],
      toast: null,
      theme: 'dark',

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

      saveMeeting: (record) =>
        set((s) => {
          const newRecord: MeetingRecord = {
            ...record,
            id: Date.now().toString(),
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
          };
          const updated = [newRecord, ...s.meetingHistory].slice(0, 20);
          return { meetingHistory: updated };
        }),
      deleteMeeting: (id) =>
        set((s) => ({ meetingHistory: s.meetingHistory.filter((r) => r.id !== id) })),

      showToast: (message, type = 'info') => {
        const id = Date.now().toString();
        set({ toast: { id, message, type } });
        setTimeout(() => set({ toast: null }), 3000);
      },
      hideToast: () => set({ toast: null }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'mediator-ai-store',
      partialize: (s) => ({
        teamMembers: s.teamMembers,
        meetingHistory: s.meetingHistory,
        theme: s.theme,
      }),
    }
  )
);

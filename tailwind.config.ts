import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a14',
        surface: '#12121e',
        surface2: '#1a1a2e',
        surface3: '#1f1f35',
        accent: '#7c3aed',
        accent2: '#06b6d4',
        accent3: '#10b981',
        accent4: '#f59e0b',
        border: 'rgba(167,139,250,0.12)',
        'code-d': '#ef4444',
        'code-o': '#f59e0b',
        'code-c': '#06b6d4',
        'code-e': '#8b5cf6',
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        pulse2: 'pulse2 2s infinite',
        fadeIn: 'fadeIn 0.3s ease',
        micPulse: 'micPulse 1.5s infinite',
        recBlink: 'recBlink 1s infinite',
        waveAnim: 'waveAnim 0.7s ease-in-out infinite',
      },
      keyframes: {
        pulse2: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        micPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.3)' },
          '50%': { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
        },
        recBlink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        waveAnim: {
          '0%,100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

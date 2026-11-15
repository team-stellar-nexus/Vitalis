import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        panel: 'rgb(var(--card) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-soft': 'rgb(var(--line-soft) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        cyan: '#35D9F2',
        blue: '#438AFF',
        violet: '#9675FF',
        green: '#35D49A',
        amber: '#FFB84D',
        red: '#FF5364',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        micro: '0.14em',
        wide2: '0.22em',
      },
      borderRadius: {
        xl2: '0.875rem',
      },
      boxShadow: {
        panel: '0 18px 44px -24px rgba(0, 0, 0, 0.9)',
        glow: '0 0 24px -6px rgba(53, 217, 242, 0.35)',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backgroundImage: {
        'grid-fine':
          'linear-gradient(to right, rgb(var(--line) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--line) / 0.35) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;

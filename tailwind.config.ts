import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f1115',
        foreground: '#f7f8f8',
        primary: {
          DEFAULT: '#5e6ad2',
          foreground: '#ffffff',
        },
        gray: {
          50: '#f7f8f8',
          100: '#e8e8e8',
          200: '#d1d1d1',
          300: '#b4b4b4',
          400: '#8a8f98',
          500: '#6a6f77',
          600: '#4a4f57',
          700: '#3a3f47',
          800: '#2a2f37',
          900: '#1a1f27',
        },
        status: {
          backlog: '#8a8f98',
          todo: '#8b5cf6',
          'in-progress': '#f59e0b',
          'in-review': '#3b82f6',
          done: '#10b981',
          canceled: '#ef4444',
        },
        sidebar: {
          DEFAULT: '#161922',
          foreground: '#8a8f98',
          border: '#2a2f37',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

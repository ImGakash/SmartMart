/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070B16',
          900: '#0B1020',
          850: '#0E1428',
          800: '#101730',
          750: '#141D3B',
          700: '#182142',
        },
        line: 'rgba(148, 163, 184, 0.14)',
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          indigo: '#4F46E5',
          'indigo-bright': '#6366F1',
          violet: '#8B5CF6',
        },
        saffron: {
          DEFAULT: '#F59E0B',
          bright: '#FBBF24',
          soft: '#FCD34D',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          deep: '#06B6D4',
        },
        pass: '#34D399',
        warn: '#FBBF24',
        fail: '#F87171',
        info: '#38BDF8',
        surface: {
          text: '#EEF2FF',
          muted: '#94A3B8',
          faint: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        'glow-indigo': '0 0 25px -5px rgba(79, 70, 229, 0.35)',
        'glow-cyan': '0 0 25px -5px rgba(34, 211, 238, 0.35)',
        'glow-saffron': '0 0 25px -5px rgba(245, 158, 11, 0.35)',
      }
    },
  },
  plugins: [],
}

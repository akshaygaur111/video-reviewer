/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Bump every step up ~1–2 px for better readability
        xs:   ['0.8125rem', { lineHeight: '1.125rem' }],  // 13 px  (was 12)
        sm:   ['0.9375rem', { lineHeight: '1.4rem'   }],  // 15 px  (was 14)
        base: ['1.0625rem', { lineHeight: '1.65rem'  }],  // 17 px  (was 16)
        lg:   ['1.1875rem', { lineHeight: '1.875rem' }],  // 19 px  (was 18)
        xl:   ['1.3125rem', { lineHeight: '1.875rem' }],  // 21 px  (was 20)
        '2xl':['1.5625rem', { lineHeight: '2rem'     }],  // 25 px  (was 24)
      },
      colors: {
        dark: {
          950: '#02020f',
          900: '#05050f',
          800: '#0a0a1a',
          700: '#111128',
          600: '#1a1a35',
          500: '#252548',
        },
        brand: {
          purple: '#7c3aed',
          violet: '#6d28d9',
          cyan: '#06b6d4',
          pink: '#ec4899',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

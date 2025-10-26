import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        '15': '3.75rem',
        '18': '4.5rem',
        '70': '17.5rem',
        '25': '6.25rem',
      },
      zIndex: {
        '25': '25',
        '1000': '1000',
      },
      animation: {
        'pulse': 'pulse 8s ease-in-out infinite',
        'pulse-reverse': 'pulse 10s ease-in-out infinite reverse',
        'focus-pulse': 'focusPulse 0.6s ease-out',
        'spin': 'spin 1s linear infinite',
        'in': 'slideIn 0.2s ease-out',
        'slide-in-from-top-2': 'slideInFromTop 0.2s ease-out',
      },
      keyframes: {
        pulse: {
          '0%, 100%': {
            transform: 'scale(1) rotate(0deg)',
            opacity: '0.8',
          },
          '50%': {
            transform: 'scale(1.1) rotate(180deg)',
            opacity: '1',
          },
        },
        focusPulse: {
          '0%': {
            boxShadow: '0 0 0 0 rgba(30, 93, 66, 0.4)',
          },
          '70%': {
            boxShadow: '0 0 0 6px rgba(30, 93, 66, 0)',
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(30, 93, 66, 0)',
          },
        },
        spin: {
          to: {
            transform: 'rotate(360deg)',
          },
        },
        slideIn: {
          from: {
            opacity: '0',
            transform: 'translateY(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideInFromTop: {
          from: {
            opacity: '0',
            transform: 'translateY(-8px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      screens: {
        'max-md': { 'max': '768px' },
        'max-lg': { 'max': '1024px' },
        'max-sm': { 'max': '375px' },
      },
      backdropBlur: {
        '20': '20px',
        '8': '8px',
        'xl': '20px',
      },
      backdropSaturate: {
        '180': '180%',
      },
    },
  },
  plugins: [],
}
export default config

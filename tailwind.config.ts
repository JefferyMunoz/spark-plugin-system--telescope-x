import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F8F6F1',
          light: '#FFFDF7',
        },
        accent: {
          DEFAULT: '#E07A5F',
          hover: '#C96A52',
          soft: 'rgba(224, 122, 95, 0.1)',
        },
        sketch: {
          black: '#1A1A1A',
          gray: '#4A4A4A',
          muted: '#8B8B8B',
          success: '#4A7C59',
          warning: '#E9C46A',
        }
      },
      fontFamily: {
        heading: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderWidth: {
        'sketch': '1.5px',
      },
      borderRadius: {
        'sketch-sm': '6px',
        'sketch-md': '10px',
        'sketch-lg': '14px',
        'sketch-xl': '18px',
      },
      boxShadow: {
        'sketch': '3px 3px 0px 0px rgba(0, 0, 0, 0.06)',
        'sketch-hover': '4px 4px 0px 0px rgba(0, 0, 0, 0.08)',
        'sketch-button': '2px 2px 0px 0px rgba(0, 0, 0, 1)',
        'sketch-button-hover': '1px 1px 0px 0px rgba(0, 0, 0, 1)',
        'sketch-accent': '0 4px 12px rgba(224, 122, 95, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'pulse-accent': 'pulseAccent 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseAccent: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    }
  },
  plugins: []
} satisfies Config

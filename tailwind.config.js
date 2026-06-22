/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark blue primary
        brand: {
          50: '#e9f0ff',
          100: '#cdddff',
          200: '#9bb8ff',
          300: '#6690f5',
          400: '#3a66e0',
          500: '#1f47c4',
          600: '#16369e',
          700: '#12297a',
          800: '#0e1f5c',
          900: '#0a1742',
          950: '#060e2a',
        },
        // Bright orange accent
        accent: {
          50: '#fff4e6',
          100: '#ffe2bf',
          200: '#ffc680',
          300: '#ffa840',
          400: '#ff8c1a',
          500: '#ff7a00',
          600: '#e66a00',
          700: '#bf5500',
          800: '#994300',
          900: '#7a3600',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

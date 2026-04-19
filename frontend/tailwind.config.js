/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1a365d',
          600: '#15294a',
          700: '#101e38',
          800: '#0b1426',
          900: '#060a14',
        },
        shield: {
          navy: '#1a365d',
          gold: '#d69e2e',
          red: '#e53e3e',
          green: '#38a169',
        },
      },
    },
  },
  plugins: [],
};

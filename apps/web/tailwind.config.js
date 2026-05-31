/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        darkBg: '#0A0A0A',
        darkCard: 'rgba(17, 22, 29, 0.75)',
        gold: {
          light: '#E5C06F',
          DEFAULT: '#C89B3C',
          dark: '#A27928',
        },
        amber: {
          300: '#E5C06F',
          400: '#E5C06F',
          500: '#C89B3C',
          600: '#A27928',
        },
        neonGreen: '#139D72',
        neonRed: '#CF4259',
        neonBlue: '#3BA7B6',
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

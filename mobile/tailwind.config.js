/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Marca "Meu Lava Rápido" — azul água + ciano brilhante
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#0B4F6C',
        },
        ink: '#0f172a',
        muted: '#64748b',
        line: '#e2e8f0',
        bg: '#f8fafc',
      },
      fontFamily: {
        sans: ['PlusJakarta_400Regular'],
        medium: ['PlusJakarta_500Medium'],
        semibold: ['PlusJakarta_600SemiBold'],
        bold: ['PlusJakarta_700Bold'],
      },
    },
  },
  plugins: [],
};

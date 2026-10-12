/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3f0e7',
        ink: '#14241c',
        line: '#e4dccb',
        pine: {
          50: '#f1f7f4',
          100: '#dceee4',
          700: '#1f6a52',
          800: '#164c3c',
          900: '#10241c',
        },
        brass: {
          100: '#f8efd4',
          600: '#a6842f',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,36,28,0.04), 0 10px 30px rgba(20,36,28,0.05)',
      },
    },
  },
  plugins: [],
};

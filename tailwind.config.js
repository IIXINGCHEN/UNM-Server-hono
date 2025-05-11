/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-fast': 'spin 0.5s linear infinite',
      },
      colors: {
        'brand-primary-light': '#3b82f6', // blue-500
        'brand-primary-dark': '#60a5fa',  // blue-400
        'brand-secondary-light': '#8b5cf6', // violet-500
        'brand-secondary-dark': '#a78bfa', // violet-400
      }
    },
  },
  plugins: [],
}

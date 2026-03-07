/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'umce-azul': '#0033A1',
        'umce-azul-light': '#1A4DB5',
        'umce-azul-dark': '#002280',
        'umce-azul-claro': '#E8F0FE',
        'umce-amarillo': '#FF9E18',
        'umce-amarillo-dark': '#E08800',
        'umce-azul-oscuro': '#001D5C',
        'umce-verde': '#127C29',
        'umce-naranja': '#E9511D',
        'umce-rojo': '#90120D',
      },
      fontFamily: {
        'heading': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        'body': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

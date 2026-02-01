/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./main.js",
  ],
  theme: {
    extend: {
      colors: {
        'accent': '#00f2ff',
        'surface': '#111111',
        'bg-main': '#050505',
      }
    },
  },
  plugins: [],
}

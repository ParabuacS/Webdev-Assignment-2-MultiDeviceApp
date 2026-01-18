/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",  // This looks at every EJS file in the views folder to check tailwind
    "./public/**/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'base-tv': '1.5rem',
        'lg-tv': '2rem',
        'xl-tv': '2.5rem',
        '2xl-tv': '3rem',
      },
    },
  },
  plugins: [],
}
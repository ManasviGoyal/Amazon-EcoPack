/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        // Define Amazon-like colors for consistency
        'amazon-blue-dark': '#131921',
        'amazon-blue-light': '#232F3E',
        'amazon-orange': '#FF9900',
        'amazon-teal': '#007185',
      }
    },
  },
  plugins: [],
}

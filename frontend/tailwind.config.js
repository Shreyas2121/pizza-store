/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ffe9ec",
          100: "#ffd3d6",
          200: "#f6a6ac",
          300: "#ef757e",
          400: "#e84c58",
          500: "#e5323f",
          600: "#e42332",
          700: "#cb1425",
          800: "#b60c20",
          900: "#a00019",
        },
      },
    },
  },
  plugins: [],
};

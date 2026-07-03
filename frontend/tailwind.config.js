/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fbeced",
          100: "#f3d0d2",
          400: "#b93a3f",
          500: "#9c2b30",
          600: "#7a1f23",
        },
      },
    },
  },
  plugins: [],
};

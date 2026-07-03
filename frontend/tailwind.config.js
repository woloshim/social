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
        ink: {
          950: "#0a0f1c",
          900: "#0e1526",
          800: "#141d33",
          700: "#1b2740",
          600: "#28365470",
          500: "#3a4a6b",
        },
        accent: {
          300: "#a6c9ee",
          400: "#7bb0e8",
          500: "#5a9ad7",
          600: "#3f7fc0",
          700: "#2f66a3",
        },
        gold: {
          300: "#ffdf9e",
          400: "#ffcf6b",
          500: "#f5b942",
          600: "#dd9c26",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(90, 154, 215, 0.25)",
      },
    },
  },
  plugins: [],
};

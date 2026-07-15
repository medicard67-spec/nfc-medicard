/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#dce9ff",
          200: "#b8d2ff",
          300: "#8ab3ff",
          400: "#5c8fff",
          500: "#3b6ef5",
          600: "#2952db",
          700: "#2140b0",
          800: "#1f388c",
          900: "#1c3070",
          950: "#141d47",
        },
        accent: {
          50: "#ecfdf7",
          100: "#d1faec",
          200: "#a6f3dc",
          300: "#6ce6c8",
          400: "#37d0ae",
          500: "#16b593",
          600: "#0d9277",
          700: "#0c7562",
          800: "#0d5d4f",
          900: "#0d4c42",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)",
        card: "0 2px 8px -2px rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0a0f0d",
        surface: "#141b19",
        surface2: "#1c2523",
        border: "#2a3532",
        primary: "#22c55e",
      },
    },
  },
  plugins: [],
};

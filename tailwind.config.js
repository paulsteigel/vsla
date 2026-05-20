/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "orange-bg":    "#E4701E",
        "orange-hover": "#F18C42",
        "main-text":    "#F28649",
        "sub-title":    "#FF8900",
        "main-title":   "#24272C",
        "gray-text":    "#484746",
        "gray-border":  "#D9D9D9",
        "light-gray":   "#E6E6E6",
        "link":         "#435CE1",
        "danger":       "#DC3545",
        "light-orange": "#FFF4DE",
        "light-pink":   "#FFE2E5",
        "light-green":  "#DCFCE7",
        "light-purple": "#F3E8FF",
      },
      fontFamily: {
        popi:    ["Poppins", "sans-serif"],
        roboto:  ["Roboto", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
        inter:   ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}

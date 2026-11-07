/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      desk: "860px",
    },
    borderRadius: {
      none: "0px",
      sm: "2px",
      DEFAULT: "2px",
      md: "2px",
      lg: "2px",
      xl: "2px",
      "2xl": "2px",
      full: "2px",
    },
    boxShadow: {
      none: "none",
      sm: "none",
      DEFAULT: "none",
      md: "none",
      lg: "none",
      xl: "none",
    },
    extend: {
      colors: {
        paper: "#FAF8F4",
        paperwarm: "#F4EFE6",
        sheet: "#FFFFFF",
        ink: "#171614",
        inksoft: "#57534E",
        inkmuted: "#857F77",
        rule: "#E3DED4",
        accent: "#9E3B24",
        note: "#FBF6EA",
        noteborder: "#E5DEC9",
        handink: "#2C333F",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Newsreader", "Georgia", "serif"],
        hand: ["var(--font-hand)", "Caveat", "cursive"],
      },
      maxWidth: {
        page: "1240px",
      },
    },
  },
  plugins: [],
};

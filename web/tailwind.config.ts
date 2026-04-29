import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      colors: {
        bg: {
          0: "rgb(var(--bg-0) / <alpha-value>)",
          1: "rgb(var(--bg-1) / <alpha-value>)",
          2: "rgb(var(--bg-2) / <alpha-value>)",
        },
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        cyan: "rgb(var(--cyan) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        win: "rgb(var(--win) / <alpha-value>)",
        lose: "rgb(var(--lose) / <alpha-value>)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--primary) / 0.18), 0 0 40px rgb(var(--primary) / 0.12)",
        glowBlue: "0 0 0 1px rgb(var(--cyan) / 0.22), 0 0 40px rgb(var(--cyan) / 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-30%)" },
          "100%": { transform: "translateX(130%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;


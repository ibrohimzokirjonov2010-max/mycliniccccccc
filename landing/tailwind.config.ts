import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f3efe6",
        paper: "#f7f4ec",
        ink: "#142421",
        mute: "#5c6b66",
        line: "#e4ddd0",
        teal: {
          DEFAULT: "#0d9488",
          deep: "#0c3c38",
          btn: "#0f766e",
          ink: "#115e59",
          soft: "#d7f3ef",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        lift: "0 24px 60px -28px rgba(12, 60, 56, 0.45)",
        card: "0 18px 40px -28px rgba(20, 36, 33, 0.35)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;

import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#07090f",
        paper: "#07090f",
        surface: "#121826",
        ink: "#f3f6fb",
        mute: "#93a0b4",
        line: "#243044",
        teal: {
          DEFAULT: "#1760ff",
          deep: "#0b1220",
          btn: "#1760ff",
          ink: "#9db7ff",
          soft: "#13233f",
        },
      },
      fontFamily: {
        display: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        body: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        lift: "0 30px 80px -36px rgba(23, 96, 255, 0.55)",
        card: "0 18px 50px -36px rgba(0, 0, 0, 0.7)",
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

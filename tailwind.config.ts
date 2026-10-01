import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        modsentry: {
          background: "#0B0E0F",
          surface: "#14181A",
          border: "#22292C",
          kick: "#9EFF00",
          kickBright: "#53FC18",
          twitch: "#9146FF",
          critical: "#FF3B30",
          warning: "#FF9500",
          info: "#00E5FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        tactical: "16px",
      },
    },
  },
  plugins: [],
};

export default config;

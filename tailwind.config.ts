import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f8fafc",
        paper: "#0b0f12",
        line: "#263238",
        panel: "#10161b",
        "panel-soft": "#151d23",
        pulse: {
          green: "#00e676",
          red: "#ff5c5c",
          teal: "#18d6b1",
        },
      },
      boxShadow: {
        glow: "0 0 30px rgba(0, 230, 118, 0.18)",
        soft: "0 24px 70px rgba(0, 0, 0, 0.42)",
      },
    },
  },
  plugins: [],
};

export default config;

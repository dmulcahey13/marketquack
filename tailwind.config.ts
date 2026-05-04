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
        ink: "#172033",
        paper: "#f8fafc",
        line: "#d6e0df",
        pulse: {
          green: "#0f8b6f",
          red: "#c2413b",
          amber: "#b7791f",
          teal: "#047b8a",
        },
      },
      boxShadow: {
        soft: "0 20px 55px rgba(23, 32, 51, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;

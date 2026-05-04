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
        ink: "#171717",
        paper: "#f7f7f2",
        line: "#deded2",
        pulse: {
          green: "#0f8b6f",
          red: "#c2413b",
          amber: "#b7791f",
          teal: "#0e7490",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 23, 23, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

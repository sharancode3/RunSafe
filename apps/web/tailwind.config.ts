import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#FFFFFF",
          secondary: "#F5F5F5",
          tertiary: "#EBEBEB",
          inverted: "#000000",
        },
        border: {
          light: "#E5E5E5",
          medium: "#8A8A8A",
          strong: "#000000",
          inverted: "#FFFFFF",
        },
        fg: {
          primary: "#000000",
          secondary: "#525252",
          tertiary: "#8A8A8A",
          inverted: "#FFFFFF",
        },
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;

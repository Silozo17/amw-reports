import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ["var(--font-heading, Anton)", "Anton Fallback", "sans-serif"],
        display: ["var(--font-display, Anton)", "Anton Fallback", "sans-serif"],
        body: ["var(--font-body, Montserrat)", "Montserrat Fallback", "sans-serif"],
        accent: ["Slowdex", "Slowdex Fallback", "cursive"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        "button-primary": {
          DEFAULT: "hsl(var(--button-primary, var(--primary)))",
          foreground: "hsl(var(--button-primary-foreground, var(--primary-foreground)))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        amw: {
          offwhite: "hsl(var(--amw-offwhite))",
          black: "hsl(var(--amw-black))",
          purple: "hsl(var(--amw-purple))",
          blue: "hsl(var(--amw-blue))",
          green: "hsl(var(--amw-green))",
          orange: "hsl(var(--amw-orange))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.06" },
          "50%": { opacity: "0.12" },
        },
        "ring-expand": {
          "0%": { transform: "scale(0.3)", opacity: "0.8" },
          "100%": { transform: "scale(1.2)", opacity: "0" },
        },
        "phone-vibrate": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(-4deg)" },
          "20%": { transform: "rotate(4deg)" },
          "30%": { transform: "rotate(-4deg)" },
          "40%": { transform: "rotate(0deg)" },
        },
        "grow-bar": {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "ring-expand": "ring-expand 2s ease-out infinite",
        "phone-vibrate": "phone-vibrate 2s ease-in-out infinite",
        "grow-bar": "grow-bar 0.8s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

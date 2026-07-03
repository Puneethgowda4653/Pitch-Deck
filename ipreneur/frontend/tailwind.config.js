/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Core brand palette ─────────────────────────────────────────────
        obsidian: "#0A0716",
        "deep-purple": "#130D26",
        surface: "#1A1130",
        "surface-2": "#241840",
        border: "#2A1F45",
        "border-bright": "#3D2F60",

        // ── Primary gradient endpoints ─────────────────────────────────────
        "electric-blue": "#2540B5",
        violet: "#7B2CBF",

        // ── Text hierarchy ─────────────────────────────────────────────────
        "text-primary": "#F5F3FF",
        "text-secondary": "#9B8EC4",
        "text-muted": "#5C4E7A",

        // ── Semantic ───────────────────────────────────────────────────────
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",

        // ── Shorthand aliases ──────────────────────────────────────────────
        brand: {
          50: "#F0EEFF",
          100: "#E0DCFF",
          200: "#C4BBFF",
          300: "#A089FF",
          400: "#7B56FF",
          500: "#5B2EE8",
          600: "#2540B5",
          700: "#1B2D8A",
          800: "#131F5F",
          900: "#0A1240",
          950: "#050920",
        },
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },

      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2540B5 0%, #7B2CBF 100%)",
        "brand-gradient-subtle": "linear-gradient(135deg, rgba(37,64,181,0.15) 0%, rgba(123,44,191,0.15) 100%)",
        "surface-gradient": "linear-gradient(180deg, #1A1130 0%, #0A0716 100%)",
        "hero-gradient": "radial-gradient(ellipse at top center, rgba(123,44,191,0.2) 0%, transparent 70%)",
        "card-gradient": "linear-gradient(135deg, rgba(26,17,48,0.8) 0%, rgba(13,10,30,0.8) 100%)",
      },

      boxShadow: {
        "brand-glow": "0 0 40px rgba(123, 44, 191, 0.3)",
        "card": "0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(42,31,69,0.5)",
        "card-hover": "0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(61,47,96,0.6)",
        "input": "0 0 0 1px rgba(42,31,69,0.8)",
        "input-focus": "0 0 0 2px rgba(123,44,191,0.5), 0 0 0 1px rgba(123,44,191,0.8)",
      },

      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },

      screens: {
        "3xl": "1920px",
      },
    },
  },
  plugins: [],
};

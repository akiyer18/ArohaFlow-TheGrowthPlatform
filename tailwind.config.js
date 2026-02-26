/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: {
            primary: "var(--bg-primary)",
            secondary: "var(--bg-secondary)",
          },
          text: {
            primary: "var(--text-primary)",
            muted: "var(--text-muted)",
          },
          border: "var(--border)",
          accent: "var(--accent)",
          success: "var(--success)",
          warning: "var(--warning)",
          danger: "var(--danger)",
        },
      },
      borderRadius: {
        ui: "12px",
        panel: "16px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.15)",
        cardHover: "0 4px 16px rgba(0,0,0,0.25), 0 12px 32px rgba(0,0,0,0.18)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        250: "250ms",
      },
      transitionTimingFunction: {
        flow: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transition: {
        flow: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
  darkMode: 'class',
} 
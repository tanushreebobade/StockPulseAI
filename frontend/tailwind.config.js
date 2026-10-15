/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          bg: 'var(--bg-color)',
          card: 'var(--card-bg)',
          border: 'var(--card-border)',
          accent: 'var(--accent-color)',
          accentGlow: 'var(--accent-glow)',
          textMuted: 'var(--text-muted)',
          textTitle: 'var(--text-title)',
        },
        brand: {
          bg: '#000000',      // Pure pitch black
          card: '#131313',    // Neutral gray-black
          border: 'rgba(255, 255, 255, 0.08)', // Thin white hairline border
          accent: '#2962FF',  // TradingView Blue
          up: '#089981',      // TradingView Green
          down: '#F23645',    // TradingView Red
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand gold — Kenyan champagne
        gold: {
          50:  '#fdf9ee',
          100: '#f9f0d0',
          200: '#f3e09e',
          300: '#eacc68',
          400: '#e2b93d',
          500: '#C9A84C',
          600: '#b08a35',
          700: '#8d6b28',
          800: '#6e5221',
          900: '#52391a',
        },
        // Deep charcoal sidebar — FLAT keys so @apply works
        sidebar: '#0F1117',
        'sidebar-hover': '#1e2535',
        'sidebar-active': '#1e2535',
        'sidebar-border': '#28334a',
        // Content surfaces — FLAT keys
        'surface':        '#F8F7F4',
        'surface-card':   '#FFFFFF',
        'surface-border': '#E8E4DC',
        'surface-muted':  '#F2EFE9',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 16px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        sidebar: '4px 0 24px 0 rgb(0 0 0 / 0.25)',
      },
    },
  },
  plugins: [],
}

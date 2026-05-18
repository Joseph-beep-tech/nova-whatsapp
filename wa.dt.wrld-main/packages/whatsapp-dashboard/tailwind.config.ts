import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
    },
    extend: {
      colors: {
        // === Semantic tokens (shadcn/ui convention) ===
        // These map to CSS variables defined in design-tokens.css
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // === Backward-compatible aliases ===
        // These preserve existing class names (bg-whatsapp-teal, bg-surface-100)
        // while pointing to the same design system tokens.
        whatsapp: {
          light: 'hsl(var(--teal-11))',
          DEFAULT: 'hsl(var(--teal-9))',
          dark: 'hsl(var(--teal-12))',
          teal: 'hsl(var(--teal-9))',
        },
        surface: {
          50: 'hsl(var(--slate-1))',
          100: 'hsl(var(--slate-2))',
          200: 'hsl(var(--slate-4))',
          300: 'hsl(var(--slate-6))',
          400: 'hsl(var(--slate-9))',
          500: 'hsl(var(--slate-10))',
          600: 'hsl(var(--slate-11))',
          700: 'hsl(var(--slate-11))',
          800: 'hsl(var(--slate-12))',
          900: 'hsl(var(--slate-12))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config

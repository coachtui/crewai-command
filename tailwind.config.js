/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Notion-like light theme palette
        primary: '#14B8A6', // Teal primary
        'primary-hover': '#0D9488', // Darker teal for hover
        'primary-subtle': '#CCFBF1', // Subtle teal background
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        'error-bg': '#FEE2E2',
        info: '#3B82F6',
        // List view design system
        'status-active': '#3B82F6', // Blue for active/assigned
        'status-complete': '#10b981', // Green for completed/available
        'status-draft': '#94a3b8', // Slate gray for draft/unassigned
        'list-separator': '#e2e8f0', // Light gray for list separators
        'list-hover': '#f8fafc', // Very light gray for list hover
        bg: {
          primary: '#FAFAF9', // Neutral background
          secondary: '#FFFFFF', // White surfaces
          subtle: '#F5F5F4', // Subtle surface variant
          hover: '#F5F5F4', // Hover state (light gray)
        },
        text: {
          primary: '#111827', // Dark text
          secondary: '#6B7280', // Muted text
          tertiary: '#9CA3AF', // Even more muted
        },
        border: '#E7E5E4', // Subtle borders
        'border-hover': '#D6D3D1', // Slightly darker on hover
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tight: '-0.015em',
      },
      lineHeight: {
        relaxed: '1.6',
      },
      transitionDuration: {
        '120': '120ms',
        '150': '150ms',
        '180': '180ms',
      },
      transitionTimingFunction: {
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'sm-soft': '0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'md-soft': '0 4px 6px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}

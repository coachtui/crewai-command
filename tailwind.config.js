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
        primary: '#eab308',
        success: '#1DB954',
        warning: '#FDB44B',
        error: '#E22134',
        info: '#1E90FF',
        bg: {
          primary: '#121212',
          secondary: '#1E1E1E',
          hover: '#2A2A2A',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
        },
        border: '#333333',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.5px',
        tight: '-0.25px',
      },
    },
  },
  plugins: [],
}

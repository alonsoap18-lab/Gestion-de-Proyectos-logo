/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        icaa: {
          blue:       '#2d4fa0',
          'blue-mid': '#3a5fb0',
          'blue-light':'#4a7fd4',
          gray:       '#6b7280',
        },
        surface: {
          900: '#0d1117',
          800: '#161b27',
          700: '#1c2333',
          600: '#232d3f',
          500: '#2d3a4f',
          400: '#3d4f66',
        },
      },
      fontFamily: {
        sans:    ['"IBM Plex Sans"',    'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"',    'monospace'],
      },
    },
  },
  plugins: [],
};

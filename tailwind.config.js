/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Driven by the admin-selectable CSS vars (Settings → Typography).
        heading: ['var(--app-font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--app-font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        violet: {
          DEFAULT: '#5B47D6',
          50: '#EEEBFB',
          100: '#E3DEFA',
          600: '#4F3DC7',
        },
        ink: {
          DEFAULT: '#171A2B',
          2: '#3D4157',
        },
      },
    },
  },
  plugins: [],
};

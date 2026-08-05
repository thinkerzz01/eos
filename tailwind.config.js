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
        heading: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
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

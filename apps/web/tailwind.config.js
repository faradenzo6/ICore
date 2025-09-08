/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF3B3B',
        primary2: '#FF6A3D',
        bg: '#111318',
        panel: '#1E222B',
        text: '#E6EDF3',
      },
    },
  },
  plugins: [],
};




/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/renderer/src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {},
    fontFamily: {
      sans: ['"Noto Sans TC"', 'sans-serif'],
      serif: ['"Times New Roman"', 'serif']
    }

  },
  plugins: []
}
